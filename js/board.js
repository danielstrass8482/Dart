/**
 * board.js — SVG dartboard geometry, rendering, and hit detection.
 */

import { state } from './state.js';

// ── Geometry constants ────────────────────────────────────────────
export const SECTORS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
export const R = {
  bull:    13,
  bull25:  32,
  triIn:   109,
  triOut:  125,
  dblIn:   186,
  dblOut:  200,
  numR:    216,
  board:   228,
  miss:    229
};
export const CX = 265, CY = 265;
export const CRICKET_TARGETS = [20,19,18,17,16,15,25];

/** @param {number} d degrees */
export function toRad(d){ return d*Math.PI/180; }
/** @param {number} i sector index */
export function sectorAngle(i){ return toRad(-90-9+i*18); }
/** @param {number} r radius @param {number} a angle */
export function polarXY(r,a){ return [CX+r*Math.cos(a), CY+r*Math.sin(a)]; }

/**
 * Returns SVG path string for a sector slice.
 * @param {number} rIn inner radius
 * @param {number} rOut outer radius
 * @param {number} i sector index
 */
export function slicePath(rIn,rOut,i){
  const a1=sectorAngle(i), a2=sectorAngle(i+1);
  const [x1,y1]=polarXY(rIn,a1), [x2,y2]=polarXY(rOut,a1);
  const [x3,y3]=polarXY(rOut,a2), [x4,y4]=polarXY(rIn,a2);
  return `M${x1},${y1}L${x2},${y2}A${rOut},${rOut} 0 0,1 ${x3},${y3}L${x4},${y4}A${rIn},${rIn} 0 0,0 ${x1},${y1}Z`;
}

/**
 * Determines which dart segment was hit given SVG coordinates.
 * @param {number} sx SVG x coordinate
 * @param {number} sy SVG y coordinate
 * @returns {{score:number, label:string, miss?:boolean}|null}
 */
export function hitFromXY(sx,sy){
  const dx=sx-CX, dy=sy-CY;
  const dist=Math.sqrt(dx*dx+dy*dy);
  if(dist<=R.bull)   return {score:50, label:"Bull"};
  if(dist<=R.bull25) return {score:25, label:"Bull 25"};
  if(dist>R.miss)    return null;
  if(dist>R.dblOut)  return {score:0, label:"Miss", miss:true};
  let angle=Math.atan2(dy,dx)*180/Math.PI+90+9;
  if(angle<0) angle+=360; if(angle>=360) angle-=360;
  const idx=Math.floor(angle/18);
  const num=SECTORS[idx%20];
  if(dist<=R.triIn)  return {score:num,   label:`${num}`};
  if(dist<=R.triOut) return {score:num*3, label:`T${num}`};
  if(dist<=R.dblIn)  return {score:num,   label:`${num}`};
  return                    {score:num*2, label:`D${num}`};
}

/**
 * Builds the SVG dartboard inside the given SVG element.
 * @param {SVGElement} svgEl
 */
