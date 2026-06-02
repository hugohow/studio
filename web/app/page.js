import fs from "node:fs";
import path from "node:path";
import Explorer from "./Explorer";

// ISR : la page se régénère au plus toutes les 10 min (le cron GitHub Actions
// rafraîchit le feed plus souvent ; on relit la version à jour côté Vercel).
export const revalidate = 600;

async function loadFeed() {
  // Prod (Vercel) : on lit le feed publié par le cron via son URL raw GitHub.
  const url = process.env.FEED_URL;
  if (url) {
    try {
      const r = await fetch(url, { next: { revalidate: 600 } });
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

export default async function Page() {
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

  return <Explorer feed={feed} />;
}
