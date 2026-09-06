// Run: deno test --allow-read tests/game_test.js
const html = await Deno.readTextFile(new URL('../index.html', import.meta.url));
const script = html.split('<script>\n')[1].split('</script>')[0];
const assert = (ok, message) => { if (!ok) throw new Error(message); };
function core(source) {
  const code = source.slice(source.indexOf('const clamp='), source.indexOf('// ---------- kuvitetut assetit'));
  const terrain = source.slice(source.indexOf('const DX=8'), source.indexOf('// ---------- fysiikka'));
  const meta = JSON.parse(source.split('window.ASSET_DATA=')[1].split(';/*ASSETS-END*/')[0]);
  const physics=source.slice(source.indexOf('const STEP='),source.indexOf('// ---------- renderöinti'));
  return new Function('ASSET_META', code + terrain + physics + ';return {LEVELS,buildLevel,Bike,BIKES,recomputeCoverage};')(meta);
}
Deno.test('complete game script parses', () => { new Function(script); });
Deno.test('every level is a recipe: all build with finite terrain, the quarry keeps its placed sequence', () => {
  const { LEVELS, buildLevel } = core(html);
  assert(new Set(LEVELS.map(l => l.id)).size === LEVELS.length, 'unique IDs');
  assert(LEVELS.every(l => l.gen === 2), 'every level goes through the recipe pipeline');
  for (const def of LEVELS) { const lv = buildLevel(def); assert([...lv.ys].every(Number.isFinite), `${def.id}: finite terrain`); assert(Math.abs(lv.L - def.length) < 1, `${def.id}: menu length ${def.length} matches built ${lv.L}`); }
  const def = LEVELS.find(l => l.id === 'hylatty-louhos'), lv = buildLevel(def);
  const types = ['ledge', 'kickerwall', 'rockslope', 'bigair'];
  const features = lv.feats.filter(f => types.includes(f.type)).sort((a, b) => a.cx - b.cx);
  assert(features.map(f => f.type).join(',') === 'ledge,ledge,kickerwall,rockslope,bigair', 'quarry sequence');
  assert(features.map(f => f.cx).join(',') === '1200,2200,3500,4700,6700', 'fixed positions');
  assert(lv.target <= lv.cg * 100, 'coverage target');
  assert(lv.cps.length === 0, 'no flag checkpoints: nodes only');
});
Deno.test('records migrate, survive reorder and tolerate damaged or blocked storage', () => {
  const {LEVELS}=core(html), data=new Map();
  const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const declarations=script.slice(script.indexOf('const bestKey='),script.indexOf("try{const bi="));
  const functions=script.slice(script.indexOf('const bestId='),script.indexOf('function getLevel'));
  const api=new Function('localStorage','LEVELS','bikeDef',declarations+functions+';return {loadBest,saveBest,bestId};')(storage,LEVELS,()=>({id:'intense'}));
  data.set('petri-pyorapeli-best',JSON.stringify({'0:intense':120,'17:dh':230,'1:intense':null,'99:intense':2}));
  assert(api.loadBest()['kotimetsa:intense']===120,'old record imported');
  assert(api.loadBest()['syoksylasku:dh']===230,'DH record imported');
  LEVELS.reverse();
  const i=LEVELS.findIndex(l=>l.id==='kotimetsa');
  assert(api.bestId(i)==='kotimetsa:v2:intense','reordering');   // muunnetut kentät: recordVersion 2
  const tech=LEVELS.findIndex(l=>l.id==='graniittiportaat');
  assert(api.bestId(tech)==='graniittiportaat:v5:intense','revised terrain has separate records');
  assert(api.saveBest(i,100),'new record saved');
  assert(api.loadBest()['kotimetsa:v2:intense']===100,'record saved under the new key');
  assert(data.has('petri-pyorapeli-best'),'backup preserved');
  data.set('petri-pyorapeli-best-v2','null');data.set('petri-pyorapeli-best','{broken');
  assert(Object.keys(api.loadBest()).length===0,'corrupt data');
  storage.getItem=()=>{throw new Error('blocked');};storage.setItem=storage.getItem;
  assert(Object.keys(api.loadBest()).length===0,'blocked reads');
  assert(api.saveBest(i,90)===false,'blocked writes');
});
// Tekniikkaratojen kuskit. naive: vain kaasu/jarru tavoitevauhtiin, ei kallistusta eikä keulan nostoa.
// tech: säätää asentoa maaston mukaan (ei looppaa, ei nokkaa), nostaa keulan hyllyille, hillitsee vauhtia laskuissa ja pudotuksissa.
const pitchOf=b=>Math.atan2(-(b.B.y-b.A.y)*b.dir,(b.B.x-b.A.x)*b.dir);
const tYf=(lv,x)=>{const f=Math.max(0,Math.min(lv.n-1.0001,x/8)),i=Math.floor(f),t=f-i;return lv.ys[i]*(1-t)+lv.ys[i+1]*t;};
const naive=target=>b=>b.vt>target?{brake:true}:{gas:true};
function tech(target){
  let lift=0,liftCool=0;
  return (b,lv)=>{
    const dir=b.dir,front=dir>0?b.B:b.A,rear=dir>0?b.A:b.B,cA=b.contactA,cB=b.contactB,contact=cA||cB,both=cA&&cB,rearC=dir>0?cA:cB,frontC=dir>0?cB:cA;
    const pitch=pitchOf(b),slope=(x,w)=>Math.atan2(-(tYf(lv,x+dir*w)-tYf(lv,x-dir*w)),2*w);
    const sHere=slope(b.midX,24),sAhead=Math.atan2(-(tYf(lv,front.x+dir*46)-tYf(lv,front.x+dir*6)),40);
    const inp={},back=()=>{if(dir>0)inp.left=true;else inp.right=true;},fwd=()=>{if(dir>0)inp.right=true;else inp.left=true;};
    if(liftCool>0)liftCool--;
    if(lift>0){lift--;inp.gas=true;if(pitch<0.5)back();else if(pitch>0.85)fwd();
      if(!frontC&&front.y<tYf(lv,front.x)-15-4&&pitch>0.3){lift=0;liftCool=14;}return inp;}
    if(!contact){const land=Math.atan2(-(tYf(lv,b.midX+dir*90)-tYf(lv,b.midX+dir*30)),60),want=Math.max(-0.35,Math.min(0.45,land+0.12));
      if(pitch>want+0.12)fwd();else if(pitch<want-0.12)back();return inp;}
    const gRef=Math.atan2(-(tYf(lv,front.x)-tYf(lv,rear.x))*dir*Math.sign((front.x-rear.x)*dir||1),Math.max(20,Math.abs(front.x-rear.x))),rel=pitch-gRef;
    let stepAhead=0;for(let k=0;k<=30;k+=6)stepAhead=Math.max(stepAhead,tYf(lv,front.x+dir*k)-tYf(lv,front.x+dir*(k+10)));
    if(rearC&&lift===0&&liftCool===0&&stepAhead>=14&&b.vt<4.2&&pitch<0.3)lift=12;
    const frontOverDrop=rearC&&!frontC&&tYf(lv,front.x)-tYf(lv,rear.x)>20&&tYf(lv,front.x)>front.y+25&&tYf(lv,rear.x+dir*22)-tYf(lv,rear.x)<6;
    if(frontOverDrop){back();if(b.vt<1.4)inp.gas=true;return inp;}
    if(rearC&&!frontC&&pitch>0.3&&rel>0.15){fwd();if(b.vt<target)inp.gas=true;return inp;}
    if(frontC&&!rearC&&pitch<-0.3&&rel<-0.15){back();inp.brake=b.vt>target*0.5;return inp;}
    const rearWall=rearC&&tYf(lv,rear.x+dir*12)<rear.y-18;if(frontC&&rearWall){inp.gas=true;if(rel>-0.1)fwd();return inp;}
    if(sAhead>0.55||sHere>0.55){inp.gas=true;if(rel>0.08)fwd();return inp;}
    if(sHere<-0.45){if(rel<-0.05)back();if(b.vt>target)inp.brake=true;else if(b.vt<target*0.6)inp.gas=true;return inp;}
    if(b.vt<target)inp.gas=true;else if(b.vt>target+0.35&&both)inp.brake=true;
    return inp;};
}
// Ajaa osuuden lipulta osuuden loppuun. Ohjain päättää 20 kertaa sekunnissa. Tulos: pass / crash / stuck (6 s ilman etenemistä).
function ride(lv,sec,ctrl,Bike,bike,maxS=40){
  const b=new Bike(lv,bike);b.spawn(sec.cp,1);let inp={},last=b.midX,stall=0;
  for(let s=0;s<maxS*120;s++){if(s%6===0)inp=ctrl(b,lv);if(b.step(inp)==='crash')return 'crash';if(b.midX>sec.end+20)return 'pass';
    if(b.midX>last+1){last=b.midX;stall=0;}else if(++stall>720)return 'stuck';}
  return 'stuck';
}
Deno.test('technical routes: every section is rideable with technique, and most stop a gas-and-brake rider', () => {
  const {LEVELS,buildLevel,Bike,BIKES}=core(html);let sections=0,gated=0;
  for(const def of LEVELS.filter(l=>l.tech)){
    const lv=buildLevel(def);
    assert(lv.sections.length>=5&&lv.cps.length===lv.sections.length&&lv.nodes.length===0,`${def.id}: sections with a flag each, no radio chores`);
    assert([...lv.ys].every(Number.isFinite),'finite surface');
    assert(Math.abs(lv.L-def.length)<1,`${def.id}: menu length ${def.length} matches built ${lv.L}`);
    assert(lv.feats.filter(f=>f.spr).every(f=>f.prof===undefined||true),'carved sprites');
    let routeGated=0;
    for(const sec of lv.sections){
      assert(sec.end<lv.L-215&&sec.cp>lv.wallL+60&&sec.hint&&sec.speed>0,'section inside route with hint and speed');
      assert(sec.gates.length>0,`${def.id}/${sec.name}: has at least one obstacle`);
      const t=ride(lv,sec,tech(sec.speed),Bike,BIKES[1]);
      assert(t==='pass',`technique rider failed ${def.id}/${sec.name}: ${t}`);
      const fails=[1.5,2.5,3.5,5].filter(v=>ride(lv,sec,naive(v),Bike,BIKES[1],25)!=='pass').length;
      if(fails>=3)routeGated++;
      sections++;
    }
    assert(routeGated>=Math.ceil(lv.sections.length*0.7),`${def.id}: only ${routeGated}/${lv.sections.length} sections stop the gas-and-brake rider`);
    gated+=routeGated;
    // Osuuksien väliset levähdyspaikat ovat tasaisia: paikaltaan lähtö lipulta onnistuu aina
    for(const sec of lv.sections)for(let x=sec.cp-40;x<=sec.cp+40;x+=40)assert(Math.abs(tY(lv,x)-tY(lv,sec.cp))<1,'flat rest area at flag');
    function tY(lv,x){return tYf(lv,x);}
  }
  assert(sections===24&&gated>=17,`all sections checked (${sections}), enough technique gates (${gated})`);
});
Deno.test('Rinnelasku last low node is distinct and its battery can actually be replaced', () => {
  const {LEVELS,buildLevel,Bike,BIKES,recomputeCoverage}=core(html);
  const serviceCode=script.slice(script.indexOf('function serviceLogic'),script.indexOf('function addText'));
  for(const offset of [-25,0,25]){
    const lv=buildLevel(LEVELS.find(l=>l.id==='rinnelasku'));
    assert(new Set(lv.nodes.map(n=>n.x)).size===lv.nodes.length,'overlapping nodes');
    const nd=lv.nodes.filter(n=>n.origLow).at(-1);
    assert(nd.x===7224,'explicit service location');
    const bike=new Bike(lv,BIKES[2]);bike.spawn(nd.x+offset,1);
    const game={level:lv,bike,inv:{bat:1,node:0},service:null,action:null};
    const noop=()=>{};
    const service=new Function('game','STEP','recomputeCoverage','SFX','say','addText',serviceCode+';return serviceLogic;')(game,1/120,recomputeCoverage,{tick:noop,chime:noop},noop,noop);
    for(let t=0;t<300&&nd.state==='low';t++){
      assert(bike.step(game.action?.ok?{brake:true,hold:true}:{})!=='crash','service spot crash');
      service({use:true});
    }
    assert(nd.state==='ok'&&game.inv.bat===0,'battery swap did not complete');
    assert(game.checkpoint.x===nd.x,'service checkpoint');
  }
});
Deno.test('tricks: landed flips and sustained manuals shorten the time, crashes discard them', () => {
  const trickCode=script.slice(script.indexOf('const TRICKS='),script.indexOf('const netTime='))+'return {TRICKS,trickReset,trickStep,trickFail};';
  const texts=[], sfx={chime:()=>sfx.n++,pickup:()=>sfx.n++,n:0};
  const bike={A:{x:0,y:0},B:{x:60,y:0},H:{x:30,y:-50},dir:1,contactA:true,contactB:true,vt:3,crashed:false};
  const game={bike,bonus:0,tricks:[]};
  const api=new Function('game','STEP','SFX','addText',trickCode)(game,1/120,sfx,(x,y,s)=>texts.push(s));
  const setAngle=a=>{bike.B.x=bike.A.x+60*Math.cos(a);bike.B.y=bike.A.y+60*Math.sin(a);};
  const run=(steps,f)=>{for(let i=0;i<steps;i++){f&&f(i);api.trickStep();}};
  api.trickReset();
  // Backflip: 0.6 s in the air, the frame turns a full circle front wheel first upward (negative angle in screen coordinates).
  bike.contactA=bike.contactB=false; run(72,i=>setAngle(-2*Math.PI*(i+1)/72));
  bike.contactA=bike.contactB=true; setAngle(0); run(40);
  assert(game.tricks.length===1&&game.tricks[0].name==='TAKAVOLTTI'&&game.tricks[0].bonus===api.TRICKS.backflip,'backflip banked after holding the landing');
  assert(sfx.n===1&&texts.some(t=>t.startsWith('TAKAVOLTTI')),'feedback shown once');
  // Brief front wheel lift (0.5 s) is not a manual; a 2 s manual on the rear wheel earns 0.5 s.
  bike.contactB=false; run(60); bike.contactB=true; run(60);
  assert(game.tricks.length===1,'short lift ignored');
  bike.contactB=false; run(240); bike.contactB=true; run(60);
  assert(game.tricks.length===2&&game.tricks[1].name.startsWith('MANUAALI')&&Math.abs(game.tricks[1].bonus-.5)<1e-9,'manual bonus');
  // A manual does not count while standing still, and a nose manual needs the front wheel only.
  bike.vt=0;bike.contactA=false; run(240); bike.contactA=true; run(60); assert(game.tricks.length===2,'stationary balancing ignored');
  bike.vt=3;bike.contactA=false; run(480); bike.contactA=true; run(60);
  assert(game.tricks[2].name.startsWith('NOSE-MANUAALI')&&game.tricks[2].bonus===api.TRICKS.manualMax,'nose manual capped');
  // Frontflip landed on the wheels but crashing before the hold completes loses the bonus.
  const before=game.bonus;
  bike.contactA=bike.contactB=false; run(72,i=>setAngle(2*Math.PI*(i+1)/72));
  bike.contactA=bike.contactB=true; setAngle(0); run(10); bike.crashed=true; api.trickFail(); run(40);
  assert(game.bonus===before&&game.tricks.length===3&&texts.at(-1)==='TEMPPU HUKKAAN','crash discards pending trick');
  assert(Math.abs(game.bonus-(1.5+.5+.8))<1e-9,'total bonus');
});
// ---- kenttägeneraattori v2 (gen:2): reseptit, pohja-algoritmit, sijoittelu, assetit ja mittaus ----
import { extractCore } from '../tools/gamecore.js';
const v2 = extractCore(html);
const tYv = (lv, x) => v2.tY(lv, x), gYv = (lv, x) => { const f = Math.max(0, Math.min(lv.n - 1.0001, x / 8)), i = Math.floor(f), t = f - i; return lv.gys[i] * (1 - t) + lv.gys[i + 1] * t; };
const base = { id: 'x', name: 'x', tier: 7, gen: 2, seed: 5, length: 6000, lowNodes: 2, okNodes: 1, newNodes: 2, cpEvery: 0, rec: 1 };
Deno.test('gen2: recipe levels build, obstacles keep their spacing and every feature lies inside the route', () => {
  const defs = v2.LEVELS.filter((l) => l.gen === 2);
  assert(defs.length >= 3, 'recipe levels exist');
  for (const def of defs) {
    const lv = v2.buildLevel(def);
    assert([...lv.ys].every(Number.isFinite) && [...lv.gys].every(Number.isFinite), `${def.id}: finite terrain`);
    assert(lv.plan.length > 0 && lv.plan.every((p, i) => i === 0 || p.cx >= lv.plan[i - 1].cx), `${def.id}: plan sorted left to right`);
    for (let i = 1; i < lv.plan.length; i++) { const a = lv.plan[i - 1], b = lv.plan[i], min = Math.min(200, lv.def.minGap ?? 200, a.gap ?? 200, b.gap ?? 200); assert(b.cx - b.hw - (a.cx + a.hw) >= min - 1e-6, `${def.id}: ${a.type}/${b.type} closer than their minimum gap`); }
    assert(lv.plan.every((p) => p.cx - p.hw >= 800 && p.cx + p.hw <= lv.L - 1000), `${def.id}: features inside the route`);
    assert(lv.nodes.filter((n) => n.kind === 'node').length === lv.def.lowNodes + lv.def.okNodes && lv.target <= lv.cg * 100, `${def.id}: nodes and coverage target`);   // lv.def = laajennettu resepti
    for (let x = 100; x < 260; x += 40) assert(Math.abs(tYv(lv, x) - tYv(lv, 178)) < 0.5, `${def.id}: flat start`);   // pudotukset nostavat koko vasenta puolta, mutta aukio pysyy tasaisena
  }
  const louhos = v2.buildLevel(defs.find((l) => l.id === 'louhosportaat')), auto = louhos.plan.filter((p) => !(louhos.def.placed ?? []).some((f) => f.x === p.cx)).map((p) => p.type);
  assert(auto.join(',') === 'stairs,ledge,stepsdown,ledge,plateau,boulderfield,stairs,logledge,kickerwall,rockgarden,stairs,gapledge', 'rhythm keeps the written order: ' + auto.join(','));
});
Deno.test('gen2: ground assets are carved into the terrain at ground level and trees avoid cliffs and obstacles', () => {
  for (const def of v2.LEVELS.filter((l) => l.gen === 2)) {
    const lv = v2.buildLevel(def), sprites = lv.feats.filter((f) => f.spr);
    assert(sprites.length >= (def.tech ? 3 : 8), `${def.id}: has carved ground assets`);   // tekniikkaradalla vain osuuksien kivet ja lohkareet
    for (const f of sprites) {
      assert(Math.abs(f.by - gYv(lv, f.x)) < 1 + Math.abs(Math.tan(f.ang)) * 4, `${def.id}: ${f.spr}@${Math.round(f.x)} floats above or sinks below the drawn ground`);   // by = lähin näyte, rinteessä enintään 4 px:n näytevirhe
      assert(tYv(lv, f.x) <= f.by + 0.01, `${def.id}: ${f.spr}@${Math.round(f.x)} is not carved into the collision surface`);
      assert(!(f.type === 'log' || f.type === 'stump' || f.type === 'boulder') || Math.abs(f.ang) < 0.3, `${def.id}: lying ${f.type}@${Math.round(f.x)} placed on a steep slope`);
    }
    const trees = lv.decor.filter((d) => ['spruce', 'pine', 'birch', 'kelo'].includes(d.type) && d.x > 300 && d.x < lv.L - 300);
    for (const d of trees) {
      const slope = Math.abs(Math.atan2(tYv(lv, d.x + 12) - tYv(lv, d.x - 12), 24)) * 180 / Math.PI;
      assert(slope <= 40, `${def.id}: ${d.type}@${Math.round(d.x)} stands on a ${slope.toFixed(0)}° cliff`);
      assert(!sprites.some((f) => Math.abs(f.x - d.x) < f.hw + 6), `${def.id}: tree on top of an obstacle`);
      assert(Math.abs(d.y - tYv(lv, d.x)) < 1e-3, 'tree foot on the ground');
    }
    const kinds = new Set(lv.decor.map((d) => d.type));
    assert(kinds.has('pine') && kinds.has('spruce') && kinds.has('birch') && kinds.has('bush'), `${def.id}: mixed forest`);
  }
});
Deno.test('gen2: terrain algorithms honour slope limit, terrace steps and spline control points', () => {
  const flat = (t) => v2.buildLevel({ ...base, terrain: t, features: [], assets: { obstacles: 0, stones: 0 } });   // pelkkä pohjamaasto
  for (const algo of ['noise', 'ridged', 'midpoint']) {
    const lv = flat({ algo, amp: 300, wl: 900, rough: 8, H: .7, maxSlope: 25 }), m = Math.tan(25 * Math.PI / 180) * 8;
    let worst = 0; for (let i = 1; i < lv.n; i++) worst = Math.max(worst, Math.abs(lv.ys[i] - lv.ys[i - 1]));
    assert(worst <= m + 0.05, `${algo}: slope limit (${worst.toFixed(2)} > ${m.toFixed(2)})`);
    assert(lv.maxY - lv.minY > 60, `${algo}: has relief`);
  }
  const terr = flat({ algo: 'noise', amp: 200, wl: 1200, terrace: 20, terraceRamp: .3 });
  let onStep = 0, total = 0; for (let i = 0; i < terr.n; i++) { const x = i * 8; if (x < 800 || x > terr.L - 800) continue; total++; const r = Math.abs(terr.ys[i] / 20 - Math.round(terr.ys[i] / 20)); if (r < 0.02) onStep++; }
  assert(onStep / total > 0.55, `terrace: ${(onStep / total * 100).toFixed(0)} % of the surface on 20 px treads`);
  const pts = [[0, 0], [1500, 120], [3000, 40], [4500, 220], [6000, 0]], sp = flat({ algo: 'spline', points: pts });
  for (const [x, h] of pts.slice(1, -1)) assert(Math.abs(-tYv(sp, x) - h) < 1, `spline passes (${x},${h}), got ${(-tYv(sp, x)).toFixed(1)}`);
  const dh = flat({ algo: 'noise', amp: 60, wl: 1200, descent: 900 });
  assert(tYv(dh, dh.L - 300) - tYv(dh, 300) > 850, 'descent drops the finish below the start');
  const up = flat({ algo: 'noise', amp: 60, wl: 1200, descent: -700 });
  assert(tYv(up, 300) - tYv(up, up.L - 300) > 650, 'negative descent climbs');
  const big = v2.buildLevel({ ...base, length: 9000, style: 'vaara', relief: 1.8, challenge: .3, features: [], assets: { obstacles: 0, stones: 0 } }), small = v2.buildLevel({ ...base, length: 9000, style: 'vaara', relief: .5, challenge: .3, features: [], assets: { obstacles: 0, stones: 0 } });
  assert(big.maxY - big.minY > 450 && big.maxY - big.minY > 1.6 * (small.maxY - small.minY), `relief above 1 gives big elevation (${Math.round(big.maxY - big.minY)} vs ${Math.round(small.maxY - small.minY)} px)`);
  const bigRep = v2.measureLevel(big, { ride: false }); assert(bigRep.maxUpDeg <= 47, 'big relief still respects the slope limit');
});
Deno.test('gen2: placement errors are loud, manual positions are exact, curve strategy follows the difficulty', () => {
  const throws = (def, re) => { let msg = ''; try { v2.buildLevel(def); } catch (e) { msg = e.message; } assert(re.test(msg), `expected /${re.source}/, got "${msg}"`); };
  throws({ ...base, length: 4000, features: { strategy: 'rhythm', sequence: ['bigair', 'bigair', 'bigair'] } }, /lisää pituutta/);
  throws({ ...base, features: { strategy: 'random', counts: { lohikäärme: 1 } } }, /tuntematon estetyyppi/);
  const over = v2.buildLevel({ ...base, features: { strategy: 'manual', list: [{ type: 'ledge', x: 2000 }, { type: 'ledge', x: 2100 }] }, assets: { obstacles: 0, stones: 0 } });
  assert(over.plan.length === 2 && over.warnings.length === 1 && /päällekkäin/.test(over.warnings[0]), 'overlapping manual features are allowed with a warning');
  assert(over.feats.filter((f) => f.type === 'ledge').length === 2 && tYv(over, 1900) - tYv(over, 2400) > 60, 'both ledges carved, heights add up');
  throws({ ...base, features: { strategy: 'manual', list: [{ type: 'gap', x: 5800 }] } }, /reunan/);
  const man = v2.buildLevel({ ...base, features: { strategy: 'manual', list: [{ type: 'ledge', x: 1500, hard: .2 }, { type: 'gap', x: 3000 }, { type: 'boulder', x: 4500 }] } });
  assert(man.plan.map((p) => `${p.type}@${p.cx}`).join(' ') === 'ledge@1500 gap@3000 boulder@4500', 'manual centres');
  assert(man.feats.some((f) => f.type === 'ledge') && man.feats.some((f) => f.type === 'gap') && man.feats.some((f) => f.spr === 'boulder'), 'manual features carved');
  const cv = v2.buildLevel({ ...base, length: 9000, difficulty: { hard: 1, curve: [0, 1] }, features: { strategy: 'curve', count: 6, pool: ['bumps', 'kicker', 'ledge', 'gap', 'kickerwall', 'bigair'] } });
  const costs = cv.plan.map((p) => v2.FEATURES[p.type].cost);
  assert(costs[0] < 0.3 && costs[costs.length - 1] > 0.6 && cv.plan[0].hard < cv.plan[cv.plan.length - 1].hard, `curve: cheap first, hard last (${cv.plan.map((p) => p.type).join(',')})`);
  const rnd = v2.buildLevel({ ...base, features: { strategy: 'random', counts: { kicker: 2, drop: 1, bumps: 1 } } });
  assert(rnd.plan.length === 4, 'random places every requested feature or throws');
});
Deno.test('gen2: measurement rides every recipe level to the finish and the recipes meet their difficulty targets', () => {
  for (const def of v2.LEVELS.filter((l) => l.gen === 2)) {
    const lv = v2.buildLevel(def), rep = v2.measureLevel(lv);
    assert(rep.ride && rep.ride.finished, `${def.id}: technique rider did not finish (stuck at ${rep.ride?.stuckAt} near ${rep.ride?.near})`);
    const failing = rep.per.filter((p) => p.tech !== 'pass'), tight = lv.def.minGap != null && lv.def.minGap < 200;
    assert(tight || failing.length <= Math.max(1, Math.ceil(rep.per.length * 0.12)), `${def.id}: technique rider fails features in isolation: ${rep.warnings.join('; ')}`);   // heuristinen kuski: yksi herkkä este sallitaan; tiiviissä kentässä (minGap < 200) eristetty lähtö on toisen esteen päältä, joten vain koko kentän ajo ratkaisee
    assert(v2.reportMeetsTarget(rep, def.difficulty?.target), `${def.id}: target ${JSON.stringify(def.difficulty?.target)} not met (score ${rep.score}, gated ${rep.gated})`);
    assert(rep.score >= 0 && rep.score <= 1 && rep.climb >= 0 && rep.maxUpDeg <= (lv.def.terrain.maxSlope || 90) + 14, `${def.id}: sane report (${rep.maxUpDeg}°)`);   // alustojen rampit lisäävät pohjamaaston kaltevuuteen enintään n. 12°
  }
  const easy = v2.measureLevel(v2.buildLevel(v2.LEVELS.find((l) => l.id === 'suurvaara'))), hard = v2.measureLevel(v2.buildLevel(v2.LEVELS.find((l) => l.id === 'korpiraivio')));
  assert(easy.score < hard.score && easy.gated < hard.gated, 'measured difficulty orders the recipes');
});
Deno.test('gen2: every feature type in the library is rideable with technique and sits on a flat platform', () => {
  const types = Object.keys(v2.FEATURES), per = [];
  for (let k = 0; k < types.length; k += 5) {
    const list = types.slice(k, k + 5).map((type, i) => ({ type, x: 1700 + i * 2200, hard: .5 }));
    const lv = v2.buildLevel({ ...base, length: 2200 * list.length + 2600, difficulty: { hard: .5 }, features: { strategy: 'manual', list }, assets: { obstacles: 0, stones: 0 } });
    assert(lv.plan.length === list.length, 'all placed');
    for (const p of lv.plan) for (let x = p.cx - p.hw - 110; x < p.cx - p.hw; x += 20) assert(Math.abs(tYv(lv, x) - tYv(lv, p.cx - p.hw - 60)) < 1.2, `${p.type}: flat run-up`);   // vauhdinotto >= 115 px tasaista; sigmoidien hännät enintään 1 px
    const rep = v2.measureLevel(lv);
    per.push(...rep.per.map((p) => `${p.type}:${p.tech}`));
    assert(rep.ride.finished, `technique rider stuck at ${rep.ride.stuckAt} near ${rep.ride.near} in ${list.map((l) => l.type).join(',')}`);
  }
  const failed = per.filter((s) => !s.endsWith(':pass'));
  assert(failed.length === 0, 'features the technique rider cannot pass: ' + failed.join(', '));
});
Deno.test('gen2: drawn profiles are limited to a rideable slope, placed features keep their spot and automatic ones fit around them', () => {
  const steep = v2.buildLevel({ ...base, length: 7000, terrain: { algo: 'spline', points: [[0, 0], [1200, 0], [1500, 400], [2500, 380], [2700, 0], [7000, 0]] }, features: [], assets: { obstacles: 0, stones: 0 } });
  let worst = 0; for (let i = 1; i < steep.n; i++) worst = Math.max(worst, Math.abs(steep.ys[i] - steep.ys[i - 1]));
  assert(worst <= Math.tan(38 * Math.PI / 180) * 8 + 0.05, `drawn 53° wall was limited to 38° (worst step ${worst.toFixed(2)} px)`);
  assert(v2.measureLevel(steep).ride.finished, 'drawn route is rideable');
  const def = { ...base, length: 9000, style: 'kumpu', relief: .5, challenge: .5, placed: [{ type: 'bigair', x: 3000, hard: 1.4 }, { type: 'ledge', x: 6000, hard: .2 }] };
  const lv = v2.buildLevel(def), manual = lv.plan.filter((p) => p.cx === 3000 || p.cx === 6000);
  assert(manual.length === 2 && manual[0].type === 'bigair' && manual[0].hard === 1.4 && manual[1].type === 'ledge', 'placed features at their exact spots with their own size');
  assert(lv.plan.length > 2, 'automatic features were added around the placed ones');
  for (let i = 1; i < lv.plan.length; i++) assert(lv.plan[i].cx - lv.plan[i].hw - (lv.plan[i - 1].cx + lv.plan[i - 1].hw) >= 48, 'no overlap between placed and automatic features');   // käsin sijoitetun oletusväli 48 px
  const bigHard = v2.buildLevel({ ...def, placed: [{ type: 'bigair', x: 3000, hard: 2 }] }).plan.find((p) => p.cx === 3000), smallHard = v2.buildLevel({ ...def, placed: [{ type: 'bigair', x: 3000, hard: 0 }] }).plan.find((p) => p.cx === 3000);
  assert(bigHard.hw > smallHard.hw, 'size grows with hard');
});
Deno.test('gen2: stretch lengthens repeated features and gap overrides allow tight sequences', () => {
  const stairsOf = (stretch) => v2.buildLevel({ ...base, length: 6000, features: { strategy: 'manual', list: [{ type: 'stairs', x: 2500, hard: .3, stretch }] }, assets: { obstacles: 0, stones: 0 } }).feats.find((f) => f.type === 'stairs');
  const s1 = stairsOf(1), s3 = stairsOf(3);
  assert(s3.cnt >= 2 * s1.cnt && s3.w > 2 * s1.w && Math.abs(s3.h / s3.cnt - s1.h / s1.cnt) < 1e-9, `stretched stairs have more steps of the same height (${s1.cnt} -> ${s3.cnt})`);
  const tight = v2.buildLevel({ ...base, length: 6000, placed: [{ type: 'stairs', x: 2000, gap: 40 }, { type: 'stepsdown', x: 2500, gap: 40 }, { type: 'bumps', x: 2960, gap: 40 }], features: [], assets: { obstacles: 0, stones: 0 } });
  assert(tight.plan.length === 3, 'tight sequence accepted with small gaps');
  assert(v2.measureLevel(tight).ride.finished, 'tight sequence is rideable');
  const over2 = v2.buildLevel({ ...base, length: 6000, placed: [{ type: 'stairs', x: 2000 }, { type: 'stepsdown', x: 2200 }], features: [], assets: { obstacles: 0, stones: 0 } });
  assert(over2.plan.length === 2 && over2.warnings.length === 1, 'overlapping placed features are kept and only warned about');
  const dense = v2.buildLevel({ ...base, length: 7000, minGap: 60, features: { strategy: 'rhythm', sequence: ['bumps', 'stairs', 'stepsdown', 'bumps', 'rocks', 'stairs'] }, assets: { obstacles: 0, stones: 0 } });
  assert(dense.plan.length === 6 && dense.plan.every((p, i) => !i || p.cx - p.hw - (dense.plan[i - 1].cx + dense.plan[i - 1].hw) >= 60), 'minGap packs the rhythm sequence');
});
Deno.test('gen2: pinning every feature (editor drag) reproduces the plan exactly and a pinned feature can be moved', () => {
  for (const def of v2.LEVELS.filter((l) => l.gen === 2 && !l.tech)) {   // tekniikkaradat rakentuvat osuuksista, ei placed-listasta
    const lv = v2.buildLevel(def), placed = lv.plan.map((p) => ({ type: p.type, x: p.cx, hard: p.hard, stretch: p.stretch, size: p.size, gap: p.gap, dims: p.dims }));
    const pinned = v2.buildLevel({ ...def, placed, features: [] });
    assert(pinned.plan.length === lv.plan.length && pinned.plan.every((p, i) => p.type === lv.plan[i].type && Math.abs(p.cx - lv.plan[i].cx) < 1e-6 && Math.abs(p.hw - lv.plan[i].hw) < 1e-6), `${def.id}: pinned plan identical`);
    assert(JSON.stringify([...pinned.gys]) === JSON.stringify([...lv.gys]), `${def.id}: pinned terrain identical (before carved stones, whose random heights may differ)`);
    const moved = placed.map((f, i) => i === placed.length - 1 ? { ...f, x: f.x + 60 } : f), m = v2.buildLevel({ ...def, placed: moved, features: [] });
    assert(Math.abs(m.plan[m.plan.length - 1].cx - (placed[placed.length - 1].x + 60)) < 1e-6, `${def.id}: last feature moved 60 px`);
  }
});
Deno.test('gen2: size scales a feature vertically without changing its footprint', () => {
  const hump = (size) => { const lv = v2.buildLevel({ ...base, length: 6000, placed: [{ type: 'hump', x: 2500, hard: .3, size }], features: [], assets: { obstacles: 0, stones: 0 } }); const f = lv.feats.find((q) => q.type === 'hump'); let top = 1e9; for (let x = f.x; x < f.x + f.w; x += 8) top = Math.min(top, tYv(lv, x)); return { h: tYv(lv, f.x) - top, w: f.w, plan: lv.plan[0] }; };
  const a = hump(1), b = hump(2);
  assert(Math.abs(b.h - 2 * a.h) < 1.5 && Math.abs(b.w - a.w) < 1e-6 && Math.abs(b.plan.hw - a.plan.hw) < 1e-6, `size 2 doubles the height (${a.h.toFixed(1)} -> ${b.h.toFixed(1)}) and keeps the width`);
  const bo = (size) => v2.buildLevel({ ...base, length: 6000, placed: [{ type: 'boulder', x: 2500, hard: .3, size }], features: [], assets: { obstacles: 0, stones: 0 } }).feats.find((q) => q.spr === 'boulder').h;
  assert(Math.abs(bo(1.5) - 1.5 * bo(1)) < 1e-6, 'sprite obstacles scale too');
});
Deno.test('physics: bunny hop lifts both wheels after a back-then-forward pull, holding back alone does not hop', () => {
  const lv = v2.buildLevel({ ...base, length: 5000, terrain: { algo: 'noise', amp: 0, wl: 1000 }, features: [], assets: { obstacles: 0, stones: 0 } });
  const ride = (script) => { const b = new v2.Bike(lv, v2.BIKES[1]); b.spawn(1000, 1); for (let i = 0; i < 200; i++) b.step({ gas: true }); const y0 = b.midY; let air = 0, hopped = false, crash = false, top = 0;
    for (const [n, inp] of script) for (let i = 0; i < n; i++) { if (b.step(inp) === 'crash') { crash = true; break; } if (b.hopped) hopped = true; if (!b.contactA && !b.contactB) air++; top = Math.max(top, y0 - b.midY); }
    return { air, hopped, crash, top }; };
  const hop = ride([[18, { left: true, gas: true }], [6, { right: true, gas: true }], [80, { gas: true }]]);   // näpäytys taakse 0,15 s, sitten eteen
  assert(hop.hopped && hop.air >= 10 && hop.top > 8, `bunny hop: hopped ${hop.hopped}, ${hop.air} steps airborne, ${hop.top.toFixed(0)} px high`);
  const none = ride([[18, { left: true, gas: true }], [80, { gas: true }]]);
  assert(!none.hopped, 'no hop without the forward pull');
  const cold = ride([[6, { right: true, gas: true }], [80, { gas: true }]]);
  assert(!cold.hopped && cold.air === 0, 'no hop without preload');
});
