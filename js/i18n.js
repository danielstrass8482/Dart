/**
 * i18n.js — Internationalization: translation keys + language switcher.
 */

export const SUPPORTED_LANGS = [
  { code: 'de', label: '🇩🇪 Deutsch',    ttsLang: 'de-DE', coachInstruction: 'Antworte ausschließlich auf Deutsch. Nutze deutsche Dart-Fachbegriffe.' },
  { code: 'en', label: '🇬🇧 English',    ttsLang: 'en-GB', coachInstruction: 'Respond exclusively in English. Use English darts terminology.' },
  // { code: 'nl', label: '🇳🇱 Nederlands', ttsLang: 'nl-NL', coachInstruction: 'Antwoord uitsluitend in het Nederlands. Gebruik Nederlandse dart-terminologie.' },
  // { code: 'es', label: '🇪🇸 Español',   ttsLang: 'es-ES', coachInstruction: 'Responde exclusivamente en español. Usa terminología de dardos en español.' },
  // { code: 'fr', label: '🇫🇷 Français',  ttsLang: 'fr-FR', coachInstruction: 'Réponds exclusivement en français. Utilise la terminologie fléchettes en français.' },
  // { code: 'it', label: '🇮🇹 Italiano',  ttsLang: 'it-IT', coachInstruction: 'Rispondi esclusivamente in italiano. Usa la terminologia delle freccette in italiano.' },
  // { code: 'pt', label: '🇧🇷 Português', ttsLang: 'pt-BR', coachInstruction: 'Responde exclusivamente em português. Usa terminologia de dardos em português.' },
  // { code: 'pl', label: '🇵🇱 Polski',    ttsLang: 'pl-PL', coachInstruction: 'Odpowiadaj wyłącznie po polsku. Używaj polskiej terminologii darts.' },
  // { code: 'sv', label: '🇸🇪 Svenska',   ttsLang: 'sv-SE', coachInstruction: 'Svara uteslutande på svenska. Använd svensk dartsterminologi.' },
  // { code: 'da', label: '🇩🇰 Dansk',     ttsLang: 'da-DK', coachInstruction: 'Svar udelukkende på dansk. Brug dansk dartsterminologi.' },
];

