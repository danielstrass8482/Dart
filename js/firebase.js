/**
 * firebase.js — Firebase initialization, dartDB object, and auth helpers.
 * Sets window.dartDB, window.currentUser, window.fbAuth and auth functions.
 * Dispatches "dbReady" event on window when DB is initialized.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc,
         onSnapshot, deleteDoc as fsDeleteDoc, query, orderBy, limit, where }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth, signInAnonymously, GoogleAuthProvider, signInWithPopup, onAuthStateChanged,
         createUserWithEmailAndPassword, signInWithEmailAndPassword,
         sendPasswordResetEmail, updateProfile,
         EmailAuthProvider, linkWithCredential }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js";

const fbCfg = {
  apiKey: "AIzaSyBvTU5OhJnvJW-hYJYYVTro2rNcNr60aCk",
  authDomain: "fitness-tracker-c6f97.firebaseapp.com",
  projectId: "fitness-tracker-c6f97",
  storageBucket: "fitness-tracker-c6f97.firebasestorage.app"
};
const app     = initializeApp(fbCfg);
const db      = getFirestore(app);
const auth    = getAuth(app);
const storage = getStorage(app);
const gProvider = new GoogleAuthProvider();

// ── Auth state ────────────────────────────────────────────────────
window.currentUser = null;
window.fbAuth = auth;

// Local voices seed — Firestore is authoritative; this is the offline fallback
if(!localStorage.getItem("dart_voices")){
  localStorage.setItem("dart_voices", JSON.stringify([
    { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", builtin: true },
    { id: "itKfO3PIfQAXJTALxBD6", name: "Daniel", builtin: true },
  ]));
}

/**
 * Initializes window.dartDB with all Firestore/Storage operations.
 */
