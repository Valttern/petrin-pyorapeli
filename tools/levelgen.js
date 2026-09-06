#!/usr/bin/env -S deno run --allow-read
// Kenttägeneraattorin komentorivityökalu: raportti, profiili ja siemenhaku ilman selainta. Sama fysiikka ja generaattori kuin pelissä.
//
//   deno run --allow-read tools/levelgen.js report  <id|resepti.json> [--no-ride] [--bike intense|kuwahara|dh] [--json]
//   deno run --allow-read tools/levelgen.js profile <id|resepti.json> [--width 160]
//   deno run --allow-read tools/levelgen.js sweep   <id|resepti.json> [--seeds 1-40] [--top 5] [--quick]
//   deno run --allow-read tools/levelgen.js row     <resepti.json>            tulostaa LEVELS-rivin liitettäväksi index.html:ään
//   deno run --allow-read tools/levelgen.js expand  <id|resepti.json>         näyttää, miksi tiivis resepti (style, relief, challenge...) laajenee
//   deno run --allow-read tools/levelgen.js list
//
// Resepti on JSON-tiedosto samassa muodossa kuin LEVELS-rivi (gen:2). Ks. README "Kenttägeneraattori v2".
import { loadCore } from './gamecore.js';
import { formatReport, formatLevelRow } from './report.js';

const args = Deno.args.slice();
const cmd = args.shift();
const opt = (name, dflt) => { const i = args.indexOf('--' + name); if (i < 0) return dflt; const v = args[i + 1]; args.splice(i, 2); return v === undefined ? true : v; };
const flag = (name) => { const i = args.indexOf('--' + name); if (i < 0) return false; args.splice(i, 1); return true; };

const { core } = await loadCore();
const { LEVELS, BIKES, buildLevel, measureLevel, reportMeetsTarget, expandRecipe } = core;

async function loadDef(what) {
  if (!what) throw new Error('anna kentän id tai reseptitiedosto');
  if (what.endsWith('.json')) { const def = JSON.parse(await Deno.readTextFile(what)); if (def.gen !== 2) def.gen = 2; return def; }
  const def = LEVELS.find((l) => l.id === what); if (!def) throw new Error(`kenttää "${what}" ei ole. Tunnetut: ${LEVELS.map((l) => l.id).join(', ')}`);
  return def;
}
const bikeOf = (id) => id ? BIKES.find((b) => b.id === id) ?? (() => { throw new Error('tuntematon pyörä ' + id); })() : undefined;
const pad = (s, n) => String(s).padEnd(n);

const printReport = (rep, def) => console.log('\n' + formatReport(rep, def, reportMeetsTarget(rep, def.difficulty?.target)));

function printProfile(lv, width) {
  const rows = 18, cols = Math.max(40, width | 0), step = lv.L / cols, ys = lv.ys;
  const col = new Array(cols).fill(0).map((_, c) => { const i = Math.min(lv.n - 1, Math.round(c * step / 8)); return ys[i]; });
  const mn = Math.min(...col), mx = Math.max(...col), range = Math.max(1, mx - mn);
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(' '));
  for (let c = 0; c < cols; c++) { const r = Math.round((col[c] - mn) / range * (rows - 1)); for (let k = r; k < rows; k++) grid[k][c] = k === r ? '▀' : '█'; }
  const marks = new Array(cols).fill(' ');
  const letter = { bigair: 'S', gap: 'R', kickerwall: 'H', ledge: 'L', combo: 'N', wall: 'J', drop: 'P', rockslope: 'K', dropseries: 'D', chute: 'U', roadgap: 'T', stepdown: 'Y', rollers: 'A', plateau: 'E', hump: 'M', valley: 'V', tabletop: 'Ö', doubles: 'W', sinkhole: 'O', ridge: 'Ä', gapledge: 'Q', logledge: 'I', rootclimb: 'F', boulderfield: 'B', whoops: 'w', stairs: 'p', stepsdown: 'q', rockgarden: 'g', bumps: 't', bog: 'o', logpile: 'k', kicker: 'y', boulder: 'b', stump: 'c', trunk: 'r', roots: 'j', rock: '.', log: '-', bumps: 't' };
  for (const f of lv.feats) { if (f.type === 'zone' || f.type === 'stone' || f.sub) continue; const c = Math.min(cols - 1, Math.floor((f.cx ?? f.x) / step)); if (marks[c] === ' ' || letter[f.type] > 'Z') marks[c] = letter[f.type] ?? '?'; }
  for (const nd of lv.nodes) { const c = Math.min(cols - 1, Math.floor(nd.x / step)); marks[c] = nd.kind === 'gateway' ? 'G' : nd.state === 'low' ? '!' : 'n'; }
  const cpRow = new Array(cols).fill(' '); for (const cp of lv.cps) cpRow[Math.min(cols - 1, Math.floor(cp / step))] = '⚑';
  console.log(`\n${lv.def.name ?? lv.def.id}: ${(lv.L / 1000).toFixed(1)} km, korkeusero ${Math.round(lv.maxY - lv.minY)} px, 1 merkki = ${Math.round(step)} px`);
  console.log(marks.join('')); console.log(cpRow.join(''));
  for (const row of grid) console.log(row.join(''));
  console.log('Isot esteet: S syöksy R rotko H hyllyhyppy L hylly N notko J jyrkänne P pudotus K louhikkorinne D pudotusportaat U kouru T tiegappi Y porrashyppy A aallot E tasanne M kumpare V notkelma');
  console.log('Pienet: p portaat q laskuportaat g kivipuutarha t töyssyt o suo k tukkikasa y hyppyri b lohkare c kanto r runko j juurakko . kivi - tukki  |  G gateway ! tyhjä noodi n noodi ⚑ tarkistuspiste');
}

