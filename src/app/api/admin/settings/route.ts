import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, ok, readJson, route } from "@/lib/api";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const LIMITS: Record<string, [number, number]> = {
  minMinutesPerClubhouse: [15, 480],
  pingIntervalSec: [20, 300],
  maxPingGapSec: [60, 1800],
  maxAccuracyM: [10, 500],
  photoRetentionDays: [7, 365],
};

export const GET = route(async () => {
  await requireUser("ADMIN");
  return ok({ settings: await getSettings() });
});

export const PATCH = route(async (req: Request) => {
  await requireUser("ADMIN");
  const b = await readJson(req);
  const data: Record<string, number> = {};
  for (const [k, [min, max]] of Object.entries(LIMITS)) {
    if (b[k] === undefined) continue;
    const v = Math.round(Number(b[k]));
    if (!(v >= min && v <= max)) throw new ApiError(400, `${k} must be between ${min} and ${max}`);
    data[k] = v;
  }
  const merged = { ...(await getSettings()), ...data };
  if (merged.maxPingGapSec < merged.pingIntervalSec * 2) {
    throw new ApiError(400, "Max heartbeat gap must be at least twice the heartbeat interval");
  }
  await prisma.settings.update({ where: { id: 1 }, data });
  return ok();
});
