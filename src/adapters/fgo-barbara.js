// Adaptateur FGO-Barbara — hébergé sur QuickStudio. Toute la logique vit dans `quickstudio.js`.
import { makeQuickStudio } from "./quickstudio.js";

const adapter = makeQuickStudio({
  id: "fgo-barbara",
  name: "FGO-Barbara",
  address: "1 rue de Fleury, 75018 Paris",
  slug: "fgo-barbara",
});

export const meta = adapter.meta;
export const fetchAvailability = adapter.fetchAvailability;
