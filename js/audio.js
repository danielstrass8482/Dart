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
// iOS/iPadOS WebKit allows play() on a media element outside a user gesture
// only once THAT element has played inside one. Announcements start after
// awaits (IndexedDB, fetch) — long after the tap — so the queue plays every
// clip through one shared element that is unlocked here on the first tap
// (a fresh `new Audio()` per clip could be refused with NotAllowedError).
const SILENT_WAV="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
let queueEl=null;
function queueElement(){
  if(!queueEl){ queueEl=new Audio(); queueEl.preload="auto"; }
  return queueEl;
}
let audioUnlocked=false;
export async function unlockAudio(){
  if(audioUnlocked) return;
  audioUnlocked=true;
  try{
    const el=queueElement();
    if(!audioPlaying){ el.src=SILENT_WAV; const p=el.play(); if(p&&p.catch) p.catch(()=>{}); }
  }catch(e){}
  // iOS/iPadOS 16.4+: Web Audio plays like media elements (also with the
  // ring/silent switch on), see the audio queue below.
  try{ if(navigator.audioSession) navigator.audioSession.type="playback"; }catch(e){}
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
// app. Every clip plays from a LOCAL clip (bundled with the app, or
// downloaded once and cached in IndexedDB — see js/voiceClips.js) for the
// active voice; a clip that is or can't be made available is skipped (never
// a live ElevenLabs/dartTTS call or the browser voice).
//
// One queue item = one ANNOUNCEMENT, i.e. one or more clips that form a
// sentence ("Player 2" · "requires" · "121." · "Checkout: …"). Items play
// strictly one after another, in order.
//
// Gapless (2026-11-26): the clips carry ~50–110 ms of silence at the start
// and ~250–380 ms at the end, and starting each clip on the media element
// only after the previous one fired "ended" (+ lookup + load) added another
// ~100–300 ms — a sentence came out word by word. Now every clip of an
// announcement is fetched + decoded in parallel as soon as it is queued and
// scheduled back to back on the Web Audio clock, each trimmed to its audible
// part (−40 dBFS, small pads) — the files themselves are unchanged.
// Robust as before: a missing/corrupt/hanging clip is skipped with
// console.warn("voice clip skipped: <key> …") and the rest plays on; if the
// AudioContext can't run (not unlocked, interrupted, no Web Audio) the
// announcement falls back to the shared media element, clip by clip.
const audioQueue=[];
let audioPlaying=false;
let currentQueueItem=null;

// Watchdogs: one clip must never stall the queue (and with it every later
// announcement of the session) — e.g. a hanging IndexedDB/Storage request or
// a media element that never fires ended/error.
const RESOLVE_TIMEOUT_MS=8000;      // clip lookup (URL)
const DECODE_TIMEOUT_MS=4000;       // fetch + decodeAudioData
const SLOW_CLIP_GRACE_MS=1500;      // see playWebAudio()
const PLAY_START_TIMEOUT_MS=4000;   // until metadata/duration is known (element)
const PLAY_MAX_MS=15000;            // longest clip is ~5 s
const withTimeout=(p,ms,what)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(what+" timed out after "+ms+" ms")),ms))]);

// Trimming + spacing of the clips inside one announcement.
const TRIM_THRESHOLD=0.01;          // −40 dBFS
const TRIM_PAD_START=0.010;         // s kept before the first audible sample
const TRIM_PAD_END=0.040;           // s kept after the last one (soft word endings)
const CLIP_GAP=0.020;               // s inserted between two clips → audible gap ≈ 70 ms

/** Debug/test trace of every clip started (last 300) + idle probe. */
const voiceTrace=(window.__dtVoiceTrace=window.__dtVoiceTrace||[]);
window.__dtAudioIdle=()=>!audioPlaying&&audioQueue.length===0;
function trace(e){ voiceTrace.push({t:performance.now(),...e}); if(voiceTrace.length>300) voiceTrace.shift(); }

