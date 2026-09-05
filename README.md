# Petrin pyöräpeli

Elasto Mania -henkinen maastopyöräpeli, jossa Petri kartoittaa oman LoRa-verkkonsa (868 MHz) kuuluvuutta suomalaisessa metsässä: vaihtaa tyhjentyneiden noodien akut, asentaa uusia noodeja mäenharjoille ja polkee metsän läpi mökille.

Koko peli on yksi tiedosto: **`index.html`**. Se toimii sellaisenaan selaimessa ilman palvelinta, kirjastoja tai verkkoyhteyttä (kuvat, musiikki ja äänet on upotettu tiedostoon).

## Pelaaminen

| Näppäin | Toiminto |
|---|---|
| ↑ | Polje |
| ↓ | Jarruta / pakita |
| ← → | Kallista pyörää |
| Väli | Käänny ympäri |
| E (pohjassa) | Vaihda akku / asenna noodi |
| R | Palaa tarkistuspisteelle |
| Esc | Tauko |
| M | Äänet päälle / pois |

22 reittiä seitsemässä ryhmässä (Helppo, Keskitaso, Vaikea, Iltahämärä, Yö, Alamäki, Tekniikka) ja kolme pyörää: vanha Kuwahara-jäykkäperä, täysjousitettu Intense ja alamäkipyörä Commençal. Pää ei saa osua maahan. Parhaat ajat tallentuvat selaimeen.

Temput lyhentävät kokonaisaikaa. Takavoltti antaa 1,5 s ja etuvoltti 2,0 s, jokainen lisäkierros samassa hypyssä 1,0 s lisää. Manuaali (takapyörällä) ja nose-manuaali (etupyörällä) vaativat etenemistä ja vähintään sekunnin, ja antavat 0,25 s jokaista sekuntia kohti, enintään 0,8 s per manuaali. Bonus kirjataan vasta, kun pyörä on pysynyt maassa hetken laskeutumisen jälkeen; kaatuminen mitätöi odottavan tempun. Ajastin näyttää temppubonuksen vähennettynä, ja ennätys tallennetaan tästä nettoajasta. Kertoimet ovat `TRICKS`-oliossa.

