// Run: deno test --allow-read --allow-run=git tests/game_test.js
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
Deno.test('legacy terrain stays identical; quarry has its planned sequence', async () => {
  const baseline = new TextDecoder().decode((await new Deno.Command('git', {args:['show','9300496:index.html']}).output()).stdout);
  const old = core(baseline), current = core(html);
  assert(new Set(current.LEVELS.map(l => l.id)).size === current.LEVELS.length, 'unique IDs');
  for (let i=0;i<old.LEVELS.length;i++) {
    const a=old.buildLevel(old.LEVELS[i]), b=current.buildLevel(current.LEVELS[i]);
    for(const key of ['ys','feats','nodes','cps','target'].filter(k=>i!==15||['ys','feats'].includes(k))) assert(JSON.stringify(a[key])===JSON.stringify(b[key]), `legacy ${i}: ${key}`);
  }
  const def=current.LEVELS.find(l=>l.id==='hylatty-louhos'), lv=current.buildLevel(def);
  const types=['ledge','kickerwall','rockslope','bigair'];
  const features=lv.feats.filter(f=>types.includes(f.type)).sort((a,b)=>a.cx-b.cx);
  assert(features.map(f=>f.type).join(',')==='ledge,ledge,kickerwall,rockslope,bigair','quarry sequence');
  assert(features.map(f=>f.cx).join(',')==='1200,2200,3500,4700,6700','fixed positions');
  assert([...lv.ys].every(Number.isFinite),'finite terrain');
  assert(lv.target<=lv.cg*100,'coverage target');
  assert(lv.cps.length>=4,'checkpoints');
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
  assert(api.bestId(i)==='kotimetsa:intense','reordering');
  const tech=LEVELS.findIndex(l=>l.id==='graniittiportaat');
  assert(api.bestId(tech)==='graniittiportaat:v3:intense','revised terrain has separate records');
  assert(api.saveBest(i,100),'new record saved');
  assert(api.loadBest()['kotimetsa:intense']===100,'old record cannot overwrite faster time');
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
      if(!frontC&&front.y<tYf(lv,front.x)-15-4&&pitch>0.3){lift=0;liftCool=40;}return inp;}
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
  assert(sections===17&&gated>=12,`all sections checked (${sections}), enough technique gates (${gated})`);
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
