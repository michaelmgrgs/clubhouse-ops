import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/time";
import { INCIDENT_TYPES, titleCase } from "@/lib/checklist";
import { Thumbs } from "@/components/Photos";
import { IncidentToggle } from "@/components/IncidentToggle";

const SEV: Record<string, string> = { LOW: "", MEDIUM: "info", HIGH: "warn", CRITICAL: "bad" };

export default async function IncidentsPage({ searchParams }: { searchParams: { status?: string; club?: string; type?: string } }) {
  const clubs = await prisma.clubhouse.findMany({ orderBy: { sortOrder: "asc" } });
  const status = searchParams.status === "CLOSED" ? "CLOSED" : searchParams.status === "ALL" ? undefined : "OPEN";
  const incidents = await prisma.incident.findMany({
    where: {
      status,
      clubhouseId: searchParams.club || undefined,
      type: (INCIDENT_TYPES as readonly string[]).includes(searchParams.type || "") ? (searchParams.type as any) : undefined,
    },
    orderBy: { occurredAt: "desc" },
    take: 200,
    include: { clubhouse: { select: { name: true } }, user: { select: { name: true } }, photos: { select: { id: true, purgedAt: true } } },
  });

  return (
    <div className="stack-lg">
      <div className="a-head">
        <div className="stack-sm">
          <h1>Incidents & complaints</h1>
          <p className="muted small">{incidents.length} shown</p>
        </div>
        <form className="row wrap">
          <select className="select" name="status" defaultValue={searchParams.status || "OPEN"} style={{ width: 130 }}>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="ALL">All</option>
          </select>
          <select className="select" name="type" defaultValue={searchParams.type || ""} style={{ width: 150 }}>
            <option value="">All types</option>
            {INCIDENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
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
      {incidents.length === 0 ? (
        <div className="card pad muted center">Nothing here.</div>
      ) : (
        incidents.map((i) => (
          <div key={i.id} className="card pad stack">
            <div className="row-between wrap">
              <div className="stack-sm" style={{ gap: 2 }}>
                <h3>{i.title}</h3>
                <span className="tiny muted">
                  {i.clubhouse.name} · {fmtDateTime(i.occurredAt)} · reported by {i.user.name}
                </span>
              </div>
              <div className="row wrap" style={{ gap: 6 }}>
                <span className="badge">{titleCase(i.type)}</span>
                <span className={`badge ${SEV[i.severity]}`}>{titleCase(i.severity)}</span>
                <IncidentToggle id={i.id} status={i.status} />
              </div>
            </div>
            <p className="small" style={{ whiteSpace: "pre-wrap" }}>{i.description}</p>
            {i.actionTaken && (
              <p className="small">
                <b>Action taken:</b> {i.actionTaken}
              </p>
            )}
            {i.escalatedTo.length > 0 && <p className="small muted">Escalated to: {i.escalatedTo.join(", ")}</p>}
            <Thumbs ids={i.photos.map((p) => p.id)} expired={i.photos.filter((p) => p.purgedAt).map((p) => p.id)} large />
          </div>
        ))
      )}
    </div>
  );
}
