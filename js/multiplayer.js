/**
 * multiplayer.js — Online multiplayer: room creation, joining, state sync.
 */

import { state } from './state.js';
import { startX01, processX01Hit, advanceX01 } from './x01.js?v=2';
import { t } from './i18n.js?v=3';
import { showAlert } from './modal.js';

export let onlineMode="501", onlineLegs=1, onlineSets=1;
export let currentRoomCode=null, roomUnsubscribe=null;
export let isRoomHost=false, myOnlineName="";
export let onlineUnsubscribe=null, myPlayerIdx=0;

export function setOnlineMode(m){ onlineMode=m; }
export function setOnlineLegs(l){ onlineLegs=l; }
export function setOnlineSets(s){ onlineSets=s; }

/**
 * Creates an online room and shows the waiting screen.
 */
export async function createRoom(){
  if(!window.dartDB){ await showAlert(t('db_nicht_bereit')); return; }
  myOnlineName=document.getElementById("online-myname").value.trim()||"Host";
  try{
    document.getElementById("online-status").textContent=t('erstelle_raum');
    currentRoomCode=await window.dartDB.createRoom({
      mode:onlineMode, legs:onlineLegs, sets:onlineSets,
      host:myOnlineName, players:[myOnlineName], status:"waiting", state:null
    });
    isRoomHost=true;
    showWaitingScreen(currentRoomCode);
  }catch(e){ document.getElementById("online-status").textContent=t('fehler_prefix')+e.message; }
}

/**
 * Joins an existing room and shows the waiting screen.
 */
export async function joinRoom(){
  if(!window.dartDB){ await showAlert(t('db_nicht_bereit')); return; }
  const code=document.getElementById("online-room-code").value.trim().toUpperCase();
  myOnlineName=document.getElementById("online-join-name").value.trim()||t('gast_name');
  if(code.length!==6){ await showAlert(t('code_6_stellig')); return; }
  try{
    document.getElementById("online-status").textContent=t('verbinde');
    const room=await window.dartDB.joinRoom(code);
    if(room.status!=="waiting"){ await showAlert(t('raum_bereits_gestartet')); return; }
    currentRoomCode=code; isRoomHost=false;
    await window.dartDB.updateRoom(code,{players:[...room.players,myOnlineName]});
    showWaitingScreen(code);
  }catch(e){ document.getElementById("online-status").textContent=t('fehler_prefix')+e.message; }
}

/**
 * Shows the waiting screen and subscribes to room updates.
 * @param {string} code room code
 */
export function showWaitingScreen(code){
  window.showScreen("online-wait");
  document.getElementById("online-room-display").textContent=code;
  document.getElementById("online-status").textContent="";
  if(roomUnsubscribe){ roomUnsubscribe(); }
  roomUnsubscribe=window.dartDB.watchRoom(code,room=>{
    const list=document.getElementById("online-players-list");
    list.innerHTML=`<div style="font-size:11px;color:var(--dart-text-sec);letter-spacing:1px;margin-bottom:8px">${t('online_spieler_header')}</div>`+
      (room.players||[]).map((p,i)=>`<div style="padding:5px 0;font-size:15px;font-weight:${p===myOnlineName?700:400};color:${p===myOnlineName?"#e8c44a":"#333"}">
        ${i===0?"👑":"👤"} ${p}${p===myOnlineName?" "+t('du_suffix'):""}
      </div>`).join("");
    const startBtn=document.getElementById("btn-start-online");
    const waitStatus=document.getElementById("online-wait-status");
    if(isRoomHost&&(room.players||[]).length>=2){
      startBtn.style.display=""; waitStatus.textContent=t('spieler_bereit').replace('{n}',room.players.length);
    } else {
      startBtn.style.display="none";
      waitStatus.textContent=(room.players||[]).length===1?t('warte_mitspieler'):`${(room.players||[]).length} ${t('spieler_verbunden')}`;
    }
    if(!isRoomHost&&room.status==="started"&&room.config){
      const idx=(room.config.players||[]).indexOf(myOnlineName);
      startOnlineGame(room.config, idx>=0?idx:1);
    }
  });
}

/**
 * Starts the online game as host.
 */
export async function startOnlineGameAsHost(){
  if(!currentRoomCode) return;
  const room=await window.dartDB.joinRoom(currentRoomCode);
  const gameCfg={
    mode:onlineMode, startScore:onlineMode==="301"?301:501,
    players:room.players, playerIds:room.players.map(()=>null),
    isBot:room.players.map(()=>false), botLevel:"none",
    totalSets:onlineSets, setsToWin:Math.ceil(onlineSets/2), setWins:room.players.map(()=>0), currentSet:1,
    totalLegs:onlineLegs, legsToWin:Math.ceil(onlineLegs/2), legWins:room.players.map(()=>0), currentLeg:1,
    rounds:8, online:true, roomCode:currentRoomCode, hostName:myOnlineName
  };
  await window.dartDB.updateRoom(currentRoomCode,{status:"started",config:gameCfg,
    state:{scores:room.players.map(()=>gameCfg.startScore),current:0,round:1,lastThrow:null}});
  startOnlineGame(gameCfg,0);
}

/**
 * Starts an online game for a player.
 * @param {Object} gameCfg
 * @param {number} playerIdx
 */
export function startOnlineGame(gameCfg, playerIdx){
  if(roomUnsubscribe){ roomUnsubscribe(); roomUnsubscribe=null; }
  myPlayerIdx=playerIdx;
  Object.assign(state.cfg, gameCfg);
  startX01(0);
  if(onlineUnsubscribe){ onlineUnsubscribe(); }
  onlineUnsubscribe=window.dartDB.watchRoom(gameCfg.roomCode, room=>{
    if(!room.state||!room.state.lastThrow) return;
    const lt=room.state.lastThrow;
    if(lt.by===myOnlineName) return;
    if(state.x01.current===myPlayerIdx) return;
    applyRemoteThrow(lt);
  });
}

/**
 * Pushes a local throw to the online room.
 * @param {{score:number, label:string}} hit
 */
export async function pushThrowToRoom(hit){
  if(!state.cfg.online||!state.cfg.roomCode) return;
  try{
    await window.dartDB.updateRoom(state.cfg.roomCode,{"state.lastThrow":{...hit,by:myOnlineName,ts:Date.now()},"state.current":state.x01.current,"state.round":state.x01.round});
  }catch(e){}
}

/**
 * Applies a throw received from a remote player.
 * @param {{score:number, label:string}} hit
 */
export function applyRemoteThrow(hit){
  if(state.x01.winner||state.x01.bust||state.x01.throws.length>=3||state.x01.current===myPlayerIdx) return;
  state.x01.throws.push({...hit,svgX:null,svgY:null});
  state.x01.allThrows[state.x01.current].push({...hit,svgX:null,svgY:null});
  if(window._renderX01) window._renderX01();
  if(state.x01.throws.length===3) setTimeout(advanceX01,800);
}