/** Plays one clip URL on the shared element; resolves when it ended, failed or was aborted — never hangs. */
function playClip(url,key,item){
  return new Promise(res=>{
    let done=false, timer=null;
    const el=queueElement();
    const finish=(why)=>{
      if(done) return; done=true; clearTimeout(timer);
      el.onended=el.onerror=el.onloadedmetadata=null;
      if(why) console.warn("voice clip skipped:",key,"-",why);
      res();
    };
    const arm=(ms,why)=>{ clearTimeout(timer); timer=setTimeout(()=>{ try{ el.pause(); }catch(e){} finish(why); },ms); };
    if(currentAudio&&currentAudio!==el){ try{ currentAudio.pause(); }catch(e){} }
    currentAudio=el;
    el.onended=()=>finish(null);
    el.onerror=()=>finish("media error "+(el.error?.code??"")+" "+(el.error?.message||""));
    el.onloadedmetadata=()=>{ const d=el.duration; if(isFinite(d)&&d>0) arm(Math.min(PLAY_MAX_MS,d*1000+2500),"playback did not end"); };
    if(item) item.abortPlayback=()=>{ try{ el.pause(); }catch(e){} finish(null); };
    arm(PLAY_START_TIMEOUT_MS+PLAY_MAX_MS,"playback did not end");
    try{
      el.src=url;
      trace({key,mode:"element",url});
      const p=el.play();
      if(p&&p.catch) p.catch(e=>finish("play() rejected: "+(e?.name||"")+" "+(e?.message||"")));
    }catch(e){ finish("play() threw: "+e.message); }
  });
}

// Decoded clips by URL (URLs carry the content hash → a new take = a new
// entry). Small LRU: one decoded clip is ~0.1–1 MB.
const decodedCache=new Map();
const DECODED_MAX=80;
function audibleRange(buf){
  const d=buf.getChannelData(0), n=d.length;
  let a=0, b=n-1;
  while(a<n&&Math.abs(d[a])<TRIM_THRESHOLD) a++;
  while(b>a&&Math.abs(d[b])<TRIM_THRESHOLD) b--;
  if(a>=n) return {start:0,end:buf.duration,cs:0,ce:buf.duration};     // all quiet: play as is
  const sr=buf.sampleRate, cs=a/sr, ce=(b+1)/sr;
  return {start:Math.max(0,cs-TRIM_PAD_START), end:Math.min(buf.duration,ce+TRIM_PAD_END), cs, ce};
}
async function decodeClip(ctx,url){
  const hit=decodedCache.get(url);
  if(hit){ decodedCache.delete(url); decodedCache.set(url,hit); return hit; }
  const p=(async()=>{
    const r=await fetch(url);
    if(!r.ok) throw new Error("HTTP "+r.status);
    const ab=await r.arrayBuffer();
    const buf=await new Promise((res,rej)=>{ const q=ctx.decodeAudioData(ab,res,e=>rej(e||new Error("decode failed"))); if(q&&q.then) q.then(res,rej); });
    return {buf,...audibleRange(buf)};
  })();
  decodedCache.set(url,p);
  p.catch(()=>decodedCache.delete(url));
  while(decodedCache.size>DECODED_MAX) decodedCache.delete(decodedCache.keys().next().value);
  return p;
}

let masterGain=null;
function audioOut(ctx){
  if(!masterGain||masterGain.context!==ctx){ masterGain=ctx.createGain(); masterGain.connect(ctx.destination); window.__dtAudio={ctx,master:masterGain}; }
  return masterGain;
}

/** Web Audio usable right now? Tries resume() once (≤ 400 ms). */
async function webAudioReady(){
  if(!AudioCtx) return null;
  try{ if(localStorage.getItem("dart_audio_engine")==="element") return null; }catch(e){}
  let ctx;
  try{ ctx=getAudio(); }catch(e){ return null; }
  if(ctx.state!=="running"){ try{ await withTimeout(ctx.resume(),400,"resume"); }catch(e){} }
  return ctx.state==="running"?ctx:null;
}

