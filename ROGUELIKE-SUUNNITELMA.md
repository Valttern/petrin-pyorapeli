# Yö korvessa: roguelike-pelimuoto Petrin pyöräpeliin

Suunnitelma 12.9.2026. Koottu kolmen suunnitteluagentin (roguelike-systeemit, pelituntuma ja teema, toteutettavuus) raporteista; kaikki koodiviittaukset on tarkistettu index.html:stä ja tools/-hakemistosta. Päätösloki: [G] Valtterin päätös, [E] Claude Fablen ehdotus, [A] auki.

Merkittävät oletukset:
- Karhu jahtaa vain osassa pätkiä, ei koko runia. [E, Valtteri hyväksyi suunnitelman jossa tämä oli oletuksena]
- Peli pysyy vaikeana: ei tasoitusta, ei tehokasvua ajojen välillä. [G, aiempi linjaus]
- Prototyyppi ilman uutta grafiikkaa tai ääntä. [E]

## 1. Ydin yhdellä kappaleella

Run on yksi yö korvessa: 7 lyhyttä pätkää iltahämärästä yön kautta aamunkoiton laskuun laaksoon, 12–15 minuuttia. Jokaisen pätkän jälkeen valitaan kahdesta seuraavasta reitistä, ja jokaisessa pysähdyksessä yksi varuste, joka muuttaa pyörän fysiikkaa molempiin suuntiin. Karhu on kartalla näkyvä reviiri, jonka läpi ajaminen on pelaajan päätös; jahtipätkässä yksi virhe päättää runin. Kaatuminen muualla kuluttaa sisua, jota on kolme. Kun run päättyy, kuva pysähtyy ja tili näytetään. Tulos on pisteet, ja sama siemen tuottaa saman runin.

## 2. Runin rakenne

| Syvyys | Kello | dusk | Pätkätyyppi |
|---|---|---|---|
| 0 | ilta | .25 | Harjanne (kartoitus) |
| 1 | hämärä | .40 | valinta: Harjanne / Kalliokieleke |
| 2 | hämärä | .55 | valinta: Korpi (jahti, reviiri) / Suonlaita (pitkä kierto) |
| 3 | yö | .70 | valinta: Harjanne / Kalliokieleke |
| 4 | yö | .85 | Mökki (lepo: +1 sisu tai varuste) |
| 5 | yö | .94 moonlit | Korpi (jahti, reviiri, pakollinen) |
| 6 | aamu | dh:true | Lasku laaksoon (finaali, pisteet vauhdista) |

Pätkän mitta kalibroitiin mittaamalla (12.9.2026, tools/runbank.js): pelin "km" on 1 000 px, ja tekniikkakuski ajaa Kotimetsän (4,2 km) 14 s:ssa, Kalliopolun (7,2 km) 34 s:ssa; karhupaon 60 km kestää flow-kuskilla noin 77 s. Agenttien arviot "1 km = 20 s … 3 min" olivat vääriä. Pätkät ovat siksi nykyisten kenttien kokoluokkaa: tavalliset 6–8 km (tekniikkakuski 15–50 s), karhupätkät 18 km ja syvällä 24 km. Pelaajan todellinen aika mitataan pelitestissä, ei arvata. Rytmi on sahalaita: kaksi kevyttä, yksi raskas, jahti aina kartoituspätkän jälkeen. [E]

Pätkätyypit ja tiiviin reseptin säätimet:

| Tyyppi | style | relief | erityistä |
|---|---|---|---|
| Harjanne, 6 km | harju | .75 | 2 tyhjää + 2 uutta noodia, pisteet asennuksesta, akku kuluu |
| Kalliokieleke, 6 km | kallio | .55 | minGap 90→60, hidas ja tarkka, puhdas läpiajo = bonus |
| Korpi (jahti), 18/24 km | karhupaon resepti | – | chase:true, sprayt, karhupaon mitattu pooli, estemäärä vakio 1,4/km ja koko kasvaa syvyyden mukaan |
| Suonlaita, 6,5 km | kumpu, biome korpi | .40 | suo: Commençalilla lähes ajokelvoton ilman leveää rengasta |
| Lasku, 8 km | lasku, descent | 1.15 | dh-valaistus, biome lehto, karhu ei ehdi |
| Mökki | ei ajoa | | cabin + campfire + lantern -assetit, valinta |

Solmusta reseptiin (deterministinen):
```
seed      = mulberry32(runSeed)-virrasta järjestyksessä (ei runSeed+i)
challenge = 0.28 + 0.055*syvyys + 0.18*riski
relief    = base[tyyppi] + 0.25*riski + 0.06*syvyys
variation = 0.35 + 0.5*riski
rhythm    = riski>.6 ? 'clustered' : syvyys>=4 ? 'rising' : 'even'
cpEvery   = 0   (ei tarkistuspisteitä runissa)
draft     = true (ennätysfunktiot ohittavat runin pätkät automaattisesti)
```
Riski 0…1 näkyy kartalla lukuna ja kertoo solmun pisteet.

## 3. Kuolema ja sisu [G 12.9.2026: sisu 3]

