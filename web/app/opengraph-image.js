import { ImageResponse } from "next/og";

// Image de partage (WhatsApp, iMessage, Twitter…) générée à la volée. 1200×630.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "StudioTonight — créneaux libres des studios de répétition à Paris";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "90px",
          background: "#f5f7fa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#2563eb" }}>StudioTonight</div>
        <div
          style={{
            display: "flex",
            fontSize: 66,
            fontWeight: 800,
            color: "#1b2330",
            marginTop: 28,
            lineHeight: 1.1,
          }}
        >
          Trouve un studio de répét&apos; libre
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "#6b7687", marginTop: 28 }}>
          Créneaux dispo · studios de répétition du nord-est parisien
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#6b7687", marginTop: 48 }}>by Hugo How-Choong</div>
        <div style={{ position: "absolute", bottom: 0, left: 0, height: 16, width: "100%", background: "#2563eb" }} />
      </div>
    ),
    { ...size }
  );
}
