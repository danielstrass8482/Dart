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
