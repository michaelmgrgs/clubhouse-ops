import { requireUser } from "@/lib/auth";
import { ok, route } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { ApiError } from "@/lib/api";
import { getActiveVisit } from "@/lib/onsite";
import { getOrCreateTodayReport, reportPayload } from "@/lib/manager";

export const dynamic = "force-dynamic";

/** Today's report for the clubhouse the manager is checked in at. */
export const GET = route(async () => {
  const user = await requireUser("MANAGER");
  const settings = await getSettings();
  const visit = await getActiveVisit(user.id, settings);
  if (!visit) throw new ApiError(403, "Check in at the clubhouse first.", "NO_VISIT");
  const report = await getOrCreateTodayReport(user.id, visit.clubhouseId);
  return ok(await reportPayload(report.id, user.id, settings));
});
