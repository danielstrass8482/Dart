/**
 * setup.js — Player management, game setup form, screen switching.
 */

import { state } from './state.js';
import { startX01 } from './x01.js';
import { startCricket } from './cricket.js';
import { startParty } from './party.js';
import { collectHealthData } from './coach.js';
import { BOT_PERSONALITIES } from './bot.js';

export const AVATAR_COLORS=["#e53935","#1e88e5","#43a047","#fb8c00","#8e24aa","#00897b","#e91e63","#546e7a"];

/**
 * Returns the display name (nickname if set, otherwise name).
 * @param {{name:string, nickname?:string}|null} player
 * @param {string} [fallback]
 */
export function getDisplayName(player, fallback=""){
  if(!player) return fallback;
  return player.nickname||player.name||fallback;
}

export const BOT_PERSONALITY_DESCS = {
  methodisch:"Spielt immer optimal und konstant",
  uebermuetig:"Zielt immer auf T20, ignoriert bessere Optionen",
  nervoese:"Verliert Konzentration wenn es drauf ankommt",
  gluecksspieler:"Zielt immer auf Maximum, riskiert Bust",
  kaltbluetig:"Wird besser unter Druck",
  aufholer:"Kämpft sich von hinten vor"
};

/**
 * Returns a deterministic color for a player name.
 * @param {string} name
 * @returns {string}
 */
