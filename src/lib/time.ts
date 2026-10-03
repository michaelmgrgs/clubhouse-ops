export const TZ = "Africa/Cairo";

/** YYYY-MM-DD for the given instant in Cairo time. */
export function cairoDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fmtTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

export function fmtDay(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" })
    .format(new Date(`${day}T12:00:00Z`));
}

export function fmtMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}

/** Clubhouse duty ends 10 PM; visits nobody closed are ended at 10:30 PM. */
export const DAY_END_HOUR = 22.5;

/** The UTC instant of `hours` after 00:00 Cairo time on `day`. */
export function cairoTimeOnDay(day: string, hours: number): Date {
  return new Date(cairoDayStart(day).getTime() + hours * 3600_000);
}

/** The UTC instant of 00:00 Cairo time on `day` (handles Egypt's DST). */
export function cairoDayStart(day: string): Date {
  const noon = new Date(`${day}T12:00:00Z`);
  const offset =
    new Date(noon.toLocaleString("en-US", { timeZone: TZ })).getTime() - new Date(noon.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(Date.parse(`${day}T00:00:00Z`) - offset);
}
