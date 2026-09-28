import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, ok, readJson, route } from "@/lib/api";
import { parseStaff } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireUser("ADMIN");
  const staff = await prisma.staff.findMany({ orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }] });
  return ok({ staff });
});

export const POST = route(async (req: Request) => {
  await requireUser("ADMIN");
  const data = parseStaff(await readJson(req));
  if (!data.name || !data.role || !data.clubhouseId) throw new ApiError(400, "Name, role and clubhouse are required");
  await prisma.staff.create({ data: data as any });
  return ok();
});