export function playerColor(name){
  let h=0; for(const c of name) h=(h*31+c.charCodeAt(0))%AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

/** Renders the player selection list. */
export function renderPlayerList(){
  const list=document.getElementById("player-list");
  if(!state.allPlayers.length){
    list.innerHTML=`
      <div style="background:var(--dart-bg-chip);border:1px solid var(--dart-gold);border-radius:12px;padding:16px;text-align:center;margin-bottom:8px">
        <div style="font-size:28px;margin-bottom:8px">👋</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--dart-gold);letter-spacing:2px;margin-bottom:6px">WILLKOMMEN BEI DARTTRAINER</div>
        <div style="font-size:13px;color:var(--dart-text-sec);margin-bottom:14px">Leg deinen ersten Spieler an um loszuspielen!</div>
        <button onclick="document.getElementById('new-player-input').focus()" style="width:100%;padding:11px;background:var(--dart-gold);border:none;border-radius:8px;font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1px;color:#000;cursor:pointer;margin-bottom:8px">+ SPIELER ANLEGEN</button>
        <button onclick="window.showOnboarding&&window.showOnboarding()" style="width:100%;padding:8px;background:none;border:1px solid var(--dart-border-alt);border-radius:8px;color:var(--dart-text-sec);font-size:13px;cursor:pointer">Tutorial anzeigen</button>
      </div>`;
    return;
  }
  list.innerHTML="";
  state.allPlayers.forEach(p=>{
    const selIdx=state.selectedPlayers.findIndex(s=>s.id===p.id);
    const selected=selIdx>=0;
    const div=document.createElement("div");
    div.className="player-item"+(selected?" selected":"");
    const avg=p.stats?.avgPerTurn?.toFixed(1)||"0.0";
    const co=p.stats?.checkoutPct?.toFixed(0)||"0";
    const hi=p.stats?.highscore||0;
    const displayName=getDisplayName(p);
    const avatarHtml=p.photoUrl
      ? `<img src="${p.photoUrl}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0">`
      : `<div class="pi-avatar" style="background:${playerColor(p.name)}">${p.name[0].toUpperCase()}</div>`;
    div.innerHTML=`
      ${avatarHtml}
      <div style="flex:1;min-width:0">
        <div class="pi-name">${displayName}${p.nickname&&p.nickname!==p.name?`<span style="font-size:11px;color:var(--dart-text-sec);font-weight:400;margin-left:4px">(${p.name})</span>`:""}</div>
        <div class="pi-stats">Ø ${avg} · CO ${co}% · Best ${hi}${p.dartWeight?` · ${p.dartWeight}g`:""}</div>
      </div>
      <div class="pi-order">${selected?selIdx+1:""}</div>
      <button class="pi-delete" data-id="${p.id}" data-name="${p.name}" title="Spieler löschen">✕</button>`;
    div.addEventListener("click",()=>togglePlayer(p));
    const delBtn=div.querySelector(".pi-delete");
    delBtn.addEventListener("click", async (e)=>{
      e.stopPropagation();
      if(!confirm(`Spieler "${p.name}" wirklich löschen?\n\nDie Spielhistorie bleibt erhalten, der Spieler kann aber nicht mehr ausgewählt werden.`)) return;
      try{
        await window.dartDB.deletePlayer(p.id);
        state.selectedPlayers=state.selectedPlayers.filter(s=>s.id!==p.id);
        await loadPlayers();
      }catch(err){ alert("Fehler beim Löschen: "+err.message); }
    });
    list.appendChild(div);
  });
  document.getElementById("sel-hint").textContent=
    state.selectedPlayers.length
      ? `${state.selectedPlayers.length} Spieler gewählt: ${state.selectedPlayers.map(p=>p.name).join(", ")}`
      : "Tippe Spieler an — Reihenfolge = Startreihenfolge";
}

/**
 * Toggles a player's selection state.
 * @param {{id:string, name:string}} p
 */
export function togglePlayer(p){
  const idx=state.selectedPlayers.findIndex(s=>s.id===p.id);
  if(idx>=0) state.selectedPlayers.splice(idx,1);
  else state.selectedPlayers.push(p);
  renderPlayerList();
}

/** Loads players from Firebase and renders the list. */
export async function loadPlayers(){
  if(!window.dartDB) return;
  try{
    state.allPlayers=await window.dartDB.loadPlayers();
    renderPlayerList();
    renderProfilPlayerList();
  }catch(e){ console.warn("loadPlayers failed",e); }
}

/** Renders the player list in the Profil tab. */
export function renderProfilPlayerList(){
  const el=document.getElementById("profil-player-list");
  if(!el) return;
  if(!state.allPlayers.length){
    el.innerHTML=`<div style="color:var(--dart-text-sec);font-size:13px;text-align:center;padding:12px 0">Noch keine Spieler angelegt</div>`;
    return;
  }
  el.innerHTML=state.allPlayers.map(p=>{
    const displayName=getDisplayName(p);
    const avatarHtml=p.photoUrl
      ?`<img src="${p.photoUrl}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid var(--dart-gold)">`
      :`<div style="width:52px;height:52px;border-radius:50%;background:${playerColor(p.name)};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--dart-text);flex-shrink:0">${p.name[0].toUpperCase()}</div>`;
    const infoLine=[
      p.nickname&&p.nickname!==p.name?`"${p.nickname}"`:"",
      p.dartBrand||"",
      p.dartWeight?`${p.dartWeight}g`:"",
    ].filter(Boolean).join(" · ");
    const avg=p.stats?.avgPerTurn?.toFixed(1)||"0.0";
    const co=p.stats?.checkoutPct?.toFixed(0)||"0";
    return `<div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid #f0f0f0">
      ${avatarHtml}
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:15px;color:var(--dart-text)">${displayName}</div>
        ${infoLine?`<div style="font-size:12px;color:var(--dart-text-sec);margin-top:2px">${infoLine}</div>`:""}
        <div style="font-size:11px;color:#bbb;margin-top:2px">Ø ${avg} · CO ${co}%</div>
      </div>
      <button data-profil-edit="${p.id}" style="padding:8px 14px;border:1px solid var(--dart-border);border-radius:8px;
        background:var(--dart-bg-card);color:var(--dart-text-sec);font-size:13px;cursor:pointer;flex-shrink:0">✏ Bearbeiten</button>
    </div>`;
  }).join("");
  el.querySelectorAll("[data-profil-edit]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const player=state.allPlayers.find(p=>p.id===btn.dataset.profilEdit);
      if(player) openPlayerEditDialog(player);
    });
  });
}

// ── Screen switching ──────────────────────────────────────────────
const GAME_SCREENS = new Set(["x01","cricket","party","online-wait"]);

function lockLandscape(){ try{ screen.orientation.lock("landscape").catch(()=>{}); }catch(e){} }
function unlockOrientation(){ try{ screen.orientation.unlock(); }catch(e){} }
function requestFullscreen(){ const el=document.documentElement; try{ (el.requestFullscreen||el.webkitRequestFullscreen||el.mozRequestFullScreen||el.msRequestFullscreen)?.call(el); }catch(e){} }
function exitFullscreen(){ try{ (document.exitFullscreen||document.webkitExitFullscreen||document.mozCancelFullScreen||document.msExitFullscreen)?.call(document); }catch(e){} }

