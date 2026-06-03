/**
 * party.js — Party game modes: Around the Clock, Shanghai, Highscore, Killer, Elimination.
 */

import { state } from './state.js';
import { SECTORS, R, CX, CY, slicePath, hitFromXY, svgCoords, clearHits, redrawAllHits, clearCheckout, disableBoard } from './board.js';
import { soundHit, soundApplause, speak, speakScoreWithCustom } from './audio.js';

export let boardSVGparty;

/**
 * Sets the party board SVG reference.
 * @param {SVGElement} svgEl
 */
export function setPartyBoard(svgEl){ boardSVGparty = svgEl; }

/**
 * Starts a new party game.
 */
export function startParty(){
  const n=state.cfg.players.length;
  state.pg={
    mode: state.cfg.mode,
    current: 0,
    throws: [],
    history: [],
    historicThrows: state.cfg.players.map(()=>[]),
    winner: null,
    atcTarget: state.cfg.players.map(()=>1),
    shanghaiRound: 1,
    shanghaiScores: state.cfg.players.map(()=>0),
    hsScores: state.cfg.players.map(()=>0),
    hsRound: 1,
    hsMaxRounds: state.cfg.rounds||8,
    killerNumbers: assignKillerNumbers(n),
    killerIsKiller: state.cfg.players.map(()=>false),
    killerLives: state.cfg.players.map(()=>3),
    killerEliminated: state.cfg.players.map(()=>false),
    elimScores: state.cfg.players.map(()=>501),
  };
  clearHits(boardSVGparty);
  renderParty();
  window.showScreen("party");
  disableBoard(boardSVGparty,false);
}

/**
 * Assigns random numbers to killer players.
 * @param {number} n number of players
 * @returns {Array<number>}
 */
export function assignKillerNumbers(n){
  const nums=[...Array(20)].map((_,i)=>i+1);
  for(let i=nums.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [nums[i],nums[j]]=[nums[j],nums[i]]; }
  return nums.slice(0,n);
}

/** Highlights the current target segment on the party board. */
export function partyTargetHighlight(){
  clearCheckout(boardSVGparty);
  const g=boardSVGparty.querySelector("#board-svg-party-checkout");
  if(!g) return;
  const ns="http://www.w3.org/2000/svg";
  function mkPath(d){ const p=document.createElementNS(ns,"path"); p.setAttribute("d",d);
    p.setAttribute("fill","rgba(80,200,255,0.35)"); p.setAttribute("stroke","#00ccff");
    p.setAttribute("stroke-width","2.5");
    p.innerHTML=`<animate attributeName="opacity" values="0.5;1;0.5" dur="1s" repeatCount="indefinite"/>`;
    g.appendChild(p); }
  function mkCircle(r1){ const c=document.createElementNS(ns,"circle"); c.setAttribute("cx",CX); c.setAttribute("cy",CY); c.setAttribute("r",r1);
    c.setAttribute("fill","rgba(80,200,255,0.35)"); c.setAttribute("stroke","#00ccff"); c.setAttribute("stroke-width","2");
    c.innerHTML=`<animate attributeName="opacity" values="0.5;1;0.5" dur="1s" repeatCount="indefinite"/>`;
    g.appendChild(c); }

  if(state.pg.mode==="AtC"){
    const t=state.pg.atcTarget[state.pg.current];
    if(t>=1&&t<=20){ const idx=SECTORS.indexOf(t); if(idx>=0) mkPath(slicePath(R.bull25,R.dblOut,idx)); }
  } else if(state.pg.mode==="Shanghai"){
    const t=state.pg.shanghaiRound;
    if(t===25){ mkCircle(R.bull25); return; }
    if(t>=1&&t<=20){ const idx=SECTORS.indexOf(t); if(idx>=0) mkPath(slicePath(R.bull25,R.dblOut,idx)); }
  } else if(state.pg.mode==="Killer"){
    const pi=state.pg.current;
    if(!state.pg.killerIsKiller[pi]){
      const t=state.pg.killerNumbers[pi];
      const idx=SECTORS.indexOf(t); if(idx>=0) mkPath(slicePath(R.dblIn,R.dblOut,idx));
    }
  }
}

