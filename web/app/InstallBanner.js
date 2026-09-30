"use client";

import { useEffect, useState } from "react";

// Bandeau « Installer l'app » (PWA).
// - Android / Chrome / Edge : l'événement `beforeinstallprompt` permet un vrai bouton « Installer ».
// - iOS : pas d'API d'installation → on explique le geste (Partager → Sur l'écran d'accueil).
// - Navigateurs intégrés (Instagram, Facebook, Messenger, TikTok…) : impossible d'installer d'ici →
//   on invite à ouvrir le lien dans Safari / Chrome (et on propose de copier le lien).
// Masqué si l'app tourne déjà installée, ou si l'utilisateur l'a fermé (mémorisé 30 jours).

const DISMISS_KEY = "install-banner-dismissed-at";
const DISMISS_DAYS = 30;

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true
  );
}

function isIOS() {
  const ua = window.navigator.userAgent;
  // iPadOS 13+ se présente comme un Mac : on le repère au tactile.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

// Navigateurs intégrés aux apps (repérés au user-agent). Ceux qui passent par SFSafariViewController
// (ex. WhatsApp iOS) ont un UA identique à Safari : indétectables, ils gardent le message iOS.
function isInAppBrowser() {
  return /Instagram|FBAN|FBAV|FB_IAB|Messenger|LinkedInApp|Snapchat|musical_ly|BytedanceWebview|Line\//i.test(
    window.navigator.userAgent
  );
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at && Date.now() - at < DISMISS_DAYS * 864e5;
  } catch {
    return false;
  }
}

function ShareIcon() {
  return (
    <svg className="ib-share" viewBox="0 0 24 24" width="16" height="16" aria-label="Partager">
      <path
        d="M12 3v12M7.5 7.5 12 3l4.5 4.5M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function InstallBanner() {
  const [mode, setMode] = useState(null); // null | "prompt" | "ios" | "inapp"
  const [deferred, setDeferred] = useState(null);
  const [ios, setIos] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;
    setIos(isIOS());
    if (isInAppBrowser()) {
      setMode("inapp");
      return;
    }
    if (isIOS()) {
      setMode("ios");
      return;
    }
    const onPrompt = (e) => {
      e.preventDefault(); // on garde l'événement pour le déclencher depuis notre bouton
      setDeferred(e);
      setMode("prompt");
    };
    const onInstalled = () => setMode(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mode) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setMode(null);
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setMode(null);
    else dismiss();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
    } catch {}
  };

  return (
    <div className="installbanner" role="dialog" aria-label="Installer l'application">
      <img className="ib-icon" src="/icon-192.png" alt="" width="44" height="44" />
      <div className="ib-text">
        <strong>Installe StudioTonight</strong>
        {mode === "inapp" ? (
          <span>Ouvre-le dans {ios ? "Safari" : "Chrome"} (menu ⋯) pour l'installer</span>
        ) : mode === "ios" ? (
          <span>
            {/* iOS 26+ : Partager est rangé derrière « ⋯ » dans Safari. */}
            Touche <ShareIcon /> Partager (ou ⋯), puis <span className="ib-nowrap">« Sur l'écran d'accueil »</span>
          </span>
        ) : (
          <span>Les créneaux libres en un tap, depuis ton écran d'accueil</span>
        )}
      </div>
      {mode === "inapp" && (
        <button className="ib-install" onClick={copyLink} title="Copier le lien">
          {copied ? "Copié ✓" : "Copier"}
        </button>
      )}
      {mode === "prompt" && (
        <button className="ib-install" onClick={install}>
          Installer
        </button>
      )}
      <button className="ib-close" onClick={dismiss} aria-label="Fermer">
        ×
      </button>
    </div>
  );
}
