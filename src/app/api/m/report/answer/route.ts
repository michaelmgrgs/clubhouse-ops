import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, ok, readJson, route } from "@/lib/api";
import { requireOnSite } from "@/lib/onsite";
import { assertDraft, getOrCreateTodayReport } from "@/lib/manager";
import { findItem } from "@/lib/checklist";

const STATUSES = ["OK", "ISSUE", "NA"];

export const PUT = route(async (req: Request) => {
  const user = await requireUser("MANAGER");
  const body = await readJson(req);
  const { visit } = await requireOnSite(user.id, body.loc);
  const item = findItem(String(body.itemKey));
  if (!item) throw new ApiError(400, "Unknown checklist item");
  const report = await getOrCreateTodayReport(user.id, visit.clubhouseId);
  assertDraft(report);

  const data: { status?: any; note?: string | null } = {};
  if (body.status !== undefined) {
    if (body.status !== null && !STATUSES.includes(body.status)) throw new ApiError(400, "Invalid status");
    data.status = body.status;
  }
  if (body.note !== undefined) data.note = body.note ? String(body.note).slice(0, 1000) : null;

  await prisma.checklistAnswer.upsert({
    where: { reportId_itemKey: { reportId: report.id, itemKey: item.key } },
    update: data,
    create: { reportId: report.id, itemKey: item.key, section: item.section, label: item.label, ...data },
  });
  return ok();
});
