import { clearSession } from "@/lib/auth";
import { ok, route } from "@/lib/api";

export const POST = route(async () => {
  clearSession();
  return ok();
});
