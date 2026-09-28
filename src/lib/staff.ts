import { ApiError } from "./api";

const ROLES = ["RECEPTIONIST", "LIFEGUARD", "GYM_TRAINER", "OTHER"];

export function parseStaff(b: any) {
  const data: Record<string, unknown> = {};
  if (b.name !== undefined) {
    data.name = String(b.name).trim();
    if (!data.name) throw new ApiError(400, "Name is required");
  }
  if (b.role !== undefined) {
    if (!ROLES.includes(b.role)) throw new ApiError(400, "Invalid role");
    data.role = b.role;
  }
  if (b.clubhouseId !== undefined) data.clubhouseId = String(b.clubhouseId);
  if (b.phone !== undefined) data.phone = b.phone ? String(b.phone).trim() : null;
  if (b.certificateExpiry !== undefined) data.certificateExpiry = b.certificateExpiry ? new Date(b.certificateExpiry) : null;
  if (b.active !== undefined) data.active = Boolean(b.active);
  return data;
}
