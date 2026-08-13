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
// ── doSpeak() token guard vs. the audioQueue (queueAudio/playAudioQueue below) ──
// These solve different problems and are meant to coexist, not compete:
//   - audioQueue is the primary sequencing mechanism for every announcement in
//     the app. All callers (X01, bot, speech recognition, party modes) now go
//     through queueAudio(), which awaits full completion (ElevenLabs: real
//     `onended`; browser-TTS fallback: a duration estimate) before starting the
//     next item — so announcements are strictly ordered and none is skipped.
//   - The token guard here is a defensive backstop *inside* doSpeak() itself,
//     for the case where two doSpeak() calls still land close together (e.g. a
//     future caller that forgets to route through the queue, or the delayed
//     "voiceschanged" callback firing after a newer call already superseded
//     it). It discards a stale call's pending speak() rather than letting two
//     browser-TTS utterances audibly overlap.
// Net effect: under normal operation every doSpeak() call is already the only
// one in flight (queue guarantees that), so the token guard is a no-op safety
// net, not the thing doing the sequencing. If it starts firing in practice,
// that's a signal some caller bypassed the queue and should be routed through
// queueAudio()/speakKeyWithCustom()/speakScoreWithCustom() instead.
let _speakToken=0;

export function doSpeak(text, lang){
  if(!window.speechSynthesis) return;
  const myToken=++_speakToken;
  const trySpeak=()=>{
    if(myToken!==_speakToken) return;
    if(window.speechSynthesis.paused) window.speechSynthesis.resume();
    const utt=new SpeechSynthesisUtterance(text);
    utt.lang=lang; utt.rate=0.95; utt.pitch=1.1; utt.volume=1;
    const voices=speechSynthesis.getVoices();
    const en=voices.find(v=>v.lang.startsWith("en")&&v.name.includes("Google"))
           ||voices.find(v=>v.lang.startsWith("en-GB"))
           ||voices.find(v=>v.lang.startsWith("en"));
    if(en) utt.voice=en;
    window.speechSynthesis.cancel();
    setTimeout(()=>{ if(myToken===_speakToken) window.speechSynthesis.speak(utt); }, 50);
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
// The single canonical entry point for every spoken announcement in the app.
// audioPlaying gates strict one-at-a-time playback: the next item only starts
// once the previous one has fully resolved (see playAudioQueue), so calls
// fired in quick succession (e.g. typing a score before "Game on!" finished)
// queue up in order instead of overlapping or getting dropped. Every caller
// (X01, bot, speech recognition, party modes) must go through queueAudio() —
// see the doSpeak() token-guard comment above for how that interacts with
// direct doSpeak() calls.
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

// Set once the per-user daily TTS quota (429) is hit, so prewarming stops
// hammering the function for the rest of the day instead of burning through
// retries that can only ever fail. Live announcements still try (and still
// fall back to browser TTS on failure) since a single game announcement is
// cheap compared to the ~180-entry prewarm sweep.
let ttsQuotaExhausted=false;

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
  const headers={"Content-Type":"application/json","Authorization":"Bearer "+authToken};
  const acToken=window.getAppCheckToken?await window.getAppCheckToken():null;
  if(acToken) headers["X-Firebase-AppCheck"]=acToken;
  // Bound the request — on flaky WiFi the fetch can otherwise hang far longer than
  // the queued announcement stays relevant, stalling the whole audio queue.
  const controller=new AbortController();
  const timeoutId=setTimeout(()=>controller.abort(),5000);
  let resp;
  try{
    resp=await fetch(TTS_FUNCTION_URL,{
      method:"POST",
      headers,
      body:JSON.stringify({key:storageKey, text, voiceId}),
      signal:controller.signal
    });
  }finally{
    clearTimeout(timeoutId);
  }
  if(resp.status===429){ console.info("TTS limit reached, falling back to browser TTS"); ttsQuotaExhausted=true; return null; }
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
  const elCacheKey=getVoiceId()+"_"+cacheKey;
  try{
    // Retry once before giving up — a single timeout/drop on bad WiFi shouldn't
    // force an audible fallback to the browser's default voice.
    let url=await fetchTTSUrl(cacheKey, text);
    if(!url) url=await fetchTTSUrl(cacheKey, text);
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
    // elTTSCache never expires — if the underlying Storage file was deleted
    // and regenerated server-side (e.g. a voice-settings fix + cache purge,
    // as happened repeatedly while tuning TTS enthusiasm), the cached URL's
    // download token no longer matches and playback fails here. Without
    // evicting it, every future announcement for this exact key would keep
    // reusing the same broken URL and keep silently falling back to
    // undifferentiated browser TTS for the rest of the page's lifetime —
    // which reads as "the fix didn't work" even though the backend is fine.
    delete elTTSCache[elCacheKey];
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
 * @returns {Promise<boolean>} true if a URL was obtained (cached or freshly generated)
 */
export async function prewarmTTS(text, storageKey){
  const url=await fetchTTSUrl(storageKey, text).catch(()=>null);
  return !!url;
}

/**
 * Derives the announcement text and cache key for a turn score.
 * Shared by live announcements (speakScoreWithCustom) and prewarming so the
 * two can never fall out of sync (a mismatch here previously caused a
 * mis-cached clip to be served for unrelated scores).
 * @param {number} score
 * @param {boolean} hitBull true when turn included a Bull or Bull25 throw
 * @returns {{text:string, key:string}}
 */
function scoreAnnouncement(score, hitBull=false){
  const text=
    score===180?"One Hundred and Eighty!":
    score===100?"One Hundred!":
    score===50&&hitBull?"Bull's Eye!":
    numToWords(score)+"!";
  const key=
    score===50?`el_score_50_${hitBull?"bull":"norm"}`:
    score===180?"el_score_180b":
    `el_score_${score}`;
  return {text,key};
}

// 3-dart turn totals that cannot occur with any dart combination — skipped when prewarming.
const UNREACHABLE_SCORES=new Set([179,178,176,175,173,172,169,166,163]);

/**
 * Pre-warms TTS for every reachable turn score (1-180) so a first-ever hit
 * never has to live-generate audio mid-game.
 * Runs at most once per calendar day (persisted in localStorage) and
 * staggers requests with a small delay between each — firing ~180 requests
 * at once both saturates the connection pool (starving whatever live
 * announcement triggered this, e.g. the "Game on!" call right after) and can
 * burn through the entire daily per-user TTS quota in a single game start
 * while the cache is still cold. Stops early once the quota is confirmed
 * exhausted so it doesn't keep sending requests that can only fail.
 */
export function prewarmElevenLabs(){
  const today=new Date().toISOString().split("T")[0];
  if(localStorage.getItem("dart_prewarm_date")===today) return;
  localStorage.setItem("dart_prewarm_date", today);

  const jobs=[];
  for(let score=1;score<=180;score++){
    if(UNREACHABLE_SCORES.has(score)) continue;
    if(score===50){
      jobs.push(scoreAnnouncement(50,true), scoreAnnouncement(50,false));
      continue;
    }
    jobs.push(scoreAnnouncement(score));
  }
  jobs.push({text:"Bust!",key:"el_bust"});
  jobs.push({text:"No Score!",key:"el_no_score"});
  jobs.push({text:"Game on!",key:"el_game_on"});

  // Strictly sequential — the next job is only fired after the previous one's
  // response has fully settled, so at most 1 request to ElevenLabs is ever in
  // flight from this loop (well under their 6-concurrent-request cap). Each
  // failed job gets one backed-off retry before moving on, so a transient
  // 429/502 (e.g. a brief ElevenLabs concurrency spike) doesn't just drop the
  // clip from the cache for the rest of the day.
  let i=0;
  const step=()=>{
    if(ttsQuotaExhausted||i>=jobs.length) return;
    const job=jobs[i++];
    prewarmTTS(job.text,job.key).then(ok=>{
      if(ok||ttsQuotaExhausted){ setTimeout(step,250); return; }
      setTimeout(()=>{
        prewarmTTS(job.text,job.key).finally(()=>{ if(!ttsQuotaExhausted) setTimeout(step,250); });
      },1000);
    });
  };
  step();
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
  const plain=scoreAnnouncement(score,hitBull);
  const text=slangText??plain.text;
  const slangKey=slangText?`el_slang_${slangText.replace(/[\s!]/g,"_").toLowerCase()}`:null;
  const key=slangKey??plain.key;
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
 * Setting defaults to enabled (SETTING_DEFAULTS.checkout_announce=true in
 * app.js) but the toggle only ever writes localStorage on an explicit user
 * change — so this must default-on (skip only on an explicit "false"), not
 * default-off, or every user who never touched the toggle gets silence.
 * @param {number} remaining
 */
export async function announceCheckoutPath(remaining, customPath=null){
  if(localStorage.getItem("dart_checkout_announce")==="false") return;
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
