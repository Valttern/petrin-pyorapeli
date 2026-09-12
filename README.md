# Petrin pyöräpeli

Elasto Mania -henkinen maastopyöräpeli, jossa Petri kartoittaa oman LoRa-verkkonsa (868 MHz) kuuluvuutta suomalaisessa metsässä: vaihtaa tyhjentyneiden noodien akut, asentaa uusia noodeja mäenharjoille ja polkee metsän läpi mökille.

Koko peli on yksi tiedosto: **`index.html`**. Se toimii sellaisenaan selaimessa ilman palvelinta, kirjastoja tai verkkoyhteyttä (kuvat, musiikki ja äänet on upotettu tiedostoon).

## Pelaaminen

| Näppäin | Toiminto |
|---|---|
| ↑ | Polje |
| ↓ | Jarruta; pysähdyksissä jarru lukitsee renkaan ja pitää pyörän paikallaan rinteessä |
| ← → | Painonsiirto: taakse nostaa keulan säädellysti noin 25°:seen (kaasulla 40°) ja pitää sen siinä, eteen keventää perän; ilmassa kallistaa pyörää vapaasti. Kun keula on esteen päällä ja takarengas askelmaa vasten, kaasu ponnistaa perän askelman yli |
| ← sitten → | Bunnyhop: lyhyt näpäytys taakse (0,1–0,3 s) ja heti eteen, kun keula vasta nousee, ponnistaa pyörän ilmaan. Liian pitkä veto taakse on manuaali, ei hyppy |
| Väli | Käänny ympäri |
| E (pohjassa) | Vaihda akku / asenna noodi |
| R | Palaa viimeiselle huolletulle noodille (tekniikkaradalla osuuden alkuun) |
| Esc | Tauko |
| M | Äänet päälle / pois |

28 reittiä kahdeksassa ryhmässä (Helppo, Keskitaso, Vaikea, Iltahämärä, Yö, Alamäki, Tekniikka, Generaattori) ja kolme pyörää: vanha Kuwahara-jäykkäperä, täysjousitettu Intense ja alamäkipyörä Commençal. Pää ei saa osua maahan. Parhaat ajat tallentuvat selaimeen.

Temput lyhentävät kokonaisaikaa. Takavoltti antaa 1,5 s ja etuvoltti 2,0 s, jokainen lisäkierros samassa hypyssä 1,0 s lisää. Manuaali (takapyörällä) ja nose-manuaali (etupyörällä) vaativat etenemistä ja vähintään sekunnin, ja antavat 0,25 s jokaista sekuntia kohti, enintään 0,8 s per manuaali. Bonus kirjataan vasta, kun pyörä on pysynyt maassa hetken laskeutumisen jälkeen; kaatuminen mitätöi odottavan tempun. Ajastin näyttää temppubonuksen vähennettynä, ja ennätys tallennetaan tästä nettoajasta. Kertoimet ovat `TRICKS`-oliossa.

Iltahämärän ja yön reitit ajetaan otsalampun valossa: aurinko laskee, tähdet ja kuu nousevat, tulikärpäset, lepakot ja pöllöt heräävät, ja näkyvyys rajoittuu lampun keilaan. Esteet ovat Trials-henkisiä taitokynnyksiä: kalliohyllyt ja kannot (nosta keula: kallistus taakse ja kaasu), notkot (pudotus ja heti perään lähes pystysuora seinä, josta noustaan vain vauhdilla), hypyt kalliohyllyille (seinän juuri on neljännesputki: vauhdilla ja paino edessä sen ajaa ylös, ilman painonsiirtoa pyörä kääntyy selälleen), syöksyhypyt (pitkä alamäki, iso kalliohyppyri ja rotko: polkien lento kantaa laskeutumisrinteeseen, rullaten jäät rotkoon), kaksoisrotkot, pudotusportaat, louhikkorinteet, juurakot ja kaatuneet rungot. Tarkistuspisteitä ei ole erikseen: akunvaihto tai noodin asennus tallentaa paikan, johon R palauttaa.

Alamäkitason kolme reittiä (Rinnelasku, Kivikkokouru, Syöksylasku) ovat yhtä laskua vaaran laelta laaksoon syysaamun auringonnousussa: koko maasto viettää alaspäin, taustalla kultainen koivikko ja laaksoa peittävä usvameri, jonka läpi lasketaan. Esteet ovat alamäkiratojen omia: porras- ja pöytähyppyjä, joissa huulen takana on pitkä laskeutumisrinne, kivisiä kouruja ja niiden pohjan kompressioita, metsäautotien yli meneviä gappeja (tien voi myös ajaa pohjan kautta), aaltoja, louhikkorinteitä ja siirtolohkareita. Laskurinteessä pienikin hyppyri lentää satoja pikseleitä, joten esteiden laskeutumisrinteet on muotoiltu lennon suuntaisiksi.

