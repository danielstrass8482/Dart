/**
 * party.js — Party game modes: Around the Clock, Shanghai, Highscore, Killer, Elimination.
 */

import { state } from './state.js';
import { SECTORS, R, CX, CY, slicePath, hitFromXY, svgCoords, clearHits, redrawAllHits, clearCheckout, disableBoard } from './board.js?v=2';
import { soundHit, soundApplause, soundBust, speak, speakScoreWithCustom } from './audio.js';
import { t } from './i18n.js?v=3';

export let boardSVGparty;

/**
 * Sets the party board SVG reference.
 * @param {SVGElement} svgEl
 */
export function setPartyBoard(svgEl){ boardSVGparty = svgEl; }

/**
 * Starts a new party game.
 */
const BOB27_SEQ=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25];

export function startParty(){
  const n=state.cfg.players.length;
  const coTable=window._CHECKOUTS||{};
  const coScores=Object.keys(coTable).map(Number).filter(v=>v>=40&&v<=170);
  const coTargets=[];
  while(coTargets.length<Math.min(10,coScores.length)){
    const r=coScores[Math.floor(Math.random()*coScores.length)];
    if(!coTargets.includes(r)) coTargets.push(r);
  }
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
    bob27Score: state.cfg.players.map(()=>27),
    bob27Round: 0,
    coTargets,
    coRound: 0,
    coScore: coTargets[0]||40,
    coHits: 0,
    coAttempts: coTargets.length>0?1:0,
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
  } else if(state.pg.mode==="Bob27"){
    const f=BOB27_SEQ[state.pg.bob27Round];
    if(f===25){ mkCircle(R.bull); }
    else if(f>=1&&f<=20){ const idx=SECTORS.indexOf(f); if(idx>=0) mkPath(slicePath(R.dblIn,R.dblOut,idx)); }
  } else if(state.pg.mode==="CheckoutTraining"){
    const target=state.pg.coTargets[state.pg.coRound];
    if(target&&window._CHECKOUTS?.[target]){
      const parts=window._CHECKOUTS[target].split(" ");
      const coSpent=state.pg.throws.reduce((s,t)=>s+t.score,0);
      const remaining=target-coSpent;
      const CHECKOUTS=window._CHECKOUTS;
      if(remaining>0&&remaining<=170&&CHECKOUTS[remaining]){
        const nextPart=CHECKOUTS[remaining].split(" ")[0];
        const isT=nextPart.startsWith("T"); const isD=nextPart.startsWith("D");
        const isBull=nextPart==="Bull"||nextPart==="D25";
        const num=isBull?25:parseInt(nextPart.replace(/[TDS]/,""))||0;
        if(isBull){ mkCircle(isT?R.bull:R.bull25); }
        else if(num>=1&&num<=20){ const idx=SECTORS.indexOf(num); if(idx>=0){ const r1=isT?R.triIn:isD?R.dblIn:R.bull25; const r2=isT?R.triOut:isD?R.dblOut:R.dblIn; mkPath(slicePath(r1,r2,idx)); } }
      }
    }
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
    else if(state.pg.mode==="Bob27") sub=`${state.pg.bob27Score[i]}pts`;
    else if(state.pg.mode==="CheckoutTraining") sub=`${state.pg.coHits}/${state.pg.coAttempts}`;
    div.innerHTML=`<div class="tab-name">${name}</div><div class="tab-score" style="font-size:16px">${sub}</div>`;
    tabs.appendChild(div);
  });
}

