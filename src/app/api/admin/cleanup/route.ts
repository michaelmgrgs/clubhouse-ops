import { requireUser } from "@/lib/auth";
import { ok, route } from "@/lib/api";
import { runCleanup } from "@/lib/cleanup";

export const POST = route(async () => {
  await requireUser("ADMIN");
  return ok(await runCleanup());
});
