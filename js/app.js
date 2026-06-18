/**
 * app.js — Entry point. Imports all modules, wires event listeners, starts app.
 */

// ── Firebase (sets window.dartDB etc.) ───────────────────────────
import './firebase.js';

// ── i18n ─────────────────────────────────────────────────────────
import { t, setLang, getLang, applyTranslations, SUPPORTED_LANGS } from './i18n.js';

// Sicherstellen dass window.t gesetzt ist (für inline onclick-Handler in HTML)
window.t = t;

// ── Browser language detection (first visit only) ─────────────────
if(!localStorage.getItem('dart_lang')){
  const browserLang = navigator.language.startsWith('de') ? 'de' : 'en';
  localStorage.setItem('dart_lang', browserLang);
}

// ── Apply data-i18n translations ──────────────────────────────────
applyTranslations();
// Nochmal nach DOM-Ready, falls Elemente noch nicht existierten
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => applyTranslations(), 100);
});


// ── Premium ──────────────────────────────────────────────────────
import { registerBetaUser, BETA_MODE, canUseFeature, showPremiumOverlay } from './premium.js';

// ── Onboarding & Help ────────────────────────────────────────────
import { checkOnboarding, showOnboarding, showHelp } from './onboarding.js';

// ── State ────────────────────────────────────────────────────────
import { state } from './state.js';

// ── Board ────────────────────────────────────────────────────────
import {
  buildBoard, hitFromXY, svgCoords, clearHits, redrawAllHits, clearCheckout,
  disableBoard, highlightCheckout, drawMiniBoard, SECTORS, R, CX, CY,
  slicePath, CRICKET_TARGETS
} from './board.js?v=2';

// ── Audio ────────────────────────────────────────────────────────
import {
  unlockAudio, soundBust, soundHit, soundApplause, soundLow,
  speakScoreWithCustom, speakKeyWithCustom, speakScore, speak, doSpeak,
  numToWords, prewarmElevenLabs, voiceURLCache, elTTSCache, getVoiceId,
  fetchTTSUrl, testVoice, speakElevenLabs
} from './audio.js';

// ── Speech ───────────────────────────────────────────────────────
import { initMic, startMic, stopMic, setVoiceFeedback, announceRequires, maybeRestartMic, handleVoiceHit, parseVoiceThrow, micEnabled } from './speech.js';

// ── Bot ──────────────────────────────────────────────────────────
import { runBotTurn, BOT_PERSONALITIES } from './bot.js';

// ── X01 ──────────────────────────────────────────────────────────
import { startX01, renderX01, handleX01Click, processX01Hit, advanceX01, handleLegWin, showWinner, handleBouncer, trackDoubleAttempt, getDoubleStatsForCoach, showTargetOverlay, showTargetFeedback, calcTargetDistance } from './x01.js?v=2';

// ── Cricket ──────────────────────────────────────────────────────
import { startCricket, renderCricket, handleCricketClick, advanceCricket, setCricketBoard } from './cricket.js';

// ── Party ────────────────────────────────────────────────────────
import { startParty, renderParty, handlePartyClick, advanceParty, partyWin, setPartyBoard } from './party.js';

// ── Setup ────────────────────────────────────────────────────────
import {
  loadPlayers, renderPlayerList, renderProfilPlayerList, togglePlayer, playerColor, showScreen,
  showSetup, showSpielenCards, showSpielenSection, saveGameToFirebase,
  updateAllPlayerStats, updateAuthUI, applySettings, BOT_PERSONALITY_DESCS,
  updateRotateOverlay, detectContext
} from './setup.js?v=2';

// ── Stats ────────────────────────────────────────────────────────
import {
  loadAndRenderStats, renderStatsPlayerBar, getTimeRange, allGamesCache,
  statsSelectedPlayer, statsRange, statsFrom, statsTo,
  setStatsSelectedPlayer, setStatsRange, setStatsFrom, setStatsTo, setAllGamesCache,
  statsContext, setStatsContext
} from './stats.js';

// ── Coach ────────────────────────────────────────────────────────
import {
  buildCoachPrompt, formatCoachText, callClaudeViaProxy, callCoach,
  extractVideoFrames, buildVideoCoachPrompt, loadCoachHistory, loadCoachHistoryStats,
  loadCoachHistoryAnalyseTab, updateCoachLimitDisplay, coachCallsLeft, COACH_DAILY_LIMIT,
  recordCoachUsage, videoCoachCallsLeft, recordVideoCoachUsage, VIDEO_COACH_LIMIT,
  collectHealthData, initHealthChips, showHealthModal
} from './coach.js';

// ── Multiplayer ──────────────────────────────────────────────────
import {
  createRoom, joinRoom, showWaitingScreen, startOnlineGame, startOnlineGameAsHost,
  pushThrowToRoom, applyRemoteThrow,
  onlineMode, onlineLegs, onlineSets, currentRoomCode, isRoomHost, myOnlineName,
  setOnlineMode, setOnlineLegs, setOnlineSets
} from './multiplayer.js';

// ── Tournament ───────────────────────────────────────────────────
import {
  openTournamentSetup, renderTnPlayerList, loadTournaments, openTournamentView,
  renderTournamentView, startTournamentMatch, updateTournamentMatch, advanceKnockoutBracket,
  generateRoundRobin, generateKnockout, generateKnockoutRounds,
  setTnFormat, setTnMode, setTnLegs, setTnType,
  tnFormat, tnMode, tnLegs, tnType
} from './tournament.js';

// ── Studio ───────────────────────────────────────────────────────
import { initStudio, wireStudioButtons } from './studio.js';

// ── Voice settings ───────────────────────────────────────────────
import { elTTSCache as _elTTSCache } from './audio.js';

// ══════════════════════════════════════════════════════════════════
// CHECKOUT TABLE — exposed as window._CHECKOUTS for board/bot access
// ══════════════════════════════════════════════════════════════════
window._CHECKOUTS = {
  170:"T20 T20 Bull",167:"T20 T19 Bull",164:"T20 T18 Bull",161:"T20 T17 Bull",
  160:"T20 T20 D20",158:"T20 T20 D19",157:"T20 T19 D20",156:"T20 T20 D18",
  155:"T20 T19 D19",154:"T20 T18 D20",153:"T20 T19 D18",152:"T20 T20 D16",
  151:"T20 T17 D20",150:"T20 T18 D18",149:"T20 T19 D16",148:"T20 T20 D14",
  147:"T20 T17 D18",146:"T20 T18 D16",145:"T20 T19 D14",144:"T20 T20 D12",
  143:"T20 T17 D16",142:"T20 T18 D14",141:"T20 T19 D12",140:"T20 T20 D10",
  139:"T20 T13 D25",138:"T20 T18 D12",137:"T20 T19 D10",136:"T20 T20 D8",
  135:"T20 T17 D12",134:"T20 T14 D16",133:"T20 T19 D8",132:"T20 T16 D12",
  131:"T20 T13 D16",130:"T20 T18 D8",129:"T19 T16 D12",128:"T18 T18 D10",
  127:"T20 T17 D8",126:"T19 T19 D6",125:"T20 T15 D10",124:"T20 T16 D8",
  123:"T19 T16 D9",122:"T18 T18 D7",121:"T20 T11 D14",120:"T20 S20 D20",
  119:"T19 T12 D13",118:"T20 S18 D20",117:"T20 S17 D20",116:"T20 S16 D20",
  115:"T20 S15 D20",114:"T20 S14 D20",113:"T20 S13 D20",112:"T20 S12 D20",
  111:"T20 S11 D20",110:"T20 S10 D20",109:"T20 S9 D20",108:"T20 S8 D20",
  107:"T19 S10 D20",106:"T20 S6 D20",105:"T20 S5 D20",104:"T20 S4 D20",
  103:"T20 S3 D20",102:"T20 S2 D20",101:"T20 S1 D20",100:"T20 D20",
  99:"T19 S10 D16",98:"T20 D19",97:"T19 D20",96:"T20 D18",95:"T19 D19",
  94:"T18 D20",93:"T19 D18",92:"T20 D16",91:"T17 D20",90:"T18 D18",
  89:"T19 D16",88:"T20 D14",87:"T17 D18",86:"T18 D16",85:"T19 D14",
  84:"T20 D12",83:"T17 D16",82:"T14 D20",81:"T19 D12",80:"T20 D10",
  79:"T13 D20",78:"T18 D12",77:"T19 D10",76:"T20 D8",75:"T17 D12",
  74:"T14 D16",73:"T19 D8",72:"T16 D12",71:"T13 D16",70:"T18 D8",
  69:"T19 D6",68:"T20 D4",67:"T17 D8",66:"T10 D18",65:"T19 D4",
  64:"T16 D8",63:"T13 D12",62:"T10 D16",61:"T15 D8",60:"S20 D20",
  59:"S19 D20",58:"S18 D20",57:"S17 D20",56:"S16 D20",55:"S15 D20",
  54:"S14 D20",53:"S13 D20",52:"S12 D20",51:"S11 D20",50:"D25",
  49:"S9 D20",48:"S8 D20",47:"S7 D20",46:"S6 D20",45:"S5 D20",
  44:"S4 D20",43:"S3 D20",42:"S2 D20",41:"S1 D20",40:"D20",
  39:"S7 D16",38:"D19",37:"S5 D16",36:"D18",35:"S3 D16",34:"D17",
  33:"S1 D16",32:"D16",31:"S7 D12",30:"D15",29:"S3 D13",28:"D14",
  27:"S3 D12",26:"D13",25:"S1 D12",24:"D12",23:"S7 D8",22:"D11",
  21:"S5 D8",20:"D10",19:"S3 D8",18:"D9",17:"S1 D8",16:"D8",
  15:"S7 D4",14:"D7",13:"S5 D4",12:"D6",11:"S3 D4",10:"D5",
  9:"S1 D4",8:"D4",7:"S3 D2",6:"D3",5:"S1 D2",4:"D2",3:"S1 D1",2:"D1"
};

