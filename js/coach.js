/**
 * coach.js — AI Coach: prompt building, Claude API calls, video analysis, history.
 */

import { state } from './state.js';
import { numToWords } from './audio.js';
import { getDoubleStatsForCoach } from './x01.js?v=2';
import { t, SUPPORTED_LANGS } from './i18n.js?v=3';

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
  const de = lang === 'de';
  const langEntry = SUPPORTED_LANGS.find(l => l.code === lang);
  const langInstruction = langEntry?.coachInstruction || SUPPORTED_LANGS.find(l => l.code === 'en').coachInstruction;
  const lines=[
    langInstruction,
    "",
    de
      ? "Du bist ein professioneller, datenbasierter Dart-Elite-Trainer und Datenanalyst. Analysiere kritisch aber balanciert."
      : "You are a professional, data-driven elite darts coach and analyst. Be critical but balanced.",
    de
      ? "Kein blindes Loben, kein Niedermachen. Der Spieler entscheidet selbst über sein Training."
      : "No empty praise, no harsh criticism. The player decides their own training focus.",
    "",
    de ? "Analysiere strikt nach diesem Schema:" : "Analyze strictly following this schema:",
    "",
    de ? "### 1. Status Quo & Muster-Erkennung" : "### 1. Current Form & Pattern Analysis",
    de
      ? "- First-9 vs. Gesamt-Average: Analysiere das Verhältnis. Beachte dass lange Checkout-Phasen den Average drücken."
      : "- First-9 vs. overall average: Analyze the ratio. Note that long checkout phases drag the average down.",
    de
      ? "- Trend: Letzte 5 vs. vorherige 5 Spiele explizit vergleichen."
      : "- Trend: Explicitly compare last 5 vs. previous 5 games.",
    de
      ? "- Präzision & Streuung: Werte Segment-Treffer aus wenn vorhanden. Unterscheide systematischen Drift (links/rechts/oben/unten vom Zielsegment) von wilder Streuung."
      : "- Precision & scatter: Evaluate segment hits if available. Distinguish systematic drift (left/right/up/down from target segment) from random scatter.",
    de
      ? "- Match-Dynamik: High Scores, Checkout-Effizienz, Muster bei bestimmten Doppelfeldern."
      : "- Match dynamics: High scores, checkout efficiency, patterns on specific doubles.",
    "",
    de ? "### 2. Differenzierte Betrachtung" : "### 2. Strengths & Weaknesses",
    de ? "- Stärken (Pro): Welche Segmente laufen stabil?" : "- Strengths (Pro): Which segments are consistently solid?",
    de ? "- Herausforderungen (Contra): Primärer Engpass laut Daten?" : "- Challenges (Con): Primary bottleneck according to the data?",
    "",
    de ? "### 3. Evidenzbasierte Trainingsempfehlungen" : "### 3. Evidence-Based Training Recommendations",
    de
      ? "- Option A (Scoring & Konstanz): Übungen basierend auf Streuungsradius und Rhythmus."
      : "- Option A (Scoring & Consistency): Drills based on scatter radius and rhythm.",
    de
      ? "- Option B (Checkout & Druck): Spielformen wie Bob's 27, Around the Clock Doubles."
      : "- Option B (Checkout & Pressure): Practice formats like Bob's 27, Around the Clock Doubles.",
    "",
    de
      ? "Wenn Gesundheitsdaten vorhanden: Beziehe sie explizit in die Analyse ein."
      : "If health data is present: Include it explicitly.",
    de ? "Nur Analyse, kein Intro, kein Outro." : "Analysis only, no intro, no outro.",
    ""
  ];

  if(stats){
    lines.push(de ? "=== GESAMTSTATISTIKEN ===" : "=== OVERALL STATISTICS ===");
    lines.push(de ? `Spiele gesamt: ${stats.games||0}` : `Total games: ${stats.games||0}`);
    lines.push(de
      ? `Siege: ${stats.wins||0} (${stats.games?Math.round((stats.wins||0)/stats.games*100):0}%)`
      : `Wins: ${stats.wins||0} (${stats.games?Math.round((stats.wins||0)/stats.games*100):0}%)`);
    lines.push(de ? `Ø Aufnahme (gesamt): ${stats.avgPerTurn||0}` : `Avg per turn (overall): ${stats.avgPerTurn||0}`);
    lines.push(`First-9 Ø: ${stats.first9avg||"—"}`);
    lines.push(de ? `Checkout-Quote: ${stats.checkoutPct||0}%` : `Checkout rate: ${stats.checkoutPct||0}%`);
    lines.push(`Highscore: ${stats.highscore||0}`);
    if(stats.cricketGames>0) lines.push(de
      ? `Cricket: ${stats.cricketGames} Spiele, Ø ${stats.cricketAvgMarks||0} Marks/Aufnahme`
      : `Cricket: ${stats.cricketGames} games, avg ${stats.cricketAvgMarks||0} marks/turn`);
  }

  if(allGames&&playerId){
    const pGames=allGames.filter(g=>(g.playerIds||[]).includes(playerId));
    if(pGames.length>=6){
      const getAvg=games=>{ const vals=games.flatMap(g=>(g.players||[]).filter(p=>p.id===playerId).map(p=>p.avg3||0)).filter(v=>v>0); return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10:0; };
      const getCo=games=>{ const att=games.flatMap(g=>(g.players||[]).filter(p=>p.id===playerId)).reduce((s,p)=>s+(p.checkoutAtt||0),0); const hit=games.flatMap(g=>(g.players||[]).filter(p=>p.id===playerId)).reduce((s,p)=>s+(p.checkoutHit||0),0); return att>0?Math.round(hit/att*100):0; };
      const last5=pGames.slice(0,5), prev5=pGames.slice(5,10);
      const avgLast=getAvg(last5), avgPrev=getAvg(prev5), coLast=getCo(last5), coPrev=getCo(prev5);
      lines.push("", de ? "=== TREND (letzte 5 vs. vorherige 5 Spiele) ===" : "=== TREND (last 5 vs. previous 5 games) ===");
      lines.push(de
        ? `Ø Aufnahme: ${avgLast} (${avgLast>=avgPrev?"+":""}${Math.round((avgLast-avgPrev)*10)/10} vs. vorher)`
        : `Avg per turn: ${avgLast} (${avgLast>=avgPrev?"+":""}${Math.round((avgLast-avgPrev)*10)/10} vs. previous)`);
      lines.push(de
        ? `Checkout-Quote: ${coLast}% (${coLast>=coPrev?"+":""}${coLast-coPrev}% vs. vorher)`
        : `Checkout rate: ${coLast}% (${coLast>=coPrev?"+":""}${coLast-coPrev}% vs. previous)`);
      if(avgLast>avgPrev&&coLast>coPrev) lines.push(de ? "→ Klare Verbesserung in beiden Bereichen" : "→ Clear improvement in both areas");
      else if(avgLast<avgPrev||coLast<coPrev) lines.push(de ? "→ Leichter Rückgang — mögliche Ermüdung oder Technikfehler" : "→ Slight decline — possible fatigue or technique issue");
    }
  }

  if(allGames&&playerId){
    const pGames=allGames.filter(g=>(g.playerIds||[]).includes(playerId));
    const last5=pGames.slice(0,5);
    const scatter=last5
      .flatMap(g=>(g.players||[]).filter(p=>p.id===playerId).flatMap(p=>p.scatter||[]))
      .filter(p=>p.x!=null&&p.y!=null&&!isNaN(p.x)&&!isNaN(p.y));
    if(scatter.length>=5){
      const BOARD=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
      const getSegNum=l=>{
        if(!l||l==='Miss'||l==='↩') return null;
        if(l==='Bull'||l==='Bull 25') return 0;
        const m=l.match(/\d+/); return m?parseInt(m[0]):null;
      };
      const validThrows=scatter.filter(p=>p.l&&p.l!=='↩');
      const nonMiss=validThrows.filter(p=>p.l!=='Miss');
      const missRate=Math.round((validThrows.length-nonMiss.length)/Math.max(validThrows.length,1)*100);
      const segCounts={};
      nonMiss.forEach(p=>{const n=getSegNum(p.l); if(n!==null&&n!==0) segCounts[n]=(segCounts[n]||0)+1;});
      const sorted=Object.entries(segCounts).sort((a,b)=>b[1]-a[1]);
      const topSegNum=sorted.length?parseInt(sorted[0][0]):20;
      const topPct=Math.round(sorted.length?sorted[0][1]/Math.max(validThrows.length,1)*100:0);
      const topSegLabel=`T${topSegNum}`;
      const tIdx=BOARD.indexOf(topSegNum);
      const leftNum=BOARD[(tIdx+1)%20];
      const rightNum=BOARD[(tIdx+19)%20];
      const leftPct=Math.round(nonMiss.filter(p=>getSegNum(p.l)===leftNum).length/Math.max(validThrows.length,1)*100);
      const rightPct=Math.round(nonMiss.filter(p=>getSegNum(p.l)===rightNum).length/Math.max(validThrows.length,1)*100);
      const cx=Math.round(scatter.reduce((s,p)=>s+p.x,0)/scatter.length);
      const cy=Math.round(scatter.reduce((s,p)=>s+p.y,0)/scatter.length);
      const highPct=Math.round(validThrows.filter(p=>p.y<cy-15).length/Math.max(validThrows.length,1)*100);
      const lowPct=Math.round(validThrows.filter(p=>p.y>cy+15).length/Math.max(validThrows.length,1)*100);
      const radius=Math.round(scatter.reduce((s,p)=>s+Math.sqrt((p.x-cx)**2+(p.y-cy)**2),0)/scatter.length);

      lines.push("", de?"=== TREFFERBILD-ANALYSE (letzte 5 Spiele) ===":"=== THROW PATTERN ANALYSIS (last 5 games) ===");
      lines.push(de?`Würfe analysiert: ${validThrows.length}`:`Throws analyzed: ${validThrows.length}`);
      lines.push(de?`Häufigstes getroffenes Segment: ${topSegLabel} (${topPct}% aller Würfe)`:`Most hit segment: ${topSegLabel} (${topPct}% of all throws)`);
      lines.push(`Miss rate: ${missRate}%`);

      if(de){
        lines.push(`\nZielsegment-Erkennung:\nStandard ist Triple 20. Wenn ${topSegLabel} nicht T20 ist und ${topPct}% über 40%: schreibe "Es sieht aus als würfst du primär auf ${topSegLabel} — ich nehme das als Referenz für diese Analyse."`);
        lines.push(`\nDrift-Analyse relativ zum Zielsegment:`);
        lines.push(`Links-Drift (${leftPct}% auf T${leftNum}):\n- über 30%: "Deutliche Links-Drift auf T${leftNum} (${leftPct}%). Mögliche Ursachen: Ellbogen zu weit innen, Körper dreht beim Abwurf nach links. Das ist ein klares Technik-Thema das gezieltes Training erfordert."\n- 10 bis 30%: "Leichte Links-Drift (${leftPct}%). Beobachte ob dein Ellbogen beim Abwurf nach innen zieht."\n- unter 10%: nicht erwähnen.`);
        lines.push(`Rechts-Drift (${rightPct}% auf T${rightNum}):\n- über 30%: "Deutliche Rechts-Drift auf T${rightNum} (${rightPct}%). Mögliche Ursachen: Abwurf zu früh, Handgelenk klappt seitlich weg."\n- 10 bis 30%: "Rechts-Drift (${rightPct}%). Möglicherweise löst du den Dart einen Moment zu früh."\n- unter 10%: nicht erwähnen.`);
        lines.push(`Oben-Drift (${highPct}% im Single-Ring oder darüber):\n- über 30%: "Deutliche Tendenz zu hoch (${highPct}%). Followthrough zu steil oder Abwurf-Winkel zu aggressiv."\n- 10 bis 30%: "Leicht zu hoch (${highPct}%) — prüfe ob dein Followthrough wirklich zum Triple zeigt."\n- unter 10%: nicht erwähnen.`);
        lines.push(`Unten-Drift (${lowPct}% unter Zielsegment):\n- über 30%: "Deutliche Tendenz zu tief (${lowPct}%). Dart wird zu früh losgelassen."\n- 10 bis 30%: "Leicht zu tief (${lowPct}%) — Loslasse-Zeitpunkt prüfen."\n- unter 10%: nicht erwähnen.`);
        lines.push(`Streuung:\n- unter 30px: "Sehr präzises Wurfbild — du triffst konsistent im Zielsegment."\n- 30 bis 60px: "Gute Konsistenz mit normalem Streuradius."\n- 60 bis 100px: "Mittlere Streuung — Rhythmus und Standfestigkeit prüfen."\n- über 100px: "Große Streuung — hier liegt das größte Verbesserungspotenzial."\nStreuungsradius: ${radius}px`);
      } else {
        lines.push(`\nTarget detection:\nDefault is Triple 20. If ${topSegLabel} is not T20 and ${topPct}% is above 40%: write "It looks like you're primarily aiming at ${topSegLabel} — using that as reference."`);
        lines.push(`\nDrift analysis relative to target segment:`);
        lines.push(`Left drift (${leftPct}% on T${leftNum}):\n- above 30%: "Significant left drift to T${leftNum} (${leftPct}%). Likely causes: elbow too far inward, body rotating left on release. This is a clear technique issue requiring focused training."\n- 10 to 30%: "Slight left drift (${leftPct}%). Watch if your elbow pulls inward on release."\n- below 10%: skip.`);
        lines.push(`Right drift (${rightPct}% on T${rightNum}):\n- above 30%: "Significant right drift to T${rightNum} (${rightPct}%). Likely causes: releasing too early, wrist flicking sideways."\n- 10 to 30%: "Slight right drift (${rightPct}%). You may be releasing the dart a moment too early."\n- below 10%: skip.`);
        lines.push(`High drift (${highPct}% in single ring or above):\n- above 30%: "Consistent tendency to throw high (${highPct}%). Follow-through too steep or release angle too aggressive."\n- 10 to 30%: "Slightly high (${highPct}%) — check if your follow-through actually points at the triple."\n- below 10%: skip.`);
        lines.push(`Low drift (${lowPct}% below target):\n- above 30%: "Consistent tendency to throw low (${lowPct}%). Dart released too early."\n- 10 to 30%: "Slightly low (${lowPct}%) — check your release timing."\n- below 10%: skip.`);
        lines.push(`Scatter radius:\n- below 30px: "Very precise throw pattern — highly consistent."\n- 30 to 60px: "Good consistency with normal scatter radius."\n- 60 to 100px: "Moderate scatter — check rhythm and stance stability."\n- above 100px: "Wide scatter — biggest improvement potential here."\nScatter radius: ${radius}px`);
      }
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
      lines.push("", de ? "=== WURFSEQUENZ (Ø pro Dart) ===" : "=== THROW SEQUENCE (avg per dart) ===");
      lines.push(de
        ? `Erster Dart Ø: ${avgD(d1)}, Zweiter: ${avgD(d2)}, Dritter: ${avgD(d3)}`
        : `1st dart avg: ${avgD(d1)}, 2nd: ${avgD(d2)}, 3rd: ${avgD(d3)}`);
      const worstIdx=[avgD(d1),avgD(d2),avgD(d3)].indexOf(Math.min(avgD(d1),avgD(d2),avgD(d3)));
      const worstLabel=de?["Erster","Zweiter","Dritter"][worstIdx]:["1st","2nd","3rd"][worstIdx];
      lines.push(de ? `→ Schwächster Dart: ${worstLabel}` : `→ Weakest dart: ${worstLabel}`);
    }
  }

  if(allGames && playerId){
    const pGames=allGames.filter(g=>(g.playerIds||[]).includes(playerId));
    const doubleAgg={};
    pGames.forEach(g=>{ const p=(g.players||[]).find(x=>x.id===playerId); if(p?.doubleStats) Object.entries(p.doubleStats).forEach(([field,v])=>{ if(!doubleAgg[field]) doubleAgg[field]={att:0,hit:0}; doubleAgg[field].att+=v.att||0; doubleAgg[field].hit+=v.hit||0; }); });
    const topDoubles=Object.entries(doubleAgg).filter(([_,v])=>v.att>=3).map(([f,v])=>({field:f,att:v.att,hit:v.hit,pct:Math.round(v.hit/v.att*100)})).sort((a,b)=>b.att-a.att).slice(0,3);
    if(topDoubles.length>0){
      lines.push("", de ? "=== HÄUFIGSTE DOPPELFELDER (alle Spiele) ===" : "=== MOST USED DOUBLES (all games) ===");
      topDoubles.forEach(e=>lines.push(de
        ? `${e.field}: ${e.pct}% (${e.hit}/${e.att} Versuche)`
        : `${e.field}: ${e.pct}% (${e.hit}/${e.att} attempts)`));
      const worst=[...topDoubles].sort((a,b)=>a.pct-b.pct)[0];
      lines.push(de
        ? `→ Schwächstes Doppel (häufig gespielt): ${worst.field} (${worst.pct}%)`
        : `→ Weakest double (frequently played): ${worst.field} (${worst.pct}%)`);
    }
  }

  if(sessionStats){
    const pi=state.cfg.players.indexOf(sessionStats.players?.[0]?.name);
    const ds=pi>=0?getDoubleStatsForCoach(pi):null;
    if(ds&&ds.length>0){
      lines.push("", de ? "=== DOPPELFELD-STATISTIK (aktuelle Session) ===" : "=== DOUBLE STATS (current session) ===");
      ds.forEach(e=>{ lines.push(`${e.field}: ${e.hit}/${e.att} (${e.pct}%)`); });
      const worst=ds.filter(e=>e.att>=3).sort((a,b)=>a.pct-b.pct)[0];
      const best=ds.filter(e=>e.att>=3).sort((a,b)=>b.pct-a.pct)[0];
      if(worst) lines.push(de ? `→ Schwächstes Doppel: ${worst.field} (${worst.pct}%)` : `→ Weakest double: ${worst.field} (${worst.pct}%)`);
      if(best) lines.push(de ? `→ Stärkstes Doppel: ${best.field} (${best.pct}%)` : `→ Strongest double: ${best.field} (${best.pct}%)`);
    }
  }

  if(sessionStats){
    lines.push("", de ? "=== LETZTE PARTIE ===" : "=== LAST GAME ===");
    lines.push(de
      ? `Modus: ${sessionStats.mode}, Runden: ${sessionStats.rounds}`
      : `Mode: ${sessionStats.mode}, Rounds: ${sessionStats.rounds}`);
    sessionStats.players.forEach(p=>{ if(p.id===null) return; lines.push(`${p.name}: Ø ${p.avg3||0}, Best ${p.best3||0}, Checkout ${p.checkoutHit||0}/${p.checkoutAtt||0}${p.first9?`, First-9: ${p.first9}`:""}${p.winner?de?" → GEWONNEN":" → WON":""}`); });
  }

  if(healthData){
    lines.push("", de ? "=== KÖRPERLICHE VERFASSUNG ===" : "=== PHYSICAL CONDITION ===");
    if(healthData.sleep!=null) lines.push(de ? `Schlaf: ${healthData.sleep}h` : `Sleep: ${healthData.sleep}h`);
    if(healthData.exertion) lines.push(de ? `Belastung: ${healthData.exertion}` : `Exertion: ${healthData.exertion}`);
    if(healthData.feeling!=null) lines.push(de ? `Befinden: ${healthData.feeling}/4` : `Feeling: ${healthData.feeling}/4`);
    lines.push(de ? `Datenquelle: ${healthData.source||"manual"}` : `Data source: ${healthData.source||"manual"}`);
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
        lines.push("", de ? "=== KORRELATION SCHLAF / LEISTUNG ===" : "=== SLEEP / PERFORMANCE CORRELATION ===");
        lines.push(de
          ? `Bei <6h Schlaf (${lowSleep.length} Spiele): Ø Average ${avgLow}${coLow!=null?" | Checkout "+coLow+"%":""}`
          : `With <6h sleep (${lowSleep.length} games): avg ${avgLow}${coLow!=null?" | checkout "+coLow+"%":""}`);
        lines.push(de
          ? `Bei ≥7h Schlaf (${goodSleep.length} Spiele): Ø Average ${avgGood}${coGood!=null?" | Checkout "+coGood+"%":""}`
          : `With ≥7h sleep (${goodSleep.length} games): avg ${avgGood}${coGood!=null?" | checkout "+coGood+"%":""}`);
      }
    }
  }

  lines.push("", de ? "Antworte NUR mit dem Coach-Feedback, keine Einleitung, keine Überschriften." : "Reply ONLY with the coach feedback, no introduction, no section headings.");
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
 * Computes segment-based scatter drift data from a player's last 5 games.
 * @param {Array} allGames
 * @param {string} playerId
 * @returns {{topSegment,leftPct,rightPct,highPct,lowPct,leftNeighbor,rightNeighbor}|null}
 */