Alamäkipyörä (Commençal) on tason ainoa järkevä valinta: 200 mm joustoa ja kierrejousi imevät osumat ja jarrut pysäyttävät rinteessä, mutta se kiihtyy huonosti, ei nouse keulalleen kevyesti eikä jaksa nousuja &ndash; ja uppoaa suohon. Muilla reiteillä se on taakka.

## Julkaisu

Tiedosto `index.html` riittää. Esimerkiksi:

- **GitHub Pages**: ota Pages käyttöön repon asetuksista (branch `main`, hakemisto `/`), jolloin peli löytyy osoitteesta `https://<käyttäjä>.github.io/<repo>/`.
- **Netlify / Cloudflare Pages / Vercel**: julkaise repon juuri sellaisenaan, build-komentoa ei tarvita.
- Tai kopioi pelkkä `index.html` mihin tahansa staattiselle palvelimelle.

## Kehitys

Assetit generoidaan OpenRouterin malleilla ja upotetaan tiedostoon työkaluilla `tools/`-hakemistossa. OpenRouter-avain luetaan projektin juuren `.env`-tiedostosta (`OPENROUTER_API_KEY=...`), jota ei versioida.

```bash
python3 tools/gen_assets.py            # kuvat (Gemini 3.1 Flash Image), promptit ja ankkurit tools/assets.json
python3 tools/gen_audio.py             # musiikki (Lyria 3) ja Petrin repliikit (GPT Audio), tools/audio.json
python3 tools/gen_audio.py --check     # Gemini kuvailee ja litteroi valmiit raidat
python3 tools/build.py                 # upottaa assets/ -kansion index.html-tiedostoon
deno run --allow-read tools/levelgen.js report <id|resepti.json>   # kenttägeneraattorin raportti (ks. Kenttägeneraattori v2)
python3 -m http.server 8765            # paikallinen testaus: http://localhost:8765/index.html
```

Raakakuvat ja -äänet (`assets/raw/`, `assets/audio/raw/`) eivät ole versionhallinnassa; jälkikäsitellyt assetit ovat.

Pelin sisällä: Verlet-fysiikka 120 Hz (kaatuessa kuljettaja irtoaa pyörästä 11 nivelen ragdolliksi, joka lentää vauhdin suuntaan, osuu maastoon ja pysähtyy; pyörä kaatuu erikseen ja kamera seuraa kuskia, R palauttaa heti lipulle), maastoon kaiverretut esteet spritejen omista profiileista, neljän harjanteen parallax-tausta, kaistavälimuistitettu piirto, WebAudio-syntetisoitu metsä (linnut, tuuli, hyönteiset; hämärässä sirkat, pöllöt ja kuikka) ja pyörän äänet, LoRa-kuuluvuusmalli (log-distance + maaston katve). Hämärän valaistus: maailma piirretään päivävärein ja tummennetaan pimeyskerroksella, johon otsalamppu, noodien LEDit, lyhdyt, nuotio, mökin ikkunat ja auton ajovalot syövät reikiä; taivas (auringonlasku, tähdet, kuu) piirretään lopuksi kaiken taakse. Alamäkireiteillä aamuaurinko, säteet, lämmin utu, syksyn sävyt maastossa ja korkeuseron takia alemmas siirretyt taustakerrokset.

Kehitystestaus ilman index.html:n muuttamista: `python3 tools/build.py --out dev.html` kirjoittaa upotetun version erilliseen tiedostoon (gitignoressa).

## Tekijät

Kuvitus, musiikki ja Petrin ääni on luotu OpenRouterin malleilla (Google Gemini 3.1 Flash Image, Google Lyria 3, OpenAI GPT Audio). Kaikki muu on käsin tehtyä.

## Uusien kenttien tekeminen

Kentät ovat `index.html`-tiedoston `LEVELS`-taulukossa. Jokaisella on pysyvä, yksilöllinen `id`: älä vaihda sitä julkaisemisen jälkeen. Kenttiä voi järjestää uudelleen ilman ennätysten sekoittumista. Vanhat järjestysnumeroihin perustuvat ennätykset tuodaan automaattisesti `petri-pyorapeli-best-v2`-tallennukseen; alkuperäinen tallennus säilyy varmuuskopiona. `LEGACY_LEVEL_IDS` kuvaa alkuperäistä järjestystä, eikä sitä muuteta.

Hylätty louhos löytyy Vaikea-ryhmästä, ja sille suositellaan Intenseä. Reitti etenee kahdesta kalliohyllyosuudesta hyllyhyppyyn, louhikkolaskuun ja lopun syöksyhyppyyn. Mukana ovat tavalliset kartoitus- ja huoltotehtävät sekä tarkistuspisteet.

`placements` määrittää estealueiden keskipisteet pikseleinä. Tuetut tyypit ovat `ledges`, `kickerwalls`, `rockslopes` ja `bigairs`. Esimerkiksi `ledges:2` ja `placements:{ledges:[1200,2200]}` sijoittavat kaksi hyllyosuutta valittuihin kohtiin. Esteiden mitat määräytyvät edelleen siemenluvusta ja vaikeudesta. Jätä tilaa vauhdinotolle ja laskeutumiselle: syöksyhyppy tarvitsee noin 1 500 pikselin alueen. Päällekkäinen tai kentän reunojen yli menevä käsin asetettu alue aiheuttaa virheen. Ilman sijoitusmääritystä käytetään entistä satunnaissijoittelua.

