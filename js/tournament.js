/**
 * tournament.js — Tournament system: round-robin and knockout formats.
 */

import { state } from './state.js';
import { startX01, handleLegWin } from './x01.js?v=2';
import { startCricket } from './cricket.js';
import { startParty } from './party.js';
import { showScreen } from './setup.js?v=2';
import { t as tr } from './i18n.js?v=3';

export let tnFormat="round_robin", tnMode="501", tnLegs=1, tnType="local";
export let activeTournamentId=null, tournamentUnsubscribe=null;

export function setTnFormat(f){ tnFormat=f; }
export function setTnMode(m){ tnMode=m; }
export function setTnLegs(l){ tnLegs=l; }
export function setTnType(t){ tnType=t; }

/** Opens tournament setup screen. */
export function openTournamentSetup(){
  const d=new Date();
  document.getElementById("tn-name").value=`${tr('darts_abend')} ${d.getDate()}.${d.getMonth()+1}.`;
  renderTnPlayerList();
  showScreen("tournament-setup");
}

/** Renders the tournament player checkbox list. */
export function renderTnPlayerList(){
  const el=document.getElementById("tn-player-list");
  if(!el) return;
  el.innerHTML=state.allPlayers.map(p=>`
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #f0f0f0">
      <input type="checkbox" id="tnp-${p.id}" value="${p.id}" style="width:18px;height:18px;cursor:pointer">
      <label for="tnp-${p.id}" style="font-size:14px;cursor:pointer">${p.name}</label>
    </div>`).join("");
}

/**
 * Generates round-robin matches.
 * @param {Array<string>} players
 * @returns {Array}
 */
export function generateRoundRobin(players){
  const matches=[];
  for(let i=0;i<players.length;i++){
    for(let j=i+1;j<players.length;j++){
      matches.push({id:`m${i}_${j}`,player1:i,player2:j,status:"pending",winner:null,score:""});
    }
  }
  return matches;
}

/**
 * Generates knockout bracket rounds.
 * @param {Array<string>} players
 * @returns {Array}
 */
export function generateKnockoutRounds(players){
  const n=players.length;
  let size=1; while(size<n) size*=2;
  const seeds=[...players.map((_,i)=>i)];
  for(let i=seeds.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[seeds[i],seeds[j]]=[seeds[j],seeds[i]];}
  while(seeds.length<size) seeds.push(null);
  const r1matches=[];
  for(let i=0;i<size;i+=2){
    r1matches.push({id:`r0m${i/2}`,player1:seeds[i],player2:seeds[i+1],status:seeds[i+1]===null?"bye":"pending",winner:seeds[i+1]===null?seeds[i]:null,score:""});
  }
  const rounds=[{name:`${tr('runde')} 1`,matches:r1matches}];
  let remaining=size/2, rIdx=1;
  while(remaining>1){
    const rName=remaining===2?tr('finale'):remaining===4?tr('halbfinale'):`Top ${remaining}`;
    const rMatches=[];
    for(let i=0;i<remaining/2;i++){ rMatches.push({id:`r${rIdx}m${i}`,player1:null,player2:null,status:"pending",winner:null,score:""}); }
    rounds.push({name:rName,matches:rMatches});
    remaining/=2; rIdx++;
  }
  return rounds;
}

/**
 * Generates first-round matches for knockout.
 * @param {Array<string>} players
 * @returns {Array}
 */
export function generateKnockout(players){
  const rounds=generateKnockoutRounds(players);
  return rounds[0]?.matches||[];
}

/**
 * Opens the tournament view for a given tournament ID.
 * @param {string} id
 */
export async function openTournamentView(id){
  activeTournamentId=id;
  showScreen("tournament-view");
  if(tournamentUnsubscribe){tournamentUnsubscribe();tournamentUnsubscribe=null;}
  if(window.dartDB){
    tournamentUnsubscribe=window.dartDB.watchTournament(id,t=>renderTournamentView(t));
  } else {
    window.addEventListener("dbReady",async()=>{
      const t=await window.dartDB.getTournament(id);
      if(t) renderTournamentView(t);
      tournamentUnsubscribe=window.dartDB.watchTournament(id,t2=>renderTournamentView(t2));
    },{once:true});
  }
}

/**
 * Renders the tournament view.
 * @param {Object} t tournament data
 */
