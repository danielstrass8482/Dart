# Voice-QA-Bericht: 1-vorher

Stand: 2026-11-23T13:48:23.109Z  
Verfahren: faster-whisper (local, int8 CPU), Erstmodell `small.en`, Zweitmeinung `medium.en` bei Abweichung; Vergleich `scripts/voice-qa-compare.js`.  
Spalte „Modelle“: mit welchem ElevenLabs-Modell die geprüften Clips erzeugt wurden (assets/voice/manifest.json). `*` = altes Profil bis 2026-11-22 (turbo_v2_5, stability 0.50, similarity 0.90, style 0.35), im Manifest noch ohne Modellangabe.

Ausgangsstand der ursprünglich ausgelieferten Clips (Schnappschuss qa/voice-qa-vorher.json), bevor irgendein Clip neu erzeugt wurde.

| Stimme | Clips | korrekt | zweifelhaft | fehlerhaft | Modelle |
|---|---:|---:|---:|---:|---|
| George | 921 | 901 | 19 | 1 | eleven_turbo_v2_5*: 921 |
| Haseeb | 921 | 821 | 40 | 60 | eleven_turbo_v2_5*: 921 |
| Jerry B | 921 | 894 | 22 | 5 | eleven_turbo_v2_5*: 921 |
| Guy | 921 | 902 | 17 | 2 | eleven_turbo_v2_5*: 921 |

**fehlerhaft** = andere/fehlende/zusätzliche Zahl oder ≥ 2 zusätzliche/fehlende Wörter (Ansage sagt inhaltlich etwas anderes). **zweifelhaft** = ein Wort abweichend, Name nicht eindeutig erkannt oder Dauer stark abweichend — nachhören (qa/voice-review.html, Filter „nur auffällige“).

## George — 20 nicht korrekt

