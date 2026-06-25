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

window.showAlert = showAlert;
window.showConfirm = showConfirm;
