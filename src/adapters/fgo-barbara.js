// Adaptateur FGO-Barbara — hébergé sur QuickStudio. Toute la logique vit dans `quickstudio.js`.
import { makeQuickStudio } from "./quickstudio.js";

const adapter = makeQuickStudio({
  id: "fgo-barbara",
  name: "FGO-Barbara",
  address: "1 rue de Fleury, 75018 Paris",
  slug: "fgo-barbara",
  // Salles de concert, pas des studios de répét -> hors feed.
  excludeRooms: ["Grande Salle", "Petite Salle"],
});

export const meta = adapter.meta;
export const fetchAvailability = adapter.fetchAvailability;
