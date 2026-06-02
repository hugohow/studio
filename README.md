# 🎸 StudioTonight

Récupère **précisément** les créneaux disponibles des studios de répétition à Paris et les sort en **JSON**. Salles branchées : **Wacked Live** (3 studios) et **Studio Bleu** (site 10ème Musique, ~15 studios) ; conçu pour brancher d'autres salles facilement. Conçu pour tourner en **cron sur le cloud** (zéro dépendance, Node ≥ 18).

> **Focus dispo** : le feed expose uniquement la disponibilité, pas les prix (modèles tarifaires hétérogènes selon les salles).

## Utilisation locale

```bash
# JSON sur stdout (durée 1h, horizon 2 mois)
node bin/fetch-slots.js

# créneaux pour des résas de 2h, horizon 3 mois
node bin/fetch-slots.js --duration 2 --months 3

# écrire dans un fichier
node bin/fetch-slots.js --out data/slots.json
```

Options (flags ou variables d'env) : `--duration`/`DURATION` (1–8 h), `--months`/`MONTHS` (horizon), `--out`/`OUT` (fichier de sortie).

## Format de sortie

```json
{
  "generatedAt": "2026-06-02T12:00:00.000Z",
  "durationH": 1,
  "monthsLoad": 2,
  "venues": [
    {
      "id": "wacked",
      "name": "Wacked Live",
      "address": "32 bd Sébastopol, 75003 Paris",
      "url": "https://wackedlive.fr/index.php/reservation/",
      "durationH": 1,
      "studios": [
        {
          "studio": "Studio 1",
          "days": {
            "2026-06-08": [
              { "time": "10:00" },
              { "time": "23:00" }
            ]
          }
        }
      ]
    }
  ]
}
```

Chaque entrée d'un jour = une **heure de début libre** pour la durée demandée. Wacked = pas horaire ; Studio Bleu = pas de 30 min. Pas de prix dans le feed (focus dispo).

### Mode inverse

```bash
# quels studios sont libres à une date + heure donnée ?
node bin/fetch-slots.js --at "2026-06-08 20:00"
node bin/fetch-slots.js --at "2026-06-08 20:00" --json
```

## Cron sur le cloud (GitHub Actions)

Le workflow `.github/workflows/refresh.yml` lance le script toutes les ~15 min, écrit `data/slots.json` et le commit. Le JSON devient alors un **flux à jour** consultable via l'URL *raw* du fichier (ou GitHub Pages).

Mise en place :
1. Pousser ce repo sur GitHub.
2. Onglet **Actions** → activer les workflows.
3. (Optionnel) ajuster la fréquence du `cron` dans le YAML. Note : la planification GitHub a souvent 5–15 min de latence et n'est pas garantie à la minute.

Autres hébergeurs cron possibles sans modifier le code : Vercel/Netlify scheduled function, AWS Lambda + EventBridge, Render/Railway cron, ou un simple `crontab` sur un VPS appelant `node bin/fetch-slots.js --out …`.

## Ajouter une salle

1. Créer `src/adapters/<salle>.js` exportant :
   - `meta = { id, name, address, url }`
   - `async fetchAvailability({ durationH, monthsLoad })` renvoyant l'objet-salle normalisé (mêmes champs que Wacked).
2. L'importer dans `src/adapters/index.js` et l'ajouter au tableau `ADAPTERS`.

Exemples : `wacked.js` (WordPress + plugin Amelia) et `studiobleu.js` (back Next.js, API `api.studiobleu.com`). Le détail de l'API Amelia de Wacked est documenté dans `~/.claude/skills/reserver-studio/references/amelia-api.md`.

## Garde-fous

Lecture seule : le script ne réserve rien et ne déclenche aucun paiement. Il interroge uniquement l'endpoint public de disponibilité.
# studio
