/**
 * x01.js — X01 (501/301) game logic: start, render, click handler, advance.
 */

import { state } from './state.js';
import { buildBoard, hitFromXY, svgCoords, clearHits, redrawAllHits, clearCheckout, disableBoard, highlightCheckout, drawMiniBoard } from './board.js?v=2';
import { speakKeyWithCustom, speakScoreWithCustom, prewarmElevenLabs, getAudio, queueAudio, clearAudioQueue, announceCheckoutPath } from './audio.js';
import { startMic, stopMic, maybeRestartMic, setVoiceFeedback, announceRequires, micEnabled, micActive } from './speech.js';
import { runBotTurn } from './bot.js';
import { t } from './i18n.js?v=3';

/**
 * Computes a checkout path ending in one of the preferred doubles.
 * Returns null if no path found or no preferences set.
 * @param {number} remaining
 * @param {number[]} prefDoubles e.g. [20, 16, 8]
 * @returns {string|null}
 */
function findPreferredCheckout(remaining, prefDoubles){
  if(!prefDoubles?.length) return null;
  const throws=[];
  for(let n=1;n<=20;n++){
    throws.push({v:n,s:`${n}`},{v:n*2,s:`D${n}`});
    if(n*3<=60) throws.push({v:n*3,s:`T${n}`});
  }
  throws.push({v:25,s:"25"},{v:50,s:"Bull"});
  for(const pd of prefDoubles){
    const finVal=pd===25?50:2*pd;
    const finStr=pd===25?"Bull":`D${pd}`;
    if(remaining===finVal) return finStr;
    const r2=remaining-finVal;
    if(r2>0&&r2<=60){
      const d1=throws.find(t=>t.v===r2);
      if(d1) return `${d1.s} ${finStr}`;
    }
    if(r2>0&&r2<=120){
      for(const t1 of throws.filter(t=>t.v<=60)){
        const r3=r2-t1.v;
        if(r3>0&&r3<=60){
          const t2=throws.find(t=>t.v===r3&&t.s!==t1.s);
          if(t2) return `${t1.s} ${t2.s} ${finStr}`;
        }
      }
    }
  }
  return null;
}

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
    checkoutScores: state.cfg.players.map(()=>[]),
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
  const _coActive=remaining<=170&&remaining>1&&!state.x01.bust;
  const _prefDoubles=(()=>{ if(!_coActive) return []; const pid=state.cfg.playerIds?.[state.x01.current]; const pl=state.allPlayers?.find(p=>p.id===pid); return pl?.prefDoubles||[]; })();
  const _optPath=_coActive?(CHECKOUTS[remaining]||""):"";
  const _prefPathRaw=_coActive?findPreferredCheckout(remaining,_prefDoubles):null;
  const _prefPath=(_prefPathRaw&&_optPath&&_prefPathRaw.split(" ").length===_optPath.split(" ").length)?_prefPathRaw:null;
  const co=_coActive?(_prefPath||_optPath||null):null;
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
      const legInfo=state.cfg.totalSets>1?`S${state.cfg.setWins[i]} `:state.cfg.totalLegs>1?`${"▪".repeat(state.cfg.legWins[i])} `:"";
      const scoreStyle=isActive
        ?`font-family:'Manrope',sans-serif;font-size:66px;font-weight:800;line-height:.85;letter-spacing:-0.04em;font-variant-numeric:tabular-nums;color:#FBFBF8;transition:background .3s,color .3s;${isCheckout?"background:var(--dart-gold);color:#000;border-radius:5px;padding:0 5px;":""}`
        :`font-family:'Manrope',sans-serif;font-size:32px;font-weight:800;letter-spacing:-0.04em;font-variant-numeric:tabular-nums;color:#9A9AA2;transition:background .3s,color .3s;${isCheckout?"background:var(--dart-gold);color:#000;border-radius:5px;padding:0 5px;":""}`;
      const activeHeader=isActive?`
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:2px">
          ${photoUrl
            ?`<img src="${photoUrl}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid #C9A227;flex-shrink:0">`
            :`<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#F4D77E,#C9A227);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#0c0b08;flex-shrink:0">${displayName.slice(0,2).toUpperCase()}</div>`
          }
          <div style="min-width:0">
            <div style="font-size:15px;font-weight:800;color:#FBFBF8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${displayName}</div>
            <div style="font-size:10px;font-weight:700;color:#C9A227;letter-spacing:.12em">${t('am_zug')}</div>
          </div>
        </div>`
        :`<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
          ${photoUrl
            ?`<img src="${photoUrl}" style="width:26px;height:26px;border-radius:50%;object-fit:cover;border:1px solid #303038;flex-shrink:0">`
            :`<div style="width:26px;height:26px;border-radius:50%;background:#1C1C21;border:1px solid #303038;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#9A9AA2;flex-shrink:0">${displayName.slice(0,2).toUpperCase()}</div>`
          }
          <div style="min-width:0">
            <div style="font-size:13px;font-weight:700;color:#C9C9D1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${legInfo}${displayName}</div>
          </div>
        </div>`;
      return `<div class="score-cell${isActive?" active":""}">
        ${activeHeader}
        ${isActive?`<div style="font-size:9px;font-weight:700;letter-spacing:.18em;color:#7E7E86;margin-top:2px">${t('verbleibend')}</div>`:""}
        <div class="sc-score" style="${scoreStyle}">${playerRemaining}</div>
      </div>`;
    }).join("");
  }

  // ── Info bar: throws + checkout (portrait, below score strip) ──
  const infoThrowsEl=document.getElementById("x01-throws-row");
  if(infoThrowsEl){
    if(state.x01.throws.length>0){
      const slots=[0,1,2].map(idx=>{
        const th=state.x01.throws[idx];
        if(!th) return `<span style="color:#6E6E78">—</span>`;
        const col=(th.miss||th.bouncer)?"var(--dart-danger)":"#D4AF37";
        return `<span style="color:${col}">${th.label}</span>`;
      });
      infoThrowsEl.innerHTML=slots.join(`<span style="color:#6E6E78;margin:0 4px">·</span>`);
    } else {
      infoThrowsEl.innerHTML="";
    }
  }
  const infoCheckoutEl=document.getElementById("x01-checkout-row");
  if(infoCheckoutEl) infoCheckoutEl.textContent=co||"";

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
      const f9=state.x01.first9[i];
      const avgVal=state.x01.turnScores[i].length?Math.round(state.x01.turnScores[i].reduce((a,b)=>a+b,0)/state.x01.turnScores[i].length*10)/10:0;
      const legDots=state.cfg.totalLegs>1?`${"▪".repeat(state.cfg.legWins[i])}${"▫".repeat(Math.max(0,state.cfg.legsToWin-state.cfg.legWins[i]))} `:"";
      const setDots=state.cfg.totalSets>1?`Set ${state.cfg.setWins[i]} `:"";
      const lpScoreStyle=isActive
        ?`font-family:'Manrope',sans-serif;font-size:3rem;font-weight:800;line-height:1;letter-spacing:-0.04em;font-variant-numeric:tabular-nums;color:#FBFBF8;transition:background .25s,color .25s;${lpCheckout?"background:var(--dart-gold);color:#000;border-radius:6px;padding:0 8px;display:inline-block;":""}`
        :`font-family:'Manrope',sans-serif;font-size:2rem;font-weight:800;letter-spacing:-0.04em;font-variant-numeric:tabular-nums;color:#9A9AA2;transition:background .25s,color .25s;${lpCheckout?"background:var(--dart-gold);color:#000;border-radius:6px;padding:0 5px;display:inline-block;":""}`;
      if(isActive){
        return `<div class="lp-player active">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            ${photoUrl
              ?`<img src="${photoUrl}" style="width:44px;height:36px;border-radius:8px;object-fit:cover;border:2px solid #C9A227;flex-shrink:0">`
              :`<div style="width:44px;height:36px;border-radius:8px;background:linear-gradient(135deg,#F4D77E,#C9A227);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:#0c0b08;flex-shrink:0">${displayName.slice(0,2).toUpperCase()}</div>`
            }
            <div style="min-width:0;flex:1">
              <div style="font-size:14px;font-weight:800;color:#D4AF37;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${displayName}</div>
              <div style="font-size:9px;font-weight:700;color:#C9A227;letter-spacing:.1em">${t('am_zug')}</div>
            </div>
          </div>
          <div class="lp-score" style="${lpScoreStyle}">${lpRemaining}</div>
        </div>`;
      } else {
        return `<div class="lp-player">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            ${photoUrl
              ?`<img src="${photoUrl}" style="width:36px;height:30px;border-radius:6px;object-fit:cover;border:1px solid #303038;flex-shrink:0">`
              :`<div style="width:36px;height:30px;border-radius:6px;background:#1C1C21;border:1px solid #303038;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#9A9AA2;flex-shrink:0">${displayName.slice(0,2).toUpperCase()}</div>`
            }
            <div style="min-width:0">
              <div style="font-size:12px;font-weight:700;color:#9A9AA2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${setDots}${legDots}${displayName}</div>
            </div>
          </div>
          <div class="lp-score" style="${lpScoreStyle}">${lpRemaining}</div>
          ${avgVal?`<div style="font-size:10px;font-weight:700;color:#6E6E78;margin-top:2px">Ø ${avgVal}${f9?` · F9 ${f9}`:""}</div>`:""}
        </div>`;
      }
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
    if(co){ const dc=co.split(" ").length; lpCoEl.innerHTML=`${co}<br><span style="font-size:10px">${dc}-${t('dart_finish')}</span>`; }
    else lpCoEl.textContent="";
  }

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

  // ── Checkout highlight + title ────────────────────────────────
  const titleEl=document.getElementById("x01-title");
  if(titleEl){
    const legInfo=state.cfg.totalSets>1?`Set ${state.cfg.currentSet}/${state.cfg.totalSets} · Leg ${state.cfg.currentLeg}/${state.cfg.totalLegs}`:
      state.cfg.totalLegs>1?`Leg ${state.cfg.currentLeg}/${state.cfg.totalLegs}`:"";
    titleEl.textContent=`${state.cfg.mode}${legInfo?" · "+legInfo:""} · ${t('runde')} ${state.x01.round}`;
  }

  if(_coActive){
    highlightCheckout(state.boardSVG,remaining,_prefPath);
  } else clearCheckout(state.boardSVG);
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
      <th style="padding:5px 8px;color:var(--dart-text-muted);font-size:10px;letter-spacing:1px;text-align:left">${t('wurf')}</th>`;
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
    renderX01();
    if(state.x01.throws.length===3){
      const turnScore=state.x01.throws.reduce((s,t)=>s+t.score,0);
      const hitBull=state.x01.throws.some(t=>t.label==="Bull"||t.label==="Bull 25");
      if(turnScore===0){ speakKeyWithCustom("no_score","No Score!"); }
      else { speakScoreWithCustom(turnScore, hitBull); }
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
    if(tent<0) speakKeyWithCustom("bust","Bust!");
    else speakKeyWithCustom("no_score","No Score!");
    renderX01();
    setTimeout(advanceX01, 1500);
    return;
  }
  if(tent===0){
    if(!hit.label.startsWith("D")&&hit.label!=="Bull"){
      state.x01.bust=true;
      speakKeyWithCustom("no_score","No Score!");
      renderX01();
      setTimeout(advanceX01, 1500);
      return;
    }
    state.x01.scores[state.x01.current]=0;
    state.x01.winner=state.x01.current;
    state.x01.checkoutHits[state.x01.current]++;
    const _coScore=state.x01.throws.reduce((s,t)=>s+t.score,0);
    state.x01.checkoutScores[state.x01.current].push(_coScore);
    state.x01.turnScores[state.x01.current].push(_coScore);
    if(localStorage.getItem("dart_slang_enabled")==="true"){
      if(hit.label==="D1") queueAudio("Madhouse!","el_slang_madhouse_");
      else if(hit.label==="D20") queueAudio("Double Top! Game Shot!","el_slang_double_top_game_shot_");
      else queueAudio("Game Shot!","el_slang_game_shot_");
    }
    handleLegWin(state.x01.current);
    renderX01();
    return;
  }

  const turnScore=state.x01.throws.reduce((s,t)=>s+t.score,0);
  if(state.x01.throws.length===3){
    const hitBull=state.x01.throws.some(t=>t.label==="Bull"||t.label==="Bull 25");
    turnScore===0?speakKeyWithCustom("no_score","No Score!"):speakScoreWithCustom(turnScore,hitBull);
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
    setTimeout(advanceX01,800);
  }
}

/** Schedules requires + checkout-path announcement for the next player. */
function _scheduleNextPlayerAnnounce(nextIdx){
  if(state.x01.winner) return;
  if(state.cfg.isBot?.[nextIdx]) return;
  const score=state.x01.scores[nextIdx];
  if(score >= 2 && score <= 170){
    setTimeout(announceRequires, 1500);
    const _optPath=window._CHECKOUTS?.[score]||"";
    const _pid=state.cfg.playerIds?.[nextIdx];
    const _pl=state.allPlayers?.find(p=>p.id===_pid);
    const _prefRaw=findPreferredCheckout(score,_pl?.prefDoubles||[]);
    const _annPath=(_prefRaw&&_optPath&&_prefRaw.split(" ").length===_optPath.split(" ").length)?_prefRaw:null;
    setTimeout(()=>announceCheckoutPath(score,_annPath),2500);
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
    _scheduleNextPlayerAnnounce(next);
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
  _scheduleNextPlayerAnnounce(next);
  if(state.cfg.isBot?.[next]) setTimeout(runBotTurn,800);
}

/**
 * Builds TV-style stats comparison HTML for the leg/winner overlays.
 * @param {Array} players - stat objects per player
 * @param {string} mode - 'leg' or 'winner'
 * @param {string|null} legLabel - optional overlay title
 * @param {boolean} big - use enlarged sizes (Match tab)
 */
function buildTvStatsHTML(players, mode, legLabel, big=false) {
  if (!players.length) return '';
  const pfx = mode === 'winner' ? 'winner' : 'leg';
  const wrapCls = `tv-overlay-wrap${big?' tv-lg':''}`;

  function avatar(s) {
    const cls = s.isWinner ? ' tv-avatar-winner' : '';
    if (s.photoUrl) return `<img src="${s.photoUrl}" class="tv-avatar-img${cls}">`;
    return `<div class="tv-avatar-init${cls}">${s.displayName.slice(0,2).toUpperCase()}</div>`;
  }

  function statRow(label, v1, v2, dv1, dv2, higherBetter=true) {
    const n1=parseFloat(v1)||0, n2=parseFloat(v2)||0, tot=n1+n2;
    const f1=tot>0?Math.max(3,Math.round(n1/tot*100)):50;
    const f2=Math.max(3,100-f1);
    const p1w=n1!==n2&&(higherBetter?n1>n2:n1<n2);
    const p2w=n1!==n2&&(higherBetter?n2>n1:n2<n1);
    return `<div class="tv-stat-row">
      <div class="tv-val-left${p1w?' tv-val-win':p2w?' tv-val-dim':''}">${dv1??v1}</div>
      <div class="tv-bar-label-col">
        <div class="tv-bar-track">
          <div class="tv-bar-seg${p1w?' tv-bar-gold':p2w?' tv-bar-fade':' tv-bar-neutral'}" style="flex:${f1}"></div>
          <div class="tv-bar-gap"></div>
          <div class="tv-bar-seg${p2w?' tv-bar-gold':p1w?' tv-bar-fade':' tv-bar-neutral'}" style="flex:${f2}"></div>
        </div>
        <div class="tv-stat-label">${label}</div>
      </div>
      <div class="tv-val-right${p2w?' tv-val-win':p1w?' tv-val-dim':''}">${dv2??v2}</div>
    </div>`;
  }

  const hdr = legLabel ? `<div class="tv-leg-label">${legLabel}</div>` : '';

  if (players.length === 1) {
    const s = players[0];
    const coPct = s.coAtt>0 ? `${s.coHit}/${s.coAtt} (${s.coPct}%)` : '—';
    return `<div class="${wrapCls}">${hdr}
      <div class="tv-header"><div class="tv-player tv-player-center">
        ${avatar(s)}<div class="tv-pname">${s.displayName}</div>
        ${s.isWinner?'<div class="tv-winner-badge">WINNER</div>':''}
      </div></div>
      <div class="tv-stats-table">
        <div class="tv-single-row"><span class="tv-single-label">THREE-DART AVERAGE</span><span class="tv-single-val">${s.avg}</span></div>
        <div class="tv-single-row"><span class="tv-single-label">180s</span><span class="tv-single-val">${s.s180}</span></div>
        <div class="tv-single-row"><span class="tv-single-label">140+</span><span class="tv-single-val">${s.s140}</span></div>
        <div class="tv-single-row"><span class="tv-single-label">100+</span><span class="tv-single-val">${s.s100}</span></div>
        <div class="tv-single-row"><span class="tv-single-label">CHECKOUT %</span><span class="tv-single-val">${coPct}</span></div>
        ${s.highCo>0?`<div class="tv-single-row"><span class="tv-single-label">HIGHEST CHECKOUT</span><span class="tv-single-val">${s.highCo}</span></div>`:''}
        ${s.scoreLabel?`<div class="tv-single-row"><span class="tv-single-label">${s.scoreLabel}</span><span class="tv-single-val">${s.score}</span></div>`:''}
      </div>
      ${s.dots?.length?`<div class="tv-boards-row"><div class="tv-board-col"><svg id="${pfx}-scatter-0" class="tv-mini-board"></svg></div></div>`:''}
    </div>`;
  }

  // 2-player TV comparison
  const [p1, p2] = players;
  const co1 = p1.coAtt>0?`${p1.coHit}/${p1.coAtt} (${p1.coPct}%)`:`0/${p1.coAtt||0}`;
  const co2 = p2.coAtt>0?`${p2.coHit}/${p2.coAtt} (${p2.coPct}%)`:`0/${p2.coAtt||0}`;
  const hasHighCo = p1.highCo>0||p2.highCo>0;
  const headerScore = p1.score!=null
    ? `<div class="tv-result-score">${p1.score}<span class="tv-result-sep">:</span>${p2.score}</div><div class="tv-result-label">${p1.scoreLabel||''}</div>`
    : `<div class="tv-result-score">${state.cfg.legWins[p1.idx]}<span class="tv-result-sep">:</span>${state.cfg.legWins[p2.idx]}</div><div class="tv-result-label">LEGS</div>`;

  return `<div class="${wrapCls}">${hdr}
    <div class="tv-header">
      <div class="tv-player">
        ${avatar(p1)}<div class="tv-pname">${p1.displayName}</div>
        ${p1.isWinner?'<div class="tv-winner-badge">WINNER</div>':'<div class="tv-winner-badge-ph"></div>'}
      </div>
      <div class="tv-result">${headerScore}</div>
      <div class="tv-player tv-player-r">
        ${avatar(p2)}<div class="tv-pname">${p2.displayName}</div>
        ${p2.isWinner?'<div class="tv-winner-badge">WINNER</div>':'<div class="tv-winner-badge-ph"></div>'}
      </div>
    </div>
    <div class="tv-stats-table">
      ${statRow('THREE-DART AVERAGE',p1.avg,p2.avg)}
      ${statRow('180s',p1.s180,p2.s180)}
      ${statRow('140+',p1.s140,p2.s140)}
      ${statRow('100+',p1.s100,p2.s100)}
      ${statRow('CHECKOUT %',p1.coPct,p2.coPct,co1,co2)}
      ${hasHighCo?statRow('HIGHEST CHECKOUT',p1.highCo,p2.highCo,p1.highCo||'—',p2.highCo||'—'):''}
      ${p1.scoreLabel?statRow(p1.scoreLabel,p1.score,p2.score):''}
    </div>
    <div class="tv-boards-row">
      <div class="tv-board-col"><svg id="${pfx}-scatter-0" class="tv-mini-board"></svg><div class="tv-board-name">${p1.displayName}</div></div>
      <div class="tv-board-col"><svg id="${pfx}-scatter-1" class="tv-mini-board"></svg><div class="tv-board-name">${p2.displayName}</div></div>
    </div>
  </div>`;
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
      t('noch_sets_zum_sieg').replace('{n}',state.cfg.setsToWin-state.cfg.setWins[winnerIdx]);
    document.getElementById("set-overlay").classList.add("visible");
    return;
  }

  const legNum=state.cfg.currentLeg;
  const _legLabel=state.cfg.totalSets>1
    ?`SET ${state.cfg.currentSet} · LEG ${legNum} WON!`
    :`LEG ${legNum} WON!`;

  showWinner(name, state.x01.round, true, _legLabel);
}

/** Dynamically sizes dartboards to fill remaining scroll space for any result overlay. */
function resizeWinnerBoards(overlayId='winner-overlay'){
  const isLegOv=overlayId==='leg-overlay';
  const overlay=document.getElementById(overlayId);
  if(!overlay||!overlay.classList.contains('visible')) return;
  const scroll=overlay.querySelector(`#${isLegOv?'leg-tab-match':'winner-tab-match'} > .winner-tab-scroll`);
  if(!scroll) return;
  const summary=overlay.querySelector(`#${isLegOv?'leg-stats-summary':'winner-summary'}`);
  const boardsRow=summary?.querySelector('.tv-boards-row');
  if(!boardsRow) return;
  const scrollH=scroll.clientHeight;
  const scrollW=scroll.clientWidth;
  const headerH=summary?.querySelector('.tv-header')?.offsetHeight||0;
  const statsH=summary?.querySelector('.tv-stats-table')?.offsetHeight||0;
  const legH=summary?.querySelector('.tv-leg-label')?.offsetHeight||0;
  const availH=scrollH-22-headerH-statsH-legH-50;
  const n=boardsRow.querySelectorAll('.tv-mini-board').length||1;
  const availW=(scrollW-32-20*(n-1))/n;
  const size=Math.max(80,Math.min(Math.floor(availH),Math.floor(availW)));
  overlay.style.setProperty('--winner-board-size',`${size}px`);
}
window.addEventListener('resize',()=>{
  resizeWinnerBoards('winner-overlay');
  resizeWinnerBoards('leg-overlay');
});

