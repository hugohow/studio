// Adaptateur L'Intervalle (Paris 11).
// Site = page statique Vercel ; les dispos viennent d'une fonction serverless qui lit
// l'agenda Google Calendar de chaque salle :
//   GET /api/availability?studio=<id>&date=YYYY-MM-DD  -> { busyHours: [19, 20] }
// L'API ne renvoie que les heures OCCUPÉES ; les horaires d'ouverture sont appliqués côté
// client (JS de la page) → répliqués ici dans openHours(). Lecture seule, aucune réservation.

import { USER_AGENT } from "./http.js";

const API = "https://studios.lintervalle-studios.com/api/availability";

const VENUE = {
  id: "lintervalle",
  name: "L'Intervalle",
  address: "112 rue du Chemin Vert, 75011 Paris",
  url: "https://studios.lintervalle-studios.com/",
};

// Ids = ceux du tableau STUDIOS de la page (le nom affiché diffère pour les cabines).
// description / equipment : fiche de la salle recopiée depuis la page (sans les prix).
const CABINE_EQUIP = [
  "Piano numérique Yamaha P225",
  "Micros Shure SM58",
  "Enceintes de monitoring KRK Rokit RP7 G5",
  "Table de mixage Yamaha MG10",
];
const STUDIOS = [
  {
    id: "grand-studio",
    name: "Grand Studio",
    description: "35 m² · jusqu'à 8 pers. · batterie",
    equipment: [
      'Batterie Mapex Comet Pro Pack 18"',
      "Amplis guitare Boss Katana 50 Gen 3 et Roland Blues Cube Stage",
      "Ampli basse Mark Bass CMB 121",
      "Piano numérique Yamaha P225",
      "Table de mixage Yamaha MG16XU, micros Shure SM58, enceintes",
    ],
  },
  {
    id: "studio-b",
    name: "Studio B",
    description: "15 m² · jusqu'à 6 pers. · batterie",
    equipment: [
      'Batterie Mapex Comet Pro Pack 18"',
      "Amplis guitare Boss Katana 50 Gen 3 et Peavey Bandit 112",
      "Ampli basse Mark Bass CMB 121",
      "Piano numérique Yamaha P225",
      "Table de mixage Yamaha MG12XU, micros Shure SM58, enceintes",
    ],
  },
  {
    id: "studio-c",
    name: "Studio C",
    description: "13 m² · jusqu'à 5 pers. · batterie",
    equipment: [
      'Batterie Mapex Comet Pro Pack 18"',
      "Amplis guitare Boss Katana 50 Gen 3 et Orange Crush CR60",
      "Ampli basse Mark Bass CMB 121",
      "Piano numérique Yamaha P225",
      "Table de mixage Yamaha MG12XU, micros Shure SM58, enceintes",
    ],
  },
  {
    id: "cabine-piano",
    name: "Cabine 1",
    description: "8 m² · jusqu'à 3 pers. · sans batterie",
    equipment: CABINE_EQUIP,
  },
  {
    id: "cabine-chant",
    name: "Cabine 2",
    description: "8 m² · jusqu'à 3 pers. · sans batterie",
    equipment: CABINE_EQUIP,
  },
];

const MAX_CONCURRENCY = 6; // 5 salles × ~60 jours ≈ 300 requêtes/run

// Horaires d'ouverture (copiés de getHoursForDay() sur la page) : pas horaire, 10h-22h.
// Les cours bloquent le soir : Grand Studio 17h-22h lun-mer ; autres salles 18h-22h lun-jeu.
// Renvoie les heures de début possibles et l'heure de fermeture.
function openHours(date, studioId) {
  const day = new Date(`${date}T12:00:00`).getDay(); // 0 = dimanche
  let close = 22;
  if (studioId === "grand-studio" && day >= 1 && day <= 3) close = 17;
  else if (studioId !== "grand-studio" && day >= 1 && day <= 4) close = 18;
  const hours = [];
  for (let h = 10; h < close; h++) hours.push(h);
  return { hours, close };
}

// Heures de début où `durationH` heures consécutives sont ouvertes et libres.
function freeStarts(date, studioId, busyHours, durationH) {
  const busy = new Set(busyHours || []);
  const { hours, close } = openHours(date, studioId);
  const starts = [];
  for (const h of hours) {
    if (h + durationH > close) break;
    let ok = true;
    for (let i = 0; i < durationH; i++) {
      if (busy.has(h + i)) { ok = false; break; }
    }
    if (ok) starts.push(`${String(h).padStart(2, "0")}:00`);
  }
  return starts;
}

async function getJSON(url) {
  const r = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
  return r.json();
}

// Dates "YYYY-MM-DD" de aujourd'hui jusqu'à +monthsLoad mois.
function dateRange(monthsLoad) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getFullYear(), start.getMonth() + monthsLoad, start.getDate());
  const dates = [];
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

// Exécute des tâches avec une concurrence bornée.
async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

// Interface commune des adaptateurs (cf. wacked.js).
export async function fetchAvailability({ durationH = 1, monthsLoad = 2 } = {}) {
  const effDurationH = Math.ceil(durationH); // réservation à l'heure pleine uniquement
  const dates = dateRange(monthsLoad);
  const jobs = STUDIOS.flatMap((s) => dates.map((date) => ({ s, date })));

  let lastError = null;
  const results = await pool(jobs, MAX_CONCURRENCY, async ({ s, date }) => {
    try {
      const j = await getJSON(`${API}?studio=${encodeURIComponent(s.id)}&date=${date}`);
      return { s, date, starts: freeStarts(date, s.id, j?.busyHours, effDurationH) };
    } catch (e) {
      lastError = String(e.message || e);
      return { s, date, starts: null }; // jour en erreur -> ignoré
    }
  });

  const studios = STUDIOS.map((s) => {
    const info = { description: s.description, equipment: s.equipment };
    const mine = results.filter((r) => r.s === s);
    const days = {};
    for (const { date, starts } of mine) {
      if (starts?.length) days[date] = starts.map((time) => ({ time }));
    }
    // 0 jour exploitable = la salle entière a échoué : on le signale au lieu d'une salle vide.
    if (!mine.some((r) => r.starts) && lastError) {
      console.error(`[lintervalle] ${s.name}: tous les jours en erreur (${lastError})`);
      return { studio: s.name, url: VENUE.url, ...info, error: lastError, days };
    }
    return { studio: s.name, url: VENUE.url, ...info, days };
  });

  return { id: VENUE.id, name: VENUE.name, address: VENUE.address, url: VENUE.url, durationH: effDurationH, studios };
}

export const meta = VENUE;
