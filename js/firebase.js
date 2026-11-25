/**
 * firebase.js — Firebase initialization, dartDB object, and auth helpers.
 * Sets window.dartDB, window.currentUser, window.fbAuth and auth functions.
 * Dispatches "dbReady" event on window when DB is initialized.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc,
         onSnapshot, deleteDoc as fsDeleteDoc, query, orderBy, limit, where, startAfter }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth, signInAnonymously, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
         getRedirectResult, signInWithCredential, onAuthStateChanged,
         createUserWithEmailAndPassword, signInWithEmailAndPassword,
         sendPasswordResetEmail, sendEmailVerification, updateProfile,
         EmailAuthProvider, linkWithCredential, deleteUser, reauthenticateWithPopup }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js";
import { initializeAppCheck, CustomProvider, ReCaptchaV3Provider, getToken }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app-check.js";
import { loadAllGames, markGamesDirty, clearGamesCache, isStatsGame } from "./gamesCache.js";

const fbCfg = window.FIREBASE_CONFIG;
const app     = initializeApp(fbCfg);
const db      = getFirestore(app);
const auth    = getAuth(app);
auth.config.authDomain = "darttrainer-app-fed88.firebaseapp.com";
const storage = getStorage(app);
const gProvider = new GoogleAuthProvider();
const isNative = window.Capacitor?.isNativePlatform() === true;

// ── Firebase App Check ────────────────────────────────────────────────────────
// Android native (Capacitor): Play Integrity via the AppCheckBridge plugin
// (android/…/AppCheckBridgePlugin.java), legacy AndroidBridge interface as
// fallback. NEVER reCAPTCHA inside the app: its origin is https://localhost,
// which the reCAPTCHA key doesn't allow, so that could only ever fail.
// Web: reCAPTCHA v3 (window.FIREBASE_APP_CHECK_RECAPTCHA_KEY in index.html).
// The functions verify + count every token (functions/appCheckGate.js);
// enforcement is switched per function in Firestore dart_config/appcheck.
let _appCheck = null;
let _appCheckError = null;   // last token error (sent as X-DT-AppCheck-Error for diagnosis)
const nativeAppCheck = () => window.Capacitor?.Plugins?.AppCheckBridge;
function nativeTokenViaLegacyBridge() {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function waitForBridge() {
      if (window.AndroidBridge?.getAppCheckToken) {
        window._appCheckCallbacks = window._appCheckCallbacks || {};
        const cbId = Date.now().toString(36) + Math.random().toString(36).slice(2);
        window._appCheckCallbacks[cbId] = { resolve, reject };
        window.AndroidBridge.getAppCheckToken(cbId);
        setTimeout(() => {
          if (window._appCheckCallbacks[cbId]) { delete window._appCheckCallbacks[cbId]; reject(new Error("App Check token timeout")); }
        }, 10000);
      } else if (Date.now() - t0 < 5000) setTimeout(waitForBridge, 100);
      else reject(new Error("no native App Check bridge"));
    })();
  });
}
(function _initAppCheck() {
  if (isNative) {
    _appCheck = initializeAppCheck(app, {
      provider: new CustomProvider({
        getToken: async () => {
          const plugin = nativeAppCheck();
          const r = plugin ? await plugin.getToken({ forceRefresh: false }) : await nativeTokenViaLegacyBridge();
          return { token: r.token, expireTimeMillis: r.expireTimeMillis };
        }
      }),
      isTokenAutoRefreshEnabled: true
    });
  } else if (window.FIREBASE_APP_CHECK_RECAPTCHA_KEY) {
    _appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(window.FIREBASE_APP_CHECK_RECAPTCHA_KEY),
      isTokenAutoRefreshEnabled: true
    });
  }
})();

/**
 * Fetches the current Firebase App Check token, or null if App Check isn't
 * initialized or the token can't be obtained. Never throws — while
 * enforcement is off, callers attach the "X-Firebase-AppCheck" header when a
 * token is available and proceed without it otherwise.
 * @returns {Promise<string|null>}
 */
async function fetchAppCheckToken() {
  if (!_appCheck) { _appCheckError = isNative ? "not initialized" : "no reCAPTCHA key"; return null; }
  try {
    const { token } = await getToken(_appCheck, /* forceRefresh */ false);
    _appCheckError = null;
    return token || null;
  } catch (e) {
    _appCheckError = String(e?.message || e).slice(0, 200);
    console.warn("App Check token fetch failed:", _appCheckError);
    return null;
  }
}
window.getAppCheckToken = fetchAppCheckToken;

// "android/1.3.0 (13)" or "web" — lets the functions count tokens per
// platform even when a token is missing/invalid (functions/appCheckGate.js).
let _clientId = isNative ? "android" : "web";
if (isNative) {
  try { window.Capacitor?.Plugins?.App?.getInfo?.().then(i => { if (i?.version) _clientId = `android/${i.version} (${i.build})`; }).catch(() => {}); } catch (e) {}
}

/**
 * Headers for calls to our Cloud Functions: App Check token (if any), client
 * platform/version, and — if the token couldn't be fetched — the reason.
 * @returns {Promise<Record<string,string>>}
 */
window.appCheckHeaders = async function appCheckHeaders() {
  const h = { "X-DT-Client": _clientId };
  const tok = await fetchAppCheckToken();
  if (tok) h["X-Firebase-AppCheck"] = tok;
  else if (_appCheckError) h["X-DT-AppCheck-Error"] = _appCheckError.replace(/[^\x20-\x7e]/g, "?");
  return h;
};