// ══════════════════════════════════════════════════════════════════
// WIRE WINDOW CALLBACKS (used by modules to avoid circular imports)
// ══════════════════════════════════════════════════════════════════
window.showScreen = showScreen;
window.updateAuthUI = updateAuthUI;
window.loadPlayers = loadPlayers;
window._renderX01 = renderX01;
window._advanceX01 = advanceX01;
window._handleLegWin = handleLegWin;
window._showWinner = showWinner;
window._saveGameToFirebase = saveGameToFirebase;
window._pushThrowToRoom = pushThrowToRoom;
window._updateCoachLimitDisplay = updateCoachLimitDisplay;
window._buildCoachPlayerSelector = buildCoachPlayerSelector;
window._loadCoachHistory = loadCoachHistory;
window._updateTournamentMatch = updateTournamentMatch;
window._openTournamentView = openTournamentView;
window._boardOps = { redrawAllHits };

// ══════════════════════════════════════════════════════════════════
// INIT: Build boards, wire events
// ══════════════════════════════════════════════════════════════════

// Build dartboards
const boardSVG = document.getElementById("board-svg");
buildBoard(boardSVG);
state.boardSVG = boardSVG;

const boardSVGcr = document.getElementById("board-svg-cricket");
buildBoard(boardSVGcr);
setCricketBoard(boardSVGcr);

const boardSVGparty = document.getElementById("board-svg-party");
buildBoard(boardSVGparty);
setPartyBoard(boardSVGparty);

// Board click listeners — x01 board intercepts for target practice
boardSVG.addEventListener("pointerup", (e)=>{
  if(localStorage.getItem("dart_target_practice")==="true"&&
     !state.x01?.winner&&!state.x01?.bust&&(state.x01?.throws?.length||0)<3&&
     !state.x01?.currentTarget){
    showTargetOverlay(true);
    disableBoard(boardSVG, true);
    return;
  }
  const prevTarget=state.x01?.currentTarget||null;
  handleX01Click(e);
  if(prevTarget&&state.x01?.throws?.length){
    const lastThrow=state.x01.throws[state.x01.throws.length-1];
    showTargetFeedback(prevTarget, lastThrow);
    state.x01.currentTarget=null;
  }
});
boardSVGcr.addEventListener("pointerup", handleCricketClick);
boardSVGparty.addEventListener("pointerup", handlePartyClick);

// ── Audio unlock ──────────────────────────────────────────────────
document.addEventListener("pointerdown", unlockAudio, {once:true});
document.addEventListener("touchstart", unlockAudio, {once:true, passive:true});

// ── Orientation ───────────────────────────────────────────────────
window.addEventListener("orientationchange",()=>{
  setTimeout(()=>{
    updateRotateOverlay();
    if(window.speechSynthesis){
      window.speechSynthesis.cancel();
      const utt=new SpeechSynthesisUtterance("");
      utt.volume=0;
      window.speechSynthesis.speak(utt);
      window.speechSynthesis.cancel();
    }
  }, 300);
});
window.matchMedia("(orientation:portrait)").addEventListener("change", updateRotateOverlay);

// ── Mic init ──────────────────────────────────────────────────────
window.addEventListener("load", initMic);

// ── X01 navigation buttons ────────────────────────────────────────
document.getElementById("x01-back").addEventListener("click", showSetup);
document.getElementById("x01-undo").addEventListener("click",()=>{
  if(state.x01.history.length===0) return;
  const last=state.x01.history.pop();
  state.x01.scores=[...last.scores]; state.x01.current=last.current; state.x01.round=last.round;
  state.x01.throws=[...last.throws]; state.x01.bust=last.bust;
  last.historicLens.forEach((len,i)=>{ state.x01.historicThrows[i]=state.x01.historicThrows[i].slice(0,len); });
  state.x01.lastTurnThrows=last.lastTurnThrows.map(a=>[...a]);
  state.x01.turnScores=last.turnScores.map(a=>[...a]);
  state.x01.winner=null;
  document.getElementById("winner-overlay").classList.remove("visible");
  redrawAllHits(state.boardSVG,state.x01.historicThrows[state.x01.current],state.x01.throws);
  renderX01();
});
document.getElementById("lp-next").addEventListener("click", advanceX01);
document.getElementById("bottom-next").addEventListener("click", advanceX01);
// micEnabled is a live binding from speech.js — imported at top.
// We use a closure over the imported binding for mic button clicks.
document.getElementById("lp-mic").addEventListener("click",()=>{ if(!micEnabled) startMic(); else stopMic(); });
document.getElementById("bottom-mic").addEventListener("click",()=>{ if(!micEnabled) startMic(); else stopMic(); });
document.getElementById("lp-bouncer").addEventListener("click", handleBouncer);
document.getElementById("bottom-bouncer").addEventListener("click", handleBouncer);

// ── Cricket buttons ───────────────────────────────────────────────
document.getElementById("cr-next").addEventListener("click", advanceCricket);
document.getElementById("cr-undo").addEventListener("click",()=>{
  if(state.cr.history.length===0) return;
  const last=state.cr.history.pop();
  state.cr.marks=last.marks; state.cr.points=last.points;
  state.cr.current=last.current; state.cr.round=last.round;
  state.cr.throws=[]; state.cr.winner=null;
  if(last.historicLens) state.cr.historicThrows=state.cr.historicThrows.map((a,i)=>a.slice(0,last.historicLens[i]||0));
  document.getElementById("winner-overlay").classList.remove("visible");
  redrawAllHits(boardSVGcr, state.cr.historicThrows[state.cr.current], []);
  renderCricket();
});
document.getElementById("cr-back").addEventListener("click", showSetup);

// ── Party buttons ─────────────────────────────────────────────────
document.getElementById("party-next").addEventListener("click", advanceParty);
document.getElementById("party-undo").addEventListener("click",()=>{
  if(state.pg.history.length===0) return;
  const last=state.pg.history.pop();
  Object.assign(state.pg,last);
  state.pg.historicThrows=state.pg.historicThrows.map((a,i)=>a.slice(0,last.historicLens[i]||0));
  state.pg.throws=last.throws; state.pg.winner=null;
  document.getElementById("winner-overlay").classList.remove("visible");
  redrawAllHits(boardSVGparty,state.pg.historicThrows[state.pg.current],state.pg.throws);
  renderParty();
});
document.getElementById("party-back").addEventListener("click", showSetup);

// ── Winner overlay buttons ────────────────────────────────────────
document.getElementById("btn-new-game").addEventListener("click", showSetup);
document.getElementById("btn-next-set").addEventListener("click",()=>{
  document.getElementById("set-overlay").classList.remove("visible");
  state.cfg.currentSet++;
  state.cfg.currentLeg=1;
  state.cfg.legWins=state.cfg.players.map(()=>0);
  // PDC: set starter advances by 1 from the first leg starter of previous set
  state.cfg.currentLegStarter=((state.cfg.firstLegStarter||0)+1)%state.cfg.players.length;
  state.cfg.firstLegStarter=state.cfg.currentLegStarter;
  state.cfg.nextLegStarter=state.cfg.currentLegStarter;
  startX01(state.cfg.currentLegStarter);
});
document.getElementById("btn-next-leg").addEventListener("click",()=>{
  document.getElementById("leg-overlay").classList.remove("visible");
  state.cfg.currentLeg++;
  // PDC: strictly alternate leg starters
  state.cfg.currentLegStarter=state.cfg.nextLegStarter||0;
  startX01(state.cfg.currentLegStarter);
});
document.getElementById("btn-coach-leg")?.addEventListener("click",async(e)=>{
  e.preventDefault();
  e.stopPropagation();
  // Overlay bleibt offen — kein close, kein advanceX01
  const btn=document.getElementById("btn-coach-leg");
  const outputEl=document.getElementById("coach-output-leg");
  if(!btn||!outputEl) return;
  const i=state.x01.winner??0;
  const playerName=state.cfg.players[i]||state.cfg.players[0];
  let pid=state.cfg.playerIds?.[i]||null;
  const turns=state.x01.turnScores?.[i]||[];
  const avg=turns.length?Math.round(turns.reduce((a,b)=>a+b,0)/turns.length*10)/10:0;
  const best=turns.length?Math.max(...turns):0;
  const sessionStats={ mode:state.cfg.mode, rounds:state.x01.round, legOnly:true, players:[{ name:playerName, id:pid, avg3:avg, best3:best, checkoutAtt:state.x01.checkoutAttempts?.[i]||0, checkoutHit:state.x01.checkoutHits?.[i]||0, first9:state.x01.first9?.[i]||null, winner:true }] };
  const prompt=buildCoachPrompt(null, sessionStats, allGamesCache, pid, state.cfg.healthData||null);
  outputEl.innerHTML="";
  await callCoach(prompt, outputEl, null, btn);
  if(outputEl.querySelector(".coach-box")&&window.dartDB&&pid){
    const text=outputEl.querySelector(".coach-box").innerText;
    if(text&&!text.includes("Fehler")&&!text.includes("Error")){
      await window.dartDB.saveCoachAnalysis({ playerId:pid, playerName, type:"leg", text, mode:state.cfg.mode, avgPerTurn:avg, legNumber:state.cfg.currentLeg||1 });
    }
  }
});

// ── Setup form ────────────────────────────────────────────────────
let selectedMode="501";
let selectedLegs=1, selectedSets=1;
let selectedRounds=8;
let selectedBot="none", selectedPersonality="methodisch";
let selectedContext="auto";

