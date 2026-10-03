import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, route } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { getActiveVisit, visitSeconds } from "@/lib/onsite";
import { visitDto } from "@/lib/manager";
import { cairoDay } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser("MANAGER");
  const settings = await getSettings();
  const active = await getActiveVisit(user.id, settings);
  const day = cairoDay();
  const clubs = await prisma.clubhouse.findMany({ orderBy: { sortOrder: "asc" } });
  const visits = await prisma.visit.findMany({
    where: { userId: user.id, day },
    select: { clubhouseId: true, status: true, verifiedSeconds: true, runningSince: true, day: true, checkInAt: true, lastInsideAt: true },
  });
  const secondsAt = (clubhouseId: string) =>
    visits.filter((v) => v.clubhouseId === clubhouseId).reduce((s, v) => s + visitSeconds(v), 0);
  const reports = await prisma.dailyReport.findMany({ where: { day }, select: { clubhouseId: true, status: true } });
  const openIssues = await prisma.issue.groupBy({ by: ["clubhouseId"], where: { status: "OPEN" }, _count: true });

  return ok({
    user: { name: user.name },
    day,
    settings: {
      minMinutes: settings.minMinutesPerClubhouse,
      pingIntervalSec: settings.pingIntervalSec,
      maxAccuracyM: settings.maxAccuracyM,
    },
    clubhouses: clubs.map((c) => ({
      id: c.id,
      name: c.name,
      lat: c.latitude,
      lng: c.longitude,
      radiusM: c.radiusM,
      seconds: secondsAt(c.id),
      reportStatus: reports.find((r) => r.clubhouseId === c.id)?.status ?? null,
      openIssues: openIssues.find((i) => i.clubhouseId === c.id)?._count ?? 0,
    })),
    activeVisit: active ? visitDto(active) : null,
  });
});
