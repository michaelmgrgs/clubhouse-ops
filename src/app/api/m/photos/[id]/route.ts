import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, ok, readJson, route } from "@/lib/api";
import { requireOnSite } from "@/lib/onsite";
import { storage } from "@/lib/storage";

/** Remove a photo from a draft report (or an unattached upload). */
export const DELETE = route(async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser("MANAGER");
  const body = await readJson(req);
  await requireOnSite(user.id, body.loc);
  const photo = await prisma.photo.findUnique({
    where: { id: params.id },
    include: { answer: { include: { report: true } }, staffCheck: { include: { report: true } } },
  });
  if (!photo || photo.uploadedById !== user.id) throw new ApiError(404, "Photo not found");
  if (photo.incidentId || photo.issueId) throw new ApiError(409, "This photo is part of a submitted record");
  const report = photo.answer?.report ?? photo.staffCheck?.report;
  if (report && report.status !== "DRAFT") throw new ApiError(409, "Report already submitted");
  await storage.remove(photo.storageKey);
  await prisma.photo.delete({ where: { id: photo.id } });
  return ok();
});
