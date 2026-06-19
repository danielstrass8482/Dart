/**
 * coach.js — AI Coach: prompt building, Claude API calls, video analysis, history.
 */

import { state } from './state.js';
import { numToWords } from './audio.js';
import { getDoubleStatsForCoach } from './x01.js?v=2';
import { t, SUPPORTED_LANGS } from './i18n.js';

export const COACH_DAILY_LIMIT = 999;
export const COACH_STORAGE_KEY = "dart_coach_usage";
export const VIDEO_COACH_LIMIT = 999;
export const VIDEO_COACH_KEY = "dart_video_coach_usage";

export const COACH_FUNCTION_URL="https://europe-west1-fitness-tracker-c6f97.cloudfunctions.net/dartCoach";
export const TTS_FUNCTION_URL="https://europe-west1-fitness-tracker-c6f97.cloudfunctions.net/dartTTS";

// ── Health Connect (Android) ──────────────────────────────────────
const HEALTH_CONNECT_ENABLED = false;

export async function getHealthDataFromConnect(){
  if(!HEALTH_CONNECT_ENABLED || !window.healthConnect) return null;
  try{
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const sleep = await window.healthConnect.readRecords({type:"SleepSession", startTime:yesterday.toISOString(), endTime:now.toISOString()});
    const hrv = await window.healthConnect.readRecords({type:"RestingHeartRate", startTime:today.toISOString(), endTime:now.toISOString()});
    const activity = await window.healthConnect.readRecords({type:"ActiveCalories", startTime:today.toISOString(), endTime:now.toISOString()});
    return { sleep: sleep.totalHours||null, restingHR: hrv.beatsPerMinute||null, activeCalories: activity.total||null, source:"healthconnect" };
  }catch(e){ return null; }
}

export function initHealthChips(){
  document.querySelectorAll(".health-chips").forEach(group=>{
    group.querySelectorAll(".health-chip").forEach(chip=>{
      chip.addEventListener("click",()=>{
        group.querySelectorAll(".health-chip").forEach(c=>c.classList.remove("active"));
        chip.classList.add("active");
      });
    });
  });
}

export function showHealthModal(){
  return new Promise(resolve=>{
    document.querySelectorAll(".health-chip").forEach(c=>c.classList.remove("active"));
    const backdrop = document.getElementById("health-modal-backdrop");
    backdrop.classList.add("visible");
    const skip = document.getElementById("health-skip-btn");
    const save = document.getElementById("health-save-btn");
    function cleanup(data){ backdrop.classList.remove("visible"); skip.removeEventListener("click", onSkip); save.removeEventListener("click", onSave); resolve(data); }
    function onSkip(){ cleanup(null); }
    function onSave(){
      const sleepChip = document.querySelector("#hc-sleep .health-chip.active");
      const exertionChip = document.querySelector("#hc-exertion .health-chip.active");
      const feelingChip = document.querySelector("#hc-feeling .health-chip.active");
      cleanup({ sleep: sleepChip ? Number(sleepChip.dataset.val) : null, exertion: exertionChip ? exertionChip.dataset.val : null, feeling: feelingChip ? Number(feelingChip.dataset.val) : null, source:"manual" });
    }
    skip.addEventListener("click", onSkip);
    save.addEventListener("click", onSave);
  });
}

export async function collectHealthData(){
  const hc = await getHealthDataFromConnect();
  if(hc) return hc;
  return showHealthModal();
}

export function getCoachUsage(){
  try{ const raw = localStorage.getItem(COACH_STORAGE_KEY); if(!raw) return {date:"", count:0}; return JSON.parse(raw); }
  catch(e){ return {date:"",count:0}; }
}

export function recordCoachUsage(){
  const today = new Date().toISOString().slice(0,10);
  const usage = getCoachUsage();
  const count = usage.date===today ? usage.count+1 : 1;
  localStorage.setItem(COACH_STORAGE_KEY, JSON.stringify({date:today, count}));
  return count;
}