export function renderTournamentView(t){
  document.getElementById("tv-title").textContent=t.name;
  const badge=document.getElementById("tv-status-badge");
  badge.innerHTML=`<span class="tournament-status-badge ${t.status}">${t.status==="running"?tr('tn_laeuft'):t.status==="finished"?tr('tn_abgeschlossen'):tr('tn_setup')}</span>`;
  const el=document.getElementById("tv-content");
  if(t.format==="round_robin"){ el.innerHTML=renderRoundRobinView(t); }
  else { el.innerHTML=renderKnockoutView(t); }
  el.querySelectorAll(".btn-start-match").forEach(btn=>{
    btn.addEventListener("click",()=>startTournamentMatch(t, btn.dataset.matchId));
  });
  window.refreshIcons?.();
}

export function renderRoundRobinView(t){
  const sorted=[...t.standings].sort((a,b)=>b.wins-a.wins||(b.legsFor-b.legsAgainst)-(a.legsFor-a.legsAgainst));
  let html=`<div style="background:var(--dart-bg-card);border:1px solid var(--dart-border);border-radius:10px;padding:14px;margin-bottom:16px">
    <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:2px;margin-bottom:8px">${tr('tabelle')}</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr style="border-bottom:2px solid var(--dart-border)"><th style="text-align:left;padding:4px 2px">${tr('tn_spieler')}</th><th style="padding:4px 6px">S</th><th style="padding:4px 6px">N</th><th style="padding:4px 6px">Legs+</th><th style="padding:4px 6px">Legs-</th></tr>
      ${sorted.map((s,i)=>`<tr style="border-bottom:1px solid #f5f5f5${i===0?" font-weight:700":""}"><td style="padding:5px 2px">${i===0?'<i data-lucide="medal" style="width:14px;height:14px;stroke-width:2;vertical-align:middle;color:#FFD700"></i> ':i===1?'<i data-lucide="medal" style="width:14px;height:14px;stroke-width:2;vertical-align:middle;color:#C0C0C0"></i> ':i===2?'<i data-lucide="medal" style="width:14px;height:14px;stroke-width:2;vertical-align:middle;color:#CD7F32"></i> ':""}${t.players[s.playerIdx]}</td><td style="text-align:center;padding:5px 6px;color:var(--dart-success)">${s.wins}</td><td style="text-align:center;padding:5px 6px;color:var(--dart-danger)">${s.losses}</td><td style="text-align:center;padding:5px 6px">${s.legsFor}</td><td style="text-align:center;padding:5px 6px">${s.legsAgainst}</td></tr>`).join("")}
    </table>
  </div>`;
  html+=`<div style="background:var(--dart-bg-card);border:1px solid var(--dart-border);border-radius:10px;padding:14px;margin-bottom:16px">
    <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:2px;margin-bottom:8px">${tr('spiele_uebersicht')}</div>`;
  t.matches.forEach(m=>{
    const p1=t.players[m.player1], p2=t.players[m.player2];
    if(m.status==="finished"){
      html+=`<div class="bracket-match"><span class="${m.winner===m.player1?"winner":""}">${p1}</span><span style="color:var(--dart-text-sec);font-size:11px;padding:0 4px">${m.score}</span><span class="${m.winner===m.player2?"winner":""}">${p2}</span><span style="margin-left:auto;font-size:11px;color:var(--dart-success)"><i data-lucide="check" style="width:12px;height:12px;stroke-width:2;vertical-align:middle"></i></span></div>`;
    } else {
      html+=`<div class="bracket-match">${p1} <span style="color:var(--dart-text-sec);font-size:11px;padding:0 6px">vs</span> ${p2} <button class="btn-start-match" data-match-id="${m.id}" style="margin-left:auto;padding:4px 12px;border:none;border-radius:6px;background:var(--dart-gold);font-size:12px;font-weight:700;cursor:pointer">${tr('spielen_btn')}</button></div>`;
    }
  });
  html+="</div>";
  if(t.winner){ html+=`<div style="background:var(--dart-bg-chip);border:2px solid var(--dart-gold);border-radius:12px;padding:20px;text-align:center"><div style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:2px"><i data-lucide="trophy" style="width:24px;height:24px;stroke-width:2;vertical-align:middle;color:var(--dart-gold)"></i> ${tr('sieger')}</div><div style="font-size:24px;font-weight:700;margin-top:4px">${t.winner}</div></div>`; }
  return html;
}

