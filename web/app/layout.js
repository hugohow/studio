import "./globals.css";

const TITLE = "🎸 StudioTonight";
const DESC = "Voir directement les créneaux dispo";

export const metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://studiotonight.vercel.app"),
  title: TITLE,
  description: DESC,
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "/",
    siteName: TITLE,
    locale: "fr_FR",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "StudioTonight — créneaux libres des studios de répétition" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    images: ["/og.jpg"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