export function buildBoard(svgEl){
  svgEl.innerHTML="";
  const ns="http://www.w3.org/2000/svg";
  function el(tag,attrs){
    const e=document.createElementNS(ns,tag);
    for(const [k,v] of Object.entries(attrs)) e.setAttribute(k,v);
    return e;
  }
  svgEl.appendChild(el("circle",{cx:CX,cy:CY,r:R.miss,fill:"#1a0a0a"}));
  svgEl.appendChild(el("circle",{cx:CX,cy:CY,r:R.miss-1,fill:"none",
    stroke:"#5a2020","stroke-width":"1.5","stroke-dasharray":"4 3"}));
  const missLabel=el("text",{x:CX,y:CY+R.miss-8,"text-anchor":"middle","dominant-baseline":"middle",
    fill:"#5a2020","font-size":"9","font-family":"'DM Sans',sans-serif","letter-spacing":"3"});
  missLabel.textContent="MISS ZONE";
  svgEl.appendChild(missLabel);
  svgEl.appendChild(el("circle",{cx:CX,cy:CY,r:R.board,fill:"#1a1008"}));
  for(let i=0;i<20;i++){
    const even=i%2===0;
    svgEl.appendChild(el("path",{d:slicePath(R.bull25,R.triIn,i),  fill:even?"#1c1c1c":"#f0ead6"}));
    svgEl.appendChild(el("path",{d:slicePath(R.triIn, R.triOut,i), fill:even?"#c0392b":"#27ae60"}));
    svgEl.appendChild(el("path",{d:slicePath(R.triOut,R.dblIn,i),  fill:even?"#1c1c1c":"#f0ead6"}));
    svgEl.appendChild(el("path",{d:slicePath(R.dblIn, R.dblOut,i), fill:even?"#c0392b":"#27ae60"}));
  }
  for(let i=0;i<20;i++){
    const a=sectorAngle(i);
    const [x1,y1]=polarXY(R.bull25,a),[x2,y2]=polarXY(R.dblOut,a);
    svgEl.appendChild(el("line",{x1,y1,x2,y2,stroke:"#888","stroke-width":"1"}));
  }
  [R.bull25,R.triIn,R.triOut,R.dblIn,R.dblOut].forEach(r=>{
    svgEl.appendChild(el("circle",{cx:CX,cy:CY,r,fill:"none",stroke:"#888","stroke-width":"1"}));
  });
  svgEl.appendChild(el("circle",{cx:CX,cy:CY,r:R.bull25,fill:"#27ae60"}));
  svgEl.appendChild(el("circle",{cx:CX,cy:CY,r:R.bull,  fill:"#c0392b"}));
  for(let i=0;i<20;i++){
    const mid=sectorAngle(i)+toRad(9);
    const [x,y]=polarXY(R.numR,mid);
    const t=el("text",{x,y,"text-anchor":"middle","dominant-baseline":"middle",
      fill:"#ffffff","font-size":"17","font-family":"'Bebas Neue',sans-serif"});
    t.textContent=SECTORS[i];
    svgEl.appendChild(t);
  }
  const coG=document.createElementNS(ns,"g");
  coG.id=svgEl.id+"-checkout";
  svgEl.appendChild(coG);
  const hitsG=document.createElementNS(ns,"g");
  hitsG.id=svgEl.id+"-hits";
  svgEl.appendChild(hitsG);
  const overlay=el("circle",{cx:CX,cy:CY,r:R.miss,fill:"rgba(0,0,0,0)",id:svgEl.id+"-overlay"});
  svgEl.appendChild(overlay);
}

/**
 * Adds a hit dot to the SVG board.
 * @param {SVGElement} svgEl
 * @param {number} x
 * @param {number} y
 * @param {boolean} faded
 * @param {boolean} isMiss
 */
export function addHitDot(svgEl, x, y, faded=false, isMiss=false){
  const ns="http://www.w3.org/2000/svg";
  const g=svgEl.querySelector("#"+svgEl.id+"-hits");
  if(isMiss){
    const op = faded ? 0.15 : 0.85;
    const outer=document.createElementNS(ns,"circle");
    outer.setAttribute("cx",x); outer.setAttribute("cy",y); outer.setAttribute("r","7");
    outer.setAttribute("fill",`rgba(220,50,50,${faded?0.08:0.2})`);
    const mid=document.createElementNS(ns,"circle");
    mid.setAttribute("cx",x); mid.setAttribute("cy",y); mid.setAttribute("r","4");
    mid.setAttribute("fill","#e53935"); mid.setAttribute("opacity",op);
    const inner=document.createElementNS(ns,"circle");
    inner.setAttribute("cx",x); inner.setAttribute("cy",y); inner.setAttribute("r","1.5");
    inner.setAttribute("fill","#fff"); inner.setAttribute("opacity",faded?"0.2":"0.8");
    g.appendChild(outer); g.appendChild(mid); g.appendChild(inner);
  } else {
    const op = faded ? 0.12 : 0.9;
    const outer=document.createElementNS(ns,"circle");
    outer.setAttribute("cx",x); outer.setAttribute("cy",y); outer.setAttribute("r","7");
    outer.setAttribute("fill",`rgba(255,220,0,${faded?0.08:0.25})`);
    const mid=document.createElementNS(ns,"circle");
    mid.setAttribute("cx",x); mid.setAttribute("cy",y); mid.setAttribute("r","4");
    mid.setAttribute("fill","#ffdd00"); mid.setAttribute("opacity",op);
    const inner=document.createElementNS(ns,"circle");
    inner.setAttribute("cx",x); inner.setAttribute("cy",y); inner.setAttribute("r","1.5");
    inner.setAttribute("fill","#fff"); inner.setAttribute("opacity",faded?"0.2":"1");
    g.appendChild(outer); g.appendChild(mid); g.appendChild(inner);
  }
}

