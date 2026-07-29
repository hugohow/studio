// Adaptateur Wacked Live (WordPress + plugin Amelia).
// API JSON publique reverse-engineerée — voir ~/.claude/skills/reserver-studio/references/amelia-api.md
// ⚠️ Le `/` de la route /slots ne doit PAS être URL-encodé (sinon 404).

import { USER_AGENT } from "./http.js";

const AJAX = "https://wackedlive.fr/wp-admin/admin-ajax.php?action=wpamelia_api";

const VENUE = {
  id: "wacked",
  name: "Wacked Live",
  address: "32 bd Sébastopol, 75003 Paris",
  url: "https://wackedlive.fr/index.php/reservation/",
};

// serviceIdsByDuration : id du service Amelia selon la durée (en heures)
// providerIds : { avant18h, apres18h } — les deux providers à interroger pour avoir tous les créneaux
const STUDIOS = {
  "Studio 1": {
    serviceIdsByDuration: { 1: 1, 2: 4, 3: 7, 4: 10, 5: 13, 6: 16, 7: 27, 8: 28 },
    providerIds: { avant18h: 45, apres18h: 41 },
  },
  "Studio 2": {
    serviceIdsByDuration: { 1: 2, 2: 5, 3: 8, 4: 11, 5: 14, 6: 17, 7: 21, 8: 29 },
    providerIds: { avant18h: 18, apres18h: 1 },
  },
  "Studio 3": {
    serviceIdsByDuration: { 1: 3, 2: 6, 3: 9, 4: 12, 5: 15, 6: 18, 7: 19, 8: 20 },
    providerIds: { avant18h: 17, apres18h: 8 },
  },
};

async function fetchSlots(studio, durationH, monthsLoad) {
  const serviceId = studio.serviceIdsByDuration[durationH];
  if (!serviceId) throw new Error("Durée non supportée: " + durationH + "h");
  const providerIds = `${studio.providerIds.avant18h},${studio.providerIds.apres18h}`;
  const url =
    `${AJAX}&call=/slots&monthsLoad=${monthsLoad}` +
    `&serviceId=${serviceId}&serviceDuration=${durationH * 3600}` +
    `&providerIds=${providerIds}&group=1&page=booking&structured=true&persons=1`;
  const r = await fetch(url, {
    headers: { "X-Requested-With": "XMLHttpRequest", "User-Agent": USER_AGENT },
  });
  if (!r.ok) throw new Error(`slots HTTP ${r.status}`);
  const j = await r.json();
  return (j && j.data && j.data.slots) || {};
}

// Interface commune des adaptateurs.
// fetchAvailability({ durationH, monthsLoad }) -> objet salle normalisé :
//   { id, name, address, url, durationH, studios: [{ studio, days: { "YYYY-MM-DD": [{time}] } }] }
export async function fetchAvailability({ durationH = 1, monthsLoad = 2 } = {}) {
  const studios = await Promise.all(
    Object.entries(STUDIOS).map(async ([studioName, studio]) => {
      let slots;
      try {
        slots = await fetchSlots(studio, durationH, monthsLoad);
      } catch (e) {
        return { studio: studioName, error: String(e.message || e), days: {} };
      }
      const days = {};
      for (const date of Object.keys(slots).sort()) {
        days[date] = Object.keys(slots[date])
          .sort()
          .map((time) => ({ time }));
      }
      return { studio: studioName, days };
    })
  );
  return { id: VENUE.id, name: VENUE.name, address: VENUE.address, url: VENUE.url, durationH, studios };
}

export const meta = VENUE;
