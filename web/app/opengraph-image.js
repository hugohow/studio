import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Image de partage (WhatsApp, iMessage, Twitter…) générée à la volée. 1200×630.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "StudioTonight — créneaux libres des studios de répétition à Paris";

export default async function OpengraphImage() {
  // Photo de studio (Unsplash, usage commercial libre) embarquée dans l'app.
  const bg =
    "data:image/jpeg;base64," +
    readFileSync(join(process.cwd(), "app", "studio-og.jpg")).toString("base64");

  return new ImageResponse(
    (
      <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", fontFamily: "sans-serif" }}>
        <img
          src={bg}
          width={1200}
          height={630}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        {/* Dégradé sombre pour la lisibilité du texte */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(90deg, rgba(8,10,15,0.94) 0%, rgba(8,10,15,0.78) 45%, rgba(8,10,15,0.25) 100%)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "90px",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", fontSize: 42, fontWeight: 700, color: "#7eb0ff" }}>🎸 StudioTonight</div>
          <div
            style={{
              display: "flex",
              fontSize: 70,
              fontWeight: 800,
              color: "#ffffff",
              marginTop: 26,
              lineHeight: 1.05,
              maxWidth: 760,
            }}
          >
            Voir directement les créneaux dispo
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#c2cad6", marginTop: 30 }}>
            Studios de répétition · nord-est parisien
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#8b94a3", marginTop: 44 }}>by Hugo How-Choong</div>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, height: 16, width: "100%", background: "#2563eb" }} />
      </div>
    ),
    { ...size }
  );
}
