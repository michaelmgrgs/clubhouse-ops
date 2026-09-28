import { prisma } from "@/lib/db";
import StaffEditor from "./StaffEditor";

export default async function StaffPage() {
  const clubs = await prisma.clubhouse.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  const staff = await prisma.staff.findMany({ orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }] });
  return <StaffEditor clubs={clubs} staff={JSON.parse(JSON.stringify(staff))} />;
}
