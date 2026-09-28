"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/Icon";
import { send } from "@/lib/client/api";
import { STAFF_ROLE_LABEL } from "@/lib/checklist";

type Staff = { id: string; name: string; role: string; clubhouseId: string; phone: string | null; certificateExpiry: string | null; active: boolean };
type Club = { id: string; name: string };

export default function StaffEditor({ clubs, staff }: { clubs: Club[]; staff: Staff[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<Staff> | null>(null);

  return (
    <div className="stack-lg">
      <div className="a-head">
        <div className="stack-sm">
          <h1>Staff roster</h1>
          <p className="muted small">The manager records attendance and takes a photo for every active staff member each day.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ role: "RECEPTIONIST", clubhouseId: clubs[0]?.id, active: true })}>
          <Icon name="plus" /> Add staff
        </button>
      </div>
      {clubs.map((c) => {
        const list = staff.filter((s) => s.clubhouseId === c.id);
        return (
          <div key={c.id} className="card table-wrap">
            <div className="section-h" style={{ paddingBottom: 10 }}>
              <h2>{c.name}</h2>
              <span className="badge">{list.filter((s) => s.active).length} active</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Phone</th>
                  <th>Lifesaving cert.</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const exp = s.certificateExpiry ? new Date(s.certificateExpiry) : null;
                  const days = exp ? Math.floor((exp.getTime() - Date.now()) / 86400_000) : null;
                  return (
                    <tr key={s.id} style={{ opacity: s.active ? 1 : 0.5 }}>
                      <td className="bold">
                        {s.name} {!s.active && <span className="badge">inactive</span>}
                      </td>
                      <td>{STAFF_ROLE_LABEL[s.role]}</td>
                      <td className="small">{s.phone || "—"}</td>
                      <td>
                        {s.role !== "LIFEGUARD" ? (
                          <span className="muted">—</span>
                        ) : !exp ? (
                          <span className="badge bad">Missing</span>
                        ) : days! < 0 ? (
                          <span className="badge bad">Expired {exp.toLocaleDateString("en-GB")}</span>
                        ) : (
                          <span className={`badge ${days! < 30 ? "warn" : "ok"}`}>{exp.toLocaleDateString("en-GB")}</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn btn-sm" onClick={() => setEditing(s)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
      {editing && (
        <StaffForm
          clubs={clubs}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function StaffForm({ clubs, initial, onClose, onSaved }: { clubs: Club[]; initial: Partial<Staff>; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: initial.name ?? "",
    role: initial.role ?? "RECEPTIONIST",
    clubhouseId: initial.clubhouseId ?? clubs[0]?.id,
    phone: initial.phone ?? "",
    certificateExpiry: initial.certificateExpiry ? initial.certificateExpiry.slice(0, 10) : "",
    active: initial.active ?? true,
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setErr("");
    try {
      const body = { ...f, certificateExpiry: f.role === "LIFEGUARD" && f.certificateExpiry ? f.certificateExpiry : null };
      if (initial.id) await send(`/api/admin/staff/${initial.id}`, "PATCH", body);
      else await send("/api/admin/staff", "POST", body);
      onSaved();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={initial.id ? "Edit staff" : "Add staff"} onClose={onClose}>
      <label className="field">
        <span>Full name</span>
        <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </label>
      <div className="grid-2">
        <label className="field">
          <span>Role</span>
          <select className="select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            {Object.entries(STAFF_ROLE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Clubhouse</span>
          <select className="select" value={f.clubhouseId} onChange={(e) => setF({ ...f, clubhouseId: e.target.value })}>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Phone</span>
        <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      </label>
      {f.role === "LIFEGUARD" && (
        <label className="field">
          <span>Lifesaving certificate expiry</span>
          <input className="input" type="date" value={f.certificateExpiry} onChange={(e) => setF({ ...f, certificateExpiry: e.target.value })} />
        </label>
      )}
      <label className="check">
        <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
        Active (appears in the manager&apos;s daily staff check)
      </label>
      {err && <div className="banner bad">{err}</div>}
      <button className="btn btn-primary btn-lg" disabled={busy || !f.name} onClick={save}>
        Save
      </button>
    </Modal>
  );
}
