/**
 * bot.js — Bot engine: target selection, throw simulation, bot turn execution.
 */

import { state } from './state.js';
import { soundHit, soundBust, soundApplause, soundLow, speakKeyWithCustom, speakScoreWithCustom } from './audio.js';
import { SECTORS, R, clearCheckout, disableBoard, redrawAllHits } from './board.js';

export const BOT_ACCURACY={ easy:0.22, medium:0.52, pro:0.82 };

export const BOT_PERSONALITIES = {
  methodisch: {
    name: "🎯 Methodisch",
    description: "Spielt immer optimal und konstant",
    baseAccuracy: { easy: 0.22, medium: 0.52, pro: 0.82 },
    targetModifier: (remaining, opponentRemaining, target) => target,
    accuracyModifier: (base, remaining, opponentRemaining) => base
  },
  uebermuetig: {
    name: "💪 Übermütig",
    description: "Zielt immer auf T20, ignoriert bessere Optionen",
    baseAccuracy: { easy: 0.28, medium: 0.58, pro: 0.75 },
    targetModifier: (remaining, opponentRemaining, target) => {
      if(remaining > 32) return { num: 20, ring: "triple" };
      return target;
    },
    accuracyModifier: (base, remaining, opponentRemaining) => {
      return Math.random() < 0.3 ? base * 1.4 : base * 0.7;
    }
  },
  nervoese: {
    name: "😰 Nervös",
    description: "Verliert Konzentration wenn es drauf ankommt",
    baseAccuracy: { easy: 0.25, medium: 0.55, pro: 0.85 },
    accuracyModifier: (base, remaining, opponentRemaining) => {
      if(opponentRemaining <= 170) return base * 0.5;
      if(remaining <= 170) return base * 0.65;
      return base;
    }
  },
  gluecksspieler: {
    name: "🎰 Glücksspieler",
    description: "Zielt immer auf Maximum, riskiert Bust",
    baseAccuracy: { easy: 0.20, medium: 0.45, pro: 0.70 },
    targetModifier: (remaining, opponentRemaining, target) => {
      if(remaining <= 60 && remaining % 2 === 0)
        return { num: remaining/2, ring: "double" };
      return { num: 20, ring: "triple" };
    },
    accuracyModifier: (base) => {
      const roll = Math.random();
      if(roll < 0.2) return base * 2.0;
      if(roll < 0.5) return base * 0.4;
      return base;
    }
  },
  kaltbluetig: {
    name: "🧊 Kaltblütig",
    description: "Wird besser unter Druck",
    baseAccuracy: { easy: 0.18, medium: 0.45, pro: 0.75 },
    accuracyModifier: (base, remaining, opponentRemaining) => {
      if(opponentRemaining <= 170) return base * 1.5;
      if(remaining <= 170) return base * 1.3;
      return base;
    }
  },
  aufholer: {
    name: "📉 Aufholer",
    description: "Kämpft sich von hinten vor",
    baseAccuracy: { easy: 0.20, medium: 0.48, pro: 0.78 },
    accuracyModifier: (base, remaining, opponentRemaining) => {
      const diff = remaining - opponentRemaining;
      if(diff > 100) return base * 1.4;
      if(diff > 50) return base * 1.2;
      if(diff < -100) return base * 0.6;
      if(diff < -50) return base * 0.8;
      return base;
    }
  }
};

/**
 * Chooses optimal target for a bot given remaining score.
 * @param {number} remaining
 * @param {string} level easy|medium|pro
 * @returns {{num:number, ring:string}}
 */
export function botChooseTarget(remaining, level){
  const CHECKOUTS = window._CHECKOUTS;
  if(remaining<=170 && CHECKOUTS[remaining]){
    const parts=CHECKOUTS[remaining].split(" ");
    return parseTargetString(parts[0]);
  }
  if(level==="pro"){
    if(remaining===85||remaining===87||remaining===89||remaining===91||remaining===93||remaining===95)
      return {num:19,ring:"triple"};
    if(remaining>=62) return {num:20,ring:"triple"};
    if(remaining>=41) return {num:remaining<=60?Math.floor((remaining-1)/2):20,ring:"double"};
    return {num:remaining<=40?remaining/2:20,ring:"double"};
  }
  if(level==="medium"){
    if(remaining>=61) return {num:20,ring:"triple"};
    if(remaining>40)  return {num:20,ring:"single"};
    return {num:remaining/2,ring:"double"};
  }
  return {num:20,ring:"single"};
}