| Status | Key | Soll | erkannt | Grund |
|---|---|---|---|---|
| fehlerhaft | `name_tobias` | Tobias. | small.en: To be us. / medium.en: to be us. | 2 zusätzliche Wörter |
| zweifelhaft | `el_co_25` | Checkout: Triple Three, Double Eight. | small.en: Checkout, triple 3, turn only double 8. / medium.en: Check out Triple 3, autonomy double 8. | zusätzlich: „autonomy“ |
| zweifelhaft | `el_co_61` | Checkout: Triple Seven, Double Twenty. | small.en: Check out 777-720. / medium.en: check out 777220. | Zahlen nur als Ziffernfolge erkannt („checkout 777220“) — nachhören |
| zweifelhaft | `el_co_7` | Checkout: Triple One, Double Two. | small.en: Check out, triple one, ten double two. / medium.en: Check out 1111022. | Zahlen nur als Ziffernfolge erkannt („checkout 1111022“) — nachhören |
| zweifelhaft | `name_bernd` | Bernd. | small.en: BUND / medium.en: Burned. | Name abweichend erkannt (Ähnlichkeit 0.60) |
| zweifelhaft | `name_birgit` | Birgit. | small.en: Big it! / medium.en: Big it! | 1 zusätzliches Wort; Name abweichend erkannt (Ähnlichkeit 0.83) |
| zweifelhaft | `name_carsten` | Carsten. | small.en: Causton. / medium.en: Causton | Name abweichend erkannt (Ähnlichkeit 0.71) |
| zweifelhaft | `name_dieter` | Dieter. | small.en: DITA / medium.en: DITA | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_elena` | Elena. | small.en: Ellie Aina. / medium.en: Ellie Aina | 1 zusätzliches Wort; Name abweichend erkannt (Ähnlichkeit 0.80) |
| zweifelhaft | `name_heike` | Heike. | small.en: Hiker / medium.en: HIKER | Name abweichend erkannt (Ähnlichkeit 0.60) |
| zweifelhaft | `name_jakob` | Jakob. | small.en: Yakub. / medium.en: Yakub. | Name abweichend erkannt (Ähnlichkeit 0.60) |
| zweifelhaft | `name_jan` | Jan. | small.en: YAM / medium.en: YEM | Name abweichend erkannt (Ähnlichkeit 0.33) |
| zweifelhaft | `name_kerstin` | Kerstin. | small.en: Cast in / medium.en: Castine | 1 zusätzliches Wort; Name abweichend erkannt (Ähnlichkeit 0.71) |
| zweifelhaft | `name_lia` | Lia. | small.en: Leah. / medium.en: Leah. | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_nele` | Nele. | small.en: Nailah / medium.en: Nailer | Name abweichend erkannt (Ähnlichkeit 0.40) |
| zweifelhaft | `name_nici` | Nici. | small.en: Neuch. / medium.en: Neat. | Name abweichend erkannt (Ähnlichkeit 0.40) |
| zweifelhaft | `name_silke` | Silke. | small.en: SilCake / medium.en: Silkake. | Name abweichend erkannt (Ähnlichkeit 0.71) |
| zweifelhaft | `name_ute` | Ute. | small.en: You'd. / medium.en: you'd | Name abweichend erkannt (Ähnlichkeit 0.25) |
| zweifelhaft | `name_uwe` | Uwe. | small.en: UVA / medium.en: Uber. | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_werner` | Werner. | small.en: Vanna / medium.en: Vanna | Name abweichend erkannt (Ähnlichkeit 0.33) |

## Haseeb — 100 nicht korrekt

| Status | Key | Soll | erkannt | Grund |
|---|---|---|---|---|
| fehlerhaft | `el_co_100` | Checkout: Triple Twenty, Double Twenty. | small.en: Check out, triple 20, crossy, triple 20, double 20. / medium.en: check out triple 20 plus 20 double 20. | zusätzliche Zahl: 20; zusätzlich: „triple crossy“ |
| fehlerhaft | `el_co_102` | Checkout: Triple Twenty, Double One, Double Twenty. | small.en: Check out triple twenty to buy submit to power twenty double one double twenty / medium.en: Check out triple 20, 2x72 power 20, double 1, double 20. | zusätzliche Zahl: 22, 2; zusätzlich: „buy submit power“ |
| fehlerhaft | `el_co_105` | Checkout: Triple Twenty, Five, Double Twenty. | small.en: Check out the free ending page 90. TOTRY posting 20. 5 double 20. / medium.en: Check out the training page 20. To tree posting 20, 5 double 20. | falsche Zahl: triple→20, 25→5; zusätzliche Zahl: 90; zusätzlich: „the free ending page totry posting“ |
| fehlerhaft | `el_co_111` | Checkout: Triple Twenty, Eleven, Double Twenty. | small.en: Check out triple 20 bus, try 11 double 20. / medium.en: Check out Triple 20S. Try 11 double 20. | zusätzlich: „bus try“ |
| fehlerhaft | `el_co_112` | Checkout: Triple Twenty, Triple Four, Double Twenty. | small.en: Check out Triple 20, Didiwa, Sun, Didiwa, Andi, Triple 4, Double 20. / medium.en: Check out Triple 20, Ditima Santitini Poeni, Triple 4 Double 20. | zusätzlich: „didiwa sun didiwa andi“ |
| fehlerhaft | `el_co_113` | Checkout: Triple Twenty, Thirteen, Double Twenty. | small.en: Check out triple twenty thirty ting shiram scene ct work is tau 2013 double twenty / medium.en: Check out Triple 20 for teaching show CNC to work this out 2013 double 20 | falsche Zahl: 13→2013; zusätzliche Zahl: 30; zusätzlich: „ting shiram scene ct work is tau“; Dauer 6.8 s statt ~4.1 s (×1.6) |
| fehlerhaft | `el_co_116` | Checkout: Triple Twenty, Double Eight, Double Twenty. | small.en: Check out triple twenty dollar E.T. any double eight double twenty. / medium.en: check out triple 20 dollar ETC any double 8 double 20 | zusätzlich: „dollar e t any“ |
| fehlerhaft | `el_co_117` | Checkout: Triple Twenty, Seventeen, Double Twenty. | small.en: Check out triple 20 semi ti because tv 20 17 double 20 / medium.en: Check out Triple 20 Semi-TV 2017 Double 20. | zusätzliche Zahl: 20; zusätzlich: „semi ti because tv“ |
| fehlerhaft | `el_co_118` | Checkout: Triple Twenty, Triple Six, Double Twenty. | small.en: Check out triple 20, disto sinon sin toini, triple 6, double 20. / medium.en: Check out Triple 20 Distancinon Cintoni Triple 6 Double 20. | zusätzlich: „disto sinon sin toini“ |
| fehlerhaft | `el_co_120` | Checkout: Triple Twenty, Double Ten, Double Twenty. | small.en: Check out triple 20 dub but the I'm by ski towards 20 double 10 double 20 / medium.en: Check out Triple 20 Dabati. I'm by ski, 12-20, double 10, double 20. | zusätzliche Zahl: 20; zusätzlich: „dub but the im by ski towards“ |
| fehlerhaft | `el_co_121` | Checkout: Triple Twenty, Triple Seven, Double Twenty. | small.en: Check out triple twenty Tristan time sauce meaty teeny triple seven double twenty / medium.en: Check out Triple 20 Tristan Thang Thas Mitthi Thaini Triple 7 Double 20 | zusätzlich: „tristan time sauce meaty teeny“ |
| fehlerhaft | `el_co_123` | Checkout: Triple Nineteen, Double Thirteen, Double Twenty. | small.en: Check out! / medium.en: Check out | fehlende Zahl: 19, 13, 20; fehlt: „triple double double“; Dauer 10.0 s statt ~4.4 s (×2.3) |
| fehlerhaft | `el_co_132` | Checkout: Triple Twenty, Double Sixteen, Double Twenty. | small.en: Check out triple-twenty DQS-2S-16B-E-16B-16E. / medium.en: Check out triple 20, dqs entity source, satyabhi partition e, double 16, double 20. | falsche Zahl: 16→e, 20→16e; zusätzlich: „dqs 2s“; abweichend: double→16b, double→16b |
| fehlerhaft | `el_co_133` | Checkout: Triple Twenty, Triple Eleven, Double Twenty. | small.en: Check out Triple 20, Trippin' Me, Som, Taizi, Chi, Triple 11, Double 20! / medium.en: check out triple 20 tripping me some tosey she triple 11 double 20 | zusätzlich: „trippin me som taizi chi“ |
| fehlerhaft | `el_co_134` | Checkout: Triple Twenty, Double Seventeen, Double Twenty. | small.en: Check out triple 20 dub 30 train booth d20 double 17 double 20 / medium.en: Check out, triple 20 dub thirsty, trying booty 20 double 17 double 20. | zusätzliche Zahl: 20, 30; zusätzlich: „dub train booth double“ |
| fehlerhaft | `el_co_143` | Checkout: Triple Twenty, Triple Seventeen, Double Sixteen. | small.en: Check out triple twenty for Steve Steve plus Steve key to play me triple 17 double 16 / medium.en: Check out Cripple20 plus this tea, plus this tea boy me, Cripple17, double 16. | falsche Zahl: 20→me; zusätzliche Zahl: 24, 2; zusätzlich: „steve steve plus steve key play“ |
| fehlerhaft | `el_co_147` | Checkout: Triple Twenty, Triple Seventeen, Double Eighteen. | small.en: Check out triple twenty could be totally need the interest 20 triple 17 double 18 / medium.en: Check out triple 20, it could be the title you need, the interest 20, triple 17, double 18. | zusätzliche Zahl: 20; zusätzlich: „could be totally need the interest“ |
| fehlerhaft | `el_co_149` | Checkout: Triple Twenty, Triple Nineteen, Double Sixteen. | small.en: Check out Triple 20, Dorshivi Pray, Dr. Bafidee 20, Triple 19, Double 16. / medium.en: Check out Triple20, Dorshivi, Prayeev, Dutubah5D20, Triple19, Double16. | zusätzliche Zahl: 20; zusätzlich: „dorshivi pray dr bafidee“ |
| fehlerhaft | `el_co_15` | Checkout: Seven, Double Four. | small.en: Check out C-T-P-K-T-T-T-T-K-W-S-D-D-N-A-double-four. / medium.en: Check it out! | falsche Zahl: 7→a; zusätzlich: „c t p k t t t t k w s d d n“ |
| fehlerhaft | `el_co_151` | Checkout: Triple Twenty, Triple Seventeen, Double Twenty. | small.en: Check out triple twenty. Keep the virus at us at triple twenty, triple seventeen, double twenty. / medium.en: check out triple 20, kyptivarasita6 triple 20 triple 17 double 20. | zusätzliche Zahl: 20; zusätzlich: „triple keep the virus at us at“ |
| fehlerhaft | `el_co_152` | Checkout: Triple Twenty, Triple Twenty, Double Sixteen. | small.en: Check out triple twenty three d e t d c n e t t twenty triple twenty double sixteen / medium.en: Check out Triple 20 3DTE, Disney 3D20, Triple 20 Double 16. | zusätzliche Zahl: 23; zusätzlich: „d e t d c n e t t“ |
| fehlerhaft | `el_co_154` | Checkout: Triple Twenty, Triple Eighteen, Double Twenty. | small.en: Check out triple 20 dvddme parang salatiele triple 18 double 20 / medium.en: Check out Triple 20 DBDDME Parang Salatile Triple 18 Double 20 | zusätzlich: „dvddme parang salatiele“ |
| fehlerhaft | `el_co_17` | Checkout: One, Double Eight. | small.en: Check out, meet, Susie tries to chat with in one double eight. / medium.en: Checkout. Neat. Susie tries to check you out in 1-8-8. | zusätzliche Zahl: 2; zusätzlich: „meet susie tries chat with in“ |
| fehlerhaft | `el_co_18` | Checkout: Double Nine. | small.en: Check out Aseeb, Aseeb Sarsar to check out Double nine / medium.en: Check out, I see, Steve Sarsa to check out, double nine. | zusätzliche Zahl: 2; zusätzlich: „checkout aseeb aseeb sarsar“ |
| fehlerhaft | `el_co_19` | Checkout: Triple One, Double Eight. | small.en: Checkout, triple 1, Tib 1, double 8. / medium.en: Check out triple one, Chib one, double eight. | zusätzliche Zahl: 1; zusätzlich: „tib“ |
| fehlerhaft | `el_co_21` | Checkout: Five, Double Eight. | small.en: Check out 5.8.8.8.8. / medium.en: Check out 5-8-8-8-8-8-8-8. | falsche Zahl: double→8; zusätzliche Zahl: 8, 8 |
| fehlerhaft | `el_co_22` | Checkout: Double Eleven. | small.en: Check out my Wookiee Hot Encore, double a love bait. / medium.en: Check out Amaoki Hot Encore, double 11 by 8. | falsche Zahl: 11→bait; zusätzlich: „my wookiee hot encore a love“ |
| fehlerhaft | `el_co_27` | Checkout: Eleven, Double Eight. | small.en: Check out B-B-Dosholt 11, uh, 1188. / medium.en: Check out the default 11, uh, 11 double 8. | falsche Zahl: 11→dosholt, double→11, 8→1188; zusätzlich: „b b“ |
| fehlerhaft | `el_co_28` | Checkout: Double Fourteen. | small.en: Check out a sssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss / medium.en: Check out I- sssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss | falsche Zahl: 14→sssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss; abweichend: double→a |
| fehlerhaft | `el_co_30` | Checkout: Double Fifteen. | small.en: Checkout site out. Double 15. / medium.en: Check it out. Double 15. | zusätzlich: „site out“ |
| fehlerhaft | `el_co_32` | Checkout: Double Sixteen. | small.en: Check out jibao skin ai chi check out double 16 / medium.en: Check out Jibawo's Kinai, Chichagout, Double 16. | zusätzlich: „checkout jibao skin ai chi“ |
| fehlerhaft | `el_co_33` | Checkout: One, Double Sixteen. | small.en: Check out Calc 1.1616 / medium.en: Checkout Count 1-16 | falsche Zahl: 1→calc, double→1, 16→1616 |
| fehlerhaft | `el_co_34` | Checkout: Double Seventeen. | small.en: Check out. C- main thi- check out. Double 17. / medium.en: Check out, sus main peep cursor, check out, double 17. | zusätzlich: „checkout c main thi“ |
| fehlerhaft | `el_co_35` | Checkout: Triple One, Double Sixteen. | small.en: Checkout to me for... / medium.en: Check out me for... ...crippy mods in P-P-P-Pepel A1, double 60s, cut to the double 16. | falsche Zahl: 1→2, 16→4; fehlt: „triple“; abweichend: double→me; Dauer 7.7 s statt ~3.8 s (×2.0) |
| fehlerhaft | `el_co_39` | Checkout: Seven, Double Sixteen. | small.en: Check out Avamode colony, Chachidao, 70016. / medium.en: Check it out. | falsche Zahl: 7→colony, 16→70016; zusätzlich: „avamode“; abweichend: double→chachidao |
| fehlerhaft | `el_co_41` | Checkout: One, Double Twenty. | small.en: Check out 1W Convenient, Double to 20. / medium.en: Check out 1 W convenient, double to 20. | falsche Zahl: 1→convenient; zusätzliche Zahl: 2; zusätzlich: „1w“ |
| fehlerhaft | `el_co_43` | Checkout: Triple One, Double Twenty. | small.en: Check out triple 1, double 20, and I'm on Tinti. / medium.en: Check out Cripple One Double 20 and in on Tinty | zusätzlich: „and im on tinti“; Dauer 7.0 s statt ~3.7 s (×1.9) |
| fehlerhaft | `el_co_45` | Checkout: Five, Double Twenty. | small.en: Check out five double twenty easy quantity. / medium.en: Check out 5-double-20-ec-cunt-tee. | zusätzlich: „easy quantity“ |
| fehlerhaft | `el_co_46` | Checkout: Triple Two, Double Twenty. | small.en: Check out triple 2 double 20 of she's tile race. / medium.en: Check out triple 2 double 20 of she style of ace. | zusätzlich: „of shes tile race“ |
| fehlerhaft | `el_co_5` | Checkout: One, Double Two. | small.en: Check out one part a st. She is so on a one double two / medium.en: Check out 1-POT-A-ST-CHI-IS-A-WAN-A-1-double-2 | zusätzliche Zahl: 1; zusätzlich: „part a st she is so on a“ |
| fehlerhaft | `el_co_50` | Checkout: Bullseye. | small.en: Check out... Check out this bullseye. / medium.en: Check out... Check out this bullseye. | zusätzlich: „checkout this“ |
| fehlerhaft | `el_co_52` | Checkout: Triple Four, Double Twenty. | small.en: Check out, see you next time on you, triple four or sincever show, double twenty meets estimate, cheap, kaisinte mighty. / medium.en: Check out | zusätzlich: „see you next time on you or sincever show meets estimate cheap kaisinte mighty“; Dauer 8.6 s statt ~3.8 s (×2.3) |
| fehlerhaft | `el_co_61` | Checkout: Triple Seven, Double Twenty. | small.en: Check out, 777 WOOP. / medium.en: check out triple seven sasmine double 20 cd threats | falsche Zahl: double→777, 20→woop; fehlende Zahl: 7; fehlt: „triple“; Dauer 6.5 s statt ~3.8 s (×1.7) |
| fehlerhaft | `el_co_63` | Checkout: Triple Thirteen, Double Twelve. | small.en: Check out TwaralesD, Funbit, Chez, triple 13 in the last events tonight, sss, triple 13, double 12. / medium.en: Check it out. | zusätzliche Zahl: 13; zusätzlich: „twaralesd funbit chez triple in the last events tonight sss“; Dauer 7.4 s statt ~3.9 s (×1.9) |
| fehlerhaft | `el_co_65` | Checkout: Twenty Five, Double Twenty. | small.en: Check out 25, double 20, kite, tai. / medium.en: Check out 25 double 20, keep it tight! | zusätzlich: „kite tai“ |
| fehlerhaft | `el_co_67` | Checkout: Triple Nine, Double Twenty. | small.en: Checkout, 999-220-0-6-9-10-20 / medium.en: Checkout 99922 Kostiysnyi Khayyentyn 20 | falsche Zahl: triple→6, double→10; zusätzliche Zahl: 999, 220, 0 |
| fehlerhaft | `el_co_70` | Checkout: Triple Ten, Double Twenty. | small.en: Check out triple ten, double twenty. De steevas, tea. / medium.en: Check out Triple 10 Double 20. ¡Desivas! Tea! | zusätzlich: „de steevas tea“ |
| fehlerhaft | `el_co_75` | Checkout: Triple Seventeen, Double Twelve. | small.en: Check out, triple 17 co... Diamondine, double 12. / medium.en: Check out Triple 17 Co- 17 Double 12 | zusätzlich: „co diamondine“ |
| fehlerhaft | `el_co_79` | Checkout: Triple Thirteen, Double Twenty. | small.en: Check out E, C, T, triple 13, to 13 double 20. / medium.en: Check out T T triple 30 to 13 double 20. | zusätzliche Zahl: 13, 2; zusätzlich: „e c t“; Dauer 7.2 s statt ~3.9 s (×1.8) |
| fehlerhaft | `el_co_8` | Checkout: Double Four. | small.en: Check out Timmy. Double duer. / medium.en: Check out Timmy. Double deezer. | falsche Zahl: 4→duer; zusätzlich: „timmy“ |
| fehlerhaft | `el_co_82` | Checkout: Triple Fourteen, Double Twenty. | small.en: Check out triple fourteen, double twenty, S-E-BOM-T. / medium.en: Check out triple 14, double 20, s-e, bomb T. | zusätzlich: „s e bom t“ |
| fehlerhaft | `el_co_83` | Checkout: Triple Seventeen, Double Sixteen. | small.en: Checkout triple 17 Chasti history steep baby is a seat tool 17 double 16 / medium.en: Check out triple 17 shots easily, baby. It's a C to 17 double 16 | zusätzliche Zahl: 17; zusätzlich: „chasti history steep baby is a seat tool“; Dauer 6.8 s statt ~4.0 s (×1.7) |
| fehlerhaft | `el_co_84` | Checkout: Triple Twenty, Double Twelve. | small.en: Check out triple twenty double t. I spy person a between double twelve. / medium.en: Check out Triple 20 WT. | zusätzlich: „double t i spy person a between“ |
| fehlerhaft | `el_co_86` | Checkout: Triple Eighteen, Double Sixteen. | small.en: Check out all the about it and I need to have anything to do with the ripple 18 and in and 15 in double 16. / medium.en: Check it out! | zusätzliche Zahl: 2, 2, 15; zusätzlich: „all the about it and i need have anything do with the and in and in“; abweichend: triple→ripple; Dauer 7.7 s statt ~3.9 s (×2.0) |
| fehlerhaft | `el_co_87` | Checkout: Triple Seventeen, Double Eighteen. | small.en: Check out the SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS / medium.en: Check out he sssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss | falsche Zahl: 18→sssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss; fehlende Zahl: 17; fehlt: „triple“; abweichend: double→the |
| fehlerhaft | `el_co_9` | Checkout: One, Double Four. | small.en: Check out! / medium.en: Check out. | fehlende Zahl: 1, 4; fehlt: „double“ |
| fehlerhaft | `el_co_90` | Checkout: Triple Eighteen, Double Eighteen. | small.en: Check out T-E-E-T-E-T-E-T-E-T-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E-T-E-E- / medium.en: Check it out! | falsche Zahl: 18→t, 18→e; zusätzlich: „t e e t e t e t e t e t e e t e e t e e t e e t e e t e e t e e t e e t e e t e e t e e t e e t e e t e e t e e t e e t e e t e e t e e t e e t e e t e e t e e t e e t e e e t e e t e e t e e t e e t e e t e e t e“; abweichend: triple→e, double→e |
| fehlerhaft | `el_co_95` | Checkout: Triple Nineteen, Double Nineteen. | small.en: Check out Tintin-G-G-G-G-N-O-T, Triple Nineteen, Tintine, Double Nineteen. / medium.en: Check out 10 GPDG note, triple 19 anything 10 10 double 19. | zusätzlich: „tintin g g g g n o t tintine“ |
| fehlerhaft | `el_co_96` | Checkout: Triple Twenty, Double Eighteen. | small.en: Check out triple twenty EAT. Click double eighteen to buy it to me / medium.en: Check out Triple 20 ET. Click Double 18 to buy it to me. | zusätzliche Zahl: 2, 2; zusätzlich: „eat click buy it me“; Dauer 6.7 s statt ~3.9 s (×1.7) |
| fehlerhaft | `el_co_98` | Checkout: Triple Twenty, Double Nineteen. | small.en: Check out triple twenty for smog by ditty twenty for double nineteen by nine time anti / medium.en: Check out Triple 20 for smart vibe. DT20 for double 19 playing on time on three. | falsche Zahl: 20→24; zusätzliche Zahl: 24, 9; zusätzlich: „smog by ditty by time anti“ |
| zweifelhaft | `el_co_107` | Checkout: Triple Nineteen, Bullseye. | small.en: Check out triple 19 bullseye. | Dauer nur 2.0 s statt ~3.8 s (×0.54) |
| zweifelhaft | `el_co_110` | Checkout: Triple Twenty, Bullseye. | small.en: Check out Shashi'd. Triple 20. Bullseye. / medium.en: Check out Shashied. Triple 20. Bullseye. | zusätzlich: „shashid“ |
| zweifelhaft | `el_co_12` | Checkout: Double Six. | small.en: Check out Double Six. | Dauer nur 1.8 s statt ~3.3 s (×0.55) |
| zweifelhaft | `el_co_126` | Checkout: Triple Twenty, Double Thirteen, Double Twenty. | small.en: Check out, triple twenty, treben ein ten par chuptoti, double thirteen, double twenty. / medium.en: Check out Triple 20. | Zahlen nur als Ziffernfolge erkannt („checkout triple 20“) — nachhören |
| zweifelhaft | `el_co_13` | Checkout: Five, Double Four. | small.en: Check out 5 the double 4 / medium.en: Check it out, five to double four. | zusätzlich: „the“ |
| zweifelhaft | `el_co_16` | Checkout: Double Eight. | small.en: Check out Double Eight. | Dauer nur 1.3 s statt ~3.3 s (×0.39) |
| zweifelhaft | `el_co_23` | Checkout: Seven, Double Eight. | small.en: Check out sub 788 / medium.en: Check out sub 7 double 8 | zusätzlich: „sub“ |
| zweifelhaft | `el_co_24` | Checkout: Double Twelve. | small.en: Check out Double 12. | Dauer nur 1.4 s statt ~3.4 s (×0.42) |
| zweifelhaft | `el_co_26` | Checkout: Double Thirteen. | small.en: Check out Double Thirteen. | Dauer nur 1.7 s statt ~3.4 s (×0.49) |
| zweifelhaft | `el_co_29` | Checkout: Thirteen, Double Eight. | small.en: Check out 1388. / medium.en: Check out 1388. | Dauer nur 1.9 s statt ~3.6 s (×0.52) |
| zweifelhaft | `el_co_3` | Checkout: One, Double One. | small.en: Check out Tissue One Double One. / medium.en: Checkout. Chishut. One. Double. One. | zusätzlich: „tissue“ |
| zweifelhaft | `el_co_38` | Checkout: Double Nineteen. | small.en: Check out Double Nineteen. | Dauer nur 1.8 s statt ~3.4 s (×0.53) |
| zweifelhaft | `el_co_4` | Checkout: Double Two. | small.en: Check out Double Two. | Dauer nur 1.4 s statt ~3.3 s (×0.43) |
| zweifelhaft | `el_co_47` | Checkout: Seven, Double Twenty. | small.en: Check out sub2c722. / medium.en: Check out Sun2C-7-2020. | Zahlen nur als Ziffernfolge erkannt („checkout sub2c722“) — nachhören |
| zweifelhaft | `el_co_51` | Checkout: Eleven, Double Twenty. | small.en: Check out. So. 11 double 20. / medium.en: Check out. So. Eleven double twenty. | zusätzlich: „so“ |
| zweifelhaft | `el_co_57` | Checkout: Seventeen, Double Twenty. | small.en: Check out 17 double 20. | Dauer nur 1.8 s statt ~3.7 s (×0.49) |
| zweifelhaft | `el_co_6` | Checkout: Double Three. | small.en: Check out Double3. | Dauer nur 1.6 s statt ~3.3 s (×0.48) |
| zweifelhaft | `el_co_64` | Checkout: Triple Eight, Double Twenty. | small.en: Check out Triple Eight Double Twenty, Kaipo. / medium.en: Check out Triple 8 Double 20 Kaiko. | zusätzlich: „kaipo“ |
| zweifelhaft | `el_co_7` | Checkout: Triple One, Double Two. | small.en: Check out Triple 1 Double 2 | Dauer 6.7 s statt ~3.6 s (×1.9) |
| zweifelhaft | `el_co_74` | Checkout: Double Seventeen, Double Twenty. | small.en: Check out Double 17 Double 20. | Dauer nur 2.1 s statt ~3.9 s (×0.53) |
| zweifelhaft | `el_co_78` | Checkout: Double Nineteen, Double Twenty. | small.en: Check out double 19- oh hey double 19 double 20 sssssss / medium.en: Check out double 19... 19... double 20... | Dauer 9.4 s statt ~3.9 s (×2.4) |
| zweifelhaft | `el_co_81` | Checkout: Triple Nineteen, Double Twelve. | small.en: Check out triple 19, 19, double 12. / medium.en: check out triple 19 19 double 12 | Dauer 10.6 s statt ~3.9 s (×2.7) |
| zweifelhaft | `el_co_91` | Checkout: Triple Seventeen, Double Twenty. | small.en: Check out triple 17 tst 17 double 20 / medium.en: Check out 777T-T-T-T-T-T-T-T-T-T-T-T-T-T-T-T. | Zahlen nur als Ziffernfolge erkannt („checkout 777t t t t t t t t t t t t t t t t“) — nachhören; Dauer 7.2 s statt ~3.9 s (×1.8) |
| zweifelhaft | `el_co_97` | Checkout: Triple Nineteen, Double Twenty. | small.en: Check out triple 19 double 20 see side be bad to an untied on 20 / medium.en: Check out Triple 19 Double 20. See... | zusätzlich: „see“ |
| zweifelhaft | `el_score_171` | One hundred, and seventy one! | small.en: 171 | Dauer 4.2 s statt ~1.6 s (×2.6) |
| zweifelhaft | `name_bernd` | Bernd. | small.en: burned / medium.en: Burned. | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_bine` | Bine. | small.en: Bye now. / medium.en: Bye now. | 1 zusätzliches Wort; Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_birgit` | Birgit. | small.en: Burgett / medium.en: Burgett! | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_hans` | Hans. | small.en: Haunt. / medium.en: Haunt. | Name abweichend erkannt (Ähnlichkeit 0.60) |
| zweifelhaft | `name_heike` | Heike. | small.en: HIKER / medium.en: Hiya! | Name abweichend erkannt (Ähnlichkeit 0.60) |
| zweifelhaft | `name_jen` | Jen. | small.en: Gen. / medium.en: Gen. | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_joerg` | Jörg. | small.en: YERG / medium.en: Yerg. | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_jules` | Jules. | small.en: Jewels / medium.en: Jewels | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_katrin` | Katrin. | small.en: Cat Train. / medium.en: Cat train. | 1 zusätzliches Wort; Name abweichend erkannt (Ähnlichkeit 0.86) |
| zweifelhaft | `name_kerstin` | Kerstin. | small.en: Kirsten / medium.en: Kirsten. | Name abweichend erkannt (Ähnlichkeit 0.71) |
| zweifelhaft | `name_lia` | Lia. | small.en: Leah / medium.en: Leah. | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_nele` | Nele. | small.en: Nailie / medium.en: Nay lay. | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_nici` | Nici. | small.en: Neat! / medium.en: Neat. | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_rolf` | Rolf. | small.en: RAY / medium.en: RAPE! | Name abweichend erkannt (Ähnlichkeit 0.25) |
| zweifelhaft | `name_uwe` | Uwe. | small.en: UVA / medium.en: Uber. | Name abweichend erkannt (Ähnlichkeit 0.67) |

