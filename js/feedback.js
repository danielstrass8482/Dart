/**
 * feedback.js — Feedback-Formular Modal + einmaliger Beta-Banner.
 */
import { t } from './i18n.js?v=3';

// Nach erfolgreichem Deploy von functions:sendFeedback prüfen/aktualisieren.
export const FEEDBACK_FUNCTION_URL = "https://europe-west1-darttrainer-app.cloudfunctions.net/sendFeedback";

const BANNER_DISMISSED_KEY = "dart_beta_banner_dismissed";

let _overlay = null;

export function openFeedbackModal(){
  if(_overlay) _overlay.remove();
  _overlay = document.createElement("div");
  _overlay.id = "feedback-modal-overlay";
  _overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.75);
    display:flex;align-items:center;justify-content:center;
    z-index:2500;padding:20px;
  `;
  _overlay.innerHTML = `
    <div style="background:#08080A;border:1px solid rgba(212,175,55,.35);border-radius:16px;
      padding:22px 20px;max-width:400px;width:100%;font-family:'Manrope',sans-serif">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <i data-lucide="message-circle" style="width:18px;height:18px;stroke-width:2;color:#D4AF37"></i>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;color:#D4AF37">${t('feedback_titel')}</div>
      </div>
      <div style="font-size:13px;color:var(--dart-text-sec);margin-bottom:14px;line-height:1.5">${t('feedback_untertitel')}</div>
      <textarea id="feedback-textarea" rows="5" maxlength="2000" placeholder="${t('feedback_placeholder')}"
        style="width:100%;background:var(--dart-bg-input);border:1px solid var(--dart-border);
        border-radius:10px;padding:12px;color:var(--dart-text);font-family:'Manrope',sans-serif;
        font-size:14px;resize:vertical;min-height:100px;box-sizing:border-box"></textarea>
      <div id="feedback-error" style="color:#f87171;font-size:12px;margin-top:8px;min-height:14px"></div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <button id="feedback-cancel-btn" style="flex:1;padding:11px;border:1px solid var(--dart-border);
          border-radius:8px;background:none;color:var(--dart-text);font-size:14px;cursor:pointer">${t('abbrechen')}</button>
        <button id="feedback-send-btn" style="flex:1;padding:11px;border:none;border-radius:8px;
          background:var(--dart-gold);color:#000;font-family:'Bebas Neue',sans-serif;font-size:16px;
          letter-spacing:1px;cursor:pointer">${t('feedback_senden')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(_overlay);
  window.refreshIcons?.();

  const close = () => { _overlay?.remove(); _overlay = null; };
  _overlay.addEventListener("click", e => { if(e.target === _overlay) close(); });
  document.getElementById("feedback-cancel-btn").addEventListener("click", close);
  document.getElementById("feedback-send-btn").addEventListener("click", async () => {
    const textarea = document.getElementById("feedback-textarea");
    const errorEl = document.getElementById("feedback-error");
    const btn = document.getElementById("feedback-send-btn");
    const message = textarea.value.trim();
    if(!message){ errorEl.textContent = t('feedback_leer'); return; }
    errorEl.textContent = "";
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = "…";
    try{
      await sendFeedback(message);
      btn.textContent = t('feedback_erfolg');
      setTimeout(close, 1200);
    } catch(e){
      errorEl.textContent = t('feedback_fehler');
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });
}

export async function sendFeedback(message){
  let token = "anonymous";
  try{ const user = window.fbAuth?.currentUser; if(user) token = await user.getIdToken(); }catch(e){}
  const response = await fetch(FEEDBACK_FUNCTION_URL, {
    method: "POST",
    headers: {"Content-Type":"application/json","Authorization":"Bearer "+token},
    body: JSON.stringify({ message })
  });
  if(!response.ok){ throw new Error(`Feedback send failed: ${response.status}`); }
  return response.json();
}

// ── Beta-Banner ────────────────────────────────────────────────────
export function initBetaBanner(){
  const banner = document.getElementById("beta-banner");
  if(!banner) return;
  document.getElementById("beta-banner-close")?.addEventListener("click", () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, "1");
    banner.style.display = "none";
  });
  document.getElementById("beta-banner-link")?.addEventListener("click", e => {
    e.preventDefault();
    localStorage.setItem(BANNER_DISMISSED_KEY, "1");
    banner.style.display = "none";
    document.querySelector('.home-tab[data-tab="profil"]')?.click();
    setTimeout(() => openFeedbackModal(), 150);
  });
}

// Nur beim allerersten Login des Nutzers aufrufen (siehe firebase.js).
export function maybeShowBetaBanner(){
  if(localStorage.getItem(BANNER_DISMISSED_KEY)) return;
  const banner = document.getElementById("beta-banner");
  if(banner) banner.style.display = "flex";
}

window.openFeedbackModal = openFeedbackModal;
window.maybeShowBetaBanner = maybeShowBetaBanner;
