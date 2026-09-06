#!/usr/bin/env -S deno run --allow-read
// Kenttägeneraattorin komentorivityökalu: raportti, profiili ja siemenhaku ilman selainta. Sama fysiikka ja generaattori kuin pelissä.
//
//   deno run --allow-read tools/levelgen.js report  <id|resepti.json> [--no-ride] [--bike intense|kuwahara|dh] [--json]
//   deno run --allow-read tools/levelgen.js profile <id|resepti.json> [--width 160]
//   deno run --allow-read tools/levelgen.js sweep   <id|resepti.json> [--seeds 1-40] [--top 5] [--quick]
//   deno run --allow-read tools/levelgen.js row     <resepti.json>            tulostaa LEVELS-rivin liitettäväksi index.html:ään
//   deno run --allow-read tools/levelgen.js expand  <id|resepti.json>         näyttää, miksi tiivis resepti (style, relief, challenge...) laajenee
//   deno run --allow-read tools/levelgen.js retune  <id|all> [--profile auto|kevyt|keski|tekninen|raskas|hamara|yo|alamaki] [--seeds 1-30] [--out dir] [--rows 1]
//        soveltaa haasteprofiilin kenttään: tekninen estejono ~2 estettä/km, välit 200-450 px, ja hakee siemenen, jolla
//        tekniikkakuski pääsee maaliin ja portteja on tavoitteen verran; tulostaa LEVELS-rivin (ja tallentaa JSON:n, jos --out)
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
const { LEVELS, BIKES, buildLevel, measureLevel, reportMeetsTarget, expandRecipe, FEATURES, mulberry32 } = core;
// Haasteprofiilit: estepooli (tekninen ajaminen, ei vauhti), tiheys esteitä/km, hard, koon ja venytyksen hajonta, väli (esimerkkikentässä
// esteiden väli on vain noin 50 px) ja mitattu tavoite. 'auto' valitsee profiilin vaikeustason (tier) mukaan ja teemapooli kentän nimen mukaan.
const TECH = ['dropseries', 'stairs', 'stepsdown', 'slab', 'slabdown', 'rootclimb', 'pipe', 'logpile', 'doubles', 'ledge', 'boulderfield', 'rockgarden', 'plateau', 'whoops', 'logledge', 'sinkhole', 'boulder', 'trunk'];
const PROFILES = {
  kevyt:    { pool: ['stairs', 'stepsdown', 'slab', 'slabdown', 'logpile', 'doubles', 'ledge', 'rockgarden', 'whoops', 'boulder', 'trunk', 'bumps', 'hump', 'kicker'], perKm: 1.7, hard: [.15, .35], size: [.8, 1.2], stretch: [.8, 1.3], minGap: 90, target: { gatedPerKm: [.8, 3], finished: true, maxCrashes: 1 } },
  keski:    { pool: TECH, perKm: 2.0, hard: [.3, .5], size: [.8, 1.4], stretch: [.8, 1.5], minGap: 70, target: { gatedPerKm: [1.4, 4], finished: true, maxCrashes: 2 } },
  tekninen: { pool: TECH, perKm: 2.2, hard: [.35, .55], size: [.8, 1.6], stretch: [.8, 1.6], minGap: 60, target: { gatedPerKm: [1.6, 4], finished: true, maxCrashes: 2 } },
  raskas:   { pool: [...TECH, 'gapledge', 'kickerwall', 'combo', 'doublegap'], perKm: 2.5, hard: [.5, .8], size: [1, 1.9], stretch: [.9, 1.8], minGap: 50, target: { gatedPerKm: [2, 5], finished: true, maxCrashes: 3 } },
  hamara:   { pool: ['ledge', 'stump', 'roots', 'trunk', 'combo', 'kickerwall', 'boulder', 'boulderfield', 'dropseries', 'rockslope', 'logledge', 'stairs', 'doubles'], perKm: 2.0, hard: [.4, .65], size: [.9, 1.5], stretch: [.8, 1.5], minGap: 80, target: { gatedPerKm: [1.4, 4], finished: true, maxCrashes: 2 } },
  yo:       { pool: ['ledge', 'roots', 'trunk', 'combo', 'kickerwall', 'boulderfield', 'dropseries', 'rockslope', 'gapledge', 'doublegap', 'stairs', 'plateau', 'sinkhole'], perKm: 2.3, hard: [.55, .85], size: [1, 1.7], stretch: [.9, 1.6], minGap: 60, target: { gatedPerKm: [1.8, 5], finished: true, maxCrashes: 3 } },
  alamaki:  { pool: ['stepdown', 'rollers', 'roadgap', 'chute', 'rockslope', 'doubles', 'tabletop', 'whoops', 'boulderfield', 'dropseries'], perKm: 1.6, hard: [.4, .8], size: [.9, 1.5], stretch: [.9, 1.6], minGap: 120, target: { gatedPerKm: [.6, 4], finished: true, maxCrashes: 2 } },
};
const TIER_PROFILE = { 0: 'kevyt', 1: 'keski', 2: 'raskas', 3: 'hamara', 4: 'yo', 5: 'alamaki', 7: 'raskas' };
// Teemapoolit kentän tunnuksen mukaan: näitä painotetaan kaksinkertaisesti, jotta Juurakko on juurakkoinen ja Louhikko louhikkoinen
const THEMES = { juurakko: ['roots', 'rootclimb', 'trunk', 'logledge'], louhikko: ['boulder', 'boulderfield', 'rockgarden', 'rockslope', 'rocks'], lohkareikko: ['boulder', 'boulderfield', 'rockgarden', 'plateau'],
  suonlaita: ['bog', 'logpile', 'trunk', 'whoops'], rotko: ['gap', 'doublegap', 'sinkhole', 'gapledge'], jyrkanteet: ['drop', 'dropseries', 'wall', 'plateau', 'stepsdown'], kalliopolku: ['stairs', 'ledge', 'stepsdown', 'pipe', 'slab'],
  kotimetsa: ['bumps', 'logpile', 'stump', 'hump'], harjumaasto: ['ridge', 'hump', 'slab', 'slabdown'], vaara: ['slab', 'slabdown', 'ridge', 'ledge', 'stairs'], louhos: ['ledge', 'kickerwall', 'rockslope', 'bigair', 'plateau'],
  kouru: ['chute', 'rockslope', 'boulderfield'], syoksy: ['stepdown', 'roadgap', 'tabletop', 'doubles'], rinne: ['rollers', 'stepdown', 'whoops'], kelo: ['ledge', 'slab', 'pipe', 'boulderfield'], portaat: ['stairs', 'stepsdown', 'ledge', 'plateau'], korpi: ['roots', 'rootclimb', 'trunk', 'rockgarden', 'whoops', 'logledge'] };