export function updateRotateOverlay(){
  const active = document.querySelector(".screen.active");
  const isGame = active && GAME_SCREENS.has(active.id);
  const isPortrait = window.matchMedia("(orientation:portrait)").matches;
  const ov = document.getElementById("rotate-overlay");
  if(ov) ov.style.display = (isGame && isPortrait) ? "flex" : "none";
}

/**
 * Shows the given screen by ID.
 * @param {string} id
 */
export function showScreen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if(GAME_SCREENS.has(id)) lockLandscape();
  else unlockOrientation();
  updateRotateOverlay();
}

/** Shows the setup/home screen. */
export function showSetup(){
  document.getElementById("winner-overlay").classList.remove("visible");
  document.getElementById("set-overlay").classList.remove("visible");
  document.getElementById("leg-overlay").classList.remove("visible");
  showScreen("setup");
  loadPlayers();
}

/** Shows cards section (hides sub-sections). */
export function showSpielenCards(){
  document.getElementById("spielen-cards").style.display="";
  document.getElementById("spielen-lokal").classList.remove("active");
  document.getElementById("spielen-online").classList.remove("active");
}

/**
 * Shows a specific spielen sub-section.
 * @param {"lokal"|"online"} section
 */
export function showSpielenSection(section){
  document.getElementById("spielen-cards").style.display="none";
  document.getElementById("spielen-lokal").classList.toggle("active", section==="lokal");
  document.getElementById("spielen-online").classList.toggle("active", section==="online");
  if(section==="online" && window.updateAuthUI) window.updateAuthUI(window.currentUser);
}

/** Saves game data to Firebase and updates player stats. */
export async function saveGameToFirebase(winnerIdx){
  if(!window.dartDB) return;
  const isX01 = state.cfg.mode!=="Cricket";
  const players = state.cfg.players.map((name,i)=>{
    if(isX01){
      const turns = state.x01.turnScores[i];
      const allT  = state.x01.allThrows[i];
      const avg   = turns.length ? Math.round(turns.reduce((a,b)=>a+b,0)/turns.length*10)/10 : 0;
      const best  = turns.length ? Math.max(...turns) : 0;
      const scatter = allT.filter(t=>t.svgX!=null&&t.svgY!=null).map(t=>({x:Math.round(t.svgX),y:Math.round(t.svgY),l:t.label,leg:t.leg||1}));
      return {name, id:state.cfg.playerIds?.[i]||null, avg3:avg, best3:best,
        checkoutAtt:state.x01.checkoutAttempts[i], checkoutHit:state.x01.checkoutHits[i],
        first9:state.x01.first9?.[i]||null,
        doubleStats:state.x01.doubleStats?.[i]||{},
        scatter, winner:i===winnerIdx};
    } else {
      const turns=state.cr.turnScores?.[i]||[];
      const avgMarks=turns.length?Math.round(turns.reduce((a,b)=>a+b,0)/turns.length*10)/10:0;
      return {name, id:state.cfg.playerIds?.[i]||null,
        points:state.cr.points[i], winner:i===winnerIdx, scatter:[],
        cricketAvgMarks:avgMarks,
        cricketClosed:state.cr.closedOrder?.[i]||[],
        cricketFirstClosed:state.cr.firstClosed?.[i]||null,
        cricketRounds:state.cr.round,
        durationSec:Math.round((Date.now()-state.cr.startTime)/1000)
      };
    }
  });
  const gameDoc = {
    ts: Date.now(),
    mode: state.cfg.mode,
    rounds: isX01 ? state.x01.round : state.cr.round,
    winner: state.cfg.players[winnerIdx],
    winnerId: state.cfg.playerIds?.[winnerIdx]||null,
    playerIds: state.cfg.playerIds||[],
    players,
    durationSec: isX01 ? Math.round((Date.now()-state.x01.startTime)/1000) : 0,
    context: state.cfg.context||"casual",
    tournamentId: state.cfg.tournamentId||null,
    tournamentName: state.cfg.tournamentName||null,
    ...(state.cfg.healthData ? {healthData: state.cfg.healthData} : {})
  };
  window.dartDB.saveGame(gameDoc)
    .then(()=>updateAllPlayerStats())
    .catch(e=>console.warn("Firebase save failed:",e));
  if(state.cfg.tournamentId&&state.cfg.matchId && window._updateTournamentMatch){
    window._updateTournamentMatch(state.cfg.tournamentId, state.cfg.matchId, winnerIdx);
  }
}

