// Purkaa pelin ytimen (kentät, generaattorit, fysiikka, mittaus) index.html:stä ilman selainta. Käytössä testeissä ja levelgen.js:ssä.
export function extractCore(html) {
  const source = html.split('<script>\n')[1].split('</script>')[0];
  const code = source.slice(source.indexOf('const clamp='), source.indexOf('// ---------- kuvitetut assetit'));
  const terrain = source.slice(source.indexOf('const DX=8'), source.indexOf('// ---------- fysiikka'));
  const meta = JSON.parse(html.split('window.ASSET_DATA=')[1].split(';/*ASSETS-END*/')[0]);
  const physics = source.slice(source.indexOf('const STEP='), source.indexOf('// ---------- renderöinti'));
  return new Function('ASSET_META', code + terrain + physics +
    ';return {LEVELS,TIERS,buildLevel,Bike,BIKES,recomputeCoverage,FEATURES,measureLevel,rideLevel,rideSegment,RIDERS,reportMeetsTarget,speedAt,mulberry32,tY,expandRecipe,RECIPE_STYLES,BIOMES};')(meta);
}
export async function loadCore(path) {
  const html = await Deno.readTextFile(path ?? new URL('../index.html', import.meta.url));
  return { core: extractCore(html), html };
}
