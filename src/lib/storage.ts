// Photo storage.
//  - S3-compatible object storage (DigitalOcean Spaces, Cloudflare R2, AWS S3) when S3_BUCKET is set
//  - local disk (STORAGE_DIR) otherwise — only safe on a server with a persistent disk
// Objects are always private; the app streams them through /api/photos/[id] after an auth check.
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

type Driver = {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
};

// ---------- local disk ----------
const ROOT = path.resolve(process.env.STORAGE_DIR || "./storage");

function resolveKey(key: string) {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid storage key");
  return full;
}

const disk: Driver = {
  async put(key, data) {
    const full = resolveKey(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  },
  async get(key) {
    try {
      return await fs.readFile(resolveKey(key));
    } catch (e: any) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  },
  async remove(key) {
    try {
      await fs.unlink(resolveKey(key));
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
  },
};

// ---------- S3-compatible (AWS Signature V4, no SDK needed) ----------
function s3Driver(): Driver {
  const bucket = process.env.S3_BUCKET!;
  // e.g. https://fra1.digitaloceanspaces.com
  const endpoint = new URL(process.env.S3_ENDPOINT || "https://fra1.digitaloceanspaces.com");
  const region = process.env.S3_REGION || "us-east-1";
  const accessKey = process.env.S3_ACCESS_KEY || "";
  const secretKey = process.env.S3_SECRET_KEY || "";
  const prefix = (process.env.S3_PREFIX || "clubhouse-ops").replace(/^\/|\/$/g, "");
  const host = `${bucket}.${endpoint.host}`;

  const sha256 = (d: Buffer | string) => crypto.createHash("sha256").update(d).digest("hex");
  const hmac = (k: Buffer | string, d: string) => crypto.createHmac("sha256", k).update(d).digest();

  async function request(method: "PUT" | "GET" | "DELETE", key: string, body?: Buffer, contentType?: string) {
    const objectPath = "/" + [prefix, key].filter(Boolean).join("/").split("/").map(encodeURIComponent).join("/");
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const date = amzDate.slice(0, 8);
    const payloadHash = sha256(body ?? "");
    const headers: Record<string, string> = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
    if (body) {
      headers["content-type"] = contentType || "application/octet-stream";
      headers["x-amz-acl"] = "private";
    }
    const names = Object.keys(headers).sort();
    const canonical = [method, objectPath, "", names.map((n) => `${n}:${headers[n]}\n`).join(""), names.join(";"), payloadHash].join("\n");
    const scope = `${date}/${region}/s3/aws4_request`;
    const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, date), region), "s3"), "aws4_request");
    const signature = crypto.createHmac("sha256", signingKey).update(toSign).digest("hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`;
    delete headers.host; // fetch sets it from the URL
    return fetch(`https://${host}${objectPath}`, { method, headers, body: body ? new Uint8Array(body) : undefined });
  }

  return {
    async put(key, data, contentType) {
      const res = await request("PUT", key, data, contentType);
      if (!res.ok) throw new Error(`Storage upload failed: ${res.status} ${await res.text()}`);
    },
    async get(key) {
      const res = await request("GET", key);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Storage read failed: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
    async remove(key) {
      const res = await request("DELETE", key);
      if (!res.ok && res.status !== 404) throw new Error(`Storage delete failed: ${res.status}`);
    },
  };
}

const driver: Driver = process.env.S3_BUCKET ? s3Driver() : disk;

export const storage = {
  async put(data: Buffer, ext = "jpg"): Promise<string> {
    const d = new Date();
    const key = `photos/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${ext}`;
    await driver.put(key, data, ext === "jpg" ? "image/jpeg" : "application/octet-stream");
    return key;
  },
  get: (key: string) => driver.get(key),
  remove: (key: string) => driver.remove(key),
};
