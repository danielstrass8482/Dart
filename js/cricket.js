/**
 * cricket.js — Cricket game logic.
 */

import { state } from './state.js';
import { CRICKET_TARGETS, buildBoard, hitFromXY, svgCoords, clearHits, redrawAllHits, disableBoard } from './board.js';

// The cricket board SVG is initialized in app.js
export let boardSVGcr;

/**
 * Sets the cricket board SVG reference.
 * @param {SVGElement} svgEl
 */
export function setCricketBoard(svgEl){ boardSVGcr = svgEl; }

/**
 * Starts a new Cricket game.
 */
export function startCricket(){
  state.cr={
    marks: state.cfg.players.map(()=>Object.fromEntries(CRICKET_TARGETS.map(t=>[t,0]))),
    points: state.cfg.players.map(()=>0),
    current: 0,
    round: 1,
    throws: [],
    historicThrows: state.cfg.players.map(()=>[]),
    winner: null,
    history: [],
    startTime: Date.now(),
    totalMarks: state.cfg.players.map(()=>0),
    totalThrows: state.cfg.players.map(()=>0),
    firstClosed: state.cfg.players.map(()=>null),
    closedOrder: state.cfg.players.map(()=>[]),
    turnScores: state.cfg.players.map(()=>[]),
  };
  clearHits(boardSVGcr);
  renderCricket();
  window.showScreen("cricket");
  disableBoard(boardSVGcr,false);
}

/**
 * Returns mark display character.
 * @param {number} m
 * @returns {string}
 */
export function markDisplay(m){
  if(m===0) return "";
  if(m===1) return "/";
  if(m===2) return "X";
  return "●";
}

/** Renders the cricket score table. */
export function renderCricketTable(){
  const table=document.getElementById("cr-table");
  const players=state.cfg.players;
  let html=`<thead><tr><th class="target-col">ZIEL</th>`;
  players.forEach((p,i)=>{ html+=`<th class="${i===state.cr.current?"active-player":""}">${p}</th>`; });
  html+=`</tr></thead><tbody>`;
  CRICKET_TARGETS.forEach(t=>{
    html+=`<tr><td class="target-cell">${t===25?"BULL":t}</td>`;
    players.forEach((_,pi)=>{
      const m=state.cr.marks[pi][t];
      const closed=m>=3;
      html+=`<td><span class="cricket-mark${closed?" closed":""}">${markDisplay(m)}</span></td>`;
    });
    html+=`</tr>`;
  });
  html+=`<tr style="border-top:1px solid #1e1e2e"><td style="color:var(--dart-text-muted);font-size:10px;font-family:'DM Sans',sans-serif;letter-spacing:1px">PTS</td>`;
  state.cr.points.forEach((p,i)=>{ html+=`<td class="cricket-points${i===state.cr.current?" active":""}">${p}</td>`; });
  html+=`</tr></tbody>`;
  table.innerHTML=html;
}

/** Renders full cricket UI. */
export function renderCricket(){
  renderCricketTable();
  document.getElementById("cr-title").textContent=`Cricket · Runde ${state.cr.round}`;
  for(let i=0;i<3;i++){
    const slot=document.getElementById(`cr-slot-${i}`);
    const t=state.cr.throws[i];
    slot.textContent=t?(t.miss?"·":t.label):"—";
    slot.className="throw-slot"+(t?" hit":"");
  }
  const btn=document.getElementById("cr-next");
  btn.style.display=(state.cr.throws.length>0&&!state.cr.winner)?"":"none";
  btn.textContent=state.cr.throws.length<3?"ZÄHLEN & WEITER":"NÄCHSTER SPIELER";
  disableBoard(boardSVGcr,!!state.cr.winner);
}

/**
 * Parses a throw label into cricket hit info.
 * @param {string} label
 * @returns {{num:number, count:number}|null}
 */