### Kenttägeneraattori v2 (reseptit, `gen:2`)

Kaikki kentät ovat reseptejä: jokainen `LEVELS`-rivi kulkee saman generaattorin (`buildLevel2`), piirron, assettikerroksen, editorin ja mittauksen läpi. Vanhat 19 kenttää on muunnettu resepteiksi (`terrain` kohinasta, `features:{strategy:'random',fit:true,counts:{...}}`, Hylätty louhos `placed`-listalla) ja niiden ennätykset alkavat alusta (`recordVersion:2`; vanhat ennätykset säilyvät selaimen tallennuksessa). Tekniikkaradat rakentuvat `TECHNICAL_ROUTES`-palalistoista, jotka `routeToSections` muuntaa osuuksiksi: jokainen pala on estekirjaston este tarkoin mitoin, joten radat käyttävät samaa maastoa, kalliokaistoja, kallio-biomin puita ja spritejä kuin muut kentät (`stairs`- ja `stairsdown`-palat, `slab`, `slabdown`, `slope` ja `pipe` ovat myös estekirjastossa). Generaattori-ryhmän viisi reittiä on tehty resepteinä uusilla mekaniikoilla ja mitattu haastaviksi: **Kelokallio** (tiivis resepti, kallio, käsin sijoitettu syöksy ja rotko-hylly), **Louhosportaat** (käsin piirretty porrastettu louhos, venytetyt pystysuorat portaat ja hyllyjonot 60 px:n välein), **Suurvaara** (korkeuserot 1.9, rotkoja ja syöksyjä huippujen rytmissä), **Rotkoraja** (pelkkiä ilmalentoja kasvavassa järjestyksessä) ja **Korpiraivio** (matalan vauhdin tekniikkaa 40 px:n välein). Yksinkertaisempi esimerkki on tiedostossa `tools/recipes/esimerkki.json`.

**Tiivis resepti** riittää useimpiin kenttiin: kuusi pääsäädintä, jotka generaattori laajentaa täydeksi reseptiksi (`levelgen.js expand <id>` näyttää tuloksen).

```js
{id:'kallioketo',name:'Kallioketo',tier:7,gen:2,desc:'...',seed:331,length:7800,
 style:'kallio',relief:.6,challenge:.55,rhythm:'rising',biome:'kangas',variation:.6}
```

| Säädin | Merkitys |
|---|---|
| `style` | maaston tyyli: `kumpu` (pyöreä kohina), `harju` (terävät harjut), `vaara` (pitkät nousut), `kallio` (porrastettu kallio), `notko` (keskipistesiirto), `lasku` (laskureitti) |
| `relief` 0…2 | korkeuserot: amplitudi (50…350 px, yli 1 = vaaramaisema 350…800 px ja pidemmät kummut), kaltevuusraja (20…46°) ja kallion askelkorkeus |
| `challenge` 0…1 | haastavuus: `hard`, esteiden määrä ja estetyypit, joiden intensiteetti on lähellä arvoa; tarkistuspisteväli ja suosituspyörä |
| `rhythm` | `even` (tasavälit), `clustered` (esteryhmät), `rising` (kiihtyvä), `peaks` (kaksi huippua) |
| `biome` | metsätyyppi (ks. `assets`) |
| `variation` 0…1 | esteiden mittahajonta, macro-vaihtelu, karheus, tiheiköt ja aukeat |

Täysi resepti (alla) on edelleen käytettävissä, ja tiiviissä reseptissä nimenomaiset `terrain`-, `difficulty`-, `features`- ja `assets`-avaimet sekä noodimäärät ohittavat laajennuksen. Jos esteet eivät mahdu tiiviin reseptin pituuteen, generaattori pudottaa esteitä, kunnes ne mahtuvat; täydessä reseptissä se on virhe.

```js
{id:'harjukierros',name:'Harjukierros',tier:7,gen:2,desc:'...',seed:302,length:8000,
 terrain:{algo:'ridged',amp:230,wl:1500,octaves:3,gain:.3,rough:6,maxSlope:30},
 difficulty:{hard:.35,curve:[.6,1,1.2],target:{gated:[4,8],finished:true}},
 features:{strategy:'rhythm',sequence:['bumps','ledge','rest','gap','rocks','kickerwall','rest','rockslope','bigair'],gap:260},
 assets:{obstacles:1,stones:1,forest:1},rec:1,lowNodes:3,okNodes:1,newNodes:3}
```

**`terrain`** valitsee pohjamaaston algoritmin ja korkeuserot (`amp` = korkeus px, `wl` = kumpujen pituus px):

