import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/time";
import { titleCase } from "@/lib/checklist";
import { Thumbs } from "@/components/Photos";

function sla(dueAt: Date, closedAt: Date | null) {
  const end = closedAt ?? new Date();
  const ms = dueAt.getTime() - end.getTime();
  const h = Math.round(Math.abs(ms) / 3600_000);
  if (closedAt) return ms >= 0 ? { text: "Closed within SLA", cls: "ok" } : { text: `Closed ${h}h late`, cls: "bad" };
  return ms < 0 ? { text: `Overdue ${h}h`, cls: "bad" } : { text: `${h}h left`, cls: h < 12 ? "warn" : "info" };
}

export default async function IssuesPage({ searchParams }: { searchParams: { status?: string; club?: string } }) {
  const clubs = await prisma.clubhouse.findMany({ orderBy: { sortOrder: "asc" } });
  const status = searchParams.status === "CLOSED" ? "CLOSED" : searchParams.status === "ALL" ? undefined : "OPEN";
  const issues = await prisma.issue.findMany({
    where: { status, clubhouseId: searchParams.club || undefined },
    orderBy: status === "OPEN" ? { dueAt: "asc" } : { openedAt: "desc" },
    take: 200,
    include: {
      clubhouse: { select: { name: true } },
      reportedBy: { select: { name: true } },
      photos: { select: { id: true, purpose: true, purgedAt: true } },
    },
  });
  const closedLast30 = await prisma.issue.findMany({
    where: { status: "CLOSED", closedAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
    select: { dueAt: true, closedAt: true },
  });
  const onTime = closedLast30.filter((i) => i.closedAt! <= i.dueAt).length;

  return (
    <div className="stack-lg">
      <div className="a-head">
        <div className="stack-sm">
          <h1>Maintenance (civil / MEP)</h1>
          <p className="muted small">
            48-hour closure SLA · last 30 days: {onTime}/{closedLast30.length} closed on time
          </p>
        </div>
        <form className="row wrap">
          <select className="select" name="status" defaultValue={searchParams.status || "OPEN"} style={{ width: 130 }}>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="ALL">All</option>
          </select>
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
      {issues.length === 0 ? (
        <div className="card pad muted center">Nothing here.</div>
      ) : (
        issues.map((i) => {
          const s = sla(i.dueAt, i.closedAt);
          const before = i.photos.filter((p) => p.purpose !== "closure");
          const after = i.photos.filter((p) => p.purpose === "closure");
          return (
            <div key={i.id} className="card pad stack">
              <div className="row-between wrap">
                <div className="stack-sm" style={{ gap: 2 }}>
                  <h3>{i.title}</h3>
                  <span className="tiny muted">
                    {i.clubhouse.name} · opened {fmtDateTime(i.openedAt)} by {i.reportedBy.name}
                    {i.closedAt && ` · closed ${fmtDateTime(i.closedAt)}`}
                  </span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <span className="badge">{i.category === "MEP" ? "MEP" : titleCase(i.category)}</span>
                  <span className={`badge ${s.cls}`}>{s.text}</span>
                </div>
              </div>
              {i.description && <p className="small">{i.description}</p>}
              <div className="row wrap" style={{ alignItems: "flex-start", gap: 24 }}>
                <div className="stack-sm">
                  <span className="tiny muted bold">BEFORE</span>
                  <Thumbs ids={before.map((p) => p.id)} expired={before.filter((p) => p.purgedAt).map((p) => p.id)} large />
                </div>
                {after.length > 0 && (
                  <div className="stack-sm">
                    <span className="tiny muted bold">AFTER</span>
                    <Thumbs ids={after.map((p) => p.id)} expired={after.filter((p) => p.purgedAt).map((p) => p.id)} large />
                  </div>
                )}
              </div>
              {i.closureNote && <p className="small">✅ {i.closureNote}</p>}
            </div>
          );
        })
      )}
    </div>
  );
}
