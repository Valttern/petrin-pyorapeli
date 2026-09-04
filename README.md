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

Viisitoista proseduraalista reittiä viidessä vaikeustasossa (Helppo, Keskitaso, Vaikea, Iltahämärä, Yö) ja kaksi pyörää: vanha Kuwahara-jäykkäperä ja täysjousitettu Intense. Pää ei saa osua maahan. Parhaat ajat tallentuvat selaimeen.

Iltahämärän ja yön reitit ajetaan otsalampun valossa: aurinko laskee, tähdet ja kuu nousevat, tulikärpäset, lepakot ja pöllöt heräävät, ja näkyvyys rajoittuu lampun keilaan. Esteet ovat Trials-henkisiä taitokynnyksiä: kalliohyllyt ja kannot (nosta keula: kallistus taakse ja kaasu), notkot (pudotus ja heti perään lähes pystysuora seinä, josta noustaan vain vauhdilla), hypyt kalliohyllyille (seinän juuri on neljännesputki: vauhdilla ja paino edessä sen ajaa ylös, ilman painonsiirtoa pyörä kääntyy selälleen), syöksyhypyt (pitkä alamäki, iso kalliohyppyri ja rotko: polkien lento kantaa laskeutumisrinteeseen, rullaten jäät rotkoon), kaksoisrotkot, pudotusportaat, louhikkorinteet, juurakot ja kaatuneet rungot. Yön reiteillä tarkistuspisteitä on harvassa; Keskiyöllä vain noodit toimivat tarkistuspisteinä.

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

Pelin sisällä: Verlet-fysiikka 120 Hz, maastoon kaiverretut esteet spritejen omista profiileista, neljän harjanteen parallax-tausta, kaistavälimuistitettu piirto, WebAudio-syntetisoitu metsä (linnut, tuuli, hyönteiset; hämärässä sirkat, pöllöt ja kuikka) ja pyörän äänet, LoRa-kuuluvuusmalli (log-distance + maaston katve). Hämärän valaistus: maailma piirretään päivävärein ja tummennetaan pimeyskerroksella, johon otsalamppu, noodien LEDit, lyhdyt, nuotio, mökin ikkunat ja auton ajovalot syövät reikiä; taivas (auringonlasku, tähdet, kuu) piirretään lopuksi kaiken taakse.

Kehitystestaus ilman index.html:n muuttamista: `python3 tools/build.py --out dev.html` kirjoittaa upotetun version erilliseen tiedostoon (gitignoressa).

## Tekijät

Kuvitus, musiikki ja Petrin ääni on luotu OpenRouterin malleilla (Google Gemini 3.1 Flash Image, Google Lyria 3, OpenAI GPT Audio). Kaikki muu on käsin tehtyä.
