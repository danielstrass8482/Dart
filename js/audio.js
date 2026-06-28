/**
 * audio.js — Web Audio Engine, speech synthesis, and ElevenLabs/Google TTS.
 */

import { state } from './state.js';

// ── Web Audio Engine ──────────────────────────────────────────────
const AudioCtx=window.AudioContext||window.webkitAudioContext;
let audioCtx=null;

/** @returns {AudioContext} */
export function getAudio(){ if(!audioCtx) audioCtx=new AudioCtx(); return audioCtx; }

// ── Speech ────────────────────────────────────────────────────────
const ONES=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
  "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
  "Seventeen","Eighteen","Nineteen"];
const TENS=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

const ONES_DE=["","Eins","Zwei","Drei","Vier","Fünf","Sechs","Sieben","Acht","Neun","Zehn",
  "Elf","Zwölf","Dreizehn","Vierzehn","Fünfzehn","Sechzehn","Siebzehn","Achtzehn","Neunzehn"];
const TENS_DE=["","","Zwanzig","Dreißig","Vierzig","Fünfzig","Sechzig","Siebzig","Achtzig","Neunzig"];

function numToWordsDe(n){
  if(n===0) return "Null";
  if(n===180) return "Einhundertachtzig";
  if(n===100) return "Einhundert";
  if(n===50)  return "Fünfzig";
  if(n===25)  return "Fünfundzwanzig";
  if(n<20)    return ONES_DE[n];
  if(n<100){
    const t=Math.floor(n/10), o=n%10;
    return o?ONES_DE[o]+"und"+TENS_DE[t]:TENS_DE[t];
  }
  const h=Math.floor(n/100), rest=n%100;
  return (h===1?"Einhundert":ONES_DE[h]+"hundert")+(rest?numToWordsDe(rest):"");
}

/**
 * Converts a number to English words.
 * @param {number} n
 * @returns {string}
 */
export function numToWords(n){
  if(n===0) return "Zero";
  if(n===180) return "One Hundred and Eighty";
  if(n===100) return "One Hundred";
  if(n===50)  return "Fifty";
  if(n===25)  return "Twenty Five";
  if(n<20)    return ONES[n];
  if(n<100)   return TENS[Math.floor(n/10)]+(n%10?" "+ONES[n%10]:"");
  const h=Math.floor(n/100);
  const rest=n%100;
  return ONES[h]+" Hundred"+(rest?" and "+numToWords(rest):"");
}

/**
 * Speaks a dart score using Web Speech API.
 * @param {number} score
 */
export function speakScore(score){
  if(!window.speechSynthesis) return;
  const text = score===180 ? "One Hundred and Eighty!" :
               score===100 ? "One Hundred!" :
               score===50  ? "Bull's Eye!" :
               numToWords(score)+"!";
  doSpeak(text, "en-GB");
}

/** Speaks "Bust!" */
export function speakBust(){ speak("Bust!"); }

/**
 * Speaks arbitrary text in English.
 * @param {string} text
 */
export function speak(text){
  if(!window.speechSynthesis) return;
  doSpeak(text, "en-GB");
}

/**
 * Low-level speech synthesis with voice fallback and resume logic.
 * @param {string} text
 * @param {string} lang BCP-47 language tag
 */
export function doSpeak(text, lang){
  if(!window.speechSynthesis) return;
  const trySpeak=()=>{
    if(window.speechSynthesis.paused) window.speechSynthesis.resume();
    const utt=new SpeechSynthesisUtterance(text);
    utt.lang=lang; utt.rate=0.95; utt.pitch=1.1; utt.volume=1;
    const voices=speechSynthesis.getVoices();
    const en=voices.find(v=>v.lang.startsWith("en")&&v.name.includes("Google"))
           ||voices.find(v=>v.lang.startsWith("en-GB"))
           ||voices.find(v=>v.lang.startsWith("en"));
    if(en) utt.voice=en;
    window.speechSynthesis.cancel();
    setTimeout(()=>window.speechSynthesis.speak(utt), 50);
  };
  if(speechSynthesis.getVoices().length>0){ trySpeak(); }
  else{
    let spoken=false;
    const doOnce=()=>{ if(!spoken){ spoken=true; trySpeak(); } };
    speechSynthesis.addEventListener("voiceschanged",doOnce,{once:true});
    // voiceschanged often never fires in Android WebView — force speak after 500ms
    setTimeout(doOnce, 500);
  }
}

