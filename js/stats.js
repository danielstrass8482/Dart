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

// ── Advanced statistics state ─────────────────────────────────────
let advFilter={type:"timerange",timeRange:"30d",sessionId:null,legNum:"all"};
let advFilterB={type:"timerange",timeRange:"90d",sessionId:null,legNum:"all"};

function groupGamesIntoSessions(games){
  const sessions=[];
  const sorted=[...games].sort((a,b)=>a.ts-b.ts);
  sorted.forEach(game=>{
    const last=sessions[sessions.length-1];
    const sameP=last&&JSON.stringify((game.playerIds||[]).slice().sort())===JSON.stringify((last.playerIds||[]).slice().sort());
    const within4h=last&&game.ts-last.lastTs<4*60*60*1000;
    if(last&&sameP&&within4h){
      last.games.push(game); last.lastTs=game.ts; last.legs++;
    } else {
      const d=new Date(game.ts);
      const ds=`${d.getDate()}.${d.getMonth()+1}.${String(d.getFullYear()).slice(2)}`;
      const players=(game.players||[]).map(p=>p.name).join(" vs ");
      sessions.push({id:game.ts.toString(),label:`${ds} · ${game.mode} · ${players}`,games:[game],playerIds:game.playerIds||[],firstTs:game.ts,lastTs:game.ts,legs:1});
    }
  });
  return sessions;
}

function getAdvTimeRange(range){
  const now=Date.now(); const day=86400000;
  if(range==="7d")   return {from:now-7*day,   to:now+day};
  if(range==="30d")  return {from:now-30*day,  to:now+day};
  if(range==="90d")  return {from:now-90*day,  to:now+day};
  if(range==="180d") return {from:now-180*day, to:now+day};
  const mStart=new Date(); mStart.setDate(1); mStart.setHours(0,0,0,0);
  if(range==="thismonth") return {from:mStart.getTime(), to:now+day};
  if(range==="lastmonth"){const pm=new Date(mStart);pm.setMonth(pm.getMonth()-1);return {from:pm.getTime(),to:mStart.getTime()-1};}
  return {from:0,to:now+day};
}

function extractScatterFromGames(games, pid){
  return games.flatMap(g=>(g.players||[]).filter(p=>pid?p.id===pid:true).flatMap(p=>p.scatter||[])).filter(s=>s.x!=null&&s.y!=null);
}

function getFilteredScatter(pid, filter){
  if(filter.type==="timerange"){
    const {from,to}=getAdvTimeRange(filter.timeRange);
    const games=allGamesCache.filter(g=>g.ts>=from&&g.ts<=to&&g.mode!=="Cricket"&&(pid?(g.playerIds||[]).includes(pid):true));
    return extractScatterFromGames(games,pid);
  }
  if(filter.type==="session"&&filter.sessionId){
    const allSess=groupGamesIntoSessions(allGamesCache.filter(g=>g.mode!=="Cricket"&&(pid?(g.playerIds||[]).includes(pid):true)));
    const sess=allSess.find(s=>s.id===filter.sessionId);
    if(!sess) return [];
    if(filter.legNum==="all") return extractScatterFromGames(sess.games,pid);
    const legIdx=(parseInt(filter.legNum)||1)-1;
    const g=sess.games[legIdx];
    if(!g) return [];
    return extractScatterFromGames([g],pid);
  }
  return [];
}

