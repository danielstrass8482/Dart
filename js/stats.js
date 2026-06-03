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

/**
 * Sets the stats selected player.
 * @param {string|null} pid
 */
export function setStatsSelectedPlayer(pid){ statsSelectedPlayer = pid; }
export function setStatsRange(r){ statsRange = r; }
export function setStatsFrom(f){ statsFrom = f; }
export function setStatsTo(t){ statsTo = t; }
export function setAllGamesCache(g){ allGamesCache = g; }

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
    }

    const doubleAgg={};
    x01Data.forEach(p=>{ if(!p.doubleStats) return; Object.entries(p.doubleStats).forEach(([field,v])=>{ if(!doubleAgg[field]) doubleAgg[field]={att:0,hit:0}; doubleAgg[field].att+=v.att||0; doubleAgg[field].hit+=v.hit||0; }); });
    const doubleEntries=Object.entries(doubleAgg).map(([f,v])=>({field:f,att:v.att,hit:v.hit,pct:v.att>0?Math.round(v.hit/v.att*100):0})).filter(e=>e.att>=1).sort((a,b)=>b.att-a.att);
    const bestDouble=doubleEntries.filter(e=>e.att>=3).sort((a,b)=>b.pct-a.pct)[0];
    const worstDouble=doubleEntries.filter(e=>e.att>=3).sort((a,b)=>a.pct-b.pct)[0];
    const mostTriedDouble=doubleEntries[0];

    if(doubleEntries.length>0){
      html+=`<div class="stats-section-title">🎯 DOPPELFELD-STATISTIK</div>`;
      html+=`<div class="stats-grid" style="margin-bottom:10px">
        ${bestDouble?`<div class="stat-card"><div class="s-label">BESTES DOPPEL</div><div class="s-value">${bestDouble.field}</div><div class="s-sub">${bestDouble.pct}% (${bestDouble.hit}/${bestDouble.att})</div></div>`:""}
        ${worstDouble&&worstDouble.field!==bestDouble?.field?`<div class="stat-card"><div class="s-label">SCHWÄCHSTES DOPPEL</div><div class="s-value">${worstDouble.field}</div><div class="s-sub">${worstDouble.pct}% (${worstDouble.hit}/${worstDouble.att})</div></div>`:""}
        ${mostTriedDouble?`<div class="stat-card"><div class="s-label">MEIST GESPIELT</div><div class="s-value">${mostTriedDouble.field}</div><div class="s-sub">${mostTriedDouble.att} Versuche</div></div>`:""}
      </div>
      <div class="history-list" style="margin-bottom:14px">
        <div class="history-header" style="grid-template-columns:1fr 70px 70px 70px"><span>FELD</span><span>VERSUCHE</span><span>TREFFER</span><span>QUOTE</span></div>`;
      doubleEntries.forEach(e=>{
        const color=e.pct>=50?"#2e7d32":e.pct>=25?"#fb8c00":"#e53935";
        const barW=Math.round(e.pct/100*80);
        html+=`<div class="history-row" style="grid-template-columns:1fr 70px 70px 70px">
          <span style="display:flex;align-items:center;gap:8px">
            <strong>${e.field}</strong>
            <span style="flex:1;height:6px;background:#f0f0f0;border-radius:3px;max-width:80px;display:inline-block">
              <span style="display:block;height:6px;width:${barW}%;background:${color};border-radius:3px"></span>
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
