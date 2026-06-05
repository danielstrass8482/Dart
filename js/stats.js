/**
 * stats.js — Statistics loading, rendering, player bar, trend chart.
 */

import { state } from './state.js';
import { drawMiniBoard } from './board.js';
import { loadCoachHistoryStats } from './coach.js';

export let statsSelectedPlayer = null;
export let statsRange = 'all';
export let statsFrom = null, statsTo = null;
export let allGamesCache = [];
export let statsContext = 'all';

/**
 * Sets the stats selected player.
 * @param {string|null} pid
 */
export function setStatsSelectedPlayer(pid){ statsSelectedPlayer = pid; }
export function setStatsRange(r){ statsRange = r; }
export function setStatsFrom(f){ statsFrom = f; }
export function setStatsTo(t){ statsTo = t; }
export function setAllGamesCache(g){ allGamesCache = g; }
export function setStatsContext(c){ statsContext = c; }

/**
 * Computes time range {from, to} based on current statsRange.
 * @returns {{from:number, to:number}}
 */
export function getTimeRange(){
  const now=Date.now();
  const day=86400000;
  if(statsRange==="today")  return {from:new Date().setHours(0,0,0,0), to:now+day};
  if(statsRange==="7d")     return {from:now-7*day, to:now+day};
  if(statsRange==="30d")    return {from:now-30*day, to:now+day};
  if(statsRange==="90d")    return {from:now-90*day, to:now+day};
  if(statsRange==="180d")   return {from:now-180*day, to:now+day};
  if(statsRange==="custom"&&statsFrom&&statsTo)
    return {from:new Date(statsFrom).getTime(), to:new Date(statsTo).getTime()+day};
  return {from:0, to:now+day};
}

/**
 * Returns the player color for a given name.
 * @param {string} name
 * @returns {string}
 */
function playerColor(name){
  const AVATAR_COLORS=["#e53935","#1e88e5","#43a047","#fb8c00","#8e24aa","#00897b","#e91e63","#546e7a"];
  let h=0; for(const c of name) h=(h*31+c.charCodeAt(0))%AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

/**
 * Analyzes segment frequency from scatter data.
 * @param {Array<{x:number,y:number,l:string}>} scatterData
 * @returns {Array<{num:number,single:number,double:number,triple:number,total:number}>}
 */
export function analyzeSegments(scatterData){
  const segments={};
  [...Array(20)].forEach((_,i)=>{ segments[i+1]={single:0,double:0,triple:0}; });
  segments[25]={single:0,double:0,triple:0};
  scatterData.forEach(p=>{
    if(!p.l||p.l==="Miss") return;
    const isTriple=p.l.startsWith("T");
    const isDouble=p.l.startsWith("D");
    const isBull=p.l==="Bull";
    const isBull25=p.l==="Bull 25";
    const num=isBull||isBull25?25:parseInt(p.l.replace(/[TDS]/,""))||0;
    if(!segments[num]) return;
    if(isTriple) segments[num].triple=(segments[num].triple||0)+1;
    else if(isDouble||isBull) segments[num].double++;
    else segments[num].single++;
  });
  return Object.entries(segments).map(([num,v])=>{
    const total=(v.single||0)+(v.double||0)+(v.triple||0);
    return {num:parseInt(num),single:v.single||0,double:v.double||0,triple:v.triple||0,total};
  }).filter(e=>e.total>0).sort((a,b)=>b.total-a.total);
}

/**
 * Returns {from, to} timestamps for a named time range.
 * @param {string} range "thismonth"|"lastmonth"|"prev2month"|"7d"|"30d"|"all"
 * @returns {{from:number, to:number}}
 */
function getCmpTimeRange(range){
  const now=Date.now();
  const mStart=new Date(); mStart.setDate(1); mStart.setHours(0,0,0,0);
  if(range==="thismonth") return {from:mStart.getTime(), to:now};
  if(range==="lastmonth"){
    const pm=new Date(mStart); pm.setMonth(pm.getMonth()-1);
    return {from:pm.getTime(), to:mStart.getTime()-1};
  }
  if(range==="prev2month"){
    const pm2=new Date(mStart); pm2.setMonth(pm2.getMonth()-2);
    const pm=new Date(mStart); pm.setMonth(pm.getMonth()-1);
    return {from:pm2.getTime(), to:pm.getTime()-1};
  }
  if(range==="7d") return {from:now-7*86400000, to:now};
  if(range==="30d") return {from:now-30*86400000, to:now};
  return {from:0, to:now+86400000};
}

/**
 * Loads scatter data for one comparison board and renders it.
 * @param {string} pid player ID
 * @param {Array} gamesCache all games from Firebase
 * @param {Object} options
 * @param {string} side "a"|"b"
 */
export async function loadScatterForComparison(pid, gamesCache, options={}, side="a"){
  const {type="timerange", timeFrom=0, timeTo=Date.now()+86400000, gameIdx=null, legNum="all"}=options;
  let scatter=[];
  if(type==="timerange"){
    scatter=gamesCache
      .filter(g=>(g.playerIds||[]).includes(pid)&&g.ts>=timeFrom&&g.ts<=timeTo&&g.mode!=="Cricket")
      .flatMap(g=>(g.players||[]).filter(p=>p.id===pid).flatMap(p=>p.scatter||[]))
      .filter(s=>s.x!=null&&s.y!=null);
  } else if(type==="game" && gameIdx!==null){
    const pidGames=[...gamesCache].filter(g=>(g.playerIds||[]).includes(pid)&&g.mode!=="Cricket").sort((a,b)=>b.ts-a.ts);
    const g=pidGames[gameIdx];
    if(g){
      let pts=(g.players||[]).filter(p=>p.id===pid).flatMap(p=>p.scatter||[]).filter(s=>s.x!=null&&s.y!=null);
      if(legNum!=="all") pts=pts.filter(s=>String(s.leg||1)===String(legNum));
      scatter=pts;
    }
  }
  const svg=document.getElementById(`scatter-cmp-${side}`);
  const info=document.getElementById(`scatter-cmp-${side}-info`);
  if(svg) drawMiniBoard(svg, scatter);
  if(info) info.textContent=`${scatter.length} Würfe`;
}

/** Renders the player selector bar for stats. */
export function renderStatsPlayerBar(){
  const bar=document.getElementById("stats-player-bar");
  if(!bar) return;
  let html=`<button class="stats-player-btn${statsSelectedPlayer===null?" active":""}" data-pid="all">
    Alle Spieler</button>`;
  state.allPlayers.forEach(p=>{
    const col=playerColor(p.name);
    const active=statsSelectedPlayer===p.id?" active":"";
    html+=`<button class="stats-player-btn${active}" data-pid="${p.id}">
      <span class="spb-dot" style="background:${col}"></span>${p.name}</button>`;
  });
  bar.innerHTML=html;
  bar.querySelectorAll(".stats-player-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      statsSelectedPlayer=btn.dataset.pid==="all"?null:btn.dataset.pid;
      renderStatsPlayerBar();
      loadAndRenderStats();
    });
  });
}