const modeGroup=document.getElementById("mode-group");
const legsGroup=document.getElementById("legs-group");

modeGroup.addEventListener("click",e=>{
  if(!e.target.dataset.value) return;
  selectedMode=e.target.dataset.value;
  document.querySelectorAll("#extra-mode-group .btn-toggle").forEach(b=>b.classList.remove("active"));
  modeGroup.querySelectorAll(".btn-toggle").forEach(b=>b.classList.toggle("active",b.dataset.value===selectedMode));
  document.getElementById("rounds-selector").style.display="none";
});

document.getElementById("btn-extra-modes").addEventListener("click",()=>{
  const panel=document.getElementById("extra-modes");
  const btn=document.getElementById("btn-extra-modes");
  const open=panel.style.display==="none";
  panel.style.display=open?"block":"none";
  btn.textContent=open?`▲ ${t('weitere_modi').replace(/^▼\s*/,"")}`:t('weitere_modi');
});

document.getElementById("extra-mode-group").addEventListener("click",e=>{
  if(!e.target.dataset.value) return;
  selectedMode=e.target.dataset.value;
  modeGroup.querySelectorAll(".btn-toggle").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll("#extra-mode-group .btn-toggle").forEach(b=>b.classList.toggle("active",b.dataset.value===selectedMode));
  document.getElementById("rounds-selector").style.display=selectedMode==="Highscore"?"block":"none";
});

document.getElementById("sets-group").addEventListener("click",e=>{
  if(!e.target.dataset.value) return;
  selectedSets=+e.target.dataset.value;
  document.querySelectorAll("#sets-group .btn-toggle").forEach(b=>b.classList.toggle("active",b.dataset.value==selectedSets));
});

legsGroup.addEventListener("click",e=>{
  if(!e.target.dataset.value) return;
  selectedLegs=+e.target.dataset.value;
  legsGroup.querySelectorAll(".btn-toggle").forEach(b=>b.classList.toggle("active",b.dataset.value==selectedLegs));
});

document.getElementById("rounds-group")?.addEventListener("click",e=>{
  if(!e.target.dataset.value) return;
  selectedRounds=+e.target.dataset.value;
  document.querySelectorAll("#rounds-group .btn-toggle").forEach(b=>b.classList.toggle("active",b.dataset.value==selectedRounds));
});

document.getElementById("bot-group").addEventListener("click",e=>{
  if(!e.target.dataset.value) return;
  selectedBot=e.target.dataset.value;
  document.querySelectorAll("#bot-group .btn-toggle").forEach(b=>b.classList.toggle("active",b.dataset.value===selectedBot));
  document.getElementById("bot-personality-section").style.display=selectedBot==="none"?"none":"";
});

document.getElementById("bot-personality-group").addEventListener("click",e=>{
  if(!e.target.dataset.value) return;
  selectedPersonality=e.target.dataset.value;
  document.querySelectorAll("#bot-personality-group .btn-toggle").forEach(b=>b.classList.toggle("active",b.dataset.value===selectedPersonality));
  document.getElementById("bot-personality-desc").textContent=t(BOT_PERSONALITY_DESCS[selectedPersonality])||"";
});

document.getElementById("context-group")?.addEventListener("click",e=>{
  if(!e.target.dataset.value) return;
  selectedContext=e.target.dataset.value;
  document.querySelectorAll("#context-group .btn-toggle").forEach(b=>b.classList.toggle("active",b.dataset.value===selectedContext));
});

document.getElementById("btn-add-player").addEventListener("click", async ()=>{
  const input=document.getElementById("new-player-input");
  const name=input.value.trim();
  if(!name) return;
  if(state.allPlayers.find(p=>p.name.toLowerCase()===name.toLowerCase())){ alert(t('spieler_existiert')); return; }
  if(!window.dartDB){ alert(t('db_nicht_bereit')); return; }
  try{ await window.dartDB.savePlayer(name); input.value=""; await loadPlayers(); }
  catch(e){ alert(t('fehler_prefix')+e.message); }
});
document.getElementById("new-player-input").addEventListener("keydown",e=>{ if(e.key==="Enter") document.getElementById("btn-add-player").click(); });

// Neuer Spieler im Profil-Tab
document.getElementById("profil-btn-add-player")?.addEventListener("click", async ()=>{
  const input=document.getElementById("profil-new-player-input");
  const name=input.value.trim();
  if(!name) return;
  if(state.allPlayers.find(p=>p.name.toLowerCase()===name.toLowerCase())){ alert(t('spieler_existiert')); return; }
  if(!window.dartDB){ alert(t('db_nicht_bereit')); return; }
  try{ await window.dartDB.savePlayer(name); input.value=""; await loadPlayers(); }
  catch(e){ alert(t('fehler_prefix')+e.message); }
});
document.getElementById("profil-new-player-input")?.addEventListener("keydown",e=>{ if(e.key==="Enter") document.getElementById("profil-btn-add-player")?.click(); });

document.getElementById("btn-start").addEventListener("click",async()=>{
  if(state.selectedPlayers.length<1){ alert(t('min_1_spieler')); return; }
  if(selectedMode==="Killer"&&state.selectedPlayers.length<2&&selectedBot==="none"){ alert(t('killer_min_2')); return; }

  const healthData = localStorage.getItem("dart_health_enabled") !== "false" ? await collectHealthData() : null;

  const players=[...state.selectedPlayers.map(p=>p.name)];
  const playerIds=[...state.selectedPlayers.map(p=>p.id)];
  const isBot=[];
  isBot.length=players.length; isBot.fill(false);

  if(selectedBot!=="none"){
    const levelName=selectedBot==="easy"?t('bot_anfaenger'):selectedBot==="medium"?t('bot_mittel'):t('bot_profi');
    const pName=(BOT_PERSONALITIES[selectedPersonality]?.name||"🎯 Methodisch").split(" ").slice(0,2).join(" ");
    players.push(`${pName} Bot (${levelName})`); playerIds.push(null); isBot.push(true);
  }

  const humans=players.filter((_,i)=>!isBot[i]);
  const hasBot=isBot.some(Boolean);
  const detectedContext=detectContext(selectedContext, humans, hasBot);

  state.cfg={
    mode:selectedMode, startScore:selectedMode==="301"?301:501,
    players, playerIds, playerObjects:[...state.selectedPlayers], isBot,
    botLevel:selectedBot, botPersonality:selectedBot!=="none"?selectedPersonality:"methodisch",
    totalSets:selectedSets, setsToWin:Math.ceil(selectedSets/2), setWins:players.map(()=>0), currentSet:1,
    totalLegs:selectedLegs, legsToWin:Math.ceil(selectedLegs/2), legWins:players.map(()=>0), currentLeg:1,
    rounds:selectedRounds, healthData: healthData || null,
    currentLegStarter:0, nextLegStarter:0, firstLegStarter:0,
    context: detectedContext, tournamentId: null, tournamentName: null
  };
  const partyModes=["AtC","Shanghai","Highscore","Killer","Elimination"];
  if(state.cfg.mode==="Cricket") startCricket();
  else if(partyModes.includes(state.cfg.mode)) startParty();
  else startX01();
});

// ── Central render helper — always re-applies i18n after render ───
function renderAndTranslate(renderFn){
  renderFn();
  setTimeout(()=>applyTranslations(), 10);
}

// ── Tab switching ─────────────────────────────────────────────────
document.querySelectorAll(".home-tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".home-tab").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".home-tab-content").forEach(c=>c.classList.remove("active"));
    btn.classList.add("active");
    const tabEl=document.getElementById("tab-"+btn.dataset.tab);
    if(tabEl) tabEl.classList.add("active");
    applyTranslations();
    if(btn.dataset.tab==="statistiken") loadAndRenderStats();
    if(btn.dataset.tab==="turniere") loadTournaments();
    if(btn.dataset.tab==="profil") initProfilTab();
    if(btn.dataset.tab==="spielen") updateAuthUI(window.currentUser);
    // Nochmal nach dynamischem Render
    setTimeout(() => applyTranslations(), 100);
  });
});

// ── Sub-tabs (Statistiken) ────────────────────────────────────────
document.querySelectorAll(".sub-tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const bar=btn.closest(".sub-tabs-bar");
    bar.querySelectorAll(".sub-tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const tabContent=btn.closest(".home-tab-content");
    tabContent.querySelectorAll(".sub-tab-content").forEach(c=>c.classList.remove("active"));
    const target=tabContent.querySelector("#sub-tab-"+btn.dataset.sub);
    if(target) target.classList.add("active");
    if(btn.dataset.sub==="stats") loadAndRenderStats();
    if(btn.dataset.sub==="analyse") initAnalyseTab();
  });
});

// ── Stats time range buttons ──────────────────────────────────────
document.querySelectorAll(".time-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".time-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    setStatsRange(btn.dataset.range);
    const customRow=document.getElementById("custom-date-row");
    customRow.style.display=btn.dataset.range==="custom"?"flex":"none";
    if(btn.dataset.range!=="custom") loadAndRenderStats();
  });
});

document.querySelectorAll("#context-filter-bar .time-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll("#context-filter-bar .time-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    setStatsContext(btn.dataset.ctx);
    loadAndRenderStats();
  });
});

document.getElementById("btn-apply-dates").addEventListener("click",()=>{
  setStatsFrom(document.getElementById("date-from").value);
  setStatsTo(document.getElementById("date-to").value);
  if(statsFrom&&statsTo) loadAndRenderStats();
});