export function computeScatterDrift(allGames, playerId){
  if(!allGames||!playerId) return null;
  const BOARD=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
  const getSegNum=l=>{
    if(!l||l==='Miss'||l==='↩') return null;
    if(l==='Bull'||l==='Bull 25') return 0;
    const m=l.match(/\d+/); return m?parseInt(m[0]):null;
  };
  const pGames=allGames.filter(g=>(g.playerIds||[]).includes(playerId));
  const scatter=pGames.slice(0,5)
    .flatMap(g=>(g.players||[]).filter(p=>p.id===playerId).flatMap(p=>p.scatter||[]))
    .filter(p=>p.x!=null&&p.y!=null&&!isNaN(p.x)&&!isNaN(p.y));
  if(scatter.length<5) return null;
  const validThrows=scatter.filter(p=>p.l&&p.l!=='↩');
  const nonMiss=validThrows.filter(p=>p.l!=='Miss');
  const segCounts={};
  nonMiss.forEach(p=>{const n=getSegNum(p.l); if(n!==null&&n!==0) segCounts[n]=(segCounts[n]||0)+1;});
  const sorted=Object.entries(segCounts).sort((a,b)=>b[1]-a[1]);
  const topSegNum=sorted.length?parseInt(sorted[0][0]):20;
  const tIdx=BOARD.indexOf(topSegNum);
  const leftNum=BOARD[(tIdx+1)%20];
  const rightNum=BOARD[(tIdx+19)%20];
  const cy=Math.round(scatter.reduce((s,p)=>s+p.y,0)/scatter.length);
  const tot=Math.max(validThrows.length,1);
  return {
    topSegment:`T${topSegNum}`,
    leftNeighbor:`T${leftNum}`,
    rightNeighbor:`T${rightNum}`,
    leftPct:Math.round(nonMiss.filter(p=>getSegNum(p.l)===leftNum).length/tot*100),
    rightPct:Math.round(nonMiss.filter(p=>getSegNum(p.l)===rightNum).length/tot*100),
    highPct:Math.round(validThrows.filter(p=>p.y<cy-15).length/tot*100),
    lowPct:Math.round(validThrows.filter(p=>p.y>cy+15).length/tot*100)
  };
}

