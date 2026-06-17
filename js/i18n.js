/**
 * i18n.js — Internationalization: translation keys + language switcher.
 */

export const SUPPORTED_LANGS = [
  { code: 'de', label: '🇩🇪 Deutsch' },
  { code: 'en', label: '🇬🇧 English' },
  // { code: 'nl', label: '🇳🇱 Nederlands' },
  // { code: 'es', label: '🇪🇸 Español' },
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
    dart_finish: "Dart Finish",

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

    // Winner overlay
    gewinner: "GEWINNER",
    neues_spiel: "NEUES SPIEL",
    naechstes_set: "NÄCHSTES SET ▶",
    naechstes_leg: "NÄCHSTES LEG ▶",
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
    beta_kostenlos_alle: "🎉 Während der Beta kostenlos für alle!",
    beta_sichern_features: "Registriere dich jetzt um deine Features dauerhaft zu sichern.",
    weiter_beta: "WEITER (BETA)",
    schliessen: "Schließen",

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
    ob_tip_2: "💡 Tipp: Du kannst auch per Sprache\nansagen — z.B. 'Triple Zwanzig'",
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

    // Winner overlay
    gewinner: "WINNER",
    neues_spiel: "NEW GAME",
    naechstes_set: "NEXT SET ▶",
    naechstes_leg: "NEXT LEG ▶",
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
    beta_kostenlos_alle: "🎉 Free for everyone during Beta!",
    beta_sichern_features: "Register now to permanently secure your features.",
    weiter_beta: "CONTINUE (BETA)",
    schliessen: "Close",

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
    ob_tip_2: "💡 Tip: You can also use voice\ne.g. 'Triple Twenty'",
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
  }
};

export function t(key){
  const lang = localStorage.getItem('dart_lang') || 'de';
  return (translations[lang] && translations[lang][key]) ||
    translations['de'][key] || key;
}

export function applyTranslations(){
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
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
}

export function getLang(){
  return localStorage.getItem('dart_lang') || 'de';
}
