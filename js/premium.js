/**
 * premium.js — Feature-Flags, Paywall-Infrastruktur, Beta-Modus.
 * BETA_MODE = true → alle Features für alle entsperrt.
 * Zum Aktivieren der Paywall: BETA_MODE = false setzen.
 */

import { t } from './i18n.js?v=3';

// Kanonische Liste der Premium-Features
export const PREMIUM_FEATURES = {
  scatterplot:   { id: "scatterplot",   nameKey: "feat_scatterplot_name",   descKey: "feat_scatterplot_desc",   icon: "🎯" },
  statsAnalysis: { id: "statsAnalysis", nameKey: "feat_statsanalysis_name", descKey: "feat_statsanalysis_desc", icon: "🧠" },
  videoAnalysis: { id: "videoAnalysis", nameKey: "feat_video_name",          descKey: "feat_video_desc",          icon: "🎥" },
  advancedStats: { id: "advancedStats", nameKey: "feat_stats_name",          descKey: "feat_stats_desc",          icon: "📊" },
  premiumVoices: { id: "premiumVoices", nameKey: "feat_voice_name",          descKey: "feat_voice_desc",          icon: "🎙️" },
  botOpponent:   { id: "botOpponent",   nameKey: "feat_bot_name",            descKey: "feat_bot_desc",            icon: "🤖" },
};

// Beta-Modus: alle Features für alle entsperrt
export const BETA_MODE = true;

// Admin-UIDs — hier Firebase UIDs der Admins eintragen
const ADMIN_UIDS = [];

// In-Memory-Cache: User hat betaPremium: true in Firebase gesetzt
export let betaPremiumActive = false;
export function setBetaPremiumActive(val){ betaPremiumActive = val; }

// Lokaler Admin-Override: erzwingt isPremium()=false für Nicht-Premium-Ansicht
export let adminOverrideNonPremium = false;
export function setAdminOverrideNonPremium(val){ adminOverrideNonPremium = val; }

// Admin-Prüfung (client-side, nur für UI-Sichtbarkeit)
export function isAdmin(){
  const user = window.currentUser;
  if(!user || user.isAnonymous) return false;
  if(ADMIN_UIDS.length && ADMIN_UIDS.includes(user.uid)) return true;
  return user.email === 'daniel.strass@gmx.de';
}

// betaPremium-Status aus Firebase laden (Vorladen beim App-Start)
export async function loadBetaPremiumStatus(){
  if(BETA_MODE) return;
  const user = window.fbAuth?.currentUser;
  if(!user || user.isAnonymous) return;
  try{
    const data = await window.dartDB?.getBetaPremium(user.uid);
    if(data?.betaPremium) betaPremiumActive = true;
  }catch(e){ console.warn("loadBetaPremiumStatus:", e); }
}

/**
 * Zentrale Premium-Prüfung.
 * Reihenfolge:
 *   1. Admin-Override aktiv → false (Admin testet Nicht-Premium-Ansicht)
 *   2. BETA_MODE → true (alle User haben Premium)
 *   3. isAdmin() → true
 *   4. betaPremiumActive (In-Memory-Cache) → true
 *   5. Firebase betaPremium: true → true (und Cache befüllen)
 *   6. Sonst → false
 */
export async function isPremium(user){
  if(adminOverrideNonPremium) return false;
  if(BETA_MODE) return true;
  if(isAdmin()) return true;
  if(betaPremiumActive) return true;
  const u = user || window.fbAuth?.currentUser;
  if(u && !u.isAnonymous && window.dartDB){
    try{
      const data = await window.dartDB.getBetaPremium(u.uid);
      if(data?.betaPremium){ betaPremiumActive = true; return true; }
    }catch(e){}
  }
  return false;
}

// Beta-User registrieren (bekommt später Grandfathering)
export async function registerBetaUser(){
  const user = window.fbAuth?.currentUser;
  if(!user || user.isAnonymous) return;
  try{
    await window.dartDB.saveBetaUser({
      uid: user.uid,
      registeredAt: Date.now(),
      grandfathered: true
    });
  }catch(e){}
}

// Feature-Zugang prüfen
export async function canUseFeature(featureId){
  if(BETA_MODE) return { allowed: true, reason: "beta" };
  if(betaPremiumActive) return { allowed: true, reason: "beta_premium" };
  const premium = await isPremium();
  if(premium) return { allowed: true, reason: "premium" };
  const feature = PREMIUM_FEATURES[featureId];
  if(!feature) return { allowed: true, reason: "free" };
  if(feature.freeLimit === 0)
    return { allowed: false, reason: "premium_required" };
  const usage = getMonthlyUsage(featureId);
  if(usage < feature.freeLimit)
    return { allowed: true, reason: "free_tier" };
  return {
    allowed: false,
    reason: "limit_reached",
    limit: feature.freeLimit,
    used: usage
  };
}

// Monatliche Nutzung aus localStorage
export function getMonthlyUsage(featureId){
  const key = `dart_usage_${featureId}_${getMonthKey()}`;
  return parseInt(localStorage.getItem(key) || "0");
}

export function recordUsage(featureId){
  const key = `dart_usage_${featureId}_${getMonthKey()}`;
  const current = parseInt(localStorage.getItem(key) || "0");
  localStorage.setItem(key, current + 1);
}

function getMonthKey(){
  const d = new Date();
  return `${d.getFullYear()}_${d.getMonth()}`;
}

// Premium-Overlay anzeigen
export function showPremiumOverlay(featureId){
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.85);
    display:flex;align-items:center;justify-content:center;
    z-index:1000;padding:20px
  `;
  overlay.innerHTML = `
    <div style="background:var(--dart-bg-card);border:1px solid var(--dart-gold);
      border-radius:16px;padding:32px;max-width:360px;
      width:100%;text-align:center">
      <div style="font-family:'Bebas Neue',sans-serif;
        font-size:24px;color:var(--dart-gold);letter-spacing:2px;
        margin-bottom:12px">
        ${t('paywall_titel')}
      </div>
      <div style="font-size:15px;color:var(--dart-text);font-weight:600;
        margin-bottom:20px">
        ${t('paywall_untertitel')}
      </div>
      <div style="background:rgba(232,196,74,0.1);
        border:1px solid var(--dart-gold);border-radius:8px;
        padding:12px;margin-bottom:20px;font-size:13px;color:var(--dart-gold)">
        ${t('paywall_beta_hinweis')}
      </div>
      <button onclick="window.unlockBetaPremium(this.closest('[style*=fixed]'))"
        style="width:100%;padding:14px;background:#D4AF37;
        border:none;border-radius:10px;font-family:'Bebas Neue',
        sans-serif;font-size:20px;letter-spacing:2px;
        color:#000;cursor:pointer;margin-bottom:8px">
        ${t('paywall_freischalten')}
      </button>
      <div style="font-size:11px;color:var(--dart-text-muted);margin-bottom:10px">
        ${t('paywall_kleintext')}
      </div>
      <button onclick="this.closest('[style*=fixed]').remove()"
        style="width:100%;padding:10px;background:none;
        border:1px solid var(--dart-border);border-radius:10px;color:var(--dart-text-muted);
        font-size:13px;cursor:pointer">
        ${t('schliessen')}
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
}
