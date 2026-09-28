import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, readJson, route } from "@/lib/api";
import { parseStaff } from "@/lib/staff";

export const PATCH = route(async (req: Request, { params }: { params: { id: string } }) => {
  await requireUser("ADMIN");
  await prisma.staff.update({ where: { id: params.id }, data: parseStaff(await readJson(req)) });
  return ok();
});
