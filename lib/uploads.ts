import "server-only";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// Overridable so Docker can mount a volume here; local folder for `npm run dev`.
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), "uploads");

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const EXT_TO_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_TO_EXT).map(([mime, ext]) => [ext, mime]),
);

// Defensive only: the Server Action body limit (1MB default) is the real cap, and
// webcam photos are ~100-300KB, so this rarely if ever triggers.
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

// Stores a base64 data URL as UPLOADS_DIR/<subfolder>/<uuid>.<ext> and returns
// the relative path for the DB column (not the data URL, to keep rows small).
export async function saveBase64Upload(
  dataUrl: string,
  subfolder: string,
): Promise<string> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Format foto tidak valid.");
  const [, mime, base64] = match;
  const ext = MIME_TO_EXT[mime];
  if (!ext) throw new Error("Tipe foto tidak didukung.");

  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("Ukuran foto maksimal 2MB.");
  }

  const filename = `${randomUUID()}.${ext}`;
  const dir = path.join(UPLOADS_DIR, subfolder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(/* turbopackIgnore: true */ dir, filename), buffer);

  return `${subfolder}/${filename}`;
}

export async function readUpload(relativePath: string): Promise<Buffer> {
  const resolved = path.normalize(path.join(UPLOADS_DIR, relativePath));
  if (!resolved.startsWith(path.normalize(UPLOADS_DIR + path.sep))) {
    throw new Error("Path tidak valid.");
  }
  return readFile(resolved);
}
