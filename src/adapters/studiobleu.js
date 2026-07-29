// Adaptateur Studio Bleu — site « 10ème Musique » (sites=1).
// API JSON publique (back Next.js séparé) reverse-engineerée :
//   GET /rooms                              -> inventaire + tarifs (toutes salles, tous sites)
//   GET /reservations/daily?date=&roomId=   -> tranches de 30 min d'un jour pour une salle
// La dispo se déduit des tranches `status:"free"` (vs "reserved" ; type "closeHour" = hors horaires).
// ⚠️ `date` au format YYYY-MM-DD (un ISO avec Z décale le jour). Lecture seule, aucune réservation.

import { USER_AGENT } from "./http.js";

const API = "https://api.studiobleu.com";
const SITE_ID = 1; // 10ème Musique

const VENUE = {
  id: "studiobleu",
  name: "Studio Bleu — 10ème Musique",
  address: "7/9 rue des Petites Écuries, 75010 Paris",
  url: "https://reservation.studiobleu.com/studios?sites=1",
};

const MAX_CONCURRENCY = 8; // poli avec l'API : ~15 salles × ~60 jours = beaucoup de requêtes
const MIN_DURATION_H = 2; // Studio Bleu impose une réservation de 2h minimum (impossible d'en réserver moins)

// On ne s'engage pas sur le prix (modèle par taille de groupe, variable) : seule la dispo compte.

// "HH:MM" -> minutes depuis minuit
function toMin(hhmm) {
  const [h, m] = String(hhmm).split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

// Règles propres à Studio Bleu sur l'heure de début (durationH = durée effective) :
//  - pas de départ à la demi-heure à partir de 19h (le soir = heures pleines uniquement) ;
//  - aucune réservation ne peut se terminer à 23:00.
function allowedStart(hhmm, durationH) {
  const start = toMin(hhmm);
  if (start % 60 === 30 && start >= 19 * 60) return false; // pas de :30 après 19h
  if (start + durationH * 60 === 23 * 60) return false; // pas de fin à 23:00
  return true;
}

// À partir des tranches de 30 min d'un jour, renvoie les heures de DÉBUT réservables
// pour une durée donnée : il faut `durationH*2` tranches consécutives toutes "free",
// puis on applique les règles propres à Studio Bleu (cf. allowedStart).
function freeStarts(reservations, durationH) {
  const free = new Set(
    (reservations || []).filter((r) => r.status === "free").map((r) => toMin(r.hour))
  );
  const needed = Math.round(durationH * 2); // nb de tranches de 30 min
  const starts = [];
  for (const r of reservations || []) {
    if (r.status !== "free") continue;
    const start = toMin(r.hour);
    let ok = true;
    for (let i = 1; i < needed; i++) {
      if (!free.has(start + i * 30)) { ok = false; break; }
    }
    if (ok && allowedStart(r.hour, durationH)) starts.push(r.hour);
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

// Génère les dates "YYYY-MM-DD" de aujourd'hui jusqu'à +monthsLoad mois, plafonné à daysCap.
function dateRange(monthsLoad, daysCap) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getFullYear(), start.getMonth() + monthsLoad, start.getDate());
  const dates = [];
  for (let d = new Date(start); d < end && dates.length < daysCap; d.setDate(d.getDate() + 1)) {
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
  // Studio Bleu refuse les résas < 2h : on ne surface que des créneaux où 2h sont libres.
  const effDurationH = Math.max(durationH, MIN_DURATION_H);
  const allRooms = await getJSON(`${API}/rooms`);
  const rooms = (allRooms || []).filter(
    (r) => r.site?.id === SITE_ID && r.internet_visibility
  );

  const studios = await Promise.all(
    rooms.map(async (room) => {
      const dates = dateRange(monthsLoad, room.days_visible || 60);

      let lastError = null;
      const perDay = await pool(dates, MAX_CONCURRENCY, async (date) => {
        try {
          const j = await getJSON(`${API}/reservations/daily?date=${date}&roomId=${room.id}`);
          return [date, freeStarts(j?.reservations, effDurationH)];
        } catch (e) {
          lastError = String(e.message || e);
          return [date, null]; // jour en erreur -> ignoré
        }
      });

      const days = {};
      let okDays = 0;
      for (const [date, starts] of perDay) {
        if (!starts) continue;
        okDays++;
        if (!starts.length) continue;
        days[date] = starts.map((time) => ({ time }));
      }
      // Lien profond vers la page de réservation de cette salle.
      const url = `https://reservation.studiobleu.com/studios/${room.id}`;
      // 0 jour exploitable = la salle entière a échoué (ex. blocage UA du 26/06/2026) :
      // on le signale au lieu de publier silencieusement une salle vide.
      if (!okDays && lastError) {
        console.error(`[studiobleu] ${room.name}: tous les jours en erreur (${lastError})`);
        return { studio: room.name, url, error: lastError, days };
      }
      return { studio: room.name, url, days };
    })
  );

  return { id: VENUE.id, name: VENUE.name, address: VENUE.address, url: VENUE.url, durationH: effDurationH, studios };
}

export const meta = VENUE;
