"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConfigProvider, DatePicker, Slider } from "antd";
import frFR from "antd/locale/fr_FR";
import dayjs from "dayjs";
import "dayjs/locale/fr";

dayjs.locale("fr");

const H_MIN = 8;
const H_MAX = 24; // 24 = minuit

function frDate(iso) {
  if (!iso) return "";
  return dayjs(iso).format("dddd D MMMM");
}

function frShort(iso) {
  return dayjs(iso).format("D MMM");
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

function fmtH(v) {
  return v >= 24 ? "minuit" : `${v}h`;
}

export default function Explorer({ feed, initialDate = "", initialFrom, initialTo, isMobile = false }) {
  const venues = feed.venues || [];
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
    let freeCount = 0;
    const out = venues.map((v) => {
      const cover = venueCover[v.name] || {};
      const beyond = cover.max && date > cover.max;
      const studios = (v.studios || []).map((s) => {
        const all = (s.days?.[date] || []).map((x) => x.time);
        const times = all.filter(inRange);
        if (times.length) freeCount++;
        return { name: s.studio, times, hasData: all.length > 0, url: s.url || v.url };
      });
      return { name: v.name, address: v.address, url: v.url, studios, beyond, cover };
    });
    return { venues: out, freeCount };
  }, [venues, date, range, venueCover]);

  const isFullRange = range[0] === H_MIN && range[1] === H_MAX;

  return (
    <ConfigProvider locale={frFR} theme={{ token: { colorPrimary: "#2563eb", borderRadius: 8 } }}>
      <main>
        <h1>🎸 StudioTonight</h1>
        <p className="byline">
          by{" "}
          <a href="https://www.linkedin.com/in/hugo-how-choong/" target="_blank" rel="noreferrer">
            Hugo How-Choong
          </a>{" "}
          ·{" "}
          <a href="https://github.com/hugohow/studio" target="_blank" rel="noreferrer">
            code sur GitHub
          </a>
        </p>
        <p className="sub">
          {venues.length} salle(s) · feed mis à jour le {feed.generatedAt ? frDateTime(feed.generatedAt) : "?"} · durée{" "}
          {feed.durationH}h · données du {allMin && frShort(allMin)} au {allMax && frShort(allMax)}
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

          <div className="summary">
            {frDate(date)} · <b>{view.freeCount}</b> studio(s){" "}
            {isFullRange ? "dispo(s)" : `entre ${fmtH(range[0])} et ${fmtH(range[1])}`}
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

              {!anyData && v.beyond ? (
                <p className="note">
                  Horizon limité : pas de données au-delà du {v.cover.max && frShort(v.cover.max)} pour cette salle.
                </p>
              ) : visible.length === 0 ? (
                <p className="none">Aucun studio libre {isFullRange ? "ce jour" : "sur cette plage"}.</p>
              ) : (
                visible.map((s) => (
                  <div className="studio" key={s.name}>
                    <div className="name">
                      <span>{s.name}</span>
                      <span className="count">{s.times.length} créneau(x)</span>
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
