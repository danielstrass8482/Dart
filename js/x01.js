/**
 * x01.js — X01 (501/301) game logic: start, render, click handler, advance.
 */

import { state } from './state.js';
import { buildBoard, hitFromXY, svgCoords, clearHits, redrawAllHits, clearCheckout, disableBoard, highlightCheckout } from './board.js';
import { soundBust, soundHit, soundApplause, soundLow, speakKeyWithCustom, speakScoreWithCustom, prewarmElevenLabs, getAudio } from './audio.js';
import { startMic, stopMic, maybeRestartMic, setVoiceFeedback, announceRequires, micEnabled, micActive } from './speech.js';
import { runBotTurn } from './bot.js';

/**
 * Starts a new X01 game.
 * @param {number} starter index of starting player
 */
export function startX01(starter=0){
  if(window.audioCtx&&window.audioCtx.state==="suspended") window.audioCtx.resume().catch(()=>{});
  const ac = getAudio();
  if(ac&&ac.state==="suspended") ac.resume().catch(()=>{});
  if(window.speechSynthesis?.paused) window.speechSynthesis.resume();
  state.x01={
    scores: state.cfg.players.map(()=>state.cfg.startScore),
    current: starter,
    round: 1,
    throws: [],
    hitDots: state.cfg.players.map(()=>[]),
    bust: false,
    winner: null,
    history: [],
    allThrows: state.cfg.players.map(()=>[]),
    historicThrows: state.cfg.players.map(()=>[]),
    lastTurnThrows: state.cfg.players.map(()=>[]),
    turnScores: state.cfg.players.map(()=>[]),
    first9: state.cfg.players.map(()=>null),
    checkoutAttempts: state.cfg.players.map(()=>0),
    checkoutHits: state.cfg.players.map(()=>0),
    doubleStats: state.cfg.players.map(()=>({})),
    bouncers: state.cfg.players.map(()=>0),
    startTime: Date.now()
  };
  clearHits(state.boardSVG);
  renderX01();
  window.showScreen("x01");
  gameOnWhenLandscape();
  prewarmElevenLabs();
  if(state.cfg.isBot?.[state.x01.current]) setTimeout(runBotTurn,800);
}

/**
 * Plays "Game On" announcement once landscape is confirmed.
 */
function gameOnWhenLandscape(){
  if(!window.matchMedia("(orientation:portrait)").matches){
    setTimeout(()=>speakKeyWithCustom("game_on","Game on!"), 300);
    return;
  }
  let done=false;
  const fire=()=>{ if(done) return; done=true; setTimeout(()=>speakKeyWithCustom("game_on","Game on!"),300); };
  const handler=()=>{ if(!window.matchMedia("(orientation:portrait)").matches){ window.removeEventListener("orientationchange",handler); fire(); } };
  window.addEventListener("orientationchange",handler);
  setTimeout(()=>{ window.removeEventListener("orientationchange",handler); fire(); }, 6000);
}

/**
 * Renders the full X01 UI (score strip, landscape panel, throw slots, etc.)
 */
