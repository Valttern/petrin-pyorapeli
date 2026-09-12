#!/usr/bin/env node
// Siemenpankki roguelike-runin ("Yö korvessa") pätkille: rakentaa jokaisen pätkäpaikan (malli × syvyys × riski) reseptin, mittaa
// siemenet pelin omalla fysiikalla ja kirjaa hyväksytyt siemenet tools/runbank.json-tiedostoon, josta run arpoo pätkänsä.
// Sama generaattori ja kuskit kuin pelissä (gamecore.js). Toimii Nodella (>= 22) ja Denolla.
//
//   node tools/runbank.js slots                       listaa pätkäpaikat ja niiden reseptit
//   node tools/runbank.js scan  [paikka] [--seeds 1-60] [--bike intense]   mittaa siemenet ja tulostaa jakauman (ei kirjoita mitään)
//   node tools/runbank.js bank  [--seeds 1-60] [--out tools/runbank.json]  mittaa, suodattaa porteilla ja kirjoittaa pankin
//   node tools/runbank.js profile <paikka> <siemen>   ASCII-korkeusprofiili yhdestä pätkästä
//
// Paikan tunnus on malli-syvyys-riski, esim. harjanne-d1-r5 (riski 0, 5 tai 10 = 0, .5, 1).
import { extractCore } from './gamecore.js';

const isDeno = typeof Deno !== 'undefined';
const fs = isDeno ? null : await import('node:fs');
const argv = isDeno ? Deno.args.slice() : process.argv.slice(2);
const here = decodeURIComponent(new URL('.', import.meta.url).pathname);
const readText = (p) => isDeno ? Deno.readTextFileSync(p) : fs.readFileSync(p, 'utf8');
const writeText = (p, s) => isDeno ? Deno.writeTextFileSync(p, s) : fs.writeFileSync(p, s);
const exit = (c) => isDeno ? Deno.exit(c) : process.exit(c);

const cmd = argv.shift();
const opt = (name, dflt) => { const i = argv.indexOf('--' + name); if (i < 0) return dflt; const v = argv[i + 1]; argv.splice(i, 2); return v === undefined ? true : v; };

const core = extractCore(readText(here + '../index.html'));
const { buildLevel, measureLevel, rideLevel, RIDERS, speedAt, Bike, BIKES, Bear, BEAR, FEATURES } = core;

// ---- Runin rakenne (ROGUELIKE-SUUNNITELMA.md, kohta 2): mitkä mallit esiintyvät millä syvyydellä. Mökki ei ole ajopätkä. ----
const DUSK = [.25, .40, .55, .70, .85, .94, 0];                                                     // syvyys 0..6; 6 = aamu (dh)
const RUN_SLOTS = [['harjanne', 0], ['harjanne', 1], ['kieleke', 1], ['korpi', 2], ['suonlaita', 2], ['harjanne', 3], ['kieleke', 3], ['korpi', 5], ['lasku', 6]];
const RISKS = [0, .5, 1];
const CHASE_POOL = ['slope', 'hump', 'kicker', 'tabletop', 'ridge', 'stepsdown', 'drop', 'stepdown', 'dropseries', 'doubles', 'roadgap', 'doublegap', 'bigair', 'gap'];   // karhupaon mitattu pooli

// Pätkämallit: tiivis resepti + mallikohtaiset lisäykset. length on pikseleitä (pelin "km" = 1000 px). Kalibrointi tekniikkakuskilla:
// Kotimetsä 4,2 km 14 s, Kalliopolku 7,2 km 34 s, Louhikko 8 km 74 s (1 kaat.); karhupaon flow-kuski 60 km noin 77 s. Pelaaja on hitaampi
// (noodit, kaatumiset), joten tavoite on kuskin aika 20-50 s tavallisella pätkällä ja 25-45 s karhupätkällä.
const TEMPLATES = {
  harjanne:  { name: 'Harjanne',      style: 'harju',  relief: .75, length: 6000, biome: 'kangas', lowNodes: 2, okNodes: 1, newNodes: 2 },
  kieleke:   { name: 'Kalliokieleke', style: 'kallio', relief: .55, length: 6000, biome: 'kallio', lowNodes: 1, okNodes: 0, newNodes: 1, minGap: 90 },
  suonlaita: { name: 'Suonlaita',     style: 'kumpu',  relief: .40, length: 6500, biome: 'korpi',  lowNodes: 1, okNodes: 1, newNodes: 1, bog: true },
  lasku:     { name: 'Lasku laaksoon', style: 'lasku', relief: 1.15, length: 8000, biome: 'lehto', lowNodes: 0, okNodes: 1, newNodes: 1, dh: true },
  korpi:     { name: 'Korpi',         chase: true,     length: 18000, biome: 'korpi' },
};

