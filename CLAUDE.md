# CLAUDE.md

Guide pour travailler sur ce repo. Voir aussi `README.md` (usage) et l'API détaillée dans
`~/.claude/skills/reserver-studio/references/amelia-api.md`.

## But

Récupérer **précisément** les créneaux libres des studios de répétition à Paris et les sortir en
**JSON**. Salles branchées : **Wacked Live** (3 studios), **Studio Bleu** (site 10ème Musique, ~15
studios), **Studio HBS** et **FGO-Barbara** (8 salles chacun, via QuickStudio), pensé pour en
brancher d'autres. Tourne en **cron sur le cloud** (GitHub Actions). Idée
produit : mode **inverse** = on donne date+heure, on obtient la liste des studios libres.

**Focus dispo** : on ne s'engage pas sur les prix (modèles tarifaires hétérogènes selon les salles).
Le feed expose uniquement la disponibilité.

**Lecture seule** : ne jamais réserver ni déclencher de paiement. On interroge uniquement
l'endpoint public de disponibilité.

## Commandes

```bash
node bin/fetch-slots.js                          # JSON complet sur stdout (durée 1h, horizon 2 mois)
node bin/fetch-slots.js --out data/slots.json    # écrit le feed (ce que fait le cron)
node bin/fetch-slots.js --duration 2 --months 3  # résas de 2h, horizon 3 mois
node bin/fetch-slots.js --at "2026-06-08 20:00"  # MODE INVERSE : studios libres à ce créneau
node bin/fetch-slots.js --at "2026-06-08 20:00" --json
```

Pas de dépendances, Node ≥ 18 (utilise `fetch` global). Rien à installer.

## Architecture

- `bin/fetch-slots.js` — CLI : parse les flags, appelle `fetchAll`, sort le JSON ou le résultat inverse.
- `src/adapters/index.js` — registre `ADAPTERS` + `fetchAll({durationH, monthsLoad})` (agrège toutes les salles, tolérant aux erreurs).
- `src/adapters/wacked.js` — adaptateur Wacked. Mapping studios→`serviceId`/`providerIds`/tarifs + appel `/slots` + normalisation.
- `.github/workflows/refresh.yml` — cron (~15 min) : régénère `data/slots.json` et le pousse sur
  la branche **`data`** (jamais sur `main` : un push sur `main` = un déploiement Vercel, et le cron
  saturait le quota gratuit de 100/jour, bloquant les vrais déploiements). `web/vercel.json`
  (`git.deploymentEnabled.data: false`) fait qu'un push sur `data` ne crée **aucun** déploiement.
  `FEED_URL` (env Vercel) pointe sur `?ref=data`.
- `data/slots.json` — sortie générée (le « feed »).

### Format de sortie
`venues[] → studios[] → days["YYYY-MM-DD"] → [{ time }]`.
Chaque entrée = une heure de **début** réservable (`HH:MM`). Wacked = pas horaire ; Studio Bleu = pas
de 30 min. Pas de prix dans le feed (focus dispo).

## Ajouter une salle

1. Créer `src/adapters/<salle>.js` exportant `meta = { id, name, address, url }` et
   `async fetchAvailability({ durationH, monthsLoad })` qui renvoie l'objet-salle normalisé
   (mêmes champs que `wacked.js`).
2. L'importer dans `src/adapters/index.js` et l'ajouter au tableau `ADAPTERS`.

## Points d'attention (Wacked / Amelia)

- Site = WordPress + plugin **Amelia v3**. Endpoint : `admin-ajax.php?action=wpamelia_api&call=/slots`.
- ⚠️ Le `/` de la route **ne doit PAS être URL-encodé** (`%2Fslots` → 404 ; `/slots` → 200).
- Requête type : `&call=/slots&monthsLoad=2&serviceId=<id>&serviceDuration=<sec>&providerIds=<a,b>&group=1&page=booking&structured=true&persons=1`.
- On interroge les deux `providerIds` (`avant18h`/`apres18h`) pour avoir tous les créneaux.
- Studios = catégories Amelia (Studio 1/2/3) ; les « services » sont les durées (1h→8h).

