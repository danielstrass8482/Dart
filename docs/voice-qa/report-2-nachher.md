# Voice-QA-Bericht: 2-nachher

Stand: 2026-11-23T14:54:28.955Z  
Verfahren: faster-whisper (local, int8 CPU), Erstmodell `small.en`, Zweitmeinung `medium.en` bei Abweichung; Vergleich `scripts/voice-qa-compare.js`.  
Spalte „Modelle“: mit welchem ElevenLabs-Modell die geprüften Clips erzeugt wurden (assets/voice/manifest.json). `*` = altes Profil bis 2026-11-22 (turbo_v2_5, stability 0.50, similarity 0.90, style 0.35), im Manifest noch ohne Modellangabe.

| Stimme | Clips | korrekt | zweifelhaft | fehlerhaft | Modelle |
|---|---:|---:|---:|---:|---|
| George | 921 | 905 | 16 | 0 | eleven_turbo_v2_5*: 916, eleven_multilingual_v2: 5 |
| Haseeb | 921 | 901 | 19 | 1 | eleven_multilingual_v2: 921 |
| Jerry B | 921 | 906 | 15 | 0 | eleven_turbo_v2_5*: 909, eleven_multilingual_v2: 12 |
| Guy | 921 | 908 | 13 | 0 | eleven_turbo_v2_5*: 912, eleven_multilingual_v2: 9 |

**fehlerhaft** = andere/fehlende/zusätzliche Zahl oder ≥ 2 zusätzliche/fehlende Wörter (Ansage sagt inhaltlich etwas anderes). **zweifelhaft** = ein Wort abweichend, Name nicht eindeutig erkannt oder Dauer stark abweichend — nachhören (qa/voice-review.html, Filter „nur auffällige“).

## George — 16 nicht korrekt

| Status | Key | Soll | erkannt | Grund |
|---|---|---|---|---|
| zweifelhaft | `el_co_61` | Checkout: Triple Seven, Double Twenty. | small.en: Check out 777-720. / medium.en: check out 777220. | Zahlen nur als Ziffernfolge erkannt („checkout 777220“) — nachhören |
| zweifelhaft | `el_co_7` | Checkout: Triple One, Double Two. | small.en: Check out, triple one, ten double two. / medium.en: Check out 1111022. | Zahlen nur als Ziffernfolge erkannt („checkout 1111022“) — nachhören |
| zweifelhaft | `name_bernd` | Bernd. | small.en: BUND / medium.en: Burned. | Name abweichend erkannt (Ähnlichkeit 0.60) |
| zweifelhaft | `name_carsten` | Carsten. | small.en: Causton. / medium.en: Causton | Name abweichend erkannt (Ähnlichkeit 0.71) |
| zweifelhaft | `name_dieter` | Dieter. | small.en: DITA / medium.en: DITA | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_heike` | Heike. | small.en: Hiker / medium.en: HIKER | Name abweichend erkannt (Ähnlichkeit 0.60) |
| zweifelhaft | `name_jakob` | Jakob. | small.en: Yakub. / medium.en: Yakub. | Name abweichend erkannt (Ähnlichkeit 0.60) |
| zweifelhaft | `name_jan` | Jan. | small.en: YAM / medium.en: YEM | Name abweichend erkannt (Ähnlichkeit 0.33) |
| zweifelhaft | `name_kerstin` | Kerstin. | small.en: Casting. / medium.en: casting. | Name abweichend erkannt (Ähnlichkeit 0.57) |
| zweifelhaft | `name_lia` | Lia. | small.en: Leah. / medium.en: Leah. | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_nele` | Nele. | small.en: Nailah / medium.en: Nailer | Name abweichend erkannt (Ähnlichkeit 0.40) |
| zweifelhaft | `name_nici` | Nici. | small.en: Neuch. / medium.en: Neat. | Name abweichend erkannt (Ähnlichkeit 0.40) |
| zweifelhaft | `name_silke` | Silke. | small.en: SilCake / medium.en: Silkake. | Name abweichend erkannt (Ähnlichkeit 0.71) |
| zweifelhaft | `name_ute` | Ute. | small.en: You'd. / medium.en: you'd | Name abweichend erkannt (Ähnlichkeit 0.25) |
| zweifelhaft | `name_uwe` | Uwe. | small.en: UVA / medium.en: Uber. | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_werner` | Werner. | small.en: Vanna / medium.en: Vanna | Name abweichend erkannt (Ähnlichkeit 0.33) |

## Haseeb — 20 nicht korrekt

| Status | Key | Soll | erkannt | Grund |
|---|---|---|---|---|
| fehlerhaft | `el_slang_ton_forty_` | Ton Forty! | small.en: Don't for tea! / medium.en: Don't forget to subscribe! | falsche Zahl: ton→4, 40→tea; zusätzlich: „dont“ |
| zweifelhaft | `el_co_61` | Checkout: Triple Seven, Double Twenty. | small.en: Check out 777-220. / medium.en: check out 777220. | Zahlen nur als Ziffernfolge erkannt („checkout 777220“) — nachhören |
| zweifelhaft | `name_amelie` | Amelie. | small.en: I'm Lee. / medium.en: I'm Lee. | 1 zusätzliches Wort; Name abweichend erkannt (Ähnlichkeit 0.60) |
| zweifelhaft | `name_bernd` | Bernd. | small.en: Baron. / medium.en: Barrent. | Name abweichend erkannt (Ähnlichkeit 0.40) |
| zweifelhaft | `name_beth` | Beth. | small.en: death. / medium.en: death. | Name abweichend erkannt (Ähnlichkeit 0.60) |
| zweifelhaft | `name_dan` | Dan. | small.en: Done. / medium.en: Done! | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_heike` | Heike. | small.en: Haikyuu! / medium.en: Haikyuu! | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_helene` | Helene. | small.en: Heilin! / medium.en: Hey Lane! | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_jakob` | Jakob. | small.en: Yakub! / medium.en: Ya kub! | Name abweichend erkannt (Ähnlichkeit 0.60) |
| zweifelhaft | `name_jan` | Jan. | small.en: Yarn. / medium.en: Yawn | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_jen` | Jen. | small.en: YEN / medium.en: Yen! | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_joerg` | Jörg. | small.en: York / medium.en: York | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_jules` | Jules. | small.en: Jewel. / medium.en: Jewel! | Name abweichend erkannt (Ähnlichkeit 0.40) |
| zweifelhaft | `name_klaus` | Klaus. | small.en: Close. / medium.en: Close. | Name abweichend erkannt (Ähnlichkeit 0.60) |
| zweifelhaft | `name_lea` | Lea. | small.en: layer. / medium.en: Layer. | Name abweichend erkannt (Ähnlichkeit 0.40) |
| zweifelhaft | `name_lia` | Lia. | small.en: Leah / medium.en: Leah! | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_manni` | Manni. | small.en: Money! / medium.en: Money! | Name abweichend erkannt (Ähnlichkeit 0.60) |
| zweifelhaft | `name_nele` | Nele. | small.en: Nearly. / medium.en: Nearly. | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_silke` | Silke. | small.en: CLQ / medium.en: CLQ | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_ute` | Ute. | small.en: Uta. / medium.en: Uta! | Name abweichend erkannt (Ähnlichkeit 0.67) |

