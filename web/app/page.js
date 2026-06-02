import fs from "node:fs";
import path from "node:path";
import Explorer from "./Explorer";

// On relit le feed au plus toutes les 60 s (le cron GitHub Actions le rafraîchit ;
// 60 s garde le site quasi à jour sans marteler l'API GitHub).
export const revalidate = 60;

async function loadFeed() {
  // Prod (Vercel) : feed publié par le cron, lu via l'API GitHub (repo privé).
  // FEED_URL = https://api.github.com/repos/<owner>/<repo>/contents/data/slots.json?ref=main
  // FEED_TOKEN = PAT GitHub fine-grained, lecture seule "Contents" sur ce repo.
  const url = process.env.FEED_URL;
  const token = process.env.FEED_TOKEN;
  if (url) {
    try {
      const headers = { "User-Agent": "studiotonight" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        headers.Accept = "application/vnd.github.raw"; // renvoie le contenu brut du fichier
      }
      const r = await fetch(url, { headers, next: { revalidate: 60 } });
      if (!r.ok) return { error: `HTTP ${r.status} sur FEED_URL` };
      return await r.json();
    } catch (e) {
      return { error: String(e.message || e) };
    }
  }
  // Dev local : fichier généré par `node bin/fetch-slots.js --out data/slots.json`.
  try {
    const p = path.join(process.cwd(), "..", "data", "slots.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

export default async function Page({ searchParams }) {
  const feed = await loadFeed();

  if (feed.error) {
    return (
      <main>
        <h1>StudioTonight</h1>
        <p className="sub">
          Impossible de charger le feed : {feed.error}.
          <br />
          En local, génère-le : <code>node bin/fetch-slots.js --out data/slots.json --months 1</code>
          <br />
          En prod, vérifie la variable d&apos;env <code>FEED_URL</code> (URL raw GitHub de <code>data/slots.json</code>).
        </p>
      </main>
    );
  }

  return (
    <Explorer feed={feed} initialDate={searchParams?.date || ""} initialTime={searchParams?.time || ""} />
  );
}