const slotId = (t, d, r) => `${t}-d${d}-r${Math.round(r * 10)}`;
// Paikasta reseptiin (suunnitelman kaava): challenge, relief, variation ja rhythm syvyydestä ja riskistä; siemen annetaan erikseen.
function slotDef(t, d, r, seed) {
  const T = TEMPLATES[t]; if (!T) throw new Error('tuntematon malli ' + t);
  const id = slotId(t, d, r), base = { id, name: T.name, tier: 9, gen: 2, seed, length: T.length, draft: true, cpEvery: 0, dusk: DUSK[d] || undefined, run: { slot: id, depth: d, risk: r } };
  if (T.chase) {
    const len = T.length + (d >= 5 ? 6000 : 0), km = len / 1000, k = d / 6;                                                            // karhupätkä: karhupaon resepti pienoiskoossa, koko kasvaa syvyyden ja riskin mukaan
    return { ...base, length: len, chase: true, dusk: DUSK[d],
      terrain: { algo: 'noise', amp: 80, wl: 2200, octaves: 2, gain: .22, lacunarity: 4, rough: 0, maxSlope: 16, macro: .5, descent: Math.round(len * .1) },
      difficulty: { hard: +(.5 + .2 * k + .1 * r).toFixed(2), variety: .6, curve: [+(.2 + .35 * k + .2 * r).toFixed(2), +(.5 + .5 * k + .3 * r).toFixed(2)] },   // karhupako: hard .7, curve .2 -> 1.3 / 60 km; flow-kuski selviää karhupaossa ~12 km eli kokoluokkaan ~.4
      features: { strategy: 'curve', spacing: 'even', count: Math.max(3, Math.round(km * 1.4)), pool: CHASE_POOL, fit: true },   // estemäärä vakio: riski kasvattaa kokoa (curve), ei määrää; isommat esteet eivät mahtuisi ja sovitus pudottaisi niitä
      assets: { obstacles: 0, stones: 0, forest: 1.3, biome: T.biome, glades: .2 }, minGap: 220, rec: 1, lowNodes: 0, okNodes: 0, newNodes: 0 };
  }
  const def = { ...base, style: T.style, relief: +(T.relief + .25 * r + .06 * d).toFixed(2), challenge: +(.28 + .055 * d + .18 * r).toFixed(2),
    variation: +(.35 + .5 * r).toFixed(2), rhythm: r > .6 ? 'clustered' : d >= 4 ? 'rising' : 'even', biome: T.biome, lowNodes: T.lowNodes, okNodes: T.okNodes, newNodes: T.newNodes, rec: 1 };
  if (T.minGap) def.minGap = Math.round(T.minGap - 30 * r);
  if (T.dh) { def.dh = true; def.dusk = undefined; def.rec = 2; }
  if (T.bog) def.assets = { biome: T.biome, obstacles: 1, stones: 1, forest: 1, glades: .3, bog: 1 };
  return def;
}
const allSlots = () => RUN_SLOTS.flatMap(([t, d]) => RISKS.map((r) => ({ t, d, r, id: slotId(t, d, r) })));