export const translations = {
  de: {
    // Navigation
    nav_spielen: "SPIELEN",
    nav_stats: "STATS",
    nav_turniere: "TURNIERE",
    nav_profil: "PROFIL",

    // Spielen Screen
    lokal_spielen: "LOKAL SPIELEN",
    lokal_sub: "Gegen Freunde oder Bot",
    online_spielen: "ONLINE SPIELEN",
    online_sub: "Gegen Freunde weltweit",
    turnier: "TURNIER",
    turnier_sub: "Lokal oder Online",
    coming_soon: "Demnächst",

    // Setup
    spielmodus: "SPIELMODUS",
    spieler_auswaehlen: "SPIELER AUSWÄHLEN",
    spieler_hint: "Tippe Spieler an um sie auszuwählen (Reihenfolge = Startreihenfolge)",
    sets: "SETS (Best of)",
    legs: "LEGS PRO SET (Best of)",
    bot_gegner: "BOT-GEGNER",
    kein_bot: "Kein Bot",
    spielkontext: "SPIELKONTEXT",
    spiel_starten: "SPIEL STARTEN",
    neuer_spieler: "Neuer Spieler…",
    weitere_modi: "▼ WEITERE MODI",

    // Spiel Screen
    am_zug: "AM ZUG",
    verbleibend: "VERBLEIBEND",
    checkout: "CHECKOUT",
    bouncer: "Bouncer",
    wurf: "WURF",
    zurueck: "Zurück",
    undo: "Undo",
    naechster_spieler: "NÄCHSTER SPIELER",
    zaehlen: "ZÄHLEN",
    weiter: "WEITER",
    runde: "Runde",
    dart_finish: "Pfeil Finish",

    // Statistiken
    stats_title: "Statistiken",
    heute: "Heute",
    sieben_tage: "7 Tage",
    monat: "Monat",
    drei_monate: "3 Monate",
    sechs_monate: "6 Monate",
    alles: "Alles",
    spiele: "SPIELE",
    siege: "SIEGE",
    average: "⌀ AUFNAHME",
    first9: "FIRST 9 Ø",
    highscore: "HIGHSCORE",
    checkout_quote: "CHECKOUT-QUOTE",
    darts: "⌀ DARTS",
    verlauf: "VERLAUF",
    spieler_vergleich: "SPIELER VERGLEICH",
    letzte_spiele: "LETZTE SPIELE",
    alle_spieler: "Alle Spieler",
    gewinner_col: "GEWINNER",
    modus_col: "MODUS",
    datum_col: "DATUM",
    erste_9: "erste 9 Darts",
    pro_leg: "pro Leg",
    quote: "Quote",

    // Profil
    profil_title: "Profil",
    spielerprofile: "SPIELERPROFILE",
    account: "ACCOUNT",
    registriert: "REGISTRIERT",
    gast_account: "GAST-ACCOUNT",
    abmelden: "Abmelden",
    konto_loeschen: "Konto löschen",
    konto_loeschen_titel: "Konto löschen?",
    konto_loeschen_text: "Diese Aktion ist unwiderruflich. Alle Spieldaten, Spielerprofile und das Konto werden dauerhaft gelöscht.",
    konto_loeschen_reauth: "Bitte melde dich kurz ab und erneut an, dann nochmal versuchen.",
    tutorial: "Tutorial wiederholen",
    stimme_sound: "STIMME & SOUND",
    app_einstellungen: "APP-EINSTELLUNGEN",
    sprachausgabe: "Sprachausgabe",
    sprachausgabe_sub: "Scores werden angesagt",
    sprachsteuerung: "Sprachsteuerung",
    sprachsteuerung_sub: "Würfe per Stimme eingeben",
    checkout_highlight: "Checkout-Highlight",
    checkout_highlight_sub: "Finish-Wege hervorheben",
    gesundheit: "Gesundheitsdaten abfragen",
    gesundheit_sub: "Vor dem Spiel nach Schlaf & Befinden fragen",
    design: "DESIGN",
    sprache: "SPRACHE",

    // Coach
    coach_analyse: "COACH ANALYSIEREN",
    coach_limit: "Analysen heute",
    coach_analysiere: "Analysiere…",
    coach_denkt: "Coach denkt nach…",
    coach_neue_analyse: "NEUE ANALYSE",
    coach_verfuegbar: "verfügbar",
    coach_verbleibend: "verbleibend",
    coach_nicht_verfuegbar: "Coach ist momentan nicht verfügbar. Bitte später nochmal versuchen.",
    coach_limit_erreicht: "TAGESLIMIT ERREICHT",
    coach_limit_tag_msg: "Du hast heute dein Limit ({n} Analysen) erreicht. Morgen wieder!",
    coach_bereits_genutzt: "Du hast heute bereits {used} von {limit} Coach-Analysen genutzt.",
    reset_mitternacht: "Reset um Mitternacht.",
    coach_header_text: "COACH-ANALYSE",

    // Winner overlay
    gewinner: "GEWINNER",
    neues_spiel: "NEUES SPIEL",
    naechstes_set: "NÄCHSTES SET ▶",
    naechstes_leg: "NÄCHSTES LEG",
    leg_analysieren: "LEG ANALYSIEREN",

    // Allgemein
    speichern: "SPEICHERN",
    abbrechen: "Abbrechen",
    bearbeiten: "Bearbeiten",
    loeschen: "Löschen",
    premium: "PREMIUM",
    beta_nutzer: "BETA-NUTZER",
    lade: "Lade…",
    keine_spiele: "Keine Spiele im gewählten Zeitraum.",

    // Spieler
    noch_keine_spieler: "Noch keine Spieler angelegt",
    spieler_existiert: "Spieler existiert bereits!",
    min_1_spieler: "Bitte mindestens 1 Spieler auswählen!",
    killer_min_2: "Killer braucht mindestens 2 Spieler!",
    spieler_gewaehlt: "Spieler gewählt",
    spieler_hint_simple: "Tippe Spieler an — Reihenfolge = Startreihenfolge",
    mit_google_anmelden: "Mit Google anmelden",

    // Online
    warte_mitspieler: "Warte auf Mitspieler…",
    spieler_verbunden: "Spieler verbunden",
    raum_erstellen: "RAUM ERSTELLEN",
    raum_beitreten: "RAUM BEITRETEN",
    beitreten_btn: "BEITRETEN",
    online_raum_code: "RAUM-CODE",
    raum_code_hint: "Teile diesen Code mit deinem Gegner",

    // Turniere
    turnier_erstellen: "TURNIER ERSTELLEN",
    noch_keine_turniere: "Noch keine Turniere",
    lade_turnier: "Lade Turnier…",
    format: "FORMAT",
    jeder_gegen_jeden: "Jeder gegen Jeden",
    ko_system: "K.O.-System",

    // Spiel UI
    wuerfe: "WÜRFE",
    legende: "LEGENDE",
    sub_stats: "STATISTIKEN",
    sub_analyse: "ANALYSE",
    lade_statistiken: "Lade Statistiken…",
    geraet_drehen: "GERÄT DREHEN",
    geraet_drehen_sub: "Querformat für das Spiel erforderlich",
    neue_stimme: "+ NEUE STIMME HINZUFÜGEN",
    health_connect: "HEALTH CONNECT",
    rechtliches: "RECHTLICHES",

    // x01 Gewinner-Overlay
    aufnahme_avg: "Ø Aufnahme",
    sieger: "SIEGER",
    vorher: "VORHER",
    jetzt: "JETZT",
    gesamtstatistik: "GESAMTSTATISTIK",
    verbesserung: "↑ Verbesserung",
    rueckgang: "↓ Leichter Rückgang",
    unveraendert: "→ Unverändert",
    spiele_label: "Spiele",

    // Stats Chart
    aufnahme_chip: "⌀ Aufnahme",
    ein_monat: "1 Monat",
    alle_spiele: "Alle Spiele",
    alle_legs: "Alle Legs",
    keine_daten: "Keine Daten",
    wuerfe_label: "Würfe",
    trend_partien: "Partien",
    trend_tage: "Tage",
    trend_min_partien: "Spiele mindestens 2 Partien um den Trend zu sehen.",
    trend_min_tage: "Spiele an mindestens 2 verschiedenen Tagen um den Tagestrend zu sehen.",

    // Party-Modi
    fortschritt: "FORTSCHRITT",
    fertig_check: "FERTIG ✓",
    ziel: "Ziel:",
    zaehlen_weiter: "ZÄHLEN & WEITER",
    zahl: "Zahl",
    treffer_label: "Treffer",
    atc_info: "Treffe alle Felder 1–20 der Reihe nach",
    shanghai_info: "Runde {r}: Treffe die {r} · Shanghai = sofortiger Sieg",
    highscore_info: "{n} Runden · Höchste Gesamtpunktzahl gewinnt",
    killer_info: "Erst eigene Zahl per Double treffen, dann andere eliminieren",
    elimination_info: "501 · Triffst du exakt den Score eines Gegners → er startet neu",
    bob27_info: "Treffe {f} · Treffer: +{plus} · Daneben: -{minus}",
    checkout_training_info: "Checkout in max. 3 Darts",

    // Bot
    bot_anfaenger: "Anfänger",
    bot_mittel: "Mittel",
    bot_profi: "Profi",

    // Turnier
    darts_abend: "Darts-Abend",
    tn_laeuft: "LÄUFT",
    tn_fertig: "FERTIG",
    tn_setup: "SETUP",
    tn_spieler: "Spieler",
    tn_min_2_spieler: "Mindestens 2 Spieler auswählen!",
    tabelle: "TABELLE",
    spiele_uebersicht: "SPIELE",
    keine_bracket_daten: "Keine Bracket-Daten",
    freilos: "Freilos",
    warte_vorherige_runde: "Warte auf vorherige Runde…",
    spielen_btn: "SPIELEN",

    // Auth / App
    bitte_spieler_auswaehlen: "Bitte zuerst einen Spieler auswählen.",
    aufnahme_laeuft: "⏺ Aufnahme läuft…",
    aufnahme_vorschau: "Vorschau — Senden wenn ok",
    aufnahme_neu: "📹 NEU AUFNEHMEN",
    kamera_fehler: "Kamera nicht verfügbar: ",
    auth_email_pw: "Bitte Email und Passwort eingeben.",
    auth_invalid_cred: "Ungültige Email oder Passwort.",
    auth_no_account: "Kein Account mit dieser Email.",
    auth_reset_sent: "Reset-Email gesendet!",
    auth_email_only: "Bitte Email eingeben.",
    auth_name_only: "Bitte Name eingeben.",
    auth_pw_short: "Passwort min. 6 Zeichen.",
    auth_pw_mismatch: "Passwörter stimmen nicht überein.",
    auth_fill_all: "Alle Felder ausfüllen (PW min. 6 Zeichen).",
    auth_email_taken: "Diese Email ist bereits registriert.",
    auth_email_taken2: "Diese Email ist bereits vergeben.",
    auth_verify_sent: "Registrierung erfolgreich! Bitte verifiziere deine Email-Adresse — dann kannst du dich einloggen.",
    auth_not_verified: "Email noch nicht verifiziert. Bitte prüfe dein Postfach.",
    account_erstellt: "Account erstellt! Deine Spieldaten wurden übernommen.",
    aktiv: "Aktiv",
    aktivieren: "Aktivieren",
    nicht_angemeldet: "Nicht angemeldet",

    // Profil Beta
    beta_zugr: "Du hast Zugriff auf alle Features während der Beta. Registriere dich jetzt um deine Beta-Vorteile dauerhaft zu sichern wenn Premium startet.",
    account_erstellen_btn: "ACCOUNT ERSTELLEN →",
    beta_grandfathered_title: "✅ BETA-NUTZER (Grandfathered)",
    beta_gesichert: "Deine Beta-Vorteile sind gesichert. Du bekommst Premium dauerhaft kostenlos.",

    // Setup Bestätigung
    spieler_loeschen_confirm: "Spieler \"{name}\" wirklich löschen?\n\nDie Spielhistorie bleibt erhalten, der Spieler kann aber nicht mehr ausgewählt werden.",

    // Multiplayer
    db_nicht_bereit: "Datenbank nicht bereit",
    erstelle_raum: "Erstelle Raum…",
    fehler_prefix: "Fehler: ",
    gast_name: "Gast",
    code_6_stellig: "Bitte einen 6-stelligen Code eingeben",
    verbinde: "Verbinde…",
    raum_bereits_gestartet: "Dieser Raum ist bereits gestartet",
    spieler_bereit: "{n} Spieler bereit — du kannst starten",

    // Sprachsteuerung
    spracherkennung_nicht_verfuegbar: "Spracherkennung nicht verfügbar",
    spreche: "🎤 Spreche…",

    // Turnier Bracket-Runden
    noch_keine_turniere_hint: "Noch keine Turniere — erstelle dein erstes!",
    finale: "Finale",
    halbfinale: "Halbfinale",

    // Zielübung Feedback
    target_perfekt: "🎯 PERFEKT!",
    target_richtiges_segment: "✅ Richtiges Segment, falscher Ring",
    target_benachbart: "👍 Benachbartes Segment",
    target_weit_daneben: "❌ Weit daneben",

    // Statistiken Segmenttabelle
    keine_treffer_koord: "Keine Treffer-Koordinaten vorhanden.",
    lieblings: "Lieblings:",
    feld_col: "FELD",
    ges_col: "GES",

    // Setup Tooltip / Fehler
    spieler_loeschen_tooltip: "Spieler löschen",
    fehler_loeschen: "Fehler beim Löschen: ",

    // Premium Features
    feat_coach_name: "KI-Coach Analyse",
    feat_coach_desc: "Detaillierte KI-Analyse deines Spiels",
    feat_video_name: "Video-Wurfanalyse",
    feat_video_desc: "KI analysiert deine Wurftechnik",
    feat_stats_name: "Erweiterte Statistiken",
    feat_stats_desc: "Doppelfeld-Matrix, Health-Korrelation, Trends",
    feat_voice_name: "Stimme anpassen",
    feat_voice_desc: "Eigene Stimme oder Premium-Voices",
    feat_bot_name: "Bot-Persönlichkeiten",
    feat_bot_desc: "Nervöser, Kaltblütiger, Glücksspieler Bot",
    feat_tn_name: "Turnier-Modus",
    feat_tn_desc: "Lokale und Online-Turniere",
    feat_health_name: "Health-Integration",
    feat_health_desc: "Schlaf und Fitness mit Spielleistung verknüpfen",
    feat_voicelang_name: "Ansagen in Landessprache",
    feat_voicelang_desc: "Scores werden in deiner gewählten Sprache angesagt",
    beta_kostenlos_alle: "🎉 Während der Beta kostenlos für alle!",
    beta_sichern_features: "Registriere dich jetzt um deine Features dauerhaft zu sichern.",
    weiter_beta: "WEITER (BETA)",
    schliessen: "Schließen",
    paywall_titel: "Premium Feature",
    paywall_untertitel: "Dieses Feature ist Teil von DARTTRAINER Premium.",
    paywall_beta_hinweis: "Während der Beta für alle kostenlos verfügbar.",
    paywall_freischalten: "Jetzt freischalten",
    paywall_kleintext: "Nach der Beta kostenpflichtig.",

    // Studio
    studio_von: "von",
    studio_aufgenommen: "aufgenommen",
    studio_aufnehmen: "⏺ Aufnehmen",
    studio_nochmal: "⏺ Nochmal",
    studio_stop: "⏹ Stop",
    studio_bereit: "Aufnahme bereit — anhören oder speichern",
    studio_laeuft: "🔴 Aufnahme läuft…",
    studio_mic_fehler: "Mikrofon-Fehler: ",
    studio_speichere: "Speichere…",
    studio_gespeichert: "✓ Gespeichert!",
    studio_loeschen_confirm: "Aufnahme für \"{label}\" löschen?",
    studio_hint_miss: "Daneben / Bust",
    studio_hint_bust: "Wenn zu viele Punkte",

    // Onboarding
    ob_skip: "Überspringen",
    ob_title_1: "WILLKOMMEN BEI DARTTRAINER",
    ob_text_1: "Dein intelligenter Dart-Trainer.\nKI-Coach, Statistiken und mehr —\nalles in einer App.",
    ob_btn_start: "LOS GEHT'S →",
    ob_title_2: "TREFFER EINTRAGEN",
    ob_text_2: "Tippe einfach auf die Stelle der Scheibe\nwo dein Dart gelandet ist.\nDie App erkennt das Segment automatisch.",
    ob_btn_weiter: "WEITER →",
    ob_title_3: "SPIELER & MODI",
    ob_text_3: "Lege Spieler an und wähle deinen\nSpielmodus — 501, Cricket, Turniere\noder Party-Modi für gesellige Abende.",
    ob_title_4: "DEIN KI-COACH",
    ob_text_4: "Nach jedem Spiel analysiert dein\npersönlicher KI-Coach deine Statistiken.\nLade ein kurzes Video hoch für eine\nAnalyse deiner Wurftechnik.",
    ob_badge_4: "🎉 Während der Beta kostenlos!",
    ob_title_5: "BEREIT ZU SPIELEN",
    ob_text_5: "Leg einen Spieler an und starte\ndein erstes Spiel. Viel Erfolg!",
    ob_btn_play: "SPIELEN →",

    // Studio (weitere)
    studio_geloescht: "Gelöscht",

    // Bot-Persönlichkeiten Beschreibungen
    bot_desc_methodisch: "Spielt immer optimal und konstant",
    bot_desc_uebermuetig: "Zielt immer auf T20, ignoriert bessere Optionen",
    bot_desc_nervoese: "Verliert Konzentration wenn es drauf ankommt",
    bot_desc_gluecksspieler: "Zielt immer auf Maximum, riskiert Bust",
    bot_desc_kaltbluetig: "Wird besser unter Druck",
    bot_desc_aufholer: "Kämpft sich von hinten vor",

    // Weitere App-Strings
    tn_default: "Turnier",

    // Turnier Status Badge
    tn_abgeschlossen: "ABGESCHLOSSEN",

    // Doppelfeld-Statistik
    doppelfeld_stat: "DOPPELFELD-STATISTIK",
    doppelfeld_hilfe: "Die App erkennt automatisch wann du auf ein Doppelfeld zielst und trackt deine Trefferquote. So siehst du welche Doppelfelder deine Stärken und Schwächen sind.",
    bestes_doppel: "BESTES DOPPEL",
    schwaechstes_doppel: "SCHWÄCHSTES DOPPEL",
    meist_gespielt: "MEIST GESPIELT",
    versuche_col: "VERSUCHE",
    treffer_col: "TREFFER",
    quote_col: "QUOTE",
    versuche_label: "Versuche",

    // Bot-Persönlichkeiten Labels
    bot_persoenlichkeit: "PERSÖNLICHKEIT",
    bot_methodisch: "Methodisch",
    bot_uebermuetig: "Übermütig",
    bot_nervoese: "Nervös",
    bot_gluecksspieler: "Glücksspieler",
    bot_kaltbluetig: "Kaltblütig",
    bot_aufholer: "Aufholer",
    bot_spielt_optimal: "Spielt immer optimal und konstant",

    // Spielkontext Buttons
    kontext_auto: "Auto",
    kontext_training: "Training",
    kontext_casual: "Casual",
    kontext_turnier: "Turnier",

    // Allgemeine Buttons
    hinzufuegen: "+ Hinzufügen",
    alle_kontext: "Alle",
    spiele_count: "Spiele",
    turnier_filter: "Turnier",
    gespeicherte_analysen: "GESPEICHERTE ANALYSEN",

    // Erweiterte Statistiken
    erweiterte_stats: "ERWEITERTE STATISTIKEN",
    zeit_filter: "Zeit",
    spiel_filter: "Spiel",
    segment_analyse: "SEGMENT-ANALYSE",
    board_a: "BOARD A",
    board_b: "BOARD B",

    // Profil Legal
    legal_title: "LEGAL",
    datenschutz: "Datenschutzerklärung",
    impressum: "Impressum",
    app_version: "DARTTRAINER · Persönliches Dart Scoring & Tracking",
    legal_datenschutz_text: "Daten werden in Firebase (Google) gespeichert, keine Weitergabe an Dritte",
    legal_entwickelt: "Entwickelt von Daniel Straß 2026",

    // Feedback & Beta-Banner
    feedback_titel: "FEEDBACK",
    feedback_geben: "Feedback geben",
    feedback_untertitel: "Was können wir besser machen? Dein Feedback geht direkt an das Entwicklerteam.",
    feedback_placeholder: "Dein Feedback…",
    feedback_senden: "SENDEN",
    feedback_leer: "Bitte gib ein Feedback ein.",
    feedback_erfolg: "Danke!",
    feedback_fehler: "Senden fehlgeschlagen. Bitte später erneut versuchen.",
    beta_banner_text: "Die App befindet sich in der Beta-Phase — dein Feedback ist herzlich willkommen.",
    beta_banner_link: "Feedback geben →",

    // Checkout Ansagen
    checkout_ansagen_label: "Checkout Ansagen",
    checkout_ansagen_sub: "Checkout-Pfad vor jedem Wurf ansagen",

    // Health Connect
    health_verbinden: "HEALTH CONNECT VERBINDEN",
    health_sub: "Verbinde Garmin, Oura, Fitbit und mehr für automatische Gesundheitsdaten.",
    mehr_erfahren: "Mehr erfahren →",
    health_browser_hinweis: "Automatische Verbindung nur in der Android App verfügbar. Im Browser: manuelle Eingabe vor dem Spiel.",

    // ElevenLabs Voice Placeholders
    el_name_placeholder: "Name (z.B. Meine Stimme)",
    el_id_placeholder: "ElevenLabs Voice ID",

    // Help-Modal Inhalte (showHelp)
    help_coach_analyse_title: "KI-Coach Analyse",
    help_coach_analyse_text: "Der KI-Coach analysiert deine Spielstatistiken und gibt konkrete Verbesserungstipps basierend auf deinen Doppelfeld-Quoten, First-9-Schnitt und Trends.",
    help_video_analyse_title: "Wurf-Analyse (Video)",
    help_video_analyse_text: "Lade ein 3–5 Sekunden Video deines Wurfs hoch. Claude analysiert Haltung, Arm und Followthrough und gibt konkrete Verbesserungshinweise.",
    help_turnier_title: "Turnier-Modus",
    help_turnier_text: "Spiele ein Turnier mit bis zu 8 Spielern. Jeder gegen Jeden oder K.O.-System. Auch online mit Freunden möglich.",

    // App-Status-Meldungen
    video_limit_msg: "Du hast heute dein Video-Analyse-Limit ({n}x) erreicht.",
    stimme_aktiviert_msg: "✓ Stimme aktiviert — {name} ist jetzt aktiv",

    // Health-Chips (Belastung)
    health_mittel: "Mittel",

    // Lade-Platzhalter mit Kontext
    lade_spieler: "Lade Spieler…",

    // Online-Sektion
    online_sub_long: "Spiele gegen Freunde auf anderen Geräten in Echtzeit",
    online_create_hint: "Wähle Modus und Einstellungen, dann teile den Code mit deinem Gegner",

    // Studio
    studio_beschreibung: "Nimm deine eigene Stimme für die Ansagen auf. Alle aufgenommenen Zahlen ersetzen die synthetische Stimme.",

    // Video-Analyse
    video_auswaehlen: "Bitte zuerst ein Video auswählen",
    extrahiere_frames: "⏳ Extrahiere Frames…",
    analysiere_technik: "Analysiere deine Wurftechnik…",
    claude_analysiert: "⏳ Claude analysiert…",
    wurf_analyse_titel: "WURF-ANALYSE",
    video_analysen_remaining: "{n} Video-Analysen heute verbleibend",
    erneut_analysieren: "ERNEUT ANALYSIEREN",
    keine_antwort: "Keine Antwort erhalten.",
    wurf_analysieren: "🎥 WURF ANALYSIEREN",
    frames_werden_analysiert: "{n} Frames werden analysiert",
    video_vom_handy: "Video vom Handy erhalten — analysiere…",
    // Video-Session (Handy)
    warte_auf_handy: "⏳ Warte auf Handy…",
    handy_verbunden: "✅ Handy verbunden — nimmt auf…",
    tablet_wartet: "Code: {code} — Tablet wartet",
    wird_hochgeladen: "📤 Wird hochgeladen…",
    upload_laeuft: "Upload läuft…",
    upload_fertig: "✅ Fertig! Das Tablet analysiert jetzt.",
    video_gesendet: "✅ Gesendet",
    an_tablet_senden: "📤 AN TABLET SENDEN",
    // Voice-Studio
    voice_freischalten: "FREISCHALTEN",
    voice_pflichtfelder: "Name und Voice ID sind Pflichtfelder.",
    voice_max_stimmen: "Maximum 10 eigene Stimmen erreicht.",
    voice_id_exists: "Diese Voice ID ist bereits in der Liste.",
    voice_hinzugefuegt: "✓ \"{name}\" wurde hinzugefügt",
    // Spieler bearbeiten
    spieler_bearbeiten: "SPIELER BEARBEITEN",
    foto_aendern: "Foto ändern",
    spitzname_label: "SPITZNAME (für Spielanzeige)",
    spitzname_placeholder: "z.B. DanTheDart",
    dart_marke: "DART-MARKE",
    dart_marke_placeholder: "z.B. Target, Winmau, Unicorn",
    dart_gewicht: "DART-GEWICHT (Gramm)",
    dart_gewicht_placeholder: "z.B. 23",
    bevorzugte_doppelfelder: "BEVORZUGTE DOPPELFELDER",
    bevorzugte_doppelfelder_sub: "Checkout priorisiert diese Felder",
    name_erforderlich: "Name ist erforderlich.",
    speichere: "Speichere…",
    // X01-Overlays
    noch_sets_zum_sieg: "Noch {n} Set(s) zum Sieg",
    noch_legs_zum_set: "Noch {n} Leg(s) zum Set",
    // Multiplayer
    online_spieler_header: "SPIELER",
    du_suffix: "(du)",
    raum_nicht_gefunden: "Raum nicht gefunden",

    // Auth
    anmelden: "ANMELDEN",
    registrieren: "REGISTRIEREN",
    mit_google_registrieren: "MIT GOOGLE REGISTRIEREN",
    mit_google_upgraden: "MIT GOOGLE UPGRADEN",
    passwort_vergessen: "Passwort vergessen?",
    als_gast: "Als Gast spielen",
    account_erstellen: "ACCOUNT ERSTELLEN",
    spieldaten_warnung: "Spieldaten gehen verloren wenn du dich abmeldest. Jetzt Account erstellen:",
    // Auth placeholders
    passwort_placeholder: "Passwort",
    passwort_min_placeholder: "Passwort (min. 6 Zeichen)",
    passwort_wdh_placeholder: "Passwort wiederholen",
    dein_name_placeholder: "Dein Name",

    // Health
    koerperliche_belastung: "KÖRPERLICHE BELASTUNG",
    wie_fuehlst_du_dich: "WIE FÜHLST DU DICH",
    health_kaum: "Kaum",
    health_leicht: "Leicht",
    health_viel: "Viel",
    health_muede: "😴 Müde",

    // Video-Modal / Analyse
    qr_hint: "QR-Code scannen oder Code eingeben",
    coach_analyse_titel: "COACH-ANALYSE",
    coach_analyse_starten: "COACH-ANALYSE STARTEN",
    video_hint: "Kurzes Video (3–5 Sek.) — von der Seite, Hüfthöhe.",
    mit_handy_aufnehmen: "MIT HANDY AUFNEHMEN",
    tablet_kamera: "TABLET-KAMERA",
    hochladen: "HOCHLADEN",
    wurf_analysieren_btn: "WURF ANALYSIEREN",
    analyse_fuer: "ANALYSE FÜR",
    statistik_analyse: "STATISTIK-ANALYSE",
    wurf_analyse_video: "WURF-ANALYSE (VIDEO)",

    // Admin
    premium_simulieren: "Non-Premium-Ansicht testen",
    premium_simulieren_sub: "Admin: Premium temporär deaktivieren um Nicht-Premium-Ansicht zu sehen",

    // Premium Lock
    premium_gesperrt: "PREMIUM FEATURE",
    premium_freischalten_kurz: "Jetzt freischalten",

    bot_premium_hinweis: "Bot-Gegner ist ein Premium-Feature",
    voice_id_gespeichert: "✓ Gespeichert",
    voice_id_fehler: "✗ Fehler",
    voice_id_speichern: "ID speichern",

    // Misc
    anzahl_runden: "ANZAHL RUNDEN",
    erstellen_btn: "ERSTELLEN",

    // App-Modal
    modal_ok: "OK",
    turnier_max_spieler: "Für Spiele mit mehr als 2 Spielern kommt bald ein dedizierter Turniermodus.",
    bot_deaktiviert: "Bot wurde deaktiviert, da zwei Spieler ausgewählt sind.",
    bot_nur_ein_spieler: "Bot ist nur bei einem Spieler verfügbar. Entferne einen Spieler um den Bot zu aktivieren.",
  },

  en: {
    // Navigation
    nav_spielen: "PLAY",
    nav_stats: "STATS",
    nav_turniere: "TOURNAMENTS",
    nav_profil: "PROFILE",

    // Spielen Screen
    lokal_spielen: "LOCAL GAME",
    lokal_sub: "Against friends or bot",
    online_spielen: "ONLINE GAME",
    online_sub: "Against friends worldwide",
    turnier: "TOURNAMENT",
    turnier_sub: "Local or Online",
    coming_soon: "Coming Soon",

    // Setup
    spielmodus: "GAME MODE",
    spieler_auswaehlen: "SELECT PLAYERS",
    spieler_hint: "Tap players to select them (order = start order)",
    sets: "SETS (Best of)",
    legs: "LEGS PER SET (Best of)",
    bot_gegner: "BOT OPPONENT",
    kein_bot: "No Bot",
    spielkontext: "GAME CONTEXT",
    spiel_starten: "START GAME",
    neuer_spieler: "New player…",
    weitere_modi: "▼ MORE MODES",

    // Spiel Screen
    am_zug: "AT THE OCHE",
    verbleibend: "REMAINING",
    checkout: "CHECKOUT",
    bouncer: "Bouncer",
    wurf: "ROUND",
    zurueck: "Back",
    undo: "Undo",
    naechster_spieler: "NEXT PLAYER",
    zaehlen: "COUNT",
    weiter: "NEXT",
    runde: "Round",
    dart_finish: "Dart Finish",

    // Statistiken
    stats_title: "Statistics",
    heute: "Today",
    sieben_tage: "7 Days",
    monat: "Month",
    drei_monate: "3 Months",
    sechs_monate: "6 Months",
    alles: "All",
    spiele: "GAMES",
    siege: "WINS",
    average: "⌀ AVERAGE",
    first9: "FIRST 9 Ø",
    highscore: "HIGHSCORE",
    checkout_quote: "CHECKOUT %",
    darts: "⌀ DARTS",
    verlauf: "TREND",
    spieler_vergleich: "PLAYER COMPARISON",
    letzte_spiele: "LAST GAMES",
    alle_spieler: "All Players",
    gewinner_col: "WINNER",
    modus_col: "MODE",
    datum_col: "DATE",
    erste_9: "first 9 darts",
    pro_leg: "per leg",
    quote: "Rate",

    // Profil
    profil_title: "Profile",
    spielerprofile: "PLAYER PROFILES",
    account: "ACCOUNT",
    registriert: "REGISTERED",
    gast_account: "GUEST ACCOUNT",
    abmelden: "Sign out",
    konto_loeschen: "Delete account",
    konto_loeschen_titel: "Delete account?",
    konto_loeschen_text: "This action is irreversible. All game data, player profiles, and the account will be permanently deleted.",
    konto_loeschen_reauth: "Please sign out and sign back in, then try again.",
    tutorial: "Repeat tutorial",
    stimme_sound: "VOICE & SOUND",
    app_einstellungen: "APP SETTINGS",
    sprachausgabe: "Voice output",
    sprachausgabe_sub: "Scores will be announced",
    sprachsteuerung: "Voice control",
    sprachsteuerung_sub: "Enter throws by voice",
    checkout_highlight: "Checkout highlight",
    checkout_highlight_sub: "Highlight finish paths",
    gesundheit: "Health data",
    gesundheit_sub: "Ask about sleep & wellbeing before game",
    design: "DESIGN",
    sprache: "LANGUAGE",

    // Coach
    coach_analyse: "ANALYSE GAME",
    coach_limit: "analyses today",
    coach_analysiere: "Analysing…",
    coach_denkt: "Coach thinking…",
    coach_neue_analyse: "NEW ANALYSIS",
    coach_verfuegbar: "available",
    coach_verbleibend: "remaining",
    coach_nicht_verfuegbar: "Coach is currently unavailable. Please try again later.",
    coach_limit_erreicht: "DAILY LIMIT REACHED",
    coach_limit_tag_msg: "You've reached your daily limit ({n} analyses). Try again tomorrow!",
    coach_bereits_genutzt: "You've already used {used} of {limit} coach analyses today.",
    reset_mitternacht: "Resets at midnight.",
    coach_header_text: "COACH ANALYSIS",

    // Winner overlay
    gewinner: "WINNER",
    neues_spiel: "NEW GAME",
    naechstes_set: "NEXT SET ▶",
    naechstes_leg: "NEXT LEG",
    leg_analysieren: "ANALYSE LEG",

    // Allgemein
    speichern: "SAVE",
    abbrechen: "Cancel",
    bearbeiten: "Edit",
    loeschen: "Delete",
    premium: "PREMIUM",
    beta_nutzer: "BETA USER",
    lade: "Loading…",
    keine_spiele: "No games in selected time range.",

    // Spieler
    noch_keine_spieler: "No players created yet",
    spieler_existiert: "Player already exists!",
    min_1_spieler: "Please select at least 1 player!",
    killer_min_2: "Killer needs at least 2 players!",
    spieler_gewaehlt: "players selected",
    spieler_hint_simple: "Tap players — order = start order",
    mit_google_anmelden: "Sign in with Google",

    // Online
    warte_mitspieler: "Waiting for opponent…",
    spieler_verbunden: "players connected",
    raum_erstellen: "CREATE ROOM",
    raum_beitreten: "JOIN ROOM",
    beitreten_btn: "JOIN",
    online_raum_code: "ROOM CODE",
    raum_code_hint: "Share this code with your opponent",

    // Turniere
    turnier_erstellen: "CREATE TOURNAMENT",
    noch_keine_turniere: "No tournaments yet",
    lade_turnier: "Loading tournament…",
    format: "FORMAT",
    jeder_gegen_jeden: "Round Robin",
    ko_system: "Knockout",

    // Spiel UI
    wuerfe: "THROWS",
    legende: "LEGEND",
    sub_stats: "STATISTICS",
    sub_analyse: "ANALYSIS",
    lade_statistiken: "Loading statistics…",
    geraet_drehen: "ROTATE DEVICE",
    geraet_drehen_sub: "Landscape mode required for gameplay",
    neue_stimme: "+ ADD NEW VOICE",
    health_connect: "HEALTH CONNECT",
    rechtliches: "LEGAL",

    // x01 Winner Overlay
    aufnahme_avg: "⌀ Average",
    sieger: "WINNER",
    vorher: "BEFORE",
    jetzt: "NOW",
    gesamtstatistik: "OVERALL STATS",
    verbesserung: "↑ Improvement",
    rueckgang: "↓ Slight Decline",
    unveraendert: "→ Unchanged",
    spiele_label: "Games",

    // Stats Chart
    aufnahme_chip: "⌀ Average",
    ein_monat: "1 Month",
    alle_spiele: "All Games",
    alle_legs: "All Legs",
    keine_daten: "No Data",
    wuerfe_label: "Throws",
    trend_partien: "Games",
    trend_tage: "Days",
    trend_min_partien: "Play at least 2 games to see the trend.",
    trend_min_tage: "Play on at least 2 different days to see the daily trend.",

    // Party Modes
    fortschritt: "PROGRESS",
    fertig_check: "DONE ✓",
    ziel: "Target:",
    zaehlen_weiter: "COUNT & NEXT",
    zahl: "Number",
    treffer_label: "Hits",
    atc_info: "Hit all fields 1–20 in order",
    shanghai_info: "Round {r}: Hit {r} · Shanghai = instant win",
    highscore_info: "{n} Rounds · Highest total score wins",
    killer_info: "Hit your number on Double first, then eliminate others",
    elimination_info: "501 · Match an opponent's exact score to reset theirs",
    bob27_info: "Hit {f} · Hit: +{plus} · Miss: -{minus}",
    checkout_training_info: "Checkout in max. 3 darts",

    // Bot
    bot_anfaenger: "Beginner",
    bot_mittel: "Medium",
    bot_profi: "Pro",

    // Tournament
    darts_abend: "Darts Evening",
    tn_laeuft: "RUNNING",
    tn_fertig: "FINISHED",
    tn_setup: "SETUP",
    tn_spieler: "Players",
    tn_min_2_spieler: "Select at least 2 players!",
    tabelle: "TABLE",
    spiele_uebersicht: "MATCHES",
    keine_bracket_daten: "No bracket data",
    freilos: "Bye",
    warte_vorherige_runde: "Waiting for previous round…",
    spielen_btn: "PLAY",

    // Auth / App
    bitte_spieler_auswaehlen: "Please select a player first.",
    aufnahme_laeuft: "⏺ Recording…",
    aufnahme_vorschau: "Preview — Send when ready",
    aufnahme_neu: "📹 RECORD AGAIN",
    kamera_fehler: "Camera unavailable: ",
    auth_email_pw: "Please enter email and password.",
    auth_invalid_cred: "Invalid email or password.",
    auth_no_account: "No account with this email.",
    auth_reset_sent: "Reset email sent!",
    auth_email_only: "Please enter email.",
    auth_name_only: "Please enter name.",
    auth_pw_short: "Password min. 6 chars.",
    auth_pw_mismatch: "Passwords do not match.",
    auth_fill_all: "Fill in all fields (password min. 6 chars).",
    auth_email_taken: "This email is already registered.",
    auth_email_taken2: "This email is already in use.",
    auth_verify_sent: "Registration successful! Please verify your email — then you can sign in.",
    auth_not_verified: "Email not verified yet. Please check your inbox.",
    account_erstellt: "Account created! Your game data has been transferred.",
    aktiv: "Active",
    aktivieren: "Activate",
    nicht_angemeldet: "Not signed in",

    // Profile Beta
    beta_zugr: "You have access to all features during the Beta. Register now to secure your Beta perks permanently when Premium launches.",
    account_erstellen_btn: "CREATE ACCOUNT →",
    beta_grandfathered_title: "✅ BETA USER (Grandfathered)",
    beta_gesichert: "Your Beta perks are secured. You get Premium permanently for free.",

    // Setup Confirm
    spieler_loeschen_confirm: "Really delete \"{name}\"?\n\nGame history is preserved but the player can no longer be selected.",

    // Multiplayer
    db_nicht_bereit: "Database not ready",
    erstelle_raum: "Creating room…",
    fehler_prefix: "Error: ",
    gast_name: "Guest",
    code_6_stellig: "Please enter a 6-digit code",
    verbinde: "Connecting…",
    raum_bereits_gestartet: "This room has already started",
    spieler_bereit: "{n} players ready — you can start",

    // Voice recognition
    spracherkennung_nicht_verfuegbar: "Voice recognition unavailable",
    spreche: "🎤 Speaking…",

    // Tournament bracket rounds
    noch_keine_turniere_hint: "No tournaments yet — create your first!",
    finale: "Final",
    halbfinale: "Semi-Final",

    // Target practice feedback
    target_perfekt: "🎯 PERFECT!",
    target_richtiges_segment: "✅ Right segment, wrong ring",
    target_benachbart: "👍 Adjacent segment",
    target_weit_daneben: "❌ Way off",

    // Stats segment table
    keine_treffer_koord: "No hit coordinates available.",
    lieblings: "Favourite:",
    feld_col: "FIELD",
    ges_col: "TOT",

    // Setup tooltip / error
    spieler_loeschen_tooltip: "Delete player",
    fehler_loeschen: "Error deleting: ",

    // Premium features
    feat_coach_name: "AI Coach Analysis",
    feat_coach_desc: "Detailed AI analysis of your game",
    feat_video_name: "Video Throw Analysis",
    feat_video_desc: "AI analyses your throwing technique",
    feat_stats_name: "Advanced Statistics",
    feat_stats_desc: "Double field matrix, health correlation, trends",
    feat_voice_name: "Customise Voice",
    feat_voice_desc: "Custom voice or Premium voices",
    feat_bot_name: "Bot Personalities",
    feat_bot_desc: "Nervous, Cold, Gambler Bot",
    feat_tn_name: "Tournament Mode",
    feat_tn_desc: "Local and online tournaments",
    feat_health_name: "Health Integration",
    feat_health_desc: "Link sleep and fitness with game performance",
    feat_voicelang_name: "Announcements in your language",
    feat_voicelang_desc: "Scores announced in your chosen language",
    beta_kostenlos_alle: "🎉 Free for everyone during Beta!",
    beta_sichern_features: "Register now to permanently secure your features.",
    weiter_beta: "CONTINUE (BETA)",
    schliessen: "Close",
    paywall_titel: "Premium Feature",
    paywall_untertitel: "This feature is part of DARTTRAINER Premium.",
    paywall_beta_hinweis: "Available for free during the beta.",
    paywall_freischalten: "Unlock Now",
    paywall_kleintext: "Will require a subscription after beta.",

    // Studio
    studio_von: "of",
    studio_aufgenommen: "recorded",
    studio_aufnehmen: "⏺ Record",
    studio_nochmal: "⏺ Redo",
    studio_stop: "⏹ Stop",
    studio_bereit: "Recording ready — listen back or save",
    studio_laeuft: "🔴 Recording…",
    studio_mic_fehler: "Microphone error: ",
    studio_speichere: "Saving…",
    studio_gespeichert: "✓ Saved!",
    studio_loeschen_confirm: "Delete recording for \"{label}\"?",
    studio_hint_miss: "Miss / Bust",
    studio_hint_bust: "When score goes over",

    // Onboarding
    ob_skip: "Skip",
    ob_title_1: "WELCOME TO DARTTRAINER",
    ob_text_1: "Your intelligent dart trainer.\nAI Coach, statistics and more —\nall in one app.",
    ob_btn_start: "LET'S GO →",
    ob_title_2: "REGISTER HITS",
    ob_text_2: "Simply tap the spot on the board\nwhere your dart landed.\nThe app detects the segment automatically.",
    ob_btn_weiter: "NEXT →",
    ob_title_3: "PLAYERS & MODES",
    ob_text_3: "Create players and choose your\ngame mode — 501, Cricket, Tournaments\nor Party modes for social evenings.",
    ob_title_4: "YOUR AI COACH",
    ob_text_4: "After each game your personal\nAI Coach analyses your statistics.\nUpload a short video for an\nanalysis of your throwing technique.",
    ob_badge_4: "🎉 Free during Beta!",
    ob_title_5: "READY TO PLAY",
    ob_text_5: "Create a player and start\nyour first game. Good luck!",
    ob_btn_play: "PLAY →",

    // Studio (additional)
    studio_geloescht: "Deleted",

    // Bot personality descriptions
    bot_desc_methodisch: "Always plays optimally and consistently",
    bot_desc_uebermuetig: "Always aims for T20, ignores better options",
    bot_desc_nervoese: "Loses concentration when it matters",
    bot_desc_gluecksspieler: "Always aims for maximum, risks bust",
    bot_desc_kaltbluetig: "Gets better under pressure",
    bot_desc_aufholer: "Fights back from behind",

    // Additional app strings
    tn_default: "Tournament",

    // Tournament status badge
    tn_abgeschlossen: "FINISHED",

    // Double field stats
    doppelfeld_stat: "DOUBLE FIELD STATISTICS",
    doppelfeld_hilfe: "The app automatically detects when you are aiming at a double field and tracks your hit rate. This shows you which double fields are your strengths and weaknesses.",
    bestes_doppel: "BEST DOUBLE",
    schwaechstes_doppel: "WEAKEST DOUBLE",
    meist_gespielt: "MOST PLAYED",
    versuche_col: "ATTEMPTS",
    treffer_col: "HITS",
    quote_col: "RATE",
    versuche_label: "attempts",

    // Bot personality labels
    bot_persoenlichkeit: "PERSONALITY",
    bot_methodisch: "Methodical",
    bot_uebermuetig: "Overconfident",
    bot_nervoese: "Nervous",
    bot_gluecksspieler: "Gambler",
    bot_kaltbluetig: "Cold-blooded",
    bot_aufholer: "Comeback",
    bot_spielt_optimal: "Always plays optimally and consistently",

    // Game context buttons
    kontext_auto: "Auto",
    kontext_training: "Training",
    kontext_casual: "Casual",
    kontext_turnier: "Tournament",

    // General buttons
    hinzufuegen: "+ Add",
    alle_kontext: "All",
    spiele_count: "Games",
    turnier_filter: "Tournament",
    gespeicherte_analysen: "SAVED ANALYSES",

    // Advanced statistics
    erweiterte_stats: "ADVANCED STATISTICS",
    zeit_filter: "Time",
    spiel_filter: "Game",
    segment_analyse: "SEGMENT ANALYSIS",
    board_a: "BOARD A",
    board_b: "BOARD B",

    // Profile legal
    legal_title: "LEGAL",
    datenschutz: "Privacy Policy",
    impressum: "Imprint",
    app_version: "DARTTRAINER · Personal Dart Scoring & Tracking",
    legal_datenschutz_text: "Data is stored in Firebase (Google), no sharing with third parties",
    legal_entwickelt: "Developed by Daniel Straß 2026",

    // Feedback & Beta banner
    feedback_titel: "FEEDBACK",
    feedback_geben: "Give feedback",
    feedback_untertitel: "What can we do better? Your feedback goes straight to the development team.",
    feedback_placeholder: "Your feedback…",
    feedback_senden: "SEND",
    feedback_leer: "Please enter your feedback.",
    feedback_erfolg: "Thanks!",
    feedback_fehler: "Sending failed. Please try again later.",
    beta_banner_text: "The app is currently in beta — your feedback is very welcome.",
    beta_banner_link: "Give feedback →",

    // Checkout Announcements
    checkout_ansagen_label: "Checkout Announcements",
    checkout_ansagen_sub: "Announce Checkout Path before each throw",

    // Health Connect
    health_verbinden: "CONNECT HEALTH",
    health_sub: "Connect Garmin, Oura, Fitbit and more for automatic health data.",
    mehr_erfahren: "Learn more →",
    health_browser_hinweis: "Automatic connection only available in Android App. In browser: manual input before game.",

    // ElevenLabs Voice placeholders
    el_name_placeholder: "Name (e.g. My Voice)",
    el_id_placeholder: "ElevenLabs Voice ID",

    // Help modal content (showHelp)
    help_coach_analyse_title: "AI Coach Analysis",
    help_coach_analyse_text: "The AI Coach analyses your game statistics and gives concrete improvement tips based on your double field rates, First 9 average and trends.",
    help_video_analyse_title: "Throw Analysis (Video)",
    help_video_analyse_text: "Upload a 3–5 second video of your throw. Claude analyses posture, arm and followthrough and gives concrete improvement tips.",
    help_turnier_title: "Tournament Mode",
    help_turnier_text: "Play a tournament with up to 8 players. Round robin or knockout system. Also available online with friends.",

    // App status messages
    video_limit_msg: "You've reached your video analysis limit ({n}x) for today.",
    stimme_aktiviert_msg: "✓ Voice activated — {name} is now active",

    // Health chips
    health_mittel: "Medium",

    // Loading placeholders
    lade_spieler: "Loading players…",

    // Online section
    online_sub_long: "Play against friends on other devices in real time",
    online_create_hint: "Choose mode and settings, then share the code with your opponent",

    // Studio
    studio_beschreibung: "Record your own voice for announcements. All recorded numbers replace the synthetic voice.",

    // Video analysis
    video_auswaehlen: "Please select a video first",
    extrahiere_frames: "⏳ Extracting frames…",
    analysiere_technik: "Analyzing your throw technique…",
    claude_analysiert: "⏳ Claude analyzing…",
    wurf_analyse_titel: "THROW ANALYSIS",
    video_analysen_remaining: "{n} video analyses remaining today",
    erneut_analysieren: "ANALYZE AGAIN",
    keine_antwort: "No response received.",
    wurf_analysieren: "🎥 ANALYZE THROW",
    frames_werden_analysiert: "{n} frames will be analyzed",
    video_vom_handy: "Video received from phone — analyzing…",
    // Video session (phone)
    warte_auf_handy: "⏳ Waiting for phone…",
    handy_verbunden: "✅ Phone connected — recording…",
    tablet_wartet: "Code: {code} — Tablet waiting",
    wird_hochgeladen: "📤 Uploading…",
    upload_laeuft: "Upload in progress…",
    upload_fertig: "✅ Done! The tablet is now analyzing.",
    video_gesendet: "✅ Sent",
    an_tablet_senden: "📤 SEND TO TABLET",
    // Voice studio
    voice_freischalten: "UNLOCK",
    voice_pflichtfelder: "Name and Voice ID are required.",
    voice_max_stimmen: "Maximum of 10 custom voices reached.",
    voice_id_exists: "This Voice ID is already in the list.",
    voice_hinzugefuegt: "✓ \"{name}\" was added",
    // Player edit
    spieler_bearbeiten: "EDIT PLAYER",
    foto_aendern: "Change Photo",
    spitzname_label: "NICKNAME (displayed in game)",
    spitzname_placeholder: "e.g. DanTheDart",
    dart_marke: "DART BRAND",
    dart_marke_placeholder: "e.g. Target, Winmau, Unicorn",
    dart_gewicht: "DART WEIGHT (grams)",
    dart_gewicht_placeholder: "e.g. 23",
    bevorzugte_doppelfelder: "PREFERRED DOUBLES",
    bevorzugte_doppelfelder_sub: "Checkout prioritises these fields",
    name_erforderlich: "Name is required.",
    speichere: "Saving…",
    // X01 overlays
    noch_sets_zum_sieg: "{n} Set(s) to win",
    noch_legs_zum_set: "{n} Leg(s) remaining",
    // Multiplayer
    online_spieler_header: "PLAYERS",
    du_suffix: "(you)",
    raum_nicht_gefunden: "Room not found",

    // Auth
    anmelden: "SIGN IN",
    registrieren: "SIGN UP",
    mit_google_registrieren: "SIGN UP WITH GOOGLE",
    mit_google_upgraden: "UPGRADE WITH GOOGLE",
    passwort_vergessen: "Forgot password?",
    als_gast: "Play as guest",
    account_erstellen: "CREATE ACCOUNT",
    spieldaten_warnung: "Game data is lost when you sign out. Create an account now:",
    // Auth placeholders
    passwort_placeholder: "Password",
    passwort_min_placeholder: "Password (min. 6 chars)",
    passwort_wdh_placeholder: "Confirm password",
    dein_name_placeholder: "Your name",

    // Health
    koerperliche_belastung: "PHYSICAL STRAIN",
    wie_fuehlst_du_dich: "HOW DO YOU FEEL",
    health_kaum: "Barely",
    health_leicht: "Light",
    health_viel: "High",
    health_muede: "😴 Tired",

    // Video modal / analysis
    qr_hint: "Scan QR code or enter code",
    coach_analyse_titel: "COACH ANALYSIS",
    coach_analyse_starten: "START COACH ANALYSIS",
    video_hint: "Short video (3–5 sec) — from the side, hip height.",
    mit_handy_aufnehmen: "RECORD WITH PHONE",
    tablet_kamera: "TABLET CAMERA",
    hochladen: "UPLOAD",
    wurf_analysieren_btn: "ANALYZE THROW",
    analyse_fuer: "ANALYSIS FOR",
    statistik_analyse: "STATS ANALYSIS",
    wurf_analyse_video: "THROW ANALYSIS (VIDEO)",

    // Admin
    premium_simulieren: "Test Non-Premium View",
    premium_simulieren_sub: "Admin: temporarily disable premium to test non-premium view",

    // Premium Lock
    premium_gesperrt: "PREMIUM FEATURE",
    premium_freischalten_kurz: "Unlock now",

    bot_premium_hinweis: "Bot opponent is a premium feature",
    voice_id_gespeichert: "✓ Saved",
    voice_id_fehler: "✗ Error",
    voice_id_speichern: "Save ID",

    // Misc
    anzahl_runden: "NUMBER OF ROUNDS",
    erstellen_btn: "CREATE",

    // App Modal
    modal_ok: "OK",
    turnier_max_spieler: "A dedicated tournament mode is coming soon for games with 3 or more players.",
    bot_deaktiviert: "Bot was deactivated because two players are selected.",
    bot_nur_ein_spieler: "Bot is only available with one player. Remove a player to activate the bot.",
  }
};

export function t(key){
  const lang = localStorage.getItem('dart_lang') || 'de';
  return (translations[lang] && translations[lang][key]) ||
    translations['en'][key] ||
    translations['de'][key] || key;
}

export function applyTranslations(){
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const translation = t(key);
    if(!translation || translation === key) return;

    if(el.children.length > 0){
      // Element hat Kind-Elemente (Icons, Spans etc.) —
      // nur den ersten Text-Node ändern, nie innerHTML/textContent
      for(const node of el.childNodes){
        if(node.nodeType === Node.TEXT_NODE){
          node.textContent = translation;
          break;
        }
      }
    } else {
      el.textContent = translation;
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

export function setLang(lang){
  localStorage.setItem('dart_lang', lang);
  applyTranslations();
  const activeTab = document.querySelector('.home-tab.active');
  if(activeTab) activeTab.click();
  // Second pass after async tab-renders settle
  setTimeout(() => applyTranslations(), 200);
}

export function getLang(){
  return localStorage.getItem('dart_lang') || 'de';
}

// Global verfügbar machen (für inline onclick-Handler in HTML)
window.t = t;
window.setLang = setLang;
window.applyTranslations = applyTranslations;