function initDartDB(){
  window.dartDB = {
    // Games
    async saveGame(data){ return addDoc(collection(db,"dart_games"), data); },
    async loadStats(){
      const snap = await getDocs(query(collection(db,"dart_games"), orderBy("ts","desc"), limit(200)));
      return snap.docs.map(d=>({id:d.id,...d.data()}));
    },
    // Players
    async loadPlayers(){
      const snap = await getDocs(query(collection(db,"dart_players"), orderBy("name")));
      const uid = auth.currentUser?.uid;
      return snap.docs
        .map(d=>({id:d.id,...d.data()}))
        .filter(p=>!p.userId || p.userId===uid);
    },
    async deletePlayer(playerId){
      return fsDeleteDoc(doc(db,"dart_players",playerId));
    },
    async savePlayer(name){
      const uid = auth.currentUser?.uid;
      const isAnon = auth.currentUser?.isAnonymous;
      const data = {
        name, createdAt:Date.now(),
        stats:{games:0,wins:0,avgPerTurn:0,checkoutPct:0,highscore:0}
      };
      if(uid && !isAnon) data.userId = uid;
      return addDoc(collection(db,"dart_players"), data);
    },
    async updatePlayerStats(playerId, stats){
      return updateDoc(doc(db,"dart_players",playerId), {stats});
    },
    async loadPlayerGames(playerId){
      const snap = await getDocs(query(collection(db,"dart_games"),
        where("playerIds","array-contains",playerId), orderBy("ts","desc"), limit(100)));
      return snap.docs.map(d=>({id:d.id,...d.data()}));
    },
    // Coach analyses
    async saveCoachAnalysis(data){
      return addDoc(collection(db,"dart_coach_analyses"), {...data, ts:Date.now()});
    },
    async loadCoachAnalyses(playerId){
      try{
        let snap;
        if(playerId){
          snap=await getDocs(query(collection(db,"dart_coach_analyses"),
            where("playerId","==",playerId), limit(20)));
        } else {
          snap=await getDocs(query(collection(db,"dart_coach_analyses"),
            orderBy("ts","desc"), limit(20)));
        }
        const results=snap.docs.map(d=>({id:d.id,...d.data()}));
        return results.sort((a,b)=>(b.ts||0)-(a.ts||0));
      }catch(e){ console.warn("loadCoachAnalyses:",e); return []; }
    },
    // Voice samples
    async uploadVoiceSample(key, blob){
      const r=ref(storage,`dart_voice/${key}.webm`);
      await uploadBytes(r, blob, {contentType:"audio/webm"});
      return getDownloadURL(r);
    },
    async getVoiceSampleURL(key){
      try{ return await getDownloadURL(ref(storage,`dart_voice/${key}.webm`)); }
      catch(e){ return null; }
    },
    async deleteVoiceSample(key){
      try{ await deleteObject(ref(storage,`dart_voice/${key}.webm`)); }catch(e){}
    },
    async listVoiceSamples(){
      try{
        const list=await listAll(ref(storage,"dart_voice"));
        return list.items.map(i=>i.name.replace(".webm",""));
      }catch(e){ return []; }
    },
    // ── Multiplayer rooms ────────────────────────────────────────
    async createRoom(roomData){
      const code=Math.random().toString(36).substring(2,8).toUpperCase();
      await setDoc(doc(db,"dart_rooms",code),{...roomData, code, createdAt:Date.now(), status:"waiting"});
      return code;
    },
    async joinRoom(code){
      const snap=await getDoc(doc(db,"dart_rooms",code));
      if(!snap.exists()) throw new Error("Raum nicht gefunden");
      return snap.data();
    },
    async updateRoom(code, data){
      return updateDoc(doc(db,"dart_rooms",code), data);
    },
    watchRoom(code, cb){
      return onSnapshot(doc(db,"dart_rooms",code), snap=>{
        if(snap.exists()) cb(snap.data());
      });
    },
    async deleteRoom(code){
      try{ await fsDeleteDoc(doc(db,"dart_rooms",code)); }catch(e){}
    },
    // Global voice list (shared across all devices)
    async loadGlobalVoices(){
      const snap=await getDoc(doc(db,"dart_config","voices"));
      return snap.exists() ? (snap.data().voices||null) : null;
    },
    async saveGlobalVoices(voices){
      await setDoc(doc(db,"dart_config","voices"),{voices});
    },
    async saveUserVoice(voiceId){
      const uid=auth.currentUser?.uid;
      if(!uid) return;
      await setDoc(doc(db,"dart_config",`userprefs_${uid}`),{activeVoiceId:voiceId},{merge:true});
    },
    async loadUserVoice(){
      const uid=auth.currentUser?.uid;
      if(!uid) return null;
      const snap=await getDoc(doc(db,"dart_config",`userprefs_${uid}`));
      return snap.exists() ? (snap.data().activeVoiceId||null) : null;
    },
    // ── Video sessions (Second Screen) ───────────────────────────
    async createVideoSession(code, data){
      await setDoc(doc(db,"dart_video_sessions",code), {...data, code, ts:Date.now(), status:"waiting"});
    },
    async updateVideoSession(code, data){
      return updateDoc(doc(db,"dart_video_sessions",code), data);
    },
    watchVideoSession(code, cb){
      return onSnapshot(doc(db,"dart_video_sessions",code), snap=>{
        if(snap.exists()) cb(snap.data());
      });
    },
    async deleteVideoSession(code){
      try{ await fsDeleteDoc(doc(db,"dart_video_sessions",code)); }catch(e){}
    },
    async uploadVideoBlob(code, blob){
      const r=ref(storage,`dart_video_sessions/${code}.webm`);
      await uploadBytes(r, blob, {contentType:"video/webm"});
      return getDownloadURL(r);
    },
    async getVideoSessionURL(code){
      try{ return await getDownloadURL(ref(storage,`dart_video_sessions/${code}.webm`)); }
      catch(e){ return null; }
    },
    // ── Tournaments ──────────────────────────────────────────────
    async saveTournament(data){
      if(data.id){
        await setDoc(doc(db,"dart_tournaments",data.id), data);
        return data.id;
      }
      const ref2=await addDoc(collection(db,"dart_tournaments"), {...data, createdAt:Date.now()});
      return ref2.id;
    },
    async updateTournament(id, data){
      return updateDoc(doc(db,"dart_tournaments",id), data);
    },
    async loadTournaments(){
      const snap=await getDocs(query(collection(db,"dart_tournaments"),orderBy("createdAt","desc"),limit(50)));
      return snap.docs.map(d=>({id:d.id,...d.data()}));
    },
    async getTournament(id){
      const snap=await getDoc(doc(db,"dart_tournaments",id));
      return snap.exists()?{id:snap.id,...snap.data()}:null;
    },
    watchTournament(id, cb){
      return onSnapshot(doc(db,"dart_tournaments",id), snap=>{
        if(snap.exists()) cb({id:snap.id,...snap.data()});
      });
    },
    // ── Premium / Beta-User ──────────────────────────────────────
    // Firestore rule: match /dart_users/{userId}/{document=**} {
    //   allow read, write: if request.auth != null
    //     && request.auth.uid == userId;
    // }
    async saveBetaUser(data){
      const ref = doc(db, "dart_users", data.uid);
      return setDoc(ref, {
        ...data,
        updatedAt: Date.now()
      }, { merge: true });
    },
    async getSubscription(uid){
      try{
        const snap = await getDoc(
          doc(db, "dart_users", uid, "subscription", "current")
        );
        return snap.exists() ? snap.data() : null;
      }catch(e){ return null; }
    },
    async saveSubscription(uid, data){
      return setDoc(
        doc(db, "dart_users", uid, "subscription", "current"),
        { ...data, updatedAt: Date.now() }
      );
    }
  };
  window.dispatchEvent(new Event("dbReady"));
}

