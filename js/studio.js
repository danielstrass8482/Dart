/**
 * studio.js — Voice Studio: recording and managing custom voice samples.
 */

import { voiceURLCache } from './audio.js';

let studioKeys=[];
let studioIdx=0;
let studioRecorded=new Set();
let studioMediaRecorder=null;
let studioChunks=[];
let studioBlob=null;
let studioAudioEl=null;
let studioStream=null;

/**
 * Returns all valid studio keys (score_0 through score_180 + bust).
 * @returns {Array<{key:string, label:string, hint:string}>}
 */
export function getAllStudioKeys(){
  const keys=[];
  for(let i=0;i<=180;i++) keys.push({key:`score_${i}`,label:`${i}`,hint:i===180?"Maximum!":i===0?"Daneben / Bust":""});
  keys.push({key:"bust",label:"BUST",hint:"Wenn zu viele Punkte"});
  return keys;
}

/** Initializes the studio UI. */
export async function initStudio(){
  if(!window.dartDB){ document.getElementById("studio-status").textContent="Datenbank nicht bereit"; return; }
  studioKeys=getAllStudioKeys();
  const existing=await window.dartDB.listVoiceSamples();
  studioRecorded=new Set(existing);
  Object.keys(voiceURLCache).forEach(k=>delete voiceURLCache[k]);
  renderStudioGrid();
  const firstMissing=studioKeys.findIndex(k=>!studioRecorded.has(k.key));
  selectStudioItem(firstMissing>=0?firstMissing:0);
}

/** Renders the studio grid of all keys. */
export function renderStudioGrid(){
  const grid=document.getElementById("studio-grid");
  const recorded=studioRecorded.size;
  const total=studioKeys.length;
  document.getElementById("studio-progress-bar").style.width=`${Math.round(recorded/total*100)}%`;
  document.getElementById("studio-progress-text").textContent=`${recorded} von ${total} aufgenommen`;

  grid.innerHTML=studioKeys.map((k,i)=>{
    const done=studioRecorded.has(k.key);
    const active=i===studioIdx;
    return `<button onclick="window._selectStudioItem(${i})" style="
      padding:8px 4px;border-radius:8px;border:2px solid ${active?"#e8c44a":done?"#2e7d32":"#eee"};
      background:${active?"#fffbea":done?"#f0fff4":"#fafafa"};
      font-family:'Bebas Neue',sans-serif;font-size:15px;
      color:${active?"#1a1a1a":done?"#2e7d32":"#bbb"};cursor:pointer;
      position:relative">
      ${k.label}
      ${done?'<span style="position:absolute;top:1px;right:3px;font-size:8px">✓</span>':""}
    </button>`;
  }).join("");
}

/**
 * Selects a studio item by index.
 * @param {number} idx
 */
export function selectStudioItem(idx){
  studioIdx=idx;
  studioBlob=null;
  studioChunks=[];
  const item=studioKeys[idx];
  if(!item) return;

  document.getElementById("studio-current-label").textContent=item.label;
  document.getElementById("studio-current-hint").textContent=item.hint||"";
  document.getElementById("studio-status").textContent="";
  document.getElementById("studio-play-btn").style.display="none";
  document.getElementById("studio-save-btn").style.display="none";
  document.getElementById("studio-rec-btn").disabled=false;
  document.getElementById("studio-rec-btn").textContent="⏺ Aufnehmen";
  document.getElementById("studio-rec-btn").style.background="var(--dart-danger)";

  const hasSample=studioRecorded.has(item.key);
  document.getElementById("studio-delete-btn").style.display=hasSample?"":"none";
  renderStudioGrid();
}

/** Gets or creates the studio audio stream. */
async function getStudioStream(){
  if(studioStream&&studioStream.active) return studioStream;
  studioStream=await navigator.mediaDevices.getUserMedia({audio:true});
  return studioStream;
}

/** Wires studio button event listeners. Call once at init. */
export function wireStudioButtons(){
  window._selectStudioItem = selectStudioItem;

  document.getElementById("studio-rec-btn").addEventListener("click",async()=>{
    const btn=document.getElementById("studio-rec-btn");
    if(studioMediaRecorder&&studioMediaRecorder.state==="recording"){
      studioMediaRecorder.stop(); return;
    }
    try{
      const stream=await getStudioStream();
      studioChunks=[];
      studioMediaRecorder=new MediaRecorder(stream,{mimeType:"audio/webm"});
      studioMediaRecorder.ondataavailable=e=>{ if(e.data.size>0) studioChunks.push(e.data); };
      studioMediaRecorder.onstop=()=>{
        studioBlob=new Blob(studioChunks,{type:"audio/webm"});
        const url=URL.createObjectURL(studioBlob);
        studioAudioEl=new Audio(url);
        btn.textContent="⏺ Nochmal"; btn.style.background="var(--dart-danger)";
        document.getElementById("studio-play-btn").style.display="";
        document.getElementById("studio-save-btn").style.display="";
        document.getElementById("studio-status").textContent="Aufnahme bereit — anhören oder speichern";
      };
      studioMediaRecorder.start();
      btn.textContent="⏹ Stop"; btn.style.background="var(--dart-bg-chip)";
      document.getElementById("studio-status").textContent="🔴 Aufnahme läuft…";
      document.getElementById("studio-play-btn").style.display="none";
      document.getElementById("studio-save-btn").style.display="none";
    }catch(e){
      document.getElementById("studio-status").textContent="Mikrofon-Fehler: "+e.message;
    }
  });

  document.getElementById("studio-play-btn").addEventListener("click",()=>{
    if(studioAudioEl){ studioAudioEl.currentTime=0; studioAudioEl.play(); }
  });

  document.getElementById("studio-save-btn").addEventListener("click",async()=>{
    if(!studioBlob) return;
    const item=studioKeys[studioIdx];
    document.getElementById("studio-status").textContent="Speichere…";
    document.getElementById("studio-save-btn").disabled=true;
    try{
      await window.dartDB.uploadVoiceSample(item.key, studioBlob);
      studioRecorded.add(item.key);
      delete voiceURLCache[item.key];
      document.getElementById("studio-status").textContent="✓ Gespeichert!";
      document.getElementById("studio-delete-btn").style.display="";
      document.getElementById("studio-save-btn").disabled=false;
      setTimeout(()=>{
        const next=studioKeys.findIndex((k,i)=>i>studioIdx&&!studioRecorded.has(k.key));
        selectStudioItem(next>=0?next:studioIdx);
      },600);
    }catch(e){
      document.getElementById("studio-status").textContent="Fehler: "+e.message;
      document.getElementById("studio-save-btn").disabled=false;
    }
  });

  document.getElementById("studio-skip-btn").addEventListener("click",()=>{
    const next=studioKeys.findIndex((k,i)=>i>studioIdx&&!studioRecorded.has(k.key));
    if(next>=0) selectStudioItem(next);
    else selectStudioItem((studioIdx+1)%studioKeys.length);
  });

  document.getElementById("studio-delete-btn").addEventListener("click",async()=>{
    const item=studioKeys[studioIdx];
    if(!confirm(`Aufnahme für "${item.label}" löschen?`)) return;
    await window.dartDB.deleteVoiceSample(item.key);
    studioRecorded.delete(item.key);
    delete voiceURLCache[item.key];
    document.getElementById("studio-delete-btn").style.display="none";
    document.getElementById("studio-status").textContent="Gelöscht";
    renderStudioGrid();
  });
}
