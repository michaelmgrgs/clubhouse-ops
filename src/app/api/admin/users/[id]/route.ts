import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, ok, readJson, route } from "@/lib/api";

export const PATCH = route(async (req: Request, { params }: { params: { id: string } }) => {
  const me = await requireUser("ADMIN");
  const b = await readJson(req);
  const data: Record<string, unknown> = {};
  if (b.name !== undefined) data.name = String(b.name).trim();
  if (b.active !== undefined) {
    if (params.id === me.id && !b.active) throw new ApiError(400, "You can't deactivate yourself");
    data.active = Boolean(b.active);
  }
  if (b.password) {
    if (String(b.password).length < 8) throw new ApiError(400, "Password must be at least 8 characters");
    data.passwordHash = await bcrypt.hash(String(b.password), 10);
  }
  await prisma.user.update({ where: { id: params.id }, data });
  return ok();
});
