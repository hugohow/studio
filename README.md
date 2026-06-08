# 🎸 Studio Tonight

**[studiotonight.vercel.app](https://studiotonight.vercel.app)** — voir directement les créneaux libres des studios de répétition du nord-est parisien.

Agrège la disponibilité de plusieurs studios (**Wacked Live**, **Studio Bleu**, **Studio HBS**) et l'expose en JSON + une interface web. Lecture seule : aucune réservation, aucun paiement.

## Comment ça marche

- Un cron **GitHub Actions** régénère `data/slots.json` toutes les 15 min (`bin/fetch-slots.js`).
- Le front **Next.js** (`web/`, déployé sur Vercel) lit ce feed et affiche les créneaux par jour / heure.
- Pas de prix : seule la dispo compte (tarifs trop hétérogènes selon les salles). Seuls les créneaux **à venir** sont inclus.

## En local

```bash
# Feed (Node ≥ 18, zéro dépendance)
node bin/fetch-slots.js --out data/slots.json
node bin/fetch-slots.js --at "2026-06-08 20:00"   # mode inverse : studios libres à ce créneau

# Front (lit ../data/slots.json)
cd web && npm install && npm run dev
```

## Format du feed

`venues[] → studios[] → days["YYYY-MM-DD"] → [{ time }]` — chaque entrée est une **heure de début** réservable.

## Ajouter une salle

Créer `src/adapters/<salle>.js` (exporte `meta` + `fetchAvailability({ durationH, monthsLoad })` renvoyant l'objet normalisé), puis l'ajouter au tableau `ADAPTERS` de `src/adapters/index.js`.
Exemples : `wacked.js` (plugin Amelia), `studiobleu.js` (API Next.js), `hbs.js` (scraping QuickStudio).

---

by [Hugo How-Choong](https://www.linkedin.com/in/hugo-how-choong/)