- Sisua on 3. Kaatuminen kartoitus-, tekniikka- ja laskupätkällä vie yhden sisun ja palauttaa 150 px taaksepäin. Sisu 0 = run päättyy.
- Jahtipätkällä kaatuminen on loppu: karhu juoksee ragdollin luo kuten nyt.
- Perustelu: Verlet-kaatuminen on usein onnettomuus, ei päätös. Yksi elämä joka pätkällä opettaa varovaisuutta, joka tekee ajosta tylsää; sisu tekee virheestä kalliin muttei mielivaltaisen. Karhun kohdalla yksi elämä on jo pelitestattu toimivaksi.
- Runin loppukuva: kuva pysähtyy kaatumishetkeen, päälle tili: "Petri ehti 4,2 km · 3 noodia · karhu sai kiinni Korvessa klo 02:40". Repliikit voice_crash- ja voice_caught-varianteista.

## 4. Varusteet: fysiikan vaihtokauppa, ei bonuksia

Sääntö: jokainen varuste muuttaa vähintään kahta BIKES-parametria vastakkaisiin suuntiin, ja hinta on samalla akselilla kuin hyöty. Toteutus kopio-oliona `new Bike(lv,{...BIKES[i],...muutokset})`, BIKES-taulukkoa ei mutatoida (vuotaisi valikkoon ja ennätysavaimiin). rotK, shift ja dh jäävät pyörän identiteetiksi.

MVP:n kuusi varustetta:

| Varuste | Hyöty | Hinta |
|---|---|---|
| Leveä rengas | stick +, absorb +.08 (kivikko, juurakko) | bogDrag −.005, vmax −.3 |
| Esikuormitettu jousi | hop +.20 (bunnyhop rotkon yli) | absorb −.14, jolt ×1.8 |
| Sintteripalat | brake −.035 (pysäyttää laskussa) | rest +.03, vmax −.2 |
| Sprayvyö | spray-katto 3→5, reach 240→330 | stun 2.6→2.2 |
| Akkupankki | lampun keila 260→380 px | acc −.010 |
| Varaakku (harvinainen, vain mökistä tai riskisolmusta) | +1 sisu, max 5 | ei muuta |

Myöhemmin (ei MVP): titaanirunko, nastarenkaat, kahvitermos, suokengät, pippurisumu, pikamasto, temppuhanska ja kolme synergiaa (Ponnahtaja, Suo-oikaisu, Yöasentaja). Synergiat vaativat kombinatorista tasapainotusta headlessillä; ei ennen kuin pohja tuntuu oikealta.

## 5. Akku runin kellona [E]

Otsalamppu kuluttaa game.inv.bat-akkua pätkien yli: keila kapenee ja himmenee (drawDarkness-literaalit 390 ja .3 muuttujiksi). Noodin huolto Harjanteella kuluttaa samaa akkua. Pelaaja valitsee joka pätkällä: näenkö vai pisteytänkö. Vaikeus kiristyy pimeydestä, jota pelaaja itse säätelee, ei hard-kertoimesta. Mökki lataa.

## 6. Karhu

- Vain 2 pätkässä (syvyys 2 valinnainen, syvyys 5 pakollinen). BEAR-vakioihin ei kosketa MVP:ssä; kiristys tulee siitä, että syvyyden 5 maasto on vaikeampaa ja pimeämpää.
- Telegrafointi: reviiri näkyy kartalla (kynnenjäljet, tumma alue), edellisen pätkän lopussa hiljainen kaukainen SFX.roar ja voice_far. Kun jahti alkaa, se on pelaajan päätös.
- Karhun nopeus per run vaatii myöhemmin instanssikenttiä Bear-luokkaan (v0 = 4.1 + 0.42*syvyys), koska BEAR on moduulitason vakio ja nollautuu joka pätkässä. Ei MVP:ssä.
- Noodin asennus kesken jahdin: hyvä idea, mutta E on jahdissa varattu sprayille, generaattori poistaa chase-kentistä noodit (rivi 1207) ja serviceLogic ohitetaan jahdissa. Toteutetaan varusteena (Pikamasto) MVP:n jälkeen.

## 7. Pisteet, siemen, tallennus

