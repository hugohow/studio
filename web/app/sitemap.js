const SITE_URL = process.env.SITE_URL || "https://studiotonight.fr";

export default function sitemap() {
  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "hourly",
      priority: 1,
    },
  ];
}
