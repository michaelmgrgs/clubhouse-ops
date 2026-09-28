// Photo storage. Local disk for now; swap this module for S3 / Cloudflare R2
// when deploying to a host without a persistent disk. Keep the same 3 methods.
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const ROOT = path.resolve(process.env.STORAGE_DIR || "./storage");

function resolveKey(key: string) {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export const storage = {
  async put(data: Buffer, ext = "jpg"): Promise<string> {
    const d = new Date();
    const key = `photos/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${ext}`;
    const full = resolveKey(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return key;
  },
  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(resolveKey(key));
    } catch (e: any) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await fs.unlink(resolveKey(key));
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
  },
};