export function coachCallsLeft(){
  const today = new Date().toISOString().slice(0,10);
  const usage = getCoachUsage();
  if(usage.date!==today) return COACH_DAILY_LIMIT;
  return Math.max(0, COACH_DAILY_LIMIT - usage.count);
}

export function getVideoCoachUsage(){
  try{ const r=localStorage.getItem(VIDEO_COACH_KEY); return r?JSON.parse(r):{date:"",count:0}; }
  catch(e){ return {date:"",count:0}; }
}

export function videoCoachCallsLeft(){
  const today=new Date().toISOString().slice(0,10);
  const u=getVideoCoachUsage();
  return u.date!==today?VIDEO_COACH_LIMIT:Math.max(0,VIDEO_COACH_LIMIT-u.count);
}

export function recordVideoCoachUsage(){
  const today=new Date().toISOString().slice(0,10);
  const u=getVideoCoachUsage();
  const count=u.date===today?u.count+1:1;
  localStorage.setItem(VIDEO_COACH_KEY,JSON.stringify({date:today,count}));
  return count;
}

/**
 * Builds the coach analysis prompt.
 * @param {Object|null} stats
 * @param {Object|null} sessionStats
 * @param {Array} allGames
 * @param {string|null} playerId
 * @param {Object|null} healthData
 * @returns {string}
 */