function profileFor(def, name) {
  const base = PROFILES[name === 'auto' ? (TIER_PROFILE[def.tier] ?? 'tekninen') : name]; if (!base) throw new Error('tuntematon profiili ' + name);
  const theme = Object.entries(THEMES).find(([k]) => def.id.includes(k));
  return theme ? { ...base, pool: [...theme[1], ...theme[1], ...base.pool], theme: theme[0] } : { ...base, theme: '-' };
}
// Rakentaa kentälle profiilin mukaisen rytmijonon (satunnaisjärjestys, ei samaa tyyppiä peräkkäin), säilyttää maaston, biomin ja tehtävät.
function retuneDef(def, prof, seed) {
  const rnd = mulberry32(seed * 7919 + 13 + def.id.length * 101), km = def.length / 1000, n = Math.max(4, Math.round(km * prof.perKm)), seq = []; let prev = null;   // siemen ja tunnus: eri kentille eri jonot
  const pick = (a, b) => a + rnd() * (b - a);
  for (let i = 0; i < n; i++) { let t; do { t = prof.pool[Math.floor(rnd() * prof.pool.length)]; } while (t === prev && prof.pool.length > 1); prev = t;
    const o = { type: t, hard: +pick(...prof.hard).toFixed(2) }; if (rnd() < .5) o.size = +pick(...prof.size).toFixed(2); if (rnd() < .4) o.stretch = +pick(...prof.stretch).toFixed(2); seq.push(o); }
  const ex = expandRecipe(structuredClone(def));
  const out = { id: def.id, name: def.name, tier: def.tier, gen: 2, recordVersion: (def.recordVersion || 1) + 1, desc: def.desc, seed, length: def.length };
  for (const k of ['dusk', 'moonlit', 'dh', 'fog']) if (k in def) out[k] = def[k];
  out.minGap = prof.minGap;
  out.terrain = ex.terrain; if (out.terrain.maxSlope == null) out.terrain.maxSlope = 36;
  out.difficulty = { hard: +((prof.hard[0] + prof.hard[1]) / 2).toFixed(2), variety: .5, target: prof.target };
  out.features = { strategy: 'rhythm', spacing: 'clustered', sequence: seq, fit: true };
  out.assets = ex.assets; for (const k of ['rec', 'lowNodes', 'okNodes', 'newNodes', 'nodePositions']) if (k in ex) out[k] = ex[k];
  delete out.assets?.undefined;
  return out;
}

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
  } else if (cmd === 'retune') {
    const what = args.shift(), profName = opt('profile', 'auto');
    const [a, b] = String(opt('seeds', '1-30')).split('-').map(Number), outDir = opt('out');
    const defs = what === 'all' ? LEVELS.filter((l) => !l.tech) : [await loadDef(what)];
    for (const def of defs) {
      const prof = profileFor(def, profName); let best = null; const tried = [];
      for (let seed = a; seed <= (b ?? a); seed++) { const cand = retuneDef(def, prof, seed);
        try { const lv = buildLevel(cand), rep = measureLevel(lv); const ok = reportMeetsTarget(rep, prof.target); tried.push({ seed, ok, rep });
          if (ok && (!best || rep.gatedPerKm > best.rep.gatedPerKm)) best = { cand, rep }; } catch (e) { tried.push({ seed, err: e.message }); } }
      const line = best ? `${def.id.padEnd(16)} [${(TIER_PROFILE[def.tier] ?? 'tekninen')}/${prof.theme}] OK  siemen ${best.cand.seed}  portit ${best.rep.gated} (${best.rep.gatedPerKm}/km)  haast. ${best.rep.score}  kaat. ${best.rep.ride.crashes}  nousu ${best.rep.climb}` : `${def.id.padEnd(16)} EI LÖYTYNYT (${tried.filter((t) => t.err).length} virhettä, ${tried.filter((t) => t.rep && t.rep.ride.finished).length} maaliin, mutta portteja liian vähän tai kaatumisia liikaa)`;
      console.log(line);
      if (best) { if (opt('rows')) console.log(formatLevelRow(best.cand)); if (outDir) { await Deno.mkdir(outDir, { recursive: true }); await Deno.writeTextFile(`${outDir}/${def.id}.json`, JSON.stringify(best.cand, null, 1)); } }
    }
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
    console.log('Käyttö: levelgen.js report|profile|sweep|retune|row|expand|list ...  (ks. tiedoston alku)');
  }
} catch (e) { console.error('Virhe:', e.message); Deno.exit(1); }
