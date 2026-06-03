/**
 * audio.js — Web Audio Engine, speech synthesis, and ElevenLabs/Google TTS.
 */

import { state } from './state.js';

// ── Web Audio Engine ──────────────────────────────────────────────
const AudioCtx=window.AudioContext||window.webkitAudioContext;
let audioCtx=null;

/** @returns {AudioContext} */
export function getAudio(){ if(!audioCtx) audioCtx=new AudioCtx(); return audioCtx; }

/**
 * @param {number} freq
 * @param {string} type oscillator type
 * @param {number} duration seconds
 * @param {number} vol volume
 * @param {number} delay seconds
 */
export function playTone(freq,type,duration,vol=0.3,delay=0){
  try{
    const ctx=getAudio();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type=type; osc.frequency.setValueAtTime(freq,ctx.currentTime+delay);
    gain.gain.setValueAtTime(vol,ctx.currentTime+delay);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+duration);
    osc.start(ctx.currentTime+delay);
    osc.stop(ctx.currentTime+delay+duration);
  }catch(e){}
}

/** Plays a sad descending tone for bust. */
export function soundBust(){
  try{
    const ctx=getAudio();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type="sine";
    osc.frequency.setValueAtTime(280,ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(160,ctx.currentTime+0.8);
    gain.gain.setValueAtTime(0.25,ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15,ctx.currentTime+0.6);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.9);
    osc.start(); osc.stop(ctx.currentTime+0.9);
  }catch(e){}
}

/** Plays a single sad low note for low score. */
export function soundLow(){
  try{
    const ctx=getAudio();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type="sine";
    osc.frequency.setValueAtTime(220,ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(180,ctx.currentTime+0.5);
    gain.gain.setValueAtTime(0.2,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.6);
    osc.start(); osc.stop(ctx.currentTime+0.6);
  }catch(e){}
}

/** Crowd noise simulation for big scores / checkout. */
export function soundApplause(){
  try{
    const ctx=getAudio();
    const buf=ctx.createBuffer(1,ctx.sampleRate*1.5,ctx.sampleRate);
    const data=buf.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*0.5;
    const src=ctx.createBufferSource();
    src.buffer=buf;
    const filter=ctx.createBiquadFilter();
    filter.type="bandpass"; filter.frequency.value=1200; filter.Q.value=0.8;
    const gain=ctx.createGain();
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0,ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4,ctx.currentTime+0.2);
    gain.gain.linearRampToValueAtTime(0.3,ctx.currentTime+0.8);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+1.5);
    src.start(); src.stop(ctx.currentTime+1.5);
    [523,659,784,1047].forEach((f,i)=>playTone(f,"square",0.15,0.12,i*0.1));
  }catch(e){}
}

/** Short satisfying click for a hit. */
export function soundHit(){
  playTone(600,"square",0.05,0.08);
}

/** Rising ding for checkout opportunity. */
export function soundCheckout(){
  [440,554,659].forEach((f,i)=>playTone(f,"sine",0.2,0.12,i*0.08));
}

// ── Speech ────────────────────────────────────────────────────────
const ONES=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
  "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
  "Seventeen","Eighteen","Nineteen"];
const TENS=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

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
  if(localStorage.getItem("dart_tts_enabled")==="false") return;
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
  else{ speechSynthesis.addEventListener("voiceschanged",trySpeak,{once:true}); }
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

const COACH_FUNCTION_URL="https://europe-west1-fitness-tracker-c6f97.cloudfunctions.net/dartCoach";
export const TTS_FUNCTION_URL="https://europe-west1-fitness-tracker-c6f97.cloudfunctions.net/dartTTS";

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
  const resp=await fetch(TTS_FUNCTION_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+authToken},
    body:JSON.stringify({key:storageKey, text, voiceId})
  });
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
    if(currentAudio){ currentAudio.pause(); currentAudio.currentTime=0; }
    currentAudio=new Audio(url);
    await currentAudio.play();
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
    [180,"One Hundred and Eighty!"],[171,"One Hundred and Seventy One!"],
    [167,"One Hundred and Sixty Seven!"],[160,"One Hundred and Sixty!"],
    [140,"One Hundred and Forty!"],[121,null],[100,"One Hundred!"],
    [81,null],[60,null],[45,"Forty Five!"],[41,null],[26,"Bed and Breakfast!"],
    [0,"No Score!"]
  ];
  for(const [score,override] of scoreKeys){
    const key=`el_score_${score}`;
    const text=override??(score===50?"Bull's Eye!":numToWords(score)+"!");
    prewarmTTS(text, key);
  }
  prewarmTTS("Bust!", "el_bust");
  prewarmTTS("No Score!", "el_no_score");
  prewarmTTS("Game On!", "el_game_on");
}

/**
 * Speaks a score with TTS fallback chain: Google TTS → Web Speech.
 * @param {number} score
 */
export async function speakScoreWithCustom(score){
  if(localStorage.getItem("dart_tts_enabled")==="false") return;
  const key=`score_${score}`;
  const text=score===180?"One Hundred and Eighty!":score===100?"One Hundred!":
             score===50?"Bull's Eye!":numToWords(score)+"!";
  const played=await speakElevenLabs(text,`el_${key}`);
  if(!played) speakScore(score);
}

/**
 * Speaks a keyed message with TTS fallback chain.
 * @param {string} key
 * @param {string} fallbackText
 */
export async function speakKeyWithCustom(key, fallbackText){
  if(localStorage.getItem("dart_tts_enabled")==="false") return;
  const played=await speakElevenLabs(fallbackText,`el_${key}`);
  if(!played) speak(fallbackText);
}
