import { runCleanup } from "@/lib/cleanup";

export const dynamic = "force-dynamic";

/** Daily photo-retention job. Call with `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this automatically). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await runCleanup());
}
