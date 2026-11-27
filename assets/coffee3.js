/* coffee3 — live, shallow 3D coffee, 2026-11-27.
   Ric: "a horizontal view ... so it should be simpler"; "make it as coffee3".
   No video, library, build step or network assets. MLS-MPM on WebGPU;
   particles become a continuous surface by tracing their 3D density field.
   The transfer equations are adapted from matsuoka-601/Splash (MIT), which
   credits Hu et al. and nialltl. Full credit/licence: coffee3-LICENSE.txt.
   The fixed camera is orthographic and exactly straight on (zero elevation).
   This is weakly compressible liquid, not an offline incompressible solve.
   Lighting, nozzle size and unresolved detail remain visual/model choices.
   The simulation uses actual 9.81 m/s² at the estimated screen size.
   One grid cell = metresPerCell; one simulation time unit = timeUnit seconds.
   GPU time is bounded: a slow device loses elapsed time, never enlarges dt. */
(function (root) {
  'use strict';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const REST = 3, DT = 0.10;
  const WALL_FRICTION = 18, MIX_RATE = 1.5, STIR_MIX_RATE = 24;
  // Two mass units per parcel halve the pressure/scatter work. Both emitted
  // volume and pressure force carry this factor; changing count alone loses coffee.
  const PARCEL_MASS = 2;
  const START_DELAY = 3, RAMP_SECONDS = 3, BUBBLES = 128;
  // Ric, 2026-11-27: "straight on. Not at an angle". One projection for
  // the volume, droplets and viewing rays; depth never raises a point.
  const CAMERA_SLOPE = 0;
  const projectPoint = (x,y,z) => [x,y+CAMERA_SLOPE*z];
  // A spoon entrains nearby liquid toward its velocity, rather than applying
  // an acceleration forever while the pointer is held in one place.
  function stirVelocity(dx,dy,seconds,d){
    const gain=0.45,limit=0.3;
    let x=dx*d.metresPerCell/Math.max(seconds,0.008)*gain,y=dy*d.metresPerCell/Math.max(seconds,0.008)*gain;
    const scale=Math.min(1,limit/Math.max(Math.hypot(x,y),0.00001));
    return [x*scale*d.timeUnit/d.metresPerCell,y*scale*d.timeUnit/d.metresPerCell];
  }
  function motionResponse(raw,reference){
    const g=reference||raw.map(v=>v/Math.max(Math.hypot(...raw),0.00001));
    const delta=raw.map((v,i)=>v-g[i]),scale=Math.min(0.45,0.7/Math.max(Math.hypot(...delta),0.00001));
    return g.map((v,i)=>v+delta[i]*scale);
  }
  function freezePage(cup){
    const html=document.documentElement,focus=document.activeElement;
    const children=[...document.body.children].filter(el=>el!==cup&&!el.matches('[data-coffee3-controls], [data-coffee3-hud]')&&!el.querySelector('[data-coffee3-controls]'));
    const inert=children.map(el=>[el,el.inert]);
    const animations=(document.getAnimations?.()||[]).filter(a=>a.playState==='running');
    const playing=[...document.querySelectorAll('video,audio')].filter(v=>!v.paused);
    const style=document.createElement('style');
    style.textContent='html[data-coffee3-active],html[data-coffee3-active] body{overflow:hidden!important;overscroll-behavior:none}html[data-coffee3-active] *,html[data-coffee3-active] *::before,html[data-coffee3-active] *::after{animation-play-state:paused!important}';
    document.head.appendChild(style);html.setAttribute('data-coffee3-active','');
    inert.forEach(([el])=>{el.inert=true;});animations.forEach(a=>a.pause());playing.forEach(v=>v.pause());
    const blockPlay=e=>{if(e.target.matches?.('video,audio'))e.target.pause();};
    document.addEventListener('play',blockPlay,true);
    document.dispatchEvent(new CustomEvent('coffee3:freeze',{detail:{active:true}}));
    let released=false;
    return ()=>{
      if(released)return;released=true;document.removeEventListener('play',blockPlay,true);
      html.removeAttribute('data-coffee3-active');style.remove();inert.forEach(([el,was])=>{el.inert=was;});
      animations.forEach(a=>{if(a.playState==='paused')a.play();});
      document.dispatchEvent(new CustomEvent('coffee3:freeze',{detail:{active:false}}));
      playing.forEach(v=>{if(v.isConnected)v.play().catch(()=>{});});
      if(focus?.isConnected&&!focus.inert)focus.focus({preventScroll:true});
    };
  }
  let current = null, starting = false, lastRun = null;

  // Screen x right, y UP, z behind the glass. Keep this conversion separate
  // from the sensor permission and smoothing so landscape can be tested too.
  function orientationGravity(beta,gamma,angle=0){
    const b=beta*Math.PI/180,g=gamma*Math.PI/180,a=angle*Math.PI/180;
    const x=Math.cos(b)*Math.sin(g),y=-Math.sin(b),z=-Math.cos(b)*Math.cos(g);
    return [x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a),z];
  }
  function accelerationGravity(x,y,z,angle=0,sign=1){
    const a=angle*Math.PI/180;
    return [(-x*Math.cos(a)+y*Math.sin(a))*sign/9.81,(-x*Math.sin(a)-y*Math.cos(a))*sign/9.81,-z*sign/9.81];
  }

  function dimensions(width, height, phone) {
    const nx = phone ? 44 : 64, inner = nx - 4;
    const ny = Math.max(18, Math.ceil(inner * height / width) + 4), nz = 8;
    const metresWide = phone ? 0.068 * width / Math.min(width, height) : width * 0.0002646;
    const metresPerCell = metresWide / inner;
    const timeUnit = Math.sqrt(0.4 * metresPerCell / 9.81);
    const radius = Math.min((phone ? 0.0025 : 0.006) / metresPerCell, (nz - 4) * 0.35);
    // Gravity-fed spout: two cells of head above the inlet, no pump velocity.
    // v² = 2gh; the three-second valve opening changes flow, never gravity.
    const head = 2 * metresPerCell;
    const speed = Math.sqrt(2 * 9.81 * head) * timeUnit / metresPerCell;
    const flow = Math.PI * radius * radius * speed * REST / PARCEL_MASS;
    const target = Math.floor(inner * (ny - 4) * (nz - 4) * 0.75 * REST / PARCEL_MASS);
    const viscosity = REST * 0.8e-6 * timeUnit / (metresPerCell * metresPerCell);
    const creamTarget = Math.floor(target * 0.06);
    return { nx, ny, nz, inner, metresPerCell, timeUnit, radius, speed, flow, target, creamTarget, head, viscosity, parcelMass:PARCEL_MASS,
      fillSeconds: START_DELAY + target / flow * timeUnit + RAMP_SECONDS / 2, capacity: target + creamTarget + 512 };
  }

  const opening = (t,ramp=RAMP_SECONDS) => {const x=clamp(t/ramp,0,1);return x*x*(3-2*x);};
  function openTime(t,ramp=RAMP_SECONDS){
    const x=clamp(t/ramp,0,1);
    return t<=0?0:t>=ramp?t-ramp/2:ramp*(x*x*x-0.5*x*x*x*x);
  }
  function jetAt(d,y,speed=d.speed,radius=d.radius){
    const fall=Math.max(0,d.ny+2-y);
    const impact=Math.sqrt(speed*speed+0.8*fall);
    return {speed:impact,radius:radius*Math.sqrt(speed/Math.max(impact,1e-8)),fallSeconds:(impact-speed)/0.4*d.timeUnit};
  }
  function parcelAt(d,source,birth,now){
    const speed=source.speed*opening(birth-source.start,source.ramp),age=Math.max(0,(now-birth)/d.timeUnit);
    return {y:d.ny+2-speed*age-0.2*age*age,speed:speed+0.4*age,
      radius:source.radius*Math.sqrt(speed/Math.max(speed+0.4*age,1e-8))};
  }
  // Retarded source time: each row sees the parcel that actually reaches it,
  // including the thin leading dribble and the falling tail after shutoff.
  function streamAt(d,source,y,now){
    if(!source)return {radius:0,speed:0,cream:0};
    let lo=source.start,hi=now;
    if(hi<=lo||parcelAt(d,source,lo,now).y>y)return {radius:0,speed:0,cream:0};
    for(let i=0;i<16;i++){const mid=(lo+hi)/2;if(parcelAt(d,source,mid,now).y<y)lo=mid;else hi=mid;}
    const birth=(lo+hi)/2;
    if(birth>source.end)return {radius:0,speed:0,cream:0};
    return {...parcelAt(d,source,birth,now),cream:source.cream};
  }
  const drainOpening=seconds=>0.12+0.4*clamp(seconds/0.4,0,1);

  // Shared bindings avoid per-substep allocations. Dispatch boundaries are
  // the memory barriers between mass scatter, pressure scatter and gather.
  const COMMON = `
    struct Particle { p: vec4f, v: vec4f, C: mat3x3f }
    struct Cell { x: atomic<i32>, y: atomic<i32>, z: atomic<i32>, m: atomic<i32>, cream: atomic<i32> }
    struct Params {
      size: vec4f, gravity: vec4f, mouse: vec4f, push: vec4f,
      counts: vec4u, view: vec4f, nozzle: vec4f, clock: vec4f
    }
    @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
    @group(0) @binding(1) var<storage, read_write> cells: array<Cell>;
    @group(0) @binding(2) var<uniform> u: Params;
    const FIX: f32 = 1000000.0;
    const PARCEL_MASS:f32 = ${PARCEL_MASS.toFixed(1)};
    fn enc(v: f32) -> i32 { return i32(round(v * FIX)); }
    fn dec(v: i32) -> f32 { return f32(v) / FIX; }
    fn index(p: vec3i) -> u32 { return u32((p.x * i32(u.size.y) + p.y) * i32(u.size.z) + p.z); }
    fn weights(d: vec3f) -> array<vec3f, 3> {
      return array<vec3f, 3>(0.5 * (0.5-d)*(0.5-d), 0.75-d*d, 0.5*(0.5+d)*(0.5+d));
    }
    fn live(i: u32) -> bool { return i < u.counts.x && particles[i].p.w > 0.0; }
    fn hash(n: u32) -> f32 {
      var x = n * 747796405u + 2891336453u;
      x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u;
      return f32((x >> 22u) ^ x) / 4294967295.0;
    }
  `;
  const COMPUTE = COMMON + `
    @compute @workgroup_size(64) fn clear(@builtin(global_invocation_id) id: vec3u) {
      if (id.x >= u.counts.y) { return; }
      atomicStore(&cells[id.x].x, 0); atomicStore(&cells[id.x].y, 0);
      atomicStore(&cells[id.x].z, 0); atomicStore(&cells[id.x].m, 0);
      atomicStore(&cells[id.x].cream, 0);
    }
    @compute @workgroup_size(64) fn scatter(@builtin(global_invocation_id) id: vec3u) {
      let i = id.x; if (!live(i)) { return; }
      let p = particles[i]; let base = vec3i(floor(p.p.xyz));
      let w = weights(p.p.xyz - vec3f(base) - 0.5);
      for (var x=0; x<3; x++) { for (var y=0; y<3; y++) { for (var z=0; z<3; z++) {
        let c = base + vec3i(x,y,z) - 1;
        if (any(c < vec3i(0)) || any(c >= vec3i(u.size.xyz))) { continue; }
        let j = index(c); let mass = w[x].x * w[y].y * w[z].z * PARCEL_MASS;
        let v = mass * (p.v.xyz + p.C * (vec3f(c) + 0.5 - p.p.xyz));
        atomicAdd(&cells[j].m, enc(mass));
        atomicAdd(&cells[j].cream, enc(mass*p.v.w));
        atomicAdd(&cells[j].x, enc(v.x)); atomicAdd(&cells[j].y, enc(v.y)); atomicAdd(&cells[j].z, enc(v.z));
      }}}
    }
    @compute @workgroup_size(64) fn pressure(@builtin(global_invocation_id) id: vec3u) {
      let i=id.x; if (!live(i)) { return; }
      let p=particles[i]; let base=vec3i(floor(p.p.xyz));
      let w=weights(p.p.xyz-vec3f(base)-0.5); var density=0.0;
      for(var x=0;x<3;x++){for(var y=0;y<3;y++){for(var z=0;z<3;z++){
        let c=base+vec3i(x,y,z)-1;
        if(any(c<vec3i(0))||any(c>=vec3i(u.size.xyz))){continue;}
        density+=dec(atomicLoad(&cells[index(c)].m))*w[x].x*w[y].y*w[z].z;
      }}}
      let pFluid=max(0.0, 100.0*(density/3.0-1.0));
      var stress=mat3x3f(vec3f(-pFluid,0,0),vec3f(0,-pFluid,0),vec3f(0,0,-pFluid));
      let strain=0.5*(p.C+transpose(p.C));
      let rate=sqrt(2.0*(dot(strain[0],strain[0])+dot(strain[1],strain[1])+dot(strain[2],strain[2])));
      // Molecular viscosity in real units plus Smagorinsky's unresolved shear.
      // Uniform drag made this look like syrup and also killed the surface waves.
      let viscosity=min(u.size.w+3.0*0.17*0.17*rate,0.35);
      stress+=viscosity*(p.C+transpose(p.C));
      // Bulk dissipation damps unresolved compression waves, not translation.
      // Without it, the weakly compressible pressure solve keeps ringing at rest.
      let compression=2.0*(p.C[0].x+p.C[1].y+p.C[2].z);
      stress+=mat3x3f(vec3f(compression,0,0),vec3f(0,compression,0),vec3f(0,0,compression));
      let force=(-4.0*u.clock.x*PARCEL_MASS/max(density,0.1))*stress;
      for(var x=0;x<3;x++){for(var y=0;y<3;y++){for(var z=0;z<3;z++){
        let c=base+vec3i(x,y,z)-1;
        if(any(c<vec3i(0))||any(c>=vec3i(u.size.xyz))){continue;}
        let v=force*(w[x].x*w[y].y*w[z].z)*(vec3f(c)+0.5-p.p.xyz); let j=index(c);
        atomicAdd(&cells[j].x,enc(v.x));atomicAdd(&cells[j].y,enc(v.y));atomicAdd(&cells[j].z,enc(v.z));
      }}}
    }
    @compute @workgroup_size(64) fn forces(@builtin(global_invocation_id) id: vec3u) {
      let i=id.x; if(i>=u.counts.y){return;}
      let mass=dec(atomicLoad(&cells[i].m)); if(mass<0.00001){return;}
      let nz=u32(u.size.z);let ny=u32(u.size.y);
      let c=vec3f(f32(i/nz/ny),f32((i/nz)%ny),f32(i%nz))+0.5;
      var v=vec3f(dec(atomicLoad(&cells[i].x)),dec(atomicLoad(&cells[i].y)),dec(atomicLoad(&cells[i].z)))/mass;
      // Dissipate tangential flow at the glass before gravity is applied.
      // The old boundary only clipped the normal velocity, preserving spin.
      let seconds=u.clock.x*u.gravity.w;
      let glass=1.0-smoothstep(0.5,1.7,min(c.z-2.0,u.size.z-2.0-c.z));
      let side=1.0-smoothstep(0.5,1.7,min(c.x-2.0,u.size.x-2.0-c.x));
      let floor=select(1.0-smoothstep(0.5,1.7,c.y-2.0),0.0,u.clock.z>0.0);
      let contact=smoothstep(0.15,1.2,mass);
      v*=exp(-${WALL_FRICTION.toFixed(1)}*seconds*contact*vec3f(glass+floor,glass+side,side+floor));
      v+=u.gravity.xyz*u.clock.x;
      // Boussinesq approximation: a chosen 3% density excess makes the cream
      // sink relative to coffee without a separate, pasted-on plume animation.
      v+=u.gravity.xyz*u.clock.x*0.03*dec(atomicLoad(&cells[i].cream))/mass;
      let d=(c.xy-u.mouse.xy)/max(u.mouse.z,0.1);
      let drag=(1.0-exp(-16.0*u.clock.x*u.gravity.w))*exp(-dot(d,d)*2.0)*u.mouse.w;
      v=vec3f(mix(v.xy,u.push.xy,drag),v.z);
      if((c.x<=2.5 && v.x<0.0) || (c.x>=u.size.x-2.5 && v.x>0.0)){v.x=0.0;}
      if((c.z<=2.5 && v.z<0.0) || (c.z>=u.size.z-2.5 && v.z>0.0)){v.z=0.0;}
      let inDrain=u.clock.z>0.0 && abs(c.x-u.size.x*0.5)<u.size.x*u.clock.z;
      if(c.y<=2.5 && v.y<0.0 && !inDrain){v.y=0.0;}
      atomicStore(&cells[i].x,enc(v.x));atomicStore(&cells[i].y,enc(v.y));atomicStore(&cells[i].z,enc(v.z));
    }
    @compute @workgroup_size(64) fn gather(@builtin(global_invocation_id) id: vec3u) {
      let i=id.x;if(i>=u.counts.x){return;}
      // New parcels enter at their arrival time within this frame, never as
      // an instant column pushed deep below the pool and then advanced twice.
      if(particles[i].p.w<0.0){
        let remaining=particles[i].p.w+u.clock.x*u.gravity.w;
        particles[i].p.w=select(remaining,1.0,remaining>=-0.000001);return;
      }
      if(!live(i)){return;}
      let p=particles[i];let base=vec3i(floor(p.p.xyz));let w=weights(p.p.xyz-vec3f(base)-0.5);
      var v=vec3f(0);var C=mat3x3f(vec3f(0),vec3f(0),vec3f(0));
      for(var x=0;x<3;x++){for(var y=0;y<3;y++){for(var z=0;z<3;z++){
        let c=base+vec3i(x,y,z)-1;
        if(any(c<vec3i(0))||any(c>=vec3i(u.size.xyz))){continue;}
        let j=index(c);let wv=vec3f(dec(atomicLoad(&cells[j].x)),dec(atomicLoad(&cells[j].y)),dec(atomicLoad(&cells[j].z)))*w[x].x*w[y].y*w[z].z;
        let d=vec3f(c)+0.5-p.p.xyz;v+=wv;C+=mat3x3f(wv*d.x,wv*d.y,wv*d.z);
      }}}
      var q=p.p.xyz+v*u.clock.x;
      // The top is genuinely open. Escaped/drained particles are accounted for, never recycled.
      let throughGate=u.clock.z>0.0 && abs(q.x-u.size.x*0.5)<u.size.x*u.clock.z;
      if(q.y>u.size.y-1.1 || (q.y<1.0 && throughGate)){particles[i].p=vec4f(q,0);return;}
      if(q.x<2.0 && v.x<0.0){v.x=0.0;}if(q.x>u.size.x-2.0 && v.x>0.0){v.x=0.0;}
      if(q.z<2.0 && v.z<0.0){v.z=0.0;}if(q.z>u.size.z-2.0 && v.z>0.0){v.z=0.0;}
      q.x=clamp(q.x,2.0,u.size.x-2.0);q.z=clamp(q.z,2.0,u.size.z-2.0);
      let hole=u.clock.z>0.0 && abs(q.x-u.size.x*0.5)<u.size.x*u.clock.z;
      if(!hole){if(q.y<2.0 && v.y<0.0){v.y=0.0;}q.y=max(q.y,2.0);}
      // Prediction at a wall avoids particles sticking to it after a reversal.
      let next=q+v*u.clock.x*2.0;
      if(next.x<2.0){v.x+=2.0-next.x;} if(next.x>u.size.x-2.0){v.x+=u.size.x-2.0-next.x;}
      if(next.z<2.0){v.z+=2.0-next.z;} if(next.z>u.size.z-2.0){v.z+=u.size.z-2.0-next.z;}
      if(next.y<2.0 && !hole){v.y+=2.0-next.y;}
      // Retain 80% APIC affine detail; the small PIC share dissipates unresolved
      // sub-cell velocity noise while preserving the gathered bulk velocity.
      particles[i].p=vec4f(q,1);particles[i].v=vec4f(v,p.v.w);particles[i].C=3.2*C;
    }

    // Uniform PIC scalar exchange conserves material by partition of unity.
    // One pass per frame avoids adding these reads to every physical substep.
    @compute @workgroup_size(64) fn mixMaterial(@builtin(global_invocation_id) id:vec3u){
      let i=id.x;if(!live(i)){return;}let p=particles[i];let base=vec3i(floor(p.p.xyz));let w=weights(p.p.xyz-vec3f(base)-0.5);var mixed=0.0;
      for(var x=0;x<3;x++){for(var y=0;y<3;y++){for(var z=0;z<3;z++){
        let c=base+vec3i(x,y,z)-1;if(any(c<vec3i(0))||any(c>=vec3i(u.size.xyz))){continue;}
        let j=index(c);mixed+=w[x].x*w[y].y*w[z].z*dec(atomicLoad(&cells[j].cream))/max(dec(atomicLoad(&cells[j].m)),0.000001);
      }}}
      let exchange=1.0-exp(-mix(${MIX_RATE.toFixed(1)},${STIR_MIX_RATE.toFixed(1)},u.mouse.w)*u.push.z);
      particles[i].v.w=clamp(mix(p.v.w,mixed,exchange),0.0,1.0);
    }
  `;

  const QUAD = `
    struct Quad { @builtin(position) pos:vec4f, @location(0) uv:vec2f }
    @vertex fn quad(@builtin(vertex_index) i:u32)->Quad {
      let p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
      var o:Quad;o.pos=vec4f(p[i],0,1);o.uv=p[i]*vec2f(0.5,-0.5)+0.5;return o;
    }
  `;
  // Reconstruct a smooth scalar volume from the same momentum grid. Gradients
  // are filtered in 3D too; this avoids the beads and corrugated surface that a
  // row of extruded heights or independently shaded spheres would produce.
  const FIELD = COMMON + `
    @group(0) @binding(3) var field:texture_storage_3d<rgba16float,write>;
    @group(0) @binding(5) var creamField:texture_storage_3d<rgba16float,write>;
    @compute @workgroup_size(64) fn densityField(@builtin(global_invocation_id) id:vec3u) {
      let i=id.x;if(i>=u.counts.y){return;}let nz=u32(u.size.z);let ny=u32(u.size.y);
      let c=vec3i(vec3u(i/nz/ny,(i/nz)%ny,i%nz));
      let w=array<f32,3>(0.05,0.9,0.05);let grad=array<f32,3>(-0.5,0.0,0.5);
      var rho=0.0;var g=vec3f(0);var cream=0.0;var creamRho=0.0;
      // Filter concentration and its carrier with the same wider kernel.
      // This removes square colour cells without diffusing particle material.
      let cw=array<f32,3>(0.25,0.5,0.25);
      for(var x=0;x<3;x++){for(var y=0;y<3;y++){for(var z=0;z<3;z++){
        let p=c+vec3i(x,y,z)-1;var m=0.0;
        if(all(p>=vec3i(0)) && all(p<vec3i(u.size.xyz))){m=dec(atomicLoad(&cells[index(p)].m));}
        rho+=m*w[x]*w[y]*w[z];
        if(all(p>=vec3i(0)) && all(p<vec3i(u.size.xyz))){cream+=dec(atomicLoad(&cells[index(p)].cream))*cw[x]*cw[y]*cw[z];creamRho+=m*cw[x]*cw[y]*cw[z];}
        g+=m*vec3f(grad[x]*w[y]*w[z],w[x]*grad[y]*w[z],w[x]*w[y]*grad[z]);
      }}}
      textureStore(field,c,vec4f(g,rho));
      textureStore(creamField,c,vec4f(clamp(cream/max(creamRho,0.0001),0.0,1.0),0,0,0));
    }
  `;
  const CAMERA = `
    const DROP_RADIUS:f32 = ${(0.43*Math.cbrt(PARCEL_MASS)).toFixed(8)};
    const VIEW_SLOPE:f32 = ${CAMERA_SLOPE.toFixed(1)};
    const VIEW_RAY:vec3f = vec3f(0.0,-VIEW_SLOPE,1.0);
    fn projectedXY(p:vec3f)->vec2f {return vec2f(p.x,p.y+VIEW_SLOPE*p.z);}
    fn rayPoint(xy:vec2f,z:f32)->vec3f {return vec3f(xy.x,xy.y-VIEW_SLOPE*z,z);}
  `;
  const VOLUME = QUAD + CAMERA + `
    struct Params { size:vec4f, gravity:vec4f, mouse:vec4f, push:vec4f, counts:vec4u, view:vec4f, nozzle:vec4f, clock:vec4f }
    @group(0) @binding(0) var field:texture_3d<f32>;
    @group(0) @binding(1) var linear:sampler;
    @group(0) @binding(2) var<uniform> u:Params;
    @group(0) @binding(4) var<storage,read> jetProfile:array<vec4f>;
    @group(0) @binding(5) var creamField:texture_3d<f32>;
    fn creamAt(p:vec3f)->f32 {return clamp(cubicSample(creamField,p).x,0.0,1.0);}
    // Eight hardware-trilinear samples implement a cubic B-spline. Linear
    // interpolation alone leaves flat facets on a side-view silhouette.
    fn cubicSample(tex:texture_3d<f32>,p:vec3f)->vec4f {
      let q=p-0.5;let cell=floor(q);let f=q-cell;let f2=f*f;let f3=f2*f;
      let w0=(1.0-f)*(1.0-f)*(1.0-f)/6.0;
      let w1=(3.0*f3-6.0*f2+4.0)/6.0;
      let w2=(-3.0*f3+3.0*f2+3.0*f+1.0)/6.0;let w3=f3/6.0;
      let g0=w0+w1;let g1=w2+w3;
      let a=(cell-1.0+w1/g0+0.5)/u.size.xyz;
      let b=(cell+1.0+w3/g1+0.5)/u.size.xyz;
      let x00=mix(textureSampleLevel(tex,linear,vec3f(a.x,a.y,a.z),0.0),textureSampleLevel(tex,linear,vec3f(b.x,a.y,a.z),0.0),g1.x);
      let x10=mix(textureSampleLevel(tex,linear,vec3f(a.x,b.y,a.z),0.0),textureSampleLevel(tex,linear,vec3f(b.x,b.y,a.z),0.0),g1.x);
      let x01=mix(textureSampleLevel(tex,linear,vec3f(a.x,a.y,b.z),0.0),textureSampleLevel(tex,linear,vec3f(b.x,a.y,b.z),0.0),g1.x);
      let x11=mix(textureSampleLevel(tex,linear,vec3f(a.x,b.y,b.z),0.0),textureSampleLevel(tex,linear,vec3f(b.x,b.y,b.z),0.0),g1.x);
      return mix(mix(x00,x10,g1.y),mix(x01,x11,g1.y),g1.z);
    }
    fn density(p:vec3f)->vec4f {
      let sampled=cubicSample(field,p);
      // Exact free fall in air, then particles at the actual landing surface.
      // A jet narrower than a simulation cell must not be reconstructed as
      // a row of inflated blobs. Continuity: pi*r(y)^2*v(y) is constant.
      if(u.clock.w>0.5 && p.y>u.nozzle.y-1.25 && p.y<u.push.w){
        let radial=vec2f(p.x-u.nozzle.x,p.z-u.nozzle.z);let r=length(radial);
        let row=clamp(p.y*4.0,0.0,f32(arrayLength(&jetProfile)-2u));let i=u32(row);
        let radius=mix(jetProfile[i].x,jetProfile[i+1u].x,fract(row));
        if(radius<0.0001){return sampled;}
        let join=smoothstep(u.nozzle.y-1.25,u.nozzle.y-0.25,p.y);
        let jet=3.0*(1.0-smoothstep(max(0.0,radius-0.12),radius+0.12,r))*join;
        if(jet>0.0){
          let n=normalize(vec3f(radial.x,-0.02*radius,radial.y)+vec3f(0.00001,0,0));
          // Smooth union: adding the two densities made a swollen collar.
          // Extend into the actual pool so the jet has no chopped-off seam.
          let h=clamp(0.5+0.5*(jet-sampled.w)/0.65,0.0,1.0);
          return vec4f(mix(sampled.xyz,-n*jet,h),mix(sampled.w,jet,h)+0.65*h*(1.0-h));
        }
      }
      return sampled;
    }
    fn room(r:vec3f)->vec3f {
      var c=mix(vec3f(0.012,0.008,0.006),vec3f(0.26,0.25,0.24),smoothstep(-0.1,0.9,r.y));
      // Curved splash surfaces mirror the room behind the cup.
      // A light behind the viewer made almost every useful reflection vanish.
      let key=normalize(vec3f(-0.2,0.44,0.88));let fill=normalize(vec3f(0.7,0.6,-0.3));
      c+=vec3f(5.0,4.7,4.3)*pow(max(dot(r,key),0.0),65.0);
      c+=vec3f(2.0,2.1,2.3)*pow(max(dot(r,fill),0.0),80.0);
      let window=(1.0-smoothstep(0.16,0.19,abs(r.x+0.18)))*(1.0-smoothstep(0.08,0.11,abs(r.y-0.32)))*smoothstep(0.5,0.7,r.z);
      c+=vec3f(3.2,3.05,2.8)*window;
      return c;
    }
    struct Pixel { @location(0) color:vec4f, @builtin(frag_depth) depth:f32 }
    @fragment fn volume(in:Quad)->Pixel {
      let xy=vec2f(2.0+in.uv.x*(u.size.x-4.0),2.0+(1.0-in.uv.y)*(u.size.y-4.0));
      let ray=VIEW_RAY;
      var hit=false;var position=vec3f(0);var lastP=rayPoint(xy,0.0);
      var thickness=0.0;var milkThickness=0.0;var maximum=0.0;var strongest=lastP;
      // The whole shallow cup is only eight grid cells deep, irrespective of
      // screen resolution. No marching through a large invisible tub.
      for(var k=0;k<=32;k++){
        let z=f32(k)*0.25;let p=rayPoint(xy,z);
        let rho=density(p).w;
        thickness+=min(rho/3.0,1.0)*0.25;
        milkThickness+=min(rho/3.0,1.0)*textureSampleLevel(creamField,linear,p/u.size.xyz,0.0).x*0.25;
        if(rho>maximum){maximum=rho;strongest=p;}
        if(!hit && rho>0.8){
          var lo=lastP;var hi=p;
          for(var b=0;b<5;b++){let mid=(lo+hi)*0.5;if(density(mid).w>0.8){hi=mid;}else{lo=mid;}}
          position=(lo+hi)*0.5;hit=true;
        }lastP=p;
      }
      let aa=max(fwidth(maximum)*0.7,0.002);let alpha=smoothstep(0.8-aa,0.8+aa,maximum);
      var pixel:Pixel;pixel.color=vec4f(0);pixel.depth=1.0;
      if(alpha<=0.0){return pixel;}
      if(!hit){position=strongest;}
      let gradient=density(position).xyz;
      var n=normalize(-gradient+vec3f(0,0,-0.00001));
      if(dot(n,-ray)<0.0){n=-n;}
      // Sub-grid capillary normals, not displaced geometry or extra liquid.
      // omega² = g*k + sigma/rho*k³. Their strength follows measured motion.
      let point=position.xz*u.view.w;
      let k1=6.2831853/0.005;let k2=6.2831853/0.009;
      let w1=sqrt(9.81*k1+0.000072*k1*k1*k1);
      let w2=sqrt(9.81*k2+0.000072*k2*k2*k2);
      let ripples=vec2f(sin(dot(point,vec2f(0.9,0.435))*k1-w1*u.clock.y),sin(dot(point,vec2f(-0.6,0.8))*k2-w2*u.clock.y));
      let slope=(vec2f(0.9,0.435)*ripples.x+vec2f(-0.6,0.8)*ripples.y)*0.035*u.view.z*pow(max(n.y,0.0),3.0);
      n=normalize(n+vec3f(slope.x,0,slope.y));
      let cosT=clamp(dot(n,-ray),0.0,1.0);let F=0.02+0.98*pow(1.0-cosT,5.0);
      let mm=thickness*u.view.w*1000.0;
      let transmission=exp(-vec3f(0.32,0.66,1.05)*mm);
      let body=vec3f(0.0015,0.0008,0.0004)+vec3f(0.012,0.003,0.0007)*exp(-mm*0.6);
      var c=(1.0-F)*(body+transmission*vec3f(0.2,0.095,0.03))+F*room(reflect(ray,n));
      var cream=0.65*creamAt(position)+0.35*milkThickness/max(thickness,0.001);
      if(u.clock.w>0.5 && position.y>u.nozzle.y-0.5){
        let row=jetProfile[u32(clamp(position.y*4.0,0.0,f32(arrayLength(&jetProfile)-1u)))];
        let neck=smoothstep(u.nozzle.y-0.5,u.nozzle.y+0.6,position.y)*(1.0-smoothstep(row.x,row.x+0.2,abs(position.x-u.nozzle.x)));
        cream=max(cream,row.z*neck);
      }
      // Milk scatters warm light as well as absorbing it. The concentration
      // comes from advected liquid parcels, so a plume stays a plume.
      let milky=vec3f(2.2,1.95,1.6)*(0.7+0.3*max(n.y,0.0));
      c=mix(c,(1.0-F)*milky+F*room(reflect(ray,n)),1.0-exp(-cream*3.5));
      c=pow(c/(vec3f(1)+c),vec3f(1.0/2.2));
      pixel.color=vec4f(c*alpha,alpha);pixel.depth=clamp(position.z/u.size.z,0.0,1.0);return pixel;
    }
  `;

  // A detached parcel is smaller than the density grid's reconstruction
  // support. Render its own round surface, with the SAME depth/light/optics,
  // instead of making it vanish or inflating it into a marshmallow.
  const DROPS = VOLUME + `
    struct Particle { p:vec4f, v:vec4f, C:mat3x3f }
    @group(0) @binding(3) var<storage,read> particles:array<Particle>;
    @group(0) @binding(6) var<storage,read> dropIndices:array<u32>;
    struct Drop { @builtin(position) pos:vec4f, @location(0) disk:vec2f, @location(1) centre:vec3f, @location(2) cream:f32 }
    @vertex fn dropVertex(@builtin(vertex_index) vertex:u32,@builtin(instance_index) i:u32)->Drop {
      let particle=particles[dropIndices[i]];let p=particle.p;
      let corner=array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(-1,1),vec2f(1,-1),vec2f(1,1))[vertex];
      var out:Drop;out.disk=corner;out.centre=p.xyz;out.cream=particle.v.w;
      let xy=(projectedXY(p.xyz)-vec2f(2.0))/(u.size.xy-4.0);
      out.pos=vec4f(xy*2.0-1.0+corner*DROP_RADIUS*2.0/(u.size.xy-4.0),0,1);
      if(p.w<0.5 || density(p.xyz).w>0.65){out.pos=vec4f(3,3,0,1);}
      return out;
    }
    @fragment fn dropFragment(in:Drop)->Pixel {
      let r2=dot(in.disk,in.disk);if(r2>=1.0){discard;}
      let z=sqrt(1.0-r2);let n=normalize(vec3f(in.disk,-z));let ray=VIEW_RAY;
      let F=0.02+0.98*pow(1.0-clamp(dot(-ray,n),0.0,1.0),5.0);
      let mm=2.0*DROP_RADIUS*z*u.view.w*1000.0;
      let through=exp(-vec3f(0.32,0.66,1.05)*mm)*vec3f(0.2,0.095,0.03);
      var c=(1.0-F)*mix(through,vec3f(2.2,1.95,1.6),in.cream)+F*room(reflect(ray,n));c=pow(c/(1.0+c),vec3f(1.0/2.2));
      let alpha=1.0-smoothstep(1.0-max(fwidth(r2),0.01),1.0,r2);
      var out:Pixel;out.color=vec4f(c*alpha,alpha);out.depth=clamp((in.centre.z-DROP_RADIUS*z)/u.size.z,0.0,1.0);return out;
    }
  `;

  // Most parcels are inside an opaque cup. Build a conservative candidate list
  // once, rather than reconstructing density six times for every hidden parcel.
  const SELECT_DROPS = VOLUME + `
    struct Particle { p:vec4f, v:vec4f, C:mat3x3f }
    @group(0) @binding(3) var<storage,read> particles:array<Particle>;
    @group(0) @binding(6) var<storage,read_write> selected:array<u32>;
    @group(0) @binding(7) var<storage,read_write> args:array<atomic<u32>>;
    @group(0) @binding(8) var<storage,read_write> probe:array<f32>;
    fn poolDensity(y:f32)->f32 {
      let p=vec3f(u.nozzle.x,y,u.nozzle.z);
      // Measure the pool beside the impact, not the rising impact column itself.
      return min(cubicSample(field,p+vec3f(-2.0,0,0)).w,cubicSample(field,p+vec3f(2.0,0,0)).w);
    }
    @compute @workgroup_size(1) fn surfaceProbe(){
      probe[0]=2.0;
      for(var y=u.size.y-2.0;y>=2.0;y-=0.25){
        if(poolDensity(y)>0.8 && poolDensity(y-0.5)>1.0){
          var lo=y;var hi=y+0.25;
          for(var k=0;k<5;k++){let mid=(lo+hi)*0.5;if(poolDensity(mid)>0.8){lo=mid;}else{hi=mid;}}
          probe[0]=(lo+hi)*0.5;return;
        }
      }
    }
    @compute @workgroup_size(64) fn selectDrops(@builtin(global_invocation_id) id:vec3u){
      if(id.x>=u.counts.x){return;}let p=particles[id.x].p;
      if(p.w<0.5){return;}
      if(textureSampleLevel(field,linear,p.xyz/u.size.xyz,0.0).w>2.2){return;}
      let slot=atomicAdd(&args[1],1u);selected[slot]=id.x;
    }
  `;
  // Routine health checks reduce on the GPU: a few KB of group totals instead
  // of mapping megabytes and scanning every particle on the main thread.
  const SUMMARY = `
    struct Particle { p:vec4f, v:vec4f, C:mat3x3f }
    struct Bubble { p:vec4f, age:vec4f }
    @group(0) @binding(0) var<storage,read> particles:array<Particle>;
    @group(0) @binding(1) var<storage,read> bubbles:array<Bubble>;
    @group(0) @binding(2) var<storage,read_write> totals:array<vec4f>;
    @group(0) @binding(3) var<uniform> counts:vec4u;
    var<workgroup> liquid:array<vec4f,64>;
    var<workgroup> air:array<vec4f,64>;
    fn finite4(v:vec4f)->bool{return all(v==v)&&all(abs(v)<vec4f(3e37));}
    @compute @workgroup_size(64) fn summarize(@builtin(global_invocation_id) id:vec3u,@builtin(local_invocation_index) i:u32,@builtin(workgroup_id) group:vec3u){
      var a=vec4f(0);var b=vec4f(0);
      if(id.x<counts.x){
        let p=particles[id.x];let valid=finite4(p.p)&&finite4(p.v)&&finite4(vec4f(p.C[0],0))&&finite4(vec4f(p.C[1],0))&&finite4(vec4f(p.C[2],0));
        a.z=select(1.0,0.0,valid);
        if(p.p.w>0.5){a.x=1.0;a.w=p.v.w;if(valid){a.y=dot(p.v.xyz,p.v.xyz);}}
      }
      if(id.x<counts.y){let p=bubbles[id.x];b.x=select(0.0,1.0,p.p.w>0.0);b.z=select(1.0,0.0,finite4(p.p)&&finite4(p.age));}
      liquid[i]=a;air[i]=b;workgroupBarrier();
      for(var stride=32u;stride>0u;stride/=2u){if(i<stride){liquid[i]+=liquid[i+stride];air[i]+=air[i+stride];}workgroupBarrier();}
      if(i==0u){totals[group.x*2u]=liquid[0];totals[group.x*2u+1u]=air[0];}
    }
  `;

  // Entrained air is a small, bounded tracer set. It follows the liquid grid,
  // rises against gravity and pops on leaving the liquid; it adds no liquid.
  const AIR = COMMON + `
    struct Bubble { p:vec4f, age:vec4f }
    @group(0) @binding(3) var<storage,read_write> bubbles:array<Bubble>;
    @compute @workgroup_size(64) fn air(@builtin(global_invocation_id) id:vec3u){
      let i=id.x;if(i>=u.counts.w || bubbles[i].p.w<=0.0){return;}
      let b=bubbles[i];let base=vec3i(floor(b.p.xyz));let w=weights(b.p.xyz-vec3f(base)-0.5);
      var mass=0.0;var flow=vec3f(0);
      for(var x=0;x<3;x++){for(var y=0;y<3;y++){for(var z=0;z<3;z++){
        let c=base+vec3i(x,y,z)-1;if(any(c<vec3i(0))||any(c>=vec3i(u.size.xyz))){continue;}
        let cell=index(c);let weight=w[x].x*w[y].y*w[z].z;
        mass+=dec(atomicLoad(&cells[cell].m))*weight;
        flow+=vec3f(dec(atomicLoad(&cells[cell].x)),dec(atomicLoad(&cells[cell].y)),dec(atomicLoad(&cells[cell].z)))*weight;
      }}}
      let age=b.age.x+u.clock.x*u.gravity.w;
      let rise=0.055*u.gravity.w/u.view.w;
      let v=flow/max(mass,0.001)-normalize(u.gravity.xyz+vec3f(0,-0.00001,0))*rise;
      var q=b.p.xyz+v*u.clock.x;
      if((mass<0.4&&age>0.25)||age>4.0||q.y<2.0||q.y>u.size.y-2.0){bubbles[i].p.w=0.0;return;}
      q.x=clamp(q.x,2.1,u.size.x-2.1);q.z=clamp(q.z,2.1,u.size.z-2.1);
      bubbles[i].p=vec4f(q,b.p.w);bubbles[i].age.x=age;
    }
  `;
  const AIR_VIEW = VOLUME + `
    struct Bubble { p:vec4f, age:vec4f }
    @group(0) @binding(3) var<storage,read> bubbles:array<Bubble>;
    struct AirPixel { @builtin(position) pos:vec4f, @location(0) disk:vec2f, @location(1) centre:vec4f }
    @vertex fn airVertex(@builtin(vertex_index) v:u32,@builtin(instance_index) i:u32)->AirPixel{
      let b=bubbles[i].p;let corner=array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(-1,1),vec2f(1,-1),vec2f(1,1))[v];
      var out:AirPixel;out.disk=corner;out.centre=b;
      out.pos=vec4f((projectedXY(b.xyz)-vec2f(2))/(u.size.xy-4.0)*2.0-1.0+corner*b.w*2.0/(u.size.xy-4.0),0,1);
      if(b.w<=0.0){out.pos=vec4f(3,3,0,1);}return out;
    }
    @fragment fn airFragment(in:AirPixel)->@location(0) vec4f{
      let r=length(in.disk);if(r>=1.0){discard;}
      let liquid=smoothstep(0.35,1.0,density(in.centre.xyz).w);
      let rim=smoothstep(0.55,0.88,r)*(1.0-smoothstep(0.88,1.0,r));
      let glint=pow(max(0.0,1.0-length(in.disk-vec2f(-0.32,0.38))*3.2),3.0);
      let visibility=exp(-0.12*max(0.0,in.centre.z-2.0)*u.view.w*1000.0);
      let alpha=(0.12+0.55*rim+0.7*glint)*liquid*visibility;
      let c=mix(vec3f(0.055,0.025,0.012),vec3f(0.65,0.45,0.25),clamp(rim*0.65+glint,0.0,1.0));
      return vec4f(c*alpha,alpha);
    }
  `;

  function notice(message) {
    const el=document.createElement('div');el.setAttribute('role','status');
    el.textContent=message;el.style.cssText='position:fixed;bottom:28px;left:20px;right:20px;z-index:2147483646;background:#18130e;color:#fff1da;padding:14px;font:14px/1.5 monospace;pointer-events:none';
    document.body.appendChild(el);setTimeout(()=>el.remove(),7000);
  }

  async function makeGPU(canvas, dims) {
    if (!root.navigator?.gpu) throw new Error('This browser cannot run coffee3. Try a current Safari, Chrome or Edge with WebGPU.');
    const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
    if(!adapter)throw new Error('coffee3 could not access the graphics processor.');
    const device=await adapter.requestDevice();
    try {
    const errors=[];device.addEventListener('uncapturederror',e=>{errors.push(e.error.message);console.error('coffee3:',e.error.message);});
    const context=canvas.getContext('webgpu');if(!context){device.destroy();throw new Error('coffee3 could not create its canvas.');}
    const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'premultiplied'});
    const owned=[];
    const buffer=(label,size,usage)=>{const b=device.createBuffer({label,size,usage});owned.push(b);return b;};
    const U=GPUBufferUsage;const particle=buffer('coffee3 particles',dims.capacity*80,U.STORAGE|U.COPY_DST|U.COPY_SRC);
    const grid=buffer('coffee3 momentum and cream grid',dims.nx*dims.ny*dims.nz*20,U.STORAGE|U.COPY_DST);
    const bubbles=buffer('coffee3 entrained air',BUBBLES*32,U.STORAGE|U.COPY_DST|U.COPY_SRC);
    const jet=buffer('coffee3 ballistic stream profile',(dims.ny+4)*4*16,U.STORAGE|U.COPY_DST);
    const uniform=buffer('coffee3 parameters',128,U.UNIFORM|U.COPY_DST);
    const probe=buffer('coffee3 landing surface',16,U.STORAGE|U.COPY_SRC);
    const dropList=buffer('coffee3 visible drop candidates',dims.capacity*4,U.STORAGE);
    const dropArgs=buffer('coffee3 indirect drop draw',16,U.STORAGE|U.INDIRECT|U.COPY_DST);
    device.queue.writeBuffer(dropArgs,0,new Uint32Array([6,0,0,0]));
    const summaryTotals=buffer('coffee3 compact health totals',Math.ceil(Math.max(dims.capacity,BUBBLES)/64)*32,U.STORAGE|U.COPY_SRC);
    const summaryCounts=buffer('coffee3 summary counts',16,U.UNIFORM|U.COPY_DST);
    const module=async(label,code)=>{
      const m=device.createShaderModule({label,code});const info=await m.getCompilationInfo();
      const bad=info.messages.filter(x=>x.type==='error');if(bad.length)throw new Error(label+': '+bad.map(x=>x.message).join('; '));return m;
    };
    device.pushErrorScope('validation');
    const compute=await module('coffee3 MLS-MPM',COMPUTE);
    const fieldModule=await module('coffee3 density reconstruction',FIELD);
    const optics=await module('coffee3 volume optics',VOLUME);
    const drops=await module('coffee3 detached drops',DROPS);
    const air=await module('coffee3 entrained air motion',AIR);
    const airView=await module('coffee3 bubble optics',AIR_VIEW);
    const selectModule=await module('coffee3 drop culling',SELECT_DROPS);
    const summaryModule=await module('coffee3 health reduction',SUMMARY);
    const summaryPipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:summaryModule,entryPoint:'summarize'}});
    const summaryGroup=device.createBindGroup({layout:summaryPipeline.getBindGroupLayout(0),entries:[particle,bubbles,summaryTotals,summaryCounts].map((b,binding)=>({binding,resource:{buffer:b}}))});
    const airStep=await device.createComputePipelineAsync({layout:'auto',compute:{module:air,entryPoint:'air'}});
    const airGroup=device.createBindGroup({layout:airStep.getBindGroupLayout(0),entries:[{binding:1,resource:{buffer:grid}},{binding:2,resource:{buffer:uniform}},{binding:3,resource:{buffer:bubbles}}]});
    const stages={};
    for(const name of ['clear','scatter','pressure','forces','gather','mixMaterial']){
      const pipeline=await device.createComputePipelineAsync({label:'coffee3 '+name,layout:'auto',compute:{module:compute,entryPoint:name}});
      // Auto layouts omit bindings unused by this entry point.
      const ids=name==='clear'?[1,2]:name==='forces'?[1,2]:[0,1,2];
      const resources=[particle,grid,uniform];
      stages[name]={pipeline,group:device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:ids.map(binding=>({binding,resource:{buffer:resources[binding]}}))})};
    }
    const fieldTexture=device.createTexture({label:'coffee3 3D density',dimension:'3d',size:[dims.nx,dims.ny,dims.nz],format:'rgba16float',usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});
    const fieldView=fieldTexture.createView();
    const creamTexture=device.createTexture({label:'coffee3 advected cream',dimension:'3d',size:[dims.nx,dims.ny,dims.nz],format:'rgba16float',usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});
    const creamView=creamTexture.createView();
    const fieldPipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:fieldModule,entryPoint:'densityField'}});
    const fieldGroup=device.createBindGroup({layout:fieldPipeline.getBindGroupLayout(0),entries:[{binding:1,resource:{buffer:grid}},{binding:2,resource:{buffer:uniform}},{binding:3,resource:fieldView},{binding:5,resource:creamView}]});
    const depthState={format:'depth24plus',depthWriteEnabled:true,depthCompare:'less-equal'};
    const shadePipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:optics,entryPoint:'quad'},fragment:{module:optics,entryPoint:'volume',targets:[{format}]},primitive:{topology:'triangle-list'},depthStencil:depthState});
    const dropPipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:drops,entryPoint:'dropVertex'},fragment:{module:drops,entryPoint:'dropFragment',targets:[{format,blend:{color:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'}}}]},primitive:{topology:'triangle-list'},depthStencil:depthState});
    const bubblePipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:airView,entryPoint:'airVertex'},fragment:{module:airView,entryPoint:'airFragment',targets:[{format,blend:{color:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'}}}]},primitive:{topology:'triangle-list'},depthStencil:{...depthState,depthWriteEnabled:false,depthCompare:'always'}});
    const sampler=device.createSampler({minFilter:'linear',magFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge',addressModeW:'clamp-to-edge'});
    const probePipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:selectModule,entryPoint:'surfaceProbe'}});
    const probeGroup=device.createBindGroup({layout:probePipeline.getBindGroupLayout(0),entries:[{binding:0,resource:fieldView},{binding:1,resource:sampler},{binding:2,resource:{buffer:uniform}},{binding:8,resource:{buffer:probe}}]});
    const imageEntries=[{binding:0,resource:fieldView},{binding:1,resource:sampler},{binding:2,resource:{buffer:uniform}},{binding:4,resource:{buffer:jet}}];
    const shadeGroup=device.createBindGroup({layout:shadePipeline.getBindGroupLayout(0),entries:[...imageEntries,{binding:5,resource:creamView}]});
    const dropGroup=device.createBindGroup({layout:dropPipeline.getBindGroupLayout(0),entries:[...imageEntries,{binding:3,resource:{buffer:particle}},{binding:6,resource:{buffer:dropList}}]});
    const selectPipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:selectModule,entryPoint:'selectDrops'}});
    const selectGroup=device.createBindGroup({layout:selectPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:fieldView},{binding:1,resource:sampler},{binding:2,resource:{buffer:uniform}},{binding:3,resource:{buffer:particle}},{binding:6,resource:{buffer:dropList}},{binding:7,resource:{buffer:dropArgs}}]});
    const bubbleGroup=device.createBindGroup({layout:bubblePipeline.getBindGroupLayout(0),entries:[...imageEntries,{binding:3,resource:{buffer:bubbles}}]});
    const validation=await device.popErrorScope();if(validation){device.destroy();throw new Error(validation.message);}
    let depthTexture,depthView;
    function resize(w,h){canvas.width=w;canvas.height=h;depthTexture?.destroy();depthTexture=device.createTexture({size:[w,h],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});depthView=depthTexture.createView();}
    function draw(encoder,count,measure){
      encoder.clearBuffer(dropArgs,4,12);
      // Rebuild mass after the final advection, so the visible surface is this
      // frame's liquid, not the previous step's position or pressure grid.
      let p=encoder.beginComputePass();
      for(const name of ['clear','scatter']){
        const stage=stages[name];p.setPipeline(stage.pipeline);p.setBindGroup(0,stage.group);
        p.dispatchWorkgroups(Math.ceil((name==='clear'?dims.nx*dims.ny*dims.nz:count)/64));
      }
      p.setPipeline(stages.mixMaterial.pipeline);p.setBindGroup(0,stages.mixMaterial.group);p.dispatchWorkgroups(Math.ceil(count/64));
      p.setPipeline(fieldPipeline);p.setBindGroup(0,fieldGroup);p.dispatchWorkgroups(Math.ceil(dims.nx*dims.ny*dims.nz/64));
      p.end();
      p=encoder.beginComputePass();
      if(measure){p.setPipeline(probePipeline);p.setBindGroup(0,probeGroup);p.dispatchWorkgroups(1);}
      p.setPipeline(selectPipeline);p.setBindGroup(0,selectGroup);p.dispatchWorkgroups(Math.ceil(count/64));p.end();
      p=encoder.beginRenderPass({colorAttachments:[{view:context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:0}}],depthStencilAttachment:{view:depthView,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});
      p.setPipeline(shadePipeline);p.setBindGroup(0,shadeGroup);p.draw(3);
      p.setPipeline(dropPipeline);p.setBindGroup(0,dropGroup);p.drawIndirect(dropArgs,0);
      p.setPipeline(bubblePipeline);p.setBindGroup(0,bubbleGroup);p.draw(6,BUBBLES);p.end();
      if(measure){const read=device.createBuffer({size:16,usage:U.COPY_DST|U.MAP_READ});encoder.copyBufferToBuffer(probe,0,read,0,16);return read;}
    }
    function step(encoder,count,steps){
      const p=encoder.beginComputePass();
      for(let n=0;n<steps;n++){for(const name of ['clear','scatter','pressure','forces','gather']){
        const s=stages[name];p.setPipeline(s.pipeline);p.setBindGroup(0,s.group);
        p.dispatchWorkgroups(Math.ceil((name==='clear'||name==='forces'?dims.nx*dims.ny*dims.nz:count)/64));
      }
      p.setPipeline(airStep);p.setBindGroup(0,airGroup);p.dispatchWorkgroups(Math.ceil(BUBBLES/64));}p.end();
    }
    async function audit(count){
      const offset=Math.max(80,count*80);
      const read=device.createBuffer({size:offset+BUBBLES*32,usage:U.COPY_DST|U.MAP_READ});
      try{
        const e=device.createCommandEncoder();e.copyBufferToBuffer(particle,0,read,0,offset);e.copyBufferToBuffer(bubbles,0,read,offset,BUBBLES*32);device.queue.submit([e.finish()]);
        await read.mapAsync(GPUMapMode.READ);const data=new Float32Array(read.getMappedRange());
        let alive=0,outTop=0,outFloor=0,pending=0,creamAlive=0,creamSquared=0,creamY=0,bubbleAlive=0,finite=true,energy=0,meanX=0,meanY=0,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
        for(let i=0;i<count;i++){
          const k=i*20;for(let j=0;j<20;j++)if(!Number.isFinite(data[k+j]))finite=false;
          if(data[k+3]<0.5){if(data[k+3]<0)pending++;else if(data[k+1]<1)outFloor++;else outTop++;continue;}alive++;meanX+=data[k];meanY+=data[k+1];
          creamAlive+=data[k+7];creamSquared+=data[k+7]**2;creamY+=data[k+7]*data[k+1];
          minY=Math.min(minY,data[k+1]);maxY=Math.max(maxY,data[k+1]);minZ=Math.min(minZ,data[k+2]);maxZ=Math.max(maxZ,data[k+2]);
          energy+=data[k+4]**2+data[k+5]**2+data[k+6]**2;
        }
        for(let i=offset/4;i<data.length;i+=8){for(let j=0;j<8;j++)if(!Number.isFinite(data[i+j]))finite=false;if(data[i+3]>0)bubbleAlive++;}
        return {alive,outTop,outFloor,pending,creamAlive,creamVariance:creamSquared/Math.max(1,alive)-(creamAlive/Math.max(1,alive))**2,creamY:creamY/Math.max(1,creamAlive),bubbleAlive,emitted:count,lost:count-alive,finite,meanX:meanX/Math.max(1,alive),meanY:meanY/Math.max(1,alive),minY,maxY,minZ,maxZ,rmsSpeed:Math.sqrt(energy/Math.max(1,alive)),errors:[...errors]};
      }finally{read.destroy();}
    }
    async function summarize(count){
      const groups=Math.ceil(Math.max(count,BUBBLES)/64),size=groups*32;
      const read=device.createBuffer({size,usage:U.COPY_DST|U.MAP_READ});
      try{
        device.queue.writeBuffer(summaryCounts,0,new Uint32Array([count,BUBBLES,0,0]));
        const encoder=device.createCommandEncoder(),p=encoder.beginComputePass();
        p.setPipeline(summaryPipeline);p.setBindGroup(0,summaryGroup);p.dispatchWorkgroups(groups);p.end();
        encoder.copyBufferToBuffer(summaryTotals,0,read,0,size);device.queue.submit([encoder.finish()]);
        await read.mapAsync(GPUMapMode.READ);const data=new Float32Array(read.getMappedRange());
        let alive=0,energy=0,bad=0,creamAlive=0,bubbleAlive=0;
        for(let i=0;i<data.length;i+=8){alive+=data[i];energy+=data[i+1];bad+=data[i+2]+data[i+6];creamAlive+=data[i+3];bubbleAlive+=data[i+4];}
        return {alive,creamAlive,bubbleAlive,finite:bad===0&&Number.isFinite(energy),emitted:count,lost:count-alive,rmsSpeed:Math.sqrt(energy/Math.max(1,alive)),readbackBytes:size,errors:[...errors]};
      }finally{read.destroy();}
    }
    async function surface(read){try{await read.mapAsync(GPUMapMode.READ);return new Float32Array(read.getMappedRange())[0];}finally{read.destroy();}}
    return {device,particle,bubbles,jet,uniform,errors,resize,draw,step,audit,summarize,surface,destroy(){depthTexture?.destroy();fieldTexture.destroy();creamTexture.destroy();for(const b of owned)b.destroy();context.unconfigure();device.destroy();}};
    } catch(error) { device.destroy(); throw error; }
  }

  async function pour(options={}){
    if(current||starting)return;starting=true;lastRun=null;
    const phone=typeof options.phone==='boolean'?options.phone:matchMedia('(pointer: coarse)').matches;
    // Reduced motion is a static cup, no compute work or moving highlights.
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){
      const cup=document.createElement('div');cup.dataset.coffee='3';cup.setAttribute('aria-hidden','true');
      cup.style.cssText='position:fixed;inset:25% 0 0;z-index:2147483645;pointer-events:none;background:linear-gradient(#382013 0,#130904 5%,#100704 100%);border-top:2px solid #7b6250';
      let timer,release;const still={stop(){cup.remove();release?.();clearTimeout(timer);if(current===still)current=null;}};
      document.body.appendChild(cup);release=freezePage(cup);current=still;starting=false;
      timer=setTimeout(()=>still.stop(),phone?40*60*1000:5000);return;
    }
    const canvas=document.createElement('canvas');canvas.dataset.coffee='3';canvas.setAttribute('aria-hidden','true');
    canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:2147483645;pointer-events:auto;touch-action:none';
    document.body.appendChild(canvas);let gpu,releasePage;
    try{
      const W=innerWidth,H=innerHeight,d=dimensions(W,H,phone);gpu=await makeGPU(canvas,d);
      releasePage=freezePage(canvas);
      const abort=new AbortController(),signal=abort.signal;
      let stopped=false,raf=0,busy=false,holdTimer=0,last=performance.now(),elapsed=0,frameSeconds=0,accumulator=0,count=0,emitted=0,fullAt=-1,draining=false,drainAt=-1;
      const births=[];let landing=2,lastSurface=0,rippleEnergy=0.1,bubbleEmission=0,bubbleIndex=0,bubblesBorn=0,creamStart=-1,phase='coffee';
      const coffee={start:START_DELAY,ramp:RAMP_SECONDS,speed:d.speed,radius:d.radius,limit:d.target,base:0,cream:0,x:2+d.inner*0.57};
      let source=coffee;
      const profile=new Float32Array((d.ny+4)*4*4);
      let tilt=[0,-1,0],targetTilt=[0,-1,0],pointer=false,tipping=false,mouse=[-100,-100],push=[0,0],lastPointer=0;
      let stepDt=0.05;
      let sleeping=false,quiet=0,lastAudit=0,lastSensor=0,lastMotion=0,orientationReference=null,motionVotes=0,frameMs=0,holdUntil=Infinity;
      const hold=Number.isFinite(options.holdSeconds)?Math.max(0,options.holdSeconds):(phone?40*60:5);
      const debug=/coffeedebug/.test(location.search);let hud;
      if(debug){hud=document.createElement('output');hud.dataset.coffee3Hud='';hud.style.cssText='position:fixed;top:8px;left:8px;z-index:2147483646;background:#0b0908e8;color:#fff2d9;padding:9px;font:12px/1.45 monospace;white-space:pre;pointer-events:none';document.body.appendChild(hud);}
      const params=new ArrayBuffer(128),f=new Float32Array(params),ints=new Uint32Array(params);
      const resolution=()=>{const scale=Math.min(devicePixelRatio||1,1.5,1000/innerWidth,1100/innerHeight);gpu.resize(Math.max(1,Math.round(innerWidth*scale)),Math.max(1,Math.round(innerHeight*scale)));};resolution();
      function wake(){
        quiet=0;
        if(sleeping){sleeping=false;last=performance.now();accumulator=0;}
        if(!raf&&!busy&&!document.hidden&&!stopped){last=performance.now();raf=requestAnimationFrame(frame);}
      }
      function stop(){if(stopped)return;stopped=true;cancelAnimationFrame(raf);clearTimeout(holdTimer);abort.abort();canvas.remove();hud?.remove();releasePage?.();gpu.destroy();if(current?.canvas===canvas)current=null;}
      function writeParams(){
        // Open the floor gate across the whole cup in 0.4 s. A permanently
        // narrow hole stranded two pools once they became shallower than a cell.
        const opening=draining?drainOpening(elapsed-drainAt):0;
        f.set([d.nx,d.ny,d.nz,d.viscosity],0);f.set([tilt[0]*0.4,tilt[1]*0.4,tilt[2]*0.4,d.timeUnit],4);
        f.set([mouse[0],mouse[1],Math.max(1,0.006/d.metresPerCell),pointer&&!tipping?1:0],8);f.set([push[0],push[1],frameSeconds,d.ny+2],12);
        ints.set([count,d.nx*d.ny*d.nz,d.target+d.creamTarget,BUBBLES],16);
        f.set([canvas.width,canvas.height,rippleEnergy,d.metresPerCell],20);
        f.set([source.x,landing,d.nz*0.5,source.radius],24);f.set([stepDt,elapsed,opening,emitted>count?1:0],28);
        profile.fill(0);
        for(let i=0;emitted>count&&i<profile.length/4;i++){
          const s=streamAt(d,source,i/4,elapsed),k=i*4;
          profile[k]=s.radius;profile[k+1]=s.speed;profile[k+2]=s.cream;profile[k+3]=0;
        }
        gpu.device.queue.writeBuffer(gpu.jet,0,profile);
        gpu.device.queue.writeBuffer(gpu.uniform,0,params);
      }
      function spawn(seconds){
        if(!draining&&source.cream===0&&count===d.target){
          if(creamStart<0){creamStart=elapsed+0.65;phase='pause';}
          if(elapsed>=creamStart){
            source={start:creamStart,ramp:0.25,speed:d.speed*0.65,radius:d.radius*0.95,limit:d.creamTarget,base:d.target,cream:1,x:2+d.inner*0.43};phase='cream';
          }
        }
        if(!draining&&emitted-source.base<source.limit){
          const flow=Math.PI*source.radius**2*source.speed*REST/(d.timeUnit*PARCEL_MASS);
          const wanted=Math.min(source.limit,Math.floor(flow*openTime(elapsed-source.start,source.ramp)));
          for(let i=emitted-source.base;i<wanted;i++){
            let lo=source.start,hi=elapsed;
            for(let k=0;k<18;k++){const mid=(lo+hi)/2;if(flow*openTime(mid-source.start,source.ramp)<i+1)lo=mid;else hi=mid;}
            births.push({at:(lo+hi)/2,source});
          }
          emitted=Math.max(emitted,source.base+wanted);
          if(wanted===source.limit&&source.end==null)source.end=births[emitted-1].at;
        }
        const before=count;
        while(count<emitted){
          const birth=births[count],age=(elapsed-birth.at)/d.timeUnit;
          const v0=birth.source.speed*opening(birth.at-birth.source.start,birth.source.ramp);
          const y=d.ny+2-v0*age-0.2*age*age;
          if(y>landing+0.2)break;count++;
        }
        const n=count-before;if(n<=0)return;
        const data=new Float32Array(n*20);
        // Every analytical parcel becomes exactly one GPU particle when it lands.
        // Its position, speed and narrowed radius follow the same free fall.
        for(let j=0;j<n;j++){
          const id=before+j,birth=births[id],s=birth.source;
          const v0=s.speed*opening(birth.at-s.start,s.ramp);
          const jet=jetAt(d,landing+0.2,v0,s.radius),impact=jet.speed;
          const angle=id*2.39996323,r=jet.radius*Math.sqrt((id*0.618033989)%1);
          const k=j*20;data[k]=s.x+Math.cos(angle)*r;
          data[k+1]=Math.max(2.05,landing+0.2);
          const arrival=birth.at+jet.fallSeconds;
          const wait=clamp(arrival-(elapsed-seconds),0,Math.max(0,seconds-stepDt*d.timeUnit));
          data[k+2]=d.nz*0.5+Math.sin(angle)*r;data[k+3]=wait>0?-wait:1;data[k+5]=-impact;data[k+7]=s.cream;
        }
        gpu.device.queue.writeBuffer(gpu.particle,before*80,data);
        bubbleEmission+=n/(d.target/100);
        while(bubbleEmission>=1){
          bubbleEmission--;const id=bubblesBorn++,b=new Float32Array(8),a=id*2.39996323;
          b.set([source.x+Math.cos(a)*source.radius*1.8,Math.max(2.2,landing-0.7-(id%4)*0.18),2.25+(id%5)*0.2,(0.0003+(id%5)*0.00012)/d.metresPerCell]);
          gpu.device.queue.writeBuffer(gpu.bubbles,(bubbleIndex++%BUBBLES)*32,b);
        }
        if(source.cream&&count===d.target+d.creamTarget&&fullAt<0){phase='holding';fullAt=elapsed;holdUntil=performance.now()+hold*1000;holdTimer=setTimeout(()=>{if(!stopped){draining=true;wake();}},hold*1000);}
      }
      function orient(e){
        if(e.beta==null||e.gamma==null)return;
        const next=orientationGravity(e.beta,e.gamma,screen.orientation?.angle??root.orientation??0);
        orientationReference=next;lastSensor=performance.now();
        if(lastSensor-lastMotion>250){const changed=next.some((v,i)=>Math.abs(v-targetTilt[i])>0.025);targetTilt=next;if(changed)wake();}
      }
      // Orientation supplies a platform-independent sign reference. Motion adds
      // shakes; Apple assumes the reversed sign until a reference is available.
      let motionSign=/iPhone|iPad|iPod/.test(navigator.userAgent)?-1:1;
      function motion(e){
        const g=e.accelerationIncludingGravity;if(g?.x==null||g?.y==null)return;
        const raw=accelerationGravity(g.x,g.y,g.z||0,screen.orientation?.angle??root.orientation??0);
        lastMotion=performance.now();
        if(orientationReference&&lastMotion-lastSensor<1000){
          const dot=raw.reduce((s,v,i)=>s+v*orientationReference[i],0);
          if(Math.abs(dot)>0.5)motionVotes=clamp(motionVotes+(dot>0?1:-1),-20,20);
          if(motionVotes>=5)motionSign=1;else if(motionVotes<=-5)motionSign=-1;
        }
        const next=motionResponse(raw.map(v=>clamp(v*motionSign,-3,3)),lastMotion-lastSensor<1000?orientationReference:null);
        const changed=next.some((v,i)=>Math.abs(v-targetTilt[i])>0.035);targetTilt=next;if(changed)wake();
      }
      function move(e){
        if(!pointer)return;
        const x=2+e.clientX/innerWidth*(d.nx-4),y=2+(1-e.clientY/innerHeight)*(d.ny-4);
        const now=performance.now(),dt=Math.max(0.01,(now-lastPointer)/1000);
        tipping=e.altKey;
        if(e.altKey){targetTilt=[(e.clientX/innerWidth-0.5)*1.8,-1,0];}
        else{push=stirVelocity(x-mouse[0],y-mouse[1],dt,d);}
        mouse=[x,y];lastPointer=now;wake();
      }
      addEventListener('pointerdown',e=>{pointer=true;tipping=e.altKey;mouse=[2+e.clientX/innerWidth*(d.nx-4),2+(1-e.clientY/innerHeight)*(d.ny-4)];lastPointer=performance.now();wake();},{signal,passive:true});
      addEventListener('pointermove',move,{signal,passive:true});
      addEventListener('pointerup',()=>{pointer=false;tipping=false;push=[0,0];},{signal,passive:true});
      addEventListener('pointercancel',()=>{pointer=false;tipping=false;push=[0,0];},{signal,passive:true});
      addEventListener('deviceorientation',orient,{signal,passive:true});addEventListener('devicemotion',motion,{signal,passive:true});
      addEventListener('resize',()=>{resolution();wake();},{signal,passive:true});
      document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{last=performance.now();wake();}},{signal});
      gpu.device.lost.then(info=>{if(!stopped){stop();notice('coffee3 paused because the graphics device was lost. Type coffee3 to pour again.');console.warn('coffee3 device lost:',info.message);}});
      async function frame(now){
        raf=0;if(stopped||document.hidden||busy)return;busy=true;
        try{
          const wall=clamp((now-last)/1000,0,0.05);last=now;
          const smoothing=1-Math.exp(-wall/0.06);tilt=tilt.map((v,i)=>v+(targetTilt[i]-v)*smoothing);
          // Fast impacts and drainage need a tighter CFL step than a quiet pool.
          stepDt=fullAt<0||draining||pointer||Math.hypot(tilt[0],tilt[1]+1,tilt[2])>0.1?0.05:DT;
          const physicalStep=stepDt*d.timeUnit,budget=Math.min(128,Math.ceil(0.05/physicalStep));accumulator=Math.min(accumulator+wall,physicalStep*budget);
          if(now>=holdUntil){draining=true;sleeping=false;}
          if(draining&&drainAt<0){drainAt=elapsed;source.end=births[emitted-1]?.at??source.start;phase='draining';}
          if(draining&&emitted===0){lastRun={alive:0,emitted:0,lost:0,inFlight:0,finite:true,errors:[]};stop();return;}
          const encoder=gpu.device.createCommandEncoder();
          const steps=sleeping?0:Math.min(budget,Math.floor(accumulator/physicalStep));
          frameSeconds=steps*physicalStep;elapsed+=frameSeconds;spawn(frameSeconds);writeParams();
          // One uniform snapshot and one continuous nozzle segment per frame.
          // Every substep reads the same particle count, never a future emission.
          if(steps)gpu.step(encoder,count,steps);
          accumulator-=steps*physicalStep;
          const probe=gpu.draw(encoder,count,emitted>count&&now-lastSurface>25);gpu.device.queue.submit([encoder.finish()]);
          await gpu.device.queue.onSubmittedWorkDone();
          if(stopped){probe?.destroy();return;}
          if(probe){landing=await gpu.surface(probe);lastSurface=now;if(stopped)return;}
          frameMs=frameMs*0.9+(performance.now()-now)*0.1;
          if(now-lastAudit>1500 && count>0){
            lastAudit=now;const book=await gpu.summarize(count);if(stopped)return;
            if(!book.finite||gpu.errors.length)throw new Error('coffee3 GPU validation failed.');
            const speed=book.rmsSpeed*d.metresPerCell/d.timeUnit;
            rippleEnergy=clamp(speed/0.15,0,1);
            // At this coarse grid, residual sub-cell pressure noise is below the
            // rest tolerance. Sleep after four quiet seconds; any input wakes it.
            if(fullAt>=0&&!draining&&!pointer&&speed<0.018)quiet+=1.5;else quiet=0;
            if(quiet>=4&&book.bubbleAlive===0)sleeping=true;
            if(hud)hud.textContent=`coffee3 · live 3D · ${frameMs.toFixed(1)} ms/frame work\n${book.alive.toLocaleString()} in cup · ${book.lost.toLocaleString()} out · ${emitted-count} falling\n${emitted.toLocaleString()} poured · ${phase} · ${book.creamAlive.toFixed(1)} cream · ${book.bubbleAlive} bubbles\n${(speed*1000).toFixed(1)} mm/s · ${sleeping?'sleeping':draining?'draining':'running'}`;
            if(draining&&book.alive===0&&emitted===count){lastRun={...book,emitted,inFlight:0,elapsed};stop();return;}
          }
          push=push.map(v=>v*0.75);
          if(sleeping)accumulator=0;
        }catch(error){if(stopped)return;stop();console.error(error);notice('coffee3 could not keep running on this graphics device.');}
        finally{busy=false;if(!stopped&&!sleeping&&!document.hidden&&!raf)raf=requestAnimationFrame(frame);}
      }
      current={canvas,stop,dims:d,async audit(compact=false){const snapshot={count,emitted};const book=await (compact?gpu.summarize(snapshot.count):gpu.audit(snapshot.count));return{...book,emitted:snapshot.emitted,inFlight:snapshot.emitted-snapshot.count};},drain(){holdUntil=performance.now();wake();},tilt(x,y,z=0){targetTilt=[x,y,z];wake();},get state(){return{count,emitted,elapsed,fullAt,phase,creamStart,bubblesBorn,draining,sleeping,frameMs,errors:[...gpu.errors]};}};
      starting=false;raf=requestAnimationFrame(frame);
    }catch(error){releasePage?.();gpu?.destroy();canvas.remove();starting=false;console.error(error);
      notice(error.message.length<180?error.message:'coffee3 could not initialise on this graphics device.');}
  }
  root.RELAY_COFFEE3={pour,dimensions,jetAt,parcelAt,streamAt,opening,openTime,START_DELAY,RAMP_SECONDS,drainOpening,projectPoint,stirVelocity,motionResponse,freezePage,orientationGravity,accelerationGravity,get active(){return current;},get lastRun(){return lastRun;}};
})(typeof window==='undefined'?globalThis:window);
