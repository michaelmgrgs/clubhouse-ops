// Server-side enforcement that the manager is physically at the clubhouse.
//
// Timer rules (per visit):
//  - starts at check-in (which must be inside the geofence)
//  - keeps running with no GPS at all — a locked phone or closed app never pauses it
//  - pauses only when a clear GPS fix (good accuracy) shows the manager outside
//  - resumes on the next fix inside the geofence
//  - stops at check-out or report submission (both must be inside)
//  - a visit that's never closed is ended at the manager's last fix inside
//
// Every manager write goes through requireOnSite(), which verifies a fresh GPS
// fix against the geofence and feeds it to the timer.
import type { Clubhouse, Visit } from "@prisma/client";
import { prisma } from "./db";
import { ApiError } from "./api";
import { distanceM, type Loc } from "./geo";
import { getSettings, type AppSettings } from "./settings";
import { cairoTimeOnDay, DAY_END_HOUR } from "./time";

const MAX_FIX_AGE_MS = 2 * 60 * 1000;

export function parseLoc(raw: any): Loc {
  const lat = Number(raw?.lat);
  const lng = Number(raw?.lng);
  const accuracy = Number(raw?.accuracy);
  if (![lat, lng, accuracy].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new ApiError(400, "Location is required. Turn on GPS and allow location access.", "NO_LOCATION");
  }
  const ts = raw?.ts ? Number(raw.ts) : undefined;
  if (ts && Math.abs(Date.now() - ts) > MAX_FIX_AGE_MS) {
    throw new ApiError(400, "Your GPS fix is out of date. Wait a few seconds and try again.", "STALE_LOCATION");
  }
  return { lat, lng, accuracy, ts };
}

export type Eval = { distance: number; inside: boolean; accuracyOk: boolean };

export function evaluate(club: Clubhouse, loc: Loc, settings: AppSettings): Eval {
  const distance = Math.round(distanceM(loc.lat, loc.lng, club.latitude, club.longitude));
  const accuracyOk = loc.accuracy <= settings.maxAccuracyM;
  return { distance, accuracyOk, inside: accuracyOk && distance <= club.radiusM };
}

export function assertInside(club: Clubhouse, loc: Loc, ev: Eval) {
  if (!ev.accuracyOk) {
    throw new ApiError(
      403,
      `GPS signal is too weak (±${Math.round(loc.accuracy)} m). Move near a window or outside and try again.`,
      "LOW_ACCURACY",
      { distance: ev.distance },
    );
  }
  if (!ev.inside) {
    throw new ApiError(403, `You are ${ev.distance} m away from ${club.name}. You must be inside the clubhouse.`, "OFF_SITE", {
      distance: ev.distance,
    });
  }
}

const secondsBetween = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / 1000));

type TimerFields = Pick<Visit, "status" | "verifiedSeconds" | "runningSince" | "day" | "checkInAt" | "lastInsideAt">;

/**
 * Seconds credited to a visit as of `now`. Live for an active, running visit;
 * once its day has ended (10:30 PM Cairo) it counts only up to its last fix
 * inside — exactly what the auto-close will credit.
 */
export function visitSeconds(v: TimerFields, now = new Date()): number {
  if (v.status !== "ACTIVE" || !v.runningSince) return v.verifiedSeconds;
  if (isPastDayEnd(v, now)) return v.verifiedSeconds + closeAmount(v, "AUTO_CLOSED", now).add;
  return v.verifiedSeconds + secondsBetween(v.runningSince, now);
}

export const dayEnd = (day: string) => cairoTimeOnDay(day, DAY_END_HOUR);

/** True once the visit's day is over (10:30 PM Cairo on that day, or any later day). */
export function isPastDayEnd(v: Pick<Visit, "day">, now = new Date()) {
  return now >= dayEnd(v.day);
}

const TIMER_SELECT = { status: true, verifiedSeconds: true, runningSince: true, day: true, checkInAt: true, lastInsideAt: true } as const;

/**
 * Ends a visit. A check-out / submit (verified inside, now) credits the running
 * stretch up to now; an auto-close credits it only up to the last fix inside.
 */
export function closeAmount(
  visit: Pick<Visit, "runningSince" | "lastInsideAt" | "checkInAt" | "day">,
  how: "COMPLETED" | "AUTO_CLOSED",
  now = new Date(),
) {
  const lastInside = visit.lastInsideAt ?? visit.checkInAt;
  const cutoff = dayEnd(visit.day);
  const end = how === "COMPLETED" ? now : lastInside < cutoff ? lastInside : cutoff;
  const add = visit.runningSince && end > visit.runningSince ? secondsBetween(visit.runningSince, end) : 0;
  return { end, add };
}

export async function closeVisit(visit: Visit, how: "COMPLETED" | "AUTO_CLOSED", extra: { lat?: number; lng?: number } = {}) {
  const { end, add } = closeAmount(visit, how);
  await prisma.visit.updateMany({
    where: { id: visit.id, status: "ACTIVE" },
    data: {
      status: how,
      checkOutAt: end,
      checkOutLat: extra.lat,
      checkOutLng: extra.lng,
      runningSince: null,
      verifiedSeconds: { increment: add },
    },
  });
}

/** Visits still open after 10:30 PM are ended at the manager's last fix inside. */
export async function closeStaleVisits(userId: string) {
  const now = new Date();
  const active = await prisma.visit.findMany({ where: { userId, status: "ACTIVE" } });
  for (const v of active) if (isPastDayEnd(v, now)) await closeVisit(v, "AUTO_CLOSED");
}

/** Closes every manager's visits left open on a previous day (run from admin pages). */
export async function closeAllStaleVisits() {
  const now = new Date();
  const active = await prisma.visit.findMany({ where: { status: "ACTIVE" } });
  for (const v of active) if (isPastDayEnd(v, now)) await closeVisit(v, "AUTO_CLOSED");
}

