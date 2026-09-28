import { prisma } from "./db";
import { addDays, cairoDay } from "./time";

export type DayCell = { day: string; seconds: number; report: "DRAFT" | "SUBMITTED" | null; state: "ok" | "part" | "miss" | "none" };

/** Per clubhouse, per day: verified on-site seconds (all managers) + report status. */
export async function complianceGrid(fromDay: string, toDay: string, minSeconds: number) {
  const clubs = await prisma.clubhouse.findMany({ orderBy: { sortOrder: "asc" } });
  const visits = await prisma.visit.groupBy({
    by: ["clubhouseId", "day"],
    where: { day: { gte: fromDay, lte: toDay } },
    _sum: { verifiedSeconds: true },
  });
  const reports = await prisma.dailyReport.findMany({
    where: { day: { gte: fromDay, lte: toDay } },
    select: { clubhouseId: true, day: true, status: true, id: true },
  });
  const today = cairoDay();
  // Days before the first-ever visit predate the app — don't count them as missed.
  const firstVisit = await prisma.visit.findFirst({ orderBy: { day: "asc" }, select: { day: true } });
  const trackingFrom = firstVisit?.day ?? today;
  const days: string[] = [];
  for (let d = fromDay; d <= toDay; d = addDays(d, 1)) days.push(d);

  return {
    days,
    rows: clubs.map((c) => ({
      club: c,
      cells: days.map((day): DayCell & { reportId?: string } => {
        const seconds = visits.find((v) => v.clubhouseId === c.id && v.day === day)?._sum.verifiedSeconds ?? 0;
        const r = reports.find((x) => x.clubhouseId === c.id && x.day === day);
        const report = r?.status ?? null;
        let state: DayCell["state"];
        if (seconds >= minSeconds && report === "SUBMITTED") state = "ok";
        else if (seconds > 0 || report) state = "part";
        else state = day >= today || day < trackingFrom ? "none" : "miss";
        return { day, seconds, report, state, reportId: r?.id };
      }),
    })),
  };
}
