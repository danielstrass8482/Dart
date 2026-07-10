/**
 * modal.js — App-eigene Modal-Dialoge (ersetzt alert/confirm/prompt).
 */

import { t } from './i18n.js?v=3';

let _overlay = null;

function _ensureModal() {
  if (_overlay) return;
  _overlay = document.createElement('div');
  _overlay.id = 'app-modal-overlay';
  _overlay.innerHTML = `
    <div id="app-modal-box">
      <div id="app-modal-msg"></div>
      <div id="app-modal-actions">
        <button id="app-modal-cancel"></button>
        <button id="app-modal-ok"></button>
      </div>
    </div>`;
  document.body.appendChild(_overlay);
}

export function showAlert(message) {
  return new Promise(resolve => {
    _ensureModal();
    document.getElementById('app-modal-msg').textContent = message;
    const cancelBtn = document.getElementById('app-modal-cancel');
    const okBtn = document.getElementById('app-modal-ok');
    cancelBtn.style.display = 'none';
    okBtn.textContent = t('modal_ok');
    _overlay.classList.add('active');
    okBtn.onclick = () => {
      _overlay.classList.remove('active');
      okBtn.onclick = null;
      resolve();
    };
  });
}

export function showConfirm(message) {
  return new Promise(resolve => {
    _ensureModal();
    document.getElementById('app-modal-msg').textContent = message;
    const cancelBtn = document.getElementById('app-modal-cancel');
    const okBtn = document.getElementById('app-modal-ok');
    cancelBtn.style.display = '';
    cancelBtn.textContent = t('abbrechen');
    okBtn.textContent = t('modal_ok');
    _overlay.classList.add('active');
    const close = result => {
      _overlay.classList.remove('active');
      cancelBtn.onclick = null;
      okBtn.onclick = null;
      resolve(result);
    };
    okBtn.onclick = () => close(true);
    cancelBtn.onclick = () => close(false);
  });
}

/**
 * Non-blocking toast notification (auto-dismiss). For background failures
 * (e.g. a game save that didn't persist) where a modal would be too intrusive.
 * @param {string} message
 * @param {"error"|"info"} [type]
 */
export function showToast(message, type = "info") {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.style.cssText =
      "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100000;" +
      "max-width:min(90vw,420px);padding:12px 18px;border-radius:10px;font-size:14px;" +
      "font-family:'Manrope',sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.5);" +
      "opacity:0;transition:opacity .2s ease;pointer-events:none;text-align:center";
    document.body.appendChild(toast);
  }
  toast.style.background = type === "error" ? "#3a1414" : "#141416";
  toast.style.border = `1px solid ${type === "error" ? "#7f1d1d" : "rgba(212,175,55,.35)"}`;
  toast.style.color = type === "error" ? "#f87171" : "#FBFBF8";
  toast.textContent = message;
  toast.style.opacity = "1";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = "0"; }, 4000);
}

window.showAlert = showAlert;
window.showConfirm = showConfirm;
window.showToast = showToast;