try {
  if (cmd === 'list') {
    for (const l of LEVELS) console.log(pad(l.id, 18) + pad(l.gen === 2 ? 'gen2' : l.tech ? 'tech' : 'v1', 6) + pad(l.length, 7) + (l.name ?? ''));
  } else if (cmd === 'report') {
    const def = await loadDef(args.shift()); const ride = !flag('no-ride'), bike = bikeOf(opt('bike')), json = flag('json');
    const lv = buildLevel(def), rep = measureLevel(lv, { ride, bike });
    if (json) console.log(JSON.stringify(rep, null, 1)); else printReport(rep, def);
  } else if (cmd === 'expand') {
    console.log(JSON.stringify(expandRecipe(await loadDef(args.shift())), null, 1));
  } else if (cmd === 'row') {
    console.log(formatLevelRow(await loadDef(args.shift())));
  } else if (cmd === 'profile') {
    const def = await loadDef(args.shift()); printProfile(buildLevel(def), +opt('width', 160));
  } else if (cmd === 'sweep') {
    const def = await loadDef(args.shift()); const [a, b] = String(opt('seeds', '1-40')).split('-').map(Number); const top = +opt('top', 5), quick = flag('quick');
    const target = def.difficulty?.target, rows = [];
    for (let seed = a; seed <= (b ?? a); seed++) {
      const d = { ...def, seed };
      try { const lv = buildLevel(d), rep = measureLevel(lv, { ride: !quick }); rows.push({ seed, rep, ok: reportMeetsTarget(rep, target) }); }
      catch (e) { rows.push({ seed, err: e.message }); }
    }
    console.log(`\n${def.id}: siemenet ${a}-${b ?? a}` + (target ? `, tavoite ${JSON.stringify(target)}` : ''));
    console.log(pad('siemen', 8) + pad('haast.', 8) + pad('portit', 8) + pad('nousu', 8) + pad('jyrkin', 8) + pad('kuski', 22) + 'tavoite');
    for (const r of rows.sort((p, q) => (q.ok ? 1 : 0) - (p.ok ? 1 : 0) || (p.rep?.score ?? 9) - (q.rep?.score ?? 9)))
      console.log(r.err ? pad(r.seed, 8) + 'virhe: ' + r.err : pad(r.seed, 8) + pad(r.rep.score, 8) + pad(r.rep.gated, 8) + pad(r.rep.climb, 8) + pad(r.rep.maxUpDeg + '°', 8) + pad(r.rep.ride ? (r.rep.ride.finished ? 'maaliin, ' + r.rep.ride.crashes + ' kaat.' : 'juuttui ' + r.rep.ride.stuckAt) : '-', 22) + (r.ok ? 'ok' : '-'));
    const mid = target?.score ? (target.score[0] + target.score[1]) / 2 : null;
    const best = rows.filter((r) => r.ok).sort((p, q) => mid == null ? 0 : Math.abs(p.rep.score - mid) - Math.abs(q.rep.score - mid)).slice(0, top);
    if (best.length) console.log(`\nParhaat siemenet tavoitteeseen: ${best.map((r) => r.seed).join(', ')}`);
  } else {
    console.log('Käyttö: levelgen.js report|profile|sweep|row|expand|list ...  (ks. tiedoston alku)');
  }
} catch (e) { console.error('Virhe:', e.message); Deno.exit(1); }