export function buildCoachPrompt(stats, sessionStats, allGames, playerId, healthData){
  const lang = localStorage.getItem('dart_lang') || 'de';
  const langEntry = SUPPORTED_LANGS.find(l => l.code === lang);
  const langInstruction = langEntry?.coachInstruction || SUPPORTED_LANGS.find(l => l.code === 'en').coachInstruction;
  const lines=[
    langInstruction,
    "",
    "Du bist ein professioneller, datenbasierter Dart-Elite-Trainer und Datenanalyst. Analysiere kritisch aber balanciert.",
    "Kein blindes Loben, kein Niedermachen. Der Spieler entscheidet selbst über sein Training.",
    "",
    "Analysiere strikt nach diesem Schema:",
    "",
    "### 1. Status Quo & Muster-Erkennung",
    "- First-9 vs. Gesamt-Average: Analysiere das Verhältnis. Beachte dass lange Checkout-Phasen den Average drücken.",
    "- Trend: Letzte 5 vs. vorherige 5 Spiele explizit vergleichen.",
    "- Präzision & Streuung: Werte X/Y-Koordinaten aus wenn vorhanden. Unterscheide systematischen Drift (links/rechts/oben/unten) von wilder Streuung.",
    "- Match-Dynamik: High Scores, Checkout-Effizienz, Muster bei bestimmten Doppelfeldern.",
    "",
    "### 2. Differenzierte Betrachtung",
    "- Stärken (Pro): Welche Segmente laufen stabil?",
    "- Herausforderungen (Contra): Primärer Engpass laut Daten?",
    "",
    "### 3. Evidenzbasierte Trainingsempfehlungen",
    "- Option A (Scoring & Konstanz): Übungen basierend auf Streuungsradius und Rhythmus.",
    "- Option B (Checkout & Druck): Spielformen wie Bob's 27, Around the Clock Doubles.",
    "",
    "Wenn Gesundheitsdaten vorhanden: Beziehe sie explizit in die Analyse ein. Erkläre konkret wie Schlaf und Belastung die heutige Leistung beeinflusst haben könnten.",
    "",
    "Nur Analyse, kein Intro, kein Outro.",
    ""
  ];

  if(stats){
    lines.push("=== GESAMTSTATISTIKEN ===");
    lines.push(`Spiele gesamt: ${stats.games||0}`);
    lines.push(`Siege: ${stats.wins||0} (${stats.games?Math.round((stats.wins||0)/stats.games*100):0}%)`);
    lines.push(`Ø Aufnahme (gesamt): ${stats.avgPerTurn||0}`);
    lines.push(`First-9 Ø: ${stats.first9avg||"—"}`);
    lines.push(`Checkout-Quote: ${stats.checkoutPct||0}%`);
    lines.push(`Highscore: ${stats.highscore||0}`);
    if(stats.cricketGames>0) lines.push(`Cricket: ${stats.cricketGames} Spiele, Ø ${stats.cricketAvgMarks||0} Marks/Aufnahme`);
  }

  if(allGames&&playerId){
    const pGames=allGames.filter(g=>(g.playerIds||[]).includes(playerId));
    if(pGames.length>=6){
      const getAvg=games=>{ const vals=games.flatMap(g=>(g.players||[]).filter(p=>p.id===playerId).map(p=>p.avg3||0)).filter(v=>v>0); return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10:0; };
      const getCo=games=>{ const att=games.flatMap(g=>(g.players||[]).filter(p=>p.id===playerId)).reduce((s,p)=>s+(p.checkoutAtt||0),0); const hit=games.flatMap(g=>(g.players||[]).filter(p=>p.id===playerId)).reduce((s,p)=>s+(p.checkoutHit||0),0); return att>0?Math.round(hit/att*100):0; };
      const last5=pGames.slice(0,5), prev5=pGames.slice(5,10);
      const avgLast=getAvg(last5), avgPrev=getAvg(prev5), coLast=getCo(last5), coPrev=getCo(prev5);
      lines.push("","=== TREND (letzte 5 vs. vorherige 5 Spiele) ===");
      lines.push(`Ø Aufnahme: ${avgLast} (${avgLast>=avgPrev?"+":""}${Math.round((avgLast-avgPrev)*10)/10} vs. vorher)`);
      lines.push(`Checkout-Quote: ${coLast}% (${coLast>=coPrev?"+":""}${coLast-coPrev}% vs. vorher)`);
      if(avgLast>avgPrev&&coLast>coPrev) lines.push("→ Klare Verbesserung in beiden Bereichen");
      else if(avgLast<avgPrev||coLast<coPrev) lines.push("→ Leichter Rückgang — mögliche Ermüdung oder Technikfehler");
    }
  }

  if(allGames&&playerId){
    const pGames=allGames.filter(g=>(g.playerIds||[]).includes(playerId));
    const last5=pGames.slice(0,5);
    const scatter=last5
      .flatMap(g=>(g.players||[]).filter(p=>p.id===playerId).flatMap(p=>p.scatter||[]))
      .filter(p=>p.x!=null&&p.y!=null&&!isNaN(p.x)&&!isNaN(p.y));
    if(scatter.length>=5){
      const cx=Math.round(scatter.reduce((s,p)=>s+p.x,0)/scatter.length);
      const cy=Math.round(scatter.reduce((s,p)=>s+p.y,0)/scatter.length);
      const driftX=cx-265;
      const driftY=cy-265;
      const hDrift=Math.abs(driftX)<15?"mittig":
        driftX<0?`${Math.abs(driftX)}px links`:`${driftX}px rechts`;
      const vDrift=Math.abs(driftY)<15?"mittig":
        driftY<0?`${Math.abs(driftY)}px oben`:`${driftY}px unten`;
      const radius=Math.round(scatter.reduce((s,p)=>s+Math.sqrt((p.x-cx)**2+(p.y-cy)**2),0)/scatter.length);
      const precision=radius<20?"sehr präzise":radius<40?"gut":radius<70?"mittlere Streuung":"große Streuung";
      const missRate=Math.round(scatter.filter(p=>p.l==="Miss").length/scatter.length*100);
      lines.push("","=== TREFFERBILD-ANALYSE (letzte 5 Spiele) ===");
      lines.push(`Würfe analysiert: ${scatter.length}`);
      lines.push(`Cluster-Zentrum X:${cx} Y:${cy} (Scheibenmitte: 265/265)`);
      lines.push(`Horizontaler Drift: ${hDrift}`);
      lines.push(`Vertikaler Drift: ${vDrift}`);
      lines.push(`Streuungsradius: ${radius}px — ${precision}`);
      lines.push(`Miss-Rate: ${missRate}%`);
      if(Math.abs(driftX)>=20||Math.abs(driftY)>=20)
        lines.push(`→ Systematischer Drift erkannt: ${hDrift} / ${vDrift}`);
    }
  }

  if(sessionStats && state.x01?.allThrows){
    const pi=state.cfg?.players?.indexOf(sessionStats.players?.[0]?.name)??-1;
    if(pi>=0 && state.x01.allThrows[pi]?.length>=6){
      const throws=state.x01.allThrows[pi].filter(t=>!t.bouncer);
      const d1=throws.filter((_,j)=>j%3===0).map(t=>t.score);
      const d2=throws.filter((_,j)=>j%3===1).map(t=>t.score);
      const d3=throws.filter((_,j)=>j%3===2).map(t=>t.score);
      const avgD=arr=>arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length*10)/10:0;
      lines.push("","=== WURFSEQUENZ (Ø pro Dart) ===");
      lines.push(`Erster Dart Ø: ${avgD(d1)}, Zweiter: ${avgD(d2)}, Dritter: ${avgD(d3)}`);
      const worst=["Erster","Zweiter","Dritter"][[avgD(d1),avgD(d2),avgD(d3)].indexOf(Math.min(avgD(d1),avgD(d2),avgD(d3)))];
      lines.push(`→ Schwächster Dart: ${worst}`);
    }
  }

  if(allGames && playerId){
    const pGames=allGames.filter(g=>(g.playerIds||[]).includes(playerId));
    const doubleAgg={};
    pGames.forEach(g=>{ const p=(g.players||[]).find(x=>x.id===playerId); if(p?.doubleStats) Object.entries(p.doubleStats).forEach(([field,v])=>{ if(!doubleAgg[field]) doubleAgg[field]={att:0,hit:0}; doubleAgg[field].att+=v.att||0; doubleAgg[field].hit+=v.hit||0; }); });
    const topDoubles=Object.entries(doubleAgg).filter(([_,v])=>v.att>=3).map(([f,v])=>({field:f,att:v.att,hit:v.hit,pct:Math.round(v.hit/v.att*100)})).sort((a,b)=>b.att-a.att).slice(0,3);
    if(topDoubles.length>0){
      lines.push("","=== HÄUFIGSTE DOPPELFELDER (alle Spiele) ===");
      topDoubles.forEach(e=>lines.push(`${e.field}: ${e.pct}% (${e.hit}/${e.att} Versuche)`));
      const worst=[...topDoubles].sort((a,b)=>a.pct-b.pct)[0];
      lines.push(`→ Schwächstes Doppel (häufig gespielt): ${worst.field} (${worst.pct}%)`);
    }
  }

  if(sessionStats){
    const pi=state.cfg.players.indexOf(sessionStats.players?.[0]?.name);
    const ds=pi>=0?getDoubleStatsForCoach(pi):null;
    if(ds&&ds.length>0){
      lines.push("","=== DOPPELFELD-STATISTIK (aktuelle Session) ===");
      ds.forEach(e=>{ lines.push(`${e.field}: ${e.hit}/${e.att} (${e.pct}%)`); });
      const worst=ds.filter(e=>e.att>=3).sort((a,b)=>a.pct-b.pct)[0];
      const best=ds.filter(e=>e.att>=3).sort((a,b)=>b.pct-a.pct)[0];
      if(worst) lines.push(`→ Schwächstes Doppel: ${worst.field} (${worst.pct}%)`);
      if(best) lines.push(`→ Stärkstes Doppel: ${best.field} (${best.pct}%)`);
    }
  }

  if(sessionStats){
    lines.push("","=== LETZTE PARTIE ===");
    lines.push(`Modus: ${sessionStats.mode}, Runden: ${sessionStats.rounds}`);
    sessionStats.players.forEach(p=>{ if(p.id===null) return; lines.push(`${p.name}: Ø ${p.avg3||0}, Best ${p.best3||0}, Checkout ${p.checkoutHit||0}/${p.checkoutAtt||0}${p.first9?`, First-9: ${p.first9}`:""}${p.winner?" → GEWONNEN":""}`); });
  }

  if(healthData){
    lines.push("","=== KÖRPERLICHE VERFASSUNG ===");
    if(healthData.sleep!=null) lines.push(`Schlaf: ${healthData.sleep}h`);
    if(healthData.exertion) lines.push(`Belastung: ${healthData.exertion}`);
    if(healthData.feeling!=null) lines.push(`Befinden: ${healthData.feeling}/4`);
    lines.push(`Datenquelle: ${healthData.source||"manual"}`);
  }

  if(allGames&&playerId){
    const pGames=allGames.filter(g=>(g.playerIds||[]).includes(playerId)&&g.healthData?.sleep!=null);
    if(pGames.length>=10){
      const getPlayerAvg=g=>(g.players||[]).find(p=>p.id===playerId)?.avg3||0;
      const lowSleep=pGames.filter(g=>g.healthData.sleep<6);
      const goodSleep=pGames.filter(g=>g.healthData.sleep>=7);
      const coOf=games=>{ const att=games.flatMap(g=>(g.players||[]).filter(p=>p.id===playerId)).reduce((s,p)=>s+(p.checkoutAtt||0),0); const hit=games.flatMap(g=>(g.players||[]).filter(p=>p.id===playerId)).reduce((s,p)=>s+(p.checkoutHit||0),0); return att>0?Math.round(hit/att*100):null; };
      if(lowSleep.length>=3&&goodSleep.length>=3){
        const avgLow=Math.round(lowSleep.map(getPlayerAvg).reduce((a,b)=>a+b,0)/lowSleep.length*10)/10;
        const avgGood=Math.round(goodSleep.map(getPlayerAvg).reduce((a,b)=>a+b,0)/goodSleep.length*10)/10;
        const coLow=coOf(lowSleep), coGood=coOf(goodSleep);
        lines.push("","=== KORRELATION SCHLAF / LEISTUNG ===");
        lines.push(`Bei <6h Schlaf (${lowSleep.length} Spiele): Ø Average ${avgLow}${coLow!=null?" | Checkout "+coLow+"%":""}`);
        lines.push(`Bei ≥7h Schlaf (${goodSleep.length} Spiele): Ø Average ${avgGood}${coGood!=null?" | Checkout "+coGood+"%":""}`);
      }
    }
  }

  lines.push("","Antworte NUR mit dem Coach-Feedback, keine Einleitung, keine Überschriften.");
  return lines.join("\n");
}