// ---- Mittaus ----
// Karhupätkä ajetaan pelin tekniikkakuskilla täydessä vauhdissa (flow-kuski ilman keulan nostoa kaatuu jo kokoluokan .5 esteisiin, joihin
// pelaaja selviää). Mitattu: karhupaossa tekniikkakuski 6,8 jää kiinni 14,8 km:ssä ja 7,5 12,8 km:ssä kaatumatta.
function chaseRide(lv, bikeDef, v) {
  const b = new Bike(lv, bikeDef), ctrl = RIDERS.tech(v); b.spawn(178, 1); const K = new Bear(lv, 178 - BEAR.gap0); let inp = {}, minGap = 1e9, s = 0;
  for (; s < 120 * 240; s++) { if (s % 6 === 0) inp = ctrl(b, lv); if (b.step(inp) === 'crash') return { result: 'crash', x: Math.round(b.midX), t: s / 120, minGap: Math.round(minGap) };
    const gap = K.step(b); if (gap < minGap) minGap = gap; if (K.caught) return { result: 'caught', x: Math.round(b.midX), t: s / 120, minGap: Math.round(minGap) };
    if (b.midX > lv.wallR - 120) return { result: 'pass', x: Math.round(b.midX), t: s / 120, minGap: Math.round(minGap) }; }
  return { result: 'stuck', x: Math.round(b.midX), t: s / 120, minGap: Math.round(minGap) };
}
function measureSlot(def, bikeDef) {
  const lv = buildLevel(def);
  if (def.chase) { const fast = chaseRide(lv, bikeDef, 6.8), faster = chaseRide(lv, bikeDef, 7.5);
    return { seed: def.seed, chase: true, feats: lv.plan?.length ?? 0, fast, faster }; }
  const rep = measureLevel(lv, { bike: bikeDef });
  return { seed: def.seed, feats: rep.features, gated: rep.gated, gatedPerKm: rep.gatedPerKm, score: rep.score, climb: rep.climb, maxUp: rep.maxUpDeg, finished: !!rep.ride?.finished, crashes: rep.ride?.crashes ?? 99, time: Math.round(rep.ride?.time ?? 0), stuck: rep.ride?.stuckAt };
}
// Hyväksymisportit riskin mukaan. Tavallinen pätkä: tekniikkakuski maaliin, kaatumiset ja portit haarukassa, kesto 60-110 s (kuskin aika + kaatumiset).
// Karhupätkä: tekniikkakuski ei kaadu eikä juutu 6,8 eikä 7,5 px/askel vauhdissa (jokainen este on ajettavissa täydessä vauhdissa) ja pysyy
// karhun edellä vähintään 6 km (sama raja kuin tests/game_test.js karhupaolle). Karhun kumilanka ottaa kuskin lopulta kiinni: se on karhupaon
// oma kalibrointi (pelaaja ajaa pidemmälle), ei pätkän vika.
const GATES = {
  normal: { 0: { crashes: [0, 1], gatedPerKm: [0, 2.5] }, .5: { crashes: [0, 2], gatedPerKm: [.5, 3.5] }, 1: { crashes: [0, 3], gatedPerKm: [.5, 5] } },
  time: [15, 50],
  lasku: { gatedPerKm: [0, 5] },                                                                     // lasku on vauhtia, ei portteja: descent-tyyli rajaa poolin, joten portteja on vähän riskistä riippumatta
};
const inR = (v, r) => v >= r[0] && v <= r[1];
function accept(m, r, t) {
  if (t === 'lasku') { const g = GATES.normal[r]; return m.finished && inR(m.crashes, g.crashes) && inR(m.gatedPerKm, GATES.lasku.gatedPerKm) && inR(m.time, GATES.time); }
  if (m.chase) return m.fast.result !== 'crash' && m.faster.result !== 'crash' && m.fast.result !== 'stuck' && m.faster.result !== 'stuck' && m.fast.x >= 6000 + 178 && m.faster.x >= 6000 + 178;
  const g = GATES.normal[r]; return m.finished && inR(m.crashes, g.crashes) && inR(m.gatedPerKm, g.gatedPerKm) && inR(m.time, GATES.time);
}

const pad = (s, n) => String(s).padEnd(n);
const seedRange = () => { const [a, b] = String(opt('seeds', '1-60')).split('-').map(Number); return [a, b ?? a]; };
const bikeOf = (id) => BIKES.find((b) => b.id === id) ?? (() => { throw new Error('tuntematon pyörä ' + id); })();

function scanSlot(slot, seeds, bikeDef, quiet) {
  const rows = [];
  for (let seed = seeds[0]; seed <= seeds[1]; seed++) {
    const def = slotDef(slot.t, slot.d, slot.r, seed);
    try { const m = measureSlot(def, bikeDef); m.ok = accept(m, slot.r, slot.t); rows.push(m); } catch (e) { rows.push({ seed, err: e.message }); }
  }
  if (!quiet) {
    console.log(`\n${slot.id}: siemenet ${seeds[0]}-${seeds[1]}, pyörä ${bikeDef.id}`);
    if (TEMPLATES[slot.t].chase) { console.log(pad('siemen', 8) + pad('esteet', 8) + pad('tech 6.8', 24) + pad('tech 7.5', 24) + 'ok');
      for (const m of rows) console.log(m.err ? pad(m.seed, 8) + 'virhe: ' + m.err : pad(m.seed, 8) + pad(m.feats, 8) + pad(`${m.fast.result}@${m.fast.x} ${m.fast.t.toFixed(0)}s gap${m.fast.minGap}`, 24) + pad(`${m.faster.result}@${m.faster.x} ${m.faster.t.toFixed(0)}s gap${m.faster.minGap}`, 24) + (m.ok ? 'ok' : '-')); }
    else { console.log(pad('siemen', 8) + pad('esteet', 8) + pad('portit/km', 11) + pad('haast.', 8) + pad('nousu', 7) + pad('jyrkin', 8) + pad('kuski', 26) + 'ok');
      for (const m of rows) console.log(m.err ? pad(m.seed, 8) + 'virhe: ' + m.err : pad(m.seed, 8) + pad(m.feats, 8) + pad(m.gatedPerKm, 11) + pad(m.score, 8) + pad(m.climb, 7) + pad(m.maxUp + '°', 8) + pad((m.finished ? 'maaliin' : 'juuttui ' + m.stuck) + `, ${m.crashes} kaat., ${m.time} s`, 26) + (m.ok ? 'ok' : '-')); }
    console.log(`hyväksyttyjä ${rows.filter((m) => m.ok).length}/${rows.length}`);
  }
  return rows;
}