/** Renders party tabs. */
export function renderPartyTabs(){
  const tabs=document.getElementById("party-tabs");
  tabs.innerHTML="";
  state.cfg.players.forEach((name,i)=>{
    const div=document.createElement("div");
    const isActive=i===state.pg.current&&!state.pg.winner;
    div.className="player-tab"+(isActive?" active":"");
    let sub="";
    if(state.pg.mode==="AtC") sub=`→ ${state.pg.atcTarget[i]===21?"✓":state.pg.atcTarget[i]}`;
    else if(state.pg.mode==="Shanghai") sub=`${state.pg.shanghaiScores[i]}pts`;
    else if(state.pg.mode==="Highscore") sub=`${state.pg.hsScores[i]}pts`;
    else if(state.pg.mode==="Killer"){
      const lives="❤️".repeat(state.pg.killerLives[i]);
      const num=state.pg.killerNumbers[i];
      const isK=state.pg.killerIsKiller[i];
      sub=`${num}${isK?" ☠️":""} ${lives}`;
    }
    else if(state.pg.mode==="Elimination") sub=`${state.pg.elimScores[i]}`;
    div.innerHTML=`<div class="tab-name">${name}</div><div class="tab-score" style="font-size:16px">${sub}</div>`;
    tabs.appendChild(div);
  });
}

/** Renders party scoreboard. */
export function renderPartyScoreboard(){
  const box=document.getElementById("party-scoreboard");
  if(state.pg.mode==="AtC"){
    box.innerHTML=`<div class="panel-label">FORTSCHRITT</div>`+
      state.cfg.players.map((p,i)=>`<div style="margin-bottom:6px">
        <div style="font-size:11px;color:#999">${p}</div>
        <div style="font-size:20px;font-family:'Bebas Neue',sans-serif;color:${i===state.pg.current?"#e8c44a":"#555"}">
          ${state.pg.atcTarget[i]===21?"FERTIG ✓":`Ziel: ${state.pg.atcTarget[i]}`}</div>
      </div>`).join("");
  } else if(state.pg.mode==="Shanghai"){
    box.innerHTML=`<div class="panel-label">RUNDE ${state.pg.shanghaiRound} · ZIEL: ${state.pg.shanghaiRound}</div>`+
      state.cfg.players.map((p,i)=>`<div style="margin-bottom:4px;display:flex;justify-content:space-between">
        <span style="font-size:13px;color:${i===state.pg.current?"#1a1a1a":"#999"}">${p}</span>
        <span style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:${i===state.pg.current?"#e8c44a":"#555"}">${state.pg.shanghaiScores[i]}</span>
      </div>`).join("");
  } else if(state.pg.mode==="Highscore"){
    box.innerHTML=`<div class="panel-label">RUNDE ${state.pg.hsRound}/${state.pg.hsMaxRounds}</div>`+
      state.cfg.players.map((p,i)=>`<div style="margin-bottom:4px;display:flex;justify-content:space-between">
        <span style="font-size:13px;color:${i===state.pg.current?"#1a1a1a":"#999"}">${p}</span>
        <span style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:${i===state.pg.current?"#e8c44a":"#555"}">${state.pg.hsScores[i]}</span>
      </div>`).join("");
  } else if(state.pg.mode==="Killer"){
    box.innerHTML=`<div class="panel-label">KILLER</div>`+
      state.cfg.players.map((p,i)=>{
        if(state.pg.killerEliminated[i]) return `<div style="margin-bottom:4px;color:#ccc;text-decoration:line-through;font-size:13px">${p} — OUT</div>`;
        const isK=state.pg.killerIsKiller[i];
        return `<div style="margin-bottom:6px">
          <div style="font-size:12px;color:${i===state.pg.current?"#1a1a1a":"#999"}">${p} · Zahl: <strong>${state.pg.killerNumbers[i]}</strong>${isK?" ☠️":""}</div>
          <div style="font-size:18px">❤️</div>
        </div>`;
      }).join("");
  } else if(state.pg.mode==="Elimination"){
    box.innerHTML=`<div class="panel-label">ELIMINATION 501</div>`+
      state.cfg.players.map((p,i)=>`<div style="margin-bottom:4px;display:flex;justify-content:space-between">
        <span style="font-size:13px;color:${i===state.pg.current?"#1a1a1a":"#999"}">${p}</span>
        <span style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:${i===state.pg.current?"#e8c44a":"#555"}">${state.pg.elimScores[i]}</span>
      </div>`).join("");
  }
}