export function renderX01(){
  const CHECKOUTS = window._CHECKOUTS;
  const spent=state.x01.throws.reduce((s,t)=>s+t.score,0);
  const remaining=Math.max(0, state.x01.scores[state.x01.current]-spent);
  const co=remaining<=170&&remaining>1&&!state.x01.bust?CHECKOUTS[remaining]||"":null;
  const showNext=state.x01.throws.length>0&&!state.x01.winner;
  const isBust=state.x01.bust;

  // ── Score strip (portrait top) ───────────────────────────────
  const strip=document.getElementById("score-strip");
  if(strip){
    strip.innerHTML=state.cfg.players.map((name,i)=>{
      const isActive=i===state.x01.current&&!state.x01.winner;
      const throwChips=isActive&&state.x01.throws.length
        ? state.x01.throws.map(t=>{
            const col=t.miss?"#e53935":t.label.startsWith("T")?"#6bba8a":t.label.startsWith("D")?"#6aaada":"#ccc";
            return `<span style="font-family:'Bebas Neue',sans-serif;font-size:14px;padding:1px 5px;background:#2a2a2a;border-radius:4px;color:${col}">${t.label}</span>`;
          }).join(" ")
        : "";
      const coHint=isActive&&co?`<span style="color:#e8c44a;font-size:11px;margin-left:6px">→ ${co} · ${co.split(" ").length}-Dart Finish</span>`:"";
      const f9=state.x01.first9[i];
      const avgVal=state.x01.turnScores[i].length?Math.round(state.x01.turnScores[i].reduce((a,b)=>a+b,0)/state.x01.turnScores[i].length*10)/10:0;
      const legInfo=state.cfg.totalSets>1?`S${state.cfg.setWins[i]} `:state.cfg.totalLegs>1?`${"▪".repeat(state.cfg.legWins[i])} `:"";
      return `<div class="score-cell${isActive?" active":""}">
        <div class="sc-name">${legInfo}${name}</div>
        <div class="sc-score">${state.x01.scores[i]}</div>
        <div class="sc-throws">${throwChips}${coHint||(!throwChips?`<span style="color:#555;font-size:11px">Ø ${avgVal}${f9?` · F9 ${f9}`:""}</span>`:"")}</div>
      </div>`;
    }).join("");
  }

  // ── Landscape panel players ───────────────────────────────────
  const lpPlayers=document.getElementById("lp-players");
  if(lpPlayers){
    lpPlayers.innerHTML=state.cfg.players.map((name,i)=>{
      const isActive=i===state.x01.current&&!state.x01.winner;
      const chips=isActive?state.x01.throws.map(t=>{
        const cls=t.miss?"color:#e53935":t.label.startsWith("T")?"color:#6bba8a":t.label.startsWith("D")?"color:#6aaada":"color:#aaa";
        return `<span style="font-family:'Bebas Neue',sans-serif;font-size:14px;padding:2px 5px;background:#2a2a2a;border-radius:4px;${cls}">${t.label}</span>`;
      }).join(" "):"";
      const f9=state.x01.first9[i];
      const avgVal=state.x01.turnScores[i].length?Math.round(state.x01.turnScores[i].reduce((a,b)=>a+b,0)/state.x01.turnScores[i].length*10)/10:0;
      const legDots=state.cfg.totalLegs>1?`${"▪".repeat(state.cfg.legWins[i])}${"▫".repeat(Math.max(0,state.cfg.legsToWin-state.cfg.legWins[i]))} `:"";
      const setDots=state.cfg.totalSets>1?`Set ${state.cfg.setWins[i]} `:"";
      return `<div class="lp-player${isActive?" active":""}">
        <div class="lp-name">${setDots}${legDots}${name}</div>
        <div class="lp-score">${state.x01.scores[i]}</div>
        <div class="lp-throws">${isActive&&chips?chips:`Ø ${avgVal}${f9?` · F9 ${f9}`:""}`}</div>
      </div>`;
    }).join("");
  }

  // ── Remaining + checkout ──────────────────────────────────────
  const setEl=(id,val)=>{ const e=document.getElementById(id); if(e) e.textContent=val||""; };
  setEl("lp-remaining", remaining);
  const lpCoEl=document.getElementById("lp-checkout");
  if(lpCoEl){
    if(co){ const dc=co.split(" ").length; lpCoEl.innerHTML=`${co}<br><span style="font-size:10px">${dc}-Dart Finish</span>`; }
    else lpCoEl.textContent="";
  }
  setEl("bottom-remaining", remaining);
  setEl("bottom-checkout", co||"");

  // ── Throw slots ───────────────────────────────────────────────
  for(let i=0;i<3;i++){
    const t=state.x01.throws[i];
    const lbl=t?t.label:"—";
    const cls=t?(isBust&&i===state.x01.throws.length-1?"bust":t.bouncer?"bouncer":t.miss?"bust":"hit"):"";
    ["lp-slot-"+i,"bs-"+i].forEach(id=>{
      const el=document.getElementById(id);
      if(el){ el.textContent=lbl; el.className=(id.startsWith("lp")?"lp-slot":"bottom-slot")+(cls?" "+cls:""); }
    });
  }

  // ── Next button ───────────────────────────────────────────────
  const nextTxt=state.x01.throws.length<3?"ZÄHLEN":"WEITER";
  ["lp-next","bottom-next"].forEach(id=>{
    const el=document.getElementById(id);
    if(el){ el.style.display=(showNext&&!isBust)?"":"none"; el.textContent=nextTxt; el.className=(id==="lp-next"?"lp-btn":"bottom-btn")+" ok"; }
  });

  // ── Checkout highlight + title ────────────────────────────────
  const titleEl=document.getElementById("x01-title");
  if(titleEl){
    const legInfo=state.cfg.totalSets>1?`Set ${state.cfg.currentSet}/${state.cfg.totalSets} · Leg ${state.cfg.currentLeg}/${state.cfg.totalLegs}`:
      state.cfg.totalLegs>1?`Leg ${state.cfg.currentLeg}/${state.cfg.totalLegs}`:"";
    titleEl.textContent=`${state.cfg.mode}${legInfo?" · "+legInfo:""} · Runde ${state.x01.round}`;
  }

  if(remaining<=170&&remaining>1&&!state.x01.bust) highlightCheckout(state.boardSVG,remaining);
  else clearCheckout(state.boardSVG);
  disableBoard(state.boardSVG,!!state.x01.winner||state.x01.bust);

  // ── History table (landscape) ─────────────────────────────────
  renderTurnTableLP();
}

