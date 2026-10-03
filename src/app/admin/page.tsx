import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { complianceGrid } from "@/lib/compliance";
import { addDays, cairoDay, cairoDayStart, fmtDateTime, fmtDay, fmtMinutes, fmtTime } from "@/lib/time";
import { titleCase } from "@/lib/checklist";
import { Icon } from "@/components/Icon";

export default async function Dashboard() {
  const settings = await getSettings();
  const today = cairoDay();
  const min = settings.minMinutesPerClubhouse * 60;
  // "Live" = a location report within the last 3 heartbeats (app open on site).
  const liveCutoff = new Date(Date.now() - settings.pingIntervalSec * 3 * 1000);

  const grid = await complianceGrid(addDays(today, -13), today, min);
  const month = await complianceGrid(addDays(today, -30), addDays(today, -1), min);
  const activeVisits = await prisma.visit.findMany({
    where: { status: "ACTIVE", day: today },
    include: { user: { select: { name: true } } },
  });
  const todayIncidents = await prisma.incident.groupBy({ by: ["clubhouseId"], where: { occurredAt: { gte: cairoDayStart(today) } }, _count: true });
  const openIssues = await prisma.issue.findMany({ where: { status: "OPEN" }, select: { clubhouseId: true, dueAt: true } });
  const openIncidents = await prisma.incident.count({ where: { status: "OPEN" } });
  const certWarn = await prisma.staff.count({
    where: { active: true, role: "LIFEGUARD", OR: [{ certificateExpiry: null }, { certificateExpiry: { lt: new Date(Date.now() + 30 * 86400_000) } }] },
  });
  const recent = await prisma.incident.findMany({ orderBy: { occurredAt: "desc" }, take: 6, include: { clubhouse: { select: { name: true } } } });
  const unverified = await prisma.clubhouse.count({ where: { locationVerified: false } });

  const monthCells = month.rows.flatMap((r) => r.cells).filter((c) => c.state !== "none");
  const compliantPct = monthCells.length ? Math.round((monthCells.filter((c) => c.state === "ok").length / monthCells.length) * 100) : 0;
  const overdue = openIssues.filter((i) => i.dueAt < new Date()).length;

  return (
    <div className="stack-lg">
      <div className="a-head">
        <div className="stack-sm">
          <h1>Today</h1>
          <p className="muted small">{fmtDay(today)} · minimum {fmtMinutes(min)} on site per clubhouse</p>
        </div>
      </div>

      {unverified > 0 && (
        <div className="banner warn">
          <Icon name="alert" />
          <div>
            {unverified} clubhouse location{unverified > 1 ? "s are" : " is"} still using placeholder coordinates. Set the exact position on{" "}
            <Link href="/admin/clubhouses" style={{ textDecoration: "underline" }}>
              Clubhouses
            </Link>{" "}
            before managers start using the app.
          </div>
        </div>
      )}

      <div className="grid-2 collapse">
        {grid.rows.map(({ club, cells }) => {
          const t = cells[cells.length - 1];
          const visit = activeVisits.find((v) => v.clubhouseId === club.id);
          const seenNow = visit && visit.lastPingAt > liveCutoff && visit.lastPingInside;
          const pct = Math.min(100, (t.seconds / min) * 100);
          const inc = todayIncidents.find((x) => x.clubhouseId === club.id)?._count ?? 0;
          const iss = openIssues.filter((x) => x.clubhouseId === club.id);
          return (
            <div key={club.id} className="card pad stack">
              <div className="row-between">
                <h2>{club.name}</h2>
                {!visit ? (
                  <span className="badge">No manager on site</span>
                ) : !visit.runningSince ? (
                  <span className="badge warn">
                    {visit.user.name} · timer paused, seen outside {fmtTime(visit.lastPingAt)}
                  </span>
                ) : seenNow ? (
                  <span className="badge ok">
                    <span className="dot pulse" /> {visit.user.name} on site
                  </span>
                ) : (
                  <span className="badge info">
                    {visit.user.name} checked in · last location {fmtTime(visit.lastInsideAt ?? visit.checkInAt)}
                  </span>
                )}
              </div>
              <div className="stack-sm">
                <div className="row-between small">
                  <span className="muted">Time on site (timer)</span>
                  <span className="bold mono">
                    {fmtMinutes(t.seconds)} / {fmtMinutes(min)}
                  </span>
                </div>
                <div className={`progress ${pct >= 100 ? "done" : ""}`}>
                  <div style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="grid-3">
                <div className="stat">
                  <div className="label">Report</div>
                  <div style={{ marginTop: 6 }}>
                    {t.report === "SUBMITTED" ? (
                      <Link href={`/admin/reports/${t.reportId}`} className="badge ok">
                        Submitted
                      </Link>
                    ) : t.report === "DRAFT" ? (
                      <Link href={`/admin/reports/${t.reportId}`} className="badge warn">
                        In progress
                      </Link>
                    ) : (
                      <span className="badge">Not started</span>
                    )}
                  </div>
                </div>
                <div className="stat">
                  <div className="label">Incidents</div>
                  <div className="value">{inc}</div>
                </div>
                <div className="stat">
                  <div className="label">Open snags</div>
                  <div className="value">
                    {iss.length}
                    {iss.some((i) => i.dueAt < new Date()) && <span className="badge bad" style={{ marginLeft: 6, verticalAlign: "middle" }}>overdue</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid-4">
        <div className="card pad stat">
          <div className="label">Compliance · 30 days</div>
          <div className="value" style={{ color: !monthCells.length ? undefined : compliantPct >= 90 ? "var(--ok)" : compliantPct >= 60 ? "var(--warn)" : "var(--bad)" }}>
            {monthCells.length ? `${compliantPct}%` : "—"}
          </div>
          <div className="tiny muted">clubhouse-days with full time + report</div>
        </div>
        <div className="card pad stat">
          <div className="label">Open incidents</div>
          <div className="value">{openIncidents}</div>
        </div>
        <div className="card pad stat">
          <div className="label">Overdue snags (48h)</div>
          <div className="value" style={{ color: overdue ? "var(--bad)" : undefined }}>{overdue}</div>
        </div>
        <div className="card pad stat">
          <div className="label">Lifeguard certs</div>
          <div className="value" style={{ color: certWarn ? "var(--warn)" : undefined }}>{certWarn}</div>
          <div className="tiny muted">expired / expiring in 30 days</div>
        </div>
      </div>

      <div className="card pad stack">
        <div className="row-between">
          <h2>Last 14 days</h2>
          <div className="row small muted wrap">
            <Legend cls="c-ok" label="Complete" />
            <Legend cls="c-part" label="Partial" />
            <Legend cls="c-miss" label="Missed" />
          </div>
        </div>
        <div className="table-wrap">
          <div className="cal" style={{ ["--days" as any]: grid.days.length, minWidth: 620 }}>
            <div />
            {grid.days.map((d) => (
              <div key={d} className="tiny muted center">
                {d.slice(8)}
              </div>
            ))}
            {grid.rows.map(({ club, cells }) => (
              <Row key={club.id} name={club.name} cells={cells} />
            ))}
          </div>
        </div>
        <p className="tiny muted">Numbers are verified on-site minutes. Click a day to open its report.</p>
      </div>

      <div className="card">
        <div className="section-h" style={{ paddingBottom: 10 }}>
          <h2>Recent incidents</h2>
          <Link href="/admin/incidents" className="small" style={{ color: "var(--brand)" }}>
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="item muted small">No incidents yet.</div>
        ) : (
          <table className="table">
            <tbody>
              {recent.map((i) => (
                <tr key={i.id}>
                  <td className="small muted" style={{ whiteSpace: "nowrap" }}>{fmtDateTime(i.occurredAt)}</td>
                  <td className="small">{i.clubhouse.name}</td>
                  <td>
                    <div className="bold small">{i.title}</div>
                    <div className="tiny muted">{titleCase(i.type)}</div>
                  </td>
                  <td>
                    <span className={`badge ${i.severity === "CRITICAL" ? "bad" : i.severity === "HIGH" ? "warn" : ""}`}>{titleCase(i.severity)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Row({ name, cells }: { name: string; cells: { day: string; seconds: number; state: string; reportId?: string }[] }) {
  return (
    <>
      <div className="small bold ellipsis">{name.replace(" Community Center", "")}</div>
      {cells.map((c) => {
        const inner = <div className={`cell c-${c.state}`} title={`${c.day}: ${Math.floor(c.seconds / 60)} min`}>{c.seconds ? Math.floor(c.seconds / 60) : ""}</div>;
        return c.reportId ? (
          <Link key={c.day} href={`/admin/reports/${c.reportId}`}>
            {inner}
          </Link>
        ) : (
          <div key={c.day}>{inner}</div>
        );
      })}
    </>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="row" style={{ gap: 5 }}>
      <span className={`cell ${cls}`} style={{ width: 12, height: 12, borderRadius: 3 }} />
      {label}
    </span>
  );
}