/**
 * Formats coach text with markdown-like HTML.
 * @param {string} text
 * @returns {string}
 */
export function formatCoachText(text){
  return text
    .replace(/### (.+)/g, '<h4 style="font-family:\'Bebas Neue\',sans-serif;font-size:15px;letter-spacing:1px;color:var(--dart-gold);margin:12px 0 4px">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)/gm, '<div style="padding:2px 0 2px 12px;border-left:2px solid var(--dart-gold);margin:3px 0">$1</div>')
    .replace(/\n\n/g, '<br>')
    .replace(/\n/g, '<br>');
}

/**
 * Calls Claude via the proxy cloud function.
 * @param {Array} messages
 * @returns {Promise<Object>}
 */
export async function callClaudeViaProxy(messages){
  let token="anonymous";
  try{ const user=window.fbAuth?.currentUser; if(user) token=await user.getIdToken(); }catch(e){}
  const response=await fetch(COACH_FUNCTION_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
    body:JSON.stringify({model:"claude-sonnet-4-5-20250929",max_tokens:1000,messages})
  });
  if(response.status===429){
    const data=await response.json().catch(()=>({}));
    const err=new Error("daily_limit_reached");
    err.status=429; err.data=data;
    throw err;
  }
  if(response.status===503){
    const data=await response.json().catch(()=>({}));
    const err=new Error("service_unavailable");
    err.status=503; err.data=data;
    throw err;
  }
  if(!response.ok){ const err=await response.text(); throw new Error(`API Fehler ${response.status}: ${err}`); }
  return response.json();
}

