// Shared data loaders for the manager API.
import { prisma } from "./db";
import { ApiError } from "./api";
import { cairoDay } from "./time";
import { daySeconds } from "./onsite";
import type { AppSettings } from "./settings";

export function visitDto(v: { id: string; clubhouseId: string; checkInAt: Date; verifiedSeconds: number; lastPingInside: boolean; lastPingAt: Date }) {
  return {
    id: v.id,
    clubhouseId: v.clubhouseId,
    checkInAt: v.checkInAt,
    verifiedSeconds: v.verifiedSeconds,
    lastPingInside: v.lastPingInside,
    lastPingAt: v.lastPingAt,
  };
}

export async function getOrCreateTodayReport(userId: string, clubhouseId: string) {
  const day = cairoDay();
  const where = { clubhouseId_day: { clubhouseId, day } };
  const existing = await prisma.dailyReport.findUnique({ where });
  if (existing) return existing;
  try {
    return await prisma.dailyReport.create({ data: { clubhouseId, day, userId } });
  } catch (e: any) {
    // Two requests raced to create today's report — use the one that won.
    if (e?.code === "P2002") return prisma.dailyReport.findUniqueOrThrow({ where });
    throw e;
  }
}

export function assertDraft(report: { status: string }) {
  if (report.status !== "DRAFT") throw new ApiError(409, "Today's report was already submitted.", "SUBMITTED");
}

export async function reportPayload(reportId: string, userId: string, settings: AppSettings) {
  const report = await prisma.dailyReport.findUniqueOrThrow({
    where: { id: reportId },
    include: {
      answers: { include: { photos: { select: { id: true }, orderBy: { createdAt: "asc" } } } },
      staffChecks: { include: { photos: { select: { id: true }, orderBy: { createdAt: "asc" } } } },
    },
  });
  const staff = await prisma.staff.findMany({
    where: { clubhouseId: report.clubhouseId, active: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  const answers: Record<string, unknown> = {};
  for (const a of report.answers) {
    answers[a.itemKey] = { status: a.status, note: a.note, photos: a.photos.map((p) => p.id) };
  }
  const checks = new Map(report.staffChecks.map((c) => [c.staffId, c]));
  return {
    report: { id: report.id, day: report.day, status: report.status, summary: report.summary, submittedAt: report.submittedAt },
    answers,
    staff: staff.map((s) => {
      const c = checks.get(s.id);
      return {
        id: s.id,
        name: s.name,
        role: s.role,
        certificateExpiry: s.certificateExpiry,
        check: c
          ? { status: c.status, uniformOk: c.uniformOk, onPost: c.onPost, noPhone: c.noPhone, note: c.note, photos: c.photos.map((p) => p.id) }
          : null,
      };
    }),
    onSiteSeconds: await daySeconds(userId, report.clubhouseId, report.day),
    minSeconds: settings.minMinutesPerClubhouse * 60,
  };
}
