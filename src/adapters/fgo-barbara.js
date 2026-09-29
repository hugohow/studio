// Adaptateur FGO-Barbara — hébergé sur QuickStudio. Toute la logique vit dans `quickstudio.js`.
import { makeQuickStudio } from "./quickstudio.js";

const adapter = makeQuickStudio({
  id: "fgo-barbara",
  name: "FGO-Barbara",
  address: "1 rue de Fleury, 75018 Paris",
  slug: "fgo-barbara",
  // Salles de concert, pas des studios de répét -> hors feed.
  excludeRooms: ["Grande Salle", "Petite Salle"],
  // Photos par type de salle (site fgo-barbara.fr/les-studios).
  photos: [
    { match: /^studio [1235]\b/i, photos: ["https://fgo-barbara.fr/sites/default/files/fgosite/ged/studio_5.jpeg"] },
    { match: /^studio 4\b/i, photos: ["https://fgo-barbara.fr/sites/default/files/fgosite/ged/dsc02633.jpg"] },
    { match: /^studio 6\b/i, photos: ["https://fgo-barbara.fr/sites/default/files/fgosite/ged/studio_6.jpg", "https://fgo-barbara.fr/sites/default/files/fgosite/ged/amplis_-_studio_6.png"] },
  ],
});

export const meta = adapter.meta;
export const fetchAvailability = adapter.fetchAvailability;
