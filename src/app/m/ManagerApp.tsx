"use client";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Toaster, toast } from "@/components/Toast";
import { DEV_GEO, distanceM, setSimulatedLocation, startGeo, useGeo } from "@/lib/client/geo";
import { getJson, send, sendWithLoc } from "@/lib/client/api";
import type { Club, Today } from "./types";
import VisitView from "./VisitView";

export function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}

export default function ManagerApp() {
  const geo = useGeo();
  const [today, setToday] = useState<Today | null>(null);
  const [loadError, setLoadError] = useState("");

  const reload = useCallback(async () => {
    try {
      setToday(await getJson<Today>("/api/m/today"));
      setLoadError("");
    } catch (e: any) {
      setLoadError(e.message);
    }
  }, []);

  useEffect(() => {
    startGeo();
    reload();
  }, [reload]);

  if (!today) {
    return (
      <div className="auth-wrap">
        <div className="muted">{loadError || "Loading…"}</div>
      </div>
    );
  }

  const active = today.activeVisit;
  const club = active ? today.clubhouses.find((c) => c.id === active.clubhouseId) : null;

  return (
    <>
      <Toaster />
      {DEV_GEO && <DevGeo clubs={today.clubhouses} />}
      {active && club ? (
        <VisitView key={active.id} today={today} visit={active} club={club} onChanged={reload} />
      ) : (
        <HomeView today={today} geo={geo} onChanged={reload} />
      )}
    </>
  );
}

function HomeView({ today, geo, onChanged }: { today: Today; geo: ReturnType<typeof useGeo>; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const min = today.settings.minMinutes * 60;
  const fix = geo.fix;

  const withDistance = today.clubhouses.map((c) => {
    const d = fix ? Math.round(distanceM(fix.lat, fix.lng, c.lat, c.lng)) : null;
    return { ...c, distance: d, here: d !== null && d <= c.radiusM && fix!.accuracy <= today.settings.maxAccuracyM };
  });

  async function checkIn(c: Club) {
    setBusy(c.id);
    try {
      await sendWithLoc("/api/m/checkin", "POST", { clubhouseId: c.id });
      toast(`Checked in at ${c.name}`, "ok");
      onChanged();
    } catch (e: any) {
      toast(e.message, "bad");
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    await send("/api/auth/logout", "POST");
    window.location.href = "/login";
  }

  const doneCount = today.clubhouses.filter((c) => c.seconds >= min && c.reportStatus === "SUBMITTED").length;

  return (
    <div className="m-shell">
      <div className="m-top">
        <div className="row-between">
          <div className="logo">
            <div className="logo-mark">C</div>
            <div className="stack-sm" style={{ gap: 0 }}>
              <span>Hi, {today.user.name.split(" ")[0]}</span>
              <span className="tiny muted" style={{ fontWeight: 500 }}>
                {new Date(today.day + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
              </span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout} aria-label="Sign out">
            <Icon name="logout" />
          </button>
        </div>
      </div>

      <div className="m-body">
        <LocationCard geo={geo} maxAcc={today.settings.maxAccuracyM} />

        <div className="card pad stack">
          <div className="row-between">
            <h2>Today&apos;s visits</h2>
            <span className={`badge ${doneCount === today.clubhouses.length ? "ok" : "warn"}`}>
              {doneCount}/{today.clubhouses.length} complete
            </span>
          </div>
          <p className="small muted">
            Spend at least <b>{fmtDuration(min)}</b> inside each clubhouse and submit its daily report. Time only counts while this app is open and
            you&apos;re inside the clubhouse.
          </p>
          {withDistance.map((c) => {
            const pct = Math.min(100, (c.seconds / min) * 100);
            return (
              <div key={c.id} className={`club-pick ${c.here ? "here" : ""}`}>
                <div className="grow stack-sm">
                  <div className="row-between">
                    <h3 className="ellipsis">{c.name}</h3>
                    {c.reportStatus === "SUBMITTED" ? (
                      <span className="badge ok">
                        <Icon name="check" size={12} stroke={3} /> Report sent
                      </span>
                    ) : c.here ? (
                      <span className="badge brand">You&apos;re here</span>
                    ) : c.distance !== null ? (
                      <span className="badge">{c.distance >= 1000 ? `${(c.distance / 1000).toFixed(1)} km` : `${c.distance} m`}</span>
                    ) : null}
                  </div>
                  <div className={`progress ${pct >= 100 ? "done" : ""}`}>
                    <div style={{ width: `${pct}%` }} />
                  </div>
                  <div className="row-between small muted">
                    <span className="mono">
                      {fmtDuration(c.seconds)} / {fmtDuration(min)}
                    </span>
                    {c.openIssues > 0 && <span>{c.openIssues} open maintenance</span>}
                  </div>
                  {c.here && (
                    <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 6 }} disabled={busy !== null} onClick={() => checkIn(c)}>
                      <Icon name="pin" /> {busy === c.id ? "Checking in…" : "Check in"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {!withDistance.some((c) => c.here) && (
            <div className="banner info small">
              <Icon name="pin" /> Check-in unlocks automatically when you are inside a clubhouse.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LocationCard({ geo, maxAcc }: { geo: ReturnType<typeof useGeo>; maxAcc: number }) {
  if (geo.error && !geo.fix) {
    return (
      <div className="banner bad">
        <Icon name="alert" />
        <div>
          <b>Location needed.</b> {geo.error}
        </div>
      </div>
    );
  }
  if (!geo.fix) {
    return (
      <div className="banner info">
        <Icon name="pin" /> Getting your GPS location…
      </div>
    );
  }
  const weak = geo.fix.accuracy > maxAcc;
  return (
    <div className={`banner ${weak ? "warn" : "ok"} small`}>
      <Icon name="pin" />
      <div>
        GPS {weak ? "signal weak" : "locked"} · ±{Math.round(geo.fix.accuracy)} m{geo.simulated ? " · SIMULATED" : ""}
        {weak && <div>Move closer to a window or outside for a better signal.</div>}
      </div>
    </div>
  );
}

function DevGeo({ clubs }: { clubs: Club[] }) {
  return (
    <div className="dev-geo">
      DEV GPS
      <select
        defaultValue=""
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return setSimulatedLocation(null);
          if (v === "off") return setSimulatedLocation({ lat: clubs[0].lat + 0.02, lng: clubs[0].lng });
          const c = clubs.find((x) => x.id === v)!;
          setSimulatedLocation({ lat: c.lat + 0.0002, lng: c.lng - 0.0001 });
        }}
      >
        <option value="">Real GPS</option>
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>
            @ {c.name.split(" ")[0]}
          </option>
        ))}
        <option value="off">Off-site (2 km)</option>
      </select>
    </div>
  );
}
