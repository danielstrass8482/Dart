/**
 * onboarding.js — 5-Screen Tutorial beim ersten App-Start + Kontexthilfe-Tooltips.
 */

const SCREENS = [
  {
    icon: "🎯",
    title: "WILLKOMMEN BEI DARTTRAINER",
    text: "Dein intelligenter Dart-Trainer.\nKI-Coach, Statistiken und mehr —\nalles in einer App.",
    btn: "LOS GEHT'S →"
  },
  {
    icon: "🎯",
    title: "TREFFER EINTRAGEN",
    text: "Tippe einfach auf die Stelle der Scheibe\nwo dein Dart gelandet ist.\nDie App erkennt das Segment automatisch.",
    tip: "💡 Tipp: Du kannst auch per Sprache\nansagen — z.B. 'Triple Zwanzig'",
    btn: "WEITER →"
  },
  {
    icon: "👥",
    title: "SPIELER & MODI",
    text: "Lege Spieler an und wähle deinen\nSpielmodus — 501, Cricket, Turniere\noder Party-Modi für gesellige Abende.",
    btn: "WEITER →"
  },
  {
    icon: "🧠",
    title: "DEIN KI-COACH",
    text: "Nach jedem Spiel analysiert dein\npersönlicher KI-Coach deine Statistiken.\nLade ein kurzes Video hoch für eine\nAnalyse deiner Wurftechnik.",
    badge: "🎉 Während der Beta kostenlos!",
    btn: "WEITER →"
  },
  {
    icon: "🏆",
    title: "BEREIT ZU SPIELEN",
    text: "Leg einen Spieler an und starte\ndein erstes Spiel. Viel Erfolg!",
    btn: "SPIELEN →"
  }
];

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
      background:#1a1a1a;border:1px solid #333;border-radius:18px;
      padding:28px 24px;max-width:400px;width:100%;position:relative;
      overflow:hidden;
    ">
      <div style="
        position:absolute;top:0;left:0;right:0;height:3px;
        background:#333;border-radius:3px 3px 0 0
      ">
        <div id="onboarding-progress" style="
          height:100%;background:var(--gold);border-radius:3px;
          transition:width .3s ease
        "></div>
      </div>
      <button id="onboarding-skip" style="
        position:absolute;top:14px;right:16px;
        background:none;border:none;color:#555;font-size:12px;
        cursor:pointer;padding:4px 8px;border-radius:4px
      ">Überspringen</button>
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
  const s = SCREENS[idx];
  const body = document.getElementById("onboarding-body");
  const prog = document.getElementById("onboarding-progress");
  const dots = document.getElementById("onboarding-dots");

  prog.style.width = `${Math.round((idx + 1) / SCREENS.length * 100)}%`;

  body.style.opacity = "0";
  body.style.transform = "translateX(20px)";
  body.style.transition = "none";

  body.innerHTML = `
    <div style="font-size:56px;margin-bottom:16px;line-height:1">${s.icon}</div>
    <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;
      color:var(--gold);letter-spacing:2px;margin-bottom:12px;line-height:1.2">
      ${s.title}
    </div>
    <div style="font-size:14px;color:#ccc;line-height:1.65;margin-bottom:16px;white-space:pre-line">
      ${s.text}
    </div>
    ${s.tip ? `<div style="background:#1a1800;border:1px solid #444;border-radius:8px;
      padding:10px 12px;font-size:12px;color:#aaa;margin-bottom:16px;
      text-align:left;white-space:pre-line">${s.tip}</div>` : ""}
    ${s.badge ? `<div style="background:rgba(232,196,74,0.12);border:1px solid var(--gold);
      border-radius:8px;padding:10px;font-size:13px;color:#e8c44a;margin-bottom:16px">
      ${s.badge}</div>` : ""}
    <button id="onboarding-next" style="
      width:100%;padding:14px;background:var(--gold);border:none;
      border-radius:10px;font-family:'Bebas Neue',sans-serif;font-size:20px;
      letter-spacing:2px;color:#000;cursor:pointer
    ">${s.btn}</button>
  `;

  dots.innerHTML = SCREENS.map((_, i) => `
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
    if(_currentScreen >= SCREENS.length){
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
      background:#1a1a1a;border:1px solid var(--gold);border-radius:14px;
      padding:20px 18px;max-width:280px;width:100%;
    ">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;
        color:var(--gold);letter-spacing:1px;margin-bottom:8px">
        ${title}
      </div>
      <div style="font-size:13px;color:#ccc;line-height:1.6">${text}</div>
      <button onclick="document.getElementById('help-modal-overlay').remove()"
        style="margin-top:14px;width:100%;padding:9px;background:none;
        border:1px solid #444;border-radius:8px;color:#aaa;
        font-size:13px;cursor:pointer">
        Schließen
      </button>
    </div>
  `;
  overlay.addEventListener("click", e=>{
    if(e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}
