"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { send } from "@/lib/client/api";

type Club = { id: string; name: string; latitude: number; longitude: number; radiusM: number; locationVerified: boolean };

export default function ClubhouseEditor({ club }: { club: Club }) {
  const router = useRouter();
  const [coords, setCoords] = useState(`${club.latitude}, ${club.longitude}`);
  const [radius, setRadius] = useState(String(club.radiusM));
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [locating, setLocating] = useState(false);

  const [lat, lng] = coords.split(",").map((x) => Number(x.trim()));
  const valid = Number.isFinite(lat) && Number.isFinite(lng);

  function useHere() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords(`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`);
        setMsg({ kind: "info", text: `Got your position (±${Math.round(p.coords.accuracy)} m). Press Save to apply.` });
        setLocating(false);
      },
      (e) => {
        setMsg({ kind: "bad", text: e.message });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  async function save() {
    try {
      await send(`/api/admin/clubhouses/${club.id}`, "PATCH", { latitude: lat, longitude: lng, radiusM: Number(radius) });
      setMsg({ kind: "ok", text: "Saved" });
      router.refresh();
    } catch (e: any) {
      setMsg({ kind: "bad", text: e.message });
    }
  }

  return (
    <div className="card pad stack">
      <div className="row-between">
        <h2>{club.name}</h2>
        {club.locationVerified ? <span className="badge ok">Location set</span> : <span className="badge warn">Placeholder location</span>}
      </div>
      <div className="grid-2 collapse">
        <label className="field">
          <span>Coordinates (lat, lng)</span>
          <input className="input mono" value={coords} onChange={(e) => setCoords(e.target.value)} />
        </label>
        <label className="field">
          <span>Geofence radius (metres)</span>
          <input className="input" type="number" min={30} max={1000} value={radius} onChange={(e) => setRadius(e.target.value)} />
        </label>
      </div>
      {valid && (
        <iframe
          title={`${club.name} map`}
          style={{ width: "100%", height: 260, border: 0, borderRadius: 10 }}
          loading="lazy"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.004},${lat - 0.0025},${lng + 0.004},${lat + 0.0025}&layer=mapnik&marker=${lat},${lng}`}
        />
      )}
      <div className="row wrap">
        <button className="btn" onClick={useHere} disabled={locating}>
          <Icon name="pin" /> {locating ? "Locating…" : "Use my current location"}
        </button>
        {valid && (
          <a className="btn btn-ghost" href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer">
            Open in Google Maps ↗
          </a>
        )}
        <div className="grow" />
        <button className="btn btn-primary" onClick={save} disabled={!valid}>
          Save
        </button>
      </div>
      {msg && <div className={`banner ${msg.kind} small`}>{msg.text}</div>}
    </div>
  );
}
