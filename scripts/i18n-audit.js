/**
 * i18n-audit.js — Findet hardcodierte deutsche Strings in Quelldateien.
 * Aufruf: node scripts/i18n-audit.js
 *
 * Falsch-Positive werden vermieden durch:
 * - Wortgrenzen (\b) im Regex — verhindert Treffer in Bezeichnernamen
 * - Ausschluss von coach.js (AI-Prompt-Strings, absichtlich Deutsch)
 * - Zeilen mit // i18n-ok oder <!--i18n-ok--> werden übersprungen
 */

const fs = require('fs');

// Echte deutsche Wörter die nicht in UI-Strings vorkommen dürfen.
// Internationale Dart-Begriffe (Set, Leg, Checkout, Bouncer, Training, Casual)
// sind NICHT in dieser Liste — sie sind im deutschen Dart-Kontext akzeptabel.
const FORBIDDEN_DE = [
  'Zurück', 'Spielen', 'Statistiken', 'Turniere',
  'Profil', 'Einstellungen', 'Stimme', 'Speichern',
  'Abbrechen', 'Bearbeiten', 'Löschen', 'Starten',
  'Weiter', 'Überspringen', 'Analysieren', 'Analyse',
  'Aufnahme', 'Spiele', 'Siege', 'Verlauf',
  'Spieler', 'Turnier', 'Runde',
  'Anfänger', 'Mittel', 'Profi', 'Entwickelt',
  'Gespeichert', 'Verbinden', 'Erfahren',
  'Hinzufügen', 'Aktivieren', 'Registriert'
];

// coach.js ausgeschlossen: enthält AI-Prompt-Strings (absichtlich deutsch als
// Daten-Kontext für Claude; Sprache wird durch langInstructions am Anfang gesteuert)
const FILES_TO_CHECK = [
  'index.html',
  'js/app.js', 'js/setup.js', 'js/x01.js',
  'js/stats.js', 'js/tournament.js',
  'js/onboarding.js', 'js/premium.js', 'js/audio.js'
];

let violations = [];

FILES_TO_CHECK.forEach(file => {
  if(!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, idx) => {
    // Kommentarzeilen überspringen
    if(line.trim().startsWith('//')) return;
    if(line.trim().startsWith('*')) return;
    if(line.trim().startsWith('<!--')) return;

    // Explizite Ausnahme-Marker
    if(line.includes('// i18n-ok')) return;
    if(line.includes('i18n-ok-->')) return;

    // i18n.js selbst überspringen
    if(file === 'js/i18n.js') return;

    FORBIDDEN_DE.forEach(word => {
      // Wortgrenzen-Regex: verhindert Treffer in JS-Bezeichnernamen
      // z.B. "Spielen" matcht NICHT "showSpielenCards", aber matcht 'Spielen' als String
      const wordBoundaryRegex = new RegExp(
        `['"\`][^'"\`]*\\b${word}\\b[^'"\`]*['"\`]`
      );

      const inString = wordBoundaryRegex.test(line);

      if(inString && !line.includes('t(') && !line.includes('data-i18n')){
        violations.push({ file, line: idx+1, word, content: line.trim() });
      }

      // HTML-Textknoten prüfen: ">WORT<" ohne data-i18n-Wrapper
      // z.B. <button ...> ZURÜCK</button> — nicht in Quotes, aber hardcodiert
      if(file.endsWith('.html')){
        const htmlTextRegex = new RegExp(`>[^<]*\\b${word}\\b[^<]*<`);
        if(htmlTextRegex.test(line) && !line.includes('data-i18n')){
          violations.push({ file, line: idx+1, word, content: line.trim() });
        }
      }
    });
  });
});

// Duplikate entfernen (gleiche Datei+Zeile+Wort)
const seen = new Set();
violations = violations.filter(v => {
  const key = `${v.file}:${v.line}:${v.word}`;
  if(seen.has(key)) return false;
  seen.add(key);
  return true;
});

if(violations.length > 0){
  console.log(`\n❌ ${violations.length} i18n Violations:\n`);
  violations.forEach(v => {
    console.log(`  ${v.file}:${v.line} — "${v.word}"`);
    console.log(`    ${v.content}\n`);
  });
  process.exit(1);
} else {
  console.log('✅ Keine hardcodierten deutschen Strings gefunden.');
  process.exit(0);
}