| `algo` | Luonne | Omat säätimet |
|---|---|---|
| `noise` | pyöreät kummut (fBm) | `octaves`, `gain`, `lacunarity` |
| `ridged` | terävät harjut ja syvät notkot | `sharp` |
| `midpoint` | keskipistesiirto, fraktaalinen karheus | `H` (0.6 rosoinen … 1.0 sileä) |
| `spline` | käsin piirretty profiili | `points:[[x,h],...]`, h = korkeus ylöspäin |

Jälkikäsittelyt toimivat kaikkien kanssa: `detailAmp`/`detailWl` (pienet kumpareet ison muodon päälle), `rough` (pintakarheus), `descent` (alamäkireitin kokonaispudotus; negatiivinen arvo tekee nousureitin), `terrace` (korkeus porrastetaan askelkorkeuteen; alle 18 px rullataan yli, siitä ylöspäin keula on nostettava), `maxSlope` (kaltevuusraja asteina; 50° on nousun fysikaalinen raja; spline-profiilille oletus 38°, jotta piirretyt nousut pääsee ylös) ja `macro` (0…1: korkeus ja kumpujen pituus vaihtelevat hitaasti matkan mukana, jolloin reitillä on sekä tasaisia että mäkisiä jaksoja).

**`difficulty`**: `hard` (0…1.25) skaalaa esteiden mittoja kuten ennenkin, `curve` kertoo sen matkan funktiona (esim. `[.3,.7,1.1]` = kevyt alku, tiukka loppu), `variety` (0…1) painottaa esteiden mitat ääripäihin (samassa kentässä matalia ja korkeita hyllyjä, lyhyitä ja pitkiä rotkoja) ja `target` on mitattu tavoitehaarukka siemenhakua ja testejä varten (`score`, `gated`, `climb`, `finished`).

**`features`** on sijoittelustrategia tai lista strategioita, jotka sijoitetaan samaan kenttään järjestyksessä:

- `random` + `counts:{ledge:2,gap:1,...}`: kuten vanha generaattori, mutta este, joka ei mahdu, on virhe eikä katoa hiljaa.
- `rhythm` + `sequence:['ledge','rest','gap',{type:'bigair',hard:.9}]`: esteet tässä järjestyksessä tasaisin välein; `rest` lisää levähdysvälin (`gap` px).
- `curve` + `count`, `pool`: haastavuuskäyrä valitsee esteet niiden intensiteetin (`cost`) mukaan, kevyet alkuun ja raskaat loppuun.
- `manual` + `list:[{type,x,hard}]`: keskipisteet pikseleinä.

Reseptin `placed:[{type,x,hard,stretch,gap}]` on lyhyt tapa lisätä käsin sijoitettuja esteitä minkä tahansa strategian rinnalle (editorin "Lisää este" kirjoittaa tähän): ne sijoitetaan ensin, ja automaattiset esteet sovitetaan niiden väliin jääviin vapaisiin jaksoihin. Esteen `hard` (0…2) on sen oma koko, `stretch` (0.4…4) venyttää sitä pituussuunnassa (portaat, töyssyt, kivikot ja lohkareikot saavat lisää toistoja samalla askelkoolla, rotkot ja kuopat levenevät), `size` (0.3…3) skaalaa sen korkeuksia alustaan nähden (editorissa raahaus ylös tai alas) ja `gap` on sen oma vähimmäisväli naapureihin pikseleinä. Reseptin `minGap` asettaa kaikkien esteiden vähimmäisvälin, jolloin estejonosta saa tiiviin: väli 24…200 px tarkoittaa, ettei esteiden väliin jää vauhdinottoa. Samat avaimet käyvät `manual`- ja `rhythm`-strategioiden esteolioissa.

`rhythm` ja `curve` ottavat lisäksi `spacing:'even'|'clustered'`: tasavälit tai esteryhmiä ja pitkiä tyhjiä jaksoja välissä (kuten tekniikkaradoilla).

Tuetut estetyypit ovat `FEATURES`-kirjaston avaimet (38): `bigair`, `roadgap`, `stepdown`, `chute`, `rollers`, `ledge`, `combo`, `kickerwall`, `doublegap`, `dropseries`, `rockslope`, `plateau` (hylly ylös, laki ja pudotus), `hump` (iso pyöreä kumpare), `valley` (syvä painanne), `stepsdown` (laskevat hyllyt), `rockgarden` (erikokoisia kiviä hajallaan), `tabletop` (pöytähyppy), `doubles` (kaksoishyppy, notko välissä), `whoops` (epätasaiset töyssyt), `logledge` (hylly ja tukki sen laella), `rootclimb` (juurakkonousu 26…36°), `boulderfield` (2…3 lohkaretta), `sinkhole` (kapea kuoppa, 40° nousu ulos), `ridge` (terävä harjanne), `gapledge` (rotko ja heti hylly), `boulder`, `stump`, `roots`, `trunk`, `gap`, `wall`, `drop`, `stairs` (pystysuorat askelmat, venytys lisää askelmia samalla korkeudella), `slab`, `slabdown`, `slope`, `pipe`, `bog`, `logpile`, `kicker`, `bumps`, `rocks` (monikkomuodot käyvät myös). Testi ajaa jokaisen tyypin tekniikkakuskilla läpi. Jokainen este saa automaattisesti tasaisen vauhdinoton ja tasanteen maaston luonnolliseen korkeuteen esteen keskellä: alustalle noustaan tai laskeudutaan loivalla rampilla ja esteen jälkeen palataan rampilla pohjamaaston korkeuteen. Näin hylly ei osu alamäen pohjalle, rinteen keskelle ei synny seinää ja pohjamaaston korkeuserot säilyvät koko matkalla myös tiheässä estejonossa.

