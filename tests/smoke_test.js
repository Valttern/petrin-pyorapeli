// Savutesti: koko pelin skripti ajetaan tynkä-DOM:lla (piirto ja ääni ovat no-op-proxyja), valikko piirretään ja jokainen kenttä
// käynnistetään ja ajetaan kuusi ruutua. Paljastaa puuttuvat funktiot ja muut ajonaikaiset virheet, joita parsintatesti ei näe.
// Aja: deno test --allow-read tests/smoke_test.js
const html = await Deno.readTextFile(new URL('../index.html', import.meta.url));
const script = html.split('<script>\n')[1].split('</script>')[0];
const assetScript = html.split('<script>/*ASSETS-START*/')[1].split('</script>')[0];
const noop = () => {};
const makeProxy = (name) => new Proxy(function () {}, { get: (t, k) => { if (k === Symbol.toPrimitive) return () => 0; if (k === 'then') return undefined; if (k === 'length' || k === 'width' || k === 'height') return 800; if (k === 'classList') return { add: noop, remove: noop, toggle: noop, contains: () => false }; if (k === 'style') return new Proxy({}, { get: () => '', set: () => true }); if (k === 'dataset') return {}; if (k === 'value' || k === 'textContent' || k === 'innerHTML') return ''; return makeProxy(name + '.' + String(k)); }, set: () => true, apply: () => makeProxy(name + '()'), construct: () => makeProxy(name + '.new') });
const el = makeProxy('el');
const frames = [];
globalThis.window = globalThis; globalThis.document = new Proxy({}, { get: (t, k) => k === 'querySelector' || k === 'getElementById' ? () => el : k === 'querySelectorAll' ? () => [] : k === 'createElement' ? () => el : k === 'addEventListener' ? noop : k === 'body' ? el : makeProxy('document.' + String(k)) });
globalThis.location = { hash: '', search: '' }; globalThis.navigator = { userAgent: 'headless' }; globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
globalThis.requestAnimationFrame = (cb) => { frames.push(cb); return 1; }; globalThis.cancelAnimationFrame = noop; globalThis.addEventListener = noop; globalThis.removeEventListener = noop; globalThis.setTimeout = (cb) => 0; globalThis.setInterval = () => 0;
globalThis.Image = function () { return el; }; globalThis.AudioContext = function () { return makeProxy('audio'); }; globalThis.webkitAudioContext = globalThis.AudioContext;
globalThis.performance = { now: () => Date.now() }; globalThis.devicePixelRatio = 1; globalThis.innerWidth = 1280; globalThis.innerHeight = 720; globalThis.escape = (s) => s; globalThis.unescape = (s) => s; globalThis.atob = (s) => s; globalThis.btoa = (s) => s;
globalThis.alert = noop; globalThis.matchMedia = () => ({ matches: false });
try { new Function(assetScript)(); } catch (e) { console.log('assets:', e.message); }
try { new Function(script + '\n;globalThis.__g={startLevel,frame,game,LEVELS,toMenu};')(); } catch (e) { console.log('LOAD ERROR:', e.stack?.split('\n').slice(0, 4).join('\n')); Deno.exit(1); }
const g = globalThis.__g;
const runFrames = (n) => { for (let i = 0; i < n; i++) { const cb = frames.shift(); if (!cb) break; try { cb(performance.now() + i * 16); } catch (e) { console.log('FRAME ERROR:', e.stack?.split('\n').slice(0, 4).join('\n')); return false; } } return true; };
Deno.test('smoke: menu renders and every level starts and runs six frames without runtime errors', () => {
  runFrames(3);
  const ids = g.LEVELS.map((l) => l.id);
for (const id of ids) { const li = g.LEVELS.findIndex((l) => l.id === id); try { g.startLevel(li); if (!runFrames(6)) { console.log('  in level', id); Deno.exit(1); } } catch (e) { console.log('START ERROR', id, e.stack?.split('\n').slice(0, 4).join('\n')); Deno.exit(1); } }
});