// ── Audio unlock for mobile ───────────────────────────────────────
let audioUnlocked=false;
export async function unlockAudio(){
  if(audioUnlocked) return;
  audioUnlocked=true;
  try{
    const ctx=getAudio();
    if(ctx.state==="suspended") await ctx.resume();
    const buf=ctx.createBuffer(1,1,22050);
    const src=ctx.createBufferSource();
    src.buffer=buf; src.connect(ctx.destination); src.start(0);
  }catch(e){}
  try{
    const utt=new SpeechSynthesisUtterance("");
    utt.volume=0;
    window.speechSynthesis.speak(utt);
    window.speechSynthesis.cancel();
    window.speechSynthesis.getVoices();
  }catch(e){}
}

// ── Custom voice (Firebase Storage) ──────────────────────────────
export const voiceURLCache={};

/**
 * Plays a custom voice sample from Firebase Storage.
 * @param {string} key
 * @returns {Promise<boolean>} true if played successfully
 */
export async function playCustomAudio(key){
  if(!window.dartDB) return false;
  try{
    if(!voiceURLCache[key]){
      const url=await window.dartDB.getVoiceSampleURL(key);
      if(!url) return false;
      voiceURLCache[key]=url;
    }
    const audio=new Audio(voiceURLCache[key]);
    audio.volume=1;
    const p=audio.play();
    if(p) await p;
    return true;
  }catch(e){
    console.warn("Custom audio failed:",key,e.message);
    return false;
  }
}

// ── ElevenLabs / Google TTS ───────────────────────────────────────
export const elTTSCache={};
let currentAudio=null;

// ── Audio Queue ───────────────────────────────────────────────────
const audioQueue=[];
let audioPlaying=false;

async function playAudioQueue(){
  if(audioPlaying||audioQueue.length===0) return;
  audioPlaying=true;
  const {text,key,resolve}=audioQueue.shift();
  try{
    const played=await speakElevenLabs(text,key);
    if(!played) await new Promise(r=>{
      doSpeak(text,"en-GB");
      setTimeout(r,Math.max(800,text.length*80));
    });
  }catch(e){}
  audioPlaying=false;
  if(resolve) resolve();
  setTimeout(playAudioQueue,150);
}

export function queueAudio(text,key){
  if(localStorage.getItem("dart_tts_enabled")==="false") return Promise.resolve();
  console.log("TTS debug:", {
    enabled: localStorage.getItem("dart_tts_enabled"),
    voiceEnabled: localStorage.getItem("dart_voice_output"),
    userAgent: navigator.userAgent.substring(0, 50)
  });
  return new Promise(resolve=>{
    audioQueue.push({text,key,resolve});
    playAudioQueue();
  });
}

export function clearAudioQueue(){
  audioQueue.length=0;
  audioPlaying=false;
  if(currentAudio){ currentAudio.pause(); currentAudio.currentTime=0; currentAudio=null; }
  if(window.speechSynthesis) window.speechSynthesis.cancel();
}

const COACH_FUNCTION_URL="https://dartcoach-dxa2kmdyca-ew.a.run.app";
export const TTS_FUNCTION_URL="https://darttts-dxa2kmdyca-ew.a.run.app";

/** @returns {string} active ElevenLabs voice ID */
export function getVoiceId(){
  return localStorage.getItem("dart_active_voice_id")||"JBFqnCBsd6RMkjVDRZzb";
}

