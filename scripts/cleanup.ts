// Manual / system-cron entry point for the photo retention job: `npm run cleanup`
import { runCleanup } from "../src/lib/cleanup";
import { prisma } from "../src/lib/db";

runCleanup()
  .then((r) => console.log("cleanup:", r))
  .finally(() => prisma.$disconnect());
