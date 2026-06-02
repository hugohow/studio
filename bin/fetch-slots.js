#!/usr/bin/env node
// Récupère les créneaux de toutes les salles et sort du JSON.
// Usage :
//   node bin/fetch-slots.js                 -> JSON sur stdout (durée 1h, 2 mois d'horizon)
//   node bin/fetch-slots.js --duration 2    -> créneaux pour des résas de 2h
//   node bin/fetch-slots.js --months 3      -> horizon de 3 mois
//   node bin/fetch-slots.js --out data/slots.json   -> écrit dans un fichier (au lieu de stdout)
//   node bin/fetch-slots.js --at "2026-06-08 20:00"  -> MODE INVERSE : studios libres à ce créneau
//   node bin/fetch-slots.js --at "2026-06-08 20:00" --json  -> idem en JSON
// Variables d'env équivalentes : DURATION, MONTHS, OUT.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fetchAll } from "../src/adapters/index.js";

function arg(name, def) {
  const flag = `--${name}`;
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(flag + "="));
  if (eq) return eq.slice(flag.length + 1);
  return def;
}

const durationH = parseInt(arg("duration", process.env.DURATION || "1"), 10);
const monthsLoad = parseInt(arg("months", process.env.MONTHS || "2"), 10);
const out = arg("out", process.env.OUT || "");
const at = arg("at", ""); // "YYYY-MM-DD HH:MM" -> mode inverse
const asJson = process.argv.includes("--json");

// Mode inverse : quels studios sont libres à une date + heure donnée ?
function findAt(venues, date, time) {
  const available = [];
  for (const v of venues) {
    for (const s of v.studios || []) {
      const slot = (s.days?.[date] || []).find((h) => h.time === time);
      if (slot) available.push({ venue: v.name, studio: s.studio, url: v.url });
    }
  }
  return available;
}

try {
  const venues = await fetchAll({ durationH, monthsLoad });

  if (at) {
    const m = at.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})$/);
    if (!m) throw new Error('Format --at attendu : "YYYY-MM-DD HH:MM"');
    const date = m[1];
    const time = `${m[2].padStart(2, "0")}:${m[3]}`;
    const available = findAt(venues, date, time);

    if (asJson) {
      process.stdout.write(JSON.stringify({ generatedAt: new Date().toISOString(), date, time, durationH, available }, null, 2) + "\n");
    } else {
      const d = new Date(date + "T00:00:00");
      const jour = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      process.stdout.write(`\n🎸 Studios libres le ${jour} à ${time} (${durationH}h)\n\n`);
      if (!available.length) {
        process.stdout.write("  Aucun studio dispo à ce créneau.\n\n");
      } else {
        available.forEach((s) => {
          process.stdout.write(`  • ${s.venue} — ${s.studio}\n`);
        });
        process.stdout.write(`\n  → ${available.length} studio(s) dispo(s)\n\n`);
      }
    }
  } else {
    const payload = { generatedAt: new Date().toISOString(), durationH, monthsLoad, venues };
    const json = JSON.stringify(payload, null, 2);
    if (out) {
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, json + "\n");
      process.stderr.write(`✓ Écrit ${out} (${venues.length} salle(s), durée ${durationH}h)\n`);
    } else {
      process.stdout.write(json + "\n");
    }
  }
} catch (e) {
  process.stderr.write("✗ Échec: " + String(e.message || e) + "\n");
  process.exit(1);
}
