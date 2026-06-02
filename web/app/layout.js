import "./globals.css";

const TITLE = "StudioTonight";
const DESC = "Les créneaux dispo des studios de répétition du nord-est parisien";

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
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