/**
 * Runs a full coach call: rate check → API call → render output.
 * @param {string} prompt
 * @param {HTMLElement} outputEl
 * @param {HTMLElement|null} limitEl
 * @param {HTMLButtonElement} btnEl
 */
export async function callCoach(prompt, outputEl, limitEl, btnEl){
  const left = coachCallsLeft();
  if(left<=0){
    outputEl.innerHTML=`<div class="coach-box"><div class="coach-header"><i data-lucide="brain" style="width:14px;height:14px;stroke-width:2;vertical-align:middle"></i> COACH</div>${t('coach_limit_tag_msg').replace('{n}',COACH_DAILY_LIMIT)}</div>`; window.refreshIcons?.();
    btnEl.disabled=true;
    return;
  }
  btnEl.disabled=true;
  btnEl.textContent=t('coach_analysiere');
  outputEl.innerHTML=`<div class="coach-box"><div class="coach-header"><i data-lucide="brain" style="width:14px;height:14px;stroke-width:2;vertical-align:middle"></i> COACH</div><span style="color:var(--dart-text-sec)">${t('coach_denkt')}</span></div>`; window.refreshIcons?.();
  try{
    const data = await callClaudeViaProxy([{role:"user",content:prompt}]);
    const text = data.content?.[0]?.text || t('keine_antwort');
    const count = recordCoachUsage();
    const newLeft = COACH_DAILY_LIMIT - count;
    outputEl.innerHTML=`<div class="coach-box"><div class="coach-header"><i data-lucide="brain" style="width:14px;height:14px;stroke-width:2;vertical-align:middle"></i> ${t('coach_header_text')}</div>${formatCoachText(text)}</div>`; window.refreshIcons?.();
    if(limitEl) limitEl.textContent=`${newLeft} / ${COACH_DAILY_LIMIT} ${t('coach_limit')} ${t('coach_verbleibend')}`;
    btnEl.innerHTML=`<i data-lucide="brain" style="width:16px;height:16px;stroke-width:2;vertical-align:middle"></i> ${t('coach_neue_analyse')}`; window.refreshIcons?.();
    btnEl.disabled = newLeft<=0;
  }catch(e){
    if(e.status===429){
      const d=e.data||{};
      outputEl.innerHTML=`<div class="coach-box" style="border-color:var(--dart-warning)"><div class="coach-header" style="color:var(--dart-warning)"><i data-lucide="brain" style="width:14px;height:14px;stroke-width:2;vertical-align:middle"></i> ${t('coach_limit_erreicht')}</div>${t('coach_bereits_genutzt').replace('{used}',d.used??'?').replace('{limit}',d.limit??10)}<br><small style="color:var(--dart-text-muted)">${t('reset_mitternacht')}</small></div>`; window.refreshIcons?.();
      btnEl.disabled=true;
      return;
    }
    if(e.status===503){
      outputEl.innerHTML=`<div class="coach-box"><div class="coach-header"><i data-lucide="brain" style="width:14px;height:14px;stroke-width:2;vertical-align:middle"></i> COACH</div><span style="color:var(--dart-text-muted)">${t('coach_nicht_verfuegbar')}</span></div>`; window.refreshIcons?.();
      btnEl.disabled=false;
      btnEl.innerHTML=`<i data-lucide="brain" style="width:16px;height:16px;stroke-width:2;vertical-align:middle"></i> ${t('coach_analyse')}`; window.refreshIcons?.();
      return;
    }
    outputEl.innerHTML=`<div class="coach-box" style="border-color:var(--dart-danger)">${t('fehler_prefix')}${e.message}</div>`;
    btnEl.disabled=false;
    btnEl.innerHTML=`<i data-lucide="brain" style="width:16px;height:16px;stroke-width:2;vertical-align:middle"></i> ${t('coach_analyse')}`; window.refreshIcons?.();
  }
}

