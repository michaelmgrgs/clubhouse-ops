import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const s = await getSettings();
  const [photos, purged] = await Promise.all([
    prisma.photo.aggregate({ where: { purgedAt: null }, _count: true, _sum: { sizeBytes: true } }),
    prisma.photo.count({ where: { purgedAt: { not: null } } }),
  ]);
  return (
    <SettingsForm
      settings={JSON.parse(JSON.stringify(s))}
      stats={{ stored: photos._count, bytes: photos._sum.sizeBytes ?? 0, purged }}
    />
  );
}
