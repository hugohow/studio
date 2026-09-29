// Adaptateur Studio Bleu — site « 10ème Musique » (sites=1).
// API JSON publique (back Next.js séparé) reverse-engineerée :
//   GET /rooms                              -> inventaire + fiches (toutes salles, tous sites)
//   GET /rooms/public-search?day=&site_ids[]=1&duration=<min>
//       -> 1 requête = 1 jour pour TOUTES les salles du site, chacune avec `reservations[]`
//          (mêmes tranches de 30 min que /reservations/daily?date=&roomId=, vérifié identique).
//          Ne renvoie que les salles ayant au moins un bloc libre de `duration` minutes :
//          une salle absente = aucun créneau ce jour-là.
// La dispo se déduit des tranches `status:"free"` (vs "reserved" ; type "closeHour" = hors horaires).
// ⚠️ Rate limit (constaté le 29/09/2026) : ~30 requêtes en rafale puis 429 pendant plusieurs secondes.
//   D'où public-search (1 req/jour au lieu de 1 req/jour/salle ≈ 900/run) + requêtes séquentielles
//   avec nouvelle tentative sur 429.
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

const RETRY_WAIT_MS = 10000; // attente après un 429 avant de retenter
const MAX_RETRIES = 12; // ~2 min max par requête avant d'abandonner le jour
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

// Fiche descriptive d'une salle depuis /rooms (surface, capacité, équipements) — sans les prix.
// "(P.A)" dans le nom = salle équipée d'une sono de façade.
function roomInfo(room) {
  const hasPA = /\(P\.?A\)/i.test(room.name || "");
  const parts = [];
  if (room.size) parts.push(`${room.size} m²`);
  if (room.max_people) parts.push(`jusqu'à ${room.max_people} pers.`);
  if (hasPA) parts.push("sono P.A");
  const equipment = [];
  if (hasPA) equipment.push("Sono de façade (P.A)");
  if (room.mirrors) equipment.push("Miroirs");
  if (room.curtains) equipment.push("Rideaux");
  if (room.to_know?.trim()) equipment.push(room.to_know.trim());
  return { emoji: "🎸", description: parts.join(" · ") || undefined, equipment };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GET JSON avec nouvelle tentative sur 429 (rate limit de l'API).
async function getJSON(url) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (r.status === 429 && attempt < MAX_RETRIES) {
      await r.arrayBuffer();
      await sleep(RETRY_WAIT_MS);
      continue;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
    return r.json();
  }
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

// Interface commune des adaptateurs (cf. wacked.js).
export async function fetchAvailability({ durationH = 1, monthsLoad = 2 } = {}) {
  // Studio Bleu refuse les résas < 2h : on ne surface que des créneaux où 2h sont libres.
  const effDurationH = Math.max(durationH, MIN_DURATION_H);
  const allRooms = await getJSON(`${API}/rooms`);
  const rooms = (allRooms || []).filter(
    (r) => r.site?.id === SITE_ID && r.internet_visibility
  );
  const daysCap = Math.max(...rooms.map((r) => r.days_visible || 60));
  const dates = dateRange(monthsLoad, daysCap);

  // Séquentiel (rate limit) : 1 requête par jour pour toutes les salles du site.
  const perDay = new Map(); // date -> Map(roomId -> reservations[]) | null si erreur
  let lastError = null;
  for (const date of dates) {
    try {
      const found = await getJSON(
        `${API}/rooms/public-search?fromFrontend=true&day=${date}&site_ids[]=${SITE_ID}&duration=${effDurationH * 60}`
      );
      perDay.set(date, new Map((found || []).map((r) => [r.id, r.reservations])));
    } catch (e) {
      lastError = String(e.message || e);
      perDay.set(date, null); // jour en erreur -> ignoré
    }
  }
  const okDays = [...perDay.values()].filter(Boolean).length;

  const studios = rooms.map((room) => {
    const days = {};
    dates.slice(0, room.days_visible || 60).forEach((date) => {
      const reservations = perDay.get(date)?.get(room.id);
      if (!reservations) return; // jour en erreur, ou salle sans bloc libre ce jour-là
      const starts = freeStarts(reservations, effDurationH);
      if (starts.length) days[date] = starts.map((time) => ({ time }));
    });
    // Lien profond vers la page de réservation de cette salle.
    const url = `https://reservation.studiobleu.com/studios/${room.id}`;
    // 0 jour exploitable = tout a échoué (ex. blocage UA du 26/06/2026, rate limit) :
    // on le signale au lieu de publier silencieusement des salles vides.
    if (!okDays && lastError) return { studio: room.name, url, ...roomInfo(room), error: lastError, days };
    return { studio: room.name, url, ...roomInfo(room), days };
  });
  if (lastError) {
    console.error(`[studiobleu] ${dates.length - okDays}/${dates.length} jour(s) en erreur (${lastError})`);
  }

  return { id: VENUE.id, name: VENUE.name, address: VENUE.address, url: VENUE.url, durationH: effDurationH, studios };
}

export const meta = VENUE;
