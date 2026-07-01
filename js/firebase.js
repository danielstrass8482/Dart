/**
 * firebase.js — Firebase initialization, dartDB object, and auth helpers.
 * Sets window.dartDB, window.currentUser, window.fbAuth and auth functions.
 * Dispatches "dbReady" event on window when DB is initialized.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc,
         onSnapshot, deleteDoc as fsDeleteDoc, query, orderBy, limit, where }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth, signInAnonymously, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
         getRedirectResult, signInWithCredential, onAuthStateChanged,
         createUserWithEmailAndPassword, signInWithEmailAndPassword,
         sendPasswordResetEmail, sendEmailVerification, updateProfile,
         EmailAuthProvider, linkWithCredential, deleteUser }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js";
import { initializeAppCheck, CustomProvider, ReCaptchaV3Provider }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app-check.js";

const fbCfg = window.FIREBASE_CONFIG;
const app     = initializeApp(fbCfg);
const db      = getFirestore(app);
const auth    = getAuth(app);
auth.config.authDomain = "darttrainer-app-fed88.firebaseapp.com";
const storage = getStorage(app);
const gProvider = new GoogleAuthProvider();
const isNative = window.Capacitor?.isNativePlatform() === true;

// ── Firebase App Check ────────────────────────────────────────────────────────
// Android native (Capacitor): bridged to Play Integrity via AndroidBridge
// Web (GitHub Pages): set window.FIREBASE_APP_CHECK_RECAPTCHA_KEY in index.html
// Enable enforcement in Firebase Console → App Check once all clients are updated.
(function _initAppCheck() {
  if (isNative && window.AndroidBridge?.getAppCheckToken) {
    window._appCheckCallbacks = {};
    initializeAppCheck(app, {
      provider: new CustomProvider({
        getToken: () => new Promise((resolve, reject) => {
          const cbId = Date.now().toString(36) + Math.random().toString(36).slice(2);
          window._appCheckCallbacks[cbId] = { resolve, reject };
          window.AndroidBridge.getAppCheckToken(cbId);
          setTimeout(() => {
            if (window._appCheckCallbacks[cbId]) {
              delete window._appCheckCallbacks[cbId];
              reject(new Error("App Check token timeout"));
            }
          }, 10000);
        })
      }),
      isTokenAutoRefreshEnabled: true
    });
  } else if (window.FIREBASE_APP_CHECK_RECAPTCHA_KEY) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(window.FIREBASE_APP_CHECK_RECAPTCHA_KEY),
      isTokenAutoRefreshEnabled: true
    });
  }
})();

// ── Auth state ────────────────────────────────────────────────────
window.currentUser = null;
window.fbAuth = auth;
// Flag set during registration/linking to suppress the unverified-user sign-out in onAuthStateChanged
let _registering = false;

// On Android: process redirect result after Google Sign-In redirect
if(isNative){
  getRedirectResult(auth).catch(e=>{
    if(e.code!=="auth/popup-closed-by-user"&&e.code!=="auth/cancelled-popup-request"){
      console.warn("Google redirect result error:", e.message);
    }
  });
}

// Clear stale localStorage voice data so BUILTIN_VOICES in app.js is authoritative
localStorage.removeItem("dart_voices");

/**
 * Initializes window.dartDB with all Firestore/Storage operations.
 */
