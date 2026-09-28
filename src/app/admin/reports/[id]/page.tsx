import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { CHECKLIST, STAFF_ROLE_LABEL, titleCase } from "@/lib/checklist";
import { cairoDayStart, addDays, fmtDateTime, fmtDay, fmtMinutes, fmtTime } from "@/lib/time";
import { Thumbs } from "@/components/Photos";
import { Icon } from "@/components/Icon";
import { PrintButton } from "@/components/PrintButton";

export default async function ReportDetail({ params }: { params: { id: string } }) {
  const settings = await getSettings();
  const report = await prisma.dailyReport.findUnique({
    where: { id: params.id },
    include: {
      clubhouse: true,
      user: { select: { name: true } },
      answers: { include: { photos: { select: { id: true, purgedAt: true }, orderBy: { createdAt: "asc" } } } },
      staffChecks: {
        include: { staff: true, photos: { select: { id: true, purgedAt: true }, orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!report) notFound();

  const visits = await prisma.visit.findMany({
    where: { clubhouseId: report.clubhouseId, day: report.day },
    orderBy: { checkInAt: "asc" },
    include: { user: { select: { name: true } }, pings: { orderBy: { at: "asc" }, select: { inside: true, distanceM: true, accuracy: true, at: true } } },
  });
  const incidents = await prisma.incident.findMany({
    where: { clubhouseId: report.clubhouseId, occurredAt: { gte: cairoDayStart(report.day), lt: cairoDayStart(addDays(report.day, 1)) } },
    include: { photos: { select: { id: true, purgedAt: true } } },
    orderBy: { occurredAt: "asc" },
  });
  const total = visits.reduce((s, v) => s + v.verifiedSeconds, 0);
  const min = settings.minMinutesPerClubhouse * 60;
  const answers = new Map(report.answers.map((a) => [a.itemKey, a]));
  const ids = (ps: { id: string }[]) => ps.map((p) => p.id);
  const expired = (ps: { id: string; purgedAt: Date | null }[]) => ps.filter((p) => p.purgedAt).map((p) => p.id);
  const issueCount = report.answers.filter((a) => a.status === "ISSUE").length;

  return (
    <div className="stack-lg">
      <div className="a-head">
        <div className="stack-sm">
          <Link href="/admin/reports" className="small muted">
            ← Daily reports
          </Link>
          <h1>
            {report.clubhouse.name} · {fmtDay(report.day)}
          </h1>
          <p className="small muted">
            {report.user.name} ·{" "}
            {report.status === "SUBMITTED" ? `submitted ${fmtDateTime(report.submittedAt)}` : "not submitted (draft)"}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="grid-4">
        <div className="card pad stat">
          <div className="label">Verified on site</div>
          <div className="value" style={{ color: total >= min ? "var(--ok)" : "var(--bad)" }}>{fmtMinutes(total)}</div>
          <div className="tiny muted">minimum {fmtMinutes(min)}</div>
        </div>
        <div className="card pad stat">
          <div className="label">Status</div>
          <div className="value" style={{ fontSize: 20, marginTop: 6 }}>
            {report.status === "SUBMITTED" ? <span className="badge ok">Submitted</span> : <span className="badge warn">Draft</span>}
          </div>
        </div>
        <div className="card pad stat">
          <div className="label">Checklist issues</div>
          <div className="value" style={{ color: issueCount ? "var(--bad)" : undefined }}>{issueCount}</div>
        </div>
        <div className="card pad stat">
          <div className="label">Incidents</div>
          <div className="value">{incidents.length}</div>
        </div>
      </div>

      {report.summary && (
        <div className="card pad stack-sm">
          <h3>Manager summary</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{report.summary}</p>
        </div>
      )}

      <div className="card">
        <div className="section-h" style={{ paddingBottom: 10 }}>
          <h2>Visits & GPS verification</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Manager</th>
                <th>Check in</th>
                <th>Check out</th>
                <th>Verified</th>
                <th>GPS heartbeats</th>
                <th>Check-in location</th>
              </tr>
            </thead>
            <tbody>
              {visits.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted center">
                    No visits recorded.
                  </td>
                </tr>
              )}
              {visits.map((v) => {
                const inside = v.pings.filter((p) => p.inside).length;
                const maxDist = Math.max(0, ...v.pings.map((p) => p.distanceM));
                return (
                  <tr key={v.id}>
                    <td>{v.user.name}</td>
                    <td className="mono">{fmtTime(v.checkInAt)}</td>
                    <td className="mono">
                      {v.checkOutAt ? fmtTime(v.checkOutAt) : "—"}{" "}
                      {v.status === "AUTO_CLOSED" && <span className="badge warn">auto-closed</span>}
                      {v.status === "ACTIVE" && <span className="badge ok">on site</span>}
                    </td>
                    <td className="bold mono">{fmtMinutes(v.verifiedSeconds)}</td>
                    <td className="small">
                      {v.pings.length} total ·{" "}
                      <span style={{ color: inside === v.pings.length ? "var(--ok)" : "var(--bad)" }}>
                        {v.pings.length ? Math.round((inside / v.pings.length) * 100) : 0}% inside
                      </span>
                      <div className="tiny muted">furthest {maxDist} m</div>
                    </td>
                    <td className="small">
                      <a
                        href={`https://www.google.com/maps?q=${v.checkInLat},${v.checkInLng}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--brand)" }}
                      >
                        Map ↗
                      </a>{" "}
                      <span className="muted">±{Math.round(v.checkInAccuracy)} m</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="section-h" style={{ paddingBottom: 10 }}>
          <h2>Staff attendance</h2>
        </div>
        {report.staffChecks.length === 0 ? (
          <div className="item muted small">No staff checks recorded.</div>
        ) : (
          report.staffChecks
            .sort((a, b) => a.staff.role.localeCompare(b.staff.role))
            .map((c) => (
              <div key={c.id} className="item">
                <div className="row-between wrap">
                  <div>
                    <div className="bold">{c.staff.name}</div>
                    <div className="tiny muted">{STAFF_ROLE_LABEL[c.staff.role]}</div>
                  </div>
                  <div className="row wrap" style={{ gap: 6 }}>
                    <StatusBadge s={c.status} />
                    {(c.status === "PRESENT" || c.status === "LATE") && (
                      <>
                        <Flag ok={c.uniformOk} label="Uniform" />
                        <Flag ok={c.onPost} label="On post" />
                        <Flag ok={c.noPhone} label="No phone" />
                      </>
                    )}
                  </div>
                </div>
                {c.note && <p className="small">{c.note}</p>}
                <Thumbs ids={ids(c.photos)} expired={expired(c.photos)} large />
              </div>
            ))
        )}
      </div>

      {CHECKLIST.map((section) => (
        <div key={section.key} className="card">
          <div className="section-h" style={{ paddingBottom: 10 }}>
            <h2>{section.title}</h2>
          </div>
          {section.items.map((item) => {
            const a = answers.get(item.key);
            return (
              <div key={item.key} className="item">
                <div className="row-between">
                  <span className="small bold">{item.label}</span>
                  {a?.status === "OK" ? (
                    <span className="badge ok">OK</span>
                  ) : a?.status === "ISSUE" ? (
                    <span className="badge bad">Issue</span>
                  ) : a?.status === "NA" ? (
                    <span className="badge">N/A</span>
                  ) : (
                    <span className="badge warn">Not answered</span>
                  )}
                </div>
                {a?.note && <p className="small">{a.note}</p>}
                {a && <Thumbs ids={ids(a.photos)} expired={expired(a.photos)} large />}
              </div>
            );
          })}
        </div>
      ))}

      <div className="card">
        <div className="section-h" style={{ paddingBottom: 10 }}>
          <h2>Incidents this day</h2>
        </div>
        {incidents.length === 0 ? (
          <div className="item muted small">None.</div>
        ) : (
          incidents.map((i) => (
            <div key={i.id} className="item">
              <div className="row-between">
                <span className="bold">{i.title}</span>
                <span className="badge">{titleCase(i.severity)}</span>
              </div>
              <p className="tiny muted">
                {titleCase(i.type)} · {fmtTime(i.occurredAt)}
                {i.escalatedTo.length > 0 && ` · escalated to ${i.escalatedTo.join(", ")}`}
              </p>
              <p className="small">{i.description}</p>
              {i.actionTaken && (
                <p className="small">
                  <b>Action:</b> {i.actionTaken}
                </p>
              )}
              <Thumbs ids={ids(i.photos)} expired={expired(i.photos)} large />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatusBadge({ s }: { s: string | null }) {
  if (!s) return <span className="badge warn">Not recorded</span>;
  const cls = s === "PRESENT" ? "ok" : s === "LATE" ? "warn" : s === "ABSENT" ? "bad" : "";
  return <span className={`badge ${cls}`}>{s === "OFF" ? "Off shift" : titleCase(s)}</span>;
}

function Flag({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) return <span className="badge">{label} ?</span>;
  return (
    <span className={`badge ${ok ? "ok" : "bad"}`}>
      <Icon name={ok ? "check" : "x"} size={11} stroke={3} /> {label}
    </span>
  );
}
