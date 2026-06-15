/**
 * x01.js — X01 (501/301) game logic: start, render, click handler, advance.
 */

import { state } from './state.js';
import { buildBoard, hitFromXY, svgCoords, clearHits, redrawAllHits, clearCheckout, disableBoard, highlightCheckout } from './board.js';
import { soundBust, soundHit, soundApplause, soundLow, speakKeyWithCustom, speakScoreWithCustom, prewarmElevenLabs, getAudio, queueAudio, clearAudioQueue } from './audio.js';
import { startMic, stopMic, maybeRestartMic, setVoiceFeedback, announceRequires, micEnabled, micActive } from './speech.js';
import { runBotTurn } from './bot.js';

/**
 * Returns appropriate delay (ms) before announcing "requires" based on turn score.
 * @param {number} turnScore
 * @returns {number}
 */
export function requiresDelay(turnScore){
  if(turnScore===0) return 2000;
  if(turnScore===180) return 3000;
  if(turnScore>=100) return 2500;
  if(turnScore>=20) return 2000;
  return 1500;
}

/**
 * Starts a new X01 game. Board is locked until "Game on!" audio completes.
 * @param {number} starter index of starting player
 */
export async function startX01(starter=0){
  if(window.audioCtx&&window.audioCtx.state==="suspended") window.audioCtx.resume().catch(()=>{});
  const ac = getAudio();
  if(ac&&ac.state==="suspended") ac.resume().catch(()=>{});
  if(window.speechSynthesis?.paused) window.speechSynthesis.resume();
  clearAudioQueue();
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
    checkoutAttemptThisTurn: false,
    doubleStats: state.cfg.players.map(()=>({})),
    bouncers: state.cfg.players.map(()=>0),
    startTime: Date.now()
  };
  clearHits(state.boardSVG);
  disableBoard(state.boardSVG, true);
  renderX01();
  window.showScreen("x01");
  prewarmElevenLabs();
  await queueAudio("Game on!","game_on");
  await new Promise(r=>setTimeout(r,300));
  disableBoard(state.boardSVG, false);
  if(state.cfg.isBot?.[state.x01.current]) setTimeout(runBotTurn,800);
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
      const playerObj=state.allPlayers?.find(pl=>pl.id===state.cfg.playerIds?.[i]);
      const displayName=playerObj?.nickname||name;
      const photoUrl=playerObj?.photoUrl||null;
      const playerScore=state.x01.scores[i];
      const playerRemaining=isActive?remaining:playerScore;
      const isCheckout=playerRemaining<=170&&playerRemaining>1&&!state.x01.bust;
      const throwChips=isActive&&state.x01.throws.length
        ? state.x01.throws.map(t=>{
            const col=t.miss?"#e53935":t.label.startsWith("T")?"#6bba8a":t.label.startsWith("D")?"#6aaada":"#ccc";
            return `<span style="font-family:'Bebas Neue',sans-serif;font-size:14px;padding:1px 5px;background:var(--dart-border);border-radius:4px;color:${col}">${t.label}</span>`;
          }).join(" ")
        : "";
      const coHint=isActive&&co?`<span style="color:var(--dart-gold);font-size:11px;margin-left:6px">→ ${co} · ${co.split(" ").length}-Dart Finish</span>`:"";
      const f9=state.x01.first9[i];
      const avgVal=state.x01.turnScores[i].length?Math.round(state.x01.turnScores[i].reduce((a,b)=>a+b,0)/state.x01.turnScores[i].length*10)/10:0;
      const legInfo=state.cfg.totalSets>1?`S${state.cfg.setWins[i]} `:state.cfg.totalLegs>1?`${"▪".repeat(state.cfg.legWins[i])} `:"";
      const scoreStyle=`transition:background .3s,color .3s;${isCheckout?"background:var(--dart-gold);color:#000;border-radius:5px;padding:0 5px;":""}`;
      const activeHeader=isActive?`
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:2px">
          ${photoUrl
            ?`<img src="${photoUrl}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid var(--dart-gold);flex-shrink:0">`
            :`<div style="width:34px;height:34px;border-radius:50%;background:var(--dart-border);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:var(--dart-gold);flex-shrink:0">${displayName.slice(0,2).toUpperCase()}</div>`
          }
          <div style="min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--dart-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${displayName}</div>
            <div style="font-size:9px;color:var(--dart-gold);letter-spacing:1px">AM ZUG</div>
          </div>
        </div>`
        :`<div class="sc-name">${legInfo}${displayName}</div>`;
      return `<div class="score-cell${isActive?" active":""}">
        ${activeHeader}
        <div class="sc-score" style="${scoreStyle}">${playerRemaining}</div>
        <div class="sc-throws">${throwChips}${coHint||(!throwChips?`<span style="color:var(--dart-text-muted);font-size:11px">Ø ${avgVal}${f9?` · F9 ${f9}`:""}</span>`:"")}</div>
      </div>`;
    }).join("");
  }

  // ── Landscape panel players ───────────────────────────────────
  const lpPlayers=document.getElementById("lp-players");
  if(lpPlayers){
    lpPlayers.innerHTML=state.cfg.players.map((name,i)=>{
      const isActive=i===state.x01.current&&!state.x01.winner;
      const playerObj=state.allPlayers?.find(pl=>pl.id===state.cfg.playerIds?.[i]);
      const displayName=playerObj?.nickname||name;
      const photoUrl=playerObj?.photoUrl||null;
      const playerScore=state.x01.scores[i];
      const lpRemaining=isActive?remaining:playerScore;
      const lpCheckout=lpRemaining<=170&&lpRemaining>1&&!state.x01.bust;
      const chips=isActive?state.x01.throws.map(t=>{
        const cls=t.miss?"color:var(--dart-danger)":t.label.startsWith("T")?"color:var(--dart-success)":t.label.startsWith("D")?"color:#6aaada":"color:var(--dart-text-sec)";
        return `<span style="font-family:'Bebas Neue',sans-serif;font-size:14px;padding:2px 5px;background:var(--dart-border);border-radius:4px;${cls}">${t.label}</span>`;
      }).join(" "):"";
      const f9=state.x01.first9[i];
      const avgVal=state.x01.turnScores[i].length?Math.round(state.x01.turnScores[i].reduce((a,b)=>a+b,0)/state.x01.turnScores[i].length*10)/10:0;
      const legDots=state.cfg.totalLegs>1?`${"▪".repeat(state.cfg.legWins[i])}${"▫".repeat(Math.max(0,state.cfg.legsToWin-state.cfg.legWins[i]))} `:"";
      const setDots=state.cfg.totalSets>1?`Set ${state.cfg.setWins[i]} `:"";
      const lpScoreStyle=`transition:background .3s,color .3s;${lpCheckout?"background:var(--dart-gold);color:#000;border-radius:8px;padding:0 8px;display:inline-block;":""}`;
      const activeAvatarHtml=isActive?`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
          ${photoUrl
            ?`<img src="${photoUrl}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid var(--dart-gold);flex-shrink:0">`
            :`<div style="width:40px;height:40px;border-radius:50%;background:var(--dart-border);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:var(--dart-gold);flex-shrink:0">${displayName.slice(0,2).toUpperCase()}</div>`
          }
          <div style="min-width:0">
            <div style="font-size:15px;font-weight:600;color:var(--dart-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${displayName}</div>
            <div style="font-size:9px;color:var(--dart-gold);letter-spacing:1px">AM ZUG</div>
          </div>
        </div>`:"";
      return `<div class="lp-player${isActive?" active":""}">
        ${isActive?activeAvatarHtml:`<div class="lp-name">${setDots}${legDots}${displayName}</div>`}
        <div class="lp-score" style="${lpScoreStyle}">${lpRemaining}</div>
        <div class="lp-throws">${isActive&&chips?chips:`Ø ${avgVal}${f9?` · F9 ${f9}`:""}`}</div>
      </div>`;
    }).join("");
  }

  // ── Remaining + checkout ──────────────────────────────────────
  const setEl=(id,val)=>{ const e=document.getElementById(id); if(e) e.textContent=val||""; };
  const inCheckoutZone=remaining<=170&&remaining>1&&!state.x01.bust;
  const lprEl=document.getElementById("lp-remaining");
  if(lprEl){
    lprEl.textContent=remaining;
    lprEl.style.cssText+=`;transition:background .3s,color .3s;background:${inCheckoutZone?"#e8c44a":"transparent"};color:${inCheckoutZone?"#000":"#fff"};border-radius:${inCheckoutZone?"10px":"0"};padding:${inCheckoutZone?"2px 12px":"0"};`;
  }
  const lpCoEl=document.getElementById("lp-checkout");
  if(lpCoEl){
    if(co){ const dc=co.split(" ").length; lpCoEl.innerHTML=`${co}<br><span style="font-size:10px">${dc}-Dart Finish</span>`; }
    else lpCoEl.textContent="";
  }
  const btrEl=document.getElementById("bottom-remaining");
  if(btrEl){
    btrEl.textContent=remaining;
    btrEl.style.cssText+=`;transition:background .3s,color .3s;background:${inCheckoutZone?"#e8c44a":"transparent"};color:${inCheckoutZone?"#000":"#fff"};border-radius:${inCheckoutZone?"8px":"0"};padding:${inCheckoutZone?"2px 8px":"0"};`;
  }
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
    <thead><tr style="background:var(--dart-bg-chip)">
      <th style="padding:5px 8px;color:var(--dart-text-muted);font-size:10px;letter-spacing:1px;text-align:left">WURF</th>`;
  state.cfg.players.forEach(p=>{ html+=`<th style="padding:5px 6px;color:var(--dart-text-sec);font-size:10px;letter-spacing:1px" colspan="2">${p}</th>`; });
  html+=`</tr></thead><tbody>`;
  let starts=state.cfg.players.map(()=>state.cfg.startScore);
  for(let r=0;r<maxRounds;r++){
    const isCur=r===maxRounds-1&&state.x01.throws.length>0;
    html+=`<tr style="background:${isCur?"#1a1a00":"transparent"};border-bottom:1px solid #222">
      <td style="padding:4px 8px;color:var(--dart-text-muted);font-size:11px">${r+1}</td>`;
    state.cfg.players.forEach((_,i)=>{
      const sc=state.x01.turnScores[i][r];
      const rest=sc!==undefined?starts[i]-sc:null;
      if(sc!==undefined){
        const col=sc>=100?"#6bba8a":sc>=60?"#aaa":sc<10?"#e53935":"#888";
        html+=`<td style="padding:4px 6px;font-family:'Bebas Neue',sans-serif;font-size:16px;color:${col};text-align:center">${sc}</td>
          <td style="padding:4px 6px;color:var(--dart-text-muted);font-size:13px;text-align:center">${rest||0}</td>`;
        starts[i]=rest||0;
      } else {
        html+=`<td style="padding:4px 6px;color:var(--dart-text-sec);text-align:center">—</td><td style="color:var(--dart-text-sec);text-align:center">—</td>`;
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

  const throwObj={...hit,svgX,svgY,leg:state.cfg.currentLeg||1};

  // PDC checkout attempt: count once per turn when score at turn-start ≤170
  if(state.x01.throws.length===0&&
     state.x01.scores[state.x01.current]<=170&&
     state.x01.scores[state.x01.current]>1&&
     state.x01.scores[state.x01.current]!==25&&
     !state.x01.checkoutAttemptThisTurn){
    state.x01.checkoutAttemptThisTurn=true;
    state.x01.checkoutAttempts[state.x01.current]++;
  }

  state.x01.throws.push(throwObj);
  state.x01.allThrows[state.x01.current].push(throwObj);
  redrawAllHits(state.boardSVG, state.x01.historicThrows[state.x01.current], state.x01.throws);
  if(state.cfg.online && window._pushThrowToRoom) window._pushThrowToRoom(hit);

  if(hit.miss){
    soundHit();
    renderX01();
    if(state.x01.throws.length===3){
      const turnScore=state.x01.throws.reduce((s,t)=>s+t.score,0);
      if(turnScore===0){ soundLow(); speakKeyWithCustom("no_score","No Score!"); }
      else if(turnScore<=9){ soundLow(); speakScoreWithCustom(turnScore); }
      else { soundHit(); speakScoreWithCustom(turnScore); }
      setTimeout(announceRequires, requiresDelay(turnScore));
      setTimeout(advanceX01, 800);
    }
    return;
  }

  const spent=state.x01.throws.reduce((s,t)=>s+t.score,0);
  const prevSpent=spent-hit.score;
  const prevRemaining=state.x01.scores[state.x01.current]-prevSpent;
  const tent=prevRemaining-hit.score;

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
    if(turnScore===0){ soundLow(); }
    else if(turnScore<=9){ soundLow(); }
    else if(turnScore>=100){ soundApplause(); }
    else { soundHit(); }
    const hitBull=state.x01.throws.some(t=>t.label==="Bull"||t.label==="Bull 25");
    turnScore===0?speakKeyWithCustom("no_score","No Score!"):speakScoreWithCustom(turnScore,hitBull);
    setTimeout(announceRequires, requiresDelay(turnScore));
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
    const bouncerTurnScore=state.x01.throws.reduce((s,t)=>s+t.score,0);
    setTimeout(announceRequires,requiresDelay(bouncerTurnScore));
    setTimeout(advanceX01,800);
  }
}

/**
 * Advances to the next player after a turn.
 */
export function advanceX01(){
  const pi=state.x01.current;

  state.x01.checkoutAttemptThisTurn=false;

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
  // PDC: leg starter strictly alternates regardless of winner
  state.cfg.nextLegStarter=((state.cfg.currentLegStarter||0)+1)%state.cfg.players.length;

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
        <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;color:${isWinner?"var(--dart-gold)":"var(--dart-border)"};letter-spacing:1px;margin-bottom:6px">
          ${isWinner?"🏆 ":""}${p}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr${f9?` 1fr`:""};gap:4px 12px;font-size:12px;color:var(--dart-text-sec)">
          <span>Ø Aufnahme</span><span>Best</span><span>CO%</span>${f9?"<span>First 9</span>":""}
          <span style="color:var(--dart-text);font-weight:600;font-size:15px">${avg}</span>
          <span style="color:var(--dart-text);font-weight:600;font-size:15px">${best}</span>
          <span style="color:var(--dart-text);font-weight:600;font-size:15px">${coPct}%</span>
          ${f9?`<span style="color:var(--dart-text);font-weight:600;font-size:15px">${f9}</span>`:""}
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
    // Compute per-player stats
    const playerStats=state.cfg.players.map((p,i)=>{
      if(state.cfg.isBot?.[i]) return null;
      const turns=state.x01.turnScores[i];
      if(!turns.length) return null;
      const avg=Math.round(turns.reduce((a,b)=>a+b,0)/turns.length*10)/10;
      const best=Math.max(...turns);
      const f9=state.x01.first9?.[i];
      const coAtt=state.x01.checkoutAttempts?.[i]||0;
      const coHit=state.x01.checkoutHits?.[i]||0;
      const coPct=coAtt>0?Math.round(coHit/coAtt*100):0;
      const pid=state.cfg.playerIds?.[i];
      const playerObj=state.allPlayers?.find(pl=>pl.id===pid);
      const displayName=playerObj?.nickname||p;
      const photoUrl=playerObj?.photoUrl||null;
      const isWinner=i===state.x01.winner;
      return {avg,best,f9,coAtt,coHit,coPct,displayName,photoUrl,isWinner,idx:i,pid,playerObj};
    });
    const humanStats=playerStats.filter(Boolean);

    if(!humanStats.length){ sumEl.style.display="none"; }
    else {
      const cols=humanStats.length>1?"1fr 1fr":"1fr";
      let html=`<div style="display:grid;grid-template-columns:${cols};gap:12px;margin-bottom:16px">`;
      humanStats.forEach(s=>{
        html+=`<div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:12px;
          border:${s.isWinner?"2px solid #e8c44a":"1px solid rgba(255,255,255,0.12)"};text-align:left">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            ${s.photoUrl
              ?`<img src="${s.photoUrl}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0">`
              :`<div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:var(--dart-text);flex-shrink:0">${s.displayName.slice(0,2).toUpperCase()}</div>`
            }
            <div style="min-width:0">
              <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dart-text)">${s.displayName}</div>
              ${s.isWinner?"<div style=\"font-size:10px;color:var(--dart-gold);letter-spacing:1px\">SIEGER</div>":""}
            </div>
          </div>
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <tr><td style="color:var(--dart-text-sec);padding:2px 0">Ø Aufnahme</td><td style="text-align:right;font-weight:600;color:var(--dart-text)">${s.avg}</td></tr>
            <tr><td style="color:var(--dart-text-sec);padding:2px 0">First 9</td><td style="text-align:right;color:var(--dart-text)">${s.f9!==null&&s.f9!==undefined?s.f9:"—"}</td></tr>
            <tr><td style="color:var(--dart-text-sec);padding:2px 0">Highscore</td><td style="text-align:right;color:var(--dart-text)">${s.best}</td></tr>
            <tr><td style="color:var(--dart-text-sec);padding:2px 0">Checkout</td><td style="text-align:right;color:var(--dart-text)">${s.coHit}/${s.coAtt} (${s.coPct}%)</td></tr>
          </table>
        </div>`;
      });
      html+="</div>";

      // Feature 4: Before / After overall stats
      humanStats.forEach(s=>{
        if(!s.pid) return;
        const pObj=s.playerObj;
        if(!pObj?.stats) return;
        const gamesBefore=pObj.stats.games||0;
        if(gamesBefore<1) return;
        const avgBefore=pObj.stats.avgPerTurn||0;
        const turns=state.x01.turnScores[s.idx]||[];
        if(!turns.length) return;
        const currentGameAvg=Math.round(turns.reduce((a,b)=>a+b,0)/turns.length*10)/10;
        const avgAfter=Math.round((avgBefore*gamesBefore+currentGameAvg)/(gamesBefore+1)*10)/10;
        const delta=Math.abs(Math.round((avgAfter-avgBefore)*10)/10);
        const improved=avgAfter>avgBefore;
        const declined=avgAfter<avgBefore;
        const statusText=improved?"↑ Verbesserung":declined?"↓ Leichter Rückgang":"→ Unverändert";
        const statusColor=improved?"#43a047":declined?"#e53935":"#888";
        const afterColor=improved?"#43a047":declined?"#e53935":"#fff";
        html+=`<div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:14px;margin-bottom:12px;text-align:left">
          <div style="font-size:11px;color:var(--dart-text-muted);letter-spacing:1px;margin-bottom:10px">${humanStats.length>1?s.displayName+" — ":""}GESAMTSTATISTIK</div>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div style="text-align:center">
              <div style="font-size:10px;color:var(--dart-text-muted)">VORHER</div>
              <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;font-weight:600;color:var(--dart-text-muted)">${avgBefore}</div>
              <div style="font-size:10px;color:var(--dart-text-muted)">${gamesBefore} Spiele</div>
            </div>
            <div style="font-size:22px;color:var(--dart-gold)">→</div>
            <div style="text-align:center">
              <div style="font-size:10px;color:var(--dart-text-muted)">JETZT</div>
              <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;font-weight:600;color:${afterColor}">${avgAfter}</div>
              <div style="font-size:10px;color:var(--dart-text-muted)">${gamesBefore+1} Spiele</div>
            </div>
          </div>
          <div style="text-align:center;margin-top:8px;font-size:12px;color:${statusColor}">${statusText} (${delta})</div>
        </div>`;
      });

      sumEl.innerHTML=html;
      sumEl.style.display="block";
    }
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

// ── Target Practice ────────────────────────────────────────────────
const SECTORS_TP=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];

/**
 * Calculates distance score between a target label and actual hit.
 * Returns 0 for exact hit, higher for further away.
 */
export function calcTargetDistance(targetLabel, actualHit){
  if(targetLabel===actualHit.label) return 0;
  const tNum=parseInt(targetLabel.replace(/[TDS]/,""))||0;
  const aNum=parseInt(actualHit.label.replace(/[TDS]/,""))||0;
  if(tNum===aNum){
    const tRing=targetLabel.startsWith("T")?2:targetLabel.startsWith("D")?1:0;
    const aRing=actualHit.label.startsWith("T")?2:actualHit.label.startsWith("D")?1:0;
    return Math.abs(tRing-aRing)*10;
  }
  const tIdx=SECTORS_TP.indexOf(tNum);
  const aIdx=SECTORS_TP.indexOf(aNum);
  if(tIdx<0||aIdx<0) return 100;
  const diff=Math.abs(tIdx-aIdx);
  return Math.min(diff,20-diff)*15+30;
}

/**
 * Shows or hides the target practice overlay before a throw.
 * @param {boolean} show
 */
export function showTargetOverlay(show){
  let overlay=document.getElementById("target-practice-overlay");
  if(!overlay){
    overlay=document.createElement("div");
    overlay.id="target-practice-overlay";
    overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px";
    overlay.innerHTML=`
      <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:3px;color:var(--dart-gold)">ZIEL-TRAINING</div>
      <div style="font-size:16px;color:var(--dart-text-sec)">Was willst du treffen?</div>
      <div id="tp-target-btns" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:320px"></div>
      <button id="tp-custom-btn" style="padding:8px 18px;background:var(--dart-bg-chip);border:1px solid var(--dart-border-alt);color:var(--dart-text-sec);border-radius:8px;font-size:13px;cursor:pointer">Eigenes ▼</button>
      <div id="tp-custom-row" style="display:none;gap:8px">
        <input id="tp-custom-input" placeholder="z.B. T20" style="padding:8px;background:var(--dart-bg-chip);border:1px solid var(--dart-border-alt);color:var(--dart-text);border-radius:8px;width:80px;font-size:15px;text-align:center"/>
        <button id="tp-custom-ok" style="padding:8px 14px;background:var(--dart-gold);border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">OK</button>
      </div>`;
    document.body.appendChild(overlay);

    const quickTargets=["T20","T19","T18","D20","D16","D10","Bull","S20","S19"];
    const btnWrap=overlay.querySelector("#tp-target-btns");
    quickTargets.forEach(t=>{
      const b=document.createElement("button");
      b.style.cssText="padding:10px 14px;background:var(--dart-bg-chip);border:2px solid var(--dart-border);color:var(--dart-text);border-radius:8px;font-family:'Bebas Neue',sans-serif;font-size:16px;cursor:pointer";
      b.textContent=t;
      b.addEventListener("click",()=>{ setTargetAndHide(t); });
      btnWrap.appendChild(b);
    });

    overlay.querySelector("#tp-custom-btn").addEventListener("click",()=>{
      overlay.querySelector("#tp-custom-row").style.display="flex";
    });
    overlay.querySelector("#tp-custom-ok").addEventListener("click",()=>{
      const val=overlay.querySelector("#tp-custom-input").value.trim().toUpperCase();
      if(val) setTargetAndHide(val);
    });
  }
  overlay.style.display=show?"flex":"none";
}

function setTargetAndHide(targetLabel){
  if(state.x01) state.x01.currentTarget=targetLabel;
  showTargetOverlay(false);
  disableBoard(state.boardSVG, false);
}

/**
 * Shows target practice feedback after a throw.
 */
export function showTargetFeedback(targetLabel, hit){
  if(!targetLabel) return;
  const dist=calcTargetDistance(targetLabel, hit);
  const msg=dist===0?"🎯 PERFEKT!":
    dist<=10?"✅ Richtiges Segment, falscher Ring":
    dist<=30?"👍 Benachbartes Segment":
    "❌ Weit daneben";
  const el=document.getElementById("target-feedback-toast");
  if(el){
    el.textContent=`${msg} (Ziel: ${targetLabel} → ${hit.label})`;
    el.style.display="";
    clearTimeout(el._t);
    el._t=setTimeout(()=>{ el.style.display="none"; }, 2000);
  }
}
