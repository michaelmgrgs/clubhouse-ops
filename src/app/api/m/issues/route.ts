import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, ok, readJson, route } from "@/lib/api";
import { requireOnSite } from "@/lib/onsite";
import { claimLoosePhotos } from "@/lib/photos";
import { ISSUE_CATEGORIES, SLA_HOURS } from "@/lib/checklist";

export const dynamic = "force-dynamic";


export const GET = route(async (req: Request) => {
  await requireUser("MANAGER");
  const clubhouseId = new URL(req.url).searchParams.get("clubhouseId") || undefined;
  const issues = await prisma.issue.findMany({
    where: {
      clubhouseId,
      OR: [{ status: "OPEN" }, { closedAt: { gte: new Date(Date.now() - 3 * 86400_000) } }],
    },
    orderBy: [{ status: "desc" }, { dueAt: "asc" }],
    include: { photos: { select: { id: true, purpose: true } } },
  });
  return ok({ issues });
});

export const POST = route(async (req: Request) => {
  const user = await requireUser("MANAGER");
  const body = await readJson(req);
  const { visit } = await requireOnSite(user.id, body.loc);
  if (!ISSUE_CATEGORIES.includes(body.category)) throw new ApiError(400, "Choose a category");
  const title = String(body.title || "").trim();
  if (!title) throw new ApiError(400, "Describe the issue");
  if (!Array.isArray(body.photoIds) || body.photoIds.length === 0) throw new ApiError(400, "Add at least one photo of the issue");

  const now = new Date();
  const id = await prisma.$transaction(async (tx) => {
    const issue = await tx.issue.create({
    data: {
      clubhouseId: visit.clubhouseId,
      reportedById: user.id,
      category: body.category,
      title: title.slice(0, 200),
      description: body.description ? String(body.description).slice(0, 4000) : null,
      openedAt: now,
      dueAt: new Date(now.getTime() + SLA_HOURS * 3600_000),
    },
    });
    await claimLoosePhotos(tx, body.photoIds, user.id, visit.clubhouseId, { issueId: issue.id });
    return issue.id;
  });
  return ok({ id });
});
