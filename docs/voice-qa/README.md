# Voice-QA: automatische Prüfung der vorproduzierten Sprachclips

Stand: 2026-11-23 · 4 Stimmen × 921 Clips (627 Vokabular + 294 Namen)

- Bericht vorher (Originalclips): [report-1-vorher.md](report-1-vorher.md)
- Bericht nachher (nach Neugenerierung/Reparatur): [report-2-nachher.md](report-2-nachher.md)
- Zentrale On-demand-Namen (`dart_voice_names/`): [report-central-names.md](report-central-names.md)
- Maschinenlesbar: `qa/voice-qa.json` (aktuell), `qa/voice-qa-vorher.json` (eingefrorener Ausgangsstand)
- Nachhören: `qa/voice-review.html?filter=flagged` (Filter „Nur auffällige / fehlerhaft / zweifelhaft“, mit Grund + erkanntem Text)

## Ergebnis

| Stimme | vorher ok / zweifelhaft / fehlerhaft | nachher ok / zweifelhaft / fehlerhaft | neu erzeugt |
|---|---|---|---|
| George | 901 / 19 / 1 | 905 / 16 / **0** | 5 Clips |
| Haseeb | 821 / 40 / **60** | 901 / 19 / **1** | alle 921 (+ 16 Wiederholungen) |
| Jerry B | 894 / 22 / 5 | 906 / 15 / **0** | 12 Clips |
| Guy | 902 / 17 / 2 | 908 / 13 / **0** | 9 Clips (+ Wiederholungen) |

