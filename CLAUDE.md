# DartTrainer — Claude Code Übergabe-Dokumentation

## Projektübersicht
Modulare HTML/CSS/JS-App (`index.html` + `js/` + `css/`) — Dart-Scoring-App mit KI-Coach, Statistiken, Sprachsteuerung und Voice-Samples.
Deployed auf GitHub Pages: `https://danielstrass8482.github.io/Dart/`

---

## Firebase Projekte
- **Fuelofit:** `fitness-tracker-c6f97` — NICHT anfassen, anderes Produkt
- **DartTrainer:** `darttrainer-app-fed88` — aktives Projekt (Migration läuft, s. MIGRATION.md)

## Migration Status
- [ ] Neues Firebase-Projekt angelegt (darttrainer-app-fed88)
- [ ] Firebase Config in `index.html` als `window.FIREBASE_CONFIG` eingetragen (Template vorbereitet — apiKey/messagingSenderId/appId noch eintragen, dann Kommentar in index.html entfernen)
- [ ] Functions neu deployed ins neue Projekt
- [ ] Firestore Rules gesetzt (firestore.rules)
- [ ] Storage Rules gesetzt (storage.rules)
- [ ] Daten migriert via `node scripts/migrate-data.js`
- [x] Cloud Function URLs in `js/coach.js` aktualisiert → darttrainer-app-fed88
- [x] `.firebaserc` auf darttrainer-app-fed88 umgestellt (Firebase CLI)
- [ ] Firebase Hosting konfiguriert + Domain darttrainer.app
- [ ] GitHub Pages deaktiviert

## Cloud Function URLs (nach Migration)
- dartCoach: `https://europe-west1-darttrainer-app-fed88.cloudfunctions.net/dartCoach`
- dartTTS: `https://europe-west1-darttrainer-app-fed88.cloudfunctions.net/dartTTS`

In `js/coach.js` die Konstanten `COACH_FUNCTION_URL` und `TTS_FUNCTION_URL` nach erfolgreichem Deploy aktualisieren.

---

## Tech Stack
- **Frontend:** Vanilla HTML/CSS/JS, modular (`index.html` + `js/` + `css/`)
- **Backend:** Firebase (Firestore, Storage, Auth, Cloud Functions)
- **Firebase Projekt:** `darttrainer-app-fed88` (Ziel) / `fitness-tracker-c6f97` (aktuell noch aktiv)
- **Cloud Functions:** `europe-west1`, Node 22
- **Hosting:** GitHub Pages → Firebase Hosting (nach Migration)

---

## Firebase Konfiguration
```javascript
apiKey: "AIzaSyBvTU5OhJnvJW-hYJYYVTro2rNcNr60aCk"
authDomain: "fitness-tracker-c6f97.firebaseapp.com"
projectId: "fitness-tracker-c6f97"
storageBucket: "fitness-tracker-c6f97.firebasestorage.app"
```

## Firestore Collections
| Collection | Inhalt |
|---|---|
| `dart_games` | Gespeicherte Spiele inkl. scatter, doubleStats, first9 |
| `dart_players` | Spielerprofile mit stats-Objekt |
| `dart_rooms` | Online-Multiplayer Räume |
| `dart_coach_analyses` | Gespeicherte KI-Coach-Analysen pro Spieler |
| `dart_coop_games` | Co-op-Checkout-Spiele (bewusst NICHT in `dart_games`, s. „Co-op Checkout“) |
| `dart_appcheck_stats` | App-Check-Zähler pro Tag (`<YYYY-MM-DD>` → `<fn>.<plattform>.<valid|invalid|missing>`), nur Admin/Functions |
| `dart_config/appcheck` | App-Check-Erzwingung pro Function (`enforce.dartCoach|dartVoiceName|dartTTS|dartAppCheckPing`), Clients nur lesen |

