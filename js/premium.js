/**
 * premium.js — Feature-Flags, Paywall-Infrastruktur, Beta-Modus.
 * BETA_MODE = true → alle Features für alle entsperrt.
 * Zum Aktivieren der Paywall: BETA_MODE = false setzen.
 */

import { t } from './i18n.js?v=3';

export const PREMIUM_FEATURES = {
  coachAnalysis: {
    id: "coachAnalysis",
    nameKey: "feat_coach_name",
    descKey: "feat_coach_desc",
    freeLimit: 3,
    icon: "🧠"
  },
  videoAnalysis: {
    id: "videoAnalysis",
    nameKey: "feat_video_name",
    descKey: "feat_video_desc",
    freeLimit: 1,
    icon: "🎥"
  },
  advancedStats: {
    id: "advancedStats",
    nameKey: "feat_stats_name",
    descKey: "feat_stats_desc",
    freeLimit: 0,
    icon: "📊"
  },
  voiceCustom: {
    id: "voiceCustom",
    nameKey: "feat_voice_name",
    descKey: "feat_voice_desc",
    freeLimit: 0,
    icon: "🎙️"
  },
  botPersonalities: {
    id: "botPersonalities",
    nameKey: "feat_bot_name",
    descKey: "feat_bot_desc",
    freeLimit: 1,
    icon: "🤖"
  },
  tournaments: {
    id: "tournaments",
    nameKey: "feat_tn_name",
    descKey: "feat_tn_desc",
    freeLimit: 0,
    icon: "🏆"
  },
  healthIntegration: {
    id: "healthIntegration",
    nameKey: "feat_health_name",
    descKey: "feat_health_desc",
    freeLimit: 0,
    icon: "❤️"
  },
  voiceLang: {
    id: "voiceLang",
    nameKey: "feat_voicelang_name",
    descKey: "feat_voicelang_desc",
    freeLimit: 0,
    icon: "🌍"
  }
};

// Beta-Modus: alle Features für alle entsperrt
export const BETA_MODE = true;

// Premium-Status prüfen
export async function isPremium(){
  if(BETA_MODE) return true;
  const user = window.fbAuth?.currentUser;
  if(!user) return false;
  try{
    const snap = await window.dartDB.getSubscription(user.uid);
    if(!snap) return false;
    const { status, expiresAt } = snap;
    return status === "active" && expiresAt > Date.now();
  }catch(e){ return false; }
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
    <div style="background:var(--dart-bg-card);border:1px solid var(--gold);
      border-radius:16px;padding:32px;max-width:360px;
      width:100%;text-align:center">
      <div style="font-family:'Bebas Neue',sans-serif;
        font-size:24px;color:var(--gold);letter-spacing:2px;
        margin-bottom:12px">
        ${t('paywall_titel')}
      </div>
      <div style="font-size:15px;color:var(--dart-text);font-weight:600;
        margin-bottom:20px">
        ${t('paywall_untertitel')}
      </div>
      <div style="background:rgba(232,196,74,0.1);
        border:1px solid var(--gold);border-radius:8px;
        padding:12px;margin-bottom:20px;font-size:13px;color:var(--dart-gold)">
        ${t('paywall_beta_hinweis')}
      </div>
      <button onclick="this.closest('[style*=fixed]').remove()"
        style="width:100%;padding:14px;background:var(--gold);
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