function renderSegmentTable(entries, totalThrows){
  if(!entries.length) return `<div style="color:#aaa;font-size:13px;padding:8px">Keine Treffer-Koordinaten vorhanden (nur bei Touch-Eingabe auf dem Board).</div>`;
  const fav=entries[0];
  const bestTriple=[...entries].sort((a,b)=>b.triple-a.triple)[0];
  const rarest=[...entries].sort((a,b)=>a.total-b.total)[0];
  let h=`<div style="margin-bottom:8px">
    <span style="font-size:12px;color:#aaa">Lieblings-Feld: <strong>${fav.num}</strong> (${fav.total}×)</span>
    ${bestTriple?.triple>0?` &nbsp;·&nbsp; <span style="font-size:12px;color:#aaa">Bestes Triple: <strong>T${bestTriple.num}</strong> (${bestTriple.triple}×)</span>`:""}
    ${rarest?` &nbsp;·&nbsp; <span style="font-size:12px;color:#aaa">Seltenst: <strong>${rarest.num}</strong> (${rarest.total}×)</span>`:""}
  </div><div class="history-list"><div class="history-header" style="grid-template-columns:50px 55px 55px 55px 55px 45px"><span>FELD</span><span>GESAMT</span><span>SINGLE</span><span>DOUBLE</span><span>TRIPLE</span><span>%</span></div>`;
  entries.slice(0,20).forEach(e=>{
    const pct=Math.round(e.total/(totalThrows||1)*100);
    h+=`<div class="history-row" style="grid-template-columns:50px 55px 55px 55px 55px 45px"><strong>${e.num===25?"Bull":e.num}</strong><span>${e.total}</span><span>${e.single||"—"}</span><span>${e.double||"—"}</span><span>${e.triple||"—"}</span><span style="font-weight:700;color:#555">${pct}%</span></div>`;
  });
  return h+`</div>`;
}

function updateFilterSummary(){
  const el=document.getElementById("adv-filter-summary");
  if(!el) return;
  const labels={"7d":"Letzte 7 Tage","30d":"Letzter Monat","90d":"Letzte 3 Monate","180d":"Letzte 6 Monate","all":"Alle Spiele","thismonth":"Dieser Monat","lastmonth":"Letzter Monat"};
  if(advFilter.type==="timerange"){
    el.textContent=`📅 ${labels[advFilter.timeRange]||advFilter.timeRange}`;
  } else {
    const pid=statsSelectedPlayer;
    const sess=groupGamesIntoSessions(allGamesCache.filter(g=>g.mode!=="Cricket"&&(pid?(g.playerIds||[]).includes(pid):true))).find(s=>s.id===advFilter.sessionId);
    el.textContent=sess?`🎮 ${sess.label} · ${advFilter.legNum==="all"?"Alle Legs":"Leg "+advFilter.legNum}`:"🎮 Kein Spiel gewählt";
  }
}

function updateAdvancedStats(pid){
  updateFilterSummary();
  const scatter=getFilteredScatter(pid,advFilter);
  const svgA=document.getElementById("adv-scatter-a");
  if(svgA) drawMiniBoard(svgA,scatter);
  const infoA=document.getElementById("adv-scatter-a-info");
  if(infoA) infoA.textContent=`${scatter.length} Würfe`;
  const segWrap=document.getElementById("adv-segment-wrap");
  if(segWrap){
    const entries=analyzeSegments(scatter);
    const total=scatter.filter(s=>s.l&&s.l!=="Miss").length;
    segWrap.innerHTML=renderSegmentTable(entries,total);
  }
}

function updateAdvancedStatsB(pid){
  const scatter=getFilteredScatter(pid,advFilterB);
  const svgB=document.getElementById("adv-scatter-b");
  if(svgB) drawMiniBoard(svgB,scatter);
  const infoB=document.getElementById("adv-scatter-b-info");
  if(infoB) infoB.textContent=`${scatter.length} Würfe`;
}

function buildSessionDropdown(containerId, sessions, onSelect, btnClass, activeColor, inactiveColor){
  const sel=document.getElementById(containerId);
  if(!sel) return;
  sessions.forEach(s=>{
    const opt=document.createElement("option");
    opt.value=s.id; opt.textContent=`${s.label} (${s.legs} Leg${s.legs!==1?"s":""})`;
    sel.appendChild(opt);
  });
  sel.addEventListener("change",()=>onSelect(sel.value||null,sessions));
}

