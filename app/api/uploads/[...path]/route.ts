import { NextResponse } from "next/server";
import path from "path";
import { requireRole } from "@/lib/auth/dal";
import { EXT_TO_MIME, readUpload } from "@/lib/uploads";

// Member photos are served here behind auth, not from `public/`, because they
// must not be world-readable and `public/` is baked in at build time.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  await requireRole("kasir");

  const { path: segments } = await params;
  const relativePath = segments.join("/");
  const mime = EXT_TO_MIME[path.extname(relativePath).slice(1).toLowerCase()];
  if (!mime) {
    return NextResponse.json({ message: "Tidak ditemukan." }, { status: 404 });
  }

  try {
    const file = await readUpload(relativePath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ message: "Tidak ditemukan." }, { status: 404 });
  }
}
