const SITE_URL = process.env.SITE_URL || "https://studiotonight.vercel.app";

// robots.txt : on autorise l'indexation complète et on pointe vers le sitemap,
// pour que « Studio Tonight » soit bien référencé.
export default function robots() {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