**`assets`** säätää maanpinnan assettien tiheyttä (`obstacles`, `stones`, `forest`; 1 = oletus), metsätyyppiä (`biome`: `seka`, `kangas` = kuiva männikkö ja kantoja, `korpi` = tiheä kuusikko, sieniä ja runkoja, `lehto` = koivua ja pensaita, `kallio` = keloja, katajia ja kiviä) ja aukeita (`glades` 0…1). Metsän tiheys vaihtelee reitillä tiheiköistä aukeisiin. Generaattori valitsee assetin maaston mukaan: jyrkkiin rinteisiin ja lakiin kiviä, mäntyjä, keloja ja katajia; notkoihin ja suon laitaan kuusia, koivuja ja sieniä; tasaiselle metsämaalle tukkeja, kantoja, lohkareita ja varvikkoa. Maassa makaavat esteet kaiverretaan maastoon spriten omasta profiilista (törmäys = kuva) ja vain loiviin kohtiin; puita ei laiteta jyrkänteisiin, esteiden eikä noodien päälle.

Mittaus ja siemenhaku ilman selainta (`tools/levelgen.js`, sama fysiikka kuin pelissä):

```bash
deno run --allow-read tools/levelgen.js report harjukierros          # geometria, este-estekohtainen portitus, tekniikkakuskin ajo, haastavuusluku
deno run --allow-read tools/levelgen.js profile harjukierros         # ASCII-korkeusprofiili esteineen, noodeineen ja tarkistuspisteineen
deno run --allow-read tools/levelgen.js sweep harjukierros --seeds 301-340   # mitkä siemenet osuvat difficulty.target-haarukkaan
deno run --allow-read tools/levelgen.js report tools/recipes/esimerkki.json  # resepti tiedostosta ilman index.html:n muokkausta
```

**Kenttien uusiminen haasteprofiililla.** `levelgen.js retune <id|all>` rakentaa kentälle uuden estejonon säilyttäen maaston, biomin, hämärän ja tehtävät, ja hakee siemenen, jolla tekniikkakuski pääsee maaliin ja portteja on tavoitteen verran. Profiili valitaan vaikeustason mukaan (`kevyt`, `keski`, `raskas`, `hamara`, `yo`, `alamaki`) ja teemapooli kentän tunnuksen mukaan (Juurakko juurakoita, Louhikko lohkareita, Rotkolaakso rotkoja jne.). Esteet arvotaan rooleittain (nousut, laskut, rytmiesteet, maaesteet, kuopat) profiilin painoin, sama tyyppi enintään kolmesti per kenttä, ja välit ovat 50–120 px kuten testaajien kentissä. `--out hakemisto` tallentaa reseptit JSON-tiedostoina ja `--rows 1` tulostaa LEVELS-rivit; mittarit kirjautuvat reseptin `difficulty.target`-avaimeen (`gatedPerKm`, `finished`, `maxCrashes`), jota testit vahtivat.

**Editori.** `tools/editor.html` on selaineditori: tiiviin reseptin kuusi pääsäädintä, "Piirrä reitti" (koko reitin korkeusprofiili piirretään hiirellä kartalle; piirroksesta tulee spline-ohjauspisteet, jyrkimmät kohdat loivennetaan ajettaviksi ja esteet, assetit ja noodit hoituvat algoritmeilla), "Lisää este" (estetyyppi valitaan valikosta tai muotokuvista, paikka klikataan kartalta; käsin lisättyjä esteitä voi raahata ja säätää niiden kokoa, venytystä ja väliä), lisäasetukset erillisen otsikon alla (laskettu arvo harmaana, muutettu arvo kirjautuu reseptiin ohituksena), profiilikuva esteineen ja noodeineen samassa mittakaavassa kuin pelissä (valinnalla "venytä korkeus" pystysuunta venytetään), mittaus ja siemenhaku samalla fysiikalla, LEVELS-rivin kopiointi ja "Pelaa luonnos", joka avaa pelin osoitteella `index.html#recipe=<base64>` (luonnos lisätään väliaikaisesti Generaattori-ryhmään eikä sen ennätyksiä tallenneta). Käynnistä `python3 -m http.server 8765` ja avaa `http://localhost:8765/tools/editor.html`. Komentorivillä `levelgen.js row resepti.json` tulostaa saman LEVELS-rivin.

