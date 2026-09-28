"use client";
import { freshLoc } from "./geo";

export class RequestError extends Error {
  constructor(message: string, public status: number, public data: any) {
    super(message);
  }
}

async function handle(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = "/login";
  }
  if (!res.ok) throw new RequestError(data.error || `Request failed (${res.status})`, res.status, data);
  return data;
}

export async function getJson<T = any>(url: string): Promise<T> {
  return handle(await fetch(url, { cache: "no-store" }));
}

/** JSON request without location (admin screens). */
export async function send<T = any>(url: string, method: string, body?: unknown): Promise<T> {
  return handle(
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }),
  );
}

/** Manager write: always carries a fresh GPS fix which the server checks against the geofence. */
export async function sendWithLoc<T = any>(url: string, method: string, body: Record<string, unknown> = {}): Promise<T> {
  const loc = await freshLoc();
  return send(url, method, { ...body, loc });
}

export async function uploadPhoto(blob: Blob, fields: Record<string, string>): Promise<{ id: string }> {
  const loc = await freshLoc();
  const fd = new FormData();
  fd.append("file", blob, "photo.jpg");
  fd.append("loc", JSON.stringify(loc));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return handle(await fetch("/api/m/photos", { method: "POST", body: fd }));
}