export async function getActiveVisit(userId: string, _settings?: AppSettings) {
  await closeStaleVisits(userId);
  return prisma.visit.findFirst({ where: { userId, status: "ACTIVE" }, include: { clubhouse: true } });
}

/**
 * Logs a GPS fix and drives the timer: a clear fix outside pauses it, a fix
 * inside resumes it. Weak fixes (bad accuracy) are logged but change nothing,
 * so indoor GPS drift can't pause a manager who is actually there.
 */
export function timerChange(visit: Pick<Visit, "runningSince">, ev: Eval, now: Date) {
  const data: { lastPingAt: Date; lastPingInside: boolean; lastInsideAt?: Date; runningSince?: Date | null; bank?: number } = {
    lastPingAt: now,
    lastPingInside: ev.inside,
  };
  if (ev.inside) {
    data.lastInsideAt = now;
    if (!visit.runningSince) data.runningSince = now; // resume
  } else if (ev.accuracyOk && visit.runningSince) {
    data.bank = secondsBetween(visit.runningSince, now); // pause
    data.runningSince = null;
  }
  return data;
}

export async function recordPing(visit: Visit, loc: Loc, ev: Eval, _settings: AppSettings, source: string): Promise<Visit> {
  const { bank, ...change } = timerChange(visit, ev, new Date());
  const data = { ...change, ...(bank ? { verifiedSeconds: { increment: bank } } : {}) };
  // Conditional on the timer state so two concurrent requests can't both bank the same stretch.
  await prisma.visit.updateMany({ where: { id: visit.id, status: "ACTIVE", runningSince: visit.runningSince }, data });
  await prisma.locationPing.create({
    data: { visitId: visit.id, lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, distanceM: ev.distance, inside: ev.inside, source },
  });
  return (await prisma.visit.findUnique({ where: { id: visit.id } }))!;
}

/**
 * Guard for every manager write: requires an active visit (optionally at a
 * specific clubhouse) and a fresh GPS fix inside its geofence.
 */
export async function requireOnSite(userId: string, rawLoc: unknown, clubhouseId?: string) {
  const loc = parseLoc(rawLoc);
  const settings = await getSettings();
  const visit = await getActiveVisit(userId);
  if (!visit) throw new ApiError(403, "Check in at the clubhouse first.", "NO_VISIT");
  if (clubhouseId && visit.clubhouseId !== clubhouseId) {
    throw new ApiError(403, `You are checked in at ${visit.clubhouse.name}, not this clubhouse.`, "WRONG_CLUBHOUSE");
  }
  const ev = evaluate(visit.clubhouse, loc, settings);
  const updated = await recordPing(visit, loc, ev, settings, "action");
  assertInside(visit.clubhouse, loc, ev);
  return { visit: updated, clubhouse: visit.clubhouse, loc, ev, settings };
}

/** Total credited seconds for a manager at a clubhouse on a given day (live). */
export async function daySeconds(userId: string, clubhouseId: string, day: string): Promise<number> {
  const visits = await prisma.visit.findMany({
    where: { userId, clubhouseId, day },
    select: TIMER_SELECT,
  });
  const now = new Date();
  return visits.reduce((s, v) => s + visitSeconds(v, now), 0);
}

/** Per (clubhouse, day) credited seconds across all managers, for admin views. */
export async function secondsByClubDay(where: { day: { gte?: string; lte?: string; startsWith?: string } }) {
  const visits = await prisma.visit.findMany({
    where,
    select: { clubhouseId: true, ...TIMER_SELECT },
  });
  const now = new Date();
  const map = new Map<string, number>();
  for (const v of visits) {
    const k = `${v.clubhouseId}|${v.day}`;
    map.set(k, (map.get(k) ?? 0) + visitSeconds(v, now));
  }
  return (clubhouseId: string, day: string) => map.get(`${clubhouseId}|${day}`) ?? 0;
}

/**
 * Evidence for a visit: periods with no location at all, and periods the timer
 * was paused because the manager was seen outside.
 */
export function visitEvidence(
  visit: Pick<Visit, "checkInAt" | "checkOutAt" | "status">,
  pings: { at: Date; inside: boolean; accuracy: number }[],
  maxAccuracyM: number,
  now = new Date(),
) {
  const end = visit.status === "ACTIVE" ? now : visit.checkOutAt ?? now;
  const times = [visit.checkInAt, ...pings.map((p) => p.at), end].sort((a, b) => a.getTime() - b.getTime());
  let longestGap = { seconds: 0, from: visit.checkInAt, to: visit.checkInAt };
  for (let i = 1; i < times.length; i++) {
    const s = secondsBetween(times[i - 1], times[i]);
    if (s > longestGap.seconds) longestGap = { seconds: s, from: times[i - 1], to: times[i] };
  }
  // Replay the timer rules over the fixes to find each paused stretch.
  const sorted = [...pings].sort((a, b) => a.at.getTime() - b.at.getTime());
  const pauses: { from: Date; to: Date | null }[] = [];
  let pausedAt: Date | null = null;
  for (const p of sorted) {
    if (!pausedAt && !p.inside && p.accuracy <= maxAccuracyM) pausedAt = p.at;
    else if (pausedAt && p.inside) {
      pauses.push({ from: pausedAt, to: p.at });
      pausedAt = null;
    }
  }
  if (pausedAt) pauses.push({ from: pausedAt, to: null }); // still paused / ended while outside
  const pausedSeconds = pauses.reduce((s, p) => s + secondsBetween(p.from, p.to ?? end), 0);
  return { longestGap, pauses, pausedSeconds };
}
