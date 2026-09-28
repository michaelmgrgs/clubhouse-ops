import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, ok, readJson, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireUser("ADMIN");
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  return ok({ users });
});

export const POST = route(async (req: Request) => {
  await requireUser("ADMIN");
  const b = await readJson(req);
  const name = String(b.name || "").trim();
  const email = String(b.email || "").trim().toLowerCase();
  const password = String(b.password || "");
  const role = b.role === "ADMIN" ? "ADMIN" : "MANAGER";
  if (!name || !email.includes("@")) throw new ApiError(400, "Name and a valid email are required");
  if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters");
  if (await prisma.user.findUnique({ where: { email } })) throw new ApiError(409, "That email is already in use");
  await prisma.user.create({ data: { name, email, role, passwordHash: await bcrypt.hash(password, 10) } });
  return ok();
});
