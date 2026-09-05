# Havaitut ongelmat

## Rinnelasku: viimeisen noodin akunvaihto ei onnistu

- Ilmoitettu: 2026-09-05, käyttäjän pelitestissä.
- Reitti: 16 — Rinnelasku (`rinnelasku`).
- Oire: viimeisen tyhjentyneen noodin akkua ei pysty vaihtamaan.
- Tila: korjattu paikallisesti.
- Syy: toimiva PETRI-03 ja tyhjentynyt PETRI-04 sijoittuivat molemmat kohtaan x=5696. Lähimmän noodin valinta poimi toimivan noodin, joten akunvaihtoa ei tarjottu.
- Korjaus: PETRI-04 siirrettiin kenttäkohtaisella `nodePositions`-määrityksellä kohtaan x=7224, erilleen muista noodeista ja esteistä. Maaston geometria säilyy ennallaan.
- Varmistus: oikea akunvaihtologiikka valmistuu Commençalilla noodin kohdalta ja 25 pikseliä sen kummaltakin puolelta aloitettaessa; akku kuluu ja tarkistuspiste aktivoituu.
