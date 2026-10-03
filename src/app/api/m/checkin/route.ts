import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, ok, readJson, route } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { assertInside, closeVisit, dayEnd, evaluate, getActiveVisit, parseLoc } from "@/lib/onsite";
import { visitDto } from "@/lib/manager";
import { cairoDay } from "@/lib/time";

export const POST = route(async (req: Request) => {
  const user = await requireUser("MANAGER");
  const body = await readJson(req);
  const loc = parseLoc(body.loc);
  const settings = await getSettings();
  const club = await prisma.clubhouse.findUnique({ where: { id: String(body.clubhouseId) } });
  if (!club) throw new ApiError(404, "Clubhouse not found");

  if (new Date() >= dayEnd(cairoDay())) {
    throw new ApiError(403, "Clubhouse duty has ended for today (check-in closes at 10:30 PM).", "DAY_ENDED");
  }

  const ev = evaluate(club, loc, settings);
  assertInside(club, loc, ev);

  const current = await getActiveVisit(user.id, settings);
  if (current?.clubhouseId === club.id) return ok({ visit: visitDto(current) });
  if (current) {
    // Arriving at another clubhouse without checking out: end the old visit at its last fix inside.
    await closeVisit(current, "AUTO_CLOSED");
  }

  const now = new Date();
  const visit = await prisma.visit.create({
    data: {
      userId: user.id,
      clubhouseId: club.id,
      day: cairoDay(now),
      checkInAt: now,
      checkInLat: loc.lat,
      checkInLng: loc.lng,
      checkInAccuracy: loc.accuracy,
      runningSince: now,
      lastInsideAt: now,
      lastPingAt: now,
      lastPingInside: true,
      pings: { create: { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, distanceM: ev.distance, inside: true, source: "checkin" } },
    },
  });
  return ok({ visit: visitDto(visit) });
});
