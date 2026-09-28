"use client";
// Resizes camera photos (~1600 px, JPEG) and burns in a time/location stamp,
// so an old photo can't be passed off as today's.

const MAX_SIDE = 1600;
const MAX_AGE_MS = 10 * 60 * 1000;

export class PhotoRejected extends Error {}

export async function processPhoto(file: File, stamp: string[], allowOld = false): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new PhotoRejected("That file isn't a photo.");
  if (!allowOld && file.lastModified && Date.now() - file.lastModified > MAX_AGE_MS) {
    throw new PhotoRejected("Photos must be taken live with the camera — gallery photos aren't accepted.");
  }

  const bmp = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);

  const fs = Math.max(14, Math.round(w / 45));
  const lineH = fs * 1.35;
  const boxH = lineH * stamp.length + fs * 0.8;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, h - boxH, w, boxH);
  ctx.fillStyle = "#fff";
  ctx.font = `600 ${fs}px -apple-system, system-ui, sans-serif`;
  ctx.textBaseline = "top";
  stamp.forEach((line, i) => ctx.fillText(line, fs * 0.6, h - boxH + fs * 0.4 + i * lineH));

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process photo"))), "image/jpeg", 0.78),
  );
}

async function loadImage(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    } catch {
      /* fall through */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
