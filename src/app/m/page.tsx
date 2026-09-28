import { requirePageUser } from "@/lib/auth";
import ManagerApp from "./ManagerApp";

export const dynamic = "force-dynamic";

export default async function ManagerPage() {
  await requirePageUser("MANAGER");
  return <ManagerApp />;
}
