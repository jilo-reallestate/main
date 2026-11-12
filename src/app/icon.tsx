import { ImageResponse } from "next/og";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";
export default function Icon() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0B0D0E", color: "#C9A66B", fontSize: 44, fontWeight: 700, borderRadius: 14 }}>J</div>, size);
}
