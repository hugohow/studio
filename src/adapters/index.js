// Registre des adaptateurs de salles. Pour ajouter une salle :
// créer src/adapters/<salle>.js exportant fetchAvailability({durationH,monthsLoad}) + meta,
// puis l'importer ici et l'ajouter au tableau ADAPTERS.

import * as wacked from "./wacked.js";
import * as studiobleu from "./studiobleu.js";
import * as hbs from "./hbs.js";

export const ADAPTERS = [wacked, studiobleu, hbs];

// Récupère les dispos de toutes les salles sur l'horizon donné.
// Renvoie un tableau d'objets-salle normalisés (une salle en erreur n'interrompt pas les autres).
export async function fetchAll({ durationH = 1, monthsLoad = 2 } = {}) {
  return Promise.all(
    ADAPTERS.map((a) =>
      a.fetchAvailability({ durationH, monthsLoad }).catch((e) => ({
        id: a.meta?.id,
        name: a.meta?.name,
        error: String(e.message || e),
        studios: [],
      }))
    )
  );
}
