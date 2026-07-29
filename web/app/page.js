import fs from "node:fs";
import path from "node:path";
import { headers } from "next/headers";
import Explorer from "./Explorer";

// On relit le feed au plus toutes les 60 s (le cron GitHub Actions le rafraîchit ;
// 60 s garde le site quasi à jour sans marteler l'API GitHub).
export const revalidate = 60;

async function loadFeed() {
  // Prod (Vercel) : feed publié par le cron, lu via l'API GitHub (repo privé).
  // FEED_URL = https://api.github.com/repos/<owner>/<repo>/contents/data/slots.json?ref=data
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

// Rafraîchissement "à la visite" : si le feed est vieux, on déclenche le workflow GitHub
// (qui régénère data/slots.json). Pas de scheduler ; la fraîcheur suit le trafic.
let lastDispatchAt = 0; // debounce par instance serverless (évite les déclenchements en rafale)

async function maybeRefresh(generatedAt) {
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token || !generatedAt) return;
  const ageMin = (Date.now() - new Date(generatedAt).getTime()) / 60000;
  if (ageMin < 15) return; // assez frais
  if (Date.now() - lastDispatchAt < 5 * 60 * 1000) return; // déjà déclenché récemment
  lastDispatchAt = Date.now();
  try {
    await fetch("https://api.github.com/repos/hugohow/studio/actions/workflows/refresh.yml/dispatches", {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "studiotonight",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    });
  } catch {
    /* best-effort : on n'empêche pas le rendu si le déclenchement échoue */
  }
}

export default async function Page({ searchParams }) {
  const feed = await loadFeed();

  if (feed.error) {
    return (
      <main>
        <h1>Studio Tonight</h1>
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

  await maybeRefresh(feed.generatedAt);

  const from = searchParams?.from ? Number(searchParams.from) : undefined;
  const to = searchParams?.to ? Number(searchParams.to) : undefined;

  // Détection mobile par user-agent (et non par largeur) : un pliant déplié reste un mobile tactile.
  const ua = headers().get("user-agent") || "";
  const isMobile = /Android|iPhone|iPad|iPod|Mobile|Windows Phone|webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua);

  return (
    <Explorer
      feed={feed}
      initialDate={searchParams?.date || ""}
      initialFrom={from}
      initialTo={to}
      isMobile={isMobile}
    />
  );
}
