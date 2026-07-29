// Cœur QuickStudio (Ruby on Rails, planning rendu en HTML) — mutualisé entre les salles
// hébergées sur quickstudio.com (Studio HBS, FGO-Barbara, …). Pas d'API JSON : on parse la page
// planning. 1 requête = 1 jour pour toutes les salles du studio.
//   GET /fr/studios/<slug>/bookings?date=YYYY-MM-DD
// Chaque salle : <div class="room-box"><h4>Nom …</h4> … <div class="room" data-room="ID"> …
//   <span class="cell-N available|unavailable|closed" data-start="<unix>" data-end="<unix>"> …
// Les `available` sont les intervalles libres (timestamps Unix → heure de Paris).
// ⚠️ Scraping HTML : plus fragile qu'une API si QuickStudio change son markup. Lecture seule.

const MAX_CONCURRENCY = 6;
// QuickStudio n'ouvre les réservations que ~14 jours à l'avance : au-delà, le planning
// renvoie une valeur fixe (≈ placeholder « tout libre ») et non la vraie dispo -> on coupe à 14 jours.
const MAX_DAYS = 14;

// unix (secondes) -> "HH:MM" heure de Paris
const fmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
function hhmm(unix) {
  return fmt.format(new Date(unix * 1000)).replace("h", ":"); // "08:00"
}

// Noms de salles depuis les blocs room-box : renvoie Map(id -> nom).
// Le nom est le texte du <h4> avant l'icône d'aide / la description.
function parseRoomNames(html) {
  const names = new Map();
  for (const m of html.matchAll(
    /<div class="room-box">\s*<h4>([\s\S]*?)(?:<i class|<div class="description")[\s\S]*?data-room="(\d+)"/g
  )) {
    const id = m[2];
    const name = m[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    names.set(id, name || `Salle ${id}`);
  }
  return names;
}

// Intervalles `available` par salle : Map(id -> [{start, end}]) (timestamps unix).
function parseAvailableByRoom(html) {
  const marks = [];
  const re = /data-room="(\d+)"/g;
  let m;
  while ((m = re.exec(html))) marks.push({ id: m[1], idx: m.index });
  const out = new Map();
  marks.forEach((mk, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].idx : html.length;
    const chunk = html.slice(mk.idx, end);
    const intervals = [];
    for (const c of chunk.matchAll(/class="cell-\d+ available" data-start="(\d+)" data-end="(\d+)"/g)) {
      intervals.push({ start: Number(c[1]), end: Number(c[2]) });
    }
    if (!out.has(mk.id)) out.set(mk.id, intervals);
  });
  return out;
}

// Heures de début réservables dans les intervalles libres, pas de 30 min.
function startsFromIntervals(intervals, durationH) {
  const durSec = durationH * 3600;
  const starts = [];
  for (const { start, end } of intervals) {
    for (let t = start; t + durSec <= end; t += 1800) starts.push(hhmm(t));
  }
  return [...new Set(starts)].sort();
}

function dateRange(monthsLoad, daysCap) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const stop = new Date(start.getFullYear(), start.getMonth() + monthsLoad, start.getDate());
  const dates = [];
  for (let d = new Date(start); d < stop && dates.length < daysCap; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${mo}-${da}`);
  }
  return dates;
}

async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

// Fabrique un adaptateur QuickStudio à partir de la meta de la salle.
// `meta` : { id, name, address, slug, excludeRooms } — `slug` = segment d'URL
// quickstudio.com/fr/studios/<slug> ; `excludeRooms` = noms de salles à exclure du feed
// (ex. salles de concert qui ne sont pas des studios de répét).
// Renvoie { meta, fetchAvailability } prêts à exporter depuis l'adaptateur de la salle.
export function makeQuickStudio(meta) {
  const BASE = `https://www.quickstudio.com/fr/studios/${meta.slug}/bookings`;
  const VENUE = { id: meta.id, name: meta.name, address: meta.address, url: BASE };
  const excluded = new Set((meta.excludeRooms || []).map((n) => n.toLowerCase()));

  async function fetchAvailability({ durationH = 1, monthsLoad = 2 } = {}) {
    const dates = dateRange(monthsLoad, MAX_DAYS);
    let roomNames = new Map();

    // roomId -> { days: { date: [{time}] } }
    const rooms = new Map();

    const perDay = await pool(dates, MAX_CONCURRENCY, async (date) => {
      try {
        const r = await fetch(`${BASE}?date=${date}`, {
          headers: { "X-Requested-With": "XMLHttpRequest", Accept: "text/html" },
        });
        if (!r.ok) return null;
        const html = await r.text();
        return { date, names: parseRoomNames(html), avail: parseAvailableByRoom(html) };
      } catch (e) {
        return null;
      }
    });

    for (const day of perDay) {
      if (!day) continue;
      if (day.names.size) roomNames = day.names; // garde la dernière table de noms vue
      for (const [id, intervals] of day.avail) {
        if (!rooms.has(id)) rooms.set(id, { days: {} });
        const starts = startsFromIntervals(intervals, durationH);
        if (starts.length) rooms.get(id).days[day.date] = starts.map((time) => ({ time }));
      }
    }

    // `{date}` est remplacé côté front par le jour sélectionné (la page planning accepte ?date=).
    const bookingUrl = `${BASE}?date={date}`;
    const studios = [...rooms.entries()]
      .map(([id, r]) => ({
        studio: roomNames.get(id) || `Salle ${id}`,
        url: bookingUrl,
        days: r.days,
      }))
      .filter((s) => !excluded.has(s.studio.toLowerCase()));

    return { id: VENUE.id, name: VENUE.name, address: VENUE.address, url: VENUE.url, durationH, studios };
  }

  return { meta: VENUE, fetchAvailability };
}
