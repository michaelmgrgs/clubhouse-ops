import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, ok, readJson, route } from "@/lib/api";

export const PATCH = route(async (req: Request, { params }: { params: { id: string } }) => {
  await requireUser("ADMIN");
  const b = await readJson(req);
  const lat = Number(b.latitude);
  const lng = Number(b.longitude);
  const radius = Math.round(Number(b.radiusM));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new ApiError(400, "Invalid coordinates");
  }
  if (!(radius >= 30 && radius <= 1000)) throw new ApiError(400, "Radius must be between 30 and 1000 m");
  await prisma.clubhouse.update({
    where: { id: params.id },
    data: { latitude: lat, longitude: lng, radiusM: radius, locationVerified: true, ...(b.name ? { name: String(b.name).trim() } : {}) },
  });
  return ok();
});
