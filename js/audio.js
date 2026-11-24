/**
 * audio.js — Web Audio Engine, speech synthesis, and local pre-produced
 * voice-clip playback (+ ElevenLabs preview for the admin voice picker).
 */

import { state } from './state.js';
import { getCheckoutPath } from './checkout.js';
import { resolveClipURL, voiceKeyFor } from './voiceClips.js';

// ── Web Audio Engine ──────────────────────────────────────────────
const AudioCtx=window.AudioContext||window.webkitAudioContext;
let audioCtx=null;

/** @returns {AudioContext} */
export function getAudio(){ if(!audioCtx) audioCtx=new AudioCtx(); return audioCtx; }

// ── Number-to-words (used to build vocabulary text + display) ─────
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

// ── ElevenLabs / Google TTS (admin voice-picker preview only — NOT used by
// the gameplay audio queue below, which plays exclusively local clips) ───
export const elTTSCache={};
let currentAudio=null;
// Set by whichever playback path currently owns audio (local-clip playback
// in playAudioQueue, or the admin testVoice() preview) — calling it resolves
// that call's own promise immediately (not relying on pause()/ended firing,
// which isn't guaranteed) so an abort never leaves a caller's await hanging.
// See invalidateStaleAnnouncements() below.
let currentAbortPlayback=null;

// ── Audio Queue ───────────────────────────────────────────────────
// The single canonical entry point for every spoken announcement in the
// app. Every item plays from a LOCAL clip (bundled with the app, or
// downloaded once and cached in IndexedDB — see js/voiceClips.js) for the
// active voice; if no local clip is or can be made available (fully
// offline + a never-seen player name), that one item is silently skipped —
// this never falls back to a live ElevenLabs/dartTTS call or the browser
// voice. audioPlaying gates strict one-at-a-time playback: the next item
// only starts once the previous one has fully resolved, so calls fired in
// quick succession queue up in order instead of overlapping or dropping.
const audioQueue=[];
let audioPlaying=false;
let currentQueueItem=null;

async function playAudioQueue(){
  if(audioPlaying||audioQueue.length===0) return;
  // Drop anything that's already stale before ever starting it — no point
  // resolving/playing a clip for an announcement invalidateStaleAnnouncements()
  // already knows is wrong by the time we'd reach it.
  while(audioQueue.length && audioQueue[0].isStale?.()){
    audioQueue.shift().resolve?.();
  }
  if(audioQueue.length===0) return;
  audioPlaying=true;
  const item=audioQueue.shift();
  currentQueueItem=item;
  const {key,resolve,isName,rawName}=item;
  try{
    const voiceId=voiceKeyFor(getVoiceId());
    const url=await resolveClipURL(voiceId,key,{isName,rawName});
    if(url){
      await new Promise(res=>{
        if(currentAudio){ try{ currentAudio.pause(); }catch(e){} currentAudio=null; }
        currentAudio=new Audio(url);
        currentAudio.onended=res;
        currentAudio.onerror=res;
        // Lets invalidateStaleAnnouncements() cut this clip off mid-playback
        // instead of only being able to stop *future* queue items.
        currentAbortPlayback=()=>{ try{ currentAudio.pause(); }catch(e){} res(); };
        currentAudio.play().catch(res);
      });
    }
    // else: no local clip available for this key in the active voice (e.g.
    // offline and this exact name/clip was never cached) — skip silently.
  }catch(e){ console.warn("local clip playback:",key,e.message); }
  currentAbortPlayback=null;
  currentQueueItem=null;
  audioPlaying=false;
  if(resolve) resolve();
  setTimeout(playAudioQueue,80);
}

/**
 * Queues a spoken announcement, played from a local pre-produced clip.
 * @param {string} text human-readable label for this clip (not spoken directly — the real audio is the pre-produced clip matching `key`)
 * @param {string} key cache key — must match a key in data/vocabulary.json (or `name_<normalized>` for a player name)
 * @param {(()=>boolean)|null} [isStale] optional — checked right before this
 *   item would start playing (drops it silently if already stale) and again
 *   by invalidateStaleAnnouncements() while it's queued or actively playing.
 *   Omit for announcements that are always still accurate once queued (score
 *   confirmations, bust, game-on) — only state-snapshot announcements like a
 *   checkout path or "requires N" need this.
 * @param {string|null} [nameHint] pass the raw (un-normalized) player name
 *   when `key` is a name clip, so a cache-miss can fall through to the
 *   central on-demand name generator (functions/voiceName.js). Omit for
 *   every non-name clip.
 */
export function queueAudio(text,key,isStale=null,nameHint=null){
  if(localStorage.getItem("dart_tts_enabled")==="false") return Promise.resolve();
  return new Promise(resolve=>{
    audioQueue.push({text,key,resolve,isStale,isName:!!nameHint,rawName:nameHint||null});
    playAudioQueue();
  });
}

/**
 * Cancels queued/currently-playing announcements whose caller-supplied
 * isStale() now reports true — e.g. a checkout-path or "requires N"
 * announcement whose target player's remaining score has since changed
 * because a later turn already completed while the old announcement was
 * still queued or speaking. Fixes the "Daniel requires one hundred and
 * fifty-one" bug: previously such an announcement always played to the end
 * even after the game state had moved on past it, because the queue only
 * ever guaranteed *ordering*, never *relevance*. Queued items are dropped
 * silently; a currently-playing one is aborted mid-utterance via
 * currentAbortPlayback rather than left to finish.
 * Call this whenever a player's remaining score actually changes (see
 * advanceX01() in x01.js) — not on every throw, since state.x01.scores[i]
 * itself only changes at turn end, which is exactly when a
 * previously-scheduled announcement for that player can go stale.
 */