/**
 * Extracts N frames from a video element as base64 JPEG strings.
 * @param {HTMLVideoElement} videoEl
 * @param {number} numFrames
 * @returns {Promise<Array<string>>}
 */
export async function extractVideoFrames(videoEl, numFrames=5){
  return new Promise((resolve)=>{
    const canvas=document.createElement("canvas");
    const ctx=canvas.getContext("2d");
    const duration=videoEl.duration;
    const frames=[];
    let extracted=0;
    const scale=Math.min(1, 512/videoEl.videoWidth);
    canvas.width=Math.round(videoEl.videoWidth*scale);
    canvas.height=Math.round(videoEl.videoHeight*scale);
    const times=Array.from({length:numFrames},(_,i)=>duration*(i/(numFrames-1||1))*0.95);
    function extractFrame(idx){ if(idx>=times.length){ resolve(frames); return; } videoEl.currentTime=times[idx]; }
    videoEl.addEventListener("seeked",function onSeeked(){
      ctx.drawImage(videoEl,0,0,canvas.width,canvas.height);
      const dataUrl=canvas.toDataURL("image/jpeg",0.7);
      frames.push(dataUrl.split(",")[1]);
      extracted++;
      if(extracted<times.length) extractFrame(extracted);
      else{ videoEl.removeEventListener("seeked",onSeeked); resolve(frames); }
    });
    extractFrame(0);
  });
}