// ── Online multiplayer ────────────────────────────────────────────
document.getElementById("online-mode-group").addEventListener("click",e=>{
  if(!e.target.dataset.value) return;
  setOnlineMode(e.target.dataset.value);
  document.querySelectorAll("#online-mode-group .btn-toggle").forEach(b=>b.classList.toggle("active",b.dataset.value===onlineMode));
});
document.getElementById("online-legs-group").addEventListener("click",e=>{
  if(!e.target.dataset.value) return;
  setOnlineLegs(+e.target.dataset.value);
  document.querySelectorAll("#online-legs-group .btn-toggle").forEach(b=>b.classList.toggle("active",b.dataset.value==onlineLegs));
});
document.getElementById("online-sets-group").addEventListener("click",e=>{
  if(!e.target.dataset.value) return;
  setOnlineSets(+e.target.dataset.value);
  document.querySelectorAll("#online-sets-group .btn-toggle").forEach(b=>b.classList.toggle("active",b.dataset.value==onlineSets));
});
document.getElementById("btn-create-room").addEventListener("click", createRoom);
document.getElementById("btn-join-room").addEventListener("click", joinRoom);
document.getElementById("btn-start-online").addEventListener("click", startOnlineGameAsHost);
document.getElementById("btn-cancel-room").addEventListener("click",()=>{
  if(window._roomUnsubscribe){ window._roomUnsubscribe(); window._roomUnsubscribe=null; }
  if(isRoomHost&&currentRoomCode) window.dartDB?.deleteRoom(currentRoomCode);
  showSetup();
  document.querySelectorAll(".home-tab").forEach(b=>b.classList.toggle("active",b.dataset.tab==="spielen"));
  document.querySelectorAll(".home-tab-content").forEach(c=>c.classList.toggle("active",c.id==="tab-spielen"));
  showSpielenSection("online");
});

// ── Tournament form ───────────────────────────────────────────────
document.getElementById("tn-format-group")?.addEventListener("click",e=>{
  if(!e.target.dataset.value) return;
  setTnFormat(e.target.dataset.value);
  document.querySelectorAll("#tn-format-group .btn-toggle").forEach(b=>b.classList.toggle("active",b.dataset.value===tnFormat));
});
document.getElementById("tn-mode-group")?.addEventListener("click",e=>{
  if(!e.target.dataset.value) return;
  setTnMode(e.target.dataset.value);
  document.querySelectorAll("#tn-mode-group .btn-toggle").forEach(b=>b.classList.toggle("active",b.dataset.value===tnMode));
});
document.getElementById("tn-legs-group")?.addEventListener("click",e=>{
  if(!e.target.dataset.value) return;
  setTnLegs(+e.target.dataset.value);
  document.querySelectorAll("#tn-legs-group .btn-toggle").forEach(b=>b.classList.toggle("active",b.dataset.value==tnLegs));
});
document.getElementById("tn-type-group")?.addEventListener("click",e=>{
  if(!e.target.dataset.value) return;
  setTnType(e.target.dataset.value);
  document.querySelectorAll("#tn-type-group .btn-toggle").forEach(b=>b.classList.toggle("active",b.dataset.value===tnType));
  document.getElementById("tn-online-hint").style.display=tnType==="online"?"":"none";
});
document.getElementById("btn-create-tournament")?.addEventListener("click",async()=>{
  const name=document.getElementById("tn-name").value.trim()||t('tn_default');
  const checked=[...document.querySelectorAll("#tn-player-list input:checked")];
  if(checked.length<2){alert(t('tn_min_2_spieler'));return;}
  const players=checked.map(c=>{ const p=state.allPlayers.find(x=>x.id===c.value); return p?.name||"?"; });
  const playerIds=checked.map(c=>c.value);
  const matches=tnFormat==="round_robin" ? generateRoundRobin(players) : generateKnockout(players);
  const standings=players.map((_,i)=>({playerIdx:i, wins:0, losses:0, legsFor:0, legsAgainst:0}));
  const data={
    name, status:"running", format:tnFormat, mode:tnMode, legs:tnLegs, type:tnType,
    players, playerIds, matches, standings, bracket:tnFormat==="knockout"?{rounds:generateKnockoutRounds(players)}:null,
    createdBy:window.currentUser?.uid||null, winner:null
  };
  const id=await window.dartDB.saveTournament(data);
  data.id=id;
  openTournamentView(id);
});

// ── Auth screen ───────────────────────────────────────────────────
function authError(id, msg){ const el=document.getElementById(id); if(el) el.textContent=msg||""; }

document.querySelectorAll(".auth-tab-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".auth-tab-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const tab=btn.dataset.authTab;
    document.getElementById("auth-login").style.display=tab==="login"?"":"none";
    document.getElementById("auth-register").style.display=tab==="register"?"":"none";
    authError("login-error",""); authError("reg-error","");
  });
});
document.getElementById("btn-email-login").addEventListener("click",async()=>{
  const email=document.getElementById("login-email").value.trim();
  const pw=document.getElementById("login-password").value;
  authError("login-error","");
  if(!email||!pw){ authError("login-error",t('auth_email_pw')); return; }
  try{ await window.emailSignIn(email, pw); }
  catch(e){ authError("login-error", e.code==="auth/invalid-credential"||e.code==="auth/wrong-password"?t('auth_invalid_cred'):e.code==="auth/user-not-found"?t('auth_no_account'):e.message); }
});
document.getElementById("btn-google-login").addEventListener("click",async()=>{ authError("login-error",""); try{ await window.signInWithGoogle(); }catch(e){ authError("login-error",e.message); } });
document.getElementById("btn-forgot-password").addEventListener("click",async()=>{
  const email=document.getElementById("login-email").value.trim();
  if(!email){ authError("login-error",t('auth_email_only')); return; }
  try{ await window.resetPassword(email); authError("login-error",""); document.getElementById("login-error").style.color="var(--dart-success)"; document.getElementById("login-error").textContent=t('auth_reset_sent'); }
  catch(e){ authError("login-error",e.message); }
});
document.getElementById("btn-guest").addEventListener("click",async()=>{ try{ await window.signInAsGuest(); }catch(e){ authError("login-error",e.message); } });
document.getElementById("btn-email-register").addEventListener("click",async()=>{
  const name=document.getElementById("reg-name").value.trim();
  const email=document.getElementById("reg-email").value.trim();
  const pw=document.getElementById("reg-password").value;
  const pw2=document.getElementById("reg-password2").value;
  authError("reg-error","");
  if(!name){ authError("reg-error",t('auth_name_only')); return; }
  if(!email){ authError("reg-error",t('auth_email_only')); return; }
  if(pw.length<6){ authError("reg-error",t('auth_pw_short')); return; }
  if(pw!==pw2){ authError("reg-error",t('auth_pw_mismatch')); return; }
  try{ await window.emailRegister(email, pw, name); }
  catch(e){ authError("reg-error", e.code==="auth/email-already-in-use"?t('auth_email_taken'):e.message); }
});
document.getElementById("btn-google-register").addEventListener("click",async()=>{ authError("reg-error",""); try{ await window.signInWithGoogle(); }catch(e){ authError("reg-error",e.message); } });

// ── Language Switcher ─────────────────────────────────────────────
function buildLangSwitcher(){
  const wrap = document.getElementById('lang-switcher');
  if(!wrap) return;
  const lang = getLang();
  wrap.innerHTML = SUPPORTED_LANGS.map(l => {
    const isActive = l.code === lang;
    return `<button class="lang-btn" data-lang="${l.code}" style="flex:1;padding:10px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;
      border:2px solid ${isActive?'var(--dart-gold)':'var(--dart-border)'};
      background:${isActive?'var(--dart-accent-bg,rgba(212,175,55,.1))':'var(--dart-bg-chip)'};
      color:${isActive?'var(--dart-gold)':'var(--dart-text-sec)'}">${l.label}</button>`;
  }).join('');
  wrap.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => { setLang(btn.dataset.lang); buildLangSwitcher(); });
  });
}

function initLangSwitcher(){ buildLangSwitcher(); }

buildLangSwitcher();

// ── Profil-Tab ────────────────────────────────────────────────────
function initProfilTab(){
  const user=window.currentUser;
  const infoEl=document.getElementById("profil-account-info");
  const upgradeEl=document.getElementById("profil-upgrade-inline");
  if(!infoEl) return;
  if(!user){ infoEl.innerHTML=`<div style="font-size:14px;color:var(--dart-text-sec)">${t('nicht_angemeldet')}</div>`; if(upgradeEl) upgradeEl.style.display=""; return; }
  const displayName=user.displayName||t('gast_name');
  const email=user.email||"—";
  const isAnon=user.isAnonymous;
  infoEl.innerHTML=`
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
      <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#F4D77E,#C9A227);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#0c0b08;flex-shrink:0">${displayName[0].toUpperCase()}</div>
      <div>
        <div style="font-weight:800;font-size:16px;color:#FBFBF8">${displayName}</div>
        <div style="font-size:12px;color:#9A9AA2">${email}</div>
        <div style="font-size:10px;font-weight:700;color:#6E6E78;letter-spacing:.1em">${isAnon?t('gast_account'):t('registriert')}</div>
      </div>
    </div>`;
  if(upgradeEl) upgradeEl.style.display=isAnon?"":"none";
  renderPremiumStatus(isAnon, displayName, email);
  renderVoiceSelector();
  syncVoicesFromFirestore();
  renderProfilPlayerList();
  initToggles();
  initLangSwitcher();
}

