# DartTrainer — Claude Code Übergabe-Dokumentation

## Projektübersicht
Modulare HTML/CSS/JS-App (`index.html` + `js/` + `css/`) — Dart-Scoring-App mit KI-Coach, Statistiken, Sprachsteuerung und Voice-Samples.
Deployed auf GitHub Pages: `https://danielstrass8482.github.io/Dart/`

---

## Firebase Projekte
- **Fuelofit:** `fitness-tracker-c6f97` — NICHT anfassen, anderes Produkt
- **DartTrainer:** `darttrainer-app` — aktives Projekt (Migration läuft, s. MIGRATION.md)

## Migration Status
- [ ] Neues Firebase-Projekt angelegt (darttrainer-app)
- [ ] Firebase Config in `index.html` als `window.FIREBASE_CONFIG` eingetragen (Template vorbereitet — apiKey/messagingSenderId/appId noch eintragen, dann Kommentar in index.html entfernen)
- [ ] Functions neu deployed ins neue Projekt
- [ ] Firestore Rules gesetzt (firestore.rules)
- [ ] Storage Rules gesetzt (storage.rules)
- [ ] Daten migriert via `node scripts/migrate-data.js`
- [x] Cloud Function URLs in `js/coach.js` aktualisiert → darttrainer-app
- [x] `.firebaserc` auf darttrainer-app umgestellt (Firebase CLI)
- [ ] Firebase Hosting konfiguriert + Domain darttrainer.app
- [ ] GitHub Pages deaktiviert

## Cloud Function URLs (nach Migration)
- dartCoach: `https://europe-west1-darttrainer-app.cloudfunctions.net/dartCoach`
- dartTTS: `https://europe-west1-darttrainer-app.cloudfunctions.net/dartTTS`

In `js/coach.js` die Konstanten `COACH_FUNCTION_URL` und `TTS_FUNCTION_URL` nach erfolgreichem Deploy aktualisieren.

---

## Tech Stack
- **Frontend:** Vanilla HTML/CSS/JS, modular (`index.html` + `js/` + `css/`)
- **Backend:** Firebase (Firestore, Storage, Auth, Cloud Functions)
- **Firebase Projekt:** `darttrainer-app` (Ziel) / `fitness-tracker-c6f97` (aktuell noch aktiv)
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

## Firebase Storage
- `dart_voice/score_0.webm` bis `dart_voice/score_180.webm` — Custom Voice Samples (Daniel's Stimme)
- `dart_voice/bust.webm`, `dart_voice/no_score.webm`, `dart_voice/game_on.webm`, `dart_voice/requires.webm`

## Cloud Functions
- **`dartCoach`** — Anthropic API Proxy (verhindert CORS)
  - URL: `https://europe-west1-fitness-tracker-c6f97.cloudfunctions.net/dartCoach`
  - Secret: `ANTHROPIC_API_KEY` (Firebase Secret Manager)
  - File: `functions/dartCoach.js`
- **`dartTTS`** — Google Cloud TTS Proxy (British voice, caching in Firebase Storage)
  - URL: `https://darttts-64z7naltva-ew.a.run.app`
  - Auth: Application Default Credentials (kein separater API Key)
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

### GitHub Pages (index.html + js/ + css/)
```bash
git add -A
git commit -m "feat: ..."
git push
```
Live unter: `https://danielstrass8482.github.io/Dart/`

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