function printProfile(lv) {
  const cols = 150, step = lv.L / cols, ys = lv.ys, rows = 14;
  const col = Array.from({ length: cols }, (_, c) => ys[Math.min(lv.n - 1, Math.round(c * step / 8))]);
  const mn = Math.min(...col), mx = Math.max(...col), range = Math.max(1, mx - mn);
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(' '));
  for (let c = 0; c < cols; c++) { const r = Math.round((col[c] - mn) / range * (rows - 1)); for (let k = r; k < rows; k++) grid[k][c] = k === r ? '▀' : '█'; }
  const marks = new Array(cols).fill(' ');
  for (const f of lv.feats) { if (f.type === 'zone' || f.type === 'stone' || f.sub) continue; const c = Math.min(cols - 1, Math.floor((f.cx ?? f.x) / step)); if (marks[c] === ' ') marks[c] = f.type[0].toUpperCase(); }
  for (const nd of lv.nodes) marks[Math.min(cols - 1, Math.floor(nd.x / step))] = nd.state === 'low' ? '!' : 'n';
  console.log(`\n${lv.def.id} siemen ${lv.def.seed}: ${(lv.L / 1000).toFixed(1)} km, korkeusero ${Math.round(lv.maxY - lv.minY)} px, esteet: ${(lv.plan || []).map((p) => p.type).join(' ')}`);
  console.log(marks.join('')); for (const row of grid) console.log(row.join(''));
}

try {
  if (cmd === 'slots') {
    for (const s of allSlots()) { const d = slotDef(s.t, s.d, s.r, 1); delete d.run; delete d.draft; console.log(pad(s.id, 18) + JSON.stringify(d)); }
  } else if (cmd === 'scan') {
    const which = argv[0] && !argv[0].startsWith('--') ? argv.shift() : null, seeds = seedRange(), bike = bikeOf(opt('bike', 'intense'));
    const slots = which ? allSlots().filter((s) => s.id === which || s.id.startsWith(which)) : allSlots();
    if (!slots.length) throw new Error('paikkaa ' + which + ' ei ole: ' + allSlots().map((s) => s.id).join(', '));
    for (const s of slots) scanSlot(s, seeds, bike);
  } else if (cmd === 'bank') {
    const seeds = seedRange(), out = opt('out', here + 'runbank.json'), bike = bikeOf(opt('bike', 'intense')), t0 = Date.now();
    const bank = { generated: new Date().toISOString().slice(0, 10), seeds: `${seeds[0]}-${seeds[1]}`, bike: bike.id, gates: GATES, slots: {} };
    for (const s of allSlots()) {
      const rows = scanSlot(s, seeds, bike, true).filter((m) => m.ok);
      const def = slotDef(s.t, s.d, s.r, 0); delete def.seed; delete def.run; delete def.draft;
      bank.slots[s.id] = { template: s.t, depth: s.d, risk: s.r, def, seeds: rows.map((m) => m.chase ? { seed: m.seed, feats: m.feats, fastKm: +((m.fast.x - 178) / 1000).toFixed(1), fastResult: m.fast.result } : { seed: m.seed, score: m.score, gated: m.gated, crashes: m.crashes, time: m.time }) };
      console.log(pad(s.id, 18) + `hyväksyttyjä ${rows.length}/${seeds[1] - seeds[0] + 1}` + (rows.length < 6 ? '   <- VÄHÄN' : ''));
    }
    writeText(out, JSON.stringify(bank, null, 1) + '\n');
    console.log(`\nkirjoitettu ${out} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  } else if (cmd === 'profile') {
    const [id, seed] = argv; const s = allSlots().find((x) => x.id === id); if (!s) throw new Error('paikkaa ' + id + ' ei ole');
    printProfile(buildLevel(slotDef(s.t, s.d, s.r, +seed || 1)));
  } else console.log('Käyttö: runbank.js slots|scan|bank|profile ... (ks. tiedoston alku)');
} catch (e) { console.error('Virhe:', e.message); exit(1); }
