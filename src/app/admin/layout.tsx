import { requirePageUser } from "@/lib/auth";
import { maybeRunCleanup } from "@/lib/cleanup";
import { closeAllStaleVisits } from "@/lib/onsite";
import { AdminMobileNav, AdminSidebar } from "@/components/AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("ADMIN");
  // Fallback for the daily cron: purges expired photos at most every 12h.
  await maybeRunCleanup();
  // Visits nobody checked out of by 10:30 PM are ended at the manager's last location inside.
  await closeAllStaleVisits();
  return (
    <div className="a-shell">
      <AdminSidebar name={user.name} />
      <div style={{ minWidth: 0 }}>
        <AdminMobileNav />
        <main className="a-main">{children}</main>
      </div>
    </div>
  );
}
