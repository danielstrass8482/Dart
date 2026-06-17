/**
 * stats.js — Statistics loading, rendering, player bar, trend chart.
 */

import { state } from './state.js';
import { drawMiniBoard } from './board.js?v=2';
import { loadCoachHistoryStats } from './coach.js';
import { t } from './i18n.js';

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
let columnState={
  a:{type:"timerange",range:"30d",sessionId:null,legNum:"all"},
  b:{type:"timerange",range:"90d",sessionId:null,legNum:"all"}
};
let _chartTimeout = null;
let _chartResizeHandler = null;

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
  return {from:0,to:now+day};
}

function extractScatterFromGames(games, pid){
  return games.flatMap(g=>(g.players||[]).filter(p=>pid?p.id===pid:true).flatMap(p=>p.scatter||[])).filter(s=>s.x!=null&&s.y!=null);
}

function renderSegmentTable(entries, totalThrows){
  if(!entries.length) return `<div style="color:var(--dart-text-sec);font-size:12px;padding:8px;text-align:center">${t('keine_treffer_koord')}</div>`;
  const fav=entries[0];
  const bestTriple=[...entries].sort((a,b)=>b.triple-a.triple)[0];
  let h=`<div style="margin-bottom:6px;font-size:11px;color:var(--dart-text-sec)">${t('lieblings')} <strong style="color:var(--dart-text-sec)">${fav.num}</strong> (${fav.total}×)${bestTriple?.triple>0?` · Triple: <strong style="color:var(--dart-text-sec)">T${bestTriple.num}</strong>`:""}
  </div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">
  <tr style="color:var(--dart-text-sec);font-size:10px"><th style="text-align:left;padding:2px 4px">${t('feld_col')}</th><th style="padding:2px 4px">${t('ges_col')}</th><th style="padding:2px 4px">S</th><th style="padding:2px 4px">D</th><th style="padding:2px 4px">T</th><th style="padding:2px 4px">%</th></tr>`;
  entries.slice(0,15).forEach((e,idx)=>{
    const pct=Math.round(e.total/(totalThrows||1)*100);
    const top3=idx<3?`color:var(--dart-gold);`:"";
    h+=`<tr style="border-top:1px solid var(--dart-divider)"><td style="padding:2px 4px;font-weight:600;${top3}">${e.num===25?"Bull":e.num}</td><td style="padding:2px 4px;text-align:center">${e.total}</td><td style="padding:2px 4px;text-align:center;color:var(--dart-text-muted)">${e.single||"—"}</td><td style="padding:2px 4px;text-align:center;color:var(--dart-text-sec)">${e.double||"—"}</td><td style="padding:2px 4px;text-align:center;color:var(--dart-danger)">${e.triple||"—"}</td><td style="padding:2px 4px;text-align:center;color:var(--dart-text-sec)">${pct}%</td></tr>`;
  });
  return h+`</table></div>`;
}