/** Renders the party game UI. */
export function renderParty(){
  for(let i=0;i<3;i++){
    const slot=document.getElementById(`pslot-${i}`);
    const t=state.pg.throws[i];
    slot.textContent=t?t.label:"—";
    slot.className="throw-slot"+(t?" hit":"");
  }
  renderPartyTabs();
  renderPartyScoreboard();
  partyTargetHighlight();

  const info=document.getElementById("party-info-bar");
  if(state.pg.mode==="AtC") info.textContent=`Treffe alle Felder 1–20 der Reihe nach`;
  else if(state.pg.mode==="Shanghai") info.textContent=`Runde ${state.pg.shanghaiRound}: Treffe die ${state.pg.shanghaiRound} · Shanghai = sofortiger Sieg`;
  else if(state.pg.mode==="Highscore") info.textContent=`${state.pg.hsMaxRounds} Runden · Höchste Gesamtpunktzahl gewinnt`;
  else if(state.pg.mode==="Killer") info.textContent=`Erst eigene Zahl per Double treffen, dann andere eliminieren`;
  else if(state.pg.mode==="Elimination") info.textContent=`501 · Triffst du exakt den Score eines Gegners → er startet neu`;

  const modeNames={AtC:"Around the Clock",Shanghai:"Shanghai",Highscore:"Highscore",Killer:"Killer",Elimination:"Elimination"};
  document.getElementById("party-title").textContent=modeNames[state.pg.mode]||state.pg.mode;

  const btn=document.getElementById("party-next");
  btn.style.display=(state.pg.throws.length>0&&!state.pg.winner)?"":"none";
  btn.textContent=state.pg.throws.length<3?"ZÄHLEN & WEITER":"NÄCHSTER SPIELER";

  disableBoard(boardSVGparty,!!state.pg.winner);
}

/**
 * Handles a click on the party dartboard.
 * @param {PointerEvent} e
 */
export function handlePartyClick(e){
  e.preventDefault();
  if(e.pointerType==="mouse"&&e.button!==0) return;
  if(state.pg.winner||state.pg.throws.length>=3) return;
  const {x,y}=svgCoords(boardSVGparty,e);
  const hit=hitFromXY(x,y);
  if(!hit) return;

  state.pg.history.push(JSON.parse(JSON.stringify({
    current:state.pg.current,throws:[...state.pg.throws],
    atcTarget:[...state.pg.atcTarget],shanghaiScores:[...state.pg.shanghaiScores],shanghaiRound:state.pg.shanghaiRound,
    hsScores:[...state.pg.hsScores],hsRound:state.pg.hsRound,
    killerIsKiller:[...state.pg.killerIsKiller],killerLives:[...state.pg.killerLives],killerEliminated:[...state.pg.killerEliminated],
    elimScores:[...state.pg.elimScores],historicLens:state.pg.historicThrows.map(a=>a.length)
  })));

  state.pg.throws.push({...hit,svgX:x,svgY:y});
  state.pg.historicThrows[state.pg.current].push({...hit,svgX:x,svgY:y});
  redrawAllHits(boardSVGparty,state.pg.historicThrows[state.pg.current],state.pg.throws);
  soundHit();

  if(state.pg.mode==="AtC"){
    const target=state.pg.atcTarget[state.pg.current];
    if(target<=20){
      const hitNum=hit.score===50?25:(hit.label.match(/\d+/)?parseInt(hit.label.match(/\d+/)[0]):0);
      if(hitNum===target){
        state.pg.atcTarget[state.pg.current]++;
        soundApplause();
        if(state.pg.atcTarget[state.pg.current]>20){ partyWin(state.pg.current); return; }
      }
    }
  }
  else if(state.pg.mode==="Shanghai"){
    const target=state.pg.shanghaiRound;
    const hitNum=hit.label==="Bull"?50:hit.label==="Bull 25"?25:(parseInt(hit.label.replace(/[TD]/,""))||0);
    const baseNum=hit.label.startsWith("T")?hitNum/3:hit.label.startsWith("D")?hitNum/2:hitNum;
    if(baseNum===target){
      state.pg.shanghaiScores[state.pg.current]+=hit.score;
      const hasSingle=state.pg.throws.some(t=>{ const b=parseInt(t.label)||0; return b===target&&!t.label.startsWith("T")&&!t.label.startsWith("D"); });
      const hasDouble=state.pg.throws.some(t=>t.label===`D${target}`);
      const hasTriple=state.pg.throws.some(t=>t.label===`T${target}`);
      if(hasSingle&&hasDouble&&hasTriple){ speak("Shanghai!"); soundApplause(); partyWin(state.pg.current); return; }
    }
  }
  else if(state.pg.mode==="Highscore"){
    state.pg.hsScores[state.pg.current]+=hit.score;
    if(hit.score>=100) soundApplause();
  }
  else if(state.pg.mode==="Killer"){
    const pi=state.pg.current;
    const hitNum=parseInt(hit.label.replace(/[TD]/,""))||0;
    if(!state.pg.killerIsKiller[pi]){
      if(hit.label===`D${state.pg.killerNumbers[pi]}`){
        state.pg.killerIsKiller[pi]=true; speak("Killer!"); soundApplause();
      }
    } else {
      state.cfg.players.forEach((_,oi)=>{
        if(oi===pi||state.pg.killerEliminated[oi]) return;
        if(hitNum===state.pg.killerNumbers[oi]){
          const hits=hit.label.startsWith("T")?3:hit.label.startsWith("D")?2:1;
          state.pg.killerLives[oi]=Math.max(0,state.pg.killerLives[oi]-hits);
          if(state.pg.killerLives[oi]<=0){ state.pg.killerEliminated[oi]=true; speak("Out!"); }
        }
      });
      const alive=state.cfg.players.filter((_,i)=>!state.pg.killerEliminated[i]);
      if(alive.length===1){
        const winIdx=state.cfg.players.findIndex((_,i)=>!state.pg.killerEliminated[i]);
        partyWin(winIdx); return;
      }
    }
  }
  else if(state.pg.mode==="Elimination"){
    const spent=state.pg.throws.reduce((s,t)=>s+t.score,0);
    const newScore=state.pg.elimScores[state.pg.current]-spent;
    if(newScore>=0){
      state.cfg.players.forEach((_,oi)=>{
        if(oi===state.pg.current) return;
        if(state.pg.elimScores[state.pg.current]-state.pg.throws.reduce((s,t)=>s+t.score,0)===state.pg.elimScores[oi]&&state.pg.elimScores[oi]>0){
          state.pg.elimScores[oi]=501; speak("Eliminated!");
        }
      });
      if(newScore===0&&hit.label.startsWith("D")){ partyWin(state.pg.current); return; }
    }
  }

  renderParty();
  if(state.pg.throws.length===3) setTimeout(advanceParty,350);
}

