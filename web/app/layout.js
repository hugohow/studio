import "./globals.css";

// Marque = « Studio Tonight » (deux mots) : c'est le mot-clé sur lequel on veut être référencé.
// On le garde tel quel dans le <title>, l'OG, le siteName et le JSON-LD pour que les moteurs
// l'associent au site (le domaine studiotonight reste l'alternateName / one-word).
const BRAND = "Studio Tonight";
const TITLE = "Studio Tonight — créneaux libres des studios de répétition à Paris";
const DESC =
  "Studio Tonight : voir en temps réel les créneaux libres des studios de répétition à Paris (Wacked Live, Studio Bleu, HBS, FGO-Barbara).";
const SITE_URL = process.env.SITE_URL || "https://studiotonight.vercel.app";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: BRAND,
  title: { default: TITLE, template: `%s · ${BRAND}` },
  description: DESC,
  keywords: [
    "Studio Tonight",
    "StudioTonight",
    "studio de répétition Paris",
    "créneaux studio répétition",
    "réserver studio répétition",
    "studio répétition disponibilité",
    "Wacked Live",
    "Studio Bleu",
    "Studio HBS",
    "FGO-Barbara",
  ],
  alternates: { canonical: "/" },
  // Renseigner GOOGLE_SITE_VERIFICATION (Vercel) avec le code fourni par Search Console
  // pour prouver la propriété du site et lancer l'indexation.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "/",
    siteName: BRAND,
    locale: "fr_FR",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Studio Tonight — créneaux libres des studios de répétition à Paris" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    images: ["/og.jpg"],
  },
};

export const viewport = {
  themeColor: "#2563eb",
};

// Données structurées : aide les moteurs à comprendre que la marque est « Studio Tonight ».
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: BRAND,
  alternateName: "StudioTonight",
  url: SITE_URL,
  description: DESC,
  inLanguage: "fr-FR",
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/?date={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
      </body>
    </html>
  );
}