**Varianssi.** Kentät alkavat muistuttaa toisiaan, jos pohja-algoritmi, `wl`, estetyypit ja välit ovat samat. Keinot erottaa kentät: eri `algo` (pyöreä kohina, terävät harjut, keskipistesiirto, käsin piirretty spline), `macro` (mäkiset ja tasaiset jaksot samassa kentässä), `terrace` (porrastettu kallio), `variety` (esteiden mitat ääripäihin), `spacing:'clustered'` (esteryhmät ja pitkät rullausjaksot), `curve` (eri rytmi: kevyt alku tai vaikea alku), `biome` ja `glades` (eri metsä ja aukeat), uudet estetyypit (`plateau`, `hump`, `valley`, `stepsdown`, `rockgarden`) sekä `descent` (laskureitti) ja `dusk` (hämärä). Esimerkkikentät käyttävät näitä eri tavoin: Harjukierros on ryhmitetty kalliobiomi, Porraskallio kangasmetsän porraskallio aukeineen, Notkelmat macro-vaihteleva korpi.

**Testaajien kentät.** Editori on julkaistuna samassa osoitteessa kuin peli: `https://<käyttäjä>.github.io/<repo>/tools/editor.html` (pelin valikossa on linkki). Testaajan työnkulku: rakenna kenttä, "Pelaa luonnos" avaa sen peliin, "Tallenna nimellä" pitää sen tallessa omassa selaimessa, "Kopioi jakolinkki" antaa osoitteen, jolla kenttä avautuu editorissa tai pelissä kenellä tahansa (koko resepti on osoitteen `#recipe=`-osassa), ja "Lähetä kenttä (GitHub)" avaa valmiiksi täytetyn issuen, jossa on pelilinkki, LEVELS-rivi ja resepti JSON-muodossa (vaatii GitHub-tunnuksen; pitkä resepti ladataan "Lataa JSON" -napilla ja liitetään issueen tiedostona). Kentän lisääminen peliin: liitä issuen LEVELS-rivi `index.html`-tiedoston `LEVELS`-taulukkoon (Generaattori-ryhmä `tier:7`) tai tallenna JSON `tools/recipes/`-hakemistoon ja aja `deno run --allow-read tools/levelgen.js report tools/recipes/<nimi>.json`.

Raportin *portitettu* este on sellainen, jonka pelkkä kaasu ja jarru ei ohita vähintään kolmella neljästä vauhdista; *tekniikkakuski* nostaa keulan, siirtää painoa ja jarruttaa laskuissa, ja sen on päästävä maaliin. Haastavuusluku 0…1 painottaa portteja (40 %), jyrkkyyttä, nousumetrejä ja kuskin kaatumisia (20 % kukin). Työnkulku: kirjoita resepti, aja `profile` ja `report`, säädä, hae `sweep`-komennolla siemen, joka osuu tavoitteeseen, ja kokeile selaimessa.

Tekniset tarkistukset (Deno):

```bash
deno test --allow-read tests/game_test.js   # generaattori, fysiikka, ennätykset
deno test --allow-read tests/smoke_test.js  # savutesti: koko skripti tynkä-DOM:lla, valikko ja jokainen kenttä käynnistyy
```

Testit tarkistavat ennätysten siirron ja järjestyksestä riippumattomuuden, että jokainen kenttä on resepti ja rakentuu, louhoksen estejärjestyksen sekä reseptikentät: rakentuminen ja esteiden välit, maanpinnan assettien kaiverrus ja puiden sijoittelu, pohja-algoritmien kaltevuusraja, porrastus ja spline-pisteet, sijoitteluvirheet, ja että tekniikkakuski ajaa jokaisen reseptikentän maaliin tavoitehaarukassa. Ajettavuus ja hyppyjen vaikeustaso on lisäksi kokeiltava selaimessa.

## Suorituskyky

Peli on mitattu headless Firefoxilla (ohjelmistopiirto, siis pessimistinen mutta vertailukelpoinen): piirto vei alun perin 21 ms ruutua kohti päivätasolla 1280×800-koossa, mistä puolet meni harjannekerrosten kaistojen blittaukseen pehmennyksellä (2,7 ms per kerros) ja loput koko ruudun liukuväritäyttöihin (päivätaivas 3,4 ms, horisontin ja keskimetsän usva 1,8 ms kumpikin). Simulaatio on mitätön (0,05–0,3 ms). Korjaukset: kaistat blitataan ilman pehmennystä, kun kaistan mittakaava on täsmälleen ruudun (`blitStrip`, 1:1-piirto ei sumene), ja staattiset koko ruudun kerrokset (`screenLayer`: päivätaivas, horisontin usva, keskimetsän usva, hämärätaivaan liukuväri, aurinko ja kuu 8 px:n horisonttiaskelin) piirretään kerran välimuistikanvakselle ja blitataan. Tulos: päivätasot 21 → 4,7 ms, piirretty tyyli 10,8 → 3,4 ms, hämärätasot 21,7 → noin 8 ms; jäljellä oleva iso erä on pimeyskerros (`drawDarkness`, 1,9 ms, puoliresoluutio kokeiltiin ja oli hitaampi).