/**
 * Redraws all hit dots (historic faded, current bright).
 * @param {SVGElement} svgEl
 * @param {Array} allThrows
 * @param {Array} currentThrows
 */
export function redrawAllHits(svgEl, allThrows, currentThrows){
  const g=svgEl.querySelector("#"+svgEl.id+"-hits");
  if(g) g.innerHTML="";
  allThrows.forEach(t=>{ if(t.svgX!=null) addHitDot(svgEl, t.svgX, t.svgY, true, t.miss||false); });
  currentThrows.forEach(t=>{ if(t.svgX!=null) addHitDot(svgEl, t.svgX, t.svgY, false, t.miss||false); });
}

/**
 * Clears all hit dots from the board.
 * @param {SVGElement} svgEl
 */
export function clearHits(svgEl){
  const g=svgEl.querySelector("#"+svgEl.id+"-hits");
  if(g) g.innerHTML="";
}

/**
 * Highlights checkout suggestion segments on the board.
 * @param {SVGElement} svgEl
 * @param {number} remaining
 */
export function highlightCheckout(svgEl, remaining){
  if(localStorage.getItem("dart_checkout_highlight")==="false") return;
  const g=svgEl.querySelector("#"+svgEl.id+"-checkout");
  if(!g){ return; }
  g.innerHTML="";
  const CHECKOUTS = window._CHECKOUTS;
  const co=CHECKOUTS[remaining];
  if(!co||remaining>170||remaining<=1) return;

  const ns="http://www.w3.org/2000/svg";
  const throwsArr = (svgEl.id==="board-svg" ? state.x01.throws : state.cr.throws) || [];
  const parts=co.split(" ").slice(0, 3-throwsArr.length);

  parts.forEach(part=>{
    const isTriple=part.startsWith("T");
    const isDouble=part.startsWith("D");
    const isBull=part==="Bull"||part==="D25";
    const num=isBull?25:parseInt(part.replace(/[TDS]/,""));

    if(isBull){
      const r=part==="D25"?R.bull25:R.bull;
      const c=document.createElementNS(ns,"circle");
      c.setAttribute("cx",CX); c.setAttribute("cy",CY); c.setAttribute("r",r);
      c.setAttribute("fill","rgba(80,255,120,0.35)");
      c.setAttribute("stroke","#00ff88"); c.setAttribute("stroke-width","2");
      g.appendChild(c);
      return;
    }

    const idx=SECTORS.indexOf(num);
    if(idx<0) return;
    let rIn,rOut;
    if(isTriple){ rIn=R.triIn; rOut=R.triOut; }
    else if(isDouble){ rIn=R.dblIn; rOut=R.dblOut; }
    else { rIn=R.bull25; rOut=R.dblIn; }

    const path=document.createElementNS(ns,"path");
    path.setAttribute("d",slicePath(rIn,rOut,idx));
    path.setAttribute("fill","rgba(80,255,120,0.35)");
    path.setAttribute("stroke","#00ff88");
    path.setAttribute("stroke-width","2.5");
    path.setAttribute("stroke-linejoin","round");
    g.appendChild(path);
    path.innerHTML=`<animate attributeName="opacity" values="0.6;1;0.6" dur="1.2s" repeatCount="indefinite"/>`;
  });
}

