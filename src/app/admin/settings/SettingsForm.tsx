"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { send } from "@/lib/client/api";

type S = {
  minMinutesPerClubhouse: number;
  pingIntervalSec: number;
  maxPingGapSec: number;
  maxAccuracyM: number;
  photoRetentionDays: number;
  lastCleanupAt: string | null;
};

const FIELDS: { key: keyof S; label: string; hint: string; unit: string }[] = [
  { key: "minMinutesPerClubhouse", label: "Minimum time per clubhouse", hint: "Daily report can't be submitted before this much verified on-site time.", unit: "min" },
  { key: "pingIntervalSec", label: "GPS heartbeat interval", hint: "How often the manager app reports its location while checked in.", unit: "sec" },
  { key: "maxPingGapSec", label: "Max heartbeat gap", hint: "If two heartbeats are further apart than this (app closed, phone locked), that gap isn't counted.", unit: "sec" },
  { key: "maxAccuracyM", label: "Required GPS accuracy", hint: "Fixes less accurate than this are rejected (prevents vague Wi-Fi/cell locations).", unit: "m" },
  { key: "photoRetentionDays", label: "Photo retention", hint: "Photos older than this are deleted from the server automatically.", unit: "days" },
];

export default function SettingsForm({ settings, stats }: { settings: S; stats: { stored: number; bytes: number; purged: number } }) {
  const router = useRouter();
  const [f, setF] = useState<Record<string, string>>(Object.fromEntries(FIELDS.map((x) => [x.key, String(settings[x.key])])));
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [cleaning, setCleaning] = useState(false);

  async function save() {
    try {
      await send("/api/admin/settings", "PATCH", Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Number(v)])));
      setMsg({ kind: "ok", text: "Settings saved" });
      router.refresh();
    } catch (e: any) {
      setMsg({ kind: "bad", text: e.message });
    }
  }

  async function cleanup() {
    setCleaning(true);
    try {
      const r = await send<{ purged: number; orphansRemoved: number }>("/api/admin/cleanup", "POST");
      setMsg({ kind: "ok", text: `Cleanup done: ${r.purged} expired photos deleted, ${r.orphansRemoved} abandoned uploads removed.` });
      router.refresh();
    } catch (e: any) {
      setMsg({ kind: "bad", text: e.message });
    } finally {
      setCleaning(false);
    }
  }

  return (
    <div className="stack-lg">
      <div className="a-head">
        <h1>Settings</h1>
      </div>
      <div className="card pad stack-lg" style={{ maxWidth: 720 }}>
        {FIELDS.map((x) => (
          <div key={x.key} className="row-between wrap" style={{ alignItems: "flex-start" }}>
            <div className="stack-sm grow" style={{ gap: 2, minWidth: 240 }}>
              <span className="bold small">{x.label}</span>
              <span className="tiny muted">{x.hint}</span>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <input className="input" type="number" style={{ width: 110 }} value={f[x.key]} onChange={(e) => setF({ ...f, [x.key]: e.target.value })} />
              <span className="small muted" style={{ width: 34 }}>
                {x.unit}
              </span>
            </div>
          </div>
        ))}
        <div>
          <button className="btn btn-primary" onClick={save}>
            Save settings
          </button>
        </div>
      </div>

      <div className="card pad stack" style={{ maxWidth: 720 }}>
        <h2>Photo storage</h2>
        <div className="grid-3">
          <div className="stat">
            <div className="label">Stored photos</div>
            <div className="value">{stats.stored}</div>
          </div>
          <div className="stat">
            <div className="label">Disk used</div>
            <div className="value">{(stats.bytes / 1024 / 1024).toFixed(1)} MB</div>
          </div>
          <div className="stat">
            <div className="label">Deleted so far</div>
            <div className="value">{stats.purged}</div>
          </div>
        </div>
        <p className="small muted">
          Cleanup runs automatically every day. Last run:{" "}
          {settings.lastCleanupAt ? new Date(settings.lastCleanupAt).toLocaleString("en-GB", { timeZone: "Africa/Cairo" }) : "never"}.
        </p>
        <div>
          <button className="btn" onClick={cleanup} disabled={cleaning}>
            {cleaning ? "Cleaning…" : "Run cleanup now"}
          </button>
        </div>
      </div>
      {msg && <div className={`banner ${msg.kind}`} style={{ maxWidth: 720 }}>{msg.text}</div>}
    </div>
  );
}