Tarkastukset: pelissä **F** näyttää suorituskykymittarin (fps, ruudun/simulaation/piirron ajat liukuvana keskiarvona, p95 ja pahin ruutu, kaistavälimuistin koko ja maalaukset); sama data on `PERF`-oliossa konsolille. `tests/game_test.js` sisältää suorituskykytestin: jokainen kenttä rakentuu alle 2,5 sekunnissa ja kaikki yhteensä alle 12 sekunnissa, ja 10 sekuntia fysiikkaa karhun kanssa simuloituu alle 0,4 sekunnissa. Piirron mittaus vaatii selaimen: F-mittari tai headless-harness (kopio index.html:stä, jossa rAF-silmukka korvataan käsin ajetuilla ruuduilla ja piirtofunktiot kääritään ajanottoon).

## Karhupako

**Karhu kannoilla** (Karhupako-taso) on erillinen pelimoodi: karhu jahtaa Petriä hämärtyvässä korvessa ja tavoite on päästä niin pitkälle kuin mahdollista kaatumatta. Kaatuminen tai liian hidas ajo päättyy karhun tassuniskuun, ja tulos on matka kilometreinä (paras matka tallentuu pyöräkohtaisesti). Reitti on 60 km pelkkää maanmuotoa ilman kiviä ja kantoja: loiva kokonaislasku pitää vauhdin päällä, ja esteet on valittu mitatusti (`tools`-simulaatio flow-kuskilla, joka pitää kaasun pohjassa ja tasaa nokan ilmassa): alkuun täydessä vauhdissa turvalliset kumpareet, hyppyrit, harjanteet ja laskevat hyllyt, loppua kohti pudotukset, kaksoishypyt ja rotkot. Töyssysarjat ja notkot on jätetty pois, koska ne kaatavat vauhdissa.

Karhu (`Bear`, fysiikkaosiossa) juoksee maanpintaa pitkin: tavoitenopeus kasvaa matkan mukana (4,1 px/askel alussa, 6,9 px/askel 60 km:ssä), ylämäki hidastaa ja alamäki nopeuttaa hieman, ja kaukana (yli 600 px) se saa 12 % lisävauhtia, jotta se pysyy ruudun reunalla. Karhuspray-purkkeja on reitillä 2,4–3,8 km välein ja mukaan mahtuu kolme; E käyttää purkin vain, kun karhu on 240 px:n päässä (muuten purkki ei kulu), jolloin karhu perääntyy ja seisoo 2,6 s. Purkit ovat hätävara, eivät strategia: pelkällä sprayllä karhua ei pidä loitolla.

Tunnelma: hämärä (`dusk .55`) ja otsalamppu, jonka keila osoittaa eteenpäin, joten takana juokseva karhu näkyy pimeästä lähinnä hehkuvina silminä ja hahmona; HUD:n kartta on korvattu karhumittarilla (etäisyys metreinä, sykkivä punainen palkki), syke (syntetisoitu, 62–168 bpm etäisyyden mukaan), murinat ja askelten jyminä vasemmalta, ruudun tärinä karjaisussa ja lähellä, punainen reunavinjetti, oma jahtimusiikki (`music_chase`, Lyria) ja Petrin repliikit (`voice_bear1..3`, `voice_spray`, `voice_spraypick`, `voice_caught`, `voice_escape`, `voice_far`). Karhun juoksuruudut `bear_run1`/`bear_run2`, purkki `spray` ja avainkuva `keyart7` on generoitu `tools/gen_assets.py`:llä. R aloittaa juoksun alusta. Kalibrointi: flow-kuski 6,5 px/askel Intensellä saa ensimmäisen läheltä piti -tilanteen 12–15 km:ssä (noin 20 s), koko matka kestää 1–2 minuuttia; Kuwahara jää kiinni noin 9 km:ssä ilman sprayta ja alamäkipyörä on hidas nousuissa.

## Roguelike-pelimuoto (työn alla)

Suunnitelma on tiedostossa `ROGUELIKE-SUUNNITELMA.md`. Runin pätkät arvotaan etukäteen mitatusta siemenpankista: `node tools/runbank.js bank` rakentaa jokaisen pätkäpaikan (malli × syvyys × riski) reseptin, ajaa siemenet pelin tekniikkakuskilla ja kirjoittaa hyväksytyt `tools/runbank.json`-tiedostoon; `scan <paikka>` näyttää yhden paikan siemenjakauman ja `profile <paikka> <siemen>` korkeusprofiilin. Toimii Nodella ja Denolla.

## Tekniikka

