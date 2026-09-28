import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { setSession } from "@/lib/auth";
import { ApiError, ok, readJson, route } from "@/lib/api";

export const POST = route(async (req: Request) => {
  const { email, password } = await readJson(req);
  const user = await prisma.user.findUnique({ where: { email: String(email || "").trim().toLowerCase() } });
  if (!user || !user.active || !(await bcrypt.compare(String(password || ""), user.passwordHash))) {
    throw new ApiError(401, "Wrong email or password");
  }
  setSession({ uid: user.id, role: user.role, name: user.name });
  return ok({ role: user.role });
});