export function renderKnockoutView(t){
  if(!t.bracket?.rounds) return `<div style='color:var(--dart-text-sec);padding:20px;text-align:center'>${tr('keine_bracket_daten')}</div>`;
  let html="";
  t.bracket.rounds.forEach(round=>{
    html+=`<div class="bracket-round-title">${round.name.toUpperCase()}</div>`;
    round.matches.forEach(m=>{
      if(m.status==="bye"||m.player2===null){
        const p1=m.player1!==null?t.players[m.player1]:"—";
        html+=`<div class="bracket-match"><span>${p1}</span><span style="margin-left:auto;font-size:11px;color:var(--dart-text-sec)">${tr('freilos')}</span></div>`;
      } else if(m.player1===null||m.player2===null){
        html+=`<div class="bracket-match" style="opacity:.5">${tr('warte_vorherige_runde')}</div>`;
      } else if(m.status==="finished"){
        const p1=t.players[m.player1], p2=t.players[m.player2];
        html+=`<div class="bracket-match"><span class="${m.winner===m.player1?"winner":""}">${p1}</span><span style="color:var(--dart-text-sec);font-size:11px;padding:0 4px">${m.score}</span><span class="${m.winner===m.player2?"winner":""}">${p2}</span><span style="margin-left:auto;font-size:11px;color:var(--dart-success)"><i data-lucide="check" style="width:12px;height:12px;stroke-width:2;vertical-align:middle"></i></span></div>`;
      } else {
        const p1=t.players[m.player1], p2=t.players[m.player2];
        html+=`<div class="bracket-match">${p1} <span style="color:var(--dart-text-sec);font-size:11px;padding:0 6px">vs</span> ${p2} <button class="btn-start-match" data-match-id="${m.id}" style="margin-left:auto;padding:4px 12px;border:none;border-radius:6px;background:var(--dart-gold);font-size:12px;font-weight:700;cursor:pointer">${tr('spielen_btn')}</button></div>`;
      }
    });
  });
  if(t.winner){ html+=`<div style="background:var(--dart-bg-chip);border:2px solid var(--dart-gold);border-radius:12px;padding:20px;text-align:center;margin-top:16px"><div style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:2px"><i data-lucide="trophy" style="width:24px;height:24px;stroke-width:2;vertical-align:middle;color:var(--dart-gold)"></i> ${tr('sieger')}</div><div style="font-size:24px;font-weight:700;margin-top:4px">${t.winner}</div></div>`; }
  return html;
}

/**
 * Starts a tournament match.
 * @param {Object} tournament
 * @param {string} matchId
 */
export function startTournamentMatch(tournament, matchId){
  const m=tournament.matches?.find(x=>x.id===matchId)
    || tournament.bracket?.rounds?.flatMap(r=>r.matches)?.find(x=>x.id===matchId);
  if(!m) return;
  const p1=tournament.players[m.player1], p2=tournament.players[m.player2];
  const pid1=tournament.playerIds?.[m.player1]||null, pid2=tournament.playerIds?.[m.player2]||null;
  state.cfg={
    mode:tournament.mode, startScore:tournament.mode==="301"?301:501,
    players:[p1,p2], playerIds:[pid1,pid2],
    playerObjects:state.allPlayers.filter(x=>x.id===pid1||x.id===pid2),
    isBot:[false,false], botLevel:"none", botPersonality:"methodisch",
    totalSets:1,setsToWin:1,setWins:[0,0],currentSet:1,
    totalLegs:tournament.legs||1, legsToWin:Math.ceil((tournament.legs||1)/2), legWins:[0,0], currentLeg:1,
    rounds:0, healthData:null, tournamentId:tournament.id, matchId:matchId
  };
  const partyModes=["AtC","Shanghai","Highscore","Killer","Elimination"];
  if(state.cfg.mode==="Cricket") startCricket();
  else if(partyModes.includes(state.cfg.mode)) startParty();
  else startX01();
}

/**
 * Updates a tournament after a match is completed.
 * @param {string} tournamentId
 * @param {string} matchId
 * @param {number} winnerPlayerIdx
 */
