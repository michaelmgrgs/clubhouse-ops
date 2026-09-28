import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, readJson, route } from "@/lib/api";

export const PATCH = route(async (req: Request, { params }: { params: { id: string } }) => {
  await requireUser("ADMIN");
  const b = await readJson(req);
  const closed = b.status === "CLOSED";
  await prisma.incident.update({
    where: { id: params.id },
    data: { status: closed ? "CLOSED" : "OPEN", closedAt: closed ? new Date() : null },
  });
  return ok();
});