function initDartDB(){
  window.dartDB = {
    // Games
    async saveGame(data){
      const uid = auth.currentUser?.uid;
      if(uid) data.userId = uid;
      return addDoc(collection(db,"dart_games"), data);
    },
    async loadStats(){
      const uid = auth.currentUser?.uid;
      if(!uid) return [];
      const snap = await getDocs(query(
        collection(db,"dart_games"),
        where("userId","==",uid),
        orderBy("ts","desc"),
        limit(200)
      ));
      return snap.docs.map(d=>({id:d.id,...d.data()}));
    },
    // Players
    async loadPlayers(){
      const uid = auth.currentUser?.uid;
      if(!uid) return [];
      const snap = await getDocs(query(
        collection(db,"dart_players"),
        where("userId","==",uid),
        orderBy("name")
      ));
      return snap.docs.map(d=>({id:d.id,...d.data()}));
    },
    async deletePlayer(playerId){
      return fsDeleteDoc(doc(db,"dart_players",playerId));
    },
    async savePlayer(name){
      const uid = auth.currentUser?.uid;
      const data = {
        name, createdAt:Date.now(),
        stats:{games:0,wins:0,avgPerTurn:0,checkoutPct:0,highscore:0}
      };
      if(uid) data.userId = uid;
      return addDoc(collection(db,"dart_players"), data);
    },
    async updatePlayerStats(playerId, stats){
      return updateDoc(doc(db,"dart_players",playerId), {stats});
    },
    async updatePlayerProfile(playerId, data){
      return updateDoc(doc(db,"dart_players",playerId), data);
    },
    async uploadPlayerPhoto(playerId, file){
      const r = ref(storage, `dart_photos/${playerId}.jpg`);
      await uploadBytes(r, file, {contentType: file.type||'image/jpeg'});
      return getDownloadURL(r);
    },
    async loadPlayerGames(playerId){
      const snap = await getDocs(query(collection(db,"dart_games"),
        where("playerIds","array-contains",playerId), orderBy("ts","desc"), limit(100)));
      return snap.docs.map(d=>({id:d.id,...d.data()}));
    },
    // Coach analyses
    async saveCoachAnalysis(data){
      const uid = auth.currentUser?.uid;
      return addDoc(collection(db,"dart_coach_analyses"), {
        ...data,
        ts: Date.now(),
        ...(uid ? { userId: uid } : {})
      });
    },
    async loadCoachAnalyses(playerId){
      const uid = auth.currentUser?.uid;
      if(!uid) return [];
      try{
        let snap;
        if(playerId){
          snap=await getDocs(query(collection(db,"dart_coach_analyses"),
            where("userId","==",uid),
            where("playerId","==",playerId),
            limit(20)));
        } else {
          snap=await getDocs(query(collection(db,"dart_coach_analyses"),
            where("userId","==",uid),
            orderBy("ts","desc"),
            limit(20)));
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
      if(!snap.exists()) throw new Error(window.t?.('raum_nicht_gefunden')||"Raum nicht gefunden");
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
    async getBetaPremium(uid){
      try{
        const snap = await getDoc(doc(db, "dart_users", uid));
        return snap.exists() ? snap.data() : null;
      }catch(e){ return null; }
    },
    async saveBetaPremium(uid){
      return setDoc(doc(db, "dart_users", uid), {
        betaPremium: true,
        betaPremiumAt: Date.now()
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

// ── Native Google Login Callback (called from Android via evaluateJavascript) ──
window._nativeGoogleLoginResult = async function(idToken, accessToken){
  try{
    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    const result = await signInWithCredential(auth, credential);
    if(window._nativeGoogleLoginResolve) window._nativeGoogleLoginResolve(result.user);
  }catch(e){
    if(window._nativeGoogleLoginReject) window._nativeGoogleLoginReject(e);
  }finally{
    window._nativeGoogleLoginResolve = null;
    window._nativeGoogleLoginReject = null;
  }
};

window._nativeGoogleLoginError = function(msg){
  if(window._nativeGoogleLoginReject) window._nativeGoogleLoginReject(new Error(msg));
  window._nativeGoogleLoginResolve = null;
  window._nativeGoogleLoginReject = null;
};

// ── Auth helpers ─────────────────────────────────────────────────
let _googlePopupOpen = false;
window.signInWithGoogle = async function(){
  if(navigator.userAgent.includes('DartTrainerApp') && window.AndroidBridge){
    return new Promise((resolve, reject) => {
      window._nativeGoogleLoginResolve = resolve;
      window._nativeGoogleLoginReject = reject;
      window.AndroidBridge.startNativeLogin();
    });
  }
  if(isNative){
    await signInWithRedirect(auth, gProvider);
    return;
  }
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

window.deleteUserAccount = async function(){
  const user = auth.currentUser;
  if(!user) throw new Error('not-authenticated');
  const uid = user.uid;
  const batches = [
    getDocs(query(collection(db,"dart_games"), where("userId","==",uid))),
    getDocs(query(collection(db,"dart_players"), where("userId","==",uid))),
    getDocs(query(collection(db,"dart_coach_analyses"), where("userId","==",uid))),
  ];
  const [games, players, analyses] = await Promise.all(batches);
  const dels = [];
  games.forEach(d => dels.push(fsDeleteDoc(d.ref)));
  players.forEach(d => dels.push(fsDeleteDoc(d.ref)));
  analyses.forEach(d => dels.push(fsDeleteDoc(d.ref)));
  dels.push(fsDeleteDoc(doc(db,"dart_users",uid,"subscription","current")).catch(()=>{}));
  dels.push(fsDeleteDoc(doc(db,"dart_users",uid)).catch(()=>{}));
  dels.push(fsDeleteDoc(doc(db,"dart_config",`userprefs_${uid}`)).catch(()=>{}));
  await Promise.all(dels);
  await deleteUser(user);
};

window.signInAsGuest = async function(){
  await signInAnonymously(auth);
};

window.emailSignIn = async function(email, password){
  const result = await signInWithEmailAndPassword(auth, email, password);
  if(!result.user.emailVerified){
    await auth.signOut();
    const err = new Error('email-not-verified');
    err.code = 'auth/email-not-verified';
    throw err;
  }
  return result;
};

window.emailRegister = async function(email, password, name){
  _registering = true;
  try {
    const user = auth.currentUser;
    if(user && user.isAnonymous){
      const cred = EmailAuthProvider.credential(email, password);
      const result = await linkWithCredential(user, cred);
      await updateProfile(result.user, {displayName: name});
      await sendEmailVerification(result.user);
      await auth.signOut();
      return null;
    }
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(result.user);
    await updateProfile(result.user, {displayName: name});
    await auth.signOut();
    return null;
  } finally {
    _registering = false;
  }
};

window.resetPassword = async function(email){
  await sendPasswordResetEmail(auth, email);
};

window.upgradeAnonymousAccount = async function(email, password, name){
  _registering = true;
  try {
    const cred = EmailAuthProvider.credential(email, password);
    const result = await linkWithCredential(auth.currentUser, cred);
    await updateProfile(result.user, {displayName: name});
    await sendEmailVerification(result.user);
    await auth.signOut();
    return null;
  } finally {
    _registering = false;
  }
};

function prewarmTTS(){
  fetch("https://darttts-dxa2kmdyca-ew.a.run.app",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({key:"__prewarm__",text:""}),
  }).catch(()=>{});
}

onAuthStateChanged(auth, user=>{
  // Unverified email/password users are never allowed into the app.
  // During registration the sign-out is skipped (sendEmailVerification still needs the session);
  // in all cases the rest of the handler is skipped so window.currentUser is never set to an
  // unverified user and no accidental navigation to setup occurs.
  if(user && !user.isAnonymous && !user.emailVerified &&
     user.providerData.some(p=>p.providerId==='password')){
    if(!_registering) auth.signOut();
    return;
  }
  (window.splashPromise || Promise.resolve()).then(()=>{
    // Clear all user-specific in-memory state before applying the new auth state.
    // This prevents stale player lists, game caches, and premium flags from
    // the previous session leaking into the next user's view.
    if(window._resetUserState) window._resetUserState();

    window.currentUser = user;
    if(user){
      const isFirstLogin = !localStorage.getItem('dart_was_logged_in');
      localStorage.setItem('dart_was_logged_in', '1');
      initDartDB();
      prewarmTTS();
      if(isFirstLogin) window.maybeShowBetaBanner?.();
      if(window.updateAuthUI) window.updateAuthUI(user);
      if(document.getElementById("setup")){
        const authScreen = document.getElementById("auth-screen");
        if(authScreen && authScreen.classList.contains("active")){
          if(window.showScreen) window.showScreen("setup");
        }
      }
      // Always reload players and re-render profil tab on sign-in regardless
      // of which screen was active — ensures new user's data is shown.
      if(window.loadPlayers) window.loadPlayers();
      if(window.initProfilTab) window.initProfilTab();
    } else {
      localStorage.removeItem('dart_was_logged_in');
      const authScreen = document.getElementById("auth-screen");
      if(authScreen && window.showScreen) window.showScreen("auth-screen");
    }
  });
});
