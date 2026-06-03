/**
 * speech.js — Voice recognition engine and voice command parser.
 */

import { state } from './state.js';
import { numToWords, soundBust, soundApplause, soundHit, soundLow, speakKeyWithCustom, speakScoreWithCustom, speak } from './audio.js';
import { flashSegment } from './board.js';
import { requiresDelay } from './x01.js';

// ── Voice parser vocabulary ───────────────────────────────────────
const NUM_WORDS={
  // English
  "one":1,"two":2,"three":3,"four":4,"five":5,"six":6,"seven":7,"eight":8,
  "nine":9,"ten":10,"eleven":11,"twelve":12,"thirteen":13,"fourteen":14,
  "fifteen":15,"sixteen":16,"seventeen":17,"eighteen":18,"nineteen":19,
  "twenty":20,"twenty one":21,"twenty two":22,"twenty three":23,"twenty four":24,
  "twenty five":25,
  // German
  "eins":1,"zwei":2,"drei":3,"vier":4,"fünf":5,"sechs":6,"sieben":7,"acht":8,
  "neun":9,"zehn":10,"elf":11,"zwölf":12,"dreizehn":13,"vierzehn":14,
  "fünfzehn":15,"sechzehn":16,"siebzehn":17,"achtzehn":18,"neunzehn":19,
  "zwanzig":20,"einundzwanzig":21,"zweiundzwanzig":22,"dreiundzwanzig":23,
  "vierundzwanzig":24,"fünfundzwanzig":25,
  "ein und zwanzig":21,"zwei und zwanzig":22,"drei und zwanzig":23,
  "vier und zwanzig":24,"fünf und zwanzig":25
};

/**
 * Converts a word (or digit string) to a number.
 * @param {string} s
 * @returns {number|null}
 */
export function wordToNum(s){
  s=s.trim().toLowerCase();
  if(NUM_WORDS[s]!==undefined) return NUM_WORDS[s];
  const m=s.match(/^(\d+)$/);
  if(m) return parseInt(m[1]);
  const dashed=s.replace(/-/g," ");
  if(NUM_WORDS[dashed]!==undefined) return NUM_WORDS[dashed];
  return null;
}

/**
 * Parses a voice transcript into a throw object.
 * @param {string} text
 * @returns {{score:number, label:string, miss?:boolean, svgX:null, svgY:null}|null}
 */
export function parseVoiceThrow(text){
  text=text.replace(/[.,!?]/g,"").trim();

  if(/\b(miss|daneben|vorbei|außen|outside|no score|zero|null)\b/.test(text))
    return {score:0, label:"Miss", miss:true, svgX:null, svgY:null};

  if(/bull.?s.?eye|double bull|inner bull|volles bull|bulls eye/.test(text))
    return {score:50, label:"Bull", svgX:null, svgY:null};
  if(/\b(outer bull|bull twenty.?five|twenty.?five bull|außen bull|einfach bull)\b/.test(text))
    return {score:25, label:"Bull 25", svgX:null, svgY:null};
  if(/^bull$/.test(text))
    return {score:50, label:"Bull", svgX:null, svgY:null};

  const triM=text.match(/\b(?:triple|treble|tri|dreifach|drei.?fach)\s+([a-zäöüß\s\d-]+)/);
  if(triM){
    const n=wordToNum(triM[1].trim());
    if(n&&n>=1&&n<=20) return {score:n*3, label:`T${n}`, svgX:null, svgY:null};
  }

  const dblM=text.match(/\b(?:double|dbl|doppel|doppelt)\s+([a-zäöüß\s\d-]+)/);
  if(dblM){
    const raw=dblM[1].trim();
    if(/bull|twenty.?five|25|fünfundzwanzig/.test(raw))
      return {score:50, label:"Bull", svgX:null, svgY:null};
    const n=wordToNum(raw);
    if(n&&n>=1&&n<=20) return {score:n*2, label:`D${n}`, svgX:null, svgY:null};
  }

  const sinM=text.match(/\b(?:single|sin|einfach|einzel)?\s*([a-zäöüß\s\d-]+)$/);
  if(sinM){
    const n=wordToNum(sinM[1].trim());
    if(n===25) return {score:25, label:"Bull 25", svgX:null, svgY:null};
    if(n!==null&&n>=1&&n<=20) return {score:n, label:`${n}`, svgX:null, svgY:null};
  }

  return null;
}

