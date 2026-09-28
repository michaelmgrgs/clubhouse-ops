import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import UsersEditor from "./UsersEditor";

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  return <UsersEditor users={users} meId={getSession()!.uid} />;
}