function buildAdvancedColumn(side){
  const defaultRange=side==="a"?"30d":"90d";
  const rl={"7d":"7T","30d":"1M","90d":"3M","all":"∞"};
  const trBtns=["7d","30d","90d","all"].map(r=>{
    const on=r===defaultRange;
    return `<button class="tr-btn${on?" active":""}" data-side="${side}" data-range="${r}" style="padding:3px 8px;border-radius:99px;border:1px solid transparent;background:${on?"var(--dart-gold)":"var(--dart-bg-chip)"};color:${on?"#000":"var(--dart-text-muted)"};font-size:11px;cursor:pointer;font-weight:${on?"700":"600"}">${rl[r]}</button>`;
  }).join("");
  return `
    <div style="font-size:10px;color:var(--dart-text-sec);letter-spacing:1px;margin-bottom:8px;text-align:center;font-weight:600">BOARD ${side.toUpperCase()}</div>
    <div style="margin-bottom:10px">
      <div style="display:flex;gap:4px;margin-bottom:6px">
        <button class="col-type-btn active" data-side="${side}" data-type="timerange" style="flex:1;padding:5px 2px;font-size:11px;border-radius:6px;border:1px solid var(--dart-gold);background:var(--dart-bg-chip);color:var(--dart-gold);cursor:pointer;font-weight:700"><i data-lucide="calendar" style="width:11px;height:11px;stroke-width:2;vertical-align:middle"></i> Zeit</button>
        <button class="col-type-btn" data-side="${side}" data-type="session" style="flex:1;padding:5px 2px;font-size:11px;border-radius:6px;border:1px solid var(--dart-border);background:var(--dart-bg-card);color:var(--dart-text-muted);cursor:pointer"><i data-lucide="gamepad-2" style="width:11px;height:11px;stroke-width:2;vertical-align:middle"></i> Spiel</button>
      </div>
      <div id="timerange-${side}" style="display:flex;gap:4px;flex-wrap:wrap">${trBtns}</div>
      <div id="session-${side}" style="display:none">
        <select class="session-select" data-side="${side}" style="width:100%;padding:6px;border:1px solid var(--dart-border);border-radius:6px;font-size:11px;margin-bottom:6px;background:var(--dart-bg-card);color:var(--dart-text-sec)">
          <option value="">Spiel wählen…</option>
        </select>
        <div id="legs-${side}" style="display:none;gap:4px;flex-wrap:wrap"></div>
      </div>
      <div id="filter-label-${side}" style="font-size:10px;color:var(--dart-gold);margin-top:4px;min-height:14px;text-align:center"></div>
    </div>
    <svg id="scatter-board-${side}" viewBox="36 36 458 458" style="display:block;width:100%;aspect-ratio:1;border-radius:8px;background:var(--dart-bg-app);margin-bottom:6px"></svg>
    <div id="board-stats-${side}" style="text-align:center;font-size:11px;color:var(--dart-text-sec);margin-bottom:10px">— Keine Daten —</div>
    <div style="font-size:10px;color:var(--dart-text-sec);letter-spacing:1px;margin-bottom:4px;font-weight:600;border-top:1px solid var(--dart-border);padding-top:8px">SEGMENT-ANALYSE</div>
    <div id="segment-table-${side}"><div style="color:var(--dart-text-sec);font-size:12px;text-align:center;padding:8px">Filter wählen</div></div>`;
}

function updateColumn(side, pid){
  const st=columnState[side];
  let scatter=[];
  let avg=0;
  if(st.type==="timerange"){
    const {from,to}=getAdvTimeRange(st.range);
    const games=allGamesCache.filter(g=>g.ts>=from&&g.ts<=to&&g.mode!=="Cricket"&&(pid?(g.playerIds||[]).includes(pid):true));
    scatter=extractScatterFromGames(games,pid);
    const avgs=games.flatMap(g=>(g.players||[]).filter(p=>pid?p.id===pid:true).map(p=>p.avg3||0)).filter(v=>v>0);
    avg=avgs.length?Math.round(avgs.reduce((a,b)=>a+b,0)/avgs.length*10)/10:0;
    const labels={"7d":t('sieben_tage'),"30d":t('ein_monat'),"90d":t('drei_monate'),"all":t('alle_spiele')};
    const lbl=document.getElementById(`filter-label-${side}`);
    if(lbl) lbl.innerHTML=`<i data-lucide="calendar" style="width:11px;height:11px;stroke-width:2;vertical-align:middle"></i> ${labels[st.range]||st.range}`; window.refreshIcons?.();
  } else if(st.type==="session"&&st.sessionId){
    const allSess=groupGamesIntoSessions(allGamesCache.filter(g=>g.mode!=="Cricket"&&(pid?(g.playerIds||[]).includes(pid):true)));
    const sess=allSess.find(s=>s.id===st.sessionId);
    if(sess){
      const games=st.legNum==="all"?sess.games:[sess.games[(parseInt(st.legNum)||1)-1]].filter(Boolean);
      scatter=extractScatterFromGames(games,pid);
      const avgs=games.flatMap(g=>(g.players||[]).filter(p=>pid?p.id===pid:true).map(p=>p.avg3||0)).filter(v=>v>0);
      avg=avgs.length?Math.round(avgs.reduce((a,b)=>a+b,0)/avgs.length*10)/10:0;
      const legText=st.legNum==="all"?t('alle_legs'):"Leg "+st.legNum;
      const lbl=document.getElementById(`filter-label-${side}`);
      if(lbl) lbl.innerHTML=`<i data-lucide="gamepad-2" style="width:11px;height:11px;stroke-width:2;vertical-align:middle"></i> ${(sess.label.split("·")[0]||"").trim()} · ${legText}`; window.refreshIcons?.();
    }
  }
  const svg=document.getElementById(`scatter-board-${side}`);
  if(svg){
    if(scatter.length) drawMiniBoard(svg,scatter);
    else svg.innerHTML=`<text x="265" y="265" text-anchor="middle" fill="#444" font-size="18" font-family="sans-serif">${t('keine_daten')}</text>`;
  }
  const statsEl=document.getElementById(`board-stats-${side}`);
  if(statsEl) statsEl.textContent=scatter.length?`Ø ${avg} · ${scatter.length} ${t('wuerfe_label')}`:"— "+t('keine_daten')+" —";
  const tableEl=document.getElementById(`segment-table-${side}`);
  if(tableEl){
    const entries=analyzeSegments(scatter);
    const total=scatter.filter(s=>s.l&&s.l!=="Miss").length;
    tableEl.innerHTML=scatter.length?renderSegmentTable(entries,total):`<div style="color:var(--dart-text-sec);font-size:12px;text-align:center;padding:8px">Keine Daten</div>`;
  }
}

