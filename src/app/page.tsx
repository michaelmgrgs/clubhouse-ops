import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default function Home() {
  const s = getSession();
  if (!s) redirect("/login");
  redirect(s.role === "ADMIN" ? "/admin" : "/m");
}
