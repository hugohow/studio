# Branche `data`

Contient uniquement le feed `data/slots.json`, régénéré par le workflow `refresh.yml`.
Séparée de `main` pour que les commits du cron ne déclenchent aucun déploiement Vercel
(quota gratuit : 100 déploiements/jour). `web/vercel.json` désactive les déploiements
de cette branche côté Vercel.
