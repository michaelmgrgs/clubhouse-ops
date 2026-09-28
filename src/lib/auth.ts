import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { ApiError } from "./api";

const COOKIE = "co_session";
const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const MAX_AGE = 60 * 60 * 24 * 14;

export type Session = { uid: string; role: "ADMIN" | "MANAGER"; name: string };

export function setSession(s: Session) {
  cookies().set(COOKIE, jwt.sign(s, SECRET, { expiresIn: MAX_AGE }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSession() {
  cookies().set(COOKIE, "", { path: "/", maxAge: 0 });
}

export function getSession(): Session | null {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET) as Session;
  } catch {
    return null;
  }
}

/** For route handlers: returns the active DB user or throws 401/403. */
export async function requireUser(role?: "ADMIN" | "MANAGER") {
  const s = getSession();
  if (!s) throw new ApiError(401, "Please sign in again");
  const user = await prisma.user.findUnique({ where: { id: s.uid } });
  if (!user || !user.active) throw new ApiError(401, "Account disabled");
  if (role && user.role !== role) throw new ApiError(403, "Not allowed");
  return user;
}

/** For server components/layouts: redirects instead of throwing. */
export async function requirePageUser(role: "ADMIN" | "MANAGER") {
  const s = getSession();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: s.uid } });
  if (!user || !user.active) redirect("/login");
  if (user.role !== role) redirect(user.role === "ADMIN" ? "/admin" : "/m");
  return user;
}
