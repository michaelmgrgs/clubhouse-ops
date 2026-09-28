import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, readJson, route } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { evaluate, getActiveVisit, parseLoc, recordPing } from "@/lib/onsite";

export const POST = route(async (req: Request) => {
  const user = await requireUser("MANAGER");
  const body = await readJson(req);
  const loc = parseLoc(body.loc);
  const settings = await getSettings();
  const visit = await getActiveVisit(user.id, settings);
  if (!visit) return ok();
  // Checking out doesn't require being inside, but the final interval only counts if you are.
  const ev = evaluate(visit.clubhouse, loc, settings);
  await recordPing(visit, loc, ev, settings, "checkout");
  await prisma.visit.update({
    where: { id: visit.id },
    data: { status: "COMPLETED", checkOutAt: new Date(), checkOutLat: loc.lat, checkOutLng: loc.lng },
  });
  return ok();
});
