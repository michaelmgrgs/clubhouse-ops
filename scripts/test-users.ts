// Dev only: creates/updates local test accounts (tester-admin@test.local, tester-manager@test.local)
// using TEST_USER_PASSWORD from .env. Remove these users before going live.
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";

async function main() {
  const pw = process.env.TEST_USER_PASSWORD;
  if (!pw) throw new Error("Set TEST_USER_PASSWORD in .env");
  const hash = await bcrypt.hash(pw, 10);
  for (const [email, name, role] of [
    ["tester-admin@test.local", "Test Admin", "ADMIN"],
    ["tester-manager@test.local", "Test Manager", "MANAGER"],
  ] as const) {
    await prisma.user.upsert({ where: { email }, update: { passwordHash: hash, active: true }, create: { email, name, role, passwordHash: hash } });
  }
  console.log("test users ready");
}
main().finally(() => prisma.$disconnect());