function setupAdvancedFilterUI(pid){
  const sessionsAll=groupGamesIntoSessions(allGamesCache.filter(g=>g.mode!=="Cricket"&&(pid?(g.playerIds||[]).includes(pid):true))).reverse();

  // ── Board A / Segment (common advFilter) ──────────────────────────
  function setAdvType(type){
    advFilter.type=type;
    document.querySelectorAll(".adv-type-btn").forEach(b=>{
      const on=b.dataset.type===type;
      b.style.border=`2px solid ${on?"#e8c44a":"#ddd"}`;
      b.style.background=on?"#1a1800":"#f5f5f5";
      b.style.color=on?"#e8c44a":"#555";
      b.style.fontWeight=on?"700":"400";
    });
    const tr=document.getElementById("adv-timerange-selector");
    const ss=document.getElementById("adv-session-selector");
    if(tr) tr.style.display=type==="timerange"?"":"none";
    if(ss) ss.style.display=type==="session"?"":"none";
    updateAdvancedStats(pid);
  }
  document.querySelectorAll(".adv-type-btn").forEach(b=>b.addEventListener("click",()=>setAdvType(b.dataset.type)));

  function setAdvTimeRange(range){
    advFilter.timeRange=range;
    document.querySelectorAll(".adv-time-btn").forEach(b=>{
      const on=b.dataset.range===range;
      b.style.border=`${on?"2":"1"}px solid ${on?"#e8c44a":"#ddd"}`;
      b.style.background=on?"#1a1800":"#f5f5f5";
      b.style.color=on?"#e8c44a":"#555";
      b.style.fontWeight=on?"700":"400";
    });
    updateAdvancedStats(pid);
  }
  document.querySelectorAll(".adv-time-btn").forEach(b=>b.addEventListener("click",()=>setAdvTimeRange(b.dataset.range)));

  buildSessionDropdown("adv-session-select",sessionsAll,(sessionId,sessions)=>{
    advFilter.sessionId=sessionId; advFilter.legNum="all";
    const legBtns=document.getElementById("adv-leg-btns");
    if(legBtns){
      legBtns.innerHTML="";
      const sess=sessions.find(s=>s.id===sessionId);
      if(sess){
        const allBtn=document.createElement("button");
        allBtn.className="adv-leg-btn"; allBtn.dataset.leg="all"; allBtn.textContent="Alle";
        allBtn.style.cssText="padding:5px 10px;border-radius:6px;border:2px solid #e8c44a;background:#1a1800;color:#e8c44a;cursor:pointer;font-size:12px;font-weight:700";
        legBtns.appendChild(allBtn);
        sess.games.forEach((g,idx)=>{
          const btn=document.createElement("button");
          btn.className="adv-leg-btn"; btn.dataset.leg=String(idx+1);
          btn.textContent=`Leg ${idx+1} (${g.winner||"?"})`;
          btn.style.cssText="padding:5px 10px;border-radius:6px;border:1px solid #ddd;background:#f5f5f5;color:#555;cursor:pointer;font-size:12px";
          legBtns.appendChild(btn);
        });
        const legSel=document.getElementById("adv-leg-selector");
        if(legSel) legSel.style.display="";
      }
    }
    updateAdvancedStats(pid);
  },sessionsAll);

  document.getElementById("adv-leg-btns")?.addEventListener("click",e=>{
    const btn=e.target.closest(".adv-leg-btn"); if(!btn) return;
    advFilter.legNum=btn.dataset.leg==="all"?"all":parseInt(btn.dataset.leg);
    document.querySelectorAll(".adv-leg-btn").forEach(b=>{
      const on=b.dataset.leg===btn.dataset.leg;
      b.style.border=`${on?"2":"1"}px solid ${on?"#e8c44a":"#ddd"}`;
      b.style.background=on?"#1a1800":"#f5f5f5";
      b.style.color=on?"#e8c44a":"#555"; b.style.fontWeight=on?"700":"400";
    });
    updateAdvancedStats(pid);
  });

  // ── Board B (independent advFilterB) ─────────────────────────────
  function setAdvTypeB(type){
    advFilterB.type=type;
    document.querySelectorAll(".advB-type-btn").forEach(b=>{
      const on=b.dataset.type===type;
      b.style.border=`2px solid ${on?"#1e88e5":"#ddd"}`;
      b.style.background=on?"#e3f0fd":"#f5f5f5";
      b.style.color=on?"#1e88e5":"#555"; b.style.fontWeight=on?"700":"400";
    });
    const tr=document.getElementById("advB-timerange-selector");
    const ss=document.getElementById("advB-session-selector");
    if(tr) tr.style.display=type==="timerange"?"":"none";
    if(ss) ss.style.display=type==="session"?"":"none";
    updateAdvancedStatsB(pid);
  }
  document.querySelectorAll(".advB-type-btn").forEach(b=>b.addEventListener("click",()=>setAdvTypeB(b.dataset.type)));

  document.querySelectorAll(".advB-time-btn").forEach(b=>{
    b.addEventListener("click",()=>{
      advFilterB.timeRange=b.dataset.range;
      document.querySelectorAll(".advB-time-btn").forEach(bb=>{
        const on=bb.dataset.range===advFilterB.timeRange;
        bb.style.border=`${on?"2":"1"}px solid ${on?"#1e88e5":"#ddd"}`;
        bb.style.background=on?"#e3f0fd":"#f5f5f5";
        bb.style.color=on?"#1e88e5":"#555"; bb.style.fontWeight=on?"700":"400";
      });
      updateAdvancedStatsB(pid);
    });
  });

  buildSessionDropdown("advB-session-select",sessionsAll,(sessionId,sessions)=>{
    advFilterB.sessionId=sessionId; advFilterB.legNum="all";
    const legBtns=document.getElementById("advB-leg-btns");
    if(legBtns){
      legBtns.innerHTML="";
      const sess=sessions.find(s=>s.id===sessionId);
      if(sess){
        const allBtn=document.createElement("button");
        allBtn.className="advB-leg-btn"; allBtn.dataset.leg="all"; allBtn.textContent="Alle";
        allBtn.style.cssText="padding:4px 8px;border-radius:5px;border:2px solid #1e88e5;background:#e3f0fd;color:#1e88e5;cursor:pointer;font-size:11px;font-weight:700";
        legBtns.appendChild(allBtn);
        sess.games.forEach((g,idx)=>{
          const btn=document.createElement("button");
          btn.className="advB-leg-btn"; btn.dataset.leg=String(idx+1);
          btn.textContent=`Leg ${idx+1} (${g.winner||"?"})`;
          btn.style.cssText="padding:4px 8px;border-radius:5px;border:1px solid #ddd;background:#f5f5f5;color:#555;cursor:pointer;font-size:11px";
          legBtns.appendChild(btn);
        });
        const legSelB=document.getElementById("advB-leg-selector");
        if(legSelB) legSelB.style.display="";
      }
    }
    updateAdvancedStatsB(pid);
  },sessionsAll);

  document.getElementById("advB-leg-btns")?.addEventListener("click",e=>{
    const btn=e.target.closest(".advB-leg-btn"); if(!btn) return;
    advFilterB.legNum=btn.dataset.leg==="all"?"all":parseInt(btn.dataset.leg);
    document.querySelectorAll(".advB-leg-btn").forEach(b=>{
      const on=b.dataset.leg===btn.dataset.leg;
      b.style.border=`${on?"2":"1"}px solid ${on?"#1e88e5":"#ddd"}`;
      b.style.background=on?"#e3f0fd":"#f5f5f5";
      b.style.color=on?"#1e88e5":"#555"; b.style.fontWeight=on?"700":"400";
    });
    updateAdvancedStatsB(pid);
  });

  // Initial renders
  updateAdvancedStats(pid);
  updateAdvancedStatsB(pid);
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

      // Reset filter state on each re-render
      advFilter={type:"timerange",timeRange:"30d",sessionId:null,legNum:"all"};
      advFilterB={type:"timerange",timeRange:"90d",sessionId:null,legNum:"all"};

      html+=`<div class="stats-section-title" style="display:flex;align-items:center;gap:8px">
        🔬 ERWEITERTE STATISTIKEN
        <span style="font-size:9px;background:#e8c44a;color:#000;padding:2px 6px;border-radius:10px;font-family:'DM Sans',sans-serif">PREMIUM</span>
      </div>

      <!-- Gemeinsamer Filter -->
      <div id="advanced-filter" style="background:#fff;border:1px solid #ddd;border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="font-size:11px;color:#999;letter-spacing:1px;margin-bottom:8px">ANALYSE-GRUNDLAGE</div>
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <button class="adv-type-btn" data-type="timerange" style="flex:1;padding:8px;border-radius:8px;border:2px solid #e8c44a;background:#1a1800;color:#e8c44a;font-size:12px;font-weight:700;cursor:pointer">📅 Zeitraum</button>
          <button class="adv-type-btn" data-type="session" style="flex:1;padding:8px;border-radius:8px;border:2px solid #ddd;background:#f5f5f5;color:#555;font-size:12px;cursor:pointer">🎮 Einzelnes Spiel</button>
        </div>
        <div id="adv-timerange-selector" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">
          <button class="adv-time-btn" data-range="30d" style="padding:5px 10px;border-radius:6px;border:2px solid #e8c44a;background:#1a1800;color:#e8c44a;font-size:12px;font-weight:700;cursor:pointer">Letzter Monat</button>
          <button class="adv-time-btn" data-range="7d" style="padding:5px 10px;border-radius:6px;border:1px solid #ddd;background:#f5f5f5;color:#555;font-size:12px;cursor:pointer">7 Tage</button>
          <button class="adv-time-btn" data-range="90d" style="padding:5px 10px;border-radius:6px;border:1px solid #ddd;background:#f5f5f5;color:#555;font-size:12px;cursor:pointer">3 Monate</button>
          <button class="adv-time-btn" data-range="all" style="padding:5px 10px;border-radius:6px;border:1px solid #ddd;background:#f5f5f5;color:#555;font-size:12px;cursor:pointer">Alles</button>
        </div>
        <div id="adv-session-selector" style="display:none">
          <select id="adv-session-select" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;font-size:12px;margin-bottom:8px;background:#fff;color:#333">
            <option value="">Spiel wählen…</option>
          </select>
          <div id="adv-leg-selector" style="display:none">
            <div style="font-size:11px;color:#999;margin-bottom:6px">LEG AUSWÄHLEN</div>
            <div id="adv-leg-btns" style="display:flex;gap:6px;flex-wrap:wrap"></div>
          </div>
        </div>
        <div id="adv-filter-summary" style="margin-top:8px;font-size:11px;color:#e8c44a;min-height:16px"></div>
      </div>

      <!-- Trefferbild-Vergleich -->
      <div class="stats-section-title" style="cursor:pointer;display:flex;align-items:center;gap:8px" onclick="const w=document.getElementById('adv-scatter-wrap');w.style.display=w.style.display==='none'?'':'none';this.querySelector('.sc2-arrow').textContent=this.querySelector('.sc2-arrow').textContent==='▼'?'▲':'▼'">
        📊 TREFFERBILD VERGLEICH <span class="sc2-arrow" style="color:#aaa;font-size:12px">▼</span>
      </div>
      <div id="adv-scatter-wrap" style="display:none">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <div style="font-size:10px;color:#888;margin-bottom:4px;text-align:center;font-weight:600;letter-spacing:1px">BOARD A · AKTUELLER FILTER</div>
            <svg id="adv-scatter-a" viewBox="36 36 458 458" style="display:block;width:100%;border-radius:8px;background:#0a0a0f"></svg>
            <div id="adv-scatter-a-info" style="font-size:10px;color:#aaa;text-align:center;margin-top:2px"></div>
          </div>
          <div>
            <div style="font-size:10px;color:#1e88e5;margin-bottom:4px;text-align:center;font-weight:600;letter-spacing:1px">BOARD B · VERGLEICHEN MIT</div>
            <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:4px;justify-content:center">
              <button class="advB-type-btn" data-type="timerange" style="flex:1;min-width:60px;padding:3px 5px;border-radius:6px;border:2px solid #1e88e5;background:#e3f0fd;color:#1e88e5;font-size:10px;font-weight:700;cursor:pointer">Zeitraum</button>
              <button class="advB-type-btn" data-type="session" style="flex:1;min-width:60px;padding:3px 5px;border-radius:6px;border:1px solid #ddd;background:#f5f5f5;color:#555;font-size:10px;cursor:pointer">Spiel</button>
            </div>
            <div id="advB-timerange-selector" style="display:flex;gap:3px;flex-wrap:wrap;justify-content:center;margin-bottom:4px">
              <button class="advB-time-btn" data-range="90d" style="padding:3px 6px;border-radius:5px;border:2px solid #1e88e5;background:#e3f0fd;color:#1e88e5;font-size:10px;font-weight:700;cursor:pointer">3 Monate</button>
              <button class="advB-time-btn" data-range="30d" style="padding:3px 6px;border-radius:5px;border:1px solid #ddd;background:#f5f5f5;color:#555;font-size:10px;cursor:pointer">Monat</button>
              <button class="advB-time-btn" data-range="7d" style="padding:3px 6px;border-radius:5px;border:1px solid #ddd;background:#f5f5f5;color:#555;font-size:10px;cursor:pointer">7 Tage</button>
              <button class="advB-time-btn" data-range="all" style="padding:3px 6px;border-radius:5px;border:1px solid #ddd;background:#f5f5f5;color:#555;font-size:10px;cursor:pointer">Alles</button>
            </div>
            <div id="advB-session-selector" style="display:none;margin-bottom:4px">
              <select id="advB-session-select" style="width:100%;padding:4px;border:1px solid #ddd;border-radius:6px;font-size:11px;background:#fff;color:#333">
                <option value="">Spiel wählen…</option>
              </select>
              <div id="advB-leg-selector" style="display:none;margin-top:4px">
                <div id="advB-leg-btns" style="display:flex;gap:4px;flex-wrap:wrap"></div>
              </div>
            </div>
            <svg id="adv-scatter-b" viewBox="36 36 458 458" style="display:block;width:100%;border-radius:8px;background:#0a0a0f"></svg>
            <div id="adv-scatter-b-info" style="font-size:10px;color:#aaa;text-align:center;margin-top:2px"></div>
          </div>
        </div>
      </div>

      <!-- Segment-Analyse -->
      <div class="stats-section-title" style="cursor:pointer;display:flex;align-items:center;gap:8px" onclick="const w=document.getElementById('adv-segment-wrap');w.style.display=w.style.display==='none'?'':'none';this.querySelector('.sa2-arrow').textContent=this.querySelector('.sa2-arrow').textContent==='▼'?'▲':'▼'">
        🎯 SEGMENT-ANALYSE <span class="sa2-arrow" style="color:#aaa;font-size:12px">▼</span>
      </div>
      <div id="adv-segment-wrap" style="display:none;padding:4px 0"></div>`;
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
      if(svg) drawMiniBoard(svg,allScatter.slice(0,600));
      // Wire advanced filter UI (boards A+B, segment analysis)
      setupAdvancedFilterUI(pid);
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
