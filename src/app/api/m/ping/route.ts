import { requireUser } from "@/lib/auth";
import { ok, readJson, route } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { daySeconds, evaluate, getActiveVisit, parseLoc, recordPing } from "@/lib/onsite";
import { visitDto } from "@/lib/manager";

/** GPS heartbeat sent by the manager app every `pingIntervalSec` while checked in. */
export const POST = route(async (req: Request) => {
  const user = await requireUser("MANAGER");
  const body = await readJson(req);
  const loc = parseLoc(body.loc);
  const settings = await getSettings();
  const visit = await getActiveVisit(user.id, settings);
  if (!visit) return ok({ visit: null });
  const ev = evaluate(visit.clubhouse, loc, settings);
  const updated = await recordPing(visit, loc, ev, settings, "ping");
  return ok({
    visit: visitDto(updated),
    inside: ev.inside,
    distance: ev.distance,
    accuracyOk: ev.accuracyOk,
    daySeconds: await daySeconds(user.id, visit.clubhouseId, visit.day),
  });
});