## Firebase Storage
- `dart_voice/score_0.webm` bis `dart_voice/score_180.webm` — Custom Voice Samples (Daniel's Stimme)
- `dart_voice/bust.webm`, `dart_voice/no_score.webm`, `dart_voice/game_on.webm`, `dart_voice/requires.webm`

## App Check (Stand 2026-11-24) — `functions/appCheckGate.js`
- Jede Anfrage an `dartCoach`, `dartVoiceName` (vorher ganz ohne Prüfung), `dartTTS`, `dartAppCheckPing` wird verifiziert + gezählt (Plattform aus der verifizierten App-ID, sonst `X-DT-Client`-Header bzw. User-Agent `DartTrainerApp` = Android vor 1.3.0 → `android-old`; `test` = eigene Live-Tests). Log-Zeile `jsonPayload.appCheck` inkl. Client-Fehlertext (`X-DT-AppCheck-Error`)
- **Erzwingung ohne Deploy:** Firestore `dart_config/appcheck` → `enforce.<fn> = true` (wirkt nach ≤ 60 s, Cache pro Instanz). Stand: alles **false**. Kill-Switch/Tageslimits/budgetCheck unverändert
- **Messung:** `node scripts/appcheck-report.js [--days=7]` (Tabelle pro Function/Plattform + Ja/Nein je Function). Kriterium: android und web je ≥ 98 % gültig aus ≥ 30 Anfragen, kein Tag < 95 %, und alte App (`android-old`) < 2 % der Nutzeranfragen der Function. Messquelle auch ohne Coach-Nutzung: `dartAppCheckPing` (App ruft ihn max. 1×/Tag/Gerät, 8 s nach Start)
- Client: `window.appCheckHeaders()` (js/firebase.js) für alle Function-Aufrufe. Android: Play Integrity über Capacitor-Plugin `AppCheckBridge` (`AppCheckBridgePlugin.java`, vor `super.onCreate` registriert); alte `AndroidBridge`-JS-Schnittstelle nur noch Fallback (wird nach Ladebeginn eingehängt → Race); in der App nie reCAPTCHA (Origin `https://localhost` ist für den Key nicht zugelassen)
- Geprüft 2026-11-24: Play Integrity API aktiv, Play-Integrity-Provider in App Check registriert, SHA-256 des App-Signaturschlüssels (`63d119…`) in Firebase, neuer Upload-Key B3:FF (SHA-1+256) ergänzt. Web: reCAPTCHA-Key erlaubt play.darttrainer.app, Siteverify mit Key-Secret ok, echte Browser Score ≥ 0,9 (Headless = 0 → 403, erwartbar). Live-Test: `node tests/appcheck-gate.live.mjs` (temporäres Debug-Token, Schalter an/aus am Ping)
- Android-Tokens gibt es nur für Play-installierte Builds (interner Test reicht). Vor dem Einschalten Gerätetest + Report

## Cloud Functions
- **`dartAppCheckPing`** — nur Messung (s. App Check), `maxInstances: 2`
- **`dartCoach`** — Anthropic API Proxy (verhindert CORS)
  - URL: `https://europe-west1-fitness-tracker-c6f97.cloudfunctions.net/dartCoach`
  - Secret: `ANTHROPIC_API_KEY` (Firebase Secret Manager)
  - File: `functions/dartCoach.js`
- **`dartTTS`** — Google Cloud TTS Proxy (British voice, caching in Firebase Storage)
  - URL: `https://darttts-64z7naltva-ew.a.run.app`
  - Auth: Application Default Credentials (kein separater API Key)
- **`sendFeedback`** — Feedback-Formular Mailversand an support@darttrainer.app
  - URL: `https://europe-west1-darttrainer-app-fed88.cloudfunctions.net/sendFeedback`
  - Secrets: `FEEDBACK_SMTP_HOST`, `FEEDBACK_SMTP_USER`, `FEEDBACK_SMTP_PASS` (Firebase Secret Manager — Dogado Mail-Hosting, Port 465/SSL)
  - Speichert zusätzlich in Firestore `dart_feedback` als Fallback
  - File: `functions/feedback.js`
  - Voice: `en-GB-Neural2-B` (männlich, britisch)
  - Cache: `dart_voice_el/<key>.mp3` in Firebase Storage
  - File: `functions/index.js`

---

## Firestore Rules (aktuell)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /foods/{foodId} { allow read, write: if request.auth != null; }
    match /trainingTypes/{typeId} { allow read, write: if request.auth != null; }
    match /users/{userId}/{document=**} { allow read, write: if request.auth != null && request.auth.uid == userId; }
    match /dart_games/{doc} { allow read, write: if request.auth != null; }
    match /dart_players/{doc} { allow read, write: if request.auth != null; }
    match /dart_rooms/{doc} { allow read, write: if request.auth != null; }
    match /dart_coach_analyses/{doc} { allow read, write: if request.auth != null; }
  }
}
```

---

## App-Architektur

### Screens
- `#setup` — Home (Tabs: Spiel, Statistiken, Online, Studio[hidden])
- `#x01` — 501/301 Spiel
- `#cricket` — Cricket Spiel
- `#party` — Party-Modi (Around the Clock, Shanghai, Highscore, Killer, Elimination)
- `#online-wait` — Online-Multiplayer Warteraum

### Wichtige globale Variablen
- `cfg` — aktuelle Spielkonfiguration
- `x01` — x01 Spielzustand
- `cr` — Cricket Spielzustand
- `pg` — Party-Spiel Zustand
- `boardSVG` — globale Referenz auf das Haupt-SVG
- `allPlayers` — geladene Spieler aus Firebase
- `selectedPlayers` — ausgewählte Spieler für nächstes Spiel

### SVG Dartscheibe
- ViewBox: `0 0 530 530`, CX=CY=265
- Radien: bull=13, bull25=32, triIn=109, triOut=125, dblIn=186, dblOut=200
- `SECTORS` Array: `[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5]`
- Touch-Events: `pointerup` (funktioniert auf iPad/Android)

### Audio-System
- **Custom Voice:** `playCustomAudio(key)` → lädt aus Firebase Storage, cached URLs
- **Google TTS:** `speakElevenLabs(text, key)` → ruft `dartTTS` Cloud Function auf, cached in Storage + Memory
- **Fallback TTS:** `doSpeak(text, lang)` → Web Speech API
- **Wrapper:** `speakScoreWithCustom(score)` → Google TTS first, dann Web Speech fallback
- **Unlock:** beim ersten `pointerdown` wird AudioContext entsperrt (iOS/Android)