export function getCricketHit(label){
  if(label==="Bull") return {num:25,count:2};
  if(label==="Bull 25") return {num:25,count:1};
  const tm=label.match(/^T(\d+)$/); if(tm) return {num:+tm[1],count:3};
  const dm=label.match(/^D(\d+)$/); if(dm) return {num:+dm[1],count:2};
  const sm=label.match(/^(\d+)$/); if(sm) return {num:+sm[1],count:1};
  return null;
}

/**
 * Handles a click on the cricket dartboard.
 * @param {PointerEvent} e
 */
export function handleCricketClick(e){
  e.preventDefault();
  if(e.pointerType==="mouse"&&e.button!==0) return;
  if(state.cr.winner||state.cr.throws.length>=3) return;
  const {x,y}=svgCoords(boardSVGcr,e);
  const hit=hitFromXY(x,y);
  if(!hit) return;

  const throwObj={...hit,svgX:x,svgY:y};
  redrawAllHits(boardSVGcr, state.cr.historicThrows[state.cr.current], state.cr.throws);
  const cs=getCricketHit(hit.label);
  const isCricketTarget=cs&&CRICKET_TARGETS.includes(cs.num);

  if(hit.miss||!isCricketTarget){
    state.cr.throws.push({...throwObj,miss:true});
    renderCricket();
    if(state.cr.throws.length===3) setTimeout(advanceCricket,350);
    return;
  }

  const {num,count}=cs;
  const curMark=state.cr.marks[state.cr.current][num];
  const newMark=curMark+count;
  state.cr.marks[state.cr.current][num]=newMark;

  const actualMarks=Math.min(count, Math.max(0, 3-curMark));
  state.cr.totalMarks[state.cr.current]+=actualMarks;
  state.cr.totalThrows[state.cr.current]++;

  if(curMark<3&&newMark>=3){
    if(state.cr.firstClosed[state.cr.current]===null) state.cr.firstClosed[state.cr.current]=num;
    state.cr.closedOrder[state.cr.current].push(num);
  }

  const overflow=Math.max(0,newMark-3);
  if(overflow>0){
    const allClosed=state.cfg.players.every((_,pi)=>pi===state.cr.current||state.cr.marks[pi][num]>=3);
    if(!allClosed) state.cr.points[state.cr.current]+=overflow*num;
  }

  state.cr.throws.push(throwObj);
  const allClosed=CRICKET_TARGETS.every(t=>state.cr.marks[state.cr.current][t]>=3);
  const maxPts=Math.max(...state.cr.points);
  if(allClosed&&state.cr.points[state.cr.current]>=maxPts){
    state.cr.winner=state.cr.current;
    if(window._saveGameToFirebase) window._saveGameToFirebase(state.cr.current);
    if(window._showWinner) window._showWinner(state.cfg.players[state.cr.current],state.cr.round);
  }

  renderCricket();
  if(!state.cr.winner&&state.cr.throws.length===3) setTimeout(advanceCricket,350);
}

/** Advances to the next cricket player. */
export function advanceCricket(){
  const pi=state.cr.current;
  const turnMarks=state.cr.throws.filter(t=>!t.miss).reduce((s,t)=>{
    const cs=getCricketHit(t.label);
    if(!cs||!CRICKET_TARGETS.includes(cs.num)) return s;
    const prev=state.cr.marks[pi][cs.num]-cs.count;
    return s+Math.min(cs.count,Math.max(0,3-Math.max(0,prev)));
  },0);
  state.cr.turnScores[pi].push(turnMarks);
  state.cr.totalThrows[pi]+=state.cr.throws.filter(t=>!t.miss).length;
  state.cr.history.push({marks:state.cr.marks.map(m=>({...m})),points:[...state.cr.points],current:pi,round:state.cr.round,throwCount:state.cr.throws.length,historicLens:state.cr.historicThrows.map(a=>a.length)});
  state.cr.historicThrows[pi].push(...state.cr.throws.filter(t=>t.svgX!=null));
  state.cr.throws=[];
  const next=(pi+1)%state.cfg.players.length;
  state.cr.current=next;
  if(next===0) state.cr.round++;
  redrawAllHits(boardSVGcr, state.cr.historicThrows[next], []);
  renderCricket();
}
