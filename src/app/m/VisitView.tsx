"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toast";
import { distanceM, freshLoc, useGeo } from "@/lib/client/geo";
import { getJson, RequestError, sendWithLoc } from "@/lib/client/api";
import { ALL_ITEMS } from "@/lib/checklist";
import type { Club, ReportData, Today, Visit } from "./types";
import { fmtDuration, LocationCard } from "./ManagerApp";
import ChecklistTab from "./ChecklistTab";
import StaffTab from "./StaffTab";
import IncidentsTab from "./IncidentsTab";
import IssuesTab from "./IssuesTab";

type Tab = "checklist" | "staff" | "incidents" | "issues";

export default function VisitView({ today, visit, club, onChanged }: { today: Today; visit: Visit; club: Club; onChanged: () => void }) {
  const geo = useGeo();
  const [tab, setTab] = useState<Tab>("checklist");
  const [data, setData] = useState<ReportData | null>(null);
  const [daySec, setDaySec] = useState(club.seconds);
  const [running, setRunning] = useState(visit.running);
  const [syncedAt, setSyncedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [counts, setCounts] = useState({ incidents: 0, issues: club.openIssues });
  const [submitOpen, setSubmitOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pinging = useRef(false);
  const setIncidentCount = useCallback((n: number) => setCounts((c) => ({ ...c, incidents: n })), []);
  const setIssueCount = useCallback((n: number) => setCounts((c) => ({ ...c, issues: n })), []);

  const loadReport = useCallback(async () => {
    try {
      const r = await getJson<ReportData>("/api/m/report");
      setData(r);
      setDaySec(r.onSiteSeconds);
      setSyncedAt(Date.now());
    } catch (e: any) {
      toast(e.message, "bad");
    }
  }, []);

  // ---- GPS heartbeat: this is what accrues verified on-site time ----
  const ping = useCallback(async () => {
    if (pinging.current) return;
    pinging.current = true;
    try {
      const loc = await freshLoc();
      const r = await fetch("/api/m/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loc }),
      }).then((x) => x.json());
      if (r.visit === null) {
        toast("Your visit was closed because the app stopped reporting your location. Check in again.", "bad");
        onChanged();
        return;
      }
      if (typeof r.daySeconds === "number") {
        setDaySec(r.daySeconds);
        setRunning(Boolean(r.running));
        setSyncedAt(Date.now());
      }
    } catch {
      /* transient — next heartbeat will retry */
    } finally {
      pinging.current = false;
    }
  }, [onChanged]);

  useEffect(() => {
    loadReport();
    const t = setInterval(ping, today.settings.pingIntervalSec * 1000);
    const onVis = () => document.visibilityState === "visible" && ping();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadReport, ping, today.settings.pingIntervalSec]);

  // keep the screen awake so the heartbeat keeps running
  useEffect(() => {
    let lock: any = null;
    const acquire = async () => {
      try {
        lock = await (navigator as any).wakeLock?.request("screen");
      } catch {
        /* not supported / denied */
      }
    };
    acquire();
    const onVis = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release?.();
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll);
    return () => {
      clearInterval(t);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const fix = geo.fix;
  const distance = fix ? Math.round(distanceM(fix.lat, fix.lng, club.lat, club.lng)) : null;
  const insideNow = fix !== null && distance! <= club.radiusM && fix.accuracy <= today.settings.maxAccuracyM;

  // Crossing the geofence: report right away so the server pauses / resumes the timer now.
  useEffect(() => {
    if (fix) ping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insideNow]);
  const min = today.settings.minMinutes * 60;
  // The timer lives on the server; between syncs we tick locally while it's running.
  const liveSec = daySec + (running ? Math.max(0, (now - syncedAt) / 1000) : 0);
  const pct = Math.min(100, (liveSec / min) * 100);
  const submitted = data?.report.status === "SUBMITTED";
  const locked = !insideNow || submitted;

  const answered = data ? ALL_ITEMS.filter((i) => data.answers[i.key]?.status).length : 0;
  const staffDone = data ? data.staff.filter((s) => s.check?.status).length : 0;

  async function checkout() {
    const short = liveSec < min && !submitted;
    const msg = short
      ? `You've only been here ${fmtDuration(liveSec)} of the required ${fmtDuration(min)}, and the report isn't submitted. Check out anyway?`
      : "Check out of this clubhouse?";
    if (!confirm(msg)) return;
    try {
      await sendWithLoc("/api/m/checkout", "POST");
      toast("Checked out", "ok");
      onChanged();
    } catch (e: any) {
      toast(e.message, "bad");
    }
  }

  return (
    <div className="m-shell">
      <div className={`m-top ${scrolled ? "scrolled" : ""}`}>
        <div className="stack" style={{ gap: 10 }}>
          <div className="row-between">
            <div className="stack-sm grow" style={{ gap: 2 }}>
              <span className="tiny muted bold" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Checked in · {new Date(visit.checkInAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo" })}
              </span>
              <h2 className="ellipsis">{club.name}</h2>
            </div>
            {insideNow ? (
              <span className="badge ok">
                <span className="dot pulse" /> On site
              </span>
            ) : (
              <span className="badge bad">
                <span className="dot" /> Off site
              </span>
            )}
          </div>
          <div className="row-between" style={{ alignItems: "flex-end" }}>
            <div className="timer">{fmtClock(liveSec)}</div>
            <div className="small muted mono" style={{ paddingBottom: 6 }}>
              {!running ? "⏸ Paused" : pct >= 100 ? "Minimum reached" : `${fmtDuration(Math.max(0, min - liveSec))} to go`}
            </div>
          </div>
          <div className={`progress ${pct >= 100 ? "done" : ""}`}>
            <div style={{ width: `${pct}%` }} />
          </div>
          <div className="tabs">
            <TabBtn id="checklist" tab={tab} setTab={setTab} icon="list" label="Checklist" count={`${answered}/${ALL_ITEMS.length}`} />
            <TabBtn id="staff" tab={tab} setTab={setTab} icon="users" label="Staff" count={data ? `${staffDone}/${data.staff.length}` : ""} />
            <TabBtn id="incidents" tab={tab} setTab={setTab} icon="alert" label="Incidents" count={counts.incidents ? String(counts.incidents) : ""} />
            <TabBtn id="issues" tab={tab} setTab={setTab} icon="wrench" label="Snags" count={counts.issues ? String(counts.issues) : ""} />
          </div>
        </div>
      </div>

      <div className="m-body">
        {!insideNow && (
          <div className="banner bad">
            <Icon name="alert" />
            <div>
              <b>You are outside {club.name}</b>
              {distance !== null && ` (${distance} m away)`}. The timer is paused and resumes when you&apos;re back inside. You can&apos;t submit or check out until you return.
            </div>
          </div>
        )}
        {(!fix || geo.error) && <LocationCard geo={geo} maxAcc={today.settings.maxAccuracyM} />}
        {submitted && (
          <div className="banner ok">
            <Icon name="check" />
            <div>
              <b>Daily report submitted.</b> You can still log incidents and maintenance issues.
            </div>
          </div>
        )}

        {!data ? (
          <div className="card pad muted center">Loading report…</div>
        ) : tab === "checklist" ? (
          <ChecklistTab data={data} setData={setData} club={club} locked={locked} />
        ) : tab === "staff" ? (
          <StaffTab data={data} setData={setData} club={club} locked={locked} />
        ) : tab === "incidents" ? (
          <IncidentsTab club={club} locked={!insideNow} onCount={setIncidentCount} />
        ) : (
          <IssuesTab club={club} locked={!insideNow} onCount={setIssueCount} />
        )}
      </div>

      <div className="m-dock">
        <div className="m-dock-inner">
          <button className="btn btn-lg" disabled={!insideNow} onClick={checkout}>
            <Icon name="logout" /> Check out
          </button>
          {!submitted && (
            <button className="btn btn-primary btn-lg grow" disabled={!insideNow || liveSec < min || !data} onClick={() => setSubmitOpen(true)}>
              <Icon name={liveSec < min ? "clock" : "send"} />
              {liveSec < min ? `Submit in ${fmtDuration(min - liveSec)}` : "Submit report"}
            </button>
          )}
        </div>
      </div>

      {submitOpen && data && (
        <SubmitModal
          club={club}
          onClose={() => setSubmitOpen(false)}
          onDone={() => {
            setSubmitOpen(false);
            onChanged(); // submitting ends the visit
          }}
        />
      )}
    </div>
  );
}

function fmtClock(sec: number) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function TabBtn({ id, tab, setTab, icon, label, count }: { id: Tab; tab: Tab; setTab: (t: Tab) => void; icon: string; label: string; count: string }) {
  return (
    <button className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
      <Icon name={icon} size={15} />
      {label}
      {count && <span className="count">{count}</span>}
    </button>
  );
}

function SubmitModal({ club, onClose, onDone }: { club: Club; onClose: () => void; onDone: () => void }) {
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  async function submit() {
    setBusy(true);
    setProblems([]);
    try {
      await sendWithLoc("/api/m/report/submit", "POST", { summary });
      toast("Daily report submitted — you are checked out", "ok");
      onDone();
    } catch (e: any) {
      if (e instanceof RequestError && e.data?.problems) setProblems(e.data.problems);
      else toast(e.message, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Submit daily report" onClose={onClose}>
      <p className="small muted">{club.name} · submitting stops the timer and checks you out. The checklist and staff checks are then locked.</p>
      <label className="field">
        <span>Summary of the day (optional)</span>
        <textarea className="textarea" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Anything management should know…" />
      </label>
      {problems.length > 0 && (
        <div className="banner warn small">
          <div>
            <b>Not complete yet:</b>
            <ul>
              {problems.slice(0, 12).map((p) => (
                <li key={p}>{p}</li>
              ))}
              {problems.length > 12 && <li>…and {problems.length - 12} more</li>}
            </ul>
          </div>
        </div>
      )}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={submit}>
        {busy ? "Submitting…" : "Submit report"}
      </button>
    </Modal>
  );
}