export async function updateTournamentMatch(tournamentId, matchId, winnerPlayerIdx){
  if(!window.dartDB) return;
  const t=await window.dartDB.getTournament(tournamentId);
  if(!t) return;
  const legWins=state.cfg.legWins||[0,0];
  const score=`${legWins[0]}-${legWins[1]}`;
  let allMatches=t.matches||[];
  let inBracket=false;
  let matchObj=allMatches.find(m=>m.id===matchId);
  if(!matchObj&&t.bracket?.rounds){
    for(const r of t.bracket.rounds){
      const m=r.matches.find(x=>x.id===matchId);
      if(m){matchObj=m;inBracket=true;break;}
    }
  }
  if(!matchObj) return;
  matchObj.status="finished"; matchObj.winner=winnerPlayerIdx; matchObj.score=score;
  const standings=t.standings||[];
  if(!inBracket){
    const loserIdx=winnerPlayerIdx===matchObj.player1?matchObj.player2:matchObj.player1;
    const ws=standings.find(s=>s.playerIdx===winnerPlayerIdx);
    const ls=standings.find(s=>s.playerIdx===loserIdx);
    if(ws){ws.wins++;ws.legsFor+=legWins[winnerPlayerIdx===matchObj.player1?0:1];ws.legsAgainst+=legWins[winnerPlayerIdx===matchObj.player1?1:0];}
    if(ls){ls.losses++;ls.legsFor+=legWins[winnerPlayerIdx===matchObj.player1?1:0];ls.legsAgainst+=legWins[winnerPlayerIdx===matchObj.player1?0:1];}
  }
  if(inBracket&&t.bracket?.rounds){ advanceKnockoutBracket(t.bracket.rounds, matchId, winnerPlayerIdx); }
  const allDone=(t.matches||[]).every(m=>m.status==="finished")&&
    (!t.bracket||t.bracket.rounds.every(r=>r.matches.every(m=>m.status==="finished"||m.status==="bye")));
  let winner=null;
  if(allDone){
    if(t.format==="round_robin"){ const sorted=[...standings].sort((a,b)=>b.wins-a.wins); winner=t.players[sorted[0]?.playerIdx]||null; }
    else { const lastRound=t.bracket?.rounds?.[t.bracket.rounds.length-1]; const finalMatch=lastRound?.matches?.[0]; if(finalMatch?.winner!=null) winner=t.players[finalMatch.winner]; }
  }
  await window.dartDB.updateTournament(tournamentId,{ matches:t.matches||[], standings, bracket:t.bracket||null, status:allDone?"finished":"running", winner });
  openTournamentView(tournamentId);
}

/**
 * Advances the knockout bracket after a match.
 * @param {Array} rounds
 * @param {string} matchId
 * @param {number} winnerIdx
 */
export function advanceKnockoutBracket(rounds, matchId, winnerIdx){
  for(let ri=0;ri<rounds.length-1;ri++){
    const round=rounds[ri];
    const mi=round.matches.findIndex(m=>m.id===matchId);
    if(mi===-1) continue;
    const nextRound=rounds[ri+1];
    const nextMatchIdx=Math.floor(mi/2);
    const slot=mi%2===0?"player1":"player2";
    if(nextRound?.matches[nextMatchIdx]){
      nextRound.matches[nextMatchIdx][slot]=winnerIdx;
      const nm=nextRound.matches[nextMatchIdx];
      if(nm.player1!==null&&nm.player2!==null) nm.status="pending";
    }
    break;
  }
}

/** Loads and renders the tournaments list. */
export async function loadTournaments(){
  const el=document.getElementById("tournament-list");
  if(!el||!window.dartDB) return;
  el.innerHTML=`<div style="color:var(--dart-text-sec);font-size:13px;text-align:center;padding:16px">${tr('lade')}</div>`;
  const list=await window.dartDB.loadTournaments();
  if(!list.length){
    el.innerHTML=`<div style="color:var(--dart-text-sec);font-size:13px;text-align:center;padding:20px">${tr('noch_keine_turniere_hint')}</div>`;
    return;
  }
  el.innerHTML=list.map(tn=>`
    <div class="tournament-card" onclick="window._openTournamentView('${tn.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:1px">${tn.name}</div>
        <span class="tournament-status-badge ${tn.status}">${tn.status==="running"?tr('tn_laeuft'):tn.status==="finished"?tr('tn_fertig'):tr('tn_setup')}</span>
      </div>
      <div style="font-size:12px;color:var(--dart-text-sec)">${tn.format==="round_robin"?tr('jeder_gegen_jeden'):tr('ko_system')} · ${tn.mode} · ${tn.players?.length||0} ${tr('tn_spieler')}${tn.winner?` · <i data-lucide="trophy" style="width:11px;height:11px;stroke-width:2;vertical-align:middle;color:var(--dart-gold)"></i> `+tn.winner:""}</div>
    </div>`).join("");
  window.refreshIcons?.();
}