// ── Auth helpers ─────────────────────────────────────────────────
let _googlePopupOpen = false;
window.signInWithGoogle = async function(){
  if(_googlePopupOpen) return;
  _googlePopupOpen = true;
  try{
    const result = await signInWithPopup(auth, gProvider);
    return result.user;
  }catch(e){
    if(e.code==="auth/popup-closed-by-user"||e.code==="auth/cancelled-popup-request") return;
    console.warn("Google sign-in failed:", e.message);
    throw e;
  }finally{
    _googlePopupOpen = false;
  }
};

window.signOutUser = async function(){
  await auth.signOut();
};

window.signInAsGuest = async function(){
  await signInAnonymously(auth);
};

window.emailSignIn = async function(email, password){
  return signInWithEmailAndPassword(auth, email, password);
};

window.emailRegister = async function(email, password, name){
  const user = auth.currentUser;
  if(user && user.isAnonymous){
    const cred = EmailAuthProvider.credential(email, password);
    const result = await linkWithCredential(user, cred);
    await updateProfile(result.user, {displayName: name});
    return result.user;
  }
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, {displayName: name});
  return result.user;
};

window.resetPassword = async function(email){
  await sendPasswordResetEmail(auth, email);
};

window.upgradeAnonymousAccount = async function(email, password, name){
  const cred = EmailAuthProvider.credential(email, password);
  const result = await linkWithCredential(auth.currentUser, cred);
  await updateProfile(result.user, {displayName: name});
  return result.user;
};

onAuthStateChanged(auth, user=>{
  window.currentUser = user;
  if(user){
    initDartDB();
    if(window.updateAuthUI) window.updateAuthUI(user);
    if(document.getElementById("setup")){
      const authScreen = document.getElementById("auth-screen");
      if(authScreen && authScreen.classList.contains("active")){
        if(window.showScreen) window.showScreen("setup");
        if(window.loadPlayers) window.loadPlayers();
      }
    }
  } else {
    const authScreen = document.getElementById("auth-screen");
    if(authScreen && window.showScreen) window.showScreen("auth-screen");
  }
});
