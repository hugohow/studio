export default function manifest() {
  return {
    name: "Studio Tonight",
    short_name: "StudioTonight", // nom sous l'icône (un mot : pas tronqué sur iOS)
    description:
      "Créneaux libres en temps réel des studios de répétition à Paris (Wacked Live, Studio Bleu, HBS, FGO-Barbara).",
    start_url: "/",
    display: "standalone",
    lang: "fr-FR",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icon-192.png", type: "image/png", sizes: "192x192", purpose: "any" },
      { src: "/icon-512.png", type: "image/png", sizes: "512x512", purpose: "any" },
      // Plein cadre, motif dans la zone sûre : Android peut le découper en cercle/squircle.
      { src: "/icon-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