// Measurement ping, at most once a day per device, a while after start-up.
const APPCHECK_PING_URL = "https://europe-west1-darttrainer-app-fed88.cloudfunctions.net/dartAppCheckPing";
setTimeout(async () => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem("dart_appcheck_ping") === today || !navigator.onLine) return;
    const headers = await window.appCheckHeaders();
    const r = await fetch(APPCHECK_PING_URL, { method: "POST", headers });
    if (r.ok) { localStorage.setItem("dart_appcheck_ping", today); window.__appCheckPing = await r.json(); }
  } catch (e) { /* offline etc. — next start */ }
}, 8000);

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
let _coopCache = null;
function initDartDB(){
  window.dartDB = {
    // Games
    async saveGame(data){
      const uid = auth.currentUser?.uid;
      if(uid) data.userId = uid;
      const r = await addDoc(collection(db,"dart_games"), data);
      markGamesDirty();
      return r;
    },
    /** Co-op Checkout games (js/coop.js) — own collection, deliberately NOT
     *  dart_games: everything that reads dart_games (stats, gamesCache, coach,
     *  player stats, older app versions) treats non-Cricket docs as X01 legs. */
    async saveCoopGame(data){
      const uid = auth.currentUser?.uid;
      if(uid) data.userId = uid;
      const r = await addDoc(collection(db,"dart_coop_games"), data);
      _coopCache = null;
      return r;
    },
    /** Newest co-op games (max. 100), cached for the session until the next save. */
    async loadCoopGames(){
      const uid = auth.currentUser?.uid;
      if(!uid) return [];
      if(_coopCache && _coopCache.uid===uid) return _coopCache.games;
      const snap = await getDocs(query(collection(db,"dart_coop_games"), where("userId","==",uid), orderBy("ts","desc"), limit(100)));
      const games = snap.docs.map(d=>({id:d.id,...d.data()}));
      _coopCache = {uid, games};
      return games;
    },
    /** ALL of the user's games (one doc per leg), newest first — see js/gamesCache.js
     *  for how this stays cheap (persistent cache + 7-day top-up). */
    async loadStats(){
      const uid = auth.currentUser?.uid;
      if(!uid) return [];
      const {games, info} = await loadAllGames({db, collection, query, where, orderBy, limit, startAfter, getDocs}, uid);
      const statsGames = games.filter(isStatsGame); // party/training docs from old app versions never count
      window.dartDB.lastStatsLoad = {...info, excluded: games.length - statsGames.length};
      return statsGames;
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
    // Pre-produced voice packages (fixed vocabulary) — see js/voiceClips.js
    async getVoicePkgURL(voiceId, key){
      try{ return await getDownloadURL(ref(storage,`dart_voice_pkg/${voiceId}/${key}.mp3`)); }
      catch(e){ return null; }
    },
    // e.g. "index.json" — the package's clip index with per-clip content hashes
    async getVoicePkgFileURL(voiceId, file){
      try{ return await getDownloadURL(ref(storage,`dart_voice_pkg/${voiceId}/${file}`)); }
      catch(e){ return null; }
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
  // Shared devices: don't leave this account's game list in IndexedDB.
  await clearGamesCache();
  await auth.signOut();
};

window.deleteUserAccount = async function(){
  const user = auth.currentUser;
  if(!user) throw new Error('not-authenticated');
  const uid = user.uid;

  async function deleteUserData(){
    const [games, players, analyses, coop] = await Promise.all([
      getDocs(query(collection(db,"dart_games"), where("userId","==",uid))),
      getDocs(query(collection(db,"dart_players"), where("userId","==",uid))),
      getDocs(query(collection(db,"dart_coach_analyses"), where("userId","==",uid))),
      getDocs(query(collection(db,"dart_coop_games"), where("userId","==",uid))).catch(()=>({forEach(){}})),
    ]);
    const dels = [];
    coop.forEach(d => dels.push(fsDeleteDoc(d.ref)));
    games.forEach(d => dels.push(fsDeleteDoc(d.ref)));
    players.forEach(d => dels.push(fsDeleteDoc(d.ref)));
    analyses.forEach(d => dels.push(fsDeleteDoc(d.ref)));
    dels.push(fsDeleteDoc(doc(db,"dart_users",uid,"subscription","current")).catch(()=>{}));
    dels.push(fsDeleteDoc(doc(db,"dart_users",uid)).catch(()=>{}));
    dels.push(fsDeleteDoc(doc(db,"dart_config",`userprefs_${uid}`)).catch(()=>{}));
    await Promise.all(dels);
  }

  // Firestore data must be deleted while still authenticated (rules require the
  // matching uid). Deletes are idempotent, so a reauth-retry re-runs them harmlessly.
  await deleteUserData();
  await clearGamesCache(uid);
  try{
    await deleteUser(user);
  }catch(e){
    // If the session is too old, reauthenticate and retry so we don't leave an
    // account behind with its data already gone.
    if(e.code === 'auth/requires-recent-login' &&
       user.providerData.some(p => p.providerId === 'google.com')){
      await reauthenticateWithPopup(user, gProvider);
      await deleteUserData();
      await deleteUser(user);
      return;
    }
    throw e; // email/password users fall back to the UI's re-login prompt
  }
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
