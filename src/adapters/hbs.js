// Adaptateur Studio HBS — hébergé sur QuickStudio. Toute la logique vit dans `quickstudio.js`.
import { makeQuickStudio } from "./quickstudio.js";

const adapter = makeQuickStudio({
  id: "hbs",
  name: "Studio HBS",
  address: "29 rue des Petites Écuries, 75010 Paris",
  slug: "studio-hbs",
  // Photos par catégorie de salle (site studiohbs.com/hbs_ecuries.html ; noms de fichiers décalés
  // par rapport aux catégories, vérifié visuellement : grand2 = Grand, grand = Standard, standard = Petit…).
  photos: [
    { match: /^grand studio/i, photos: ["http://www.studiohbs.com/img/grand2_hbs.jpg"] },
    { match: /^studio standard/i, photos: ["http://www.studiohbs.com/img/grand_hbs.jpg"] },
    { match: /^petit studio/i, photos: ["http://www.studiohbs.com/img/standard_hbs.jpg"] },
    { match: /^mini studio/i, photos: ["http://www.studiohbs.com/img/petit_hbs.jpg"] },
    { match: /^box/i, photos: ["http://www.studiohbs.com/img/solo_hbs.jpg"] },
  ],
});

export const meta = adapter.meta;
export const fetchAvailability = adapter.fetchAvailability;