- Pisteet: pätkä maaliin 100 × (1+riski); noodi 60; puhdas tekniikkapätkä 120; jäljellä oleva sisu runin lopussa 200/kpl. Kuolema säilyttää siihen asti kertyneet pisteet: pisteet mittaavat ahneutta, eivät selviytymistä.
- Siemenpankki (tehty 12.9.2026): `tools/runbank.js` rakentaa 27 pätkäpaikkaa (9 mallipaikkaa × riski 0 / .5 / 1), mittaa siemenet 1–40 pelin fysiikalla ja kirjoittaa hyväksytyt `tools/runbank.json`-tiedostoon (yhteensä 774 siementä, 83 s). Portit: tavallinen pätkä = tekniikkakuski maaliin Intensellä, kaatumisia riskin mukaan 0–1 / 0–2 / 0–3, portitettuja esteitä/km riskin mukaan nousevassa haarukassa (lasku: ei porttivaatimusta), aika 15–50 s. Karhupätkä = tekniikkakuski 6,8 ja 7,5 px/askel ei kaadu eikä juutu ja pysyy karhun edellä vähintään 6 km (sama raja kuin pelin karhupako-testissä). Flow-kuski hylättiin tuomarina: se kaatuu jo kokoluokan .5 esteisiin, joihin pelaaja selviää (karhupaossa se jää kiinni 8–12 km:ssä, tekniikkakuski 13–15 km:ssä kaatumatta). Havainto: karhupätkällä riski nostaa esteiden kokoa, mutta sovitus pudottaa isoimpia, joten riskin vaikutus on pieni (kiinnijäänti keskimäärin 13,9 → 13,6 km syvyydellä 2); karhupätkän riski kannattaa myöhemmin sitoa karhun nopeuteen, ei maastoon. Run arpoo mallin ja siemenen pankista, joten kelvottomia pätkiä ei synny. Rakennusajat: 6 km 50–120 ms, 18 km karhupätkä ~35 ms.
- Päivittäinen siemen: runSeed = YYYYMMDD, yksi yritys, oma tulostaulu. MVP:n jälkeen.
- Tallennus: omat avaimet petri-pyorapeli-run-v1 (run-tila, kirjoitetaan pätkän lopussa) ja petri-pyorapeli-meta-v1. bestKey-tallennukseen ei kosketa; readBest suodattaisi objektit pois hiljaisesti.
- Meta ilman tehokasvua: avautuu vain valikoimaa (varusteita, solmutyyppejä, neljäs pyörä). Lisäksi pelin oma fiktio: asennetut noodit jäävät verkkoon runien yli ja kuuluvuuskartta kasvaa. Ei MVP:ssä.

## 8. Toteutus: erilliset pätkäkentät, DOM-kartta

- Erilliset def-oliot per pätkä, generoidaan vasta kun pätkä alkaa. Yksi pitkä sektiokenttä hylätty: rakennusaika kasvaa yli-lineaarisesti (4,2 km 46 ms, 12,4 km 962 ms) ja pätkäkohtainen dusk/dh/biome vaatii joka tapauksessa erilliset defit. startLevel ja clearStrips nollaavat jo kaiken; #recipe=-lataaja on valmis siltapala (LEVELS.push + startLevel).
- Uusi tila 'map': frame() simuloi vain play/crash/caught-tiloissa, joten maailma jää piirtymään taustalle ilmaiseksi. #map-overlay showOverlay-listaan, solmukortit renderLevelList-markupin pohjalta.
- Kartan kaksi vaihtoehtoa tulevat siemenpankista, joten niiden vaikeus tiedetään ilman ajonaikaista mittausta. Tämä poistaa kartan kalleimman osan.
- Edellinen pätkä vapautetaan startLevelin yhteydessä (game.levels-välimuisti).
- Musiikki suoraan tyypin ja kellon mukaan: music_easy/mid/hard, dusk/night, tech, chase, dh, win, menu.

## 9. MVP:n työvaiheet (jokainen erikseen pelitestattavissa)

1. ~~Siemenpankki offline~~ tehty 12.9.2026: `tools/runbank.js`, `tools/runbank.json`. Ei koske peliin.
2. Run-tilakone: game.run, pätkien defit siemenvirrasta, draft:true, maali → seuraava pätkä.
3. Sisu ja runin päätösruutu #done-overlayn pohjalta, pysäytetty loppukuva.
4. Vuorokausikaari: dusk-arvot ja dh-finaali.
5. Kartta: #map-overlay, kaksi korttia (tyyppi, riski, palkinto, reviirimerkki).
6. Varusteet kertoimina, 6 kpl, valinta pysähdyksessä; lampun literaalit muuttujiksi; spray-katto.
7. Akku runin kellona ja mökkisolmu.
8. Pisteytys ja run-tallennus omiin avaimiin.
9. Regressiomittaus: testi ajaa N run-siementä headlessinä ja tarkistaa, että jokainen pätkä on läpäistävissä ja vaikeus kasvaa monotonisesti. Tämä on tarkistus, joka voi kaatua.
10. Valtterin pelitesti: kolme runia peräkkäin. Jos kaksi tuntuu samalta, varianssi on liian pieni.

Ulkona MVP:stä: synergiat ja loput varusteet, noodiasennus jahdissa, karhun per-run kiristys, päivittäinen siemen, pysyvä kuuluvuusmeta, uudet repliikkiäänet, pyörän vaihto kesken runin.

## 10. Päätökset [G 12.9.2026]

1. Sisu 3 ilman tarkistuspisteitä; jahtipätkällä yksi virhe päättää runin.
2. Oma valikkokohta "Yö korvessa". Karhupako säilyy ennallaan omine ennätyksineen.
3. Kartta mukaan heti MVP:ssä (kaksi korttia siemenpankista).
4. Pyörä valitaan kerran runin alussa eikä vaihdu; varusteet muokkaavat sitä.

Ei avoimia rakennepäätöksiä. Seuraava askel: työvaihe 1 (siemenpankki offline), joka ei koske peliin.