/**
 * Fetches a TTS audio URL from the cloud function (with caching).
 * @param {string} storageKey
 * @param {string} text
 * @param {string} [voiceIdOverride]
 * @returns {Promise<string|null>}
 */
export async function fetchTTSUrl(storageKey, text, voiceIdOverride){
  const voiceId=voiceIdOverride||getVoiceId();
  const cacheKey=voiceId+"_"+storageKey;
  if(elTTSCache[cacheKey]) return elTTSCache[cacheKey];
  let authToken="anonymous";
  try{
    const user=window.fbAuth?.currentUser;
    if(user) authToken=await user.getIdToken();
  }catch(e){}
  console.log("TTS fetch:", TTS_FUNCTION_URL, {text, key: storageKey, voiceId});
  const resp=await fetch(TTS_FUNCTION_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+authToken},
    body:JSON.stringify({key:storageKey, text, voiceId})
  });
  console.log("TTS response:", resp.status, resp.statusText);
  if(resp.status===429){ console.info("TTS limit reached, falling back to browser TTS"); return null; }
  if(resp.status===503){ console.info("TTS unavailable, falling back to browser TTS"); return null; }
  if(!resp.ok) return null;
  const {url}=await resp.json();
  if(url) elTTSCache[cacheKey]=url;
  return url||null;
}

/**
 * Plays TTS via cloud function (ElevenLabs/Google).
 * @param {string} text
 * @param {string} cacheKey
 * @returns {Promise<boolean>}
 */
export async function speakElevenLabs(text, cacheKey){
  try{
    const url=await fetchTTSUrl(cacheKey, text);
    if(!url) return false;
    if(currentAudio){ currentAudio.pause(); currentAudio.currentTime=0; currentAudio=null; }
    currentAudio=new Audio(url);
    await new Promise((res,rej)=>{
      currentAudio.onended=res;
      currentAudio.onerror=rej;
      currentAudio.play().catch(rej);
    });
    return true;
  }catch(e){
    console.warn("Google TTS:",e.message);
    return false;
  }
}

/**
 * Tests a specific voice without changing the active voice.
 * @param {string} voiceId
 * @param {string} storageKey
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function testVoice(voiceId, storageKey, text){
  try{
    const url=await fetchTTSUrl(storageKey, text, voiceId);
    if(!url) return false;
    if(currentAudio){ currentAudio.pause(); currentAudio.currentTime=0; }
    currentAudio=new Audio(url);
    await currentAudio.play();
    return true;
  }catch(e){
    console.warn("testVoice:",e.message);
    return false;
  }
}

/**
 * Pre-warms TTS cache without playing.
 * @param {string} text
 * @param {string} storageKey
 */
export async function prewarmTTS(text, storageKey){
  await fetchTTSUrl(storageKey, text).catch(()=>{});
}

/** Pre-warms commonly used score TTS entries. */
export function prewarmElevenLabs(){
  const scoreKeys=[
    [180,"One Hundred and Eighty!","el_score_180b"],[171,"One Hundred and Seventy One!"],
    [167,"One Hundred and Sixty Seven!"],[160,"One Hundred and Sixty!"],
    [140,"One Hundred and Forty!"],[121,null],[100,"One Hundred!"],
    [81,null],[60,null],[45,"Forty Five!"],[41,null],[26,"Bed and Breakfast!"],
    [0,"No Score!"]
  ];
  for(const [score,override,customKey] of scoreKeys){
    const key=customKey??`el_score_${score}`;
    const text=override??(score===50?"Bull's Eye!":numToWords(score)+"!");
    prewarmTTS(text, key);
  }
  prewarmTTS("Bust!", "el_bust");
  prewarmTTS("No Score!", "el_no_score");
  prewarmTTS("Game On!", "el_game_on");
}

// ── Dart Slang ────────────────────────────────────────────────────

/**
 * Detects dart slang text for a 3-dart turn based on throw combinations and score.
 * Returns the slang string (with trailing !) or null if no slang matches.
 * @param {number} score
 * @param {Array} throws current turn throws from state.x01.throws
 * @returns {string|null}
 */