export function invalidateStaleAnnouncements(){
  for(let i=audioQueue.length-1;i>=0;i--){
    if(audioQueue[i].isStale?.()){
      audioQueue.splice(i,1)[0].resolve?.();
    }
  }
  if(currentQueueItem?.isStale?.() && currentAbortPlayback){
    currentAbortPlayback();
  }
}

export function clearAudioQueue(){
  audioQueue.length=0;
  audioPlaying=false;
  currentQueueItem=null;
  if(currentAbortPlayback){ try{ currentAbortPlayback(); }catch(e){} currentAbortPlayback=null; }
  if(currentAudio){ currentAudio.pause(); currentAudio.currentTime=0; currentAudio=null; }
}

const COACH_FUNCTION_URL="https://dartcoach-dxa2kmdyca-ew.a.run.app";
export const TTS_FUNCTION_URL="https://darttts-dxa2kmdyca-ew.a.run.app";

/** @returns {string} active ElevenLabs voice ID */
export function getVoiceId(){
  return localStorage.getItem("dart_active_voice_id")||"JBFqnCBsd6RMkjVDRZzb";
}

/**
 * Fetches a TTS audio URL from the cloud function (with caching).
 * Admin voice-picker preview ONLY — gameplay announcements never call this,
 * see the local-clip audio queue above.
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
  const headers={"Content-Type":"application/json","Authorization":"Bearer "+authToken,...(window.appCheckHeaders?await window.appCheckHeaders():{})};
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
  if(resp.status===429){ console.info("TTS limit reached"); return null; }
  if(resp.status===503){ console.info("TTS unavailable"); return null; }
  if(!resp.ok) return null;
  const {url}=await resp.json();
  if(url) elTTSCache[cacheKey]=url;
  return url||null;
}

/**
 * Plays a live ElevenLabs preview via the cloud function. Admin
 * voice-picker preview ONLY (testVoice() below) — not used in gameplay.
 * @param {string} text
 * @param {string} cacheKey
 * @returns {Promise<boolean>}
 */
export async function speakElevenLabs(text, cacheKey){
  try{
    let url=await fetchTTSUrl(cacheKey, text);
    if(!url) url=await fetchTTSUrl(cacheKey, text);
    if(!url) return false;
    if(currentAudio){ currentAudio.pause(); currentAudio.currentTime=0; currentAudio=null; }
    currentAudio=new Audio(url);
    await new Promise((res,rej)=>{
      currentAudio.onended=res;
      currentAudio.onerror=rej;
      currentAbortPlayback=()=>{ try{ currentAudio.pause(); }catch(e){} res(); };
      currentAudio.play().catch(rej);
    });
    return true;
  }catch(e){
    console.warn("Google TTS:",e.message);
    return false;
  }finally{
    currentAbortPlayback=null;
  }
}

/**
 * Tests a specific voice without changing the active voice (admin
 * voice-picker preview — live ElevenLabs call, independent of the
 * gameplay audio queue/local clips).
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
 * Derives the announcement text and cache key for a turn score.
 * Shared by live announcements (speakScoreWithCustom) and
 * scripts/build-vocabulary.js so they can never fall out of sync.
 * @param {number} score
 * @param {boolean} hitBull true when turn included an actual Bull (50) throw —
 *   NOT the outer bull (25, label "Bull 25"); only a real double-bull hit
 *   should ever announce "Bull's Eye!".
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
 * @param {boolean} hitBull true when turn included an actual Bull (50) throw
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
 * @param {number|null} [playerIdx] state.x01.scores index this path was
 *   computed for — when given, the announcement is dropped (queued) or cut
 *   off (already playing) as soon as that player's remaining score no longer
 *   matches `remaining`, i.e. their turn has since moved on. Omit only for
 *   callers with no notion of "the current player's turn" (none today).
 *
 * Always announces the STANDARD table path (never a per-player
 * preferred-doubles variant) — only the standard 162 checkout sentences are
 * pre-produced as local clips; the preferred-doubles feature remains a
 * visual-only aid on the board (see renderX01()/highlightCheckout()).
 */
export async function announceCheckoutPath(remaining, playerIdx=null){
  if(localStorage.getItem("dart_checkout_announce")==="false") return;
  const co=getCheckoutPath(remaining,3);
  if(!co) return;
  const readable=co.split(" ").map(partToReadable).join(", ");
  const cacheKey=`el_co_${remaining}`;
  const isStale=playerIdx==null?null:(()=>state.x01?.scores?.[playerIdx]!==remaining);
  await queueAudio("Checkout: "+readable+".", cacheKey, isStale);
}

/**
 * Speaks a keyed message via the audio queue.
 * @param {string} key
 * @param {string} fallbackText
 * @param {(()=>boolean)|null} [isStale] see queueAudio()
 */
export async function speakKeyWithCustom(key, fallbackText, isStale=null){
  await queueAudio(fallbackText,`el_${key}`,isStale);
}
