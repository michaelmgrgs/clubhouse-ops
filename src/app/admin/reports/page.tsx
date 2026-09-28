import Link from "next/link";
import { prisma } from "@/lib/db";
import { cairoDay, fmtDay, fmtMinutes, fmtTime } from "@/lib/time";
import { getSettings } from "@/lib/settings";

export default async function ReportsPage({ searchParams }: { searchParams: { month?: string; club?: string } }) {
  const month = /^\d{4}-\d{2}$/.test(searchParams.month || "") ? searchParams.month! : cairoDay().slice(0, 7);
  const settings = await getSettings();
  const clubs = await prisma.clubhouse.findMany({ orderBy: { sortOrder: "asc" } });
  const reports = await prisma.dailyReport.findMany({
    where: { day: { startsWith: month }, clubhouseId: searchParams.club || undefined },
    orderBy: [{ day: "desc" }, { clubhouse: { sortOrder: "asc" } }],
    include: {
      clubhouse: { select: { name: true } },
      user: { select: { name: true } },
      answers: { where: { status: "ISSUE" }, select: { id: true } },
      staffChecks: { where: { status: { in: ["ABSENT", "LATE"] } }, select: { status: true } },
    },
  });
  const visitSums = await prisma.visit.groupBy({ by: ["clubhouseId", "day"], where: { day: { startsWith: month } }, _sum: { verifiedSeconds: true } });
  const min = settings.minMinutesPerClubhouse * 60;

  return (
    <div className="stack-lg">
      <div className="a-head">
        <div className="stack-sm">
          <h1>Daily reports</h1>
          <p className="muted small">{reports.length} reports</p>
        </div>
        <form className="row wrap">
          <input className="input" type="month" name="month" defaultValue={month} style={{ width: 170 }} />
          <select className="select" name="club" defaultValue={searchParams.club || ""} style={{ width: 220 }}>
            <option value="">All clubhouses</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="btn">Filter</button>
        </form>
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Clubhouse</th>
              <th>Manager</th>
              <th>On site</th>
              <th>Status</th>
              <th>Findings</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 && (
              <tr>
                <td colSpan={6} className="muted center">
                  No reports this month.
                </td>
              </tr>
            )}
            {reports.map((r) => {
              const secs = visitSums.find((v) => v.clubhouseId === r.clubhouseId && v.day === r.day)?._sum.verifiedSeconds ?? 0;
              const absent = r.staffChecks.filter((s) => s.status === "ABSENT").length;
              const late = r.staffChecks.filter((s) => s.status === "LATE").length;
              return (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/reports/${r.id}`} className="bold" style={{ color: "var(--brand)" }}>
                      {fmtDay(r.day)}
                    </Link>
                  </td>
                  <td>{r.clubhouse.name}</td>
                  <td>{r.user.name}</td>
                  <td>
                    <span className={`badge ${secs >= min ? "ok" : "bad"}`}>{fmtMinutes(secs)}</span>
                  </td>
                  <td>
                    {r.status === "SUBMITTED" ? (
                      <span className="badge ok">Submitted {fmtTime(r.submittedAt)}</span>
                    ) : (
                      <span className="badge warn">Draft</span>
                    )}
                  </td>
                  <td className="small">
                    <div className="row wrap" style={{ gap: 4 }}>
                      {r.answers.length > 0 && <span className="badge bad">{r.answers.length} issue{r.answers.length > 1 ? "s" : ""}</span>}
                      {absent > 0 && <span className="badge bad">{absent} absent</span>}
                      {late > 0 && <span className="badge warn">{late} late</span>}
                      {!r.answers.length && !absent && !late && <span className="muted">—</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
