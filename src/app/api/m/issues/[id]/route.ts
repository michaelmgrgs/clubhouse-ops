import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, ok, readJson, route } from "@/lib/api";
import { requireOnSite } from "@/lib/onsite";
import { claimLoosePhotos } from "@/lib/photos";

/** Close a maintenance issue on site, with an "after" photo. */
export const PATCH = route(async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser("MANAGER");
  const body = await readJson(req);
  const issue = await prisma.issue.findUnique({ where: { id: params.id } });
  if (!issue) throw new ApiError(404, "Issue not found");
  await requireOnSite(user.id, body.loc, issue.clubhouseId);
  if (issue.status === "CLOSED") throw new ApiError(409, "Already closed");
  const note = String(body.closureNote || "").trim();
  if (!note) throw new ApiError(400, "Describe how it was fixed");
  if (!Array.isArray(body.photoIds) || body.photoIds.length === 0) throw new ApiError(400, "Add an 'after' photo");

  await prisma.$transaction(async (tx) => {
    await tx.issue.update({
      where: { id: issue.id },
      data: { status: "CLOSED", closedAt: new Date(), closedById: user.id, closureNote: note.slice(0, 2000) },
    });
    await claimLoosePhotos(tx, body.photoIds, user.id, issue.clubhouseId, { issueId: issue.id, purpose: "closure" });
  });
  return ok();
});
