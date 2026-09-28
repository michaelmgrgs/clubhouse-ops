"use client";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { PhotoStrip, Thumbs } from "@/components/Photos";
import { toast } from "@/components/Toast";
import { getJson, sendWithLoc } from "@/lib/client/api";
import { ISSUE_CATEGORIES, SLA_HOURS, titleCase } from "@/lib/checklist";
import type { Club } from "./types";

type Issue = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  dueAt: string;
  closedAt: string | null;
  closureNote: string | null;
  photos: { id: string; purpose: string | null }[];
};

export function slaText(dueAt: string, now = Date.now()) {
  const ms = new Date(dueAt).getTime() - now;
  const h = Math.round(Math.abs(ms) / 3600_000);
  return ms < 0 ? { text: `Overdue ${h}h`, cls: "bad" } : { text: `${h}h left`, cls: h < 12 ? "warn" : "info" };
}

export default function IssuesTab({ club, locked, onCount }: { club: Club; locked: boolean; onCount: (n: number) => void }) {
  const [list, setList] = useState<Issue[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [closing, setClosing] = useState<Issue | null>(null);

  const load = useCallback(async () => {
    const r = await getJson<{ issues: Issue[] }>(`/api/m/issues?clubhouseId=${club.id}`);
    setList(r.issues);
    onCount(r.issues.filter((i) => i.status === "OPEN").length);
  }, [club.id, onCount]);

  useEffect(() => {
    load().catch((e) => toast(e.message, "bad"));
  }, [load]);

  return (
    <>
      <button className="btn btn-soft btn-lg btn-block" disabled={locked} onClick={() => setAdding(true)}>
        <Icon name="plus" /> Log civil / MEP / equipment issue
      </button>
      <p className="small muted" style={{ padding: "0 2px" }}>
        Contract SLA: every snag must be closed within {SLA_HOURS} hours. Close it here with an &quot;after&quot; photo once fixed.
      </p>
      {!list ? (
        <div className="card pad muted small">Loading…</div>
      ) : list.length === 0 ? (
        <div className="card pad muted small center">No open maintenance issues 🎉</div>
      ) : (
        list.map((i) => {
          const sla = slaText(i.dueAt);
          return (
            <div key={i.id} className="card pad stack" style={{ opacity: i.status === "CLOSED" ? 0.7 : 1 }}>
              <div className="row-between">
                <span className="badge">{titleCase(i.category)}</span>
                {i.status === "OPEN" ? <span className={`badge ${sla.cls}`}>{sla.text}</span> : <span className="badge ok">Closed</span>}
              </div>
              <div className="stack-sm" style={{ gap: 2 }}>
                <h3>{i.title}</h3>
                {i.description && <p className="small muted">{i.description}</p>}
                <p className="tiny muted">Opened {new Date(i.openedAt).toLocaleString("en-GB", { timeZone: "Africa/Cairo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <Thumbs ids={i.photos.map((p) => p.id)} />
              {i.status === "CLOSED" && i.closureNote && <p className="small">✅ {i.closureNote}</p>}
              {i.status === "OPEN" && (
                <button className="btn" disabled={locked} onClick={() => setClosing(i)}>
                  <Icon name="check" /> Mark as fixed
                </button>
              )}
            </div>
          );
        })
      )}
      {adding && (
        <NewIssue
          club={club}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            load();
          }}
        />
      )}
      {closing && (
        <CloseIssue
          club={club}
          issue={closing}
          onClose={() => setClosing(null)}
          onDone={() => {
            setClosing(null);
            load();
          }}
        />
      )}
    </>
  );
}

function NewIssue({ club, onClose, onDone }: { club: Club; onClose: () => void; onDone: () => void }) {
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await sendWithLoc("/api/m/issues", "POST", { category, title, description, photoIds: photos });
      toast("Issue logged — 48h SLA started", "ok");
      onDone();
    } catch (e: any) {
      toast(e.message, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Log maintenance issue" onClose={onClose}>
      <div className="seg full">
        {ISSUE_CATEGORIES.map((c) => (
          <button key={c} className={category === c ? "on-neutral" : ""} onClick={() => setCategory(c)}>
            {c === "MEP" ? "MEP" : titleCase(c)}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Issue</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Treadmill #3 belt slipping" />
      </label>
      <label className="field">
        <span>Details</span>
        <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="field">
        <span>Photo of the issue</span>
        <PhotoStrip ids={photos} onChange={setPhotos} fields={{ target: "loose" }} stampTitle={`${club.name} · Maintenance`} required />
      </div>
      <button className="btn btn-primary btn-lg btn-block" disabled={busy || !category || !title || !photos.length} onClick={submit}>
        {busy ? "Saving…" : "Log issue"}
      </button>
    </Modal>
  );
}

function CloseIssue({ club, issue, onClose, onDone }: { club: Club; issue: Issue; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await sendWithLoc(`/api/m/issues/${issue.id}`, "PATCH", { closureNote: note, photoIds: photos });
      toast("Issue closed", "ok");
      onDone();
    } catch (e: any) {
      toast(e.message, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Close issue" onClose={onClose}>
      <p className="small muted">{issue.title}</p>
      <label className="field">
        <span>How was it fixed?</span>
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="field">
        <span>&quot;After&quot; photo</span>
        <PhotoStrip ids={photos} onChange={setPhotos} fields={{ target: "loose" }} stampTitle={`${club.name} · Fixed`} required />
      </div>
      <button className="btn btn-primary btn-lg btn-block" disabled={busy || !note || !photos.length} onClick={submit}>
        {busy ? "Saving…" : "Close issue"}
      </button>
    </Modal>
  );
}