## Jerry B — 15 nicht korrekt

| Status | Key | Soll | erkannt | Grund |
|---|---|---|---|---|
| zweifelhaft | `name_addi` | Addi. | small.en: party! / medium.en: body. | Name abweichend erkannt (Ähnlichkeit 0.40) |
| zweifelhaft | `name_amelie` | Amelie. | small.en: Family. / medium.en: family. | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_andrea` | Andrea. | small.en: Findria! / medium.en: Mindrear! | Name abweichend erkannt (Ähnlichkeit 0.57) |
| zweifelhaft | `name_anja` | Anja. | small.en: Bonjour / medium.en: Bonjour | Name abweichend erkannt (Ähnlichkeit 0.29) |
| zweifelhaft | `name_bernd` | Bernd. | small.en: Burned. / medium.en: Burned! | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_birgit` | Birgit. | small.en: FURGATE! / medium.en: Fergate! | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_dieter` | Dieter. | small.en: Theater! / medium.en: Peter! | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_jen` | Jen. | small.en: Gen. / medium.en: Jan. | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_jim` | Jim. | small.en: gym. / medium.en: Jam. | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_joerg` | Jörg. | small.en: YERG! / medium.en: Yerg! | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_kerstin` | Kerstin. | small.en: Kirsten. / medium.en: Kirsten! | Name abweichend erkannt (Ähnlichkeit 0.71) |
| zweifelhaft | `name_lia` | Lia. | small.en: Leah / medium.en: Leah! | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_nele` | Nele. | small.en: Nailing! / medium.en: Naily! | Name abweichend erkannt (Ähnlichkeit 0.29) |
| zweifelhaft | `name_rolf` | Rolf. | small.en: Where are we? / medium.en: Warali! | Name abweichend erkannt (Ähnlichkeit 0.33) |
| zweifelhaft | `name_ute` | Ute. | small.en: beauty. / medium.en: Beauty. | Name abweichend erkannt (Ähnlichkeit 0.40) |

## Guy — 13 nicht korrekt

| Status | Key | Soll | erkannt | Grund |
|---|---|---|---|---|
| zweifelhaft | `el_co_3` | Checkout: One, Double One. | small.en: Check out 1, double 1. | Dauer 3.6 s statt ~1.7 s (×2.1) |
| zweifelhaft | `el_co_5` | Checkout: One, Double Two. | small.en: Check out 1.22. | Dauer 3.1 s statt ~1.7 s (×1.8) |
| zweifelhaft | `name_addi` | Addi. | small.en: Scotty. / medium.en: ∅ | Name abweichend erkannt (Ähnlichkeit 0.20) |
| zweifelhaft | `name_amy` | Amy. | small.en: me. / medium.en: me. | Name abweichend erkannt (Ähnlichkeit 0.33) |
| zweifelhaft | `name_anja` | Anja. | small.en: John. / medium.en: ∅ | Name abweichend erkannt (Ähnlichkeit 0.00) |
| zweifelhaft | `name_bernd` | Bernd. | small.en: Burned. / medium.en: Burned! | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_elena` | Elena. | small.en: Alayna / medium.en: Alaina! | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_heike` | Heike. | small.en: HIKER / medium.en: HIKER! | Name abweichend erkannt (Ähnlichkeit 0.60) |
| zweifelhaft | `name_joerg` | Jörg. | small.en: YERG. / medium.en: yergh | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_jules` | Jules. | small.en: Jewels / medium.en: jewels. | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_lia` | Lia. | small.en: Leah. / medium.en: Leah. | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_nele` | Nele. | small.en: Kneel! / medium.en: Kneel | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_uwe` | Uwe. | small.en: UVA / medium.en: over. | Name abweichend erkannt (Ähnlichkeit 0.67) |