/**
 * Parses a checkout string segment into a target object.
 * @param {string} s e.g. "T20", "D16", "Bull"
 * @returns {{num:number, ring:string}}
 */
export function parseTargetString(s){
  if(s==="Bull"||s==="D25") return {num:25,ring:"bull"};
  if(s.startsWith("T")) return {num:parseInt(s.slice(1)),ring:"triple"};
  if(s.startsWith("D")) return {num:parseInt(s.slice(1)),ring:"double"};
  if(s.startsWith("S")) return {num:parseInt(s.slice(1)),ring:"single"};
  return {num:parseInt(s)||20,ring:"single"};
}

/**
 * Simulates a single bot throw.
 * @param {number} remaining
 * @param {string} level
 * @param {string} personality
 * @returns {{score:number, label:string, svgX:null, svgY:null}}
 */
export function botThrow(remaining, level, personality){
  const p = BOT_PERSONALITIES[personality] || BOT_PERSONALITIES.methodisch;
  const opponentIdx = state.cfg.players.findIndex((_,i) => i !== state.x01.current && !state.cfg.isBot?.[i]);
  const opponentRemaining = opponentIdx >= 0 ? state.x01.scores[opponentIdx] : 999;

  const baseAcc = (p.baseAccuracy?.[level]) ?? (BOT_ACCURACY[level] ?? 0.5);
  let target = botChooseTarget(remaining, level);
  if(p.targetModifier) target = p.targetModifier(remaining, opponentRemaining, target);
  const acc = p.accuracyModifier
    ? Math.min(0.95, Math.max(0.05, p.accuracyModifier(baseAcc, remaining, opponentRemaining)))
    : baseAcc;

  if(Math.random() < acc){
    return makeBotHit(target);
  }

  const missRand=Math.random();
  if(missRand<0.5){
    const idx=SECTORS.indexOf(target.num);
    const adj=SECTORS[(idx+(Math.random()<0.5?1:-1)+20)%20];
    return makeBotHit({num:adj,ring:target.ring==="triple"?"single":target.ring});
  } else if(missRand<0.75){
    const rings=["single","single","double","triple"];
    const ring=rings[Math.floor(Math.random()*rings.length)];
    return makeBotHit({num:target.num,ring});
  } else {
    return makeBotHit({num:SECTORS[Math.floor(Math.random()*20)],ring:"single"});
  }
}

/**
 * Creates a hit object from a target descriptor.
 * @param {{num:number, ring:string}} target
 * @returns {{score:number, label:string, svgX:null, svgY:null}}
 */
export function makeBotHit(target){
  const {num,ring}=target;
  if(ring==="bull")    return {score:50,label:"Bull",svgX:null,svgY:null};
  if(ring==="bull25")  return {score:25,label:"Bull 25",svgX:null,svgY:null};
  if(ring==="triple")  return {score:num*3,label:`T${num}`,svgX:null,svgY:null};
  if(ring==="double")  return {score:num*2,label:`D${num}`,svgX:null,svgY:null};
  return {score:num,label:`${num}`,svgX:null,svgY:null};
}

/**
 * Checks if throwing a score from remaining would bust.
 * @param {number} remaining
 * @param {number} throwScore
 * @returns {boolean}
 */
export function wouldBust(remaining, throwScore){
  const after=remaining-throwScore;
  return after<0||after===1;
}

/**
 * Generates a full bot turn (up to 3 throws), respecting bust rules.
 * @param {number} remaining
 * @param {string} level
 * @param {string} personality
 * @returns {Array}
 */
