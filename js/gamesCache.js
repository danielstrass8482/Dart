/**
 * gamesCache.js — All of a user's dart_games (one doc per leg), loaded
 * completely but read from Firestore as rarely as possible.
 *
 * Why: the statistics, the trend chart/sessions, the coach prompts and the
 * player-profile stats all work on the user's full game list. Loading it with
 * limit(200) silently cut "Alles" off at the last 200 legs; loading everything
 * on every stats click / every saved leg would cost N reads each time.
 *
 * How (reads per call):
 *  - first load on a device: every leg, paged 500 at a time         → N reads
 *  - later loads: persistent copy (IndexedDB, per uid) + top-up query
 *    for ts ≥ newest cached − 7 days (overlap catches other devices'
 *    clock skew and late-synced offline saves)                       → legs of the last 7 days (min. 1)
 *  - again within FRESH_MS in the same session, nothing saved since  → 0 reads
 *  - full re-sync if the persisted copy is older than 30 days, so a leg
 *    that slipped past the overlap window can't stay missing forever
 * Games are append-only in the app (no edit/delete except deleting the whole
 * account, which clears the cache), so merging by doc id is sufficient.
 */

const DB_NAME = "dt-games-cache";
const STORE = "byUid";
const PAGE = 500;
const OVERLAP_MS = 7 * 86400000;
const FULL_RESYNC_MS = 30 * 86400000;
const FRESH_MS = 30000;

let mem = null;          // { uid, byId: Map, maxTs, fullSyncAt, syncedAt }
let dirty = false;       // a game was saved since the last sync

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(uid) {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const r = db.transaction(STORE).objectStore(STORE).get(uid);
      r.onsuccess = () => res(r.result || null); r.onerror = () => res(null);
    });
  } catch (e) { return null; }
}
async function idbPut(uid, val) {
  try {
    const db = await idb();
    await new Promise((res) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(val, uid);
      tx.oncomplete = res; tx.onerror = res; tx.onabort = res;
    });
  } catch (e) { /* quota / private mode — the in-memory copy still works */ }
}

/** Forget the cached games (sign-out / account deletion). uid=null → all users. */
export async function clearGamesCache(uid = null) {
  mem = null;
  try {
    const db = await idb();
    await new Promise((res) => {
      const tx = db.transaction(STORE, "readwrite");
      if (uid) tx.objectStore(STORE).delete(uid); else tx.objectStore(STORE).clear();
      tx.oncomplete = res; tx.onerror = res; tx.onabort = res;
    });
  } catch (e) {}
}

/** Mark the cache as needing a top-up (called after saving a game). */
export function markGamesDirty() { dirty = true; }

/**
 * @param {object} fs  Firestore bindings {db, collection, query, where, orderBy, limit, startAfter, getDocs}
 * @param {string} uid
 * @returns {Promise<{games:object[], info:{mode:string, reads:number, ms:number, total:number}}>}
 */
export async function loadAllGames(fs, uid) {
  const t0 = performance.now();
  const { db, collection, query, where, orderBy, limit, startAfter, getDocs } = fs;
  const col = collection(db, "dart_games");
  let reads = 0, mode;

  if (!mem || mem.uid !== uid) {
    const saved = await idbGet(uid);
    mem = saved && Date.now() - (saved.fullSyncAt || 0) < FULL_RESYNC_MS
      ? { uid, byId: new Map(saved.docs.map((d) => [d.id, d])), maxTs: saved.maxTs || 0, fullSyncAt: saved.fullSyncAt, syncedAt: 0 }
      : null;
  }

  if (mem && !dirty && Date.now() - mem.syncedAt < FRESH_MS) {
    mode = "memory";
  } else if (mem) {
    mode = "topup";
    try {
      const snap = await getDocs(query(col, where("userId", "==", uid), where("ts", ">=", mem.maxTs - OVERLAP_MS), orderBy("ts", "desc")));
      reads = Math.max(1, snap.size); // an empty result is still billed as 1 read
      snap.docs.forEach((d) => mem.byId.set(d.id, { id: d.id, ...d.data() }));
    } catch (e) {
      // Offline / transient error: show the persisted copy instead of failing;
      // stays dirty so the next call tries the top-up again.
      console.warn("games top-up failed, using cached copy:", e.message);
      const games = [...mem.byId.values()].sort((a, b) => (b.ts || 0) - (a.ts || 0));
      return { games, info: { mode: "cache-offline", reads: 0, ms: Math.round(performance.now() - t0), total: games.length } };
    }
  } else {
    mode = "full";
    const byId = new Map();
    let cursor = null;
    for (;;) {
      const parts = [col, where("userId", "==", uid), orderBy("ts", "desc"), limit(PAGE)];
      if (cursor) parts.push(startAfter(cursor));
      const snap = await getDocs(query(...parts));
      reads += Math.max(1, snap.size);
      snap.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
      if (snap.size < PAGE) break;
      cursor = snap.docs[snap.docs.length - 1];
    }
    mem = { uid, byId, maxTs: 0, fullSyncAt: Date.now(), syncedAt: 0 };
  }

  if (mode !== "memory") {
    dirty = false;
    mem.syncedAt = Date.now();
    let maxTs = 0;
    for (const g of mem.byId.values()) if ((g.ts || 0) > maxTs) maxTs = g.ts;
    mem.maxTs = maxTs;
    idbPut(uid, { docs: [...mem.byId.values()], maxTs: mem.maxTs, fullSyncAt: mem.fullSyncAt });
  }

  const games = [...mem.byId.values()].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return { games, info: { mode, reads, ms: Math.round(performance.now() - t0), total: games.length } };
}

/**
 * Which dart_games docs count for statistics (stats KPIs, history, coach
 * prompts, player profile — everything that goes through dartDB.loadStats()).
 * Only real X01 legs (501/301; old docs without a mode) and Cricket. Party/
 * training modes must never count: app versions before 1.3.0 saved them here
 * with the PREVIOUS X01 game's numbers (AtC, Shanghai, Highscore, Killer,
 * Elimination) or as mislabeled 501 legs ("Bob27"/"CheckoutTraining" started
 * a plain 501 there) — and old versions stay in use for a while. A whitelist
 * also keeps any future mode out until it is handled on purpose. Applied on
 * output, so copies already in this device's IndexedDB cache are covered too.
 * @param {{mode?:string}} g
 */
export function isStatsGame(g) {
  const m = g?.mode;
  return m == null || m === "501" || m === "301" || m === "Cricket";
}

