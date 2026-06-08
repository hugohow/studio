export default function manifest() {
  return {
    name: "Studio Tonight",
    short_name: "Studio Tonight",
    description:
      "Créneaux libres en temps réel des studios de répétition à Paris (Wacked Live, Studio Bleu, HBS, FGO-Barbara).",
    start_url: "/",
    display: "standalone",
    lang: "fr-FR",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [{ src: "/icon.svg", type: "image/svg+xml", sizes: "any" }],
  };
}
