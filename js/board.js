/**
 * board.js — SVG dartboard geometry, rendering, and hit detection.
 */

import { state } from './state.js';

// ── Geometry constants ────────────────────────────────────────────
export const SECTORS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
export const R = {
  bull:    7,
  bull25:  17,
  triIn:   100,
  triOut:  115,
  dblIn:   171,
  dblOut:  184,
  numR:    194.5,
  board:   214,
  miss:    243
};
export const CX = 210, CY = 210;
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
  svgEl.setAttribute("viewBox","-38 -38 496 496");
  const ns="http://www.w3.org/2000/svg";
  function el(tag,attrs){
    const e=document.createElementNS(ns,tag);
    for(const [k,v] of Object.entries(attrs)) e.setAttribute(k,v);
    return e;
  }

  // ── Miss-Ring background (drawn first, behind everything) ─────
  svgEl.appendChild(el("circle",{cx:CX,cy:CY,r:"243",fill:"#16110F"}));
  svgEl.appendChild(el("circle",{cx:CX,cy:CY,r:"242",fill:"none",
    stroke:"rgba(255,77,79,.22)","stroke-width":"1"}));
  const missTop=el("text",{x:CX,y:CY-225,"text-anchor":"middle","dominant-baseline":"central",
    fill:"rgba(255,92,94,.6)","font-size":"13","font-weight":"800","letter-spacing":"2",
    "font-family":"Manrope, sans-serif"});
  missTop.textContent="MISS";
  svgEl.appendChild(missTop);
  const missBot=el("text",{x:CX,y:CY+225,"text-anchor":"middle","dominant-baseline":"central",
    fill:"rgba(255,92,94,.6)","font-size":"13","font-weight":"800","letter-spacing":"2",
    "font-family":"Manrope, sans-serif"});
  missBot.textContent="MISS";
  svgEl.appendChild(missBot);

  // ── Board band (dark circle behind segments) ──────────────────
  svgEl.appendChild(el("circle",{cx:CX,cy:CY,r:"214",fill:"#0c0b09"}));

  // ── Segments ──────────────────────────────────────────────────
  const cream="#E8DCBE", black="#17150F", red="#C8362B", green="#1E9B55";
  const so={"stroke":"#070708","stroke-width":"1.4"};
  for(let i=0;i<20;i++){
    const even=i%2===0;
    const singleFill=even?black:cream;
    const scoreFill=even?red:green;
    svgEl.appendChild(el("path",{d:slicePath(R.bull25,R.triIn, i),fill:singleFill,...so}));
    svgEl.appendChild(el("path",{d:slicePath(R.triIn, R.triOut,i),fill:scoreFill,...so}));
    svgEl.appendChild(el("path",{d:slicePath(R.triOut,R.dblIn, i),fill:singleFill,...so}));
    svgEl.appendChild(el("path",{d:slicePath(R.dblIn, R.dblOut,i),fill:scoreFill,...so}));
  }

  // ── Outer Bull and Bull ───────────────────────────────────────
  svgEl.appendChild(el("circle",{cx:CX,cy:CY,r:R.bull25,fill:green}));
  svgEl.appendChild(el("circle",{cx:CX,cy:CY,r:R.bull,  fill:red}));

  // ── Number ring ───────────────────────────────────────────────
  for(let i=0;i<20;i++){
    const mid=sectorAngle(i)+toRad(9);
    const [x,y]=polarXY(R.numR,mid);
    const t=el("text",{x,y,"text-anchor":"middle","dominant-baseline":"central",
      fill:"#F3ECD8","font-size":"16","font-weight":"700",
      "font-family":"Manrope, sans-serif"});
    t.textContent=SECTORS[i];
    svgEl.appendChild(t);
  }

  // ── Separator + Gold frame (outside number ring) ──────────────
  svgEl.appendChild(el("circle",{cx:CX,cy:CY,r:"208",fill:"none",
    stroke:"rgba(0,0,0,.55)","stroke-width":"2"}));
  svgEl.appendChild(el("circle",{cx:CX,cy:CY,r:"213",fill:"none",
    stroke:"#8f7327","stroke-width":"1.5"}));

  // ── Groups for dynamic content ────────────────────────────────
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
  const markerFill=isMiss
    ?(faded?"rgba(220,50,50,.4)":"#e53935")
    :(faded?"rgba(244,215,126,.4)":"#F4D77E");

  const shadow=document.createElementNS(ns,"circle");
  shadow.setAttribute("cx",x); shadow.setAttribute("cy",y); shadow.setAttribute("r","8");
  shadow.setAttribute("fill","rgba(0,0,0,.5)");

  const marker=document.createElementNS(ns,"circle");
  marker.setAttribute("cx",x); marker.setAttribute("cy",y); marker.setAttribute("r","6.5");
  marker.setAttribute("fill",markerFill);
  marker.setAttribute("stroke","#0c0b08"); marker.setAttribute("stroke-width","1.8");

  const dot=document.createElementNS(ns,"circle");
  dot.setAttribute("cx",x); dot.setAttribute("cy",y); dot.setAttribute("r","2");
  dot.setAttribute("fill","#0c0b08");

  g.appendChild(shadow); g.appendChild(marker); g.appendChild(dot);
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
 * First segment pulses strongly (next throw), rest are static and dimmer.
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

  parts.forEach((part, partIdx)=>{
    const isNext=partIdx===0;
    const isTriple=part.startsWith("T");
    const isDouble=part.startsWith("D");
    const isBull=part==="Bull"||part==="D25";
    const num=isBull?25:parseInt(part.replace(/[TDS]/,""));

    const fillColor=isNext?"rgba(80,255,120,0.45)":"rgba(80,200,255,0.20)";
    const strokeColor=isNext?"#00ff88":"#44aaff";
    const strokeWidth=isNext?"3":"1.5";

    if(isBull){
      const r=part==="D25"?R.bull25:R.bull;
      const c=document.createElementNS(ns,"circle");
      c.setAttribute("cx",CX); c.setAttribute("cy",CY); c.setAttribute("r",r);
      c.setAttribute("fill",fillColor);
      c.setAttribute("stroke",strokeColor); c.setAttribute("stroke-width",strokeWidth);
      if(isNext) c.innerHTML=`<animate attributeName="opacity" values="0.5;1;0.5" dur="0.9s" repeatCount="indefinite"/>`;
      else c.setAttribute("opacity","0.6");
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
    path.setAttribute("fill",fillColor);
    path.setAttribute("stroke",strokeColor);
    path.setAttribute("stroke-width",strokeWidth);
    path.setAttribute("stroke-linejoin","round");
    g.appendChild(path);

    if(isNext){
      path.innerHTML=`
        <animate attributeName="opacity" values="0.5;1;0.5" dur="0.9s" repeatCount="indefinite"/>
        <animate attributeName="stroke-width" values="2;5;2" dur="0.9s" repeatCount="indefinite"/>`;
      if(num>=1&&num<=20){
        const mid=sectorAngle(idx)+toRad(9);
        const labelR=isTriple?(R.triIn+R.triOut)/2:
          isDouble?(R.dblIn+R.dblOut)/2:
          (R.bull25+R.dblIn)/2;
        const [lx,ly]=polarXY(labelR,mid);
        const label=document.createElementNS(ns,"text");
        label.setAttribute("x",lx); label.setAttribute("y",ly);
        label.setAttribute("text-anchor","middle");
        label.setAttribute("dominant-baseline","middle");
        label.setAttribute("fill","#fff"); label.setAttribute("font-size","11");
        label.setAttribute("font-family","'Bebas Neue',sans-serif");
        label.setAttribute("pointer-events","none");
        label.textContent=part;
        label.innerHTML+=`<animate attributeName="opacity" values="0.6;1;0.6" dur="0.9s" repeatCount="indefinite"/>`;
        g.appendChild(label);
      }
    } else {
      path.setAttribute("opacity","0.6");
    }
  });
}