/** Main stats load + render function. */
export async function loadAndRenderStats(){
  const box=document.getElementById("stats-content");
  if(!box) return;
  box.innerHTML='<div class="stats-loading">Lade…</div>';
  if(!window.dartDB){ box.innerHTML='<div class="stats-loading">Datenbank nicht bereit.</div>'; return; }

  renderStatsPlayerBar();

  try{
    allGamesCache=await window.dartDB.loadStats();
    const {from,to}=getTimeRange();
    let games=allGamesCache.filter(g=>g.ts>=from&&g.ts<=to);
    if(statsSelectedPlayer){ games=games.filter(g=>(g.playerIds||[]).includes(statsSelectedPlayer)); }
    if(statsContext!=="all"){ games=games.filter(g=>g.context===statsContext||(statsContext==="casual"&&!g.context)); }

    if(!games.length){
      box.innerHTML='<div class="stats-loading">Keine Spiele im gewählten Zeitraum.</div>'; return;
    }

    const getPlayerData=(pid)=>games.flatMap(g=>(g.players||[]).filter(p=>pid?p.id===pid:true));
    const pid=statsSelectedPlayer;
    const pData=getPlayerData(pid);
    const x01Games=games.filter(g=>g.mode!=="Cricket");
    const crGames=games.filter(g=>g.mode==="Cricket");
    const x01Data=pData.filter(p=>p.avg3!==undefined);
    const crData=pData.filter(p=>p.cricketAvgMarks!==undefined);

    const coAtts=x01Data.reduce((s,p)=>s+(p.checkoutAtt||0),0);
    const coHits=x01Data.reduce((s,p)=>s+(p.checkoutHit||0),0);
    const coPct=coAtts>0?Math.round(coHits/coAtts*100):0;
    const best=x01Data.reduce((m,p)=>Math.max(m,p.best3||0),0);
    const f9vals=x01Data.map(p=>p.first9||null).filter(v=>v!==null);
    const f9avg=f9vals.length?Math.round(f9vals.reduce((a,b)=>a+b,0)/f9vals.length*10)/10:null;
    const allScatter=pData.flatMap(p=>p.scatter||[]);

    const crAvgs=crData.map(p=>p.cricketAvgMarks||0).filter(v=>v>0);
    const crAvg=crAvgs.length?Math.round(crAvgs.reduce((a,b)=>a+b,0)/crAvgs.length*10)/10:0;
    const crWins=crGames.filter(g=>pid?g.winnerId===pid:true).length;

    const avgs=x01Data.map(p=>p.avg3||0).filter(v=>v>0);
    const avg=avgs.length?Math.round(avgs.reduce((a,b)=>a+b,0)/avgs.length*10)/10:0;
    const wins=x01Games.filter(g=>pid?g.winnerId===pid:true).length;

    const playerName=pid?(state.allPlayers.find(p=>p.id===pid)?.name||"?"):"Alle";
    let html=`<div class="stats-section-title">${playerName} · ${games.length} Spiel${games.length!==1?"e":""}</div>`;

    if(x01Games.length>0){
      html+=`<div class="stats-section-title" style="font-size:13px;color:#aaa">501 / 301</div>`;
      html+=`<div class="stats-grid">
        <div class="stat-card"><div class="s-label">SPIELE</div><div class="s-value">${x01Games.length}</div></div>
        <div class="stat-card"><div class="s-label">SIEGE</div><div class="s-value">${wins}</div><div class="s-sub">${x01Games.length?Math.round(wins/x01Games.length*100):0}% Quote</div></div>
        <div class="stat-card"><div class="s-label">⌀ AUFNAHME</div><div class="s-value">${avg||"—"}</div></div>
        <div class="stat-card"><div class="s-label">FIRST 9 Ø</div><div class="s-value">${f9avg||"—"}</div><div class="s-sub">erste 9 Darts</div></div>
        <div class="stat-card"><div class="s-label">HIGHSCORE</div><div class="s-value">${best||"—"}</div></div>
        <div class="stat-card"><div class="s-label">CHECKOUT-QUOTE</div><div class="s-value">${coPct}%</div><div class="s-sub">${coHits}/${coAtts}</div></div>
        <div class="stat-card"><div class="s-label">⌀ DARTS</div><div class="s-value">${x01Games.length?Math.round(x01Games.reduce((s,g)=>s+(g.rounds||0),0)/x01Games.length*3):0}</div><div class="s-sub">pro Leg</div></div>
      </div>`;
    }

    if(crGames.length>0){
      html+=`<div class="stats-section-title" style="font-size:13px;color:#aaa">CRICKET</div>`;
      html+=`<div class="stats-grid">
        <div class="stat-card"><div class="s-label">SPIELE</div><div class="s-value">${crGames.length}</div></div>
        <div class="stat-card"><div class="s-label">SIEGE</div><div class="s-value">${crWins}</div><div class="s-sub">${crGames.length?Math.round(crWins/crGames.length*100):0}% Quote</div></div>
        <div class="stat-card"><div class="s-label">⌀ MARKS/AUFNAHME</div><div class="s-value">${crAvg||"—"}</div></div>
        <div class="stat-card"><div class="s-label">⌀ DARTS</div><div class="s-value">${crGames.length?Math.round(crGames.reduce((s,g)=>s+(g.rounds||0),0)/crGames.length*3):0}</div><div class="s-sub">pro Leg</div></div>
      </div>`;
    }

    if(!pid && state.allPlayers.length>1){
      html+=`<div class="stats-section-title">SPIELER VERGLEICH</div>
        <div class="history-list">
        <div class="history-header" style="grid-template-columns:1fr 45px 45px 45px 45px 45px 55px">
          <span>SPIELER</span><span>SIEGE</span><span>⌀</span><span>F9</span><span>BEST</span><span>CO%</span><span>CR ⌀M</span>
        </div>`;
      state.allPlayers.forEach(p=>{
        const pd=getPlayerData(p.id);
        const pgames=games.filter(g=>(g.playerIds||[]).includes(p.id));
        const pw=pgames.filter(g=>g.winnerId===p.id).length;
        const px01=pd.filter(x=>x.avg3!==undefined);
        const pa=px01.map(x=>x.avg3||0).filter(v=>v>0);
        const pavg=pa.length?Math.round(pa.reduce((a,b)=>a+b,0)/pa.length*10)/10:0;
        const pf9v=px01.map(x=>x.first9||null).filter(v=>v!==null);
        const pf9=pf9v.length?Math.round(pf9v.reduce((a,b)=>a+b,0)/pf9v.length*10)/10:null;
        const pb=px01.reduce((m,x)=>Math.max(m,x.best3||0),0);
        const pca=px01.reduce((s,x)=>s+(x.checkoutAtt||0),0);
        const pch=px01.reduce((s,x)=>s+(x.checkoutHit||0),0);
        const pco=pca>0?Math.round(pch/pca*100):0;
        const pcr=pd.filter(x=>x.cricketAvgMarks!==undefined);
        const pcrv=pcr.map(x=>x.cricketAvgMarks||0).filter(v=>v>0);
        const pcrAvg=pcrv.length?Math.round(pcrv.reduce((a,b)=>a+b,0)/pcrv.length*10)/10:null;
        const col=playerColor(p.name);
        html+=`<div class="history-row" style="grid-template-columns:1fr 45px 45px 45px 45px 45px 55px">
          <span style="display:flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${col};display:inline-block"></span>
            <strong>${p.name}</strong></span>
          <span>${pw}</span><span>${pavg||"—"}</span><span>${pf9||"—"}</span><span>${pb||"—"}</span><span>${pco}%</span><span>${pcrAvg||"—"}</span>
        </div>`;
      });
      html+=`</div>`;
    }

    const chartGames=[...games].reverse();
    if(chartGames.length>=2){
      html+=`<div class="stats-section-title">VERLAUF</div>
        <div class="chart-kpi-bar" id="chart-kpi-bar">
          <button class="chart-kpi-btn active" data-kpi="avg" style="background:#1e88e5;border-color:#1e88e5;color:#fff">⌀ Aufnahme</button>
          <button class="chart-kpi-btn" data-kpi="f9">First 9 Ø</button>
          <button class="chart-kpi-btn" data-kpi="best">Highscore</button>
          <button class="chart-kpi-btn" data-kpi="co">Checkout %</button>
          <button class="chart-kpi-btn" data-kpi="rounds">Darts</button>
          <button class="chart-kpi-btn" data-kpi="crmarks">Cricket ⌀M</button>
        </div>
        <div class="chart-wrap">
          <canvas id="trend-canvas" height="180"></canvas>
        </div>`;
    }

    if(allScatter.length){
      html+=`<div class="stats-section-title">TREFFERBILD (${Math.min(allScatter.length,600)} Würfe)</div>
        <div class="scatter-wrap">
          <svg id="scatter-svg" viewBox="36 36 458 458" style="display:block;width:100%;max-width:500px;max-height:500px;border-radius:8px;background:#0a0a0f;margin:0 auto"></svg>
        </div>`;

      // FEATURE 6: Scatter comparison (Premium) — hierarchical per-board selectors
      if(pid){
        const pidGames=[...allGamesCache].filter(g=>(g.playerIds||[]).includes(pid)&&g.mode!=="Cricket").sort((a,b)=>b.ts-a.ts).slice(0,20);
        const gameOpts=pidGames.map((g,i)=>{const d=new Date(g.ts);return `<option value="${i}">${d.getDate()}.${d.getMonth()+1}.${String(d.getFullYear()).slice(2)}</option>`;}).join("");
        const boardHtml=(side)=>{
          const S=side.toUpperCase();
          return `<div>
            <div style="display:flex;gap:4px;margin-bottom:4px;flex-wrap:wrap;justify-content:center">
              <button class="cmp-type-btn" data-side="${side}" data-type="timerange" style="flex:1;min-width:80px;padding:4px 6px;font-size:10px;border-radius:6px;border:1px solid #444;background:#1e88e5;color:#fff;cursor:pointer">Zeitraum</button>
              <button class="cmp-type-btn" data-side="${side}" data-type="game" style="flex:1;min-width:80px;padding:4px 6px;font-size:10px;border-radius:6px;border:1px solid #444;background:#2a2a2a;color:#888;cursor:pointer">Spiel</button>
            </div>
            <div id="cmp-timerange-${side}" style="display:flex;gap:3px;flex-wrap:wrap;justify-content:center;margin-bottom:4px">
              <button class="cmp-tr-btn" data-side="${side}" data-range="thismonth" style="padding:3px 6px;font-size:10px;border-radius:5px;border:1px solid #444;background:#1e88e5;color:#fff;cursor:pointer">${side==="a"?"Dieser Monat":"Vormonat"}</button>
              <button class="cmp-tr-btn" data-side="${side}" data-range="lastmonth" style="padding:3px 6px;font-size:10px;border-radius:5px;border:1px solid #444;background:#2a2a2a;color:#888;cursor:pointer">${side==="a"?"Vormonat":"Vor 2 Monate"}</button>
              <button class="cmp-tr-btn" data-side="${side}" data-range="7d" style="padding:3px 6px;font-size:10px;border-radius:5px;border:1px solid #444;background:#2a2a2a;color:#888;cursor:pointer">7 Tage</button>
              <button class="cmp-tr-btn" data-side="${side}" data-range="30d" style="padding:3px 6px;font-size:10px;border-radius:5px;border:1px solid #444;background:#2a2a2a;color:#888;cursor:pointer">30 Tage</button>
              <button class="cmp-tr-btn" data-side="${side}" data-range="all" style="padding:3px 6px;font-size:10px;border-radius:5px;border:1px solid #444;background:#2a2a2a;color:#888;cursor:pointer">Alles</button>
            </div>
            <div id="cmp-game-${side}" style="display:none;margin-bottom:4px">
              <select id="cmp-game-sel-${side}" style="width:100%;padding:4px;border-radius:6px;border:1px solid #444;background:#1a1a1a;color:#fff;font-size:11px">${gameOpts}</select>
              <select id="cmp-leg-sel-${side}" style="width:100%;padding:4px;border-radius:6px;border:1px solid #444;background:#1a1a1a;color:#fff;font-size:11px;margin-top:4px">
                <option value="all">Alle Legs</option>
              </select>
            </div>
            <svg id="scatter-cmp-${side}" viewBox="36 36 458 458" style="display:block;width:100%;border-radius:8px;background:#0a0a0f"></svg>
            <div id="scatter-cmp-${side}-info" style="font-size:10px;color:#aaa;text-align:center;margin-top:2px"></div>
          </div>`;
        };
        html+=`<div class="stats-section-title" style="display:flex;align-items:center;gap:8px;cursor:pointer" onclick="const w=document.getElementById('scatter-compare-wrap');w.style.display=w.style.display==='none'?'':'none';this.querySelector('.sc-arrow').textContent=this.querySelector('.sc-arrow').textContent==='▼'?'▲':'▼'">
          📊 TREFFERBILD VERGLEICH <span style="font-size:10px;background:#e8c44a;color:#000;padding:2px 6px;border-radius:8px;font-family:'DM Sans',sans-serif">PREMIUM</span>
          <span class="sc-arrow" style="color:#aaa;font-size:12px">▼</span>
        </div>
        <div id="scatter-compare-wrap" style="display:none" data-pid="${pid}" data-game-json='${JSON.stringify(pidGames.map((g,i)=>({i,ts:g.ts,id:g.id||null})))}'>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            ${boardHtml("a")}
            ${boardHtml("b")}
          </div>
        </div>`;
      }

      // FEATURE 7: Segment frequency table (Premium)
      html+=`<div class="stats-section-title" style="display:flex;align-items:center;gap:8px;cursor:pointer" onclick="document.getElementById('segment-analysis-wrap').style.display=document.getElementById('segment-analysis-wrap').style.display==='none'?'':'none';this.querySelector('.sa-arrow').textContent=this.querySelector('.sa-arrow').textContent==='▼'?'▲':'▼'">
        🎯 SEGMENT-ANALYSE <span style="font-size:10px;background:#e8c44a;color:#000;padding:2px 6px;border-radius:8px;font-family:'DM Sans',sans-serif">PREMIUM</span>
        <span class="sa-arrow" style="color:#aaa;font-size:12px">▼</span>
      </div>
      <div id="segment-analysis-wrap" style="display:none" data-scatter-json='${JSON.stringify(allScatter.slice(0,600))}'></div>`;
    }

    const doubleAgg={};
    x01Data.forEach(p=>{ if(!p.doubleStats) return; Object.entries(p.doubleStats).forEach(([field,v])=>{ if(!doubleAgg[field]) doubleAgg[field]={att:0,hit:0}; doubleAgg[field].att+=v.att||0; doubleAgg[field].hit+=v.hit||0; }); });
    const doubleEntries=Object.entries(doubleAgg).map(([f,v])=>({field:f,att:v.att,hit:v.hit,pct:v.att>0?Math.round(v.hit/v.att*100):0})).filter(e=>e.att>=1).sort((a,b)=>b.att-a.att);
    const bestDouble=doubleEntries.filter(e=>e.att>=3).sort((a,b)=>b.pct-a.pct)[0];
    const worstDouble=doubleEntries.filter(e=>e.att>=3).sort((a,b)=>a.pct-b.pct)[0];
    const mostTriedDouble=doubleEntries[0];

    if(doubleEntries.length>0){
      html+=`<div class="stats-section-title" style="display:flex;align-items:center">🎯 DOPPELFELD-STATISTIK <button class="help-btn" onclick="window.showHelp('Doppelfeld-Statistik','Die App erkennt automatisch wann du auf ein Doppelfeld zielst und trackt deine Trefferquote. So siehst du welche Doppelfelder deine Stärken und Schwächen sind.')">?</button></div>`;
      html+=`<div class="stats-grid" style="margin-bottom:10px">
        ${bestDouble?`<div class="stat-card"><div class="s-label">BESTES DOPPEL</div><div class="s-value">${bestDouble.field}</div><div class="s-sub">${bestDouble.pct}% (${bestDouble.hit}/${bestDouble.att})</div></div>`:""}
        ${worstDouble&&worstDouble.field!==bestDouble?.field?`<div class="stat-card"><div class="s-label">SCHWÄCHSTES DOPPEL</div><div class="s-value">${worstDouble.field}</div><div class="s-sub">${worstDouble.pct}% (${worstDouble.hit}/${worstDouble.att})</div></div>`:""}
        ${mostTriedDouble?`<div class="stat-card"><div class="s-label">MEIST GESPIELT</div><div class="s-value">${mostTriedDouble.field}</div><div class="s-sub">${mostTriedDouble.att} Versuche</div></div>`:""}
      </div>
      <div class="history-list" style="margin-bottom:14px">
        <div class="history-header" style="grid-template-columns:1fr 70px 70px 70px"><span>FELD</span><span>VERSUCHE</span><span>TREFFER</span><span>QUOTE</span></div>`;
      doubleEntries.forEach(e=>{
        const color=e.pct>=50?"#2e7d32":e.pct>=25?"#fb8c00":"#e53935";
        const barW=Math.round(e.pct);
        html+=`<div class="history-row" style="grid-template-columns:1fr 70px 70px 70px">
          <span style="display:flex;align-items:center;gap:8px">
            <strong>${e.field}</strong>
            <span style="width:100px;height:6px;background:#f0f0f0;border-radius:3px;display:inline-block;overflow:hidden;flex-shrink:0">
              <span style="display:block;height:6px;width:${barW}%;background:${color};border-radius:3px;transition:width 0.3s"></span>
            </span>
          </span>
          <span>${e.att}</span><span>${e.hit}</span>
          <span style="font-weight:700;color:${color}">${e.pct}%</span>
        </div>`;
      });
      html+=`</div>`;
    }

    html+=`<div id="coach-history-stats" style="margin-top:12px"></div>`;

    html+=`<div class="stats-section-title">LETZTE SPIELE</div>
      <div class="history-list">
      <div class="history-header"><span>GEWINNER</span><span>MODUS</span><span>DARTS</span><span>DATUM</span></div>`;
    games.slice(0,15).forEach(g=>{
      const d=new Date(g.ts);
      const ds=`${d.getDate()}.${d.getMonth()+1}.${String(d.getFullYear()).slice(2)}`;
      const isWin=pid?g.winnerId===pid:true;
      html+=`<div class="history-row">
        <span class="winner-tag" style="color:${isWin&&pid?"#2e7d32":"#1a1a1a"}">${g.winner||"—"}</span>
        <span class="mode-tag">${g.mode||"—"}</span>
        <span>${(g.rounds||0)*3}</span>
        <span style="color:#aaa;font-size:11px">${ds}</span>
      </div>`;
    });
    html+=`</div>`;

    box.innerHTML=html;
    loadCoachHistoryStats(statsSelectedPlayer);

    if(allScatter.length){
      const svg=document.getElementById("scatter-svg");
      if(svg) drawMiniBoard(svg, allScatter);

      // Render scatter comparison boards with hierarchical selectors
      if(pid){
        const wrap=document.getElementById("scatter-compare-wrap");
        if(wrap){
          const cmpState={
            a:{type:"timerange",range:"thismonth",gameIdx:0,legNum:"all"},
            b:{type:"timerange",range:"lastmonth",gameIdx:0,legNum:"all"}
          };

          const pidGamesAll=[...allGamesCache].filter(g=>(g.playerIds||[]).includes(pid)&&g.mode!=="Cricket").sort((a,b)=>b.ts-a.ts).slice(0,20);

          function populateLegSel(side){
            const st=cmpState[side];
            const sel=document.getElementById(`cmp-leg-sel-${side}`);
            if(!sel) return;
            if(st.type!=="game"){sel.innerHTML=`<option value="all">Alle Legs</option>`; return;}
            const g=pidGamesAll[st.gameIdx];
            if(!g){sel.innerHTML=`<option value="all">Alle Legs</option>`; return;}
            const pts=(g.players||[]).filter(p=>p.id===pid).flatMap(p=>p.scatter||[]).filter(s=>s.x!=null&&s.y!=null);
            const legs=[...new Set(pts.map(s=>s.leg||1))].sort((a,b)=>a-b);
            sel.innerHTML=`<option value="all">Alle Legs</option>`+legs.map(l=>`<option value="${l}">Leg ${l}</option>`).join("");
            sel.value=st.legNum;
          }

          function refreshBoard(side){
            const st=cmpState[side];
            const {from,to}=getCmpTimeRange(st.range);
            loadScatterForComparison(pid, allGamesCache, {type:st.type, timeFrom:from, timeTo:to, gameIdx:st.gameIdx, legNum:st.legNum}, side);
          }

          ["a","b"].forEach(side=>{
            // type buttons
            wrap.querySelectorAll(`.cmp-type-btn[data-side="${side}"]`).forEach(btn=>{
              btn.addEventListener("click",()=>{
                cmpState[side].type=btn.dataset.type;
                wrap.querySelectorAll(`.cmp-type-btn[data-side="${side}"]`).forEach(b=>{b.style.background="#2a2a2a";b.style.color="#888";});
                btn.style.background="#1e88e5"; btn.style.color="#fff";
                const trDiv=document.getElementById(`cmp-timerange-${side}`);
                const gDiv=document.getElementById(`cmp-game-${side}`);
                if(trDiv) trDiv.style.display=btn.dataset.type==="timerange"?"flex":"none";
                if(gDiv) gDiv.style.display=btn.dataset.type==="game"?"block":"none";
                populateLegSel(side);
                refreshBoard(side);
              });
            });
            // timerange buttons
            wrap.querySelectorAll(`.cmp-tr-btn[data-side="${side}"]`).forEach(btn=>{
              btn.addEventListener("click",()=>{
                cmpState[side].range=btn.dataset.range;
                wrap.querySelectorAll(`.cmp-tr-btn[data-side="${side}"]`).forEach(b=>{b.style.background="#2a2a2a";b.style.color="#888";});
                btn.style.background="#1e88e5"; btn.style.color="#fff";
                refreshBoard(side);
              });
            });
            // game dropdown
            const gameSel=document.getElementById(`cmp-game-sel-${side}`);
            if(gameSel) gameSel.addEventListener("change",()=>{
              cmpState[side].gameIdx=parseInt(gameSel.value)||0;
              populateLegSel(side);
              refreshBoard(side);
            });
            // leg dropdown
            const legSel=document.getElementById(`cmp-leg-sel-${side}`);
            if(legSel) legSel.addEventListener("change",()=>{
              cmpState[side].legNum=legSel.value;
              refreshBoard(side);
            });
            populateLegSel(side);
            refreshBoard(side);
          });
        }
      }

      // Render segment frequency table
      const segWrap=document.getElementById("segment-analysis-wrap");
      if(segWrap){
        const scatterData=JSON.parse(segWrap.dataset.scatterJson||"[]");
        const entries=analyzeSegments(scatterData);
        if(entries.length>0){
          const totalThrows=scatterData.filter(p=>p.l&&p.l!=="Miss").length||1;
          const fav=entries[0];
          const bestTriple=[...entries].sort((a,b)=>b.triple-a.triple)[0];
          const rarest=[...entries].sort((a,b)=>a.total-b.total)[0];
          let segHtml=`<div style="margin-bottom:8px">
            <span style="font-size:12px;color:#aaa">Lieblings-Feld: <strong>${fav.num}</strong> (${fav.total}×)</span>
            ${bestTriple?.triple>0?` &nbsp;·&nbsp; <span style="font-size:12px;color:#aaa">Bestes Triple: <strong>T${bestTriple.num}</strong> (${bestTriple.triple}×)</span>`:""}
            ${rarest?` &nbsp;·&nbsp; <span style="font-size:12px;color:#aaa">Seltenst: <strong>${rarest.num}</strong> (${rarest.total}×)</span>`:""}
          </div>
          <div class="history-list">
            <div class="history-header" style="grid-template-columns:50px 55px 55px 55px 55px 45px">
              <span>FELD</span><span>GESAMT</span><span>SINGLE</span><span>DOUBLE</span><span>TRIPLE</span><span>%</span>
            </div>`;
          entries.slice(0,20).forEach(e=>{
            const pct=Math.round(e.total/totalThrows*100);
            segHtml+=`<div class="history-row" style="grid-template-columns:50px 55px 55px 55px 55px 45px">
              <strong>${e.num===25?"Bull":e.num}</strong>
              <span>${e.total}</span>
              <span>${e.single||"—"}</span><span>${e.double||"—"}</span><span>${e.triple||"—"}</span>
              <span style="font-weight:700;color:#555">${pct}%</span>
            </div>`;
          });
          segHtml+=`</div>`;
          segWrap.innerHTML=segHtml;
        } else {
          segWrap.innerHTML=`<div style="color:#aaa;font-size:13px;padding:8px">Keine Treffer-Koordinaten vorhanden (nur bei Touch-Eingabe auf dem Board).</div>`;
        }
      }
    }

    if(chartGames.length>=2){
      const KPI_DEFS={
        avg:  {label:"⌀ Aufnahme", color:"#1e88e5", extract:(g,pid)=>{ const p=(g.players||[]).find(x=>pid?x.id===pid:true); return p?.avg3||null; }},
        f9:   {label:"First 9 Ø", color:"#e53935", extract:(g,pid)=>{ const p=(g.players||[]).find(x=>pid?x.id===pid:true); return p?.first9||null; }},
        best: {label:"Highscore", color:"#43a047", extract:(g,pid)=>{ const p=(g.players||[]).find(x=>pid?x.id===pid:true); return p?.best3||null; }},
        co:   {label:"Checkout %", color:"#fb8c00", extract:(g,pid)=>{ const p=(g.players||[]).find(x=>pid?x.id===pid:true); if(!p||!p.checkoutAtt) return null; return Math.round(p.checkoutHit/p.checkoutAtt*100); }},
        rounds:{label:"Darts", color:"#8e24aa", extract:(g)=>g.rounds?g.rounds*3:null},
        crmarks:{label:"Cricket ⌀M", color:"#00897b", extract:(g,pid)=>{ const p=(g.players||[]).find(x=>pid?x.id===pid:true); return p?.cricketAvgMarks||null; }}
      };
      const kpiKeys=["avg","f9","best","co","rounds","crmarks"];
      const COLORS=["#1e88e5","#e53935","#43a047","#fb8c00","#8e24aa","#00897b"];
      let activeKPIs=["avg"];

      setTimeout(()=>{
        const canvas=document.getElementById("trend-canvas");
        if(!canvas) return;

        function drawChart(){
          const W=canvas.parentElement.clientWidth-24||500;
          canvas.width=W*2; canvas.height=360;
          canvas.style.width="100%"; canvas.style.height="180px";
          const ctx=canvas.getContext("2d");
          ctx.scale(2,2);
          const w=W, h=180, pad={t:24,r:48,b:28,l:38};
          ctx.clearRect(0,0,w,h);
          ctx.fillStyle="#fff"; ctx.fillRect(0,0,w,h);
          ctx.strokeStyle="#f0f0f0"; ctx.lineWidth=1;
          for(let i=0;i<=4;i++){ const y=pad.t+(h-pad.t-pad.b)*i/4; ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(w-pad.r,y); ctx.stroke(); }
          const step=Math.max(1,Math.floor(chartGames.length/6));
          ctx.fillStyle="#bbb"; ctx.font="9px 'DM Sans',sans-serif"; ctx.textAlign="center";
          chartGames.forEach((g,i)=>{ if(i%step!==0&&i!==chartGames.length-1) return; const x=pad.l+(w-pad.l-pad.r)*i/Math.max(1,chartGames.length-1); const d=new Date(g.ts); ctx.fillText(`${d.getDate()}.${d.getMonth()+1}`,x,h-6); });
          activeKPIs.forEach((kpiKey,ki)=>{
            const kpi=KPI_DEFS[kpiKey];
            const vals=chartGames.map(g=>kpi.extract(g,pid));
            const validVals=vals.filter(v=>v!==null);
            if(!validVals.length) return;
            const minV=Math.min(...validVals), maxV=Math.max(...validVals), range=maxV-minV||1;
            const toX=i=>pad.l+(w-pad.l-pad.r)*i/Math.max(1,chartGames.length-1);
            const toY=v=>pad.t+(h-pad.t-pad.b)*(1-(v-minV)/range);
            ctx.strokeStyle=kpi.color; ctx.lineWidth=2.5; ctx.beginPath();
            let first=true;
            vals.forEach((v,i)=>{ if(v===null) return; first?ctx.moveTo(toX(i),toY(v)):ctx.lineTo(toX(i),toY(v)); first=false; });
            ctx.stroke();
            ctx.fillStyle=kpi.color;
            vals.forEach((v,i)=>{ if(v===null) return; ctx.beginPath(); ctx.arc(toX(i),toY(v),3,0,Math.PI*2); ctx.fill(); });
            const lastV=validVals[validVals.length-1];
            const lastIdx=vals.lastIndexOf(lastV);
            ctx.fillStyle=kpi.color; ctx.font=`bold 10px 'DM Sans',sans-serif`; ctx.textAlign="left";
            ctx.fillText(lastV, toX(lastIdx)+5, toY(lastV)+4+(ki*12));
          });
        }

        drawChart();

        document.querySelectorAll(".chart-kpi-btn").forEach(btn=>{
          btn.addEventListener("click",()=>{
            const kpi=btn.dataset.kpi;
            if(activeKPIs.includes(kpi)){
              if(activeKPIs.length===1) return;
              activeKPIs=activeKPIs.filter(k=>k!==kpi);
              btn.classList.remove("active");
              btn.style.background=""; btn.style.color="#666"; btn.style.borderColor="#ddd";
            } else {
              if(activeKPIs.length>=3) return;
              activeKPIs.push(kpi);
              btn.classList.add("active");
              const col=COLORS[kpiKeys.indexOf(kpi)];
              btn.style.background=col; btn.style.color="#fff"; btn.style.borderColor=col;
            }
            drawChart();
          });
        });
        window.addEventListener("resize",drawChart,{passive:true});
      },100);
    }
  }catch(e){
    box.innerHTML=`<div class="stats-loading">Fehler: ${e.message}</div>`;
    console.error(e);
  }
}
