// Registre des adaptateurs de salles. Pour ajouter une salle :
// créer src/adapters/<salle>.js exportant fetchAvailability({durationH,monthsLoad}) + meta,
// puis l'importer ici et l'ajouter au tableau ADAPTERS.

import * as wacked from "./wacked.js";
import * as studiobleu from "./studiobleu.js";
import * as hbs from "./hbs.js";

export const ADAPTERS = [wacked, studiobleu, hbs];

// Date + heure courantes en heure de Paris : { date: "YYYY-MM-DD", time: "HH:MM" }.
function parisNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

// Ne garde que les créneaux à venir : supprime les jours passés et, pour aujourd'hui,
// les heures déjà écoulées. Mutation en place de l'objet normalisé.
function dropPast(venues) {
  const now = parisNow();
  for (const v of venues) {
    for (const s of v.studios || []) {
      if (!s.days) continue;
      for (const date of Object.keys(s.days)) {
        if (date < now.date) {
          delete s.days[date];
        } else if (date === now.date) {
          s.days[date] = s.days[date].filter((slot) => slot.time >= now.time);
          if (!s.days[date].length) delete s.days[date];
        }
      }
    }
  }
  return venues;
}

// Récupère les dispos de toutes les salles sur l'horizon donné.
// Renvoie un tableau d'objets-salle normalisés (une salle en erreur n'interrompt pas les autres).
// Les créneaux déjà passés (heure de Paris) sont retirés.
export async function fetchAll({ durationH = 1, monthsLoad = 2 } = {}) {
  const venues = await Promise.all(
    ADAPTERS.map((a) =>
      a.fetchAvailability({ durationH, monthsLoad }).catch((e) => ({
        id: a.meta?.id,
        name: a.meta?.name,
        error: String(e.message || e),
        studios: [],
      }))
    )
  );
  return dropPast(venues);
}
