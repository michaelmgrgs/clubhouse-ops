"use client";
import { useState } from "react";
import { PhotoStrip } from "@/components/Photos";
import { toast } from "@/components/Toast";
import { sendWithLoc } from "@/lib/client/api";
import { CHECKLIST, type ChecklistItem } from "@/lib/checklist";
import type { Answer, Club, ReportData } from "./types";

const EMPTY: Answer = { status: null, note: null, photos: [] };

export default function ChecklistTab({
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
  function patchLocal(key: string, patch: Partial<Answer>) {
    setData((d) => (d ? { ...d, answers: { ...d.answers, [key]: { ...EMPTY, ...d.answers[key], ...patch } } } : d));
  }

  async function save(key: string, patch: { status?: Answer["status"]; note?: string | null }) {
    const before = data.answers[key] ?? EMPTY;
    patchLocal(key, patch);
    try {
      await sendWithLoc("/api/m/report/answer", "PUT", { itemKey: key, ...patch });
    } catch (e: any) {
      patchLocal(key, before);
      toast(e.message, "bad");
    }
  }

  return (
    <>
      {CHECKLIST.map((section) => {
        const done = section.items.filter((i) => data.answers[i.key]?.status).length;
        return (
          <div key={section.key} className="card">
            <div className="section-h">
              <h3>{section.title}</h3>
              <span className={`badge ${done === section.items.length ? "ok" : ""}`}>
                {done}/{section.items.length}
              </span>
            </div>
            {section.items.map((item) => (
              <Item
                key={item.key}
                item={item}
                answer={data.answers[item.key] ?? EMPTY}
                club={club}
                locked={locked}
                onSave={(p) => save(item.key, p)}
                onPhotos={(photos) => patchLocal(item.key, { photos })}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

function Item({
  item,
  answer,
  club,
  locked,
  onSave,
  onPhotos,
}: {
  item: ChecklistItem;
  answer: Answer;
  club: Club;
  locked: boolean;
  onSave: (p: { status?: Answer["status"]; note?: string | null }) => void;
  onPhotos: (ids: string[]) => void;
}) {
  const [note, setNote] = useState(answer.note ?? "");
  const showNote = answer.status === "ISSUE" || !!answer.note;
  const photoNeeded = item.photo === "required" && answer.status !== "NA";

  return (
    <div className="item">
      <div className="stack-sm" style={{ gap: 2 }}>
        <div className="bold" style={{ fontSize: 14 }}>
          {item.label}
        </div>
        {item.hint && <div className="tiny muted">{item.hint}</div>}
      </div>
      <div className="seg full">
        {(
          [
            ["OK", "OK", "on-ok"],
            ["ISSUE", "Issue", "on-bad"],
            ["NA", "N/A", "on-neutral"],
          ] as const
        ).map(([v, label, cls]) => (
          <button key={v} className={answer.status === v ? cls : ""} disabled={locked} onClick={() => onSave({ status: v })}>
            {label}
          </button>
        ))}
      </div>
      {showNote && (
        <textarea
          className="textarea"
          style={{ minHeight: 60 }}
          placeholder={answer.status === "ISSUE" ? "What's wrong? (required)" : "Note"}
          value={note}
          disabled={locked}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (answer.note ?? "") && onSave({ note })}
        />
      )}
      {item.photo && (
        <PhotoStrip
          ids={answer.photos}
          onChange={onPhotos}
          fields={{ target: "answer", itemKey: item.key }}
          stampTitle={`${club.name} · ${item.label}`}
          required={photoNeeded}
          disabled={locked}
        />
      )}
    </div>
  );
}