### Vorproduzierte Voice-Clips (seit 2026-11-22)
- 4 auswählbare Stimmen (George=Standard, Haseeb, Jerry B, Guy), je 921 Clips (627 Vokabular + 294 Namen). Quelle der Wahrheit: `data/voices.json` (+ Spiegel in `js/app.js` BUILTIN_VOICES, `js/voiceClips.js`, `functions/index.js`, `functions/voiceName.js`)
- Inhaltsprüfung nach JEDER (Neu-)Generierung: `node scripts/check-voice-clips.js --voice=<v>` (s. `docs/voice-qa/README.md`); Profil `data/tts-settings.json`
- Format: `data/voice-format.json` — MP3 mono 24 kHz LAME VBR V6 (~1/3 von ElevenLabs' mp3_44100_128). Generierung (`scripts/gen-voice-assets.js`) und `dartVoiceName` (ffmpeg-static) wandeln automatisch um; Bestand: `FFMPEG=… node scripts/transcode-voice-assets.js` (idempotent, schreibt `assets/voice/<v>/index.json` mit `rev`)
- Storage-Pakete: `node scripts/upload-voice-assets.js --bulk`; Android-Bundle (nur George): `npm run build`
- **Aktualität nach Neugenerierung (seit 2026-11-24):** `index.json` enthält pro Clip einen Inhalts-Hash (`hashes`, SHA-1/10 hex, `writeVoiceIndex`/`clipHash` in `scripts/voice-format.js`). Identität eines Clips = (Stimme, Key, Hash): gebündelte Clips werden als `<key>.mp3?h=<hash>` geladen (neue Bytes = neue URL → weder HTTP-Cache/`force-cache` noch SW-Cache liefern die alte Version), IndexedDB-Kopien speichern ihren Hash und werden beim nächsten Abspielen einzeln ersetzt, Downloads werden beim Eintreffen gehasht. Index pro Sitzung einmal (`no-cache`, i. d. R. 304); Nicht-Standard-Stimmen lesen `dart_voice_pkg/<v>/index.json` (Upload-Skript lädt es NACH den Clips hoch, `--index-only` nur Index). Offline/ohne Index wird gespielt, was lokal liegt. Warm-up räumt veraltete SW-Einträge ab. Test: `node tests/voice-freshness.test.mjs` (eigener Server, Phasen: alt → veröffentlichen → Reload → neu, genau 1 Download je geändertem Clip, 0 für unveränderte, offline, ohne SW; gegen alten Code 13 Fehler)
- Web/PWA: `sw.js` + `js/pwa.js` — Service Worker erst nach App-Start registriert, George-Clips danach im Hintergrund in den SW-Cache (offline nach erstem Besuch). In Capacitor nicht aktiv. Tests: `tests/offline-leg.test.mjs`, `tests/pwa-offline.test.mjs`, Messung: `tests/pwa-load.measure.mjs`
- Installierbar via `manifest.webmanifest` (Icons `icons/icon-192.png`, `icon-512.png` = any+maskable, `apple-touch-icon.png`; Theme `#08080A`). Playwright ist devDependency (1.65.1 ↔ chromium-1255); Tests brauchen `python3 -m http.server 8973` im Repo-Root

### Sprachsteuerung
- `SpeechRecognition` API, `lang="de-DE"`, kontinuierlicher Modus
- Versteht Deutsch + Englisch: "Triple Zwanzig", "Double sixteen", "Daneben", "Miss"
- `micEnabled` flag, `startMic()` / `stopMic()`

---

## Spielmodi
| Modus | Logik |
|---|---|
| 501/301 | Double-Out, Legs, Sets, Bust-Erkennung |
| Cricket | 20-15 + Bull, Marks-Tracking |
| Around the Clock | 1→20 der Reihe |
| Shanghai | 7 Runden, Shanghai-Sieg möglich |
| Highscore | X Runden, höchste Punktzahl |
| Killer | Eigene Zahl per Double, dann andere eliminieren |
| Elimination | 501 + Eliminierung bei gleichem Score |
| Bob's 27 | Party-Screen, Standardregel (seit 2026-11-24): Start 27, D1…D20, dann Doppel-Bull; je Treffer +Doppelwert, nur wenn alle 3 daneben −Doppelwert einmal; ≤ 0 = Spielende (aus); Ergebnis-Tabelle im Overlay |
| Checkout-Training | Party-Screen: 10 zufällige Checkout-Werte (40–170), Double-Out, Single auf 0 = Bust |
| Co-op Checkout | 2+ Spieler spielen gemeinsam eine Leiter von Checkout-Werten (z. B. 80–90), Rest wird weitergereicht |

### Party-/Trainingsmodi (`js/party.js`) — Stand 2026-11-24
- `PARTY_MODES`/`isPartyMode()` in `party.js` ist die einzige Liste (app.js, tournament.js, setup.js, x01.js). Vorher fehlten Bob27/CheckoutTraining in den Kopien → starteten still ein 501
- Party-Spiele werden NICHT in `dart_games` gespeichert (`saveGameToFirebase` bricht ab) — vorher wurde dort das letzte X01-Spiel unter dem Party-Modus-Namen gespeichert bzw. es gab einen TypeError; Gewinner-Overlay zeigt keine alten X01-Stats mehr
- Rechtes Panel (Würfe, Punktestand inkl. Ziel, Weiter-Button) war seit dem Modul-Refactor per `.side-panel{display:none}` unsichtbar → `#party .side-panel` in `game.css` wieder sichtbar; Farben an dunkles Theme angepasst; `winner` 0 (Spieler 1) wird überall als Gewinner erkannt; Turn-Ende nach Checkout/Bust sperrt Board + Weiter, Undo bricht es ab
- Test: `node tests/party-modes.test.mjs` (echte Setup-Buttons + Board-Klicks; Bob's 27: Teiltreffer, alle daneben, genau 0, Durchlauf bis Bull = 497)
- **Statistik-Whitelist (seit 2026-11-24):** `dartDB.loadStats()` liefert nur Legs mit `mode` 501/301/Cricket (oder ohne `mode`) — `isStatsGame()` in `gamesCache.js`, greift auch auf gecachte Kopien. Grund: App-Versionen < 1.3.0 (Play Store vc12) speichern Party-Spiele weiter in `dart_games`. Test: `node tests/party-docs-stats.live.mjs`
- Produktions-DB 2026-11-24: 2 Docs `mode:"Bob27"` (29.07.2026, Matze/Daniel) waren echte 501-Legs (Bob27-Button startete damals 501) → `mode` auf `"501"` korrigiert, `modeCorrectedFrom:"Bob27"`; Backup `~/backups/dart-games-mislabeled-2026-11-24/`. Keine Docs mit kopierten X01-Zahlen gefunden. Geräte-Caches sehen die Korrektur erst beim 30-Tage-Voll-Resync (bis dahin per Whitelist ausgeblendet)

### Co-op Checkout (seit 2026-11-23) — `js/coop.js`, `css/coop.css`
- Setup: „Weitere Modi“ → „Co-op Checkout“; Start-/Endwert per Stepper (2–170). Nicht auscheckbare Werte (159, 162, 163, 165, 166, 168, 169) sind als Start/Ende nicht wählbar (Stepper/Eingabe springen weiter) und werden in der Leiter übersprungen (Hinweis im Setup) — ohne 3-Dart-Finish wären sie keine Checkout-Werte. Mind. 2 Spieler, kein Bot; Sets/Legs/Bot im Setup ausgeblendet
- Läuft auf der X01-Engine/dem `#x01`-Screen (`state.cfg.coop`, `state.x01.coop`): Board, Spracheingabe, Bouncer, Undo, Darts-Zählung (`turnDarts`), requires-/Checkout-Weg-Ansagen sind die von X01. Hooks in `x01.js`: `startX01` (Rest = erster Wert), `advanceX01` (Rest für alle gleich), `handleLegWin` → `coopOnCheckout()` (nächster Wert, Spieler nach dem Finisher beginnt), `x01Snapshot` enthält `coop` → Undo funktioniert auch über einen Checkout-Wechsel. Double-Out wie X01 (X01 hat keine Single-Out-Einstellung)
- Hochformat erlaubt: einziger Spielmodus ohne Querformat-Zwang/„Gerät drehen“ (`isPortraitAllowed` in `setup.js`) — Anforderung iPad hoch + Telefon. Anzeige: Ziel, Fortschritt („Wert 4 von 11 · 80–90“), Rest, Spieler am Zug, Darts/Checkouts pro Spieler; quer im rechten Panel inkl. Wert-Tabelle
- Ansagen nur aus vorhandenen Clips (alle 4 Stimmen vorhanden, keine Neugenerierung, 0 Credits): Game on → „<Name> requires <Wert>“ + Checkout-Weg; nach Checkout „Checkout!“ (`el_party_checkout`) + requires/Weg für den nächsten Wert; Spielende „Game Shot!“ (`el_slang_game_shot_`; bei Slang an kommt es schon aus dem X01-Pfad)
- Auswertung (Overlay): Darts pro Wert, Darts gesamt, Ø Darts/Wert, Spielzeit, pro Spieler Darts + Checkouts; „Nochmal“ startet dieselbe Leiter
- Speichern: `dartDB.saveCoopGame` → Collection `dart_coop_games` (Rules + Index `userId ↑, ts ↓` deployt 2026-11-23). Grund: alles, was `dart_games` liest (stats.js, gamesCache.js, Coach, Spielerprofil, ältere App-Versionen im Feld) behandelt Nicht-Cricket-Docs als X01-Leg. Statistik zeigt Co-op in „Letzte Spiele“ + eigenem Abschnitt (`loadCoopGames`, max. 100, Sitzungs-Cache bis zum nächsten Save). `deleteUserAccount` löscht `dart_coop_games` mit
- Tests: `node tests/coop.test.mjs` (Setup-UI, Durchlauf 80–82, Rest-Übergabe 80→73→7, Bust ×3, Undo im Wert + über Checkout, Bouncer, Zurück-Bestätigung, 3 Spieler, Ansage-Reihenfolge, Layout iPad quer/hoch + Telefon hoch/quer × DE/EN; `SHOTS=<dir>` für Screenshots) · Live: `node tests/coop-stats.live.mjs` (Gast, echte DB: Co-op nicht in `loadStats()`/IndexedDB-Cache/X01-KPIs, aber in Historie; räumt auf)
- Android: kommt erst mit dem nächsten Build (vc13, neuer Key, s. „Android Release“) — nicht von Claude gebaut

---

## KI-Coach
- **Text-Analyse:** `buildCoachPrompt()` → `callClaudeViaProxy()` → Cloud Function → Anthropic API
- **Video-Analyse:** Frame-Extraktion aus Video (5 Frames) → Base64 → Claude Vision
- **Rate-Limit:** `COACH_DAILY_LIMIT = 999` (Testbetrieb, vor Release auf 3 reduzieren)
- **Speichern:** Analysen in `dart_coach_analyses` Collection, pro Spieler abrufbar
- **Prompt:** Gesamtstatistiken + Trend (letzte 5 vs. vorherige 5) + Doppelfeld-Stats

---

## Statistiken
- Zeitfilter: Heute / 7 Tage / Monat / 3 Monate / 6 Monate / Alles / Kalender
- Spielerfilter: Alle oder einzelner Spieler
- KPIs: Spiele, Siege, Ø Aufnahme, First-9 Ø, Highscore, Checkout-Quote, Ø Darts
- Doppelfeld-Tabelle: Versuche, Treffer, Quote mit Balken
- Verlaufschart: Canvas-basiert, bis zu 3 KPIs gleichzeitig
- Trefferbild: Mini-Dartscheibe mit Scatter-Dots
- **Laden (seit 2026-11-22, `js/gamesCache.js`):** `dartDB.loadStats()` liefert ALLE Legs des Nutzers (vorher `limit(200)` → „Alles“ zeigte still nur 200). Spieler/Zeitraum/Modus filtert `js/stats.js` im Browser; Verlauf/Sessions, Coach-Prompts und Spielerprofil-Stats brauchen ohnehin die volle Liste.
  - Lesevorgänge: Erstladen pro Gerät = alle Legs (Seiten à 500) · danach IndexedDB-Kopie (pro uid) + Nachladen `ts ≥ neuestes − 7 Tage` = Legs der letzten 7 Tage (min. 1) · in derselben Sitzung < 30 s und nichts gespeichert = 0 · Voll-Resync wenn Kopie > 30 Tage alt. 7-Tage-Überlappung fängt Uhr-Abweichung/verspätete Offline-Saves anderer Geräte
  - Gemessen (650 Legs, echte DB): erstes Laden 650 Reads / 1,3 s, neue Sitzung 12 Reads / 0,57 s, Filterwechsel 0 Reads. Offline: Nachladen schlägt fehl → lokale Kopie wird angezeigt
  - `saveGame` markiert den Cache als veraltet; `signOutUser` und `deleteUserAccount` löschen die Kopie (geteilte Geräte). Spiele werden nie bearbeitet/gelöscht (append-only) — falls das je kommt, muss `gamesCache.js` das berücksichtigen. Geprüft 2026-11-24: einziger Lösch-/Änderungspfad für `dart_games` ist „Konto löschen“ (alle Daten, Konto weg) — keine Spiel-Bearbeitung/-Löschung in der App, daher keine Änderung nötig
  - Index: nur `userId ↑, ts ↓` nötig (Gleichheit + Bereich/Sortierung auf ts). `firestore.indexes.json` == Projekt (5 Indexe, alle READY). Neue serverseitige Filter brauchen einen neuen Index + `firebase deploy --only firestore:indexes`
- **Ø Darts pro Leg:** exakt aus `players[].darts` über die Legs, die das Feld haben (Untertitel „exakt aus N von M Legs“); nur wenn kein Leg der Auswahl es hat: alte Schätzung Runden × 3 („geschätzt“). Nie gemischt in einer Zahl. Cricket weiter geschätzt
- Test viele Legs: `node tests/stats-many-legs.live.mjs` (Gast + 650 Legs per Batch, prüft Anzahl/Reads/Ladezeit/Ø Darts, löscht alles; `BASE=http://localhost:8973` für lokal)
- Live-Nachweis gegen echte DB: `node tests/stats-filters.live.mjs` (Gast-Login, 1 Spieler + 6 Spiele seeden, alle 48 Kombinationen Spieler×Zeitraum×Modus über die echten Buttons, danach `deleteUserAccount()`); `BASE=http://localhost:8973` für lokal
- Behoben 2026-11-22: Modus-Buttons tragen ebenfalls `.time-btn` → ein Modus-Klick setzte den Zeitraum still auf „Alles“ zurück (Handler jetzt nur `.time-btn[data-range]`)

### Darts pro Leg (seit 2026-11-22)
- `state.x01.turnDarts[i]` = Darts je abgeschlossener Aufnahme (Bust: tatsächlich geworfene), `legDarts(i)` = Summe + laufende Aufnahme. Bouncer zählen (sind in `throws`), per Undo zurückgenommene Würfe nicht: alle Undo-Snapshots kommen aus `x01Snapshot()` (x01/Bouncer/Sprache/Bot)
- Anzeige: 2 Spieler → Mittelspalte unter dem Leg-Stand („4:3 DARTS“, TOTAL zusätzlich „Ø/LEG“); Solo → Badge neben WINNER. Bewusst keine Tabellenzeile — so bleiben Board-Größe/-Position, Tabs und Chip-Leiste pixelgleich
- Gespeichert als `players[].darts` im Leg-Dokument — erst ab 2026-11-22; ältere Spiele haben keine Angabe (aus `scatter`/`rounds` nicht rekonstruierbar: Fehlwürfe per Button, Bouncer und Darts der letzten Aufnahme fehlen dort)
- Test: `node tests/leg-darts.test.mjs [--layout]` (normal / Bouncer / Undo / Bust / Solo, 3 Viewports; `BASE=https://play.darttrainer.app` für live)

---

## Offene Features / TODOs

### Hohe Priorität
- [x] **Google Cloud TTS** — `dartTTS` Cloud Function mit `en-GB-Neural2-B`, ADC, Caching in Storage `dart_voice_el/`
- [ ] **User-Accounts** — Email/Passwort Registration zusätzlich zu Google Login
  - Firebase Auth `createUserWithEmailAndPassword`
  - Spielerprofile an Auth-UID binden
  - Aktuell: alles anonym, Daten gerätegebunden

### Mittlere Priorität  
- [ ] **Bouncer-Button** — Pfeil prallt ab, zählt als Versuch ohne Score
- [ ] **"Großes Feld"-Modus** — nur Segment antippen, dann Single/Double/Triple nachträglich eingeben
- [ ] **Bot auto-kalibrierung** — Bot-Level basierend auf Spieler-Ø automatisch wählen
- [ ] **Cricket Statistiken** verbessern — Lieblings-Felder, Closing-Reihenfolge
- [ ] **Sets in Statistiken** — aktuell werden Sets nicht separat ausgewertet

### Niedrige Priorität
- [ ] **Online-Multiplayer** stabilisieren — Edge Cases bei Disconnect
- [ ] **Studio-Tab** reaktivieren — `style="display:none"` entfernen vom Tab-Button

### Bekannte Bugs
- [ ] Sprachausgabe nach Tablet-Drehen manchmal unterbrochen → `orientationchange` Handler vorhanden aber nicht 100% zuverlässig
- [ ] Cricket hat kein Doppelfeld-Tracking

---

## Deployment

### Firebase Hosting (NICHT deployt — Cache-Header für einen späteren Umzug, `firebase.json`)
- `no-cache` für `/`, endungslose Routen (`**/!(*.*)`, SPA-Rewrite) und `html|js|mjs|css|json|webmanifest|txt|map` (deckt `sw.js`, `manifest.webmanifest`, `assets/voice/*/index.json`, `data/*.json` ab): Browser darf cachen, fragt aber jedes Mal per ETag nach → Updates kommen sofort an, unverändert = 304. Die JS-Module haben keine Content-Hashes in den URLs (nur `?v=2`), daher wäre jedes `max-age` ein Risiko
- `assets/voice/**/*.mp3`: `public, max-age=86400` (1 Tag) — Dateien werden bei Neugenerierung überschrieben; die App fragt sie aber seit 2026-11-24 als `?h=<Inhalts-Hash>` an (s. „Aktualität nach Neugenerierung“), `force-cache` ist damit unkritisch
- Bilder/Icons (`png|webp|svg|ico|jpg|jpeg|gif|woff2`): `public, max-age=2592000` (30 Tage) — ändern sich praktisch nie, ebenfalls ohne Hash
- Geprüft mit `firebase emulators:start --only hosting` + curl (2026-11-22)

### Datenschutzseite / Landingpage
- darttrainer.app (inkl. `privacy.html`, `privacy-en.html`, `impressum.html`, `delete-account*.html`) kommt aus dem separaten öffentlichen Repo `danielstrass8482/darttrainer-landing` (GitHub Pages, Branch main). Abschnitt „6a. Namensansagen / Name Announcements“ am 2026-11-22 ergänzt

### GitHub Pages (index.html + js/ + css/)
```bash
git add -A
git commit -m "feat: ..."
git push
```
Live unter: `https://danielstrass8482.github.io/Dart/`

### Android Release (AAB)
- Version in `android/app/build.gradle` (`versionCode`/`versionName`) — aktuell 13 / 1.3.0
- **Release-Build 2026-11-24 (auf Auftrag Daniel, 2. Build mit App Check/Bob's 27/Whitelist ersetzt den ersten):** `~/darttrainer-1.3.0-vc13.aab` (Prüfsumme s. Abschnitt unten/Commit-Log; erster Build `35be9f94…` gelöscht), vc13 / 1.3.0, neuer Upload-Key (B3:FF, per bundletool/jarsigner geprüft; Web-Inhalt = Commit, 921 George-Clips prüfsummengleich mit Repo); altes `~/darttrainer-1.2.0-vc13.aab` (alter Key A3:56) gelöscht. bundletool liegt (flüchtig) in `/var/tmp/bundletool.jar`. Upload in die Play Console steht bei Daniel aus. Nächster Build: versionCode 14
- **(Erledigt 2026-11-24, s. o.) Festlegung Daniel, 2026-11-23:** Das bisher gebaute `~/darttrainer-1.2.0-vc13.aab` (alter Key) wird NICHT hochgeladen. Ab **2026-11-24 gilt der neue Upload-Key**. Der nächste Build bleibt **versionCode 13 / 1.2.0** (vc13 wurde nie hochgeladen), wird **erst nach Abschluss des Voice-QA-Auftrags** und **mit dem neuen Key** (`signing-new.properties`) gebaut und enthält alle bis dahin gemachten Änderungen (u. a. ggf. korrigierte George-Clips). Claude baut ihn nicht selbst — Build durch Daniel bzw. nur auf ausdrücklichen Auftrag
- Android-SDK liegt auf dem flüchtigen Overlay `/var/tmp/android-sdk` (Symlink `~/android-sdk`, s. `android/local.properties`), Gradle-Cache in `/var/tmp/gradle-home` — /home ist nur 4,8 GB groß. Nach Cloud-Shell-Neustart neu installieren: cmdline-tools → `sdkmanager "platforms;android-36" "build-tools;35.0.0" "build-tools;34.0.0" platform-tools`
- Build: `npm run build && cd android && JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 GRADLE_USER_HOME=/var/tmp/gradle-home ./gradlew --no-daemon bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`
- **Signatur (seit 2026-11-22 NICHT mehr im Repo):** `android/app/build.gradle` liest Keystore/Alias/Passwörter aus `android/signing.properties` (gitignored, Symlink) bzw. `DT_SIGNING_PROPERTIES=<pfad>` bzw. `DT_STORE_FILE`/`DT_STORE_PASSWORD`/`DT_KEY_ALIAS`/`DT_KEY_PASSWORD`. Ohne Quelle bricht `bundleRelease` mit klarer Meldung ab. Vorlage: `android/signing.properties.example`
  - Keys + Properties: `~/secure/darttrainer/` (Sicherung: `~/backups/signing-darttrainer/`) — zusätzlich offline sichern (Passwortmanager/USB)
  - **Alter Upload-Key** (kompromittiert, SHA-1 `A3:56:45:E8:…:17:46`; für vc13 NICHT mehr verwenden, s. o.): `ln -sfn ~/secure/darttrainer/signing-old.properties android/signing.properties`
  - **Neuer Upload-Key** (SHA-1 `B3:FF:85:C2:…:CB:DF`, gültig ab 2026-11-24 — für den nächsten Build): `ln -sfn ~/secure/darttrainer/signing-new.properties android/signing.properties`
  - Kontrolle vor dem Build: `./gradlew -q :app:signingReport` (Variant release → SHA1); der Build loggt `Release-Signatur: alias=…`
  - Gradle braucht `node_modules/@capacitor/*` (`capacitor.settings.gradle`) — bei leerem `node_modules` zuerst `npm ci`
- **Sicherheitsvorfall Keystore (2026-11-22) — Stand:**
  - [x] Repo-Keystore = Upload-Key (Play App Signing aktiv: Firebase kennt zusätzlich SHA-1 `0A:7D:E3:D1:…:3B:DB` / SHA-256 `63:D1:19:…`, zu keinem lokalen Key passend = Googles App-Signaturschlüssel). In der Play Console gegenprüfen (s. u.)
  - [x] Neuer Upload-Key `~/secure/darttrainer/darttrainer-upload-2026-11.p12` (+ identische Kopie `~/backups/signing-darttrainer/`), PEM `upload_certificate.pem` — alle SHA-1 `B3:FF:85:C2:…:CB:DF`. Alter Keystore dort als `darttrainer-release-OLD-compromised.keystore`. **Keinen weiteren Key erzeugen.**
  - [x] Build liest Signatur aus nicht versionierter Quelle (Gradle-Check 2026-11-22 bestanden: ohne Quelle Abbruch, alt → A3:56, neu → B3:FF)
  - [x] Historie bereinigt (git-filter-repo 10:44, Force-Push); Voll-Backup vorher: `~/backups/dart-repo-2026-11-22/` (Bundle + 2 Mirrors, enthält die alten Secrets!)
  - [ ] **GitHub hält die alten Commits/Blobs weiter per SHA abrufbar** (z. B. alter Commit `107a555f…`, Keystore-Blob `bf7643d9…` → HTTP 200). Nur GitHub Support kann das löschen: support.github.com → „Remove sensitive data“, Liste: `~/backups/dart-repo-2026-11-22/affected-old-commits.txt`
  - [ ] Upload-Key-Reset in der Play Console beantragen (PEM hochladen) — Symlink steht seit 2026-11-24 auf `signing-new.properties`
  - [ ] Optional: Offline-Kopie von `~/secure/darttrainer/` (Passwortmanager/USB); „Enforce HTTPS“ für Pages aktivieren
- Prüfen: `java -jar bundletool.jar dump manifest --bundle=… --xpath=/manifest/@android:versionCode`, `jarsigner -verify -certs …`

### Firebase Auth
- Gast-Flow braucht **anonyme Anmeldung** in darttrainer-app-fed88 — war seit Anlage der Auth-Config (2026-06-27) nie aktiv, am 2026-11-22 aktiviert. Prüfen: `bash scripts/check-auth-providers.sh` (`--fix` aktiviert sie)

### Cloud Functions
```bash
cd ~/functions
firebase deploy --only functions:dartCoach
```

### API Keys / Secrets
- `ANTHROPIC_API_KEY` → Firebase Secret Manager
- ElevenLabs Key (noch einzurichten) → ebenfalls Firebase Secret Manager

Für App-Store: **Capacitor** verwenden um die Web-App in eine native iOS/Android App zu verpacken.

---

## Premium System
- `js/premium.js` — Feature-Flags, `canUseFeature()`, `showPremiumOverlay()`, `registerBetaUser()`
- `BETA_MODE = true` — alle Features entsperrt; zum Aktivieren der Paywall: `BETA_MODE = false`
- Grandfathered Beta-User werden in `dart_users` Collection gespeichert
- Firestore: `dart_users/{uid}` (Beta-Info) + `dart_users/{uid}/subscription/current` (Abo-Status)
- Firestore-Rule nötig: `match /dart_users/{userId}/{document=**} { allow read, write: if request.auth != null && request.auth.uid == userId; }`

## Monetarisierung (geplant)
- **Free:** 3 Coach-Analysen/Monat, 1 Video-Analyse, Methodischer Bot, Basis-Statistiken
- **Premium (€2,99/Monat):** Alles unbegrenzt
- **Elite (€9,99 einmalig):** Eigene Stimme, unbegrenzte Analysen dauerhaft

---

## API Kosten-Schutz

### Ebene 1: Firebase Budget Alert (manuell einrichten)
Firebase Console → Billing → Budget & Alerts:
- Alert bei €15/Monat (Warning)
- Alert bei €30/Monat (Critical)

### Ebene 2: Per-User Rate Limiting (Cloud Functions)
- **Coach-Analysen:** max. 10/User/Tag
- **Video-Analysen:** max. 3/User/Tag
- **TTS-Calls:** max. 200/User/Tag (nur uncached)
- Tracking in Firestore: `dart_usage/{uid}_{YYYY-MM-DD}`

### Ebene 3: Kill-Switch
Firestore `dart_config/limits`:
```json
{ "coachEnabled": true, "ttsEnabled": true, "emergencyStop": false }
```
Deaktivieren: Firebase Console → Firestore → `dart_config/limits` → `emergencyStop: true`

### Ebene 4: Budget-Check Function
`budgetCheck` Cloud Function schätzt Tageskosten (~€0.02/Coach, ~€0.001/TTS, ~€0.05/Video).
Bei Überschreitung von €30/Tag wird `emergencyStop: true` automatisch gesetzt.
→ Via Cloud Scheduler täglich oder manuell aufrufen

### Ebene 5: Frontend-Feedback
- **429:** Tageslimit-Anzeige mit verbleibenden/genutzten Calls
- **503:** "Coach momentan nicht verfügbar" Meldung
- **TTS 429/503:** Automatisch auf Browser-TTS-Fallback

### Config initialisieren nach Deploy
```bash
node scripts/init-config.js
```

---

## Entwickler-Kontext
- **Entwickelt mit:** Claude Sonnet (claude.ai Chat)
- **Owner:** Daniel Straß, VP Customer Service DACH @ Dogado
- **Primäres Testgerät:** iPad mit Apple Pencil, Chrome Browser
- **Sprache:** Deutsche UI, Englische Dart-Ansagen

### Voice-QA (abgeschlossen 2026-11-23) — Details: `docs/voice-qa/README.md`
- Alle 3.684 Clips automatisch geprüft (lokales Whisper, ElevenLabs-Key hat kein `speech_to_text`/`user_read`). Vorher → nachher (ok/zweifelhaft/fehlerhaft): George 901/19/1 → 905/16/0 · **Haseeb 821/40/60 → 901/19/1** · Jerry B 894/22/5 → 906/15/0 · Guy 902/17/2 → 908/13/0. Berichte `docs/voice-qa/report-1-vorher.md`, `report-2-nachher.md`; Nachhören `qa/voice-review.html?filter=flagged`
- Ursache: `eleven_turbo_v2_5` (seit 409e8a8 für alles, Clips ce8da95) halluziniert bei kurzen Texten. Neues Profil `stable-short-v1` = `eleven_multilingual_v2`, stability 0.75 / similarity 0.80 / style 0 in `data/tts-settings.json`, `functions/voiceName.js`, `functions/index.js` (dartVoiceName + dartTTS deployt 2026-11-23). `system_prompt` entfernt (kein TTS-Parameter)
- Haseeb komplett neu (921), George 5 / Jerry 12 / Guy 9 Clips repariert; alle 4 Stimmen in `dart_voice_pkg/` bytegleich mit Repo (`scripts/verify-voice-upload.sh`). **George-Clips geändert** (`el_co_25`, `name_birgit`, `name_elena`, `name_kerstin`, `name_tobias`) → gehören in den nächsten vc13-Build (neuer Key, s. „Android Release“)
- Offen für Daniel: 20 Haseeb-Clips nachhören (v. a. `el_slang_ton_forty_`, `name_amelie`, deutsche Namen); Empfehlung Haseeb behalten
- Werkzeuge: `scripts/setup-voice-qa.sh` (nach Cloud-Shell-Neustart, /var/tmp wird gewischt), `check-voice-clips.js` (Cache `qa/.stt-cache.jsonl`, setzt nach Abbruch fort), `repair-voice-clips.js`, `check-central-names.js`, `gen-voice-assets.js --from-qa|--attempt|--upgrade-profile`, `upload-voice-assets.js --only`