// ── Voice Recognition ─────────────────────────────────────────────
const SpeechRec=window.SpeechRecognition||window.webkitSpeechRecognition;
let recognition=null;
export let micActive=false;
export let micEnabled=false;

/**
 * Initializes the SpeechRecognition object.
 */
export function initMic(){
  if(!SpeechRec){
    const btn=document.getElementById("btn-mic");
    if(btn){ btn.classList.add("disabled-mic"); btn.title="Spracherkennung nicht verfügbar"; }
    return;
  }
  recognition=new SpeechRec();
  recognition.lang="de-DE";
  recognition.continuous=true;
  recognition.interimResults=true;
  recognition.maxAlternatives=5;

  recognition.onstart=()=>{
    micActive=true;
    document.querySelectorAll("#lp-mic,#bottom-mic").forEach(b=>b?.classList.add("listening"));
    setVoiceFeedback("🎤 Spreche…");
  };

  recognition.onend=()=>{
    micActive=false;
    document.querySelectorAll("#lp-mic,#bottom-mic").forEach(b=>b?.classList.remove("listening"));
    if(micEnabled && !state.x01.winner && !state.x01.bust && state.x01.throws.length<3){
      try{ recognition.start(); }catch(e){}
    } else {
      setVoiceFeedback("");
    }
  };

  recognition.onerror=(e)=>{
    if(e.error==="aborted"||e.error==="no-speech") return;
    micActive=false;
    setVoiceFeedback("Fehler: "+e.error);
    setTimeout(()=>setVoiceFeedback(""),2000);
  };

  recognition.onresult=(e)=>{
    const result=e.results[e.results.length-1];
    const texts=[...result].map(r=>r.transcript.toLowerCase().trim());
    if(!result.isFinal){
      setVoiceFeedback("🎤 "+texts[0]);
      return;
    }
    for(const text of texts){
      const hit=parseVoiceThrow(text);
      if(hit){
        setVoiceFeedback("✓ "+hit.label);
        handleVoiceHit(hit);
        if(state.x01.throws.length>=3||state.x01.bust||state.x01.winner) stopMic();
        return;
      }
    }
    setVoiceFeedback("❓ "+texts[0]);
    setTimeout(()=>setVoiceFeedback(micActive?"🎤 Spreche…":""),1500);
  };
}

/** Starts the microphone (respects dart_mic_enabled setting). */
export function startMic(){
  if(localStorage.getItem("dart_mic_enabled")==="false") return;
  if(!recognition) initMic();
  if(!recognition) return;
  micEnabled=true;
  if(!micActive){ try{ recognition.start(); }catch(e){} }
}

/** Stops the microphone. */
export function stopMic(){
  micEnabled=false;
  if(micActive){ try{ recognition.stop(); }catch(e){} }
  document.querySelectorAll("#lp-mic,#bottom-mic").forEach(b=>b?.classList.remove("listening"));
  setVoiceFeedback("");
}

/**
 * Updates the voice feedback display element.
 * @param {string} text
 */
export function setVoiceFeedback(text){
  const el=document.getElementById("voice-feedback");
  if(el) el.textContent=text;
}

/**
 * Announces what the next player needs to finish.
 */
export function announceRequires(){
  if(!state.x01||!state.cfg||!state.cfg.players) return;
  const currentIdx = state.x01.current;
  let targetScore = Infinity;
  let targetName = "";
  for(let i=0; i<state.cfg.players.length; i++){
    if(i === currentIdx) continue;
    if(state.cfg.isBot?.[i]) continue;
    const score = state.x01.scores[i];
    if(score >= 2 && score <= 170 && score < targetScore){
      targetScore = score;
      targetName = state.cfg.players[i];
    }
  }
  if(!targetName) return;
  const text = targetName + " requires " + numToWords(targetScore) + ".";
  speakKeyWithCustom("req_" + targetName + "_" + targetScore, text);
}

/** Restarts mic after player advance if user has mic enabled. */
export function maybeRestartMic(){
  if(localStorage.getItem("dart_mic_enabled")==="false") return;
  if(micEnabled&&!state.cfg.isBot?.[state.x01.current]&&!state.x01.winner){
    setTimeout(()=>{ if(!micActive) try{ recognition.start(); }catch(e){} },400);
  }
}