/** Plays one announcement via Web Audio, gapless. Returns false if it was aborted. */
async function playWebAudio(ctx,item,loads){
  const out=audioOut(ctx);
  const sources=[];
  let aborted=false, wake=null;
  item.abortPlayback=()=>{ aborted=true; for(const s of sources){ try{ s.stop(); }catch(e){} } wake?.(); };
  let nextT=0, endT=0;
  for(let i=0;i<item.parts.length;i++){
    const {key}=item.parts[i];
    let clip;
    // A clip that is still loading while the REST of the sentence is ready
    // gets 1.5 s more, then it is skipped (a hanging lookup must not hold the
    // whole sentence for the full lookup timeout). Last clip: full timeout.
    const later=loads.slice(i+1);
    const grace=later.length?Promise.all(later.map(p=>p.then(()=>1,()=>1))).then(()=>new Promise((_,rej)=>setTimeout(()=>rej(new Error("still loading 1.5 s after the rest of the announcement was ready")),SLOW_CLIP_GRACE_MS))):null;
    try{ clip=await Promise.race([loads[i],item.abortP,...(grace?[grace]:[])]); }catch(e){ console.warn("voice clip skipped:",key,"(voice "+item.voiceId+") -",e.message); continue; }
    if(aborted||item.isStale?.()){ item.abortPlayback(); return false; }
    if(!clip) continue;
    const dur=clip.end-clip.start;
    const when=Math.max(nextT,ctx.currentTime+0.03);
    const src=ctx.createBufferSource();
    src.buffer=clip.buf; src.connect(out);
    src.start(when,clip.start,dur);
    sources.push(src);
    trace({key,mode:"webaudio",url:clip.url,when,offset:clip.start,dur,cs:clip.cs,ce:clip.ce});
    nextT=when+dur+CLIP_GAP; endT=when+dur;
  }
  if(!sources.length) return !aborted;
  // Wait for the scheduled end on the audio clock; wall-clock watchdog in
  // case the context gets suspended/interrupted mid-announcement.
  const deadline=performance.now()+(endT-ctx.currentTime)*1000+2500;
  while(!aborted&&ctx.currentTime<endT){
    if(performance.now()>deadline){ console.warn("voice clip skipped:",item.parts.map(p=>p.key).join("+"),"- audio clock stalled ("+ctx.state+")"); item.abortPlayback(); break; }
    await new Promise(r=>{ wake=r; setTimeout(r,Math.max(20,Math.min(250,(endT-ctx.currentTime)*1000+15))); });
  }
  return !aborted;
}

async function playAudioQueue(){
  if(audioPlaying||audioQueue.length===0) return;
  // Drop anything that's already stale before ever starting it.
  while(audioQueue.length && audioQueue[0].isStale?.()){
    audioQueue.shift().resolve?.({completed:false});
  }
  if(audioQueue.length===0) return;
  audioPlaying=true;
  const item=audioQueue.shift();
  currentQueueItem=item;
  let completed=false;
  try{
    item.voiceId=item.voiceId||voiceKeyFor(getVoiceId());
    const urls=item.urls||startLookups(item);
    const ctx=await webAudioReady();
    if(ctx&&!item.aborted){
      const loads=urls.map((u,i)=>u.then(url=>{
        if(!url) throw new Error("not available for voice "+item.voiceId);
        return withTimeout(decodeClip(ctx,url),DECODE_TIMEOUT_MS,"decode").then(c=>({...c,url}));
      }));
      loads.forEach(p=>p.catch(()=>{}));
      completed=await playWebAudio(ctx,item,loads);
    } else if(!item.aborted){
      // Fallback: shared media element, clip by clip (old path).
      completed=true;
      for(let i=0;i<item.parts.length;i++){
        if(item.aborted||item.isStale?.()){ completed=false; break; }
        const {key}=item.parts[i];
        try{
          const url=await Promise.race([urls[i],item.abortP]);
          if(item.aborted){ completed=false; break; }
          if(!url){ console.warn("voice clip skipped:",key,"- not available for voice",item.voiceId); continue; }
          if(item.aborted||item.isStale?.()){ completed=false; break; }
          await playClip(url,key,item);
        }catch(e){ console.warn("voice clip skipped:",key,"(voice "+item.voiceId+") -",e.message); }
      }
      if(item.aborted) completed=false;
    }
  }catch(e){ console.warn("voice announcement failed:",item.parts.map(p=>p.key).join("+"),"-",e.message); }
  if(item.aborted) completed=false;
  currentQueueItem=null;
  audioPlaying=false;
  item.resolve?.({completed});
  setTimeout(playAudioQueue,20);
}

/** Starts the URL lookups of all clips of an announcement (in parallel, each with a timeout). */
function startLookups(item){
  item.voiceId=item.voiceId||voiceKeyFor(getVoiceId());
  item.urls=item.parts.map(({key})=>withTimeout(resolveClipURL(item.voiceId,key),RESOLVE_TIMEOUT_MS,"clip lookup"));
  item.urls.forEach(p=>p.catch(()=>{}));
  return item.urls;
}

/**
 * Queues one announcement made of one or more pre-produced clips that are
 * played as one sentence.
 * @param {Array<{text:string,key:string}>} parts clips in order (`text` is a label only; `key` must exist in data/vocabulary.json)
 * @param {(()=>boolean)|null} [isStale] checked before the item starts and by
 *   invalidateStaleAnnouncements() while it is queued or playing — only
 *   state-snapshot announcements ("requires N", checkout path) need it.
 * @returns {Promise<{completed:boolean}>} completed=false when it was dropped,
 *   cut off (stale / Undo) or TTS is off — the caller must then not treat it as "said".
 */