export function botTakeTurn(remaining, level, personality){
  const p = BOT_PERSONALITIES[personality] || BOT_PERSONALITIES.methodisch;
  const baseAcc = (p.baseAccuracy?.[level]) ?? (BOT_ACCURACY[level] ?? 0.5);
  const throws=[];
  let rem=remaining;
  for(let i=0;i<3;i++){
    const t=botThrow(rem,level,personality);
    const after=rem-t.score;
    if(after<0||after===1){
      if(rem<=40&&rem%2===0){
        const safeHit=makeBotHit({num:rem/2,ring:"double"});
        if(Math.random()<baseAcc){
          throws.push(safeHit); break;
        }
      }
      throws.push({score:0,label:"Miss",svgX:null,svgY:null,miss:true});
      break;
    }
    throws.push(t);
    rem=after;
    if(rem===0) break;
  }
  return throws;
}

/**
 * Animates a bot turn with realistic delays.
 * Calls window._renderX01, window._advanceX01, window._handleLegWin.
 */
export function runBotTurn(){
  const botIdx=state.x01.current;
  const level=state.cfg.botLevel||"medium";
  const personality=state.cfg.botPersonality||"methodisch";
  let rem=state.x01.scores[botIdx];

  disableBoard(state.boardSVG,true);

  const turns=botTakeTurn(rem,level,personality);
  let delay=600;

  turns.forEach((t,i)=>{
    setTimeout(()=>{
      state.x01.history.push({
        scores:[...state.x01.scores],current:state.x01.current,round:state.x01.round,
        throws:[...state.x01.throws],bust:state.x01.bust,
        historicLens:state.x01.historicThrows.map(a=>a.length),
        lastTurnThrows:state.x01.lastTurnThrows.map(a=>[...a]),
        turnScores:state.x01.turnScores.map(a=>[...a])
      });

      state.x01.throws.push(t);
      state.x01.allThrows[botIdx].push(t);
      soundHit();
      if(window._renderX01) window._renderX01();

      if(i===turns.length-1){
        const spent=state.x01.throws.reduce((s,t2)=>s+t2.score,0);
        const prevRem=state.x01.scores[botIdx];
        const newRem=prevRem-spent;

        setTimeout(()=>{
          if(newRem===0){
            state.x01.scores[botIdx]=0;
            state.x01.winner=botIdx;
            state.x01.checkoutHits[botIdx]++;
            state.x01.turnScores[botIdx].push(spent);
            soundApplause();
            speakScoreWithCustom(spent);
            if(window._handleLegWin) window._handleLegWin(botIdx);
            if(window._renderX01) window._renderX01();
          } else if(newRem>0){
            speakScoreWithCustom(spent);
            if(spent>=100) soundApplause();
            else if(spent<=9) soundLow();
            if(window._advanceX01) window._advanceX01();
          } else {
            state.x01.bust=true;
            soundBust(); speakKeyWithCustom("bust","Bust!");
            if(window._renderX01) window._renderX01();
            setTimeout(()=>{
              state.x01.history.push({scores:[...state.x01.scores],current:state.x01.current,round:state.x01.round,
                throws:[...state.x01.throws],bust:true,
                historicLens:state.x01.historicThrows.map(a=>a.length),
                lastTurnThrows:state.x01.lastTurnThrows.map(a=>[...a]),
                turnScores:state.x01.turnScores.map(a=>[...a])});
              state.x01.lastTurnThrows[botIdx]=[...state.x01.throws];
              state.x01.historicThrows[botIdx].push(...state.x01.throws.filter(t2=>t2.svgX!=null));
              state.x01.throws=[]; state.x01.bust=false;
              clearCheckout(state.boardSVG);
              const next=(botIdx+1)%state.cfg.players.length;
              state.x01.current=next;
              if(next===0) state.x01.round++;
              redrawAllHits(state.boardSVG,state.x01.historicThrows[next],[]);
              if(window._renderX01) window._renderX01();
              if(state.cfg.isBot?.[next]) setTimeout(runBotTurn,800);
            },1500);
          }
        },350);
      }
    },delay);
    delay+=550;
  });
}
