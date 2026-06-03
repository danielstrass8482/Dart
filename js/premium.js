/**
 * premium.js — Feature-Flags, Paywall-Infrastruktur, Beta-Modus.
 * BETA_MODE = true → alle Features für alle entsperrt.
 * Zum Aktivieren der Paywall: BETA_MODE = false setzen.
 */

export const PREMIUM_FEATURES = {
  coachAnalysis: {
    id: "coachAnalysis",
    name: "KI-Coach Analyse",
    description: "Detaillierte KI-Analyse deines Spiels",
    freeLimit: 3,
    icon: "🧠"
  },
  videoAnalysis: {
    id: "videoAnalysis",
    name: "Video-Wurfanalyse",
    description: "KI analysiert deine Wurftechnik",
    freeLimit: 1,
    icon: "🎥"
  },
  advancedStats: {
    id: "advancedStats",
    name: "Erweiterte Statistiken",
    description: "Doppelfeld-Matrix, Health-Korrelation, Trends",
    freeLimit: 0,
    icon: "📊"
  },
  voiceCustom: {
    id: "voiceCustom",
    name: "Stimme anpassen",
    description: "Eigene Stimme oder Premium-Voices",
    freeLimit: 0,
    icon: "🎙️"
  },
  botPersonalities: {
    id: "botPersonalities",
    name: "Bot-Persönlichkeiten",
    description: "Nervöser, Kaltblütiger, Glücksspieler Bot",
    freeLimit: 1,
    icon: "🤖"
  },
  tournaments: {
    id: "tournaments",
    name: "Turnier-Modus",
    description: "Lokale und Online-Turniere",
    freeLimit: 0,
    icon: "🏆"
  },
  healthIntegration: {
    id: "healthIntegration",
    name: "Health-Integration",
    description: "Schlaf und Fitness mit Spielleistung verknüpfen",
    freeLimit: 0,
    icon: "❤️"
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
  const feature = PREMIUM_FEATURES[featureId];
  if(!feature) return;
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.85);
    display:flex;align-items:center;justify-content:center;
    z-index:1000;padding:20px
  `;
  overlay.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid var(--gold);
      border-radius:16px;padding:32px;max-width:360px;
      width:100%;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">
        ${feature.icon}
      </div>
      <div style="font-family:'Bebas Neue',sans-serif;
        font-size:24px;color:var(--gold);letter-spacing:2px;
        margin-bottom:8px">
        PREMIUM FEATURE
      </div>
      <div style="font-size:16px;color:#fff;font-weight:600;
        margin-bottom:8px">
        ${feature.name}
      </div>
      <div style="font-size:13px;color:#aaa;margin-bottom:24px">
        ${feature.description}
      </div>
      <div style="background:rgba(232,196,74,0.1);
        border:1px solid var(--gold);border-radius:8px;
        padding:12px;margin-bottom:20px;font-size:12px;color:#e8c44a">
        🎉 Während der Beta kostenlos für alle!<br>
        <span style="color:#aaa">
          Registriere dich jetzt um deine Features
          dauerhaft zu sichern.
        </span>
      </div>
      <button onclick="this.closest('[style*=fixed]').remove()"
        style="width:100%;padding:14px;background:var(--gold);
        border:none;border-radius:10px;font-family:'Bebas Neue',
        sans-serif;font-size:20px;letter-spacing:2px;
        color:#000;cursor:pointer;margin-bottom:10px">
        WEITER (BETA)
      </button>
      <button onclick="this.closest('[style*=fixed]').remove()"
        style="width:100%;padding:10px;background:none;
        border:1px solid #444;border-radius:10px;color:#666;
        font-size:13px;cursor:pointer">
        Schließen
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
}
