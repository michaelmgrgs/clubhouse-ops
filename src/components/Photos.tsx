"use client";
import { useRef, useState } from "react";
import { Icon } from "./Icon";
import { toast } from "./Toast";
import { processPhoto, PhotoRejected } from "@/lib/client/image";
import { uploadPhoto, sendWithLoc } from "@/lib/client/api";
import { DEV_GEO, freshLoc } from "@/lib/client/geo";

const RETRY_DELAYS = [800, 2500];

/**
 * Photo thumbnail that retries a failed load (a busy or cold server can drop
 * one of many parallel image requests) and shows a retry tile instead of the
 * browser's broken-image icon.
 */
function PhotoImg({ id }: { id: string }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  function onError() {
    if (attempt < RETRY_DELAYS.length) {
      setTimeout(() => setAttempt((a) => a + 1), RETRY_DELAYS[attempt]);
    } else {
      setFailed(true);
    }
  }

  if (failed) {
    return (
      <span
        className="thumb-fail"
        onClick={(e) => {
          e.stopPropagation();
          setFailed(false);
          setAttempt((a) => a + 1);
        }}
      >
        Photo unavailable · tap to retry
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/photos/${id}${attempt ? `?r=${attempt}` : ""}`} alt="" onError={onError} />;
}

export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="lightbox" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" />
    </div>
  );
}

/** Read-only thumbnails (admin + submitted reports). */
export function Thumbs({ ids, expired = [] as string[], large = false }: { ids: string[]; expired?: string[]; large?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!ids.length) return null;
  return (
    <>
      <div className="thumbs">
        {ids.map((id) =>
          expired.includes(id) ? (
            <div key={id} className={`thumb expired ${large ? "thumb-lg" : ""}`}>Photo deleted (30-day retention)</div>
          ) : (
            <button key={id} className={`thumb ${large ? "thumb-lg" : ""}`} style={{ padding: 0, cursor: "zoom-in" }} onClick={() => setOpen(id)}>
              <PhotoImg id={id} />
            </button>
          ),
        )}
      </div>
      {open && <Lightbox src={`/api/photos/${open}`} onClose={() => setOpen(null)} />}
    </>
  );
}

/**
 * Camera capture strip. Opens the rear camera, stamps + compresses the photo,
 * uploads it with a fresh GPS fix, and reports the new id list via onChange.
 */
export function PhotoStrip({
  ids,
  onChange,
  fields,
  stampTitle,
  required = false,
  disabled = false,
  max = 4,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
  fields: Record<string, string>;
  stampTitle: string;
  required?: boolean;
  disabled?: boolean;
  max?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const loc = await freshLoc();
      const now = new Date();
      const stamp = [
        stampTitle,
        `${now.toLocaleDateString("en-GB", { timeZone: "Africa/Cairo" })} ${now.toLocaleTimeString("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" })} · ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)} ±${Math.round(loc.accuracy)}m`,
      ];
      const blob = await processPhoto(file, stamp, DEV_GEO);
      const { id } = await uploadPhoto(blob, fields);
      onChange([...ids, id]);
    } catch (err: any) {
      toast(err instanceof PhotoRejected ? err.message : err.message || "Upload failed", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this photo?")) return;
    try {
      await sendWithLoc(`/api/m/photos/${id}`, "DELETE");
      onChange(ids.filter((x) => x !== id));
    } catch (err: any) {
      toast(err.message, "bad");
    }
  }

  return (
    <div className="thumbs">
      {ids.map((id) => (
        <div key={id} className="thumb">
          <button style={{ all: "unset", cursor: "zoom-in", display: "block", width: "100%", height: "100%" }} onClick={() => setOpen(id)}>
            <PhotoImg id={id} />
          </button>
          {!disabled && (
            <button className="x" onClick={() => remove(id)} aria-label="Remove photo">
              ×
            </button>
          )}
        </div>
      ))}
      {!disabled && ids.length < max && (
        <button className={`thumb add ${required && ids.length === 0 ? "req" : ""}`} onClick={() => input.current?.click()} disabled={busy}>
          {busy ? (
            "Uploading…"
          ) : (
            <>
              <Icon name="camera" size={20} />
              {required && ids.length === 0 ? "Required" : "Photo"}
            </>
          )}
        </button>
      )}
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      {open && <Lightbox src={`/api/photos/${open}`} onClose={() => setOpen(null)} />}
    </div>
  );
}
