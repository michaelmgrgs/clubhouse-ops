import { requireUser } from "@/lib/auth";
import { ok, readJson, route } from "@/lib/api";
import { closeVisit, requireOnSite } from "@/lib/onsite";

/** Check out: must be inside the clubhouse; stops the timer. */
export const POST = route(async (req: Request) => {
  const user = await requireUser("MANAGER");
  const body = await readJson(req);
  const { visit, loc } = await requireOnSite(user.id, body.loc);
  await closeVisit(visit, "COMPLETED", { lat: loc.lat, lng: loc.lng });
  return ok();
});