function renderPremiumStatus(isAnon, displayName, email){
  const el = document.getElementById("profil-premium-status");
  if(!el) return;
  if(isAnon || !displayName || displayName === t('gast_name')){
    el.innerHTML = `
      <div style="background:var(--dart-bg-card);border:1px solid var(--dart-gold);border-radius:12px;padding:16px">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--dart-gold);
          letter-spacing:2px;margin-bottom:6px">🎉 ${t('beta_nutzer')}</div>
        <div style="font-size:13px;color:var(--dart-text-sec);margin-bottom:10px;line-height:1.5">
          ${t('beta_zugr')}
        </div>
        <button onclick="document.getElementById('profil-upgrade-inline').style.display=''"
          style="width:100%;padding:11px;background:var(--dart-gold);border:none;border-radius:8px;
          font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1px;
          color:#000;cursor:pointer">
          ${t('account_erstellen_btn')}
        </button>
      </div>`;
  } else {
    el.innerHTML = `
      <div style="background:var(--dart-bg-card);border:1px solid var(--dart-gold);border-radius:12px;padding:16px">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--dart-gold);
          letter-spacing:2px;margin-bottom:4px">${t('beta_grandfathered_title')}</div>
        <div style="font-size:13px;color:var(--dart-text-sec);margin-bottom:6px">${email}</div>
        <div style="font-size:13px;color:var(--dart-text-sec);line-height:1.5">
          ${t('beta_gesichert')}
        </div>
      </div>`;
  }
}
document.getElementById("btn-profil-signout")?.addEventListener("click",()=>window.signOutUser());
document.getElementById("btn-profil-upgrade")?.addEventListener("click",async()=>{
  const name=document.getElementById("profil-upgrade-name").value.trim();
  const email=document.getElementById("profil-upgrade-email").value.trim();
  const pw=document.getElementById("profil-upgrade-password").value;
  const errEl=document.getElementById("profil-upgrade-error");
  errEl.textContent="";
  if(!name||!email||pw.length<6){errEl.textContent=t('auth_fill_all');return;}
  try{ await window.upgradeAnonymousAccount(email,pw,name); alert(t('account_erstellt')); initProfilTab(); }
  catch(e){ errEl.textContent=e.code==="auth/email-already-in-use"?t('auth_email_taken2'):e.message; }
});
document.getElementById("btn-profil-google")?.addEventListener("click",async()=>{ try{ await window.signInWithGoogle(); initProfilTab(); }catch(e){} });

// ── Settings toggles ──────────────────────────────────────────────
// Checkbox lives inside its <label>, so a native click already toggles
// it once; an additional manual toggle (old onclick-based approach)
// raced with that and made the switch flip back on alternating clicks.
// Fix: rely solely on the checkbox's own "change" event, and clone+replace
// it on every init so re-opening the Profil tab can't stack listeners.
const SETTING_KEYS = { tts:"dart_tts_enabled", mic:"dart_mic_enabled", checkout:"dart_checkout_highlight", health:"dart_health_enabled" };
const SETTING_DEFAULTS = { tts:true, mic:true, checkout:true, health:true };

function updateToggleVisual(checkbox){
  const isOn=checkbox.checked;
  const slider=document.getElementById(checkbox.id+"-slider");
  if(!slider) return;
  slider.style.background=isOn?"linear-gradient(135deg,#F4D77E,#C9A227)":"#26262C";
  const knob=slider.firstElementChild;
  if(!knob) return;
  knob.style.left=isOn?"auto":"3px";
  knob.style.right=isOn?"3px":"auto";
  knob.style.background=isOn?"#0c0b08":"#6E6E78";
}

function initToggles(){
  Object.entries(SETTING_KEYS).forEach(([key, lsKey])=>{
    const old=document.getElementById("setting-"+key);
    if(!old) return;
    const stored=localStorage.getItem(lsKey);
    const isOn=stored!==null?stored==="true":SETTING_DEFAULTS[key];

    const fresh=old.cloneNode(true);
    fresh.checked=isOn;
    old.parentNode.replaceChild(fresh, old);
    updateToggleVisual(fresh);

    fresh.addEventListener("change",()=>{
      localStorage.setItem(lsKey, fresh.checked?"true":"false");
      updateToggleVisual(fresh);
      applySettings();
    });
  });
  applySettings();
}
initToggles();

// ── Coach (winner overlay) ────────────────────────────────────────
let coachSelectedPlayerIdx=0;

function buildCoachPlayerSelector(){
  const humanPlayers=state.cfg.players.filter((_,i)=>!state.cfg.isBot?.[i]);
  const sel=document.getElementById("coach-player-selector");
  const btns=document.getElementById("coach-player-btns");
  if(!sel||!btns) return;
  if(humanPlayers.length<=1){ sel.style.display="none"; coachSelectedPlayerIdx=0; return; }
  sel.style.display="";
  btns.innerHTML="";
  humanPlayers.forEach((name,hi)=>{
    const realIdx=state.cfg.players.indexOf(name);
    const col=playerColor(name);
    const btn=document.createElement("button");
    btn.style.cssText=`padding:6px 14px;border-radius:20px;border:2px solid ${col};background:${hi===0?col:"#2a2a2a"};cursor:pointer;font-size:13px;font-weight:600;color:${hi===0?"var(--dart-text)":"var(--dart-text-muted)"};box-shadow:${hi===0?"0 0 8px "+col:"none"}`;
    btn.textContent=name;
    btn.addEventListener("click",()=>{
      coachSelectedPlayerIdx=realIdx;
      btns.querySelectorAll("button").forEach((b,bi)=>{
        const bcol=playerColor(humanPlayers[bi]);
        b.style.background=bi===hi?bcol:"var(--dart-border)";
        b.style.color=bi===hi?"var(--dart-text)":"var(--dart-text-muted)";
        b.style.boxShadow=bi===hi?"0 0 8px "+bcol:"none";
      });
    });
    btns.appendChild(btn);
  });
  const winnerName=document.getElementById("winner-name").textContent;
  coachSelectedPlayerIdx=state.cfg.players.indexOf(winnerName);
}

document.getElementById("btn-coach-winner").addEventListener("click",async()=>{
  const btn=document.getElementById("btn-coach-winner");
  const outputEl=document.getElementById("coach-output-winner");
  const limitEl=document.getElementById("coach-limit-winner");
  const i=coachSelectedPlayerIdx;
  const playerName=state.cfg.players[i]||state.cfg.players[0];
  let playerStats=null;
  let pid=state.cfg.playerIds?.[i]||null;
  if(window.dartDB&&pid){ const players=await window.dartDB.loadPlayers(); const p=players.find(x=>x.id===pid); if(p) playerStats=p.stats; }
  const turns=state.x01.turnScores?.[i]||[];
  const avg=turns.length?Math.round(turns.reduce((a,b)=>a+b,0)/turns.length*10)/10:0;
  const best=turns.length?Math.max(...turns):0;
  const sessionStats={ mode:state.cfg.mode, rounds:state.cfg.mode!=="Cricket"?state.x01.round:state.cr.round, players:[{ name:playerName, id:pid, avg3:avg, best3:best, checkoutAtt:state.x01.checkoutAttempts?.[i]||0, checkoutHit:state.x01.checkoutHits?.[i]||0, first9:state.x01.first9?.[i]||null, winner:document.getElementById("winner-name").textContent===playerName }] };
  const prompt=buildCoachPrompt(playerStats, sessionStats, allGamesCache, pid, state.cfg.healthData||null);
  await callCoach(prompt, outputEl, limitEl, btn);
  if(outputEl.querySelector(".coach-box")&&window.dartDB){
    const text=outputEl.querySelector(".coach-box").innerText;
    if(text&&!text.includes("Fehler")&&!text.includes("Error")&&!text.includes("Limit")){
      await window.dartDB.saveCoachAnalysis({ playerId:pid, playerName, type:"text", text, mode:state.cfg.mode, avgPerTurn:avg });
      loadCoachHistory(pid);
    }
  }
});

document.getElementById("btn-toggle-history")?.addEventListener("click",()=>{
  const list=document.getElementById("coach-history-list");
  const btn=document.getElementById("btn-toggle-history");
  const open=list.style.display==="none";
  list.style.display=open?"":"none";
  btn.innerHTML=`<i data-lucide="list" style="width:14px;height:14px;stroke-width:2;vertical-align:middle"></i> ${t('gespeicherte_analysen')} ${open?"▲":"▼"}`; window.refreshIcons?.();
});

// ── Video Coach (winner) ──────────────────────────────────────────
let mediaStream=null, mediaRecorder=null, recordedChunks=[];

async function startVideoRecording(previewEl, recordBtn, stopBtn, wrapEl, analyzeBtn){
  try{
    mediaStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment",width:{ideal:1280},height:{ideal:720}},audio:false});
    previewEl.srcObject=mediaStream; previewEl.play();
    wrapEl.style.display=""; recordBtn.style.display="none"; stopBtn.style.display="";
    stopBtn.textContent="⏹ STOP (oder 5s warten)";
    if(analyzeBtn) analyzeBtn.style.display="none";
    recordedChunks=[]; mediaRecorder=new MediaRecorder(mediaStream,{mimeType:"video/webm"});
    mediaRecorder.ondataavailable=e=>{ if(e.data.size>0) recordedChunks.push(e.data); };
    mediaRecorder.onstop=()=>{
      const blob=new Blob(recordedChunks,{type:"video/webm"});
      const url=URL.createObjectURL(blob);
      previewEl.srcObject=null; previewEl.src=url; previewEl.load();
      mediaStream.getTracks().forEach(t=>t.stop());
      stopBtn.style.display="none"; recordBtn.style.display=""; recordBtn.textContent="📹 NEU AUFNEHMEN";
      previewEl.addEventListener("loadedmetadata",()=>{ if(analyzeBtn) analyzeBtn.style.display=""; },{once:true});
    };
    mediaRecorder.start();
    let countdown=5;
    const timer=setInterval(()=>{ countdown--; stopBtn.textContent=`⏹ STOP (${countdown}s)`; if(countdown<=0){ clearInterval(timer); if(mediaRecorder?.state==="recording") mediaRecorder.stop(); } },1000);
    stopBtn.onclick=()=>{ clearInterval(timer); if(mediaRecorder?.state==="recording") mediaRecorder.stop(); };
  }catch(err){ alert("Kamera nicht verfügbar: "+err.message); }
}