function detectDartSlang(score, throws){
  if(score===180) return null;
  if(!throws||!throws.length) return null;
  const active=throws.filter(t=>!t.miss&&!t.bouncer);
  const labels=active.map(t=>t.label||"");
  if(active.length===3){
    const matchLabels=(...req)=>{
      const rem=[...labels];
      for(const r of req){ const i=rem.indexOf(r); if(i===-1) return false; rem.splice(i,1); }
      return rem.length===0;
    };
    // Specific throw combinations
    if(score===26&&matchLabels("20","5","1")) return "Bed and Breakfast!";
    if(score===11&&matchLabels("5","5","1")) return "Fish and Chips!";
    if(score===45&&matchLabels("15","15","15")) return "Richmond!";
    if(matchLabels("T20","T5","T1")) return "Slightly more than breakfast!";
    // Three in a bed: 3x same single
    if(labels.every(l=>/^\d+$/.test(l))&&labels[0]===labels[1]&&labels[1]===labels[2])
      return "Three in a Bed!";
    // Shanghai: S+D+T of the same number
    const extractNum=l=>{ const m=l.match(/^[TD]?(\d+)$/); return m?parseInt(m[1]):null; };
    const nums=labels.map(extractNum);
    if(nums.every(n=>n!==null)&&new Set(nums).size===1){
      const n=nums[0];
      if(labels.some(l=>l===String(n))&&labels.some(l=>l===`D${n}`)&&labels.some(l=>l===`T${n}`))
        return "Shanghai!";
    }
  }
  // Score-based slang (any combination)
  if(score===100) return "Ton!";
  if(score===140) return "Ton Forty!";
  if(score>=100) return "Good Darts!";
  return null;
}

/**
 * Speaks a score via the audio queue (prevents overlapping announcements).
 * @param {number} score
 * @param {boolean} hitBull true when turn included a Bull or Bull25 throw
 */
export async function speakScoreWithCustom(score, hitBull=false){
  const slangOn=localStorage.getItem("dart_slang_enabled")==="true";
  const slangText=slangOn?detectDartSlang(score,state.x01?.throws):null;
  const text=slangText??(
    score===180?"One Hundred and Eighty!":
    score===100?"One Hundred!":
    score===50&&hitBull?"Bull's Eye!":
    numToWords(score)+"!"
  );
  const slangKey=slangText?`el_slang_${slangText.replace(/[\s!]/g,"_").toLowerCase()}`:null;
  const key=slangKey??(score===50?`el_score_50_${hitBull?"bull":"norm"}`:score===180?`el_score_180b`:`el_score_${score}`);
  await queueAudio(text,key);
}

function partToReadable(part){
  if(part==="Bull") return "Bullseye";
  if(part==="D25") return "Double Bull";
  const isT=part.startsWith("T"), isD=part.startsWith("D");
  const n=parseInt(part.replace(/[TDS]/,""));
  return (isT?"Triple ":isD?"Double ":"") + numToWords(n);
}

/**
 * Announces the checkout path for the given remaining score.
 * Only fires when dart_checkout_announce setting is enabled.
 * @param {number} remaining
 */
export async function announceCheckoutPath(remaining, customPath=null){
  if(localStorage.getItem("dart_checkout_announce")!=="true") return;
  const co=customPath||window._CHECKOUTS?.[remaining];
  if(!co) return;
  const readable=co.split(" ").map(partToReadable).join(", ");
  const cacheKey=customPath?`el_co_${customPath.replace(/ /g,"_")}`:`el_co_${remaining}`;
  await queueAudio("Checkout: "+readable, cacheKey);
}

/**
 * Speaks a keyed message via the audio queue.
 * @param {string} key
 * @param {string} fallbackText
 */
export async function speakKeyWithCustom(key, fallbackText){
  await queueAudio(fallbackText,`el_${key}`);
}