/** Updates all player stats after a game save. */
export async function updateAllPlayerStats(){
  if(!window.dartDB||!state.cfg.playerIds?.length) return;
  try{
    const allGames=await window.dartDB.loadStats();
    for(let i=0;i<state.cfg.players.length;i++){
      const pid=state.cfg.playerIds[i]; if(!pid) continue;
      const pGames=allGames.filter(g=>(g.playerIds||[]).includes(pid));
      const pData=pGames.map(g=>(g.players||[]).find(p=>p.id===pid)).filter(Boolean);
      const x01Games=pGames.filter(g=>g.mode!=="Cricket");
      const crGames=pGames.filter(g=>g.mode==="Cricket");
      const x01Data=pData.filter(p=>p.avg3!==undefined);
      const crData=pData.filter(p=>p.cricketAvgMarks!==undefined);
      const playerWins=pGames.filter(g=>g.winnerId===pid).length;
      const avgs=x01Data.map(p=>p.avg3||0).filter(v=>v>0);
      const avg=avgs.length?Math.round(avgs.reduce((a,b)=>a+b,0)/avgs.length*10)/10:0;
      const coAtts=x01Data.reduce((s,p)=>s+(p.checkoutAtt||0),0);
      const coHits=x01Data.reduce((s,p)=>s+(p.checkoutHit||0),0);
      const coPct=coAtts>0?Math.round(coHits/coAtts*100):0;
      const best=x01Data.reduce((m,p)=>Math.max(m,p.best3||0),0);
      const f9vals=x01Data.map(p=>p.first9||null).filter(v=>v!==null);
      const f9avg=f9vals.length?Math.round(f9vals.reduce((a,b)=>a+b,0)/f9vals.length*10)/10:null;
      const crAvgs=crData.map(p=>p.cricketAvgMarks||0).filter(v=>v>0);
      const crAvg=crAvgs.length?Math.round(crAvgs.reduce((a,b)=>a+b,0)/crAvgs.length*10)/10:0;
      await window.dartDB.updatePlayerStats(pid,{
        games:pGames.length, wins:playerWins, avgPerTurn:avg, first9avg:f9avg,
        checkoutPct:coPct, highscore:best,
        cricketGames:crGames.length, cricketAvgMarks:crAvg
      });
    }
    state.allPlayers=await window.dartDB.loadPlayers();
  }catch(e){ console.warn("updatePlayerStats failed",e); }
}

/** Updates the auth UI (profile button + auth bar). */
export function updateAuthUI(user){
  const bar=document.getElementById("auth-bar");
  if(bar){
    if(user && !user.isAnonymous){
      bar.innerHTML=`<span style="font-size:12px;color:var(--dart-text-sec)">${user.displayName||user.email}</span>
        <button onclick="signOutUser()" style="background:none;border:1px solid var(--dart-border);color:var(--dart-text-sec);padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer">Abmelden</button>`;
    } else {
      bar.innerHTML=`<button onclick="signInWithGoogle()" style="background:var(--dart-bg-card);border:none;padding:6px 14px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width:16px"> Mit Google anmelden</button>`;
    }
  }
  const profBtn = document.getElementById("profile-btn");
  if(profBtn){
    if(user && !user.isAnonymous){
      const name = user.displayName || user.email || "?";
      if(user.photoURL){
        profBtn.innerHTML=`<img src="${user.photoURL}" style="width:34px;height:34px;border-radius:50%;object-fit:cover">`;
        profBtn.style.background="transparent";
      } else {
        const initials = name.charAt(0).toUpperCase();
        const col = playerColor(name);
        profBtn.textContent = initials;
        profBtn.style.background = col;
        profBtn.style.color = "var(--dart-text)";
      }
    } else {
      profBtn.textContent = "👤";
      profBtn.style.background = "var(--dart-border)";
      profBtn.style.color = "var(--dart-text-muted)";
    }
  }
}

/**
 * Detects the game context from the selected setup option and player config.
 * @param {string} selectedContext "auto"|"training"|"casual"|"tournament"
 * @param {string[]} humans human player names
 * @param {boolean} hasBot whether a bot is in the game
 * @returns {"training"|"casual"|"tournament"}
 */
export function detectContext(selectedContext, humans, hasBot){
  if(selectedContext !== "auto") return selectedContext;
  return (humans.length === 1 && !hasBot) ? "training" : "casual";
}