function populateLegBtns(side, sessionId, sessions){
  const wrap=document.getElementById(`legs-${side}`);
  if(!wrap) return;
  wrap.innerHTML="";
  const sess=sessions.find(s=>s.id===sessionId);
  if(!sess){wrap.style.display="none";return;}
  const mkBtn=(leg,label,active)=>{
    const btn=document.createElement("button");
    btn.className="leg-btn"; btn.dataset.leg=leg; btn.textContent=label;
    btn.style.cssText=`padding:3px 8px;border-radius:99px;border:1px solid transparent;background:${active?"var(--dart-gold)":"var(--dart-bg-chip)"};color:${active?"#000":"var(--dart-text-muted)"};font-size:11px;cursor:pointer;font-weight:${active?"700":"600"}`;
    return btn;
  };
  wrap.appendChild(mkBtn("all","Alle",true));
  sess.games.forEach((g,i)=>wrap.appendChild(mkBtn(String(i+1),`L${i+1} (${g.winner||"?"})`,false)));
  wrap.style.display="flex";
}

function setupAdvancedUI(pid){
  columnState={
    a:{type:"timerange",range:"30d",sessionId:null,legNum:"all"},
    b:{type:"timerange",range:"90d",sessionId:null,legNum:"all"}
  };
  const sessionsAll=groupGamesIntoSessions(allGamesCache.filter(g=>g.mode!=="Cricket"&&(pid?(g.playerIds||[]).includes(pid):true))).reverse();

  ["a","b"].forEach(side=>{
    document.querySelectorAll(`.col-type-btn[data-side="${side}"]`).forEach(btn=>{
      btn.addEventListener("click",()=>{
        const type=btn.dataset.type;
        columnState[side].type=type;
        document.querySelectorAll(`.col-type-btn[data-side="${side}"]`).forEach(b=>{
          const on=b.dataset.type===type;
          b.style.border=`1px solid ${on?"var(--dart-gold)":"var(--dart-border)"}`;
          b.style.background=on?"var(--dart-bg-chip)":"var(--dart-bg-card)";
          b.style.color=on?"var(--dart-gold)":"var(--dart-text-muted)";
          b.style.fontWeight=on?"700":"400";
        });
        const tr=document.getElementById(`timerange-${side}`);
        const ss=document.getElementById(`session-${side}`);
        if(tr) tr.style.display=type==="timerange"?"flex":"none";
        if(ss) ss.style.display=type==="session"?"":"none";
        updateColumn(side,pid);
      });
    });

    document.querySelectorAll(`.tr-btn[data-side="${side}"]`).forEach(btn=>{
      btn.addEventListener("click",()=>{
        const range=btn.dataset.range;
        columnState[side].range=range;
        document.querySelectorAll(`.tr-btn[data-side="${side}"]`).forEach(b=>{
          const on=b.dataset.range===range;
          b.style.border=`1px solid transparent`;
          b.style.background=on?"var(--dart-gold)":"var(--dart-bg-chip)";
          b.style.color=on?"#000":"var(--dart-text-muted)";
          b.style.fontWeight=on?"700":"600";
        });
        updateColumn(side,pid);
      });
    });

    const sel=document.querySelector(`.session-select[data-side="${side}"]`);
    if(sel){
      sessionsAll.forEach(s=>{
        const opt=document.createElement("option");
        opt.value=s.id; opt.textContent=`${s.label} (${s.legs} Leg${s.legs!==1?"s":""})`;
        sel.appendChild(opt);
      });
      sel.addEventListener("change",()=>{
        const sid=sel.value||null;
        columnState[side].sessionId=sid;
        columnState[side].legNum="all";
        if(sid) populateLegBtns(side,sid,sessionsAll);
        else {const w=document.getElementById(`legs-${side}`);if(w) w.style.display="none";}
        updateColumn(side,pid);
      });
    }

    document.getElementById(`legs-${side}`)?.addEventListener("click",e=>{
      const btn=e.target.closest(".leg-btn"); if(!btn) return;
      columnState[side].legNum=btn.dataset.leg==="all"?"all":parseInt(btn.dataset.leg);
      document.querySelectorAll(`#legs-${side} .leg-btn`).forEach(b=>{
        const on=b.dataset.leg===btn.dataset.leg;
        b.style.border=`1px solid transparent`;
        b.style.background=on?"var(--dart-gold)":"var(--dart-bg-chip)";
        b.style.color=on?"#000":"var(--dart-text-muted)";
        b.style.fontWeight=on?"700":"600";
      });
      updateColumn(side,pid);
    });

    updateColumn(side,pid);
  });
}

