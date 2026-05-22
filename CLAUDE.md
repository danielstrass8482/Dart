# Dart Pro — Claude Code Übergabe-Dokumentation

## Projektübersicht
Single-File HTML-App (`dart.html`) — Dart-Scoring-App mit KI-Coach, Statistiken, Sprachsteuerung und Voice-Samples.
Deployed auf GitHub Pages: `https://danielstrass8482.github.io/Dart/dart.html`

---

## Tech Stack
- **Frontend:** Vanilla HTML/CSS/JS, single file (`dart.html`, ~4.500 Zeilen)
- **Backend:** Firebase (Firestore, Storage, Auth, Cloud Functions)
- **Firebase Projekt:** `fitness-tracker-c6f97`
- **Cloud Functions:** `europe-west1`, Node 22
- **Hosting:** GitHub Pages (kein Build-Schritt nötig, direkt pushen)

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

## App-Architektur (dart.html)

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
- **Fallback TTS:** `doSpeak(text, lang)` → Web Speech API
- **Wrapper:** `speakScoreWithCustom(score)` → versucht Custom, fallback TTS
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
- [ ] **ElevenLabs TTS** — Ersetze Web Speech API durch professionelle KI-Stimme (British Darts Caller Style)
  - Neue Cloud Function `dartTTS` als Proxy
  - Caching der generierten Audio-Files in Firebase Storage
  - Betrifft: `speakScoreWithCustom()`, `doSpeak()`, `announceRequires()`
  - "X requires Y" funktioniert dann ohne Pre-Recordings
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

### GitHub Pages (dart.html)
```bash
git add dart.html
git commit -m "feat: ..."
git push
```
Live unter: `https://danielstrass8482.github.io/Dart/dart.html`

### Cloud Functions
```bash
cd ~/functions
firebase deploy --only functions:dartCoach
```

### API Keys / Secrets
- `ANTHROPIC_API_KEY` → Firebase Secret Manager
- ElevenLabs Key (noch einzurichten) → ebenfalls Firebase Secret Manager

---

## Refactoring-Empfehlung
Die `dart.html` (4.500 Zeilen) sollte aufgeteilt werden:
```
dart/
├── index.html
├── css/
│   ├── base.css
│   ├── game.css
│   └── stats.css
├── js/
│   ├── firebase.js      — Firebase init + dartDB
│   ├── board.js         — SVG Dartscheibe, hitFromXY
│   ├── x01.js           — 501/301 Spiellogik
│   ├── cricket.js       — Cricket Spiellogik
│   ├── party.js         — Party-Modi
│   ├── audio.js         — Sound, TTS, Custom Voice
│   ├── speech.js        — Sprachsteuerung
│   ├── stats.js         — Statistiken, Charts
│   ├── coach.js         — KI-Coach
│   └── setup.js         — Setup, Spielerverwaltung
└── functions/
    ├── dartCoach.js
    └── dartTTS.js       — (neu: ElevenLabs Proxy)
```

Für App-Store: **Capacitor** verwenden um die Web-App in eine native iOS/Android App zu verpacken.

---

## Entwickler-Kontext
- **Entwickelt mit:** Claude Sonnet (claude.ai Chat)
- **Owner:** Daniel Straß, VP Customer Service DACH @ Dogado
- **Primäres Testgerät:** iPad mit Apple Pencil, Chrome Browser
- **Sprache:** Deutsche UI, Englische Dart-Ansagen
