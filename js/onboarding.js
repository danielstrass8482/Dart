/**
 * onboarding.js — 5-Screen Tutorial beim ersten App-Start + Kontexthilfe-Tooltips.
 */

import { t } from './i18n.js';

function getScreens(){
  return [
    {
      icon: "🎯",
      title: t('ob_title_1'),
      text: t('ob_text_1'),
      btn: t('ob_btn_start')
    },
    {
      icon: "🎯",
      title: t('ob_title_2'),
      text: t('ob_text_2'),
      tip: t('ob_tip_2'),
      btn: t('ob_btn_weiter')
    },
    {
      icon: "👥",
      title: t('ob_title_3'),
      text: t('ob_text_3'),
      btn: t('ob_btn_weiter')
    },
    {
      icon: "🧠",
      title: t('ob_title_4'),
      text: t('ob_text_4'),
      badge: t('ob_badge_4'),
      btn: t('ob_btn_weiter')
    },
    {
      icon: "🏆",
      title: t('ob_title_5'),
      text: t('ob_text_5'),
      btn: t('ob_btn_play')
    }
  ];
}

let _overlay = null;
let _currentScreen = 0;

export function checkOnboarding(){
  if(localStorage.getItem("dart_onboarding_done")) return;
  showOnboarding();
}

export function showOnboarding(){
  _currentScreen = 0;
  if(_overlay) _overlay.remove();
  _overlay = document.createElement("div");
  _overlay.id = "onboarding-overlay";
  _overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.95);
    display:flex;align-items:center;justify-content:center;
    z-index:2000;padding:20px;
  `;
  _overlay.innerHTML = `
    <div id="onboarding-card" style="
      background:var(--dart-bg-card);border:1px solid var(--dart-border);border-radius:18px;
      padding:28px 24px;max-width:400px;width:100%;position:relative;
      overflow:hidden;
    ">
      <div style="
        position:absolute;top:0;left:0;right:0;height:3px;
        background:var(--dart-bg-chip);border-radius:3px 3px 0 0
      ">
        <div id="onboarding-progress" style="
          height:100%;background:var(--gold);border-radius:3px;
          transition:width .3s ease
        "></div>
      </div>
      <button id="onboarding-skip" style="
        position:absolute;top:14px;right:16px;
        background:none;border:none;color:var(--dart-text-muted);font-size:12px;
        cursor:pointer;padding:4px 8px;border-radius:4px
      ">${t('ob_skip')}</button>
      <div id="onboarding-body" style="text-align:center;margin-top:8px"></div>
      <div id="onboarding-dots" style="
        display:flex;justify-content:center;gap:6px;margin-top:20px
      "></div>
    </div>
  `;
  document.body.appendChild(_overlay);
  document.getElementById("onboarding-skip").addEventListener("click", finishOnboarding);
  renderScreen(_currentScreen);
}

function renderScreen(idx){
  const s = getScreens()[idx];
  const body = document.getElementById("onboarding-body");
  const prog = document.getElementById("onboarding-progress");
  const dots = document.getElementById("onboarding-dots");

  prog.style.width = `${Math.round((idx + 1) / getScreens().length * 100)}%`;

  body.style.opacity = "0";
  body.style.transform = "translateX(20px)";
  body.style.transition = "none";

  body.innerHTML = `
    <div style="font-size:56px;margin-bottom:16px;line-height:1">${s.icon}</div>
    <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;
      color:var(--gold);letter-spacing:2px;margin-bottom:12px;line-height:1.2">
      ${s.title}
    </div>
    <div style="font-size:14px;color:var(--dart-text-sec);line-height:1.65;margin-bottom:16px;white-space:pre-line">
      ${s.text}
    </div>
    ${s.tip ? `<div style="background:var(--dart-bg-chip);border:1px solid var(--dart-border);border-radius:8px;
      padding:10px 12px;font-size:12px;color:var(--dart-text-sec);margin-bottom:16px;
      text-align:left;white-space:pre-line">${s.tip}</div>` : ""}
    ${s.badge ? `<div style="background:rgba(232,196,74,0.12);border:1px solid var(--gold);
      border-radius:8px;padding:10px;font-size:13px;color:var(--dart-gold);margin-bottom:16px">
      ${s.badge}</div>` : ""}
    <button id="onboarding-next" style="
      width:100%;padding:14px;background:var(--gold);border:none;
      border-radius:10px;font-family:'Bebas Neue',sans-serif;font-size:20px;
      letter-spacing:2px;color:#000;cursor:pointer
    ">${s.btn}</button>
  `;

  dots.innerHTML = getScreens().map((_, i) => `
    <div style="width:${i===idx?18:7}px;height:7px;border-radius:4px;
      background:${i===idx?"var(--gold)":"#333"};transition:all .25s"></div>
  `).join("");

  requestAnimationFrame(()=>{
    body.style.transition = "opacity .25s ease, transform .25s ease";
    body.style.opacity = "1";
    body.style.transform = "translateX(0)";
  });

  document.getElementById("onboarding-next").addEventListener("click", ()=>{
    _currentScreen++;
    if(_currentScreen >= getScreens().length){
      finishOnboarding();
    } else {
      renderScreen(_currentScreen);
    }
  });
}

function finishOnboarding(){
  localStorage.setItem("dart_onboarding_done", "true");
  if(_overlay){
    _overlay.style.transition = "opacity .2s";
    _overlay.style.opacity = "0";
    setTimeout(()=>{ _overlay?.remove(); _overlay=null; }, 200);
  }
}

// ── Kontexthilfe ─────────────────────────────────────────────────
export function showHelp(title, text){
  const existing = document.getElementById("help-modal-overlay");
  if(existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "help-modal-overlay";
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.65);
    display:flex;align-items:center;justify-content:center;
    z-index:1500;padding:20px;
  `;
  overlay.innerHTML = `
    <div style="
      background:var(--dart-bg-card);border:1px solid var(--gold);border-radius:14px;
      padding:20px 18px;max-width:280px;width:100%;
    ">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;
        color:var(--gold);letter-spacing:1px;margin-bottom:8px">
        ${title}
      </div>
      <div style="font-size:13px;color:var(--dart-text-sec);line-height:1.6">${text}</div>
      <button onclick="document.getElementById('help-modal-overlay').remove()"
        style="margin-top:14px;width:100%;padding:9px;background:none;
        border:1px solid var(--dart-border);border-radius:8px;color:var(--dart-text-sec);
        font-size:13px;cursor:pointer">
        ${t('schliessen')}
      </button>
    </div>
  `;
  overlay.addEventListener("click", e=>{
    if(e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}
