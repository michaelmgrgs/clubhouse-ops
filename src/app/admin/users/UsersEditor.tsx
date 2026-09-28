"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/Icon";
import { send } from "@/lib/client/api";

type User = { id: string; name: string; email: string; role: string; active: boolean };

export default function UsersEditor({ users, meId }: { users: User[]; meId: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<User | null>(null);

  async function toggle(u: User) {
    try {
      await send(`/api/admin/users/${u.id}`, "PATCH", { active: !u.active });
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="stack-lg">
      <div className="a-head">
        <div className="stack-sm">
          <h1>Users</h1>
          <p className="muted small">Managers use the mobile check-in app; admins see this dashboard.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Icon name="plus" /> Add user
        </button>
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="bold">{u.name}</td>
                <td className="small">{u.email}</td>
                <td>
                  <span className={`badge ${u.role === "ADMIN" ? "info" : "brand"}`}>{u.role === "ADMIN" ? "Admin" : "Manager"}</span>
                </td>
                <td>{u.active ? <span className="badge ok">Active</span> : <span className="badge">Disabled</span>}</td>
                <td style={{ textAlign: "right" }}>
                  <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => setResetting(u)}>
                      Reset password
                    </button>
                    {u.id !== meId && (
                      <button className="btn btn-sm" onClick={() => toggle(u)}>
                        {u.active ? "Disable" : "Enable"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && (
        <AddUser
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}
      {resetting && <ResetPassword user={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}

function AddUser({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: "", email: "", password: "", role: "MANAGER" });
  const [err, setErr] = useState("");
  async function save() {
    try {
      await send("/api/admin/users", "POST", f);
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <Modal title="Add user" onClose={onClose}>
      <label className="field">
        <span>Name</span>
        <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </label>
      <label className="field">
        <span>Email</span>
        <input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </label>
      <label className="field">
        <span>Temporary password (min 8 characters)</span>
        <input className="input" type="text" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      </label>
      <label className="field">
        <span>Role</span>
        <select className="select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option value="MANAGER">Clubhouse manager</option>
          <option value="ADMIN">Admin</option>
        </select>
      </label>
      {err && <div className="banner bad">{err}</div>}
      <button className="btn btn-primary btn-lg" onClick={save}>
        Create user
      </button>
    </Modal>
  );
}

function ResetPassword({ user, onClose }: { user: User; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  async function save() {
    try {
      await send(`/api/admin/users/${user.id}`, "PATCH", { password: pw });
      setMsg({ kind: "ok", text: "Password updated" });
      setPw("");
    } catch (e: any) {
      setMsg({ kind: "bad", text: e.message });
    }
  }
  return (
    <Modal title={`Reset password · ${user.name}`} onClose={onClose}>
      <label className="field">
        <span>New password (min 8 characters)</span>
        <input className="input" type="text" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </label>
      {msg && <div className={`banner ${msg.kind}`}>{msg.text}</div>}
      <button className="btn btn-primary btn-lg" onClick={save} disabled={pw.length < 8}>
        Update password
      </button>
    </Modal>
  );
}
