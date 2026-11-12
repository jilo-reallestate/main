import { ImageResponse } from "next/og";
export const alt = "JILO Real Estate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
/** Default share image (WhatsApp, LinkedIn, X). Latin text only: the built-in font has no Arabic glyphs. Listings and projects use their own photo. */
export default function OgImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 90, background: "linear-gradient(135deg,#0B0D0E 0%,#1c1712 100%)", color: "#fff" }}>
      <div style={{ display: "flex", fontSize: 150, fontWeight: 700, letterSpacing: 12, color: "#C9A66B" }}>JILO</div>
      <div style={{ display: "flex", fontSize: 38, letterSpacing: 10, marginTop: 6, color: "#9BA1A6" }}>REAL ESTATE</div>
      <div style={{ display: "flex", fontSize: 44, marginTop: 56 }}>Dubai · Abu Dhabi · Off-plan</div>
    </div>, size);
}