/** Renders party scoreboard. */
export function renderPartyScoreboard(){
  const box=document.getElementById("party-scoreboard");
  if(state.pg.mode==="AtC"){
    box.innerHTML=`<div class="panel-label">${t('fortschritt')}</div>`+
      state.cfg.players.map((p,i)=>`<div style="margin-bottom:6px">
        <div style="font-size:11px;color:var(--dart-text-sec)">${p}</div>
        <div style="font-size:20px;font-family:'Bebas Neue',sans-serif;color:${i===state.pg.current?"#e8c44a":"#555"}">
          ${state.pg.atcTarget[i]===21?t('fertig_check'):`${t('ziel')} ${state.pg.atcTarget[i]}`}</div>
      </div>`).join("");
  } else if(state.pg.mode==="Shanghai"){
    box.innerHTML=`<div class="panel-label">${t('runde').toUpperCase()} ${state.pg.shanghaiRound} · ${t('ziel').toUpperCase()} ${state.pg.shanghaiRound}</div>`+
      state.cfg.players.map((p,i)=>`<div style="margin-bottom:4px;display:flex;justify-content:space-between">
        <span style="font-size:13px;color:${i===state.pg.current?"#1a1a1a":"#999"}">${p}</span>
        <span style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:${i===state.pg.current?"#e8c44a":"#555"}">${state.pg.shanghaiScores[i]}</span>
      </div>`).join("");
  } else if(state.pg.mode==="Highscore"){
    box.innerHTML=`<div class="panel-label">${t('runde').toUpperCase()} ${state.pg.hsRound}/${state.pg.hsMaxRounds}</div>`+
      state.cfg.players.map((p,i)=>`<div style="margin-bottom:4px;display:flex;justify-content:space-between">
        <span style="font-size:13px;color:${i===state.pg.current?"#1a1a1a":"#999"}">${p}</span>
        <span style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:${i===state.pg.current?"#e8c44a":"#555"}">${state.pg.hsScores[i]}</span>
      </div>`).join("");
  } else if(state.pg.mode==="Killer"){
    box.innerHTML=`<div class="panel-label">KILLER</div>`+
      state.cfg.players.map((p,i)=>{
        if(state.pg.killerEliminated[i]) return `<div style="margin-bottom:4px;color:var(--dart-text-sec);text-decoration:line-through;font-size:13px">${p} — OUT</div>`;
        const isK=state.pg.killerIsKiller[i];
        return `<div style="margin-bottom:6px">
          <div style="font-size:12px;color:${i===state.pg.current?"#1a1a1a":"#999"}">${p} · ${t('zahl')}: <strong>${state.pg.killerNumbers[i]}</strong>${isK?" ☠️":""}</div>
          <div style="font-size:18px">❤️</div>
        </div>`;
      }).join("");
  } else if(state.pg.mode==="Elimination"){
    box.innerHTML=`<div class="panel-label">ELIMINATION 501</div>`+
      state.cfg.players.map((p,i)=>`<div style="margin-bottom:4px;display:flex;justify-content:space-between">
        <span style="font-size:13px;color:${i===state.pg.current?"#1a1a1a":"#999"}">${p}</span>
        <span style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:${i===state.pg.current?"#e8c44a":"#555"}">${state.pg.elimScores[i]}</span>
      </div>`).join("");
  } else if(state.pg.mode==="Bob27"){
    const field=BOB27_SEQ[state.pg.bob27Round];
    const fieldLabel=field===25?"Bull":`D${field}`;
    box.innerHTML=`<div class="panel-label">BOB'S 27 · ${t('ziel').toUpperCase()} ${fieldLabel} (${state.pg.bob27Round+1}/21)</div>`+
      state.cfg.players.map((p,i)=>`<div style="margin-bottom:4px;display:flex;justify-content:space-between">
        <span style="font-size:13px;color:${i===state.pg.current?"#1a1a1a":"#999"}">${p}</span>
        <span style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:${i===state.pg.current?"#e8c44a":"#555"}">${state.pg.bob27Score[i]}</span>
      </div>`).join("");
  } else if(state.pg.mode==="CheckoutTraining"){
    const target=state.pg.coTargets[state.pg.coRound];
    const path=window._CHECKOUTS?.[target]||"";
    box.innerHTML=`<div class="panel-label">CHECKOUT-TRAINING ${state.pg.coRound+1}/${state.pg.coTargets.length}</div>
      <div style="font-size:28px;font-family:'Bebas Neue',sans-serif;color:var(--dart-gold);margin:4px 0">${target}</div>
      <div style="font-size:13px;color:var(--dart-text-sec);margin-bottom:6px">${path}</div>
      <div style="font-size:14px;color:var(--dart-text-muted)">Remaining: <strong>${state.pg.coScore}</strong></div>
      <div style="font-size:14px;color:var(--dart-text-muted);margin-top:4px">${t('treffer_label')}: <strong style="color:var(--dart-success)">${state.pg.coHits}/${state.pg.coAttempts}</strong></div>`;
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
  if(state.pg.mode==="AtC") info.textContent=t('atc_info');
  else if(state.pg.mode==="Shanghai") info.textContent=t('shanghai_info').replace(/\{r\}/g,state.pg.shanghaiRound);
  else if(state.pg.mode==="Highscore") info.textContent=t('highscore_info').replace('{n}',state.pg.hsMaxRounds);
  else if(state.pg.mode==="Killer") info.textContent=t('killer_info');
  else if(state.pg.mode==="Elimination") info.textContent=t('elimination_info');
  else if(state.pg.mode==="Bob27"){ const f=BOB27_SEQ[state.pg.bob27Round]; const fL=f===25?"Bull":`D${f}`; info.textContent=t('bob27_info').replace('{f}',fL).replace('{plus}',f===25?50:f*2).replace('{minus}',f===25?25:f); }
  else if(state.pg.mode==="CheckoutTraining") info.textContent=t('checkout_training_info');

  const modeNames={AtC:"Around the Clock",Shanghai:"Shanghai",Highscore:"Highscore",Killer:"Killer",Elimination:"Elimination",Bob27:"Bob's 27",CheckoutTraining:"Checkout-Training"};
  document.getElementById("party-title").textContent=modeNames[state.pg.mode]||state.pg.mode;

  const btn=document.getElementById("party-next");
  btn.style.display=(state.pg.throws.length>0&&!state.pg.winner)?"":"none";
  btn.textContent=state.pg.throws.length<3?t('zaehlen_weiter'):t('naechster_spieler');

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
    elimScores:[...state.pg.elimScores],
    bob27Score:[...state.pg.bob27Score],bob27Round:state.pg.bob27Round,
    coRound:state.pg.coRound,coScore:state.pg.coScore,coHits:state.pg.coHits,coAttempts:state.pg.coAttempts,
    historicLens:state.pg.historicThrows.map(a=>a.length)
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
  else if(state.pg.mode==="Bob27"){
    // handled at end of turn in advanceParty
  }
  else if(state.pg.mode==="CheckoutTraining"){
    const spent=state.pg.throws.reduce((s,t)=>s+t.score,0);
    const rem=state.pg.coTargets[state.pg.coRound]-spent;
    if(rem===0&&(hit.label.startsWith("D")||hit.label==="Bull")){
      state.pg.coHits++;
      soundApplause(); speak("Checkout!");
      renderParty();
      setTimeout(advanceParty,1000); return;
    }
    if(rem<0||rem===1){
      speak("Bust!"); renderParty();
      setTimeout(advanceParty,800); return;
    }
    state.pg.coScore=Math.max(0,rem);
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

  if(state.pg.mode==="Bob27"){
    const field=BOB27_SEQ[state.pg.bob27Round];
    const fieldVal=field===25?25:field;
    const hits=state.pg.throws.filter(t=>
      field===25?(t.label==="Bull"):(t.label===`D${field}`)
    ).length;
    const misses=state.pg.throws.length-hits;
    state.pg.bob27Score[pi]+=hits*(fieldVal*2)-misses*fieldVal;
    if(state.pg.bob27Score[pi]<0){ speak("Game Over!"); soundBust(); }
    if(pi===state.cfg.players.length-1){
      state.pg.bob27Round++;
      if(state.pg.bob27Round>20){
        const best=Math.max(...state.pg.bob27Score);
        const winIdx=state.pg.bob27Score.indexOf(best);
        partyWin(winIdx); return;
      }
    }
  }

  if(state.pg.mode==="CheckoutTraining"){
    // advance to next checkout target
    const nextRound=state.pg.coRound+1;
    if(nextRound>=state.pg.coTargets.length){
      const pct=Math.round(state.pg.coHits/state.pg.coTargets.length*100);
      speak(`${pct} percent. Training complete.`);
      partyWin(pi); return;
    }
    state.pg.coRound=nextRound;
    state.pg.coScore=state.pg.coTargets[nextRound];
    state.pg.coAttempts=nextRound+1;
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