/** Renders the landscape history table. */
export function renderTurnTableLP(){
  const box=document.getElementById("lp-history");
  if(!box) return;
  const maxRounds=Math.max(...state.x01.turnScores.map(a=>a.length),1);
  let html=`<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#222">
      <th style="padding:5px 8px;color:#666;font-size:10px;letter-spacing:1px;text-align:left">WURF</th>`;
  state.cfg.players.forEach(p=>{ html+=`<th style="padding:5px 6px;color:#999;font-size:10px;letter-spacing:1px" colspan="2">${p}</th>`; });
  html+=`</tr></thead><tbody>`;
  let starts=state.cfg.players.map(()=>state.cfg.startScore);
  for(let r=0;r<maxRounds;r++){
    const isCur=r===maxRounds-1&&state.x01.throws.length>0;
    html+=`<tr style="background:${isCur?"#1a1a00":"transparent"};border-bottom:1px solid #222">
      <td style="padding:4px 8px;color:#555;font-size:11px">${r+1}</td>`;
    state.cfg.players.forEach((_,i)=>{
      const sc=state.x01.turnScores[i][r];
      const rest=sc!==undefined?starts[i]-sc:null;
      if(sc!==undefined){
        const col=sc>=100?"#6bba8a":sc>=60?"#aaa":sc<10?"#e53935":"#888";
        html+=`<td style="padding:4px 6px;font-family:'Bebas Neue',sans-serif;font-size:16px;color:${col};text-align:center">${sc}</td>
          <td style="padding:4px 6px;color:#666;font-size:13px;text-align:center">${rest||0}</td>`;
        starts[i]=rest||0;
      } else {
        html+=`<td style="padding:4px 6px;color:#333;text-align:center">—</td><td style="color:#333;text-align:center">—</td>`;
      }
    });
    html+=`</tr>`;
  }
  html+=`</tbody></table>`;
  box.innerHTML=html;
  setTimeout(()=>{ box.scrollTop=box.scrollHeight; },30);
}

/**
 * Handles click on the X01 dartboard SVG.
 * @param {PointerEvent} e
 */
