import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const s = getSession();
  if (!s) return new Response("Unauthorized", { status: 401 });
  const photo = await prisma.photo.findUnique({ where: { id: params.id } });
  if (!photo || (s.role !== "ADMIN" && photo.uploadedById !== s.uid)) return new Response("Not found", { status: 404 });
  if (photo.purgedAt) return new Response("Photo expired (retention policy)", { status: 410 });
  const data = await storage.get(photo.storageKey);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": photo.mime, "Cache-Control": "private, max-age=86400, immutable" },
  });
}
