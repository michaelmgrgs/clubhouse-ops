import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, ok, readJson, route } from "@/lib/api";
import { requireOnSite } from "@/lib/onsite";
import { claimLoosePhotos } from "@/lib/photos";
import { ESCALATION_TARGETS, INCIDENT_TYPES, SEVERITIES } from "@/lib/checklist";
import { cairoDay } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  const user = await requireUser("MANAGER");
  const clubhouseId = new URL(req.url).searchParams.get("clubhouseId") || undefined;
  const since = new Date(Date.now() - 7 * 86400_000);
  const incidents = await prisma.incident.findMany({
    where: { clubhouseId, userId: user.id, createdAt: { gte: since } },
    orderBy: { occurredAt: "desc" },
    include: { _count: { select: { photos: true } } },
  });
  return ok({ incidents });
});

export const POST = route(async (req: Request) => {
  const user = await requireUser("MANAGER");
  const body = await readJson(req);
  const { visit } = await requireOnSite(user.id, body.loc);

  if (!INCIDENT_TYPES.includes(body.type)) throw new ApiError(400, "Choose an incident type");
  if (!SEVERITIES.includes(body.severity)) throw new ApiError(400, "Choose a severity");
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  if (!title || !description) throw new ApiError(400, "Title and description are required");
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  if (isNaN(occurredAt.getTime()) || occurredAt > new Date(Date.now() + 5 * 60_000) || cairoDay(occurredAt) !== cairoDay()) {
    throw new ApiError(400, "Incident time must be earlier today");
  }
  const escalatedTo = (Array.isArray(body.escalatedTo) ? body.escalatedTo : []).filter((x: string) =>
    (ESCALATION_TARGETS as readonly string[]).includes(x),
  );

  const id = await prisma.$transaction(async (tx) => {
    const incident = await tx.incident.create({
    data: {
      clubhouseId: visit.clubhouseId,
      userId: user.id,
      type: body.type,
      severity: body.severity,
      title: title.slice(0, 200),
      description: description.slice(0, 4000),
      actionTaken: body.actionTaken ? String(body.actionTaken).slice(0, 4000) : null,
      escalatedTo,
      occurredAt,
    },
    });
    await claimLoosePhotos(tx, body.photoIds, user.id, visit.clubhouseId, { incidentId: incident.id });
    return incident.id;
  });
  return ok({ id });
});
