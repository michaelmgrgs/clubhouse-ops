"use client";
import { useState } from "react";
import { PhotoStrip } from "@/components/Photos";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { sendWithLoc } from "@/lib/client/api";
import { STAFF_ROLE_LABEL } from "@/lib/checklist";
import type { Club, ReportData, StaffRow } from "./types";

type Check = NonNullable<StaffRow["check"]>;
const EMPTY: Check = { status: null, uniformOk: null, onPost: null, noPhone: null, note: null, photos: [] };

export default function StaffTab({
  data,
  setData,
  club,
  locked,
}: {
  data: ReportData;
  setData: React.Dispatch<React.SetStateAction<ReportData | null>>;
  club: Club;
  locked: boolean;
}) {
  function patchLocal(id: string, patch: Partial<Check>) {
    setData((d) =>
      d ? { ...d, staff: d.staff.map((s) => (s.id === id ? { ...s, check: { ...EMPTY, ...s.check, ...patch } } : s)) } : d,
    );
  }

  async function save(s: StaffRow, patch: Partial<Omit<Check, "photos">>) {
    const before = s.check ?? EMPTY;
    patchLocal(s.id, patch);
    try {
      await sendWithLoc("/api/m/report/staff", "PUT", { staffId: s.id, ...patch });
    } catch (e: any) {
      patchLocal(s.id, before);
      toast(e.message, "bad");
    }
  }

  if (!data.staff.length) {
    return <div className="card pad muted center">No staff on the roster for this clubhouse. Ask the admin to add them.</div>;
  }

  return (
    <>
      <p className="small muted" style={{ padding: "0 2px" }}>
        Record attendance for every staff member and take a photo of each one on duty at their post.
      </p>
      {data.staff.map((s) => (
        <StaffCard key={s.id} s={s} club={club} locked={locked} onSave={(p) => save(s, p)} onPhotos={(photos) => patchLocal(s.id, { photos })} />
      ))}
    </>
  );
}

function StaffCard({
  s,
  club,
  locked,
  onSave,
  onPhotos,
}: {
  s: StaffRow;
  club: Club;
  locked: boolean;
  onSave: (p: Partial<Omit<Check, "photos">>) => void;
  onPhotos: (ids: string[]) => void;
}) {
  const c = s.check ?? EMPTY;
  const [note, setNote] = useState(c.note ?? "");
  const onDuty = c.status === "PRESENT" || c.status === "LATE";
  const certExpired = s.role === "LIFEGUARD" && (!s.certificateExpiry || new Date(s.certificateExpiry) < new Date());
  const certSoon = s.role === "LIFEGUARD" && !certExpired && new Date(s.certificateExpiry!).getTime() - Date.now() < 30 * 86400_000;

  return (
    <div className="card pad stack">
      <div className="row-between">
        <div className="stack-sm" style={{ gap: 2 }}>
          <h3>{s.name}</h3>
          <span className="tiny muted">{STAFF_ROLE_LABEL[s.role]}</span>
        </div>
        {c.status && (
          <span className={`badge ${c.status === "PRESENT" ? "ok" : c.status === "LATE" ? "warn" : c.status === "ABSENT" ? "bad" : ""}`}>
            {c.status === "OFF" ? "Off shift" : c.status.charAt(0) + c.status.slice(1).toLowerCase()}
          </span>
        )}
      </div>
      {certExpired && (
        <div className="banner bad small">
          <Icon name="alert" /> Lifesaving certificate {s.certificateExpiry ? "expired" : "not on file"} — this lifeguard must not be on duty.
        </div>
      )}
      {certSoon && <div className="banner warn small">Certificate expires {new Date(s.certificateExpiry!).toLocaleDateString("en-GB")}</div>}

      <div className="seg full">
        {(
          [
            ["PRESENT", "Present", "on-ok"],
            ["LATE", "Late", "on-warn"],
            ["ABSENT", "Absent", "on-bad"],
            ["OFF", "Off shift", "on-neutral"],
          ] as const
        ).map(([v, label, cls]) => (
          <button key={v} className={c.status === v ? cls : ""} disabled={locked} onClick={() => onSave({ status: v })}>
            {label}
          </button>
        ))}
      </div>

      {onDuty && (
        <>
          <YesNo label="Uniform & appearance OK" value={c.uniformOk} disabled={locked} onChange={(v) => onSave({ uniformOk: v })} />
          <YesNo label={s.role === "LIFEGUARD" ? "At the pool / on post" : "At their post"} value={c.onPost} disabled={locked} onChange={(v) => onSave({ onPost: v })} />
          <YesNo label="No personal mobile use" value={c.noPhone} disabled={locked} onChange={(v) => onSave({ noPhone: v })} />
          <PhotoStrip
            ids={c.photos}
            onChange={onPhotos}
            fields={{ target: "staff", staffId: s.id }}
            stampTitle={`${club.name} · ${s.name}`}
            required
            disabled={locked}
            max={2}
          />
        </>
      )}

      <textarea
        className="textarea"
        style={{ minHeight: 50 }}
        placeholder="Note (optional)"
        value={note}
        disabled={locked}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== (c.note ?? "") && onSave({ note })}
      />
    </div>
  );
}

function YesNo({ label, value, onChange, disabled }: { label: string; value: boolean | null; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <div className="row-between">
      <span className="small">{label}</span>
      <div className="seg">
        <button className={value === true ? "on-ok" : ""} disabled={disabled} onClick={() => onChange(true)}>
          Yes
        </button>
        <button className={value === false ? "on-bad" : ""} disabled={disabled} onClick={() => onChange(false)}>
          No
        </button>
      </div>
    </div>
  );
}