/**
 * Clears checkout highlight from board.
 * @param {SVGElement} svgEl
 */
export function clearCheckout(svgEl){
  const g=svgEl.querySelector("#"+svgEl.id+"-checkout");
  if(g) g.innerHTML="";
}

/**
 * Disables or enables board interaction overlay.
 * @param {SVGElement} svgEl
 * @param {boolean} on
 */
export function disableBoard(svgEl,on){
  const o=svgEl.querySelector("#"+svgEl.id+"-overlay");
  if(o) o.setAttribute("fill",on?"rgba(0,0,0,0.45)":"rgba(0,0,0,0)");
}

/**
 * Converts pointer event coordinates to SVG coordinate space.
 * @param {SVGElement} svgEl
 * @param {PointerEvent} e
 * @returns {{x:number, y:number}}
 */
export function svgCoords(svgEl,e){
  const clientX=e.clientX!==undefined?e.clientX:(e.changedTouches?.[0]||e.touches?.[0])?.clientX||0;
  const clientY=e.clientY!==undefined?e.clientY:(e.changedTouches?.[0]||e.touches?.[0])?.clientY||0;
  const pt=svgEl.createSVGPoint();
  pt.x=clientX; pt.y=clientY;
  const p=pt.matrixTransform(svgEl.getScreenCTM().inverse());
  return {x:p.x, y:p.y};
}

/**
 * Draws a mini dartboard with scatter dots for stats view.
 * @param {SVGElement} svgEl
 * @param {Array<{x:number,y:number,l:string}>} dots
 */
export function drawMiniBoard(svgEl, dots){
  const ns="http://www.w3.org/2000/svg";
  svgEl.innerHTML="";
  function mkEl(tag,attrs){ const e=document.createElementNS(ns,tag); for(const[k,v] of Object.entries(attrs)) e.setAttribute(k,v); return e; }
  const cx=265,cy=265;
  svgEl.appendChild(mkEl("circle",{cx,cy,r:228,fill:"#1a1008"}));
  const SR=[{r1:32,r2:109},{r1:109,r2:125},{r1:125,r2:186},{r1:186,r2:200}];
  const cols=[["#1c1c1c","#f0ead6"],["#c0392b","#27ae60"],["#1c1c1c","#f0ead6"],["#c0392b","#27ae60"]];
  function sA(i){ return (-90-9+i*18)*Math.PI/180; }
  function pXY(r,a){ return [cx+r*Math.cos(a),cy+r*Math.sin(a)]; }
  function sPth(r1,r2,i){
    const a1=sA(i),a2=sA(i+1);
    const[x1,y1]=pXY(r1,a1),[x2,y2]=pXY(r2,a1),[x3,y3]=pXY(r2,a2),[x4,y4]=pXY(r1,a2);
    return `M${x1},${y1}L${x2},${y2}A${r2},${r2} 0 0,1 ${x3},${y3}L${x4},${y4}A${r1},${r1} 0 0,0 ${x1},${y1}Z`;
  }
  SR.forEach(({r1,r2},ri)=>{
    for(let i=0;i<20;i++) svgEl.appendChild(mkEl("path",{d:sPth(r1,r2,i),fill:cols[ri][i%2]}));
  });
  svgEl.appendChild(mkEl("circle",{cx,cy,r:32,fill:"#27ae60"}));
  svgEl.appendChild(mkEl("circle",{cx,cy,r:13,fill:"#c0392b"}));
  dots.slice(-600).forEach(s=>{
    if(s.x==null||s.y==null||isNaN(s.x)||isNaN(s.y)) return;
    const isMiss=s.l==="Miss";
    svgEl.appendChild(mkEl("circle",{
      cx:s.x, cy:s.y, r:"5",
      fill: isMiss?"rgba(220,50,50,0.4)":"rgba(255,220,0,0.4)",
      stroke: isMiss?"rgba(200,30,30,0.8)":"rgba(255,200,0,0.8)",
      "stroke-width":"0.8"
    }));
  });
}
