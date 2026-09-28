// Server-side enforcement that the manager is physically at the clubhouse.
// Every manager write goes through requireOnSite(), which verifies a fresh GPS
// fix against the clubhouse geofence and uses it as a heartbeat to accrue
// verified on-site time on the active visit.
import type { Clubhouse, Visit } from "@prisma/client";
import { prisma } from "./db";
import { ApiError } from "./api";
import { distanceM, type Loc } from "./geo";
import { getSettings, type AppSettings } from "./settings";
import { cairoDay } from "./time";

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

/** Auto-closes visits that went silent (no heartbeats) or started on a previous day. */
export async function closeStaleVisits(userId: string, settings: AppSettings) {
  const silentFor = Math.max(settings.maxPingGapSec * 6, 30 * 60) * 1000;
  const staleBefore = new Date(Date.now() - silentFor);
  const today = cairoDay();
  const active = await prisma.visit.findMany({ where: { userId, status: "ACTIVE" } });
  for (const v of active) {
    if (v.day !== today || v.lastPingAt < staleBefore) {
      await prisma.visit.update({ where: { id: v.id }, data: { status: "AUTO_CLOSED", checkOutAt: v.lastPingAt } });
    }
  }
}

export async function getActiveVisit(userId: string, settings: AppSettings) {
  await closeStaleVisits(userId, settings);
  return prisma.visit.findFirst({ where: { userId, status: "ACTIVE" }, include: { clubhouse: true } });
}

/**
 * Logs a GPS fix and, when both this and the previous fix were inside the
 * geofence and close enough together, adds the elapsed time to the visit.
 */
export async function recordPing(visit: Visit, loc: Loc, ev: Eval, settings: AppSettings, source: string): Promise<Visit> {
  const now = new Date();
  let add = 0;
  if (visit.lastPingInside && ev.inside) {
    const gap = (now.getTime() - visit.lastPingAt.getTime()) / 1000;
    if (gap > 0 && gap <= settings.maxPingGapSec) add = Math.round(gap);
  }
  // Conditional on lastPingAt so two concurrent requests can't both count the same interval.
  const res = await prisma.visit.updateMany({
    where: { id: visit.id, status: "ACTIVE", lastPingAt: visit.lastPingAt },
    data: { lastPingAt: now, lastPingInside: ev.inside, verifiedSeconds: { increment: add } },
  });
  await prisma.locationPing.create({
    data: { visitId: visit.id, lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, distanceM: ev.distance, inside: ev.inside, source },
  });
  if (res.count > 0) return { ...visit, lastPingAt: now, lastPingInside: ev.inside, verifiedSeconds: visit.verifiedSeconds + add };
  return (await prisma.visit.findUnique({ where: { id: visit.id } }))!;
}

/**
 * Guard for every manager write: requires an active visit (optionally at a
 * specific clubhouse) and a fresh GPS fix inside its geofence.
 */
export async function requireOnSite(userId: string, rawLoc: unknown, clubhouseId?: string) {
  const loc = parseLoc(rawLoc);
  const settings = await getSettings();
  const visit = await getActiveVisit(userId, settings);
  if (!visit) throw new ApiError(403, "Check in at the clubhouse first.", "NO_VISIT");
  if (clubhouseId && visit.clubhouseId !== clubhouseId) {
    throw new ApiError(403, `You are checked in at ${visit.clubhouse.name}, not this clubhouse.`, "WRONG_CLUBHOUSE");
  }
  const ev = evaluate(visit.clubhouse, loc, settings);
  const updated = await recordPing(visit, loc, ev, settings, "action");
  assertInside(visit.clubhouse, loc, ev);
  return { visit: updated, clubhouse: visit.clubhouse, loc, ev, settings };
}

/** Total verified on-site seconds for a manager at a clubhouse on a given day. */
export async function daySeconds(userId: string, clubhouseId: string, day: string): Promise<number> {
  const agg = await prisma.visit.aggregate({ where: { userId, clubhouseId, day }, _sum: { verifiedSeconds: true } });
  return agg._sum.verifiedSeconds ?? 0;
}