Neljä Trials-henkistä kalliorataa korkean vaaran laella, joilla ei ole akunvaihtoa eikä kuuluvuustehtäviä: pelkkää teknistä ajamista graniitilla, vauhti ei ratkaise. Radat piirretään omilla kallioasseteilla (graniittitiili `granite`, kalliovaarat `hills_rock`, kelot, katajat, varvikot `heath`, latomukset `cairn`, avainkuva `keyart6`). **Kalliokärki** (7 osuutta) on tehty uusille mekaniikoille (säädelty keulan nosto, perän ja keulan ponnistus askelmaa vasten): 30–36 px:n hyllyt, pystysuorat portaat ylös ja alas (`stairs`- ja `stairsdown`-palat), kaksoishylly 64 px:n välein, rotko ja korkea porras, lohkarerinne, pudotus hyllylle ja 48° kärki. **Graniittiportaat** (5 osuutta) opettaa perustaidot yksi kerrallaan: 35° silokallion nousu ja lasku, pystysuora hylly, kaksoisporras, lohkare ja 60° porras sekä 42° lasku matalaan hyllyyn. **Kallionkieli** (6 osuutta) yhdistelee: 42° laki ja ahdas pohja, lohkareet ja porras, hylly ja pudotus kapealle tasanteelle, vauhtia vaativa rotko ja sen jälkeinen porras, kolmen hyllyn portaikko ja 46° loppulasku kivikkoon. **Kivinen kruunu** (6 osuutta) laittaa kaiken peräkkäin tiukoilla tasanteilla: 47° silokalliot, kasvavat hyllyt lyhenevillä tasanteilla, pitkä kielekehyppy, lohkarepuutarha, pudotusportaat ja kruunu. Jokaisen osuuden edessä on tarkistuspiste; osuuden ajaminen kaatumatta palkitaan ("Puhtaasti!"). Suosituspyörä on Intense.

Radat on suunniteltu niin, että pelkkä kaasun ja jarrun annostelu **ei** riitä: pystysuorat hyllyt (24–34 px, korkeampia kuin renkaan säde) pysäyttävät etupyörän ja vaativat keulan noston (← + ↑) ja heti perään painonsiirron eteen (→); 45–47° silokalliot vaativat vauhdin säilyttämisen ja painon eteen, jotta pyörä ei looppaa; 40–46° laskut ja pudotukset vaativat painon taakse ja jarrun annostelun; rotkot vaativat vauhtia, mutta heti laskeutumisen jälkeen tuleva hylly rajaa sen ylhäältä. HUD näyttää osuuden nimen, suositellun vauhdin ja ajovihjeen.

`TECHNICAL_ROUTES` kuvaa jokaisen osuuden rakennuspaloina vasemmalta oikealle (`flat`, `slope`, `slab` kulma-asteina, `ledge`, `drop`, `gap`, `pipe`, `kicker`, `rocks`, `boulder`, `trunk`, `stump`, `log`, `roots`). `buildTechnicalLevel` rakentaa profiilin paloista, kaivertaa sprite-esteet maastoon samalla `carveObst`-funktiolla kuin muut kentät (törmäys = kuva) ja sijoittaa osuudet 340 px:n levähdysväleillä; radan pituus lasketaan paloista, ja `LEVELS`-rivin `length` on pidettävä samana (testi tarkistaa). Hyllyt ja pudotukset piirretään graniittiseinäminä varjoineen; kalliolla kasvaa keloja, katajia ja mäntyjä (uudet spritet `kelo`, `juniper`), ja valmis-ruudussa on oma taide (`keyart5`). Musiikkina on oma raita (`music_tech`), silokalliolla renkaan ääni on soraa hiljaisempi ja kirkkaampi, ja Petrillä on uudet repliikit: lähtö ("Tekniikkarata. Rauhassa ja tarkasti."), puhdas osuus ("Puhtaasti!") ja looppivaroitus takapyörällä ("Paino eteen!"). Uudistettujen ratojen `recordVersion:3` erottaa ennätykset vanhasta geometriasta.

Testit (`tests/game_test.js`) ajavat jokaisen osuuden kahdella ohjelmallisella kuskilla suoraan pelin fysiikalla: tekniikkakuskin (keulan nosto hyllyille, painonsiirto rinteissä ja ilmassa, jarrutus laskuissa) on läpäistävä jokainen osuus osuuden suositusvauhdilla, ja pelkkää kaasua ja jarrua käyttävän kuskin on juututtava tai kaaduttava vähintään kolmella neljästä vauhdista vähintään 70 %:ssa radan osuuksista. Näin radat pysyvät sekä ajettavina että teknisinä; ihmisen kokema tuntuma arvioidaan pelitestissä. Kehitysapuna fysiikan rajoja voi mitata samalla tavalla (esim. pystysuora hylly ≥ 18 px pysäyttää etupyörän kaikilla vauhdeilla, 50° on nousun raja).

Kenttäkohtainen `nodePositions` voi korvata noodin generoidun x-sijainnin (avain on noodin nollasta alkava luontijärjestys, ilman gatewayta). Rinnelaskun viimeinen tyhjentynyt noodi on siirretty erilleen toimivasta noodista; sen akunvaihto testataan oikealla palvelulogiikalla ja alamäkipyörällä.

Käyttäjien ilmoittamat korjauskohteet: [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