/** Renders the player selector bar for stats. */
export function renderStatsPlayerBar(){
  const bar=document.getElementById("stats-player-bar");
  if(!bar) return;
  let html=`<button class="stats-player-btn${statsSelectedPlayer===null?" active":""}" data-pid="all">
    ${t('alle_spieler')}</button>`;
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
  box.innerHTML=`<div class="stats-loading">${t('lade')}</div>`;
  if(!window.dartDB){ box.innerHTML='<div class="stats-loading">Datenbank nicht bereit.</div>'; return; }

  renderStatsPlayerBar();

  try{
    allGamesCache=await window.dartDB.loadStats();
    const {from,to}=getTimeRange();
    let games=allGamesCache.filter(g=>g.ts>=from&&g.ts<=to);
    if(statsSelectedPlayer){ games=games.filter(g=>(g.playerIds||[]).includes(statsSelectedPlayer)); }
    if(statsContext!=="all"){ games=games.filter(g=>g.context===statsContext||(statsContext==="casual"&&!g.context)); }

    if(!games.length){
      box.innerHTML=`<div class="stats-loading">${t('keine_spiele')}</div>`; return;
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
      html+=`<div class="stats-section-title" style="font-size:13px;color:var(--dart-text-sec)">501 / 301</div>`;
      html+=`<div class="stats-grid">
        <div class="stat-card"><div class="s-label">${t('spiele')}</div><div class="s-value">${x01Games.length}</div></div>
        <div class="stat-card"><div class="s-label">${t('siege')}</div><div class="s-value">${wins}</div><div class="s-sub">${x01Games.length?Math.round(wins/x01Games.length*100):0}% ${t('quote')}</div></div>
        <div class="stat-card"><div class="s-label">${t('average')}</div><div class="s-value">${avg||"—"}</div></div>
        <div class="stat-card"><div class="s-label">${t('first9')}</div><div class="s-value">${f9avg||"—"}</div><div class="s-sub">${t('erste_9')}</div></div>
        <div class="stat-card"><div class="s-label">${t('highscore')}</div><div class="s-value">${best||"—"}</div></div>
        <div class="stat-card"><div class="s-label">${t('checkout_quote')}</div><div class="s-value">${coPct}%</div><div class="s-sub">${coHits}/${coAtts}</div></div>
        <div class="stat-card"><div class="s-label">${t('darts')}</div><div class="s-value">${x01Games.length?Math.round(x01Games.reduce((s,g)=>s+(g.rounds||0),0)/x01Games.length*3):0}</div><div class="s-sub">${t('pro_leg')}</div></div>
      </div>`;
    }

    if(crGames.length>0){
      html+=`<div class="stats-section-title" style="font-size:13px;color:var(--dart-text-sec)">CRICKET</div>`;
      html+=`<div class="stats-grid">
        <div class="stat-card"><div class="s-label">${t('spiele')}</div><div class="s-value">${crGames.length}</div></div>
        <div class="stat-card"><div class="s-label">${t('siege')}</div><div class="s-value">${crWins}</div><div class="s-sub">${crGames.length?Math.round(crWins/crGames.length*100):0}% ${t('quote')}</div></div>
        <div class="stat-card"><div class="s-label">⌀ MARKS/AUFNAHME</div><div class="s-value">${crAvg||"—"}</div></div>
        <div class="stat-card"><div class="s-label">${t('darts')}</div><div class="s-value">${crGames.length?Math.round(crGames.reduce((s,g)=>s+(g.rounds||0),0)/crGames.length*3):0}</div><div class="s-sub">${t('pro_leg')}</div></div>
      </div>`;
    }

    if(!pid && state.allPlayers.length>1){
      html+=`<div class="stats-section-title">${t('spieler_vergleich')}</div>
        <div class="history-list">
        <div class="history-header" style="grid-template-columns:1fr 45px 45px 45px 45px 45px 55px">
          <span>SPIELER</span><span>${t('siege')}</span><span>⌀</span><span>F9</span><span>BEST</span><span>CO%</span><span>CR ⌀M</span>
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
      html+=`<div class="stats-section-title" id="chart-title">3-Dart Average · ${t('verlauf')}</div>
        <div class="chart-kpi-bar" id="chart-kpi-bar">
          <button class="chart-kpi-btn active" data-kpi="avg">${t('aufnahme_chip')}</button>
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

    // ── Standard stats: Letzte Spiele ────────────────────────────────
    html+=`<div class="stats-section-title">${t('letzte_spiele')}</div>
      <div class="history-list">
      <div class="history-header"><span>${t('gewinner_col')}</span><span>${t('modus_col')}</span><span>${t('darts')}</span><span>${t('datum_col')}</span></div>`;
    games.slice(0,15).forEach(g=>{
      const d=new Date(g.ts);
      const ds=`${d.getDate()}.${d.getMonth()+1}.${String(d.getFullYear()).slice(2)}`;
      const isWin=pid?g.winnerId===pid:true;
      html+=`<div class="history-row">
        <span class="winner-tag" style="color:${isWin&&pid?"var(--dart-success)":"var(--dart-text)"}">${g.winner||"—"}</span>
        <span class="mode-tag">${g.mode||"—"}</span>
        <span>${(g.rounds||0)*3}</span>
        <span style="color:var(--dart-text-sec);font-size:11px">${ds}</span>
      </div>`;
    });
    html+=`</div>`;

    // ── Standard stats: Doppelfeld ────────────────────────────────────
    const doubleAgg={};
    x01Data.forEach(p=>{ if(!p.doubleStats) return; Object.entries(p.doubleStats).forEach(([field,v])=>{ if(!doubleAgg[field]) doubleAgg[field]={att:0,hit:0}; doubleAgg[field].att+=v.att||0; doubleAgg[field].hit+=v.hit||0; }); });
    const doubleEntries=Object.entries(doubleAgg).map(([f,v])=>({field:f,att:v.att,hit:v.hit,pct:v.att>0?Math.round(v.hit/v.att*100):0})).filter(e=>e.att>=1).sort((a,b)=>b.att-a.att);
    const bestDouble=doubleEntries.filter(e=>e.att>=3).sort((a,b)=>b.pct-a.pct)[0];
    const worstDouble=doubleEntries.filter(e=>e.att>=3).sort((a,b)=>a.pct-b.pct)[0];
    const mostTriedDouble=doubleEntries[0];

    if(doubleEntries.length>0){
      html+=`<div class="stats-section-title" style="display:flex;align-items:center"><i data-lucide="target" style="width:16px;height:16px;stroke-width:2;vertical-align:middle"></i> ${t('doppelfeld_stat')} <button class="help-btn" onclick="window.showHelp('${t('doppelfeld_stat')}','${t('doppelfeld_hilfe')}')"><i data-lucide="help-circle" style="width:12px;height:12px;stroke-width:2;vertical-align:middle"></i></button></div>`;
      html+=`<div class="stats-grid" style="margin-bottom:10px">
        ${bestDouble?`<div class="stat-card"><div class="s-label">${t('bestes_doppel')}</div><div class="s-value">${bestDouble.field}</div><div class="s-sub">${bestDouble.pct}% (${bestDouble.hit}/${bestDouble.att})</div></div>`:""}
        ${worstDouble&&worstDouble.field!==bestDouble?.field?`<div class="stat-card"><div class="s-label">${t('schwaechstes_doppel')}</div><div class="s-value">${worstDouble.field}</div><div class="s-sub">${worstDouble.pct}% (${worstDouble.hit}/${worstDouble.att})</div></div>`:""}
        ${mostTriedDouble?`<div class="stat-card"><div class="s-label">${t('meist_gespielt')}</div><div class="s-value">${mostTriedDouble.field}</div><div class="s-sub">${mostTriedDouble.att} ${t('versuche_label')}</div></div>`:""}
      </div>
      <div class="history-list" style="margin-bottom:14px">
        <div class="history-header" style="grid-template-columns:1fr 70px 70px 70px"><span>${t('feld_col')}</span><span>${t('versuche_col')}</span><span>${t('treffer_col')}</span><span>${t('quote_col')}</span></div>`;
      doubleEntries.forEach(e=>{
        const color=e.pct>=50?"var(--dart-success)":e.pct>=25?"var(--dart-warning)":"var(--dart-danger)";
        const barW=Math.round(e.pct);
        html+=`<div class="history-row" style="grid-template-columns:1fr 70px 70px 70px">
          <span style="display:flex;align-items:center;gap:8px">
            <strong>${e.field}</strong>
            <span style="width:100px;height:6px;background:var(--dart-border);border-radius:3px;display:inline-block;overflow:hidden;flex-shrink:0">
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

    // ── Premium: Erweiterte Statistiken (2-Spalten, am Ende) ──────────
    if(allScatter.length){
      html+=`<div style="border-top:2px solid var(--dart-gold);margin-top:24px;padding-top:16px"></div>
      <div class="stats-section-title" style="display:flex;align-items:center;gap:8px;margin-top:0">
        <i data-lucide="microscope" style="width:16px;height:16px;stroke-width:2;vertical-align:middle"></i> ERWEITERTE STATISTIKEN
        <span style="font-size:9px;background:var(--dart-gold);color:#000;padding:2px 6px;border-radius:10px;font-family:'DM Sans',sans-serif;font-weight:700">PREMIUM</span>
      </div>
      <div class="adv-grid">
        <div style="background:var(--dart-bg-card);border:1px solid var(--dart-border);border-radius:14px;padding:12px">${buildAdvancedColumn("a")}</div>
        <div style="background:var(--dart-bg-card);border:1px solid var(--dart-border);border-radius:14px;padding:12px">${buildAdvancedColumn("b")}</div>
      </div>`;
    }

    box.innerHTML=html;
    window.refreshIcons?.();
    loadCoachHistoryStats(statsSelectedPlayer);

    if(allScatter.length){
      setupAdvancedUI(pid);
    }

    if(chartGames.length>=2){
      const KPI_DEFS={
        avg:    {label:"3-Dart Average", extract:(g,pid)=>{ const p=(g.players||[]).find(x=>pid?x.id===pid:true); return p?.avg3||null; }},
        f9:     {label:"First 9 Ø",     extract:(g,pid)=>{ const p=(g.players||[]).find(x=>pid?x.id===pid:true); return p?.first9||null; }},
        best:   {label:"Highscore",     extract:(g,pid)=>{ const p=(g.players||[]).find(x=>pid?x.id===pid:true); return p?.best3||null; }},
        co:     {label:"Checkout %",    extract:(g,pid)=>{ const p=(g.players||[]).find(x=>pid?x.id===pid:true); if(!p||!p.checkoutAtt) return null; return Math.round(p.checkoutHit/p.checkoutAtt*100); }},
        rounds: {label:"Darts",         extract:(g)=>g.rounds?g.rounds*3:null},
        crmarks:{label:"Cricket ⌀M",   extract:(g,pid)=>{ const p=(g.players||[]).find(x=>pid?x.id===pid:true); return p?.cricketAvgMarks||null; }}
      };
      let activeKPI="avg";

      if(_chartTimeout) clearTimeout(_chartTimeout);
      _chartTimeout = setTimeout(()=>{
        _chartTimeout = null;
        const canvas=document.getElementById("trend-canvas");
        if(!canvas) return;

        function updateChartTitle(){
          const titleEl=document.getElementById("chart-title");
          if(titleEl) titleEl.textContent=`${KPI_DEFS[activeKPI].label} · ${t('verlauf')}`;
        }

        function drawChart(){
          const W=canvas.parentElement.clientWidth-24||500;
          canvas.width=W*2; canvas.height=360;
          canvas.style.width="100%"; canvas.style.height="180px";
          const ctx=canvas.getContext("2d");
          ctx.setTransform(2,0,0,2,0,0);
          const w=W, h=180, pad={t:24,r:48,b:28,l:38};
          ctx.clearRect(0,0,w,h);
          ctx.fillStyle='#121216'; ctx.fillRect(0,0,w,h);
          ctx.strokeStyle='#1a1a1f'; ctx.lineWidth=1;
          for(let i=0;i<=4;i++){ const y=pad.t+(h-pad.t-pad.b)*i/4; ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(w-pad.r,y); ctx.stroke(); }
          const step=Math.max(1,Math.floor(chartGames.length/6));
          ctx.fillStyle='#6E6E78'; ctx.font="9px 'DM Sans',sans-serif"; ctx.textAlign="center";
          chartGames.forEach((g,i)=>{ if(i%step!==0&&i!==chartGames.length-1) return; const x=pad.l+(w-pad.l-pad.r)*i/Math.max(1,chartGames.length-1); const d=new Date(g.ts); ctx.fillText(`${d.getDate()}.${d.getMonth()+1}`,x,h-6); });
          const kpi=KPI_DEFS[activeKPI];
          const vals=chartGames.map(g=>kpi.extract(g,pid));
          const validVals=vals.filter(v=>v!==null);
          if(!validVals.length) return;
          const minV=Math.min(...validVals), maxV=Math.max(...validVals), range=maxV-minV||1;
          const toX=i=>pad.l+(w-pad.l-pad.r)*i/Math.max(1,chartGames.length-1);
          const toY=v=>pad.t+(h-pad.t-pad.b)*(1-(v-minV)/range);
          const points=[];
          vals.forEach((v,i)=>{ if(v!==null) points.push({x:toX(i),y:toY(v)}); });
          if(!points.length) return;
          // Gradient fill
          const gradient=ctx.createLinearGradient(0,0,0,h);
          gradient.addColorStop(0,'rgba(212,175,55,0.35)');
          gradient.addColorStop(0.6,'rgba(212,175,55,0.08)');
          gradient.addColorStop(1,'rgba(212,175,55,0)');
          ctx.beginPath();
          points.forEach((p,i)=>{ i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y); });
          ctx.lineTo(points[points.length-1].x,h-pad.b);
          ctx.lineTo(points[0].x,h-pad.b);
          ctx.closePath(); ctx.fillStyle=gradient; ctx.fill();
          // Gold line
          ctx.beginPath();
          points.forEach((p,i)=>{ i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y); });
          ctx.strokeStyle='#D4AF37'; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.stroke();
          // Last point dot
          const last=points[points.length-1];
          ctx.beginPath(); ctx.arc(last.x,last.y,4,0,Math.PI*2); ctx.fillStyle='#D4AF37'; ctx.fill();
          // Value label
          const lastV=validVals[validVals.length-1];
          const lastIdx=vals.lastIndexOf(lastV);
          ctx.fillStyle='#D4AF37'; ctx.font=`bold 10px 'DM Sans',sans-serif`; ctx.textAlign="left";
          ctx.fillText(lastV, toX(lastIdx)+5, toY(lastV)+4);
        }

        function styleKpiBtn(btn, active){
          if(active){
            btn.style.background='var(--dart-gold)'; btn.style.color='#000';
            btn.style.fontWeight='700'; btn.style.borderColor='var(--dart-gold)'; btn.style.borderRadius='99px';
          } else {
            btn.style.background='var(--dart-bg-chip)'; btn.style.color='var(--dart-text-muted)';
            btn.style.fontWeight=''; btn.style.borderColor='transparent'; btn.style.borderRadius='99px';
          }
        }

        document.querySelectorAll(".chart-kpi-btn").forEach(btn=>{
          styleKpiBtn(btn, btn.dataset.kpi===activeKPI);
          btn.addEventListener("click",()=>{
            activeKPI=btn.dataset.kpi;
            document.querySelectorAll(".chart-kpi-btn").forEach(b=>styleKpiBtn(b, b.dataset.kpi===activeKPI));
            updateChartTitle();
            drawChart();
          });
        });

        drawChart();
        updateChartTitle();
        if(_chartResizeHandler) window.removeEventListener("resize",_chartResizeHandler);
        _chartResizeHandler=drawChart;
        window.addEventListener("resize",_chartResizeHandler,{passive:true});
      },100);
    }
  }catch(e){
    box.innerHTML=`<div class="stats-loading">Fehler: ${e.message}</div>`;
    console.error(e);
  }
}