document.getElementById("btn-video-record-winner").addEventListener("click",()=>startVideoRecording(document.getElementById("video-preview"),document.getElementById("btn-video-record-winner"),document.getElementById("btn-video-stop-winner"),document.getElementById("video-preview-wrap"),document.getElementById("btn-video-analyze")));
document.getElementById("btn-video-record-analyse").addEventListener("click",()=>startVideoRecording(document.getElementById("video-preview-analyse-tab"),document.getElementById("btn-video-record-analyse"),document.getElementById("btn-video-stop-analyse"),document.getElementById("video-preview-wrap-analyse-tab"),document.getElementById("btn-video-analyze-analyse-tab")));

document.getElementById("btn-video-select").addEventListener("click",()=>document.getElementById("video-upload").click());
document.getElementById("video-upload").addEventListener("change",e=>{
  const file=e.target.files[0]; if(!file) return;
  const url=URL.createObjectURL(file);
  const preview=document.getElementById("video-preview");
  preview.src=url; preview.load();
  document.getElementById("video-preview-wrap").style.display="";
  document.getElementById("btn-video-select").textContent="📁 "+file.name.substring(0,30);
  preview.addEventListener("loadedmetadata",()=>{
    const dur=Math.round(preview.duration);
    document.getElementById("video-frames-info").textContent=`${dur}s · ${Math.round(preview.videoWidth)}×${Math.round(preview.videoHeight)}px · 5 Frames werden analysiert`;
    document.getElementById("btn-video-analyze").style.display="";
    document.getElementById("coach-output-video").innerHTML="";
  },{once:true});
});

document.getElementById("btn-video-analyze").addEventListener("click",async()=>{
  const access = await canUseFeature("videoAnalysis");
  if(!access.allowed){ showPremiumOverlay("videoAnalysis"); return; }
  const left=videoCoachCallsLeft();
  const outputEl=document.getElementById("coach-output-video");
  const btn=document.getElementById("btn-video-analyze");
  if(left<=0){ outputEl.innerHTML=`<div class="coach-box" style="margin-top:8px">${t('video_limit_msg').replace('{n}',VIDEO_COACH_LIMIT)}</div>`; return; }
  const videoEl=document.getElementById("video-preview");
  if(!videoEl.src){ alert("Bitte zuerst ein Video auswählen"); return; }
  btn.disabled=true; btn.textContent="⏳ Extrahiere Frames…";
  outputEl.innerHTML=`<div class="coach-box" style="margin-top:8px"><span style="color:var(--dart-text-sec)">Analysiere deine Wurftechnik…</span></div>`;
  try{
    const frames=await extractVideoFrames(videoEl, 5); btn.textContent="⏳ Claude analysiert…";
    const content=[{type:"text",text:buildVideoCoachPrompt(frames.length,null)},...frames.map((b64,i)=>({type:"image",source:{type:"base64",media_type:"image/jpeg",data:b64}})),{type:"text",text:`Frame-Reihenfolge: 1=Anfang, ${frames.length}=Ende der Wurfbewegung.`}];
    const data=await callClaudeViaProxy([{role:"user",content}]);
    const text=data.content?.[0]?.text||"Keine Antwort erhalten.";
    recordVideoCoachUsage();
    const newLeft=videoCoachCallsLeft();
    outputEl.innerHTML=`<div class="coach-box" style="margin-top:8px"><div class="coach-header"><i data-lucide="video" style="width:14px;height:14px;stroke-width:2;vertical-align:middle"></i> WURF-ANALYSE</div>${formatCoachText(text)}<div class="coach-limit" style="margin-top:8px">${newLeft} Video-Analysen heute verbleibend</div></div>`; window.refreshIcons?.();
    btn.innerHTML=`<i data-lucide="video" style="width:16px;height:16px;stroke-width:2;vertical-align:middle"></i> ERNEUT ANALYSIEREN`; window.refreshIcons?.(); btn.disabled=newLeft<=0;
    if(window.dartDB){ const pi=coachSelectedPlayerIdx; const pid=state.cfg.playerIds?.[pi]||null; const pName=state.cfg.players?.[pi]||"Unbekannt"; await window.dartDB.saveCoachAnalysis({playerId:pid,playerName:pName,type:"video",text,frameCount:frames.length}); }
  }catch(err){
    outputEl.innerHTML=`<div class="coach-box" style="margin-top:8px;border-color:var(--dart-danger)">Fehler: ${err.message}</div>`;
    btn.disabled=false; btn.textContent="🎥 WURF ANALYSIEREN";
  }
});

// ── Second Screen (Video Session) ────────────────────────────────
const APP_URL="https://danielstrass8482.github.io/Dart/dart.html";
let _videoSessionUnsubscribe=null, _videoSessionCode=null, _videoSessionAnalyzeCb=null;

