# Firebase Migration: fitness-tracker-c6f97 → darttrainer-app

## Übersicht
DartTrainer wird vom gemeinsamen Fuelofit-Projekt in ein eigenes Firebase-Projekt getrennt.
**Strategie: Erst alles im neuen Projekt aufsetzen → Umschalten → Testen → Altes Projekt-Zugriff entfernen.**

---

## Schritt 1: Firebase Console — Neues Projekt anlegen

1. [console.firebase.google.com](https://console.firebase.google.com) öffnen
2. "Projekt hinzufügen" → Name: **darttrainer-app**
3. Google Analytics aktivieren
4. Im neuen Projekt aktivieren:
   - **Firestore Database** (Region: `europe-west1`, Production mode)
   - **Authentication** (Anonymous + Google + Email/Password aktivieren)
   - **Storage** (Region: `europe-west1`)
   - **Functions** (Blaze-Plan erforderlich)
   - **Hosting**
5. Web-App registrieren: Projekteinstellungen → Deine Apps → "Web-App hinzufügen"
   - Name: "DartTrainer Web"
   - **Config-Objekt kopieren** (apiKey, authDomain etc.) → brauchen wir in Schritt 2

---

## Schritt 2: Firebase Config in index.html eintragen

In `index.html` im `<head>` vor allen anderen `<script>`-Tags einfügen:

```html
<script>
  window.FIREBASE_CONFIG = {
    apiKey: "HIER_EINTRAGEN",
    authDomain: "darttrainer-app.firebaseapp.com",
    projectId: "darttrainer-app",
    storageBucket: "darttrainer-app.firebasestorage.app",
    messagingSenderId: "HIER_EINTRAGEN",
    appId: "HIER_EINTRAGEN"
  };
</script>
```

`js/firebase.js` liest automatisch `window.FIREBASE_CONFIG || FALLBACK_CONFIG`.

---

## Schritt 3: Secrets im neuen Projekt setzen

```bash
firebase use darttrainer-app
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set ELEVENLABS_API_KEY
```

---

## Schritt 4: Cloud Functions deployen

```bash
cd /home/daniel_strass/Dart/functions
firebase use darttrainer-app
firebase deploy --only functions:dartTTS
firebase deploy --only functions:dartCoach
```

---

## Schritt 5: Firestore Rules setzen

```bash
firebase use darttrainer-app
firebase deploy --only firestore:rules
```

Oder manuell: Firebase Console → Firestore → Rules → Inhalt von `firestore.rules` einfügen.

---

## Schritt 6: Storage Rules setzen

```bash
firebase deploy --only storage
```

Oder manuell: Firebase Console → Storage → Rules → Inhalt von `storage.rules` einfügen.

---

## Schritt 7: Daten migrieren

```bash
# Service Account Keys aus beiden Firebase-Projekten laden:
# Firebase Console → Projekteinstellungen → Service Accounts → Neuen Schlüssel generieren
# fitness-tracker-c6f97 → scripts/source-service-account.json
# darttrainer-app       → scripts/target-service-account.json

cd /home/daniel_strass/Dart
npm install firebase-admin   # falls nicht vorhanden
node scripts/migrate-data.js
```

Migrierte Collections: dart_games, dart_players, dart_rooms, dart_coach_analyses, dart_users, dart_config, dart_tournaments

---

## Schritt 8: Cloud Function URLs aktualisieren

In `js/coach.js` die Konstanten anpassen:

```javascript
// ALT:
export const COACH_FUNCTION_URL = "https://europe-west1-fitness-tracker-c6f97.cloudfunctions.net/dartCoach";
export const TTS_FUNCTION_URL   = "https://europe-west1-fitness-tracker-c6f97.cloudfunctions.net/dartTTS";

// NEU:
export const COACH_FUNCTION_URL = "https://europe-west1-darttrainer-app.cloudfunctions.net/dartCoach";
export const TTS_FUNCTION_URL   = "https://europe-west1-darttrainer-app.cloudfunctions.net/dartTTS";
```

---

## Schritt 9: Firebase Hosting konfigurieren + deployen

```bash
firebase use darttrainer-app
firebase deploy --only hosting
```

Für Custom Domain (darttrainer.app):
Firebase Console → Hosting → Custom Domain hinzufügen

---

## Schritt 10: Testen

Checkliste nach dem Umschalten:
- [ ] Login (Google, E-Mail, Anonym) funktioniert
- [ ] Spieler laden
- [ ] Spiel speichern + Statistiken erscheinen
- [ ] KI-Coach Analyse (dartCoach Function)
- [ ] TTS-Ansagen (dartTTS Function / ElevenLabs)
- [ ] Voice Samples aus Storage laden
- [ ] Online-Multiplayer Raum anlegen

---

## Schritt 11: GitHub Pages deaktivieren (optional)

Nach erfolgreichem Test auf Firebase Hosting:
GitHub → Repository Settings → Pages → Source: None

---

## Rollback

Falls etwas schiefläuft: `window.FIREBASE_CONFIG` in `index.html` entfernen.
`js/firebase.js` fällt automatisch auf `FALLBACK_CONFIG` (fitness-tracker-c6f97) zurück.
