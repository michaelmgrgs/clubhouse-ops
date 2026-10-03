import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, ok, readJson, route } from "@/lib/api";
import { closeVisit, daySeconds, requireOnSite } from "@/lib/onsite";
import { assertDraft, getOrCreateTodayReport } from "@/lib/manager";
import { ALL_ITEMS, STAFF_ROLE_LABEL } from "@/lib/checklist";
import { fmtMinutes } from "@/lib/time";

export const POST = route(async (req: Request) => {
  const user = await requireUser("MANAGER");
  const body = await readJson(req);
  const { visit, settings, loc } = await requireOnSite(user.id, body.loc);
  const report = await getOrCreateTodayReport(user.id, visit.clubhouseId);
  assertDraft(report);

  const full = await prisma.dailyReport.findUniqueOrThrow({
    where: { id: report.id },
    include: { answers: { include: { _count: { select: { photos: true } } } }, staffChecks: { include: { _count: { select: { photos: true } } } } },
  });
  const staff = await prisma.staff.findMany({ where: { clubhouseId: visit.clubhouseId, active: true } });

  const problems: string[] = [];
  const onSite = await daySeconds(user.id, visit.clubhouseId, report.day);
  const minSeconds = settings.minMinutesPerClubhouse * 60;
  if (onSite < minSeconds) {
    problems.push(`Time on site is ${fmtMinutes(onSite)} — at least ${fmtMinutes(minSeconds)} is required before submitting.`);
  }

  for (const item of ALL_ITEMS) {
    const a = full.answers.find((x) => x.itemKey === item.key);
    if (!a?.status) problems.push(`Checklist: "${item.label}" not answered`);
    else if (a.status === "ISSUE" && !a.note?.trim()) problems.push(`Checklist: add a note for the issue on "${item.label}"`);
    else if (a.status !== "NA" && item.photo === "required" && a._count.photos === 0) problems.push(`Checklist: photo required for "${item.label}"`);
  }

  for (const s of staff) {
    const c = full.staffChecks.find((x) => x.staffId === s.id);
    const who = `${s.name} (${STAFF_ROLE_LABEL[s.role]})`;
    if (!c?.status) problems.push(`Staff: attendance not recorded for ${who}`);
    else if (c.status === "PRESENT" || c.status === "LATE") {
      if (c._count.photos === 0) problems.push(`Staff: photo required for ${who}`);
      if (c.uniformOk == null || c.onPost == null || c.noPhone == null) problems.push(`Staff: complete uniform / on post / phone checks for ${who}`);
    }
  }

  if (problems.length) throw new ApiError(422, "The report isn't complete yet.", "INCOMPLETE", { problems });

  await prisma.dailyReport.update({
    where: { id: report.id },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      onSiteSeconds: onSite,
      summary: body.summary ? String(body.summary).slice(0, 4000) : null,
      userId: user.id,
    },
  });
  // Submitting the report ends the visit and stops the timer.
  await closeVisit(visit, "COMPLETED", { lat: loc.lat, lng: loc.lng });
  return ok();
});
