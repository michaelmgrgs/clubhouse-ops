"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { send } from "@/lib/client/api";

export function IncidentToggle({ id, status }: { id: string; status: "OPEN" | "CLOSED" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={`btn btn-sm ${status === "OPEN" ? "" : "btn-ghost"}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await send(`/api/admin/incidents/${id}`, "PATCH", { status: status === "OPEN" ? "CLOSED" : "OPEN" });
        router.refresh();
        setBusy(false);
      }}
    >
      {status === "OPEN" ? "Mark closed" : "Reopen"}
    </button>
  );
}
