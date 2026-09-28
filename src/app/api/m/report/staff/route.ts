import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, ok, readJson, route } from "@/lib/api";
import { requireOnSite } from "@/lib/onsite";
import { assertDraft, getOrCreateTodayReport } from "@/lib/manager";

const STATUSES = ["PRESENT", "LATE", "ABSENT", "OFF"];

export const PUT = route(async (req: Request) => {
  const user = await requireUser("MANAGER");
  const body = await readJson(req);
  const { visit } = await requireOnSite(user.id, body.loc);
  const staff = await prisma.staff.findUnique({ where: { id: String(body.staffId) } });
  if (!staff || staff.clubhouseId !== visit.clubhouseId) throw new ApiError(404, "Staff member not found at this clubhouse");
  const report = await getOrCreateTodayReport(user.id, visit.clubhouseId);
  assertDraft(report);

  const data: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (body.status !== null && !STATUSES.includes(body.status)) throw new ApiError(400, "Invalid status");
    data.status = body.status;
  }
  for (const k of ["uniformOk", "onPost", "noPhone"]) {
    if (body[k] !== undefined) data[k] = body[k] === null ? null : Boolean(body[k]);
  }
  if (body.note !== undefined) data.note = body.note ? String(body.note).slice(0, 1000) : null;

  await prisma.staffCheck.upsert({
    where: { reportId_staffId: { reportId: report.id, staffId: staff.id } },
    update: data,
    create: { reportId: report.id, staffId: staff.id, ...data },
  });
  return ok();
});
