"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ConfigProvider, DatePicker, Modal, Popover, Slider } from "antd";
import frFR from "antd/locale/fr_FR";
import dayjs from "dayjs";
import "dayjs/locale/fr";

dayjs.locale("fr");

// Salles présentes dans le feed mais masquées côté front (pour l'instant).
// Pour réactiver L'Intervalle : décommenter / retirer "lintervalle" de la liste.
const HIDDEN_VENUES = [
  "lintervalle", // TODO: réactiver L'Intervalle
];

const H_MIN = 8;
const H_MAX = 24; // 24 = minuit

function frShort(iso) {
  return dayjs(iso).format("D MMM");
}

// "à l'instant", "il y a 12 min", "il y a 3 h", "il y a 2 j".
function frAgo(iso, now) {
  const min = Math.max(0, Math.floor((now - new Date(iso)) / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

// Rafraîchi chaque minute ; l'heure serveur ≠ heure client au rendu → suppressHydrationWarning.
function UpdatedAgo({ iso }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  if (!iso) return null;
  return (
    <span title={frDateTime(iso)} suppressHydrationWarning>
      Mis à jour {frAgo(iso, now)}
    </span>
  );
}

function frDateTime(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const INFO_ICON = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="8" cy="4.9" r="0.95" fill="currentColor" />
    <path d="M8 7.2v4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// Fiche du studio (photos, surface, capacité, matériel), ouverte au clic/tap sur l'icône ⓘ :
// popover sur desktop, modale sur mobile (le popover y est trop étroit et se cale mal).
function StudioInfo({ s, isMobile }) {
  const [open, setOpen] = useState(false);
  if (!s.description && !s.equipment?.length && !s.photos?.length) return null;
  const content = (
    <div className={isMobile ? "infopop infomodal" : "infopop"}>
      {s.photos?.length > 0 && (
        <div className="photos">
          {s.photos.map((src, i) => (
            <a key={i} href={src} target="_blank" rel="noreferrer" aria-label={`Photo ${i + 1} de ${s.name}`}>
              <Image
                src={src}
                alt={`${s.name} — photo ${i + 1}`}
                width={isMobile ? 480 : 240}
                height={isMobile ? 320 : 160}
                sizes={isMobile ? "85vw" : "240px"}
              />
            </a>
          ))}
        </div>
      )}
      {s.description && <p className="infodesc">{s.description}</p>}
      {s.equipment?.length > 0 && (
        <ul>
          {s.equipment.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
  const button = (
    <button
      type="button"
      className={open ? "infobtn is-open" : "infobtn"}
      aria-label={`Infos sur ${s.name}`}
      onClick={isMobile ? () => setOpen(true) : undefined}
    >
      {INFO_ICON}
    </button>
  );
  if (isMobile) {
    return (
      <>
        {button}
        <Modal open={open} onCancel={() => setOpen(false)} title={s.name} footer={null} centered destroyOnHidden>
          {content}
        </Modal>
      </>
    );
  }
  return (
    <Popover
      content={content}
      title={s.name}
      trigger="click"
      placement="bottomLeft"
      open={open}
      onOpenChange={setOpen}
      styles={{ root: { maxWidth: "min(340px, calc(100vw - 32px))" } }}
    >
      {button}
    </Popover>
  );
}

function fmtH(v) {
  return v >= 24 ? "minuit" : `${v}h`;
}

export default function Explorer({ feed, initialDate = "", initialFrom, initialTo, isMobile = false }) {
  const venues = (feed.venues || []).filter((v) => !HIDDEN_VENUES.includes(v.id));
  const router = useRouter();

  // Auto-refresh : re-fetch du feed côté serveur toutes les 60 s, sans recharger l'onglet.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60000);
    return () => clearInterval(id);
  }, [router]);

  // Couverture par salle (min/max des jours présents) + bornes globales.
  const { allMin, allMax, venueCover } = useMemo(() => {
    const cover = {};
    let lo = null;
    let hi = null;
    for (const v of venues) {
      let vlo = null;
      let vhi = null;
      for (const s of v.studios || []) {
        for (const d of Object.keys(s.days || {})) {
          if (!vlo || d < vlo) vlo = d;
          if (!vhi || d > vhi) vhi = d;
        }
      }
      cover[v.name] = { min: vlo, max: vhi };
      if (vlo && (!lo || vlo < lo)) lo = vlo;
      if (vhi && (!hi || vhi > hi)) hi = vhi;
    }
    return { allMin: lo, allMax: hi, venueCover: cover };
  }, [venues]);

  const [date, setDate] = useState(initialDate || allMin || "");
  const [range, setRange] = useState([
    Number.isFinite(initialFrom) ? initialFrom : H_MIN,
    Number.isFinite(initialTo) ? initialTo : H_MAX,
  ]);

  // Reflète les filtres dans l'URL (partageable + restauré au reload).
  function pushUrl(d, r) {
    const p = new URLSearchParams();
    if (d) p.set("date", d);
    if (r && (r[0] !== H_MIN || r[1] !== H_MAX)) {
      p.set("from", r[0]);
      p.set("to", r[1]);
    }
    const qs = p.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }
  function chooseDate(d) {
    setDate(d);
    pushUrl(d, range); // on garde la plage horaire en changeant de jour
  }
  function chooseRange(r) {
    setRange(r);
    pushUrl(date, r);
  }
  function step(delta) {
    const next = dayjs(date).add(delta, "day").format("YYYY-MM-DD");
    if (allMin && next < allMin) return;
    if (allMax && next > allMax) return;
    chooseDate(next);
  }

  // Lien de réservation daté : {date} remplacé par le jour sélectionné (HBS).
  function bookingHref(url) {
    return url ? url.replaceAll("{date}", date) : undefined;
  }

  const view = useMemo(() => {
    const [a, b] = range;
    const inRange = (t) => {
      const [h, m] = t.split(":").map(Number);
      const hf = h + m / 60;
      return hf >= a && hf <= b;
    };
    const out = venues.map((v) => {
      const cover = venueCover[v.name] || {};
      const beyond = cover.max && date > cover.max;
      const studios = (v.studios || []).map((s) => {
        const all = (s.days?.[date] || []).map((x) => x.time);
        const times = all.filter(inRange);
        return {
          name: s.studio,
          times,
          hasData: all.length > 0,
          url: s.url || v.url,
          description: s.description,
          equipment: s.equipment,
          photos: s.photos,
        };
      });
      // Salle (ou une partie de ses studios) en erreur côté adaptateur : pas de données fiables.
      const failed = Boolean(v.error) || (v.studios || []).some((s) => s.error);
      return { name: v.name, address: v.address, url: v.url, studios, beyond, cover, failed };
    });
    return { venues: out };
  }, [venues, date, range, venueCover]);

  const isFullRange = range[0] === H_MIN && range[1] === H_MAX;

  return (
    <ConfigProvider locale={frFR} theme={{ token: { colorPrimary: "#2563eb", borderRadius: 8 } }}>
      <main>
        <h1>StudioTonight 🎸</h1>
        <p className="byline">
          by{" "}
          <a className="author" href="https://www.linkedin.com/in/hugo-how-choong/" target="_blank" rel="noreferrer">
            Hugo How-Choong
          </a>{" "}
          ·{" "}
          <a href="https://github.com/hugohow/studio" target="_blank" rel="noreferrer">
            code open source
          </a>
        </p>
        <p className="sub">
          <UpdatedAgo iso={feed.generatedAt} />
        </p>

        <div className="controls">
          <div className="field">
            <label>Jour</label>
            <div className="daterow">
              <button className="stepper" onClick={() => step(-1)} disabled={date <= allMin} aria-label="Jour précédent">
                ‹
              </button>
              {/* Mobile (détecté par user-agent) : date picker natif · Desktop : antd */}
              {isMobile ? (
                <input
                  type="date"
                  className="nativedate"
                  value={date}
                  min={allMin || undefined}
                  max={allMax || undefined}
                  onChange={(e) => e.target.value && chooseDate(e.target.value)}
                />
              ) : (
                <DatePicker
                  value={date ? dayjs(date) : null}
                  onChange={(d) => chooseDate(d ? d.format("YYYY-MM-DD") : "")}
                  minDate={allMin ? dayjs(allMin) : undefined}
                  maxDate={allMax ? dayjs(allMax) : undefined}
                  allowClear={false}
                  format="ddd D MMM YYYY"
                  style={{ height: 38, minWidth: 180 }}
                />
              )}
              <button className="stepper" onClick={() => step(1)} disabled={date >= allMax} aria-label="Jour suivant">
                ›
              </button>
            </div>
          </div>

          <div className="field field-hours">
            <label>Plage horaire</label>
            <div className="sliderbox">
              <Slider
                range
                min={H_MIN}
                max={H_MAX}
                step={1}
                value={range}
                onChange={chooseRange}
                marks={{ 8: "8h", 12: "12h", 16: "16h", 20: "20h", 24: "0h" }}
                tooltip={{ formatter: fmtH }}
              />
            </div>
          </div>
        </div>

        {view.venues.map((v) => {
          const visible = v.studios.filter((s) => s.times.length > 0);
          const anyData = v.studios.some((s) => s.hasData);
          return (
            <section className="venue" key={v.name}>
              <h2>
                {v.url ? (
                  <a href={v.url} target="_blank" rel="noreferrer">
                    {v.name}
                  </a>
                ) : (
                  v.name
                )}
              </h2>
              {v.address && <p className="addr">{v.address}</p>}

              {!anyData && v.failed ? (
                <p className="note">
                  Disponibilités momentanément indisponibles pour cette salle (erreur lors de la dernière mise à
                  jour).
                </p>
              ) : !anyData && v.beyond ? (
                <p className="note">
                  Horizon limité : pas de données au-delà du {v.cover.max && frShort(v.cover.max)} pour cette salle.
                </p>
              ) : visible.length === 0 ? (
                <p className="none">Aucun studio libre {isFullRange ? "ce jour" : "sur cette plage"}.</p>
              ) : (
                visible.map((s) => (
                  <div className="studio" key={s.name}>
                    <div className="name">
                      <span className="studioname">
                        {s.name}
                        <StudioInfo s={s} isMobile={isMobile} />
                      </span>
                    </div>
                    <div className="chips">
                      {s.times.map((t) => (
                        <a
                          key={t}
                          className="chip"
                          href={bookingHref(s.url)}
                          target="_blank"
                          rel="noreferrer"
                          title={`Réserver ${s.name} à ${t}`}
                        >
                          {t}
                        </a>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>
          );
        })}
      </main>
    </ConfigProvider>
  );
}