/**
 * Builds the video coach prompt.
 * @param {number} numFrames
 * @param {Object|null} sessionStats
 * @returns {string}
 */
export function buildVideoCoachPrompt(numFrames, sessionStats){
  const lang = localStorage.getItem('dart_lang') || 'de';
  const langEntry = SUPPORTED_LANGS.find(l => l.code === lang);
  const langInstruction = langEntry?.coachInstruction || SUPPORTED_LANGS.find(l => l.code === 'en').coachInstruction;
  return `${langInstruction}

Du bist ein erfahrener Dart-Coach und analysierst die Wurftechnik eines Spielers.

Du siehst ${numFrames} Frames aus einem kurzen Video (chronologische Reihenfolge): Ausholbewegung → Abwurf → Followthrough.

Analysiere in 5-6 Sätzen:
1. Stand und Körperhaltung (Gleichgewicht, Gewichtsverteilung)
2. Wurfarm (Ellbogen-Position, Winkel, Stabilität)
3. Abwurf-Moment (Timing, Fingerführung soweit sichtbar)
4. Followthrough (zeigt der Arm zum Ziel?)
5. Wichtigste Verbesserungsempfehlung

${sessionStats?`Kontext: Der Spieler hat gerade eine Partie ${sessionStats.mode} gespielt mit einem Ø von ${sessionStats.players?.[0]?.avg3||'unbekannt'} Punkten.`:""}

Sei konkret und konstruktiv. Wenn etwas auf dem Video nicht klar erkennbar ist, sag das kurz.`;
}

/**
 * Loads and renders coach analysis history for winner overlay.
 * @param {string|null} pid player ID
 */
export async function loadCoachHistory(pid){
  if(!window.dartDB) return;
  const analyses=await window.dartDB.loadCoachAnalyses(pid);
  const wrap=document.getElementById("coach-history-wrap");
  const list=document.getElementById("coach-history-list");
  if(!wrap||!list||!analyses.length){ if(wrap) wrap.style.display="none"; return; }
  wrap.style.display="";
  list.innerHTML=analyses.map(a=>{
    const d=new Date(a.ts);
    const ds=`${d.getDate()}.${d.getMonth()+1}. ${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}`;
    return `<div style="background:var(--dart-bg-card);border:1px solid var(--dart-border);border-radius:8px;padding:10px;margin-bottom:6px;font-size:13px">
      <div style="font-size:10px;color:var(--dart-text-sec);margin-bottom:4px">${ds} · ${a.mode||""} · Ø ${a.avgPerTurn||0}</div>
      <div style="color:var(--dart-text-sec);line-height:1.6">${formatCoachText((a.type==="video"?"🎥 ":"")+(a.text||"").replace("🧠 COACH-ANALYSE","").replace("🎥 WURF-ANALYSE","").trim())}</div>
    </div>`;
  }).join("");
}

/**
 * Loads and renders coach history in the stats tab.
 * @param {string|null} pid
 */