export function handleX01Click(e){
  e.preventDefault();
  if(e.pointerType==="mouse"&&e.button!==0) return;
  if(state.x01.winner||state.x01.bust||state.x01.throws.length>=3) return;
  const {x,y}=svgCoords(state.boardSVG,e);
  const hit=hitFromXY(x,y);
  if(!hit) return;
  processX01Hit(hit, x, y);
}

/**
 * Processes a throw (from board tap, voice, or online) and updates game state.
 * @param {{score:number, label:string, miss?:boolean}} hit
 * @param {number|null} svgX
 * @param {number|null} svgY
 */
export function processX01Hit(hit, svgX=null, svgY=null){
  if(state.x01.winner||state.x01.bust||state.x01.throws.length>=3) return;

  state.x01.history.push({
    scores:[...state.x01.scores],
    current:state.x01.current,
    round:state.x01.round,
    throws:[...state.x01.throws],
    bust:state.x01.bust,
    historicLens:state.x01.historicThrows.map(a=>a.length),
    lastTurnThrows:state.x01.lastTurnThrows.map(a=>[...a]),
    turnScores:state.x01.turnScores.map(a=>[...a])
  });

  const throwObj={...hit,svgX,svgY};
  state.x01.throws.push(throwObj);
  state.x01.allThrows[state.x01.current].push(throwObj);
  redrawAllHits(state.boardSVG, state.x01.historicThrows[state.x01.current], state.x01.throws);
  if(state.cfg.online && window._pushThrowToRoom) window._pushThrowToRoom(hit);

  if(hit.miss){
    soundHit();
    renderX01();
    if(state.x01.throws.length===3){
      const turnScore=state.x01.throws.reduce((s,t)=>s+t.score,0);
      if(turnScore<=9) soundLow();
      turnScore===0?speakKeyWithCustom("no_score","No Score!"):speakScoreWithCustom(turnScore);
      setTimeout(announceRequires, 1600);
      setTimeout(advanceX01, 800);
    }
    return;
  }

  const spent=state.x01.throws.reduce((s,t)=>s+t.score,0);
  const prevSpent=spent-hit.score;
  const prevRemaining=state.x01.scores[state.x01.current]-prevSpent;
  const tent=prevRemaining-hit.score;

  if(prevRemaining<=170&&prevRemaining>1) state.x01.checkoutAttempts[state.x01.current]++;

  if(prevRemaining<=40&&prevRemaining%2===0&&prevRemaining>1)
    trackDoubleAttempt(state.x01.current, prevRemaining, hit);

  if(tent<0||tent===1){
    state.x01.bust=true;
    soundBust(); speakKeyWithCustom("bust","Bust!");
    renderX01();
    setTimeout(advanceX01, 1500);
    return;
  }
  if(tent===0){
    if(!hit.label.startsWith("D")&&hit.label!=="Bull"){
      state.x01.bust=true;
      soundBust(); speakKeyWithCustom("bust","Bust!");
      renderX01();
      setTimeout(advanceX01, 1500);
      return;
    }
    state.x01.scores[state.x01.current]=0;
    state.x01.winner=state.x01.current;
    state.x01.checkoutHits[state.x01.current]++;
    state.x01.turnScores[state.x01.current].push(state.x01.throws.reduce((s,t)=>s+t.score,0));
    soundApplause();
    handleLegWin(state.x01.current);
    renderX01();
    return;
  }

  const turnScore=state.x01.throws.reduce((s,t)=>s+t.score,0);
  if(state.x01.throws.length===3){
    if(turnScore<=9) soundLow();
    else if(turnScore>=100) soundApplause();
    else soundHit();
    turnScore===0?speakKeyWithCustom("no_score","No Score!"):speakScoreWithCustom(turnScore);
    setTimeout(announceRequires, 1600);
  } else {
    soundHit();
  }

  renderX01();
  if(state.x01.throws.length===3) setTimeout(advanceX01, 800);
}

