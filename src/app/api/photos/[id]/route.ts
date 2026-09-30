import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Error responses must never be cached, or a single failed load sticks in the browser.
const fail = (status: number, text: string) => new Response(text, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const s = getSession();
  if (!s) return fail(401, "Unauthorized");
  try {
    const photo = await prisma.photo.findUnique({ where: { id: params.id } });
    if (!photo || (s.role !== "ADMIN" && photo.uploadedById !== s.uid)) return fail(404, "Not found");
    if (photo.purgedAt) return fail(410, "Photo expired (retention policy)");
    const data = await storage.get(photo.storageKey);
    if (!data) {
      // The DB row exists but the file doesn't: storage was wiped (e.g. a redeploy on a host
      // without a persistent disk) or this server instance can't see the other's disk.
      console.error(`photo file missing: id=${photo.id} key=${photo.storageKey}`);
      return fail(404, "Photo file missing");
    }
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": photo.mime, "Cache-Control": "private, max-age=86400, immutable" },
    });
  } catch (e) {
    console.error(`photo load failed: id=${params.id}`, e);
    return fail(500, "Could not load photo");
  }
}
