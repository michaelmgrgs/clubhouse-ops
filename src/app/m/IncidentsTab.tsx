"use client";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { PhotoStrip } from "@/components/Photos";
import { toast } from "@/components/Toast";
import { getJson, sendWithLoc } from "@/lib/client/api";
import { ESCALATION_TARGETS, INCIDENT_TYPES, SEVERITIES, titleCase } from "@/lib/checklist";
import type { Club } from "./types";

type Incident = { id: string; type: string; severity: string; title: string; occurredAt: string; status: string; _count: { photos: number } };

export const SEV_CLASS: Record<string, string> = { LOW: "", MEDIUM: "info", HIGH: "warn", CRITICAL: "bad" };

export default function IncidentsTab({ club, locked, onCount }: { club: Club; locked: boolean; onCount: (n: number) => void }) {
  const [list, setList] = useState<Incident[] | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const r = await getJson<{ incidents: Incident[] }>(`/api/m/incidents?clubhouseId=${club.id}`);
    setList(r.incidents);
    onCount(r.incidents.filter((i) => new Date(i.occurredAt).toDateString() === new Date().toDateString()).length);
  }, [club.id, onCount]);

  useEffect(() => {
    load().catch((e) => toast(e.message, "bad"));
  }, [load]);

  return (
    <>
      <button className="btn btn-soft btn-lg btn-block" disabled={locked} onClick={() => setOpen(true)}>
        <Icon name="plus" /> Report an incident or complaint
      </button>
      <div className="card">
        <div className="section-h">
          <h3>Last 7 days</h3>
        </div>
        {!list ? (
          <div className="item muted small">Loading…</div>
        ) : list.length === 0 ? (
          <div className="item muted small">No incidents reported.</div>
        ) : (
          list.map((i) => (
            <div key={i.id} className="item" style={{ gap: 4 }}>
              <div className="row-between">
                <span className="bold small ellipsis">{i.title}</span>
                <span className={`badge ${SEV_CLASS[i.severity]}`}>{titleCase(i.severity)}</span>
              </div>
              <div className="tiny muted">
                {titleCase(i.type)} · {new Date(i.occurredAt).toLocaleString("en-GB", { timeZone: "Africa/Cairo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} ·{" "}
                {i._count.photos} photo{i._count.photos === 1 ? "" : "s"}
              </div>
            </div>
          ))
        )}
      </div>
      {open && (
        <IncidentForm
          club={club}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            load();
          }}
        />
      )}
    </>
  );
}

function IncidentForm({ club, onClose, onDone }: { club: Club; onClose: () => void; onDone: () => void }) {
  const nowLocal = new Date().toLocaleTimeString("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" });
  const [f, setF] = useState({ type: "", severity: "", title: "", description: "", actionTaken: "", time: nowLocal });
  const [escalatedTo, setEsc] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit() {
    setBusy(true);
    try {
      // Build the occurrence time as today in Cairo (UTC+2/+3) from the HH:MM the manager picked.
      const [h, m] = f.time.split(":").map(Number);
      const cairoNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
      const offsetMs = cairoNow.getTime() - new Date(new Date().toLocaleString("en-US", { timeZone: "UTC" })).getTime();
      const d = new Date(Date.UTC(cairoNow.getFullYear(), cairoNow.getMonth(), cairoNow.getDate(), h, m) - offsetMs);
      await sendWithLoc("/api/m/incidents", "POST", { ...f, occurredAt: d.toISOString(), escalatedTo, photoIds: photos });
      toast("Incident reported", "ok");
      onDone();
    } catch (e: any) {
      toast(e.message, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Report incident" onClose={onClose}>
      <div className="field">
        <span>Type</span>
        <div className="row wrap" style={{ gap: 6 }}>
          {INCIDENT_TYPES.map((t) => (
            <button key={t} className={`btn btn-sm ${f.type === t ? "btn-primary" : ""}`} onClick={() => setF({ ...f, type: t })}>
              {titleCase(t)}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Severity</span>
        <div className="seg full">
          {SEVERITIES.map((s) => (
            <button key={s} className={f.severity === s ? (s === "LOW" ? "on-neutral" : s === "MEDIUM" ? "on-warn" : "on-bad") : ""} onClick={() => setF({ ...f, severity: s })}>
              {titleCase(s)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid-2">
        <label className="field" style={{ gridColumn: "span 1" }}>
          <span>Time</span>
          <input className="input" type="time" value={f.time} onChange={set("time")} />
        </label>
      </div>
      <label className="field">
        <span>Title</span>
        <input className="input" value={f.title} onChange={set("title")} placeholder="e.g. Resident complaint about gym AC" />
      </label>
      <label className="field">
        <span>What happened</span>
        <textarea className="textarea" value={f.description} onChange={set("description")} />
      </label>
      <label className="field">
        <span>Action taken</span>
        <textarea className="textarea" style={{ minHeight: 60 }} value={f.actionTaken} onChange={set("actionTaken")} />
      </label>
      <div className="field">
        <span>Escalated to</span>
        <div className="row wrap" style={{ gap: 14 }}>
          {ESCALATION_TARGETS.map((t) => (
            <label key={t} className="check small">
              <input type="checkbox" checked={escalatedTo.includes(t)} onChange={(e) => setEsc(e.target.checked ? [...escalatedTo, t] : escalatedTo.filter((x) => x !== t))} />
              {t}
            </label>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Photos</span>
        <PhotoStrip ids={photos} onChange={setPhotos} fields={{ target: "loose" }} stampTitle={`${club.name} · Incident`} />
      </div>
      <button className="btn btn-primary btn-lg btn-block" disabled={busy || !f.type || !f.severity || !f.title || !f.description} onClick={submit}>
        {busy ? "Sending…" : "Submit incident"}
      </button>
    </Modal>
  );
}