/**
 * Handles a bouncer button press.
 */
export function handleBouncer(){
  if(!state.x01||state.x01.winner||state.x01.bust||state.x01.throws.length>=3) return;
  const pi=state.x01.current;
  const spent=state.x01.throws.reduce((s,t)=>s+t.score,0);
  const remaining=state.x01.scores[pi]-spent;
  if(remaining<=40&&remaining%2===0&&remaining>1)
    trackDoubleAttempt(pi, remaining, {label:"↩",bouncer:true});
  state.x01.bouncers[pi]++;
  state.x01.history.push({scores:[...state.x01.scores],throws:[...state.x01.throws],bust:state.x01.bust});
  state.x01.throws.push({score:0,label:"↩",bouncer:true,miss:false});
  speakKeyWithCustom("bouncer","Bouncer!");
  renderX01();
  if(state.x01.throws.length===3){
    setTimeout(announceRequires,1600);
    setTimeout(advanceX01,800);
  }
}

/**
 * Advances to the next player after a turn.
 */
export function advanceX01(){
  const pi=state.x01.current;

  if(state.x01.bust){
    state.x01.history.push({scores:[...state.x01.scores],current:pi,round:state.x01.round,
      throws:[...state.x01.throws],bust:true,
      historicLens:state.x01.historicThrows.map(a=>a.length),
      lastTurnThrows:state.x01.lastTurnThrows.map(a=>[...a]),
      turnScores:state.x01.turnScores.map(a=>[...a])});
    state.x01.lastTurnThrows[pi]=[...state.x01.throws];
    state.x01.historicThrows[pi].push(...state.x01.throws.filter(t=>t.svgX!=null));
    state.x01.throws=[]; state.x01.bust=false;
    const next=(pi+1)%state.cfg.players.length;
    state.x01.current=next;
    if(next===0) state.x01.round++;
    clearCheckout(state.boardSVG);
    redrawAllHits(state.boardSVG,state.x01.historicThrows[next],[]);
    renderX01(); maybeRestartMic();
    if(state.cfg.isBot?.[next]) setTimeout(runBotTurn,800);
    return;
  }

  const spent=state.x01.throws.reduce((s,t)=>s+t.score,0);
  state.x01.history.push({scores:[...state.x01.scores],current:pi,round:state.x01.round,
    throws:[...state.x01.throws],bust:false,
    historicLens:state.x01.historicThrows.map(a=>a.length),
    lastTurnThrows:state.x01.lastTurnThrows.map(a=>[...a]),
    turnScores:state.x01.turnScores.map(a=>[...a])});
  state.x01.turnScores[pi].push(spent);
  if(state.x01.turnScores[pi].length===3&&state.x01.first9[pi]===null)
    state.x01.first9[pi]=Math.round(state.x01.turnScores[pi].reduce((a,b)=>a+b,0)/3*10)/10;
  state.x01.scores[pi]-=spent;
  state.x01.lastTurnThrows[pi]=[...state.x01.throws];
  state.x01.historicThrows[pi].push(...state.x01.throws.filter(t=>t.svgX!=null));
  state.x01.throws=[]; state.x01.bust=false;
  clearCheckout(state.boardSVG);
  const next=(pi+1)%state.cfg.players.length;
  state.x01.current=next;
  if(next===0) state.x01.round++;
  redrawAllHits(state.boardSVG,state.x01.historicThrows[next],[]);
  renderX01(); maybeRestartMic();
  if(state.cfg.isBot?.[next]) setTimeout(runBotTurn,800);
}

/**
 * Handles leg win, set win, and match win logic.
 * @param {number} winnerIdx
 */