## Points d'attention (Studio Bleu)

- Back **Next.js séparé**, API : `https://api.studiobleu.com`. Pas d'auth pour la lecture.
- `GET /rooms` → inventaire **toutes salles/sites** (le param `?sites=` est ignoré). On filtre par
  `site.id === 1` (10ème Musique) **et** `internet_visibility` (exclut les salles admin).
- `GET /reservations/daily?date=YYYY-MM-DD&roomId=<id>` → tranches de **30 min**
  (`status: free | reserved`, `type: closeHour` = hors horaires). ⚠️ `date` en `YYYY-MM-DD` ; un ISO
  avec `Z` décale le jour.
- Dispo = `status === "free"` ; un créneau de début tient si les `durationH*2` tranches consécutives
  sont toutes libres. Horizon plafonné par `room.days_visible` (~60 j).
- ⚠️ **Règles de réservation** (affichées sur la page de résa, encodées dans `allowedStart` +
  `effDurationH`) : **2h minimum** → l'adaptateur clampe la durée à `MIN_DURATION_H = 2`
  (`effDurationH = max(durationH, 2)`), donc même dans le feed 1h on n'expose que des créneaux où
  2h sont libres (la salle renvoie `durationH: 2`, pas affiché côté front) ; **pas de départ à la
  demi-heure à partir de 19h** ; **pas de fin possible à 23:00** (donc pas de départ à 21:00 en 2h).
- La page de réservation (`reservation.studiobleu.com`, SPA Next.js) appelle le **même** endpoint
  `/reservations/daily` que nous : pas d'endpoint « créneaux réservables » côté serveur, les règles
  sont appliquées en JS côté client → inutile de scraper, on réplique les règles ici.
- ~15 salles × ~60 j = ~900 requêtes/run → concurrence bornée (`MAX_CONCURRENCY`), penser à espacer le
  cron quand il sera activé.

## Points d'attention (QuickStudio : Studio HBS, FGO-Barbara)

- Plusieurs salles partagent le back **QuickStudio** (`quickstudio.com`). Le cœur est mutualisé dans
  `src/adapters/quickstudio.js` (`makeQuickStudio({ id, name, address, slug })`) ; chaque salle
  (`hbs.js`, `fgo-barbara.js`) n'est qu'un wrapper qui fournit sa `meta` + son `slug`.
- **Pas d'API JSON** : Ruby on Rails, planning rendu en HTML → **scraping** (plus fragile si le markup change).
- `GET /fr/studios/<slug>/bookings?date=YYYY-MM-DD` → **1 requête = 1 jour pour toutes les salles** du studio
  (slugs : `studio-hbs`, `fgo-barbara`). Le nom de salle = texte du `<h4>` du `room-box`.
- Salles = `<div class="room" data-room="ID">` ; créneaux = `<span class="cell-N available|unavailable|closed"
  data-start="<unix>" data-end="<unix>">`. Les `available` sont les intervalles libres (timestamps Unix,
  convertis en heure de Paris). Dispo = on émet les heures de début (pas de 30 min) où la durée tient.
- ⚠️ **Fenêtre de réservation ≈ 14 jours** : au-delà, le planning renvoie une valeur fixe (placeholder),
  pas la vraie dispo → l'adaptateur coupe à 14 jours (`MAX_DAYS`). Le front affiche alors la note
  « Horizon limité » pour cette salle.

## Extension future (hors scope actuel)

Réserver jusqu'à l'étape paiement Stripe (pré-remplir les infos, s'arrêter avant la carte). Le mapping
providers est déjà prêt. Voir le skill `reserver-studio` côté `~/.claude/skills/`.
