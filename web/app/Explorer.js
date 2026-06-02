"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfigProvider, DatePicker, Select } from "antd";
import frFR from "antd/locale/fr_FR";
import dayjs from "dayjs";
import "dayjs/locale/fr";

dayjs.locale("fr");

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

export default function Explorer({ feed, initialDate = "", initialTime = "" }) {
  const venues = feed.venues || [];
  const router = useRouter();

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
  const [time, setTime] = useState(initialTime || ""); // "" = toutes les heures

  // Reflète les filtres dans l'URL (partageable + restauré au reload).
  function pushUrl(d, t) {
    const p = new URLSearchParams();
    if (d) p.set("date", d);
    if (t) p.set("time", t);
    const qs = p.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }
  function chooseDate(d) {
    setDate(d);
    setTime("");
    pushUrl(d, "");
  }
  function chooseTime(t) {
    setTime(t);
    pushUrl(date, t);
  }

  // Lien de réservation daté : {date} remplacé par le jour sélectionné (HBS).
  function bookingHref(url) {
    return url ? url.replaceAll("{date}", date) : undefined;
  }

  const timesForDate = useMemo(() => {
    const set = new Set();
    for (const v of venues)
      for (const s of v.studios || [])
        for (const slot of s.days?.[date] || []) set.add(slot.time);
    return [...set].sort();
  }, [venues, date]);

  const view = useMemo(() => {
    let freeCount = 0;
    const out = venues.map((v) => {
      const cover = venueCover[v.name] || {};
      const beyond = cover.max && date > cover.max; // au-delà de l'horizon de la salle
      const studios = (v.studios || []).map((s) => {
        const times = (s.days?.[date] || []).map((x) => x.time);
        const hit = time ? times.includes(time) : times.length > 0;
        if (hit) freeCount++;
        return { name: s.studio, times, hit, url: s.url || v.url };
      });
      return { name: v.name, address: v.address, url: v.url, studios, beyond, cover };
    });
    return { venues: out, freeCount };
  }, [venues, date, time, venueCover]);

  function step(delta) {
    const next = dayjs(date).add(delta, "day").format("YYYY-MM-DD");
    if (allMin && next < allMin) return;
    if (allMax && next > allMax) return;
    chooseDate(next);
  }

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
              <DatePicker
                value={date ? dayjs(date) : null}
                onChange={(d) => chooseDate(d ? d.format("YYYY-MM-DD") : "")}
                minDate={allMin ? dayjs(allMin) : undefined}
                maxDate={allMax ? dayjs(allMax) : undefined}
                allowClear={false}
                format="ddd D MMM YYYY"
                style={{ height: 38, minWidth: 180 }}
              />
              <button className="stepper" onClick={() => step(1)} disabled={date >= allMax} aria-label="Jour suivant">
                ›
              </button>
            </div>
          </div>

          <div className="field">
            <label>Heure</label>
            <Select
              value={time}
              onChange={(v) => chooseTime(v)}
              disabled={!timesForDate.length}
              style={{ height: 38, minWidth: 150 }}
              options={[{ value: "", label: "Toutes" }, ...timesForDate.map((t) => ({ value: t, label: t }))]}
            />
          </div>

          <div className="summary">
            {frDate(date)} ·{" "}
            {time ? (
              <>
                <b>{view.freeCount}</b> studio(s) à {time}
              </>
            ) : (
              <>
                <b>{view.freeCount}</b> studio(s) dispo(s)
              </>
            )}
          </div>
        </div>

        {view.venues.map((v) => {
          // On n'affiche que les studios avec au moins un créneau (selon l'heure filtrée).
          const visible = v.studios.filter((s) => (time ? s.hit : s.times.length > 0));
          const anyData = v.studios.some((s) => s.times.length > 0);
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
                <p className="none">Aucun studio libre {time ? `à ${time}` : "ce jour"}.</p>
              ) : (
                visible.map((s) => (
                  <div className={"studio" + (s.times.length ? "" : " empty")} key={s.name}>
                    <div className="name">
                      <span>{s.name}</span>
                      <span className="count">{s.times.length} créneau(x)</span>
                    </div>
                    {s.times.length ? (
                      <div className="chips">
                        {s.times.map((t) => (
                          <a
                            key={t}
                            className={"chip" + (time && t === time ? " hit" : "")}
                            href={bookingHref(s.url)}
                            target="_blank"
                            rel="noreferrer"
                            title={`Réserver ${s.name} à ${t}`}
                          >
                            {t}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="none">—</span>
                    )}
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
