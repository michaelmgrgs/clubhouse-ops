"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: "home" },
  { href: "/admin/reports", label: "Daily reports", icon: "file" },
  { href: "/admin/incidents", label: "Incidents", icon: "alert" },
  { href: "/admin/issues", label: "Maintenance", icon: "wrench" },
  { href: "/admin/attendance", label: "Monthly attendance", icon: "calendar" },
  { href: "/admin/staff", label: "Staff roster", icon: "users" },
  { href: "/admin/clubhouses", label: "Clubhouses", icon: "building" },
  { href: "/admin/users", label: "Users", icon: "shield" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
];

function isActive(path: string, href: string) {
  return href === "/admin" ? path === "/admin" : path.startsWith(href);
}

export function AdminSidebar({ name }: { name: string }) {
  const path = usePathname();
  return (
    <aside className="a-side">
      <div className="logo">
        <div className="logo-mark">C</div>
        Clubhouse Ops
      </div>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={isActive(path, l.href) ? "active" : ""}>
          <Icon name={l.icon} size={17} />
          {l.label}
        </Link>
      ))}
      <div className="foot stack-sm">
        <span>{name}</span>
        <button
          className="btn btn-sm"
          style={{ background: "transparent", color: "#cfe3dc", borderColor: "rgba(255,255,255,0.15)" }}
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
        >
          <Icon name="logout" size={15} /> Sign out
        </button>
      </div>
    </aside>
  );
}

export function AdminMobileNav() {
  const path = usePathname();
  return (
    <nav className="a-mobile-nav">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={isActive(path, l.href) ? "active" : ""}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
