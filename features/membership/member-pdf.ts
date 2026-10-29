import { formatDateId } from "@/lib/format";
import type { MemberCard } from "./validation";

// The PDF can't use the app's CSS tokens, so these are RGB approximations of
// the navy/orange placeholder brand in app/globals.css.
const NAVY: [number, number, number] = [17, 24, 49];
const ORANGE: [number, number, number] = [245, 140, 60];
const LIGHT: [number, number, number] = [245, 246, 250];

// Centre-crops to a square so the photo is never stretched in the PDF.
async function squarePhotoDataUrl(photoPath: string): Promise<string> {
  const res = await fetch(`/api/uploads/${photoPath}`);
  if (!res.ok) throw new Error("photo fetch failed");
  const bitmap = await createImageBitmap(await res.blob());
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(side, 600);
    canvas
      .getContext("2d")!
      .drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    return canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    bitmap.close();
  }
}

export async function downloadMemberPdf(card: MemberCard): Promise<void> {
  const [{ default: jsPDF }, { default: QRCode }] = await Promise.all([
    import("jspdf"),
    import("qrcode"),
  ]);
  const [photo, qr] = await Promise.all([
    squarePhotoDataUrl(card.photoPath),
    // Black on white with a 4-module quiet zone, even on the dark card: scanners need the contrast.
    QRCode.toDataURL(card.qrToken, {
      errorCorrectionLevel: "M",
      margin: 4,
      width: 800,
      color: { dark: "#000000", light: "#ffffff" },
    }),
  ]);

  const pdf = new jsPDF({ unit: "mm", format: [90, 160], orientation: "portrait" });
  const centre = 45;

  pdf.setFillColor(...NAVY);
  pdf.rect(0, 0, 90, 160, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(...ORANGE);
  pdf.text("MASTER GYM", centre, 12, { align: "center" });

  // Shrink the name to one line; only if it still doesn't fit at the floor, wrap
  // (max 3 lines) and shrink the photo so everything below, QR included, stays put.
  // shortcut: built-in Helvetica only renders Latin-1 names, embed a font if non-Latin names appear.
  pdf.setTextColor(...LIGHT);
  let nameSize = 16;
  pdf.setFontSize(nameSize);
  while (pdf.getTextWidth(card.name) > 80 && nameSize > 10) pdf.setFontSize(--nameSize);
  const nameLines: string[] = pdf.splitTextToSize(card.name, 80).slice(0, 3);
  const shift = (nameLines.length - 1) * 4.5;
  const photoSize = 40 - shift;
  pdf.addImage(photo, "JPEG", centre - photoSize / 2, 18, photoSize, photoSize, undefined, "FAST");
  nameLines.forEach((line, i) =>
    pdf.text(line, centre, 67 - shift + i * 4.5, { align: "center" }),
  );
  pdf.setFontSize(13);
  pdf.setTextColor(...ORANGE);
  pdf.text(card.memberNo, centre, 74, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(...LIGHT);
  pdf.text(card.phone, centre, 80, { align: "center" });
  pdf.text(`Berlaku s/d ${formatDateId(card.endDate)}`, centre, 86, { align: "center" });

  // 66mm white panel holding a 62mm QR (the image includes its own quiet zone).
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(12, 91, 66, 66, 2, 2, "F");
  // FAST deflates the 800px QR PNG; lossless, so the code stays crisp.
  pdf.addImage(qr, "PNG", 14, 93, 62, 62, undefined, "FAST");

  const safeName = card.name.replace(/[^A-Za-z0-9 -]/g, "").trim();
  pdf.save(`${card.memberNo}-${safeName}.pdf`);
}
