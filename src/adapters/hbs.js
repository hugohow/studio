// Adaptateur Studio HBS — hébergé sur QuickStudio. Toute la logique vit dans `quickstudio.js`.
import { makeQuickStudio } from "./quickstudio.js";

const adapter = makeQuickStudio({
  id: "hbs",
  name: "Studio HBS",
  address: "29 rue des Petites Écuries, 75010 Paris",
  slug: "studio-hbs",
});

export const meta = adapter.meta;
export const fetchAvailability = adapter.fetchAvailability;