Die verbleibenden „zweifelhaft“-Clips sind fast ausschließlich **Grenzen der Spracherkennung, keine Halluzinationen**:
- 57 deutsche Vornamen, die Whisper nicht schreiben kann („Jürgen“ → „You're again“, „Klaus“ → „Close“, „Werner“ → „Vanna“) — nur per Ohr prüfbar
- 3 Checkouts, die Whisper als Ziffernfolge zusammenzieht („Triple Seven, Double Twenty“ → „777220“)
- Guy `el_co_3`, `el_co_5`: Inhalt in allen 4 Takes korrekt erkannt, nur sehr lange Pausen (3,2–3,6 s statt ~1,7 s)

**Nach 4 Versuchen weiter auffällig (bitte nachhören):**

| Stimme | Key | Soll | erkannt (alle Takes ähnlich) | Einschätzung |
|---|---|---|---|---|
| Haseeb | `el_slang_ton_forty_` | Ton Forty! | „Don't forte!“, „Tone 4T!“, „Don't for tea!“ | „Ton“ wird wie „Tone/Don“ ausgesprochen; „Don't forget to subscribe“ im 4. Take ist eine bekannte Whisper-Halluzination, nicht Clip-Inhalt |
| Haseeb | `name_amelie` | Amelie. | „I'm Lee.“ / „I'm Ali.“ | vermutlich „A-me-lie“ englisch betont |
| Guy | `el_co_3`, `el_co_5` | Checkout: One, Double One/Two. | „Check out 1, double 1“ | inhaltlich korrekt, nur langsam |

**Haseeb:** nach Neugenerierung mit stabilem Profil nicht mehr nennenswert fehlerhaft (1 statt 60 eindeutige Fehler; der verbleibende ist ein Aussprache-/Erkennungsfall). **Empfehlung: Stimme behalten.** Vor Freigabe einmal die 20 auffälligen Clips nachhören (`qa/voice-review.html?filter=flagged`, Stimme Haseeb) — besonders „Ton Forty!“ und die deutschen Namen, weil Haseebs Akzent dort am ehesten falsch klingen kann.

## Ursache (belegt)

| | Modell | Voice-Settings | Beleg |
|---|---|---|---|
| bis 2026-08-17 (live dartTTS) | `modelForKey()`: `eleven_multilingual_v2` für Scores ≥ 100 + `game_on`, sonst `eleven_turbo_v2_5` | 3 Stufen: stability 0.75/0.50/0.30, style 0.00/0.35/0.65, speed 0.90/1.00/1.08 | `git show 409e8a8^:functions/index.js` (Z. 110 `modelForKey`), eingeführt in `2456acd` |
| 2026-08-17 → Umbau | `eleven_turbo_v2_5` für alles | stability 0.50, similarity 0.90, style 0.35, speed 1.00 | Commit `409e8a8` entfernt `modelForKey`/Tier-Settings |
| vorproduzierte Clips 2026-11-22 | `eleven_turbo_v2_5` für alle 3.684 Clips | wie oben + `system_prompt` | `git show ce8da95:data/tts-settings.json` |

Gegenprobe (12 problematische Keys × 2 Takes je Profil, per Whisper geprüft):

| Profil | Haseeb fehlerhaft | George fehlerhaft |
|---|---|---|
| A: aktuelles Profil (turbo_v2_5, stab 0.50, style 0.35, ohne system_prompt) | 9 / 24 | 0 / 24 |
| **B: multilingual_v2, stab 0.75, sim 0.80, style 0** | **0 / 24** | 0 / 24 |
| C: turbo_v2_5 + language_code en, stab 0.80, style 0 | 5 / 24 | 0 / 24 |

→ Das Modell `eleven_turbo_v2_5` ist bei sehr kurzen Texten die Hauptursache: Es hängt Wörter/ganze Sätze an („Check out Double 20 in this Toyota“) und driftet im Akzent — bei Haseeb stark, bei den anderen Stimmen selten. Höhere stability allein (C) reicht nicht. `system_prompt` ist kein dokumentierter ElevenLabs-TTS-Parameter; A ohne ihn reproduziert die Fehler → nicht ursächlich, entfernt.

**Neues Profil `stable-short-v1`** (`data/tts-settings.json`, gespiegelt in `functions/voiceName.js` und `functions/index.js`): `eleven_multilingual_v2`, stability 0.75, similarity_boost 0.80, style 0, speaker_boost, speed 1.0. Begründung: multilingual_v2 ist bei kurzen Texten stabil (Gegenprobe 0/48); style 0 schaltet die Stil-Übersteigerung ab, die laut ElevenLabs die Stabilität senkt; stability 0.75 hält die Vortragsweise über 921 Clips gleichmäßig. Kosten: 1 Credit/Zeichen statt 0,5 bei turbo — für Einmal-Generierung unerheblich. Jeder Clip bekommt einen deterministischen Seed pro Key + Versuch (reproduzierbar, jede Wiederholung ist ein neuer Take). Modell/Profil/Seed stehen pro Clip in `assets/voice/manifest.json`.

Hinweis: George, Jerry B und Guy bestehen jetzt aus 909–916 Clips mit altem und 5–12 mit neuem Profil (Klang leicht ruhiger, style 0). Falls das beim Nachhören stört: `node scripts/gen-voice-assets.js --voice=<v> --upgrade-profile` erzeugt die Stimme komplett im neuen Profil (~16.450 Credits pro Stimme), danach `repair-voice-clips.js`.

## Verbrauch

| | Zeichen (= Credits bei multilingual_v2) |
|---|---|
| Profil-Gegenprobe 2026-11-22 (A/C turbo = 0,5 Credit/Zeichen) | 3.804 Zeichen |
| Haseeb komplett neu | 16.447 |
| Reparaturen George/Jerry/Guy/Haseeb (alle Runden) | 701 |
| Live-Probe dartVoiceName („Zebulon“) | 8 |

Kontostand nicht abfragbar: der ElevenLabs-Key hat weder `user_read` noch `speech_to_text`. Deshalb läuft die Spracherkennung lokal (Whisper) — **0 € pro Prüflauf**.

## Verfahren

- **Spracherkennung:** faster-whisper (CPU, int8), Erstmodell `small.en` für jeden Clip, Zweitmeinung `medium.en` für alles, was nicht passt; das bessere Urteil zählt. Bewusst **ohne** Soll-Text als Prompt (würde Halluzinationen verdecken).
- **Vergleich** (`scripts/voice-qa-compare.js`): tolerant gegenüber Ziffern/Zahlwörtern („one hundred and one“ = „101“), Homophonen („won“ = „one“), Groß/Klein, Satzzeichen, „check out“/„checkout“, „bull's eye“/„bullseye“, „10%“, Komposita, Füllern; Whispers Telefonnummern-Schreibweise („seven double eight“ → „788“) wird erkannt. Namen phonetisch.
  - **fehlerhaft:** andere/fehlende/zusätzliche Zahl, ≥ 2 zusätzliche/fehlende Wörter
  - **zweifelhaft:** ein Wort abweichend, Name nicht eindeutig, zusammengezogene Ziffernfolge, Dauer auffällig
- **Dauer:** pro Stimme/Kategorie lineares Modell Dauer ≈ a + b·Buchstaben (robust, Namen: Median); markiert ab ×1,6 (Namen ×1,8) bzw. unter ×0,55 **und** ≥ 0,5 s Abstand.
- **Reparatur:** fehlerhafte + zweifelhafte Clips (außer reinen STT-Grenzen: Namensschreibung, Ziffernfolge) werden mit neuem Seed neu erzeugt und erneut geprüft, max. 4 Versuche.

## Benutzung

```bash
bash scripts/setup-voice-qa.sh            # Whisper + Playwright nach /var/tmp (nach jedem Cloud-Shell-Neustart)
export HF_HOME=/var/tmp/hf FFMPEG=$(/var/tmp/whisper-venv/bin/python -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')

node scripts/check-voice-clips.js [--voice=haseeb] [--only=k1,k2] [--report=<label>]   # prüfen (Exit 1 bei Fehlern)
ELEVENLABS_API_KEY=… node scripts/repair-voice-clips.js --voice=<v> --include-doubtful   # prüfen → neu erzeugen → prüfen
node scripts/check-central-names.js [--delete-bad]                                       # dart_voice_names/ prüfen
node scripts/upload-voice-assets.js --voice=<v> --only=<keys> | --bulk && bash scripts/verify-voice-upload.sh <v>
```

- Transkripte werden sofort pro Clip in `qa/.stt-cache.jsonl` (gitignored) angehängt, Schlüssel = SHA-1 der Datei + Modell → ein abgebrochener Lauf setzt fort, neu erzeugte Clips werden automatisch neu geprüft. Geschwindigkeit (4 CPU): ~17–20 Clips/min erste Stufe, ~6 Clips/min Zweitmeinung → eine Stimme ≈ 55–60 min, nach Reparatur Sekunden bis Minuten.
- Neue Namen in `data/names.json`: generieren (`gen-voice-assets.js --kind=name`), dann `check-voice-clips.js --kind=name` und ggf. `repair-voice-clips.js`.
- `dartVoiceName` erzeugt unbekannte Namen mit demselben stabilen Profil (deployt 2026-11-23); Stichprobe regelmäßig mit `check-central-names.js`.