/**
 * Builds the video coach prompt.
 * @param {number} numFrames
 * @param {Object|string|null} sessionStats
 * @param {{topSegment,leftPct,rightPct,highPct,lowPct,leftNeighbor,rightNeighbor}|null} driftData
 * @returns {string}
 */
export function buildVideoCoachPrompt(numFrames, sessionStats, driftData=null){
  const lang = localStorage.getItem('dart_lang') || 'de';
  const de = lang === 'de';
  const langEntry = SUPPORTED_LANGS.find(l => l.code === lang);
  const langInstruction = langEntry?.coachInstruction || SUPPORTED_LANGS.find(l => l.code === 'en').coachInstruction;

  let driftBlock = '';
  if(driftData){
    const parts=[];
    if(driftData.leftPct>10) parts.push(de
      ?`Links-Drift bekannt (${driftData.leftPct}%) — prüfe besonders Ellbogen-Position und Körperrotation.`
      :`Known left drift (${driftData.leftPct}%) — pay close attention to elbow position and body rotation.`);
    if(driftData.rightPct>10) parts.push(de
      ?`Rechts-Drift bekannt (${driftData.rightPct}%) — prüfe Abwurf-Timing und Handgelenk.`
      :`Known right drift (${driftData.rightPct}%) — check release timing and wrist.`);
    if(driftData.highPct>10) parts.push(de
      ?`Tendenz zu hoch bekannt (${driftData.highPct}%) — prüfe Followthrough-Richtung.`
      :`Known tendency to throw high (${driftData.highPct}%) — check follow-through direction.`);
    if(driftData.lowPct>10) parts.push(de
      ?`Tendenz zu tief bekannt (${driftData.lowPct}%) — prüfe Loslasse-Zeitpunkt.`
      :`Known tendency to throw low (${driftData.lowPct}%) — check release timing.`);
    if(parts.length>0){
      driftBlock='\n\n'+(de?'=== VORBEKANNTE MUSTER AUS STATISTIKEN ===':'=== KNOWN PATTERNS FROM STATISTICS ===')+'\n'+parts.join('\n')+'\n'+(de?'Gehe bei diesen Punkten besonders in die Tiefe.':'Go into extra depth on these points.');
    }
  }

  const sessionCtx=sessionStats
    ?(de
      ?`\n\nKontext: Der Spieler hat gerade eine Partie ${typeof sessionStats==='string'?sessionStats:(sessionStats.mode||'')} gespielt${typeof sessionStats==='object'&&sessionStats.players?` mit einem Ø von ${sessionStats.players[0]?.avg3||'unbekannt'} Punkten`:'`}.`
      :`\n\nContext: The player just played ${typeof sessionStats==='string'?sessionStats:(sessionStats.mode||'')}${typeof sessionStats==='object'&&sessionStats.players?` with an average of ${sessionStats.players[0]?.avg3||'unknown'} points`:'`}.`)
    :'';

  const videoHint=de
    ?'\n\nWenn Ellbogen-Position, Stand oder Followthrough im Video nicht eindeutig erkennbar sind: Füge am Ende hinzu: "Für eine genauere Analyse des [Ellbogens/Stands/Followthroughs] wäre ein Video von [vorne/der Seite/auf Hüfthöhe] hilfreich — lade gerne ein weiteres Video hoch." Nicht bei Fingerführung oder Timing.'
    :'\n\nIf elbow position, stance, or follow-through are not clearly visible: Add at the end: "For a closer look at your [elbow/stance/follow-through], a video from [the front/the side/hip height] would help — feel free to upload another clip." Not for finger grip or timing.';

  return `${langInstruction}${driftBlock}

Du bist ein erfahrener Dart-Coach und analysierst die Wurftechnik eines Spielers.

Du siehst ${numFrames} Frames aus einem kurzen Video (chronologische Reihenfolge): Ausholbewegung → Abwurf → Followthrough.

Analysiere in 5-6 Sätzen:
1. Stand und Körperhaltung (Gleichgewicht, Gewichtsverteilung)
2. Wurfarm (Ellbogen-Position, Winkel, Stabilität)
3. Abwurf-Moment (Timing, Fingerführung soweit sichtbar)
4. Followthrough (zeigt der Arm zum Ziel?)
5. Wichtigste Verbesserungsempfehlung${sessionCtx}

Sei konkret und konstruktiv. Wenn etwas auf dem Video nicht klar erkennbar ist, sag das kurz.${videoHint}`;
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
      <i data-lucide="list" style="width:13px;height:13px;stroke-width:2;vertical-align:middle"></i> ${t('gespeicherte_analysen')} (${analyses.length}) ▼
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
      <i data-lucide="list" style="width:13px;height:13px;stroke-width:2;vertical-align:middle"></i> ${t('gespeicherte_analysen')} (${analyses.length}) ▼
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