export async function loadCoachHistoryStats(pid){
  const container=document.getElementById("coach-history-stats");
  if(!container||!window.dartDB) return;
  const analyses=await window.dartDB.loadCoachAnalyses(pid);
  if(!analyses.length){ container.innerHTML=""; return; }
  container.innerHTML=`
    <div style="font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:2px;color:var(--dart-text-muted);margin-bottom:8px;cursor:pointer"
      onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none';this.textContent=this.textContent.includes('▼')?this.textContent.replace('▼','▲'):this.textContent.replace('▲','▼')">
      <i data-lucide="list" style="width:13px;height:13px;stroke-width:2;vertical-align:middle"></i> GESPEICHERTE ANALYSEN (${analyses.length}) ▼
    </div>
    <div style="display:none">
      ${analyses.map(a=>{
        const d=new Date(a.ts);
        const ds=`${d.getDate()}.${d.getMonth()+1}.${String(d.getFullYear()).slice(2)} ${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}`;
        return `<div style="background:var(--dart-bg-card);border:1px solid var(--dart-border);border-radius:8px;padding:12px;margin-bottom:8px">
          <div style="font-size:10px;color:var(--dart-text-sec);margin-bottom:6px;display:flex;justify-content:space-between">
            <span>${ds}</span><span>${a.mode||""} ${a.avgPerTurn?`· Ø ${a.avgPerTurn}`:""}</span>
          </div>
          <div style="font-size:13px;color:var(--dart-text-sec);line-height:1.7">${formatCoachText((a.type==="video"?"🎥 ":"")+(a.text||"").replace("🧠 COACH-ANALYSE","").replace("COACH-ANALYSE","").replace("🎥 WURF-ANALYSE","").trim())}</div>
        </div>`;
      }).join("")}
    </div>`;
}

/**
 * Loads coach history for the analyse tab.
 * @param {string|null} pid
 */
export async function loadCoachHistoryAnalyseTab(pid){
  const container = document.getElementById("coach-history-analyse-tab");
  if(!container || !window.dartDB || !pid) { if(container) container.innerHTML=""; return; }
  const analyses = await window.dartDB.loadCoachAnalyses(pid);
  if(!analyses.length){ container.innerHTML=""; return; }
  container.innerHTML=`
    <div style="font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:2px;color:var(--dart-text-muted);margin-bottom:8px;cursor:pointer"
      onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none';this.textContent=this.textContent.includes('▼')?this.textContent.replace('▼','▲'):this.textContent.replace('▲','▼')">
      <i data-lucide="list" style="width:13px;height:13px;stroke-width:2;vertical-align:middle"></i> GESPEICHERTE ANALYSEN (${analyses.length}) ▼
    </div>
    <div style="display:none">
      ${analyses.map(a=>{
        const d=new Date(a.ts);
        const ds=`${d.getDate()}.${d.getMonth()+1}.${String(d.getFullYear()).slice(2)} ${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}`;
        return `<div style="background:var(--dart-bg-card);border:1px solid var(--dart-border);border-radius:8px;padding:12px;margin-bottom:8px">
          <div style="font-size:10px;color:var(--dart-text-sec);margin-bottom:6px;display:flex;justify-content:space-between">
            <span>${ds}</span><span>${a.mode||""} ${a.avgPerTurn?`· Ø ${a.avgPerTurn}`:""}</span>
          </div>
          <div style="font-size:13px;color:var(--dart-text-sec);line-height:1.7">${formatCoachText((a.type==="video"?"🎥 ":"")+(a.text||"").replace("🧠 COACH-ANALYSE","").replace("COACH-ANALYSE","").replace("🎥 WURF-ANALYSE","").trim())}</div>
        </div>`;
      }).join("")}
    </div>`;
}

/** Updates the coach limit display in the winner overlay. */
export function updateCoachLimitDisplay(){
  const left=coachCallsLeft();
  const limitEl=document.getElementById("coach-limit-winner");
  const btn=document.getElementById("btn-coach-winner");
  if(limitEl) limitEl.textContent=`${left} / ${COACH_DAILY_LIMIT} ${t('coach_limit')} ${t('coach_verfuegbar')}`;
  if(btn) btn.disabled=left<=0;
  const outputEl=document.getElementById("coach-output-winner");
  if(outputEl) outputEl.innerHTML="";
}
