/* CPU checks for coffee3's physical units and emission budget. The actual
   shaders/particle state are exercised in coffee3-browser.html, not mocked. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(read('assets/coffee3.js'),context);
const {dimensions,jetAt,parcelAt,streamAt,opening,openTime,START_DELAY,RAMP_SECONDS,drainOpening,projectPoint,orientationGravity,accelerationGravity}=context.RELAY_COFFEE3;
assert.equal(START_DELAY,3,'wait three seconds before the first flow');
assert.equal(opening(0),0);assert.equal(opening(RAMP_SECONDS),1);
assert.ok(opening(0.5)<opening(1)&&opening(1)<opening(2),'start slowly and build to full flow');
assert.equal(openTime(-1),0);assert.equal(openTime(3),1.5);assert.equal(openTime(5),3.5);
for(const z of [0,1,4,8]){
  assert.deepEqual(Array.from(projectPoint(17,29,z)),[17,29],'depth never shifts the image: the camera is exactly straight on');
}
const near=(actual,expected)=>{for(let i=0;i<expected.length;i++)assert.ok(Math.abs(actual[i]-expected[i])<1e-10,`${actual} versus ${expected}`);};
near(orientationGravity(90,0),[0,-1,0]);
near(orientationGravity(-90,0),[0,1,0]);
near(orientationGravity(0,0),[0,0,-1]);
near(orientationGravity(90,0,90),[1,0,0]);
near(accelerationGravity(0,9.81,0),[0,-1,0]);
near(accelerationGravity(0,-9.81,0,0,-1),[0,-1,0]);
near(accelerationGravity(0,9.81,0,90),[1,0,0]);
for(const b of [-180,-90,-20,0,30,90,180])for(const g of [-90,-35,0,35,90]){
  const v=orientationGravity(b,g,90);
  assert.ok(Math.abs(Math.hypot(...v)-1)<1e-10,'orientation preserves gravity magnitude');
}
for(const [w,h,phone] of [[1440,900,false],[375,812,true],[844,390,true],[2560,1440,false]]){
  const d=dimensions(w,h,phone);
  const physicalG=0.4*d.metresPerCell/d.timeUnit**2;
  assert.ok(Math.abs(physicalG-9.81)<1e-10,'gravity is 9.81 m/s²');
  const area=Math.PI*(d.radius*d.metresPerCell)**2;
  const volume=d.target/3*d.metresPerCell**3;
  const nozzleSpeed=d.speed*d.metresPerCell/d.timeUnit;
  assert.ok(Math.abs(nozzleSpeed**2-2*9.81*d.head)<1e-12,'maximum nozzle speed comes from gravity and head');
  assert.ok(Math.abs(volume/(area*nozzleSpeed)+START_DELAY+RAMP_SECONDS/2-d.fillSeconds)<1e-10,'fill time includes delayed start and integrated valve flow');
  assert.ok(d.creamTarget>0&&d.capacity>d.target+d.creamTarget,'cream has its own real liquid volume');
  assert.equal(d.target,Math.floor((d.nx-4)*(d.ny-4)*(d.nz-4)*0.75*3));
  assert.ok(d.capacity>d.target && d.capacity*80<128*1024*1024);
  assert.ok(d.fillSeconds>0 && Number.isFinite(d.fillSeconds));
  assert.ok(Math.abs(d.viscosity*d.metresPerCell**2/(3*d.timeUnit)-0.8e-6)<1e-12,'molecular viscosity uses real units');
  for(const y of [2,d.ny/2,d.ny+2]){
    const jet=jetAt(d,y);
    assert.ok(Math.abs(Math.PI*jet.radius**2*jet.speed*3-d.flow)<1e-10,'the falling stream conserves flux at every height');
    const t=jet.fallSeconds/d.timeUnit;
    assert.ok(Math.abs(d.ny+2-d.speed*t-0.2*t*t-y)<1e-10,'the analytical stream reaches the surface in its calculated fall time');
  }
  const source={start:START_DELAY,ramp:RAMP_SECONDS,speed:d.speed,radius:d.radius,cream:0,end:12};
  assert.equal(streamAt(d,source,d.ny,2.9).radius,0,'nothing falls during the delay');
  for(const birth of [3.1,3.5,4,7]){
    const at=birth+0.05,p=parcelAt(d,source,birth,at),sample=streamAt(d,source,p.y,at);
    const v0=d.speed*opening(birth-START_DELAY),physicalDrop=(d.ny+2-p.y)*d.metresPerCell;
    const physicalSpeed=p.speed*d.metresPerCell/d.timeUnit;
    assert.ok(Math.abs(physicalSpeed**2-(v0*d.metresPerCell/d.timeUnit)**2-2*9.81*physicalDrop)<1e-10,'every parcel accelerates under actual gravity');
    assert.ok(Math.abs(sample.radius-p.radius)<0.002,'drawn stream follows the parcel birth speed');
  }
  assert.equal(streamAt(d,source,d.ny,15).radius,0,'the tail clears after the source shuts off');
}
assert.equal(drainOpening(0),0.12);
assert.ok(drainOpening(0.2)>0.12);
assert.ok(drainOpening(0.4)>0.5,'the floor gate eventually opens beyond both sides, so no shelf traps a pool');
assert.equal(drainOpening(10),drainOpening(0.4));
const terminal=read('terminal.html'),door=read('index.html');
assert.match(terminal,/coffee3: \(\) =>/);
assert.match(terminal,/TERMINAL_EMBED\.send\(\{ term: "coffee3" \}\)/);
assert.match(door,/m\.term === "coffee3"/);
assert.match(door,/\^coffee3\$\/i\.test\(typed\)\) \{ window\.DeviceMotionEvent\?\.requestPermission/,'front door asks sensor permission in the submit gesture');
assert.ok(!/src="assets\/coffee3\.js/.test(terminal+door),'normal visits do not download the simulation');

function domContext(reduced){
  const elements=[],timers=[];
  const document={body:{appendChild(el){elements.push(el);}},createElement(tag){return{tag,dataset:{},style:{},attrs:{},removed:false,setAttribute(k,v){this.attrs[k]=v;},remove(){this.removed=true;}};}};
  const env=vm.createContext({document,navigator:{},console:{error(){}},innerWidth:375,innerHeight:812,
    matchMedia:q=>({matches:q.includes('reduced-motion')&&reduced}),setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){}});
  vm.runInContext(read('assets/coffee3.js'),env);
  return{api:env.RELAY_COFFEE3,elements,timers};
}
{
  const {api,elements,timers}=domContext(true);await api.pour();await api.pour();
  assert.equal(elements.length,1,'reduced motion opens exactly one still cup');
  assert.equal(elements[0].tag,'div','reduced motion never creates a GPU canvas');
  assert.equal(elements[0].attrs['aria-hidden'],'true');
  api.active.stop();assert.equal(api.active,null);assert.ok(elements[0].removed);
  await api.pour();const fresh=api.active;timers[0]();
  assert.equal(api.active,fresh,'an old cup timer cannot remove a new cup');fresh.stop();
}
{
  const {api,elements}=domContext(false);await api.pour();
  assert.equal(api.active,null,'missing WebGPU leaves no active simulation');
  assert.ok(elements.find(e=>e.tag==='canvas').removed,'failed GPU start removes its canvas');
  assert.ok(elements.some(e=>e.attrs.role==='status'&&/WebGPU/.test(e.textContent)),'unsupported browser gets an honest notice');
  await api.pour();assert.equal(api.active,null,'failed startup can be retried');
}
console.log('coffee3: units, flow, phone axes/sign, command entry points, reduced motion and unsupported GPU cleanup passed');