/**
 * Shows the result overlay — shared by leg wins and the final match win.
 * @param {string} name  winner's display name
 * @param {number} round current round number
 * @param {boolean} isLeg  true = between-leg screen, false = final match winner
 * @param {string|null} legLabel  header label for leg screens (e.g. "LEG 2 WON!")
 */
export function showWinner(name, round, isLeg=false, legLabel=null){
  const winnerIdx=state.cfg.players.indexOf(name);
  const pfx=isLeg?'leg':'winner';
  const sumEl=document.getElementById(isLeg?'leg-stats-summary':'winner-summary');

  if(sumEl&&state.cfg.mode!=="Cricket"&&state.x01.turnScores){
    const toMini=t=>({x:t.svgX,y:t.svgY,v:2,miss:t.miss,label:t.label});
    const playerStats=state.cfg.players.map((p,i)=>{
      if(state.cfg.isBot?.[i]) return null;
      let turns, coAtt, coHit, dots, allCheckouts;
      if(isLeg){
        turns=state.x01.turnScores[i]||[];
        coAtt=state.x01.checkoutAttempts[i]||0;
        coHit=state.x01.checkoutHits[i]||0;
        allCheckouts=state.x01.checkoutScores?.[i]||[];
        dots=[
          ...state.x01.historicThrows[i].filter(t=>t.svgX!=null).map(toMini),
          ...(state.x01.current===i?state.x01.throws.filter(t=>t.svgX!=null).map(toMini):[])
        ];
      } else {
        const accTurns=state.cfg.accumulated?.turnScores?.[i]||[];
        turns=[...accTurns,...(state.x01.turnScores[i]||[])];
        coAtt=(state.cfg.accumulated?.checkoutAttempts?.[i]||0)+(state.x01.checkoutAttempts?.[i]||0);
        coHit=(state.cfg.accumulated?.checkoutHits?.[i]||0)+(state.x01.checkoutHits?.[i]||0);
        allCheckouts=[
          ...(state.cfg.accumulated?.checkoutScores?.[i]||[]),
          ...(state.x01.checkoutScores?.[i]||[])
        ];
        dots=[
          ...(state.cfg.accumulated?.historicThrows?.[i]||[]).map(toMini),
          ...state.x01.historicThrows[i].filter(t=>t.svgX!=null).map(toMini),
          ...(state.x01.current===i?state.x01.throws.filter(t=>t.svgX!=null).map(toMini):[])
        ];
      }
      if(!turns.length) return null;
      const avg=Math.round(turns.reduce((a,b)=>a+b,0)/turns.length*10)/10;
      const s180=turns.filter(v=>v===180).length;
      const s140=turns.filter(v=>v>=140&&v<180).length;
      const s100=turns.filter(v=>v>=100&&v<140).length;
      const coPct=coAtt>0?Math.round(coHit/coAtt*100):0;
      const highCo=allCheckouts.length?Math.max(...allCheckouts):0;
      const pid=state.cfg.playerIds?.[i];
      const playerObj=state.allPlayers?.find(pl=>pl.id===pid);
      const displayName=playerObj?.nickname||p;
      const photoUrl=playerObj?.photoUrl||null;
      const isWinner=isLeg?(i===winnerIdx):(i===state.x01.winner);
      let score=null, scoreLabel=null;
      if(!isLeg){
        if(state.cfg.totalSets>1){ score=state.cfg.setWins[i]; scoreLabel='SETS WON'; }
        else if(state.cfg.totalLegs>1){ score=state.cfg.legWins[i]; scoreLabel='LEGS WON'; }
      }
      return {avg,s180,s140,s100,coAtt,coHit,coPct,highCo,displayName,photoUrl,isWinner,idx:i,dots,score,scoreLabel};
    });
    const humanStats=playerStats.filter(Boolean);
    if(!humanStats.length){
      sumEl.style.display='none';
    } else {
      sumEl.innerHTML=buildTvStatsHTML(humanStats,pfx,isLeg?legLabel:null,true);
      sumEl.style.display='block';
      requestAnimationFrame(()=>{
        humanStats.forEach((s,si)=>{
          const svgEl=document.getElementById(`${pfx}-scatter-${si}`);
          if(svgEl) drawMiniBoard(svgEl,s.dots,12);
        });
        resizeWinnerBoards(isLeg?'leg-overlay':'winner-overlay');
      });
    }
  }

  document.getElementById(isLeg?'leg-overlay':'winner-overlay').classList.add("visible");

  if(!isLeg){
    document.getElementById("winner-tab-match")?.classList.remove("winner-tab-hidden");
    document.getElementById("winner-tab-analysis")?.classList.add("winner-tab-hidden");
    document.getElementById("tab-btn-match")?.classList.add("winner-tab-active");
    document.getElementById("tab-btn-analysis")?.classList.remove("winner-tab-active");
    if(window._updateCoachLimitDisplay) window._updateCoachLimitDisplay();
    if(window._buildCoachPlayerSelector) window._buildCoachPlayerSelector();
    const winnerPid=state.cfg.playerIds?.[winnerIdx]||null;
    if(winnerPid && window._loadCoachHistory) window._loadCoachHistory(winnerPid);
  }
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
  const msg=dist===0?t('target_perfekt'):
    dist<=10?t('target_richtiges_segment'):
    dist<=30?t('target_benachbart'):
    t('target_weit_daneben');
  const el=document.getElementById("target-feedback-toast");
  if(el){
    el.textContent=`${msg} (${t('ziel')} ${targetLabel} → ${hit.label})`;
    el.style.display="";
    clearTimeout(el._t);
    el._t=setTimeout(()=>{ el.style.display="none"; }, 2000);
  }
}