/**
 * Flashes the hit segment briefly on the SVG board (e.g. for voice hits).
 * @param {SVGElement} svgEl
 * @param {{label:string, miss?:boolean}} hit
 * @param {number} durationMs
 */
export function flashSegment(svgEl, hit, durationMs=600){
  const ns="http://www.w3.org/2000/svg";
  const g=svgEl.querySelector("#"+svgEl.id+"-hits");
  if(!g) return;
  let flashEl;
  if(hit.label==="Bull"){
    flashEl=document.createElementNS(ns,"circle");
    flashEl.setAttribute("cx",CX); flashEl.setAttribute("cy",CY);
    flashEl.setAttribute("r",R.bull);
    flashEl.setAttribute("fill","rgba(255,255,100,0.7)");
  } else if(hit.label==="Bull 25"){
    flashEl=document.createElementNS(ns,"circle");
    flashEl.setAttribute("cx",CX); flashEl.setAttribute("cy",CY);
    flashEl.setAttribute("r",R.bull25);
    flashEl.setAttribute("fill","rgba(255,255,100,0.5)");
  } else if(hit.miss){
    flashEl=document.createElementNS(ns,"circle");
    flashEl.setAttribute("cx",CX); flashEl.setAttribute("cy",CY);
    flashEl.setAttribute("r",R.board);
    flashEl.setAttribute("fill","rgba(220,50,50,0.3)");
  } else {
    const isTriple=hit.label.startsWith("T");
    const isDouble=hit.label.startsWith("D");
    const num=parseInt(hit.label.replace(/[TDS]/,""))||0;
    const idx=SECTORS.indexOf(num);
    if(idx<0) return;
    let rIn,rOut;
    if(isTriple){rIn=R.triIn;rOut=R.triOut;}
    else if(isDouble){rIn=R.dblIn;rOut=R.dblOut;}
    else{rIn=R.bull25;rOut=R.dblIn;}
    flashEl=document.createElementNS(ns,"path");
    flashEl.setAttribute("d",slicePath(rIn,rOut,idx));
    flashEl.setAttribute("fill","rgba(255,255,100,0.6)");
  }
  flashEl.setAttribute("opacity","0");
  flashEl.innerHTML=`<animate attributeName="opacity" values="0;0.8;0.8;0" dur="${durationMs}ms" repeatCount="1" fill="freeze"/>`;
  g.appendChild(flashEl);
  setTimeout(()=>flashEl.remove(), durationMs+50);
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
  svgEl.setAttribute("viewBox","-38 -38 496 496");
  function mkEl(tag,attrs){ const e=document.createElementNS(ns,tag); for(const[k,v] of Object.entries(attrs)) e.setAttribute(k,v); return e; }
  const cx=CX, cy=CY;
  svgEl.appendChild(mkEl("circle",{cx,cy,r:R.board,fill:"#0c0b09"}));
  const SR=[
    {r1:R.bull25,r2:R.triIn},
    {r1:R.triIn, r2:R.triOut},
    {r1:R.triOut,r2:R.dblIn},
    {r1:R.dblIn, r2:R.dblOut}
  ];
  const cols=[
    ["#17150F","#E8DCBE"],
    ["#C8362B","#1E9B55"],
    ["#17150F","#E8DCBE"],
    ["#C8362B","#1E9B55"]
  ];
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
  svgEl.appendChild(mkEl("circle",{cx,cy,r:R.bull25,fill:"#1E9B55"}));
  svgEl.appendChild(mkEl("circle",{cx,cy,r:R.bull,  fill:"#C8362B"}));
  dots.slice(-600).forEach(s=>{
    if(s.x==null||s.y==null||isNaN(s.x)||isNaN(s.y)) return;
    const isMiss=s.l==="Miss";
    svgEl.appendChild(mkEl("circle",{
      cx:s.x, cy:s.y, r:"5",
      fill: isMiss?"rgba(220,50,50,0.4)":"rgba(244,215,126,0.4)",
      stroke: isMiss?"rgba(200,30,30,0.8)":"rgba(200,160,40,0.8)",
      "stroke-width":"0.8"
    }));
  });
}