## Jerry B — 27 nicht korrekt

| Status | Key | Soll | erkannt | Grund |
|---|---|---|---|---|
| fehlerhaft | `el_co_16` | Checkout: Double Eight. | small.en: Check out AA! / medium.en: Check out Double A! | falsche Zahl: 8→aa; fehlt: „double“ |
| fehlerhaft | `el_num_98` | Ninety Eight. | small.en: 988. / medium.en: 988. | falsche Zahl: 98→988 |
| fehlerhaft | `el_score_18` | Eighteen! | small.en: Hey T.L. Wayne! / medium.en: Hey, T.L. Wayne! | falsche Zahl: 18→wayne; zusätzlich: „hey t l“; Dauer 2.5 s statt ~1.1 s (×2.3) |
| fehlerhaft | `el_score_24` | Twenty Four! | small.en: 294! / medium.en: $2.94! | falsche Zahl: 24→294 |
| fehlerhaft | `name_anna` | Anna. | small.en: ∅ / medium.en: ∅ | kein Wort erkannt |
| zweifelhaft | `el_pct_19` | Nineteen percent. | small.en: 19%! Let's blow up all ice with our wall! / medium.en: 19 percent | Dauer 4.4 s statt ~1.5 s (×3.0) |
| zweifelhaft | `el_score_117` | One Hundred and Seventeen! | small.en: 117, aye! / medium.en: 117, aye! | zusätzlich: „aye“ |
| zweifelhaft | `el_score_53` | Fifty Three! | small.en: 53 A.I. / medium.en: Fifty-three! Yay! | zusätzlich: „yay“; Dauer 2.9 s statt ~1.2 s (×2.5) |
| zweifelhaft | `name_addi` | Addi. | small.en: party! / medium.en: body. | Name abweichend erkannt (Ähnlichkeit 0.40) |
| zweifelhaft | `name_amelie` | Amelie. | small.en: Family. / medium.en: family. | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_andrea` | Andrea. | small.en: Findria! / medium.en: Mindrear! | Name abweichend erkannt (Ähnlichkeit 0.57) |
| zweifelhaft | `name_anja` | Anja. | small.en: Bonjour / medium.en: Bonjour | Name abweichend erkannt (Ähnlichkeit 0.29) |
| zweifelhaft | `name_annette` | Annette. | small.en: An ad. / medium.en: An ad. | 1 zusätzliches Wort; Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_bernd` | Bernd. | small.en: Burned. / medium.en: Burned! | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_birgit` | Birgit. | small.en: FURGATE! / medium.en: Fergate! | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_dieter` | Dieter. | small.en: Theater! / medium.en: Peter! | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_gerhard` | Gerhard. | small.en: GARE HARD! / medium.en: GARE HARD! | 1 zusätzliches Wort; Name abweichend erkannt (Ähnlichkeit 0.75) |
| zweifelhaft | `name_jen` | Jen. | small.en: Gen. / medium.en: Jan. | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_jim` | Jim. | small.en: gym. / medium.en: Jam. | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_joerg` | Jörg. | small.en: YERG! / medium.en: Yerg! | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_kerstin` | Kerstin. | small.en: Kirsten. / medium.en: Kirsten! | Name abweichend erkannt (Ähnlichkeit 0.71) |
| zweifelhaft | `name_lia` | Lia. | small.en: Leah / medium.en: Leah! | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_nele` | Nele. | small.en: Nailing! / medium.en: Naily! | Name abweichend erkannt (Ähnlichkeit 0.29) |
| zweifelhaft | `name_rolf` | Rolf. | small.en: Where are we? / medium.en: Warali! | Name abweichend erkannt (Ähnlichkeit 0.33) |
| zweifelhaft | `name_sophia` | Sophia. | small.en: So Thea! / medium.en: Selfie ya! | 1 zusätzliches Wort; Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_stefan` | Stefan. | small.en: Step On! / medium.en: Step on! | 1 zusätzliches Wort; Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_ute` | Ute. | small.en: beauty. / medium.en: Beauty. | Name abweichend erkannt (Ähnlichkeit 0.40) |

## Guy — 19 nicht korrekt

| Status | Key | Soll | erkannt | Grund |
|---|---|---|---|---|
| fehlerhaft | `el_score_115` | One Hundred and Fifteen! | small.en: one hundred and fifty / medium.en: 150. | falsche Zahl: 115→150 |
| fehlerhaft | `el_score_20` | Twenty! | small.en: 2018! / medium.en: 20-10! | falsche Zahl: 20→2018; Dauer 3.1 s statt ~0.9 s (×3.6) |
| zweifelhaft | `el_co_3` | Checkout: One, Double One. | small.en: Check out, 1, double 1! | Dauer 3.6 s statt ~1.7 s (×2.0) |
| zweifelhaft | `el_co_5` | Checkout: One, Double Two. | small.en: Check out 1.22 | Dauer 2.8 s statt ~1.7 s (×1.6) |
| zweifelhaft | `el_co_50` | Checkout: Bullseye. | small.en: Check out Bullseye! | Dauer 2.7 s statt ~1.2 s (×2.2) |
| zweifelhaft | `el_co_6` | Checkout: Double Three. | small.en: Check out! Double three! | Dauer 2.7 s statt ~1.6 s (×1.7) |
| zweifelhaft | `name_addi` | Addi. | small.en: Scotty. / medium.en: ∅ | Name abweichend erkannt (Ähnlichkeit 0.20) |
| zweifelhaft | `name_amy` | Amy. | small.en: me. / medium.en: me. | Name abweichend erkannt (Ähnlichkeit 0.33) |
| zweifelhaft | `name_anja` | Anja. | small.en: John. / medium.en: ∅ | Name abweichend erkannt (Ähnlichkeit 0.00) |
| zweifelhaft | `name_bernd` | Bernd. | small.en: Burned. / medium.en: Burned! | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_birgit` | Birgit. | small.en: Burg it. / medium.en: Burgett! | 1 zusätzliches Wort; Name abweichend erkannt (Ähnlichkeit 0.83) |
| zweifelhaft | `name_elena` | Elena. | small.en: Alayna / medium.en: Alaina! | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_gerhard` | Gerhard. | small.en: GARE HARD / medium.en: GARE HARD! | 1 zusätzliches Wort; Name abweichend erkannt (Ähnlichkeit 0.75) |
| zweifelhaft | `name_heike` | Heike. | small.en: HIKER / medium.en: HIKER! | Name abweichend erkannt (Ähnlichkeit 0.60) |
| zweifelhaft | `name_joerg` | Jörg. | small.en: YERG. / medium.en: yergh | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_jules` | Jules. | small.en: Jewels / medium.en: jewels. | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_lia` | Lia. | small.en: Leah. / medium.en: Leah. | Name abweichend erkannt (Ähnlichkeit 0.67) |
| zweifelhaft | `name_nele` | Nele. | small.en: Kneel! / medium.en: Kneel | Name abweichend erkannt (Ähnlichkeit 0.50) |
| zweifelhaft | `name_uwe` | Uwe. | small.en: UVA / medium.en: over. | Name abweichend erkannt (Ähnlichkeit 0.67) |
