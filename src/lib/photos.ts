import type { Prisma } from "@prisma/client";
import { ApiError } from "./api";

/**
 * Attaches the manager's own unattached uploads (from this clubhouse) to a
 * record. Call inside a transaction so a failure rolls back the record too.
 */
export async function claimLoosePhotos(
  tx: Prisma.TransactionClient,
  ids: unknown,
  userId: string,
  clubhouseId: string,
  link: { incidentId?: string; issueId?: string; purpose?: string },
) {
  const list = Array.isArray(ids) ? Array.from(new Set(ids.map(String))).slice(0, 8) : [];
  if (!list.length) return 0;
  const res = await tx.photo.updateMany({
    where: { id: { in: list }, uploadedById: userId, clubhouseId, answerId: null, staffCheckId: null, incidentId: null, issueId: null },
    data: link,
  });
  if (res.count !== list.length) throw new ApiError(400, "Some photos could not be attached. Please retake them.");
  return res.count;
}
