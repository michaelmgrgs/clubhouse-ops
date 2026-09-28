// Photo retention: files older than `photoRetentionDays` are deleted from storage.
// The Photo row stays (marked purgedAt) so reports still show that a photo existed.
import { prisma } from "./db";
import { storage } from "./storage";
import { getSettings } from "./settings";

export async function runCleanup() {
  const settings = await getSettings();
  const cutoff = new Date(Date.now() - settings.photoRetentionDays * 86400_000);
  let purged = 0;
  for (;;) {
    const batch = await prisma.photo.findMany({
      where: { purgedAt: null, createdAt: { lt: cutoff } },
      select: { id: true, storageKey: true },
      take: 200,
    });
    if (batch.length === 0) break;
    for (const p of batch) await storage.remove(p.storageKey);
    await prisma.photo.updateMany({ where: { id: { in: batch.map((p) => p.id) } }, data: { purgedAt: new Date() } });
    purged += batch.length;
  }

  // Photos uploaded but never attached to anything (abandoned forms) — drop after a day.
  const orphans = await prisma.photo.findMany({
    where: {
      createdAt: { lt: new Date(Date.now() - 86400_000) },
      answerId: null, staffCheckId: null, incidentId: null, issueId: null,
    },
    select: { id: true, storageKey: true },
  });
  for (const p of orphans) await storage.remove(p.storageKey);
  if (orphans.length) await prisma.photo.deleteMany({ where: { id: { in: orphans.map((p) => p.id) } } });

  await prisma.settings.update({ where: { id: 1 }, data: { lastCleanupAt: new Date() } });
  return { purged, orphansRemoved: orphans.length };
}

/** Runs the cleanup in the background if it hasn't run in the last 12 hours. */
export async function maybeRunCleanup() {
  const s = await getSettings();
  if (s.lastCleanupAt && Date.now() - s.lastCleanupAt.getTime() < 12 * 3600_000) return;
  runCleanup().catch((e) => console.error("photo cleanup failed", e));
}