/** Advances to next party player. */
export function advanceParty(){
  const pi=state.pg.current;

  if(state.pg.mode==="Shanghai"){
    if(pi===state.cfg.players.length-1){
      if(state.pg.shanghaiRound>=7){
        const maxScore=Math.max(...state.pg.shanghaiScores);
        const winIdx=state.pg.shanghaiScores.indexOf(maxScore);
        partyWin(winIdx); return;
      }
      state.pg.shanghaiRound++;
    }
  } else if(state.pg.mode==="Highscore"){
    if(pi===state.cfg.players.length-1){
      if(state.pg.hsRound>=state.pg.hsMaxRounds){
        const maxScore=Math.max(...state.pg.hsScores);
        const winIdx=state.pg.hsScores.indexOf(maxScore);
        partyWin(winIdx); return;
      }
      state.pg.hsRound++;
    }
  } else if(state.pg.mode==="Elimination"){
    const spent=state.pg.throws.reduce((s,t)=>s+t.score,0);
    const newScore=state.pg.elimScores[pi]-spent;
    if(newScore>=0) state.pg.elimScores[pi]=newScore;
  }

  if(["Shanghai","Highscore"].includes(state.pg.mode)){
    const ts=state.pg.throws.reduce((s,t)=>s+t.score,0);
    speakScoreWithCustom(ts);
  }

  state.pg.throws=[];

  let next=(pi+1)%state.cfg.players.length;
  if(state.pg.mode==="Killer"){
    let tries=0;
    while(state.pg.killerEliminated[next]&&tries<state.cfg.players.length){ next=(next+1)%state.cfg.players.length; tries++; }
  }
  state.pg.current=next;

  redrawAllHits(boardSVGparty,state.pg.historicThrows[state.pg.current],[]);
  renderParty();
}

/**
 * Declares a party winner.
 * @param {number} winnerIdx
 */
export function partyWin(winnerIdx){
  state.pg.winner=winnerIdx;
  soundApplause();
  if(window._showWinner) window._showWinner(state.cfg.players[winnerIdx],0);
  if(window._saveGameToFirebase) window._saveGameToFirebase(winnerIdx);
}