export function handleLegWin(winnerIdx){
  state.cfg.legWins[winnerIdx]++;
  const name=state.cfg.players[winnerIdx];

  if(window._saveGameToFirebase) window._saveGameToFirebase(winnerIdx);

  if(state.cfg.legWins[winnerIdx]>=state.cfg.legsToWin){
    state.cfg.setWins[winnerIdx]++;

    if(state.cfg.setWins[winnerIdx]>=state.cfg.setsToWin){
      showWinner(name, state.x01.round);
      return;
    }

    document.getElementById("set-label").textContent=`SET ${state.cfg.currentSet} GEWONNEN!`;
    document.getElementById("set-winner-name").textContent=name;
    const setScoreHtml=state.cfg.players.map((p,i)=>
      `${p}: <strong>${state.cfg.setWins[i]}</strong>`).join(" &nbsp;|&nbsp; ");
    document.getElementById("set-score-display").innerHTML=setScoreHtml;
    document.getElementById("set-to-win").textContent=
      `Noch ${state.cfg.setsToWin-state.cfg.setWins[winnerIdx]} Set(s) zum Sieg`;
    document.getElementById("set-overlay").classList.add("visible");
    return;
  }

  const legNum=state.cfg.currentLeg;
  document.getElementById("leg-label").textContent=
    state.cfg.totalSets>1
      ? `SET ${state.cfg.currentSet} · LEG ${legNum} GEWONNEN!`
      : `LEG ${legNum} GEWONNEN!`;
  document.getElementById("leg-winner-name").textContent=name;
  const scoreHtml=state.cfg.players.map((p,i)=>
    `${p}: <strong>${state.cfg.legWins[i]}</strong> Leg${state.cfg.legWins[i]!==1?"s":""}`).join(" &nbsp;|&nbsp; ");
  document.getElementById("leg-score-display").innerHTML=scoreHtml;
  document.getElementById("leg-to-win").textContent=
    `Noch ${state.cfg.legsToWin-state.cfg.legWins[winnerIdx]} Leg(s) zum Set`;

  const legStats=document.getElementById("leg-stats-summary");
  if(legStats){
    legStats.innerHTML=state.cfg.players.map((p,i)=>{
      if(state.cfg.isBot?.[i]) return "";
      const turns=state.x01.turnScores[i]||[];
      if(!turns.length) return "";
      const avg=Math.round(turns.reduce((a,b)=>a+b,0)/turns.length*10)/10;
      const best=Math.max(...turns);
      const coAtt=state.x01.checkoutAttempts[i]||0;
      const coHit=state.x01.checkoutHits[i]||0;
      const coPct=coAtt>0?Math.round(coHit/coAtt*100):0;
      const f9=state.x01.first9[i];
      const isWinner=i===winnerIdx;
      return `<div style="background:${isWinner?"rgba(232,196,74,0.15)":"rgba(255,255,255,0.05)"};
        border:1px solid ${isWinner?"#e8c44a":"rgba(255,255,255,0.1)"};
        border-radius:10px;padding:10px 14px;text-align:left">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;color:${isWinner?"#e8c44a":"#ccc"};letter-spacing:1px;margin-bottom:6px">
          ${isWinner?"🏆 ":""}${p}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr${f9?` 1fr`:""};gap:4px 12px;font-size:12px;color:#aaa">
          <span>Ø Aufnahme</span><span>Best</span><span>CO%</span>${f9?"<span>First 9</span>":""}
          <span style="color:#fff;font-weight:600;font-size:15px">${avg}</span>
          <span style="color:#fff;font-weight:600;font-size:15px">${best}</span>
          <span style="color:#fff;font-weight:600;font-size:15px">${coPct}%</span>
          ${f9?`<span style="color:#fff;font-weight:600;font-size:15px">${f9}</span>`:""}
        </div>
      </div>`;
    }).join("");
  }

  document.getElementById("leg-overlay").classList.add("visible");
}

/**
 * Shows the winner overlay.
 * @param {string} name
 * @param {number} round
 */