/**
 * Handles a voice-recognized throw (updates state and renders).
 * NOTE: This calls renderX01 and advanceX01 which are imported in app.js.
 * To avoid circular imports, we use window callbacks.
 * @param {{score:number, label:string, miss?:boolean}} hit
 */
export function handleVoiceHit(hit){
  if(state.x01.winner||state.x01.bust||state.x01.throws.length>=3) return;

  state.x01.history.push({
    scores:[...state.x01.scores], current:state.x01.current, round:state.x01.round,
    throws:[...state.x01.throws], bust:state.x01.bust,
    historicLens:state.x01.historicThrows.map(a=>a.length),
    lastTurnThrows:state.x01.lastTurnThrows.map(a=>[...a]),
    turnScores:state.x01.turnScores.map(a=>[...a])
  });

  // PDC checkout attempt: count once per turn at turn start when score ≤170
  if(state.x01.throws.length===0&&
     state.x01.scores[state.x01.current]<=170&&
     state.x01.scores[state.x01.current]>1&&
     state.x01.scores[state.x01.current]!==25&&
     !state.x01.checkoutAttemptThisTurn){
    state.x01.checkoutAttemptThisTurn=true;
    state.x01.checkoutAttempts[state.x01.current]++;
  }

  state.x01.throws.push(hit);
  state.x01.allThrows[state.x01.current].push(hit);
  if(window._boardOps) window._boardOps.redrawAllHits(state.boardSVG, state.x01.historicThrows[state.x01.current], state.x01.throws);
  if(state.boardSVG) flashSegment(state.boardSVG, hit, 700);

  if(hit.miss){
    if(window._renderX01) window._renderX01();
    if(state.x01.throws.length===3){
      const turnScore=state.x01.throws.reduce((s,t)=>s+t.score,0);
      if(turnScore===0){ soundLow(); speakKeyWithCustom("no_score","No Score!"); }
      else if(turnScore<=9){ soundLow(); speakScoreWithCustom(turnScore); }
      else { soundHit(); speakScoreWithCustom(turnScore); }
      setTimeout(announceRequires, requiresDelay(turnScore));
      setTimeout(()=>window._advanceX01&&window._advanceX01(),350);
    }
    return;
  }

  const spent=state.x01.throws.reduce((s,t)=>s+t.score,0);
  const prevSpent=spent-hit.score;
  const prevRemaining=state.x01.scores[state.x01.current]-prevSpent;
  const tent=prevRemaining-hit.score;

  if(tent<0||tent===1){
    state.x01.bust=true;
    soundBust(); speakKeyWithCustom("bust","Bust!");
    if(window._renderX01) window._renderX01();
    setTimeout(()=>window._advanceX01&&window._advanceX01(), 1500); return;
  }
  if(tent===0){
    if(!hit.label.startsWith("D")&&hit.label!=="Bull"){
      state.x01.bust=true; soundBust(); speakKeyWithCustom("bust","Bust!");
      if(window._renderX01) window._renderX01();
      setTimeout(()=>window._advanceX01&&window._advanceX01(), 1500); return;
    }
    state.x01.scores[state.x01.current]=0; state.x01.winner=state.x01.current;
    state.x01.checkoutHits[state.x01.current]++;
    state.x01.turnScores[state.x01.current].push(spent);
    soundApplause();
    if(window._handleLegWin) window._handleLegWin(state.x01.current);
    if(window._renderX01) window._renderX01();
    return;
  }

  const turnScore=state.x01.throws.reduce((s,t)=>s+t.score,0);
  if(state.x01.throws.length===3){
    if(turnScore===0){ soundLow(); }
    else if(turnScore<=9){ soundLow(); }
    else if(turnScore>=100){ soundApplause(); }
    else { soundHit(); }
    const hitBull=state.x01.throws.some(t=>t.label==="Bull"||t.label==="Bull 25");
    turnScore===0?speakKeyWithCustom("no_score","No Score!"):speakScoreWithCustom(turnScore,hitBull);
    setTimeout(announceRequires, requiresDelay(turnScore));
  } else { soundHit(); }

  if(window._renderX01) window._renderX01();
  if(state.x01.throws.length===3) setTimeout(()=>window._advanceX01&&window._advanceX01(),350);
}
