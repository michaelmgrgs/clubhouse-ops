import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, ok, route } from "@/lib/api";
import { requireOnSite } from "@/lib/onsite";
import { assertDraft, getOrCreateTodayReport } from "@/lib/manager";
import { findItem } from "@/lib/checklist";
import { storage } from "@/lib/storage";

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_PER_TARGET = 4;

/**
 * Upload one camera photo. Target:
 *  - answer: attaches to a checklist item on today's report (itemKey)
 *  - staff:  attaches to a staff member's check on today's report (staffId)
 *  - loose:  unattached; referenced later when creating an incident / issue
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser("MANAGER");
  const form = await req.formData();
  let rawLoc: unknown;
  try {
    rawLoc = JSON.parse(String(form.get("loc")));
  } catch {
    rawLoc = null;
  }
  const { visit, loc, ev } = await requireOnSite(user.id, rawLoc);

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) throw new ApiError(400, "No photo received");
  if (file.size > MAX_BYTES) throw new ApiError(413, "Photo is too large");
  if (file.type !== "image/jpeg") throw new ApiError(400, "Photo must be a JPEG");

  const target = String(form.get("target") || "loose");
  const link: { answerId?: string; staffCheckId?: string } = {};

  if (target === "answer" || target === "staff") {
    const report = await getOrCreateTodayReport(user.id, visit.clubhouseId);
    assertDraft(report);
    if (target === "answer") {
      const item = findItem(String(form.get("itemKey")));
      if (!item) throw new ApiError(400, "Unknown checklist item");
      const a = await prisma.checklistAnswer.upsert({
        where: { reportId_itemKey: { reportId: report.id, itemKey: item.key } },
        update: {},
        create: { reportId: report.id, itemKey: item.key, section: item.section, label: item.label },
        include: { _count: { select: { photos: true } } },
      });
      if (a._count.photos >= MAX_PER_TARGET) throw new ApiError(400, `Maximum ${MAX_PER_TARGET} photos per item`);
      link.answerId = a.id;
    } else {
      const staff = await prisma.staff.findUnique({ where: { id: String(form.get("staffId")) } });
      if (!staff || staff.clubhouseId !== visit.clubhouseId) throw new ApiError(404, "Staff member not found");
      const c = await prisma.staffCheck.upsert({
        where: { reportId_staffId: { reportId: report.id, staffId: staff.id } },
        update: {},
        create: { reportId: report.id, staffId: staff.id },
        include: { _count: { select: { photos: true } } },
      });
      if (c._count.photos >= MAX_PER_TARGET) throw new ApiError(400, `Maximum ${MAX_PER_TARGET} photos per staff member`);
      link.staffCheckId = c.id;
    }
  } else if (target !== "loose") {
    throw new ApiError(400, "Invalid photo target");
  }

  const key = await storage.put(Buffer.from(await file.arrayBuffer()), "jpg");
  const photo = await prisma.photo.create({
    data: {
      storageKey: key,
      mime: "image/jpeg",
      sizeBytes: file.size,
      uploadedById: user.id,
      clubhouseId: visit.clubhouseId,
      lat: loc.lat,
      lng: loc.lng,
      accuracy: loc.accuracy,
      distanceM: ev.distance,
      ...link,
    },
  });
  return ok({ id: photo.id });
});