export function showWinner(name,round){
  document.getElementById("winner-name").textContent=name;
  const legInfo = state.cfg.totalSets>1
    ? `${state.cfg.players.map((p,i)=>`${p}: ${state.cfg.setWins[i]} Set${state.cfg.setWins[i]!==1?'s':''}`).join(' | ')}`
    : state.cfg.totalLegs>1
      ? `${state.cfg.legWins.map((w,i)=>state.cfg.players[i]+": "+w+" Leg"+( w!==1?"s":"")).join(" | ")}`
      : `Runde ${round}`;
  document.getElementById("winner-round").textContent=legInfo;

  const sumEl=document.getElementById("winner-summary");
  if(sumEl&&state.cfg.mode!=="Cricket"&&state.x01.turnScores){
    let html="";
    state.cfg.players.forEach((p,i)=>{
      if(state.cfg.isBot?.[i]) return;
      const turns=state.x01.turnScores[i];
      if(!turns.length) return;
      const avg=Math.round(turns.reduce((a,b)=>a+b,0)/turns.length*10)/10;
      const best=Math.max(...turns);
      const f9=state.x01.first9?.[i];
      const coAtt=state.x01.checkoutAttempts?.[i]||0;
      const coHit=state.x01.checkoutHits?.[i]||0;
      const coPct=coAtt>0?Math.round(coHit/coAtt*100):0;
      html+=`<div style="margin-bottom:10px;text-align:left;background:rgba(255,255,255,0.05);border-radius:8px;padding:10px 14px">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:#e8c44a;letter-spacing:1px;margin-bottom:6px">${p}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:13px;color:#ccc">
          <span>Ø Aufnahme</span><span style="color:#fff;font-weight:600">${avg}</span>
          <span>Highscore</span><span style="color:#fff;font-weight:600">${best}</span>
          ${f9!==null?`<span>First 9 Ø</span><span style="color:#fff;font-weight:600">${f9}</span>`:""}
          <span>Checkout</span><span style="color:#fff;font-weight:600">${coHit}/${coAtt} (${coPct}%)</span>
          <span>Aufnahmen</span><span style="color:#fff;font-weight:600">${turns.length}</span>
        </div>
      </div>`;
    });
    sumEl.innerHTML=html;
    sumEl.style.display=html?"block":"none";
  }

  document.getElementById("winner-overlay").classList.add("visible");
  if(window._updateCoachLimitDisplay) window._updateCoachLimitDisplay();
  if(window._buildCoachPlayerSelector) window._buildCoachPlayerSelector();
  const winnerIdx=state.cfg.players.indexOf(name);
  const winnerPid=state.cfg.playerIds?.[winnerIdx]||null;
  if(winnerPid && window._loadCoachHistory) window._loadCoachHistory(winnerPid);
}

/**
 * Tracks double field attempt/hit statistics.
 * @param {number} playerIdx
 * @param {number} remaining
 * @param {{label:string, score:number}} hit
 */
export function trackDoubleAttempt(playerIdx, remaining, hit){
  if(remaining<=0||remaining>40||remaining%2!==0) return;
  const targetDouble=remaining/2;
  const key=`D${targetDouble}`;
  if(!state.x01.doubleStats[playerIdx][key])
    state.x01.doubleStats[playerIdx][key]={att:0,hit:0};
  state.x01.doubleStats[playerIdx][key].att++;
  if(hit.score===remaining&&(hit.label===`D${targetDouble}`||hit.label==="Bull"))
    state.x01.doubleStats[playerIdx][key].hit++;
}

/**
 * Gets double stats formatted for coach analysis.
 * @param {number} playerIdx
 * @returns {Array|null}
 */
export function getDoubleStatsForCoach(playerIdx){
  const ds=state.x01.doubleStats[playerIdx];
  if(!Object.keys(ds).length) return null;
  const entries=Object.entries(ds)
    .map(([k,v])=>({field:k,att:v.att,hit:v.hit,pct:v.att>0?Math.round(v.hit/v.att*100):0}))
    .filter(e=>e.att>=2)
    .sort((a,b)=>b.att-a.att);
  return entries;
}
