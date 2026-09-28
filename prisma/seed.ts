// Seeds the two CFC clubhouses, an admin, a manager and a placeholder staff roster.
// Coordinates are PLACEHOLDERS near Cairo Festival City — set the exact
// positions from the admin "Clubhouses" page while standing at each clubhouse.
import { PrismaClient, StaffRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertUser(email: string | undefined, password: string | undefined, name: string, role: "ADMIN" | "MANAGER") {
  if (!email || !password) {
    console.log(`skip ${role}: set SEED_${role}_EMAIL / SEED_${role}_PASSWORD in .env`);
    return;
  }
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role, passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`${role}: ${email}`);
}

async function main() {
  await prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const clubs = [
    { code: "ORIANA", name: "Oriana Community Center", latitude: 30.0262, longitude: 31.4042, sortOrder: 1 },
    { code: "FESTIVAL", name: "Festival Living Community Center", latitude: 30.0311, longitude: 31.4118, sortOrder: 2 },
  ];
  for (const c of clubs) {
    const club = await prisma.clubhouse.upsert({ where: { code: c.code }, update: {}, create: c });
    if ((await prisma.staff.count({ where: { clubhouseId: club.id } })) === 0) {
      const roster: [string, StaffRole][] = [
        ["Receptionist A", "RECEPTIONIST"],
        ["Receptionist B", "RECEPTIONIST"],
        ["Gym Operator A", "GYM_TRAINER"],
        ["Gym Operator B", "GYM_TRAINER"],
        ["Lifeguard A", "LIFEGUARD"],
      ];
      for (const [name, role] of roster) {
        await prisma.staff.create({
          data: {
            name: `${name} (${c.code === "ORIANA" ? "Oriana" : "Festival"})`,
            role,
            clubhouseId: club.id,
            certificateExpiry: role === "LIFEGUARD" ? new Date(Date.now() + 180 * 86400_000) : null,
          },
        });
      }
    }
  }

  await upsertUser(process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD, "Admin", "ADMIN");
  await upsertUser(process.env.SEED_MANAGER_EMAIL, process.env.SEED_MANAGER_PASSWORD, "Clubhouse Manager", "MANAGER");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