export function queueAnnouncement(parts,isStale=null){
  if(localStorage.getItem("dart_tts_enabled")==="false") return Promise.resolve({completed:false});
  return new Promise(resolve=>{
    const item={parts,resolve,isStale,aborted:false};
    item.abortP=new Promise(r=>{ item.abortResolve=r; });
    try{ startLookups(item); }catch(e){}
    audioQueue.push(item);
    playAudioQueue();
  });
}

/**
 * Queues a single-clip announcement (see queueAnnouncement()).
 * @param {string} text human-readable label for this clip
 * @param {string} key cache key — must match a key in data/vocabulary.json
 * @param {(()=>boolean)|null} [isStale]
 */
export function queueAudio(text,key,isStale=null){
  return queueAnnouncement([{text,key}],isStale);
}

/**
 * Cancels queued/currently-playing announcements whose caller-supplied
 * isStale() now reports true — e.g. a checkout-path or "requires N"
 * announcement whose target player's remaining score has since changed.
 * Queued items are dropped; a playing one is cut off mid-utterance.
 * Call this whenever a player's remaining score actually changes (see
 * advanceX01() in x01.js).
 */
export function invalidateStaleAnnouncements(){
  for(let i=audioQueue.length-1;i>=0;i--){
    if(audioQueue[i].isStale?.()){
      audioQueue.splice(i,1)[0].resolve?.({completed:false});
    }
  }
  if(currentQueueItem?.isStale?.()) abortItem(currentQueueItem);
}

function abortItem(item){
  item.aborted=true;
  item.abortResolve?.(null);
  try{ item.abortPlayback?.(); }catch(e){}
}

/** Stops everything (Undo, new game): the playing announcement is cut off, queued ones are dropped — all resolve with completed:false. */
export function clearAudioQueue(){
  const dropped=audioQueue.splice(0);
  for(const it of dropped) it.resolve?.({completed:false});
  if(currentQueueItem) abortItem(currentQueueItem);
  if(currentAbortPlayback){ try{ currentAbortPlayback(); }catch(e){} currentAbortPlayback=null; }
  if(currentAudio){ try{ currentAudio.pause(); currentAudio.currentTime=0; }catch(e){} }
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
// 140 with slang on is announced like the plain 140 score (2026-11-24, the old
// slang phrase was misheard). Its clip keeps the historic key, so the key can't
// be derived from the text — see "el_slang_ton_forty_" in scripts/build-vocabulary.js.
const SLANG_140_TEXT="One hundred, and forty!";
const SLANG_KEY_OVERRIDE={[SLANG_140_TEXT]:"el_slang_ton_forty_"};

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
  if(score===140) return SLANG_140_TEXT;
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
  const slangKey=slangText?(SLANG_KEY_OVERRIDE[slangText]??`el_slang_${slangText.replace(/[\s!]/g,"_").toLowerCase()}`):null;
  const key=slangKey??plain.key;
  await queueAudio(text,key);
}

function partToReadable(part){
  if(part==="Bull"||part==="D25") return "Bullseye";
  if(part==="D25") return "Double Bull";
  const isT=part.startsWith("T"), isD=part.startsWith("D");
  const n=parseInt(part.replace(/[TDS]/,""));
  return (isT?"Triple ":isD?"Double ":"") + numToWords(n);
}

/**
 * The spoken checkout path for a turn start at `remaining` as one clip part
 * ({text,key} for queueAnnouncement()), or null when there is none or the
 * user switched the path announcement off. Setting defaults to enabled — skip
 * only on an explicit "false".
 *
 * Always the STANDARD turn-start path (getCheckoutPath(remaining,3), the same
 * one the board shows at turn start) — only those 162 sentences exist as
 * clips (el_co_<remaining>); a per-player preferred-doubles path stays
 * visual-only.
 * @param {number} remaining
 * @returns {{text:string,key:string}|null}
 */
export function checkoutPathPart(remaining){
  if(localStorage.getItem("dart_checkout_announce")==="false") return null;
  const co=getCheckoutPath(remaining,3);
  if(!co) return null;
  return {text:"Checkout: "+co.split(" ").map(partToReadable).join(", ")+".", key:`el_co_${remaining}`};
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
