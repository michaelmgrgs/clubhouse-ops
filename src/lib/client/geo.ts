"use client";
// Single shared GPS watcher for the manager app, plus a dev-only simulator.
import { useSyncExternalStore } from "react";

export type Fix = { lat: number; lng: number; accuracy: number; ts: number };
type GeoState = { fix: Fix | null; error: string | null; simulated: boolean };

export const DEV_GEO = process.env.NEXT_PUBLIC_DEV_GEO === "1";

let state: GeoState = { fix: null, error: null, simulated: false };
let realFix: Fix | null = null;
let sim: { lat: number; lng: number } | null = null;
let watchId: number | null = null;
const listeners = new Set<() => void>();

function emit(next: Partial<GeoState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function errorText(e: GeolocationPositionError) {
  if (e.code === e.PERMISSION_DENIED) return "Location access is blocked. Allow location for this site in your browser settings.";
  if (e.code === e.POSITION_UNAVAILABLE) return "GPS position unavailable. Turn on Location Services.";
  return "Still waiting for a GPS fix…";
}

const toFix = (p: GeolocationPosition): Fix => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
  accuracy: p.coords.accuracy,
  ts: p.timestamp || Date.now(),
});

export function startGeo() {
  if (watchId !== null || typeof navigator === "undefined") return;
  if (!navigator.geolocation) {
    emit({ error: "This browser doesn't support GPS location." });
    return;
  }
  watchId = navigator.geolocation.watchPosition(
    (p) => {
      realFix = toFix(p);
      if (!sim) emit({ fix: realFix, error: null });
    },
    (e) => {
      if (!sim) emit({ error: errorText(e) });
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
  );
}

export function setSimulatedLocation(target: { lat: number; lng: number } | null) {
  if (!DEV_GEO) return;
  sim = target;
  if (sim) emit({ fix: { ...sim, accuracy: 12, ts: Date.now() }, error: null, simulated: true });
  else emit({ fix: realFix, simulated: false });
}

/** A fix no older than ~20 s — requests one if the watcher has gone quiet (stationary phones). */
export async function freshLoc(): Promise<Fix> {
  if (sim) return { ...sim, accuracy: 12, ts: Date.now() };
  if (realFix && Date.now() - realFix.ts < 20_000) return realFix;
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        realFix = toFix(p);
        emit({ fix: realFix, error: null });
        resolve(realFix);
      },
      (e) => reject(new Error(errorText(e))),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  });
}

export function useGeo(): GeoState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const r = (x: number) => (x * Math.PI) / 180;
  const s = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
