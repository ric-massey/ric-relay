/* CPU checks for coffee3's physical units and emission budget. The actual
   shaders/particle state are exercised in coffee3-browser.html, not mocked. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(read('assets/coffee3.js'),context);
const {dimensions,orientationGravity,accelerationGravity}=context.RELAY_COFFEE3;
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
  assert.ok(Math.abs(volume/(area*0.6)-d.fillSeconds)<1e-10,'fill time is volume / nozzle flow');
  assert.equal(d.target,Math.floor((d.nx-4)*(d.ny-4)*(d.nz-4)*0.75*3));
  assert.ok(d.capacity>d.target && d.capacity*80<128*1024*1024);
  assert.ok(d.fillSeconds>0 && Number.isFinite(d.fillSeconds));
}
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
