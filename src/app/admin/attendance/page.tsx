import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { complianceGrid } from "@/lib/compliance";
import { addDays, cairoDay, fmtMinutes } from "@/lib/time";
import { STAFF_ROLE_LABEL } from "@/lib/checklist";
import { PrintButton } from "@/components/PrintButton";

const CODE: Record<string, string> = { PRESENT: "P", LATE: "L", ABSENT: "A", OFF: "O" };

export default async function AttendancePage({ searchParams }: { searchParams: { month?: string } }) {
  const month = /^\d{4}-\d{2}$/.test(searchParams.month || "") ? searchParams.month! : cairoDay().slice(0, 7);
  const first = `${month}-01`;
  const next = addDays(`${month}-28`, 4).slice(0, 7) + "-01";
  const last = addDays(next, -1);
  const settings = await getSettings();
  const min = settings.minMinutesPerClubhouse * 60;

  const grid = await complianceGrid(first, last, min);
  const clubs = grid.rows.map((r) => r.club);
  const staff = await prisma.staff.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });
  const checks = await prisma.staffCheck.findMany({
    where: { report: { day: { gte: first, lte: last } } },
    select: { staffId: true, status: true, report: { select: { day: true } } },
  });
  const days = grid.days;

  return (
    <div className="stack-lg">
      <div className="a-head">
        <div className="stack-sm">
          <h1>Monthly attendance</h1>
          <p className="muted small">From manager staff checks. P present · L late · A absent · O off shift</p>
        </div>
        <div className="row wrap">
          <form className="row no-print">
            <input className="input" type="month" name="month" defaultValue={month} style={{ width: 170 }} />
            <button className="btn">Show</button>
          </form>
          <PrintButton />
        </div>
      </div>

      <div className="card">
        <div className="section-h" style={{ paddingBottom: 10 }}>
          <h2>Manager on-site compliance</h2>
        </div>
        <div className="table-wrap">
          <table className="table att">
            <thead>
              <tr>
                <th>Clubhouse</th>
                {days.map((d) => (
                  <th key={d}>{Number(d.slice(8))}</th>
                ))}
                <th>Days OK</th>
                <th>Avg</th>
              </tr>
            </thead>
            <tbody>
              {grid.rows.map(({ club, cells }) => {
                const past = cells.filter((c) => c.state !== "none");
                const okDays = cells.filter((c) => c.state === "ok").length;
                const avg = past.length ? past.reduce((s, c) => s + c.seconds, 0) / past.length : 0;
                return (
                  <tr key={club.id}>
                    <td className="bold">{club.name}</td>
                    {cells.map((c) => (
                      <td key={c.day}>
                        <div className={`cell c-${c.state}`} style={{ height: 22, fontSize: 10 }} title={`${Math.floor(c.seconds / 60)} min`}>
                          {c.state === "ok" ? "✓" : c.state === "miss" ? "✗" : c.seconds ? Math.floor(c.seconds / 60) : ""}
                        </div>
                      </td>
                    ))}
                    <td className="bold">
                      {okDays}/{past.length}
                    </td>
                    <td className="mono">{fmtMinutes(avg)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {clubs.map((club) => {
        const roster = staff.filter((s) => s.clubhouseId === club.id);
        return (
          <div key={club.id} className="card">
            <div className="section-h" style={{ paddingBottom: 10 }}>
              <h2>{club.name} · staff</h2>
            </div>
            <div className="table-wrap">
              <table className="table att">
                <thead>
                  <tr>
                    <th>Staff</th>
                    {days.map((d) => (
                      <th key={d}>{Number(d.slice(8))}</th>
                    ))}
                    <th>P</th>
                    <th>L</th>
                    <th>A</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((s) => {
                    const mine = checks.filter((c) => c.staffId === s.id);
                    const count = (st: string) => mine.filter((c) => c.status === st).length;
                    return (
                      <tr key={s.id}>
                        <td>
                          <div className="bold">{s.name}</div>
                          <div className="tiny muted">
                            {STAFF_ROLE_LABEL[s.role]}
                            {!s.active && " · inactive"}
                          </div>
                        </td>
                        {days.map((d) => {
                          const st = mine.find((c) => c.report.day === d)?.status;
                          return (
                            <td key={d}>
                              <span className={st ? CODE[st] : ""}>{st ? CODE[st] : "·"}</span>
                            </td>
                          );
                        })}
                        <td className="bold">{count("PRESENT")}</td>
                        <td className="bold">{count("LATE")}</td>
                        <td className="bold" style={{ color: count("ABSENT") > 2 ? "var(--bad)" : undefined }}>
                          {count("ABSENT")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="tiny muted" style={{ padding: "0 16px 14px" }}>
              Red absence count = more than 2 absences this month (contract: penalty + mandatory replacement).
            </p>
          </div>
        );
      })}
    </div>
  );
}