Iltahämärän ja yön reitit ajetaan otsalampun valossa: aurinko laskee, tähdet ja kuu nousevat, tulikärpäset, lepakot ja pöllöt heräävät, ja näkyvyys rajoittuu lampun keilaan. Esteet ovat Trials-henkisiä taitokynnyksiä: kalliohyllyt ja kannot (nosta keula: kallistus taakse ja kaasu), notkot (pudotus ja heti perään lähes pystysuora seinä, josta noustaan vain vauhdilla), hypyt kalliohyllyille (seinän juuri on neljännesputki: vauhdilla ja paino edessä sen ajaa ylös, ilman painonsiirtoa pyörä kääntyy selälleen), syöksyhypyt (pitkä alamäki, iso kalliohyppyri ja rotko: polkien lento kantaa laskeutumisrinteeseen, rullaten jäät rotkoon), kaksoisrotkot, pudotusportaat, louhikkorinteet, juurakot ja kaatuneet rungot. Yön reiteillä tarkistuspisteitä on harvassa; Keskiyöllä vain noodit toimivat tarkistuspisteinä.

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
python3 -m http.server 8765            # paikallinen testaus: http://localhost:8765/index.html
```

Raakakuvat ja -äänet (`assets/raw/`, `assets/audio/raw/`) eivät ole versionhallinnassa; jälkikäsitellyt assetit ovat.

Pelin sisällä: Verlet-fysiikka 120 Hz, maastoon kaiverretut esteet spritejen omista profiileista, neljän harjanteen parallax-tausta, kaistavälimuistitettu piirto, WebAudio-syntetisoitu metsä (linnut, tuuli, hyönteiset; hämärässä sirkat, pöllöt ja kuikka) ja pyörän äänet, LoRa-kuuluvuusmalli (log-distance + maaston katve). Hämärän valaistus: maailma piirretään päivävärein ja tummennetaan pimeyskerroksella, johon otsalamppu, noodien LEDit, lyhdyt, nuotio, mökin ikkunat ja auton ajovalot syövät reikiä; taivas (auringonlasku, tähdet, kuu) piirretään lopuksi kaiken taakse. Alamäkireiteillä aamuaurinko, säteet, lämmin utu, syksyn sävyt maastossa ja korkeuseron takia alemmas siirretyt taustakerrokset.

Kehitystestaus ilman index.html:n muuttamista: `python3 tools/build.py --out dev.html` kirjoittaa upotetun version erilliseen tiedostoon (gitignoressa).

## Tekijät

Kuvitus, musiikki ja Petrin ääni on luotu OpenRouterin malleilla (Google Gemini 3.1 Flash Image, Google Lyria 3, OpenAI GPT Audio). Kaikki muu on käsin tehtyä.

## Uusien kenttien tekeminen

Kentät ovat `index.html`-tiedoston `LEVELS`-taulukossa. Jokaisella on pysyvä, yksilöllinen `id`: älä vaihda sitä julkaisemisen jälkeen. Kenttiä voi järjestää uudelleen ilman ennätysten sekoittumista. Vanhat järjestysnumeroihin perustuvat ennätykset tuodaan automaattisesti `petri-pyorapeli-best-v2`-tallennukseen; alkuperäinen tallennus säilyy varmuuskopiona. `LEGACY_LEVEL_IDS` kuvaa alkuperäistä järjestystä, eikä sitä muuteta.

Hylätty louhos löytyy Vaikea-ryhmästä, ja sille suositellaan Intenseä. Reitti etenee kahdesta kalliohyllyosuudesta hyllyhyppyyn, louhikkolaskuun ja lopun syöksyhyppyyn. Mukana ovat tavalliset kartoitus- ja huoltotehtävät sekä tarkistuspisteet.

`placements` määrittää estealueiden keskipisteet pikseleinä. Tuetut tyypit ovat `ledges`, `kickerwalls`, `rockslopes` ja `bigairs`. Esimerkiksi `ledges:2` ja `placements:{ledges:[1200,2200]}` sijoittavat kaksi hyllyosuutta valittuihin kohtiin. Esteiden mitat määräytyvät edelleen siemenluvusta ja vaikeudesta. Jätä tilaa vauhdinotolle ja laskeutumiselle: syöksyhyppy tarvitsee noin 1 500 pikselin alueen. Päällekkäinen tai kentän reunojen yli menevä käsin asetettu alue aiheuttaa virheen. Ilman sijoitusmääritystä käytetään entistä satunnaissijoittelua.

Tekniset tarkistukset (Deno):

```bash
deno test --allow-read --allow-run=git tests/game_test.js
```

Testit tarkistavat ennätysten siirron ja järjestyksestä riippumattomuuden, vanhojen kenttien säilymisen sekä louhoksen estejärjestyksen. Ajettavuus ja hyppyjen vaikeustaso on lisäksi kokeiltava selaimessa.

## Tekniikka

Kolme Trials-henkistä kalliorataa, joilla ei ole akunvaihtoa eikä kuuluvuustehtäviä: pelkkää ajotekniikkaa graniitilla. **Graniittiportaat** (5 osuutta) opettaa perustaidot yksi kerrallaan: 35° silokallion nousu ja lasku, pystysuora hylly, kaksoisporras, lohkare ja 60° porras sekä 42° lasku matalaan hyllyyn. **Kallionkieli** (6 osuutta) yhdistelee: 42° laki ja ahdas pohja, lohkareet ja porras, hylly ja pudotus kapealle tasanteelle, vauhtia vaativa rotko ja sen jälkeinen porras, kolmen hyllyn portaikko ja 46° loppulasku kivikkoon. **Kivinen kruunu** (6 osuutta) laittaa kaiken peräkkäin tiukoilla tasanteilla: 47° silokalliot, kasvavat hyllyt lyhenevillä tasanteilla, pitkä kielekehyppy, lohkarepuutarha, pudotusportaat ja kruunu. Jokaisen osuuden edessä on tarkistuspiste; osuuden ajaminen kaatumatta palkitaan ("Puhtaasti!"). Suosituspyörä on Intense.

Radat on suunniteltu niin, että pelkkä kaasun ja jarrun annostelu **ei** riitä: pystysuorat hyllyt (24–34 px, korkeampia kuin renkaan säde) pysäyttävät etupyörän ja vaativat keulan noston (← + ↑) ja heti perään painonsiirron eteen (→); 45–47° silokalliot vaativat vauhdin säilyttämisen ja painon eteen, jotta pyörä ei looppaa; 40–46° laskut ja pudotukset vaativat painon taakse ja jarrun annostelun; rotkot vaativat vauhtia, mutta heti laskeutumisen jälkeen tuleva hylly rajaa sen ylhäältä. HUD näyttää osuuden nimen, suositellun vauhdin ja ajovihjeen.

`TECHNICAL_ROUTES` kuvaa jokaisen osuuden rakennuspaloina vasemmalta oikealle (`flat`, `slope`, `slab` kulma-asteina, `ledge`, `drop`, `gap`, `pipe`, `kicker`, `rocks`, `boulder`, `trunk`, `stump`, `log`, `roots`). `buildTechnicalLevel` rakentaa profiilin paloista, kaivertaa sprite-esteet maastoon samalla `carveObst`-funktiolla kuin muut kentät (törmäys = kuva) ja sijoittaa osuudet 340 px:n levähdysväleillä; radan pituus lasketaan paloista, ja `LEVELS`-rivin `length` on pidettävä samana (testi tarkistaa). Hyllyt ja pudotukset piirretään graniittiseinäminä varjoineen; kalliolla kasvaa keloja, katajia ja mäntyjä (uudet spritet `kelo`, `juniper`), ja valmis-ruudussa on oma taide (`keyart5`). Musiikkina on oma raita (`music_tech`), silokalliolla renkaan ääni on soraa hiljaisempi ja kirkkaampi, ja Petrillä on uudet repliikit: lähtö ("Tekniikkarata. Rauhassa ja tarkasti."), puhdas osuus ("Puhtaasti!") ja looppivaroitus takapyörällä ("Paino eteen!"). Uudistettujen ratojen `recordVersion:3` erottaa ennätykset vanhasta geometriasta.

Testit (`tests/game_test.js`) ajavat jokaisen osuuden kahdella ohjelmallisella kuskilla suoraan pelin fysiikalla: tekniikkakuskin (keulan nosto hyllyille, painonsiirto rinteissä ja ilmassa, jarrutus laskuissa) on läpäistävä jokainen osuus osuuden suositusvauhdilla, ja pelkkää kaasua ja jarrua käyttävän kuskin on juututtava tai kaaduttava vähintään kolmella neljästä vauhdista vähintään 70 %:ssa radan osuuksista. Näin radat pysyvät sekä ajettavina että teknisinä; ihmisen kokema tuntuma arvioidaan pelitestissä. Kehitysapuna fysiikan rajoja voi mitata samalla tavalla (esim. pystysuora hylly ≥ 18 px pysäyttää etupyörän kaikilla vauhdeilla, 50° on nousun raja).

Kenttäkohtainen `nodePositions` voi korvata noodin generoidun x-sijainnin (avain on noodin nollasta alkava luontijärjestys, ilman gatewayta). Rinnelaskun viimeinen tyhjentynyt noodi on siirretty erilleen toimivasta noodista; sen akunvaihto testataan oikealla palvelulogiikalla ja alamäkipyörällä.

Käyttäjien ilmoittamat korjauskohteet: [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