// ── Player Edit Dialog ────────────────────────────────────────────
let _editingPlayer = null;
let _editPhotoFile = null;

/** Opens the player edit dialog for the given player. */
export function openPlayerEditDialog(player){
  _editingPlayer = player;
  _editPhotoFile = null;

  const backdrop = document.getElementById("player-edit-backdrop");
  const avatarEl = document.getElementById("player-edit-avatar");
  if(!backdrop || !avatarEl) return;

  // Populate fields
  document.getElementById("player-edit-name").value = player.name||"";
  document.getElementById("player-edit-nickname").value = player.nickname||"";
  document.getElementById("player-edit-brand").value = player.dartBrand||"";
  document.getElementById("player-edit-weight").value = player.dartWeight||"";
  document.getElementById("player-edit-error").textContent = "";

  // Avatar preview
  _renderEditAvatar(player.photoUrl, player);

  backdrop.classList.add("open");
}

function _renderEditAvatar(photoUrl, player){
  const el = document.getElementById("player-edit-avatar");
  if(!el) return;
  if(photoUrl){
    el.innerHTML = `<img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover">`;
  } else {
    el.style.background = playerColor(player.name);
    el.style.color = "var(--dart-text)";
    el.textContent = (player.name||"?")[0].toUpperCase();
  }
}

function _closeEditDialog(){
  const backdrop = document.getElementById("player-edit-backdrop");
  if(backdrop) backdrop.classList.remove("open");
  _editingPlayer = null;
  _editPhotoFile = null;
}

// Wire edit dialog events once DOM is ready
document.addEventListener("DOMContentLoaded", ()=>{
  const closeBtn = document.getElementById("btn-player-edit-close");
  if(closeBtn) closeBtn.addEventListener("click", _closeEditDialog);

  const photoBtn = document.getElementById("btn-player-photo");
  const photoInput = document.getElementById("player-edit-photo-input");
  const avatarEl = document.getElementById("player-edit-avatar");

  if(photoBtn && photoInput){
    photoBtn.addEventListener("click", ()=> photoInput.click());
    if(avatarEl) avatarEl.addEventListener("click", ()=> photoInput.click());
    photoInput.addEventListener("change", (e)=>{
      const file = e.target.files?.[0];
      if(!file) return;
      _editPhotoFile = file;
      const url = URL.createObjectURL(file);
      avatarEl.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;
    });
  }

  const saveBtn = document.getElementById("btn-player-edit-save");
  if(saveBtn){
    saveBtn.addEventListener("click", async ()=>{
      if(!_editingPlayer) return;
      const errEl = document.getElementById("player-edit-error");
      const name = document.getElementById("player-edit-name").value.trim();
      if(!name){ errEl.textContent = "Name ist erforderlich."; return; }

      saveBtn.disabled = true;
      saveBtn.textContent = "Speichere…";
      errEl.textContent = "";

      try{
        let photoUrl = _editingPlayer.photoUrl||null;
        if(_editPhotoFile && window.dartDB?.uploadPlayerPhoto){
          photoUrl = await window.dartDB.uploadPlayerPhoto(_editingPlayer.id, _editPhotoFile);
        }
        const profileData = {
          name,
          nickname: document.getElementById("player-edit-nickname").value.trim()||null,
          dartBrand: document.getElementById("player-edit-brand").value.trim()||null,
          dartWeight: parseFloat(document.getElementById("player-edit-weight").value)||null,
          ...(photoUrl !== (_editingPlayer.photoUrl||null) ? {photoUrl} : {})
        };
        await window.dartDB.updatePlayerProfile(_editingPlayer.id, profileData);
        _closeEditDialog();
        await loadPlayers();
      }catch(e){
        errEl.textContent = "Fehler: " + e.message;
      }finally{
        saveBtn.disabled = false;
        saveBtn.textContent = "SPEICHERN";
      }
    });
  }

  // Close on backdrop click
  const backdrop = document.getElementById("player-edit-backdrop");
  if(backdrop){
    backdrop.addEventListener("click", (e)=>{
      if(e.target === backdrop) _closeEditDialog();
    });
  }
});

/** Applies stored settings to the UI. */
export function applySettings(){
  const micOn=localStorage.getItem("dart_mic_enabled")!=="false";
  document.querySelectorAll("#lp-mic,#bottom-mic").forEach(b=>{
    if(b) b.style.display=micOn?"":"none";
  });
}