async function startVideoHostSession(analyzeCb){
  if(!window.dartDB){ alert(t('db_nicht_bereit')); return; }
  const code=Math.random().toString(36).substring(2,6).toUpperCase();
  _videoSessionCode=code; _videoSessionAnalyzeCb=analyzeCb;
  await window.dartDB.createVideoSession(code, {});
  const url=`${APP_URL}?vidsession=${code}`;
  const qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=000000&bgcolor=ffffff&data=${encodeURIComponent(url)}`;
  document.getElementById("vidsession-code-display").textContent=code;
  document.getElementById("vidsession-qr-img").src=qrUrl;
  document.getElementById("vidsession-url-display").textContent=url;
  document.getElementById("vidsession-status").textContent="⏳ Warte auf Handy…";
  document.getElementById("vidsession-status").className="vidsession-status";
  document.getElementById("vidsession-backdrop").classList.add("visible");
  if(_videoSessionUnsubscribe) _videoSessionUnsubscribe();
  _videoSessionUnsubscribe=window.dartDB.watchVideoSession(code, async(data)=>{
    if(data.status==="connected"){ document.getElementById("vidsession-status").textContent="✅ Handy verbunden — nimmt auf…"; document.getElementById("vidsession-status").className="vidsession-status connected"; }
    if(data.status==="ready"&&data.videoPath){ cancelVideoSession(false); const videoUrl=await window.dartDB.getVideoSessionURL(code); if(videoUrl&&analyzeCb) analyzeCb(videoUrl); window.dartDB.deleteVideoSession(code).catch(()=>{}); }
  });
}

window.cancelVideoSession=function(cleanup=true){
  document.getElementById("vidsession-backdrop").classList.remove("visible");
  if(_videoSessionUnsubscribe){ _videoSessionUnsubscribe(); _videoSessionUnsubscribe=null; }
  if(cleanup&&_videoSessionCode) window.dartDB?.deleteVideoSession(_videoSessionCode).catch(()=>{});
  _videoSessionCode=null;
};

document.getElementById("btn-video-phone-winner").addEventListener("click",()=>startVideoHostSession(async(videoUrl)=>{ const videoEl=document.getElementById("video-preview"); videoEl.src=videoUrl; videoEl.load(); document.getElementById("video-preview-wrap").style.display=""; document.getElementById("video-frames-info").textContent="Video vom Handy erhalten — analysiere…"; document.getElementById("btn-video-analyze").style.display=""; document.getElementById("btn-video-analyze").click(); }));
document.getElementById("btn-video-phone-analyse").addEventListener("click",()=>startVideoHostSession(async(videoUrl)=>{ const videoEl=document.getElementById("video-preview-analyse-tab"); videoEl.src=videoUrl; videoEl.load(); document.getElementById("video-preview-wrap-analyse-tab").style.display=""; document.getElementById("video-frames-info-analyse-tab").textContent="Video vom Handy erhalten — analysiere…"; document.getElementById("btn-video-analyze-analyse-tab").style.display=""; document.getElementById("btn-video-analyze-analyse-tab").click(); }));

// ── Video Remote (Phone) ──────────────────────────────────────────
let vrMediaStream=null, vrMediaRecorder=null, vrRecordedChunks=[], vrVideoBlob=null, vrSessionCode=null;

async function initVideoRemote(code){
  vrSessionCode=code; showScreen("video-remote");
  const signalConnected=async()=>{ try{ await window.dartDB?.updateVideoSession(code,{status:"connected"}); }catch(e){} document.getElementById("vr-game-info").textContent=`Code: ${code} — Tablet wartet`; };
  if(window.dartDB) signalConnected(); else window.addEventListener("dbReady",()=>signalConnected(),{once:true});
  document.getElementById("btn-vr-record").addEventListener("click",startVrRecording);
  document.getElementById("btn-vr-send").addEventListener("click",sendVrVideo);
}

async function startVrRecording(){
  const recordBtn=document.getElementById("btn-vr-record"),stopBtn=document.getElementById("btn-vr-stop"),sendBtn=document.getElementById("btn-vr-send"),preview=document.getElementById("vr-preview"),status=document.getElementById("vr-status");
  try{
    vrMediaStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment",width:{ideal:1280},height:{ideal:720}},audio:false});
    preview.srcObject=vrMediaStream; preview.style.display=""; preview.play();
    recordBtn.style.display="none"; stopBtn.style.display=""; sendBtn.style.display="none"; vrVideoBlob=null;
    vrRecordedChunks=[]; vrMediaRecorder=new MediaRecorder(vrMediaStream,{mimeType:"video/webm"});
    vrMediaRecorder.ondataavailable=e=>{ if(e.data.size>0) vrRecordedChunks.push(e.data); };
    vrMediaRecorder.onstop=()=>{ vrVideoBlob=new Blob(vrRecordedChunks,{type:"video/webm"}); const url=URL.createObjectURL(vrVideoBlob); preview.srcObject=null; preview.src=url; vrMediaStream.getTracks().forEach(tk=>tk.stop()); stopBtn.style.display="none"; recordBtn.style.display=""; recordBtn.textContent=t('aufnahme_neu'); sendBtn.style.display=""; status.textContent=t('aufnahme_vorschau'); };
    vrMediaRecorder.start(); let countdown=10; status.textContent=`${t('aufnahme_laeuft')} (${countdown}s)`;
    const timer=setInterval(()=>{ countdown--; status.textContent=`${t('aufnahme_laeuft')} (${countdown}s)`; stopBtn.textContent=`⏹ STOP (${countdown}s)`; if(countdown<=0){ clearInterval(timer); if(vrMediaRecorder?.state==="recording") vrMediaRecorder.stop(); } },1000);
    stopBtn.onclick=()=>{ clearInterval(timer); if(vrMediaRecorder?.state==="recording") vrMediaRecorder.stop(); };
  }catch(err){ status.textContent=t('kamera_fehler')+err.message; }
}

async function sendVrVideo(){
  if(!vrVideoBlob||!vrSessionCode) return;
  const sendBtn=document.getElementById("btn-vr-send"),status=document.getElementById("vr-status");
  sendBtn.disabled=true; sendBtn.textContent="📤 Wird hochgeladen…"; status.textContent="Upload läuft…";
  try{
    await window.dartDB.uploadVideoBlob(vrSessionCode,vrVideoBlob);
    await window.dartDB.updateVideoSession(vrSessionCode,{status:"ready",videoPath:`dart_video_sessions/${vrSessionCode}.webm`});
    status.textContent="✅ Fertig! Das Tablet analysiert jetzt."; sendBtn.textContent="✅ Gesendet";
    document.getElementById("btn-vr-record").style.display="none";
  }catch(e){ status.textContent="Fehler: "+e.message; sendBtn.disabled=false; sendBtn.textContent="📤 AN TABLET SENDEN"; }
}

// ── URL param detection ───────────────────────────────────────────
(function detectVidSession(){
  const code=new URLSearchParams(window.location.search).get("vidsession");
  if(!code) return;
  document.querySelectorAll(".screen").forEach(s=>{ if(s.id!=="video-remote") s.style.display="none"; });
  const doInit=()=>initVideoRemote(code.toUpperCase());
  if(window.dartDB) doInit(); else window.addEventListener("dbReady",doInit,{once:true});
})();

// ── Analyse tab ───────────────────────────────────────────────────
let analyseSelectedPlayer=null;

async function initAnalyseTab(){
  if(!state.allPlayers.length && window.dartDB){ state.allPlayers=await window.dartDB.loadPlayers(); }
  if(!analyseSelectedPlayer && state.allPlayers.length){ analyseSelectedPlayer=state.allPlayers[0].id; }
  const bar=document.getElementById("analyse-player-bar");
  if(bar){
    bar.innerHTML=state.allPlayers.map(p=>{ const col=playerColor(p.name); const active=analyseSelectedPlayer===p.id?" active":""; return `<button class="stats-player-btn${active}" data-pid="${p.id}"><span class="spb-dot" style="background:${col}"></span>${p.name}</button>`; }).join("");
    bar.querySelectorAll(".stats-player-btn").forEach(btn=>{ btn.addEventListener("click",()=>{ analyseSelectedPlayer=btn.dataset.pid; initAnalyseTab(); }); });
  }
  const coachLeft=coachCallsLeft();
  const limitEl=document.getElementById("coach-limit-analyse-tab");
  const coachBtn=document.getElementById("btn-coach-analyse-tab");
  if(limitEl) limitEl.textContent=`${coachLeft} / ${COACH_DAILY_LIMIT} ${t('coach_limit')}`;
  if(coachBtn) coachBtn.disabled=coachLeft<=0;
  loadCoachHistoryAnalyseTab(analyseSelectedPlayer);
  renderVoiceSelector(); syncVoicesFromFirestore();
}

document.getElementById("btn-coach-analyse-tab").addEventListener("click",async()=>{
  const btn=document.getElementById("btn-coach-analyse-tab"), outputEl=document.getElementById("coach-output-analyse-tab"), limitEl=document.getElementById("coach-limit-analyse-tab");
  if(!analyseSelectedPlayer){ outputEl.innerHTML=`<div class="coach-box" style="margin-top:8px">${t('bitte_spieler_auswaehlen')}</div>`; return; }
  const p=state.allPlayers.find(x=>x.id===analyseSelectedPlayer);
  const prompt=buildCoachPrompt(p?.stats||null, null, allGamesCache, analyseSelectedPlayer);
  await callCoach(prompt, outputEl, limitEl, btn);
  if(outputEl?.querySelector(".coach-box")&&window.dartDB&&analyseSelectedPlayer){
    const text=outputEl.querySelector(".coach-box").innerText;
    if(text&&!text.includes("Fehler")&&!text.includes("Limit")){ await window.dartDB.saveCoachAnalysis({playerId:analyseSelectedPlayer,playerName:p?.name||"?",type:"text",text,avgPerTurn:p?.stats?.avgPerTurn||null}); loadCoachHistoryAnalyseTab(analyseSelectedPlayer); }
  }
});

document.getElementById("btn-video-select-analyse-tab").addEventListener("click",()=>document.getElementById("video-upload-analyse-tab").click());
document.getElementById("video-upload-analyse-tab").addEventListener("change",e=>{
  const file=e.target.files[0]; if(!file) return;
  const url=URL.createObjectURL(file);
  const preview=document.getElementById("video-preview-analyse-tab");
  preview.src=url; preview.load();
  document.getElementById("video-preview-wrap-analyse-tab").style.display="";
  document.getElementById("btn-video-select-analyse-tab").textContent="📁 "+file.name.substring(0,30);
  preview.addEventListener("loadedmetadata",()=>{ const dur=Math.round(preview.duration); document.getElementById("video-frames-info-analyse-tab").textContent=`${dur}s · ${Math.round(preview.videoWidth)}×${Math.round(preview.videoHeight)}px · 5 Frames werden analysiert`; document.getElementById("btn-video-analyze-analyse-tab").style.display=""; document.getElementById("coach-output-video-analyse-tab").innerHTML=""; },{once:true});
});
document.getElementById("btn-video-analyze-analyse-tab").addEventListener("click",async()=>{
  const access = await canUseFeature("videoAnalysis");
  if(!access.allowed){ showPremiumOverlay("videoAnalysis"); return; }
  const left=videoCoachCallsLeft(), outputEl=document.getElementById("coach-output-video-analyse-tab"), btn=document.getElementById("btn-video-analyze-analyse-tab");
  if(left<=0){ outputEl.innerHTML=`<div class="coach-box" style="margin-top:8px">${t('video_limit_msg').replace('{n}',VIDEO_COACH_LIMIT)}</div>`; return; }
  const videoEl=document.getElementById("video-preview-analyse-tab");
  if(!videoEl.src){ alert("Bitte zuerst ein Video auswählen"); return; }
  btn.disabled=true; btn.textContent="⏳ Extrahiere Frames…";
  outputEl.innerHTML=`<div class="coach-box" style="margin-top:8px"><span style="color:var(--dart-text-sec)">Analysiere deine Wurftechnik…</span></div>`;
  try{
    const frames=await extractVideoFrames(videoEl,5); btn.textContent="⏳ Claude analysiert…";
    const playerName=analyseSelectedPlayer?(state.allPlayers.find(x=>x.id===analyseSelectedPlayer)?.name||null):null;
    const content=[{type:"text",text:buildVideoCoachPrompt(frames.length,playerName)},...frames.map(b64=>({type:"image",source:{type:"base64",media_type:"image/jpeg",data:b64}})),{type:"text",text:`Frame-Reihenfolge: 1=Anfang, ${frames.length}=Ende der Wurfbewegung.`}];
    const data=await callClaudeViaProxy([{role:"user",content}]);
    const text=data.content?.[0]?.text||"Keine Antwort erhalten.";
    recordVideoCoachUsage(); const newLeft=videoCoachCallsLeft();
    outputEl.innerHTML=`<div class="coach-box" style="margin-top:8px"><div class="coach-header"><i data-lucide="video" style="width:14px;height:14px;stroke-width:2;vertical-align:middle"></i> WURF-ANALYSE</div>${formatCoachText(text)}<div class="coach-limit" style="margin-top:8px">${newLeft} Video-Analysen heute verbleibend</div></div>`; window.refreshIcons?.();
    btn.innerHTML=`<i data-lucide="video" style="width:16px;height:16px;stroke-width:2;vertical-align:middle"></i> ERNEUT ANALYSIEREN`; window.refreshIcons?.(); btn.disabled=newLeft<=0;
    if(window.dartDB&&analyseSelectedPlayer){ const p=state.allPlayers.find(x=>x.id===analyseSelectedPlayer); await window.dartDB.saveCoachAnalysis({playerId:analyseSelectedPlayer,playerName:playerName||p?.name||"Unbekannt",type:"video",text,frameCount:frames.length}); loadCoachHistoryAnalyseTab(analyseSelectedPlayer); }
  }catch(err){ outputEl.innerHTML=`<div class="coach-box" style="margin-top:8px;border-color:var(--dart-danger)">Fehler: ${err.message}</div>`; btn.disabled=false; btn.innerHTML=`<i data-lucide="video" style="width:16px;height:16px;stroke-width:2;vertical-align:middle"></i> WURF ANALYSIEREN`; window.refreshIcons?.(); }
});

// ── Voice Settings ────────────────────────────────────────────────
const BUILTIN_VOICES=[{id:"JBFqnCBsd6RMkjVDRZzb",name:"George",builtin:true},{id:"itKfO3PIfQAXJTALxBD6",name:"Daniel",builtin:true}];
let voicesCache=null;

function loadVoices(){ if(voicesCache) return voicesCache; try{ return JSON.parse(localStorage.getItem("dart_voices")||"null")||[...BUILTIN_VOICES]; }catch(e){ return [...BUILTIN_VOICES]; } }
function saveVoices(voices){ voicesCache=voices; localStorage.setItem("dart_voices",JSON.stringify(voices)); if(window.dartDB) window.dartDB.saveGlobalVoices(voices).catch(e=>console.warn("saveGlobalVoices:",e)); }
function setVoiceSyncStatus(msg){ const el=document.getElementById("voice-sync-status"); if(el) el.textContent=msg; }

async function syncVoicesFromFirestore(){
  if(!window.dartDB){ setVoiceSyncStatus("⚠ Datenbank nicht bereit"); return; }
  setVoiceSyncStatus("⏳ Sync…");
  try{
    const remote=await window.dartDB.loadGlobalVoices();
    if(remote&&remote.length){ voicesCache=remote; localStorage.setItem("dart_voices",JSON.stringify(remote)); renderVoiceSelector(); setVoiceSyncStatus("✓ Synced · "+remote.length+" Stimmen"); }
    else { const local=loadVoices(); if(local.some(v=>!v.builtin)){ saveVoices(local); setVoiceSyncStatus("✓ "+local.length+" Stimmen hochgeladen"); } else { setVoiceSyncStatus("✓ Nur Basis-Stimmen"); } }
  }catch(e){ console.warn("syncVoicesFromFirestore:",e); setVoiceSyncStatus("✗ Fehler: "+e.message); }
}

window.addEventListener("dbReady",async()=>{
  syncVoicesFromFirestore();
  try{ const voiceId=await window.dartDB.loadUserVoice(); if(voiceId){ localStorage.setItem("dart_active_voice_id",voiceId); renderVoiceSelector(); } }catch(e){ console.warn("loadUserVoice:",e); }
});

function showVoiceConfirm(msg){ const el=document.getElementById("voice-selector-confirm"); if(!el) return; el.textContent=msg; el.style.display=""; clearTimeout(el._t); el._t=setTimeout(()=>el.style.display="none",3000); }
function activateVoice(voiceId, voiceName){ localStorage.setItem("dart_active_voice_id",voiceId); Object.keys(elTTSCache).forEach(k=>delete elTTSCache[k]); if(window.dartDB) window.dartDB.saveUserVoice(voiceId).catch(e=>console.warn("saveUserVoice:",e)); renderVoiceSelector(); showVoiceConfirm(t('stimme_aktiviert_msg').replace('{name}',voiceName)); }

function renderVoiceSelector(){
  const list=document.getElementById("voice-selector-list"); if(!list) return;
  const voices=loadVoices(); const activeId=getVoiceId();
  const tvBtn="padding:7px 11px;border:1px solid var(--dart-border);border-radius:7px;background:var(--dart-bg-card);font-size:12px;cursor:pointer;color:var(--dart-text-sec);";
  list.innerHTML=voices.map((v,i)=>{
    const isActive=v.id===activeId; const shortId=v.id.length>22?v.id.slice(0,10)+"…"+v.id.slice(-8):v.id;
    const premiumBadge=!v.builtin?` <span style="background:var(--dart-gold);color:#000;font-size:9px;padding:2px 5px;border-radius:10px;vertical-align:middle">PREMIUM</span>`:"";
    return `<div style="border-radius:10px;padding:12px;margin-bottom:8px;transition:all .15s;${isActive?"background:rgba(212,175,55,.08);border:1px solid rgba(212,175,55,.35);border-left:3px solid var(--dart-gold);":"background:transparent;border-top:1px solid var(--dart-divider);"}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-weight:600;font-size:15px;color:var(--dart-text)"><i data-lucide="mic-2" style="width:14px;height:14px;stroke-width:2;vertical-align:middle"></i> ${v.name}${premiumBadge}</span>${isActive?`<span style="background:rgba(212,175,55,.15);color:var(--dart-gold);padding:2px 8px;border-radius:12px;font-size:11px;font-family:'Bebas Neue',sans-serif;letter-spacing:1px">● ${t('aktiv').toUpperCase()}</span>`:""}</div>
      <div style="font-size:11px;color:var(--dart-text-muted);font-family:monospace;margin-bottom:8px">ID: ${shortId}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button style="${tvBtn}" data-tv-id="${v.id}" data-tv-key="el_score_180" data-tv-text="One Hundred, and Eighty!">Test: 180</button>
        <button style="${tvBtn}" data-tv-id="${v.id}" data-tv-key="el_game_on" data-tv-text="Game on!">Test: Game On</button>
        <button style="${tvBtn}" data-tv-id="${v.id}" data-tv-key="el_bust" data-tv-text="Bust.">Test: Bust</button>
        ${isActive?`<button style="padding:7px 11px;border:none;border-radius:7px;background:var(--dart-success);color:var(--dart-text);font-size:12px;cursor:default;" disabled><i data-lucide="check" style="width:12px;height:12px;stroke-width:2;vertical-align:middle"></i> ${t('aktiv')}</button>`:`<button style="padding:7px 11px;border:none;border-radius:7px;background:var(--dart-bg-chip);color:var(--dart-text);font-size:12px;cursor:pointer;" data-activate-id="${v.id}" data-activate-name="${v.name}"><i data-lucide="check" style="width:12px;height:12px;stroke-width:2;vertical-align:middle"></i> ${t('aktivieren')}</button>`}
        ${!v.builtin?`<button style="padding:7px 11px;border:1px solid var(--dart-danger);border-radius:7px;background:rgba(200,54,43,.12);color:var(--dart-danger);font-size:12px;cursor:pointer;" data-delete-idx="${i}"><i data-lucide="trash-2" style="width:12px;height:12px;stroke-width:2;vertical-align:middle"></i></button>`:""}
      </div>
    </div>`;
  }).join("");
  list.querySelectorAll("[data-tv-id]").forEach(btn=>btn.addEventListener("click",()=>testVoice(btn.dataset.tvId,btn.dataset.tvKey,btn.dataset.tvText)));
  list.querySelectorAll("[data-activate-id]").forEach(btn=>btn.addEventListener("click",()=>activateVoice(btn.dataset.activateId,btn.dataset.activateName)));
  window.refreshIcons?.();
  list.querySelectorAll("[data-delete-idx]").forEach(btn=>btn.addEventListener("click",()=>{
    const vs=loadVoices(); const removed=vs.splice(parseInt(btn.dataset.deleteIdx),1)[0];
    if(removed.id===getVoiceId()){ const fallback=vs.find(v=>v.builtin)||vs[0]; if(fallback){ localStorage.setItem("dart_active_voice_id",fallback.id); Object.keys(elTTSCache).forEach(k=>delete elTTSCache[k]); } }
    saveVoices(vs); renderVoiceSelector();
  }));
}

document.getElementById("btn-voice-new-test-180").addEventListener("click",()=>{ const id=document.getElementById("voice-new-id").value.trim(); if(id) testVoice(id,"el_score_180","One Hundred, and Eighty!"); });
document.getElementById("btn-voice-new-test-gameon").addEventListener("click",()=>{ const id=document.getElementById("voice-new-id").value.trim(); if(id) testVoice(id,"el_game_on","Game on!"); });
document.getElementById("btn-voice-new-test-bust").addEventListener("click",()=>{ const id=document.getElementById("voice-new-id").value.trim(); if(id) testVoice(id,"el_bust","Bust."); });
document.getElementById("btn-voice-new-add").addEventListener("click",()=>{
  const name=document.getElementById("voice-new-name").value.trim(), id=document.getElementById("voice-new-id").value.trim(), errEl=document.getElementById("voice-new-error");
  if(!name||!id){ errEl.textContent="Name und Voice ID sind Pflichtfelder."; return; }
  const vs=loadVoices();
  if(vs.filter(v=>!v.builtin).length>=10){ errEl.textContent="Maximum 10 eigene Stimmen erreicht."; return; }
  if(vs.some(v=>v.id===id)){ errEl.textContent="Diese Voice ID ist bereits in der Liste."; return; }
  errEl.textContent=""; vs.push({id,name,builtin:false}); saveVoices(vs);
  document.getElementById("voice-new-name").value=""; document.getElementById("voice-new-id").value="";
  renderVoiceSelector(); showVoiceConfirm("✓ \""+name+"\" wurde hinzugefügt");
});
document.getElementById("btn-voice-sync").addEventListener("click",()=>syncVoicesFromFirestore());

// ── Wire healthchips ──────────────────────────────────────────────
initHealthChips();

// ── Wire studio buttons ───────────────────────────────────────────
wireStudioButtons();

// ── dbReady listeners ─────────────────────────────────────────────
window.addEventListener("dbReady", loadPlayers);
window.addEventListener("dbReady", applySettings);
window.addEventListener("dbReady", ()=>{ loadPlayers().then(()=>renderStatsPlayerBar()); });
window.addEventListener("dbReady", ()=>{
  const user = window.currentUser;
  if(user && !user.isAnonymous) registerBetaUser();
});

// ── Lucide icon refresh helper ────────────────────────────────────
window.refreshIcons = () => { if(window.lucide) lucide.createIcons(); };

// ── Expose globals for inline HTML onclick handlers ───────────────
window.showSpielenSection = showSpielenSection;
window.showSpielenCards = showSpielenCards;
window.openTournamentSetup = openTournamentSetup;
window.openTournamentView = openTournamentView;
window.loadTournaments = loadTournaments;
window.showSetup = showSetup;
window.showOnboarding = showOnboarding;
window.showHelp = showHelp;

// ── Onboarding ────────────────────────────────────────────────────
checkOnboarding();
