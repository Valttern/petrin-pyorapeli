// Haastavuusraportin ja LEVELS-rivin muotoilu tekstiksi. Käytössä levelgen.js:ssä (komentorivi) ja editor.html:ssä (selain).
const pad = (s, n) => String(s).padEnd(n);
export function formatReport(rep, def, meets) {
  const out = [];
  out.push(`${def.name ?? def.id} (${def.id}) · ${(rep.length / 1000).toFixed(1)} km · pyörä ${rep.bike} · siemen ${def.seed}`);
  out.push(`  nousua ${rep.climb} px, laskua ${rep.descent} px, jyrkin nousu ${rep.maxUpDeg}° (x=${rep.maxUpAt}), jyrkin lasku ${rep.maxDownDeg}° (x=${rep.maxDownAt}), esteiden ulkopuolella`);
  out.push(`  esteitä ${rep.features}: ${Object.entries(rep.counts).map(([k, v]) => `${k}×${v}`).join(', ')}`);
  out.push(`  portitettuja (kaasu+jarru ei riitä) ${rep.gated} = ${rep.gatedPerKm}/km`);
  if (rep.ride) out.push(`  tekniikkakuski: ${rep.ride.finished ? 'maaliin' : 'JUUTTUI kohtaan ' + rep.ride.stuckAt + ' (' + rep.ride.near + ')'}, kaatumisia ${rep.ride.crashes}, aika ${rep.ride.time.toFixed(0)} s`);
  out.push(`  haastavuus ${rep.score}  (portit ${rep.parts.gated.toFixed(2)} · jyrkkyys ${rep.parts.slope.toFixed(2)} · nousu ${rep.parts.climb.toFixed(2)} · kaatumiset ${rep.parts.crashes.toFixed(2)})`);
  if (rep.per.length) {
    out.push('  ' + pad('este', 12) + pad('x', 7) + pad('h', 5) + pad('w', 6) + pad('naiivi ep.', 12) + 'tekniikka');
    for (const p of rep.per) out.push('  ' + pad(p.type, 12) + pad(p.x, 7) + pad(p.h, 5) + pad(p.w, 6) + pad(p.naiveFails + '/4' + (p.gated ? ' portti' : ''), 12) + p.tech);
  }
  if (rep.warnings.length) out.push('  huomioita:\n   - ' + rep.warnings.join('\n   - '));
  const target = def.difficulty?.target;
  if (target) out.push(`  tavoite ${JSON.stringify(target)}: ${meets ? 'täyttyy' : 'EI täyty'}`);
  return out.join('\n');
}
// LEVELS-rivi JavaScript-muodossa (avaimet ilman lainausmerkkejä, sisennys kuten index.html:ssä).
export function formatLevelRow(def) {
  const d = { ...def }; delete d.draft;
  const js = (v) => Array.isArray(v) ? '[' + v.map(js).join(',') + ']'
    : v && typeof v === 'object' ? '{' + Object.entries(v).map(([k, x]) => (/^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)) + ':' + js(x)).join(',') + '}'
    : typeof v === 'string' ? "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
    : typeof v === 'number' && Math.abs(v) < 1 && v !== 0 ? String(v).replace(/^(-?)0\./, '$1.') : String(v);
  const head = ['id', 'name', 'tier', 'gen', 'desc', 'seed', 'length'], rest = Object.keys(d).filter((k) => !head.includes(k));
  const line1 = head.filter((k) => k in d).map((k) => k + ':' + js(d[k])).join(',');
  const nested = ['terrain', 'difficulty', 'features', 'assets'].filter((k) => k in d).map((k) => '  ' + k + ':' + js(d[k]));
  const tail = rest.filter((k) => !['terrain', 'difficulty', 'features', 'assets'].includes(k)).map((k) => k + ':' + js(d[k])).join(',');
  return ' {' + line1 + ',\n' + nested.join(',\n') + (tail ? ',\n  ' + tail : '') + '},';
}
