/* coffee3 — live, shallow 3D coffee, 2026-11-27.
   Ric: "a horizontal view ... so it should be simpler"; "make it as coffee3".
   No video, library, build step or network assets. MLS-MPM on WebGPU;
   particles become a continuous surface by tracing their 3D density field.
   The transfer equations are adapted from matsuoka-601/Splash (MIT), which
   credits Hu et al. and nialltl. Full credit/licence: coffee3-LICENSE.txt.
   The fixed camera is orthographic with a small downward viewing angle.
   This is weakly compressible liquid, not an offline incompressible solve.
   Lighting, nozzle size and unresolved detail remain visual/model choices.
   The simulation uses actual 9.81 m/s² at the estimated screen size.
   One grid cell = metresPerCell; one simulation time unit = timeUnit seconds.
   GPU time is bounded: a slow device loses elapsed time, never enlarges dt. */
(function (root) {
  'use strict';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const REST = 3, DT = 0.08;
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
    const speed = 0.6 * timeUnit / metresPerCell;
    const flow = Math.PI * radius * radius * speed * REST;
    const target = Math.floor(inner * (ny - 4) * (nz - 4) * 0.75 * REST);
    const viscosity = REST * 0.8e-6 * timeUnit / (metresPerCell * metresPerCell);
    return { nx, ny, nz, inner, metresPerCell, timeUnit, radius, speed, flow, target, viscosity,
      fillSeconds: target / flow * timeUnit, capacity: target + 512 };
  }

  function jetAt(d,y){
    const fall=Math.max(0,d.ny+2-y);
    const speed=Math.sqrt(d.speed*d.speed+0.8*fall);
    return {speed,radius:d.radius*Math.sqrt(d.speed/speed),fallSeconds:(speed-d.speed)/0.4*d.timeUnit};
  }
  const drainOpening=seconds=>0.12+0.4*clamp(seconds/0.4,0,1);

  // Shared bindings avoid per-substep allocations. Dispatch boundaries are
  // the memory barriers between mass scatter, pressure scatter and gather.
  const COMMON = `
    struct Particle { p: vec4f, v: vec4f, C: mat3x3f }
    struct Cell { x: atomic<i32>, y: atomic<i32>, z: atomic<i32>, m: atomic<i32> }
    struct Params {
      size: vec4f, gravity: vec4f, mouse: vec4f, push: vec4f,
      counts: vec4u, view: vec4f, nozzle: vec4f, clock: vec4f
    }
    @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
    @group(0) @binding(1) var<storage, read_write> cells: array<Cell>;
    @group(0) @binding(2) var<uniform> u: Params;
    const FIX: f32 = 1000000.0;
    fn enc(v: f32) -> i32 { return i32(v * FIX); }
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
    }
    @compute @workgroup_size(64) fn scatter(@builtin(global_invocation_id) id: vec3u) {
      let i = id.x; if (!live(i)) { return; }
      let p = particles[i]; let base = vec3i(floor(p.p.xyz));
      let w = weights(p.p.xyz - vec3f(base) - 0.5);
      for (var x=0; x<3; x++) { for (var y=0; y<3; y++) { for (var z=0; z<3; z++) {
        let c = base + vec3i(x,y,z) - 1;
        if (any(c < vec3i(0)) || any(c >= vec3i(u.size.xyz))) { continue; }
        let j = index(c); let mass = w[x].x * w[y].y * w[z].z;
        let v = mass * (p.v.xyz + p.C * (vec3f(c) + 0.5 - p.p.xyz));
        atomicAdd(&cells[j].m, enc(mass));
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
      let force=(-4.0*u.clock.x/max(density,0.1))*stress;
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
      v+=u.gravity.xyz*u.clock.x;
      let d=(c.xy-u.mouse.xy)/max(u.mouse.z,0.1);
      v+=u.push.xyz*exp(-dot(d,d)*2.0)*u.mouse.w*u.clock.x;
      if((c.x<=2.5 && v.x<0.0) || (c.x>=u.size.x-2.5 && v.x>0.0)){v.x=0.0;}
      if((c.z<=2.5 && v.z<0.0) || (c.z>=u.size.z-2.5 && v.z>0.0)){v.z=0.0;}
      let inDrain=u.clock.z>0.0 && abs(c.x-u.size.x*0.5)<u.size.x*u.clock.z;
      if(c.y<=2.5 && v.y<0.0 && !inDrain){v.y=0.0;}
      atomicStore(&cells[i].x,enc(v.x));atomicStore(&cells[i].y,enc(v.y));atomicStore(&cells[i].z,enc(v.z));
    }
    @compute @workgroup_size(64) fn gather(@builtin(global_invocation_id) id: vec3u) {
      let i=id.x;if(!live(i)){return;}
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
      if(q.y>u.size.y-1.1 || q.y<1.0){particles[i].p.w=0.0;return;}
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
      particles[i].p=vec4f(q,1); particles[i].v=vec4f(v,0);particles[i].C=4.0*C;
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
    @group(0) @binding(4) var<storage,read_write> probe:array<f32>;
    @compute @workgroup_size(1) fn surfaceProbe(){
      let x=i32(u.nozzle.x);let z=i32(u.nozzle.z);var height=2.0;
      for(var y=i32(u.size.y)-4;y>=2;y--){
        var mass=0.0;
        for(var dx=-1;dx<=1;dx++){for(var dz=-1;dz<=1;dz++){
          mass+=dec(atomicLoad(&cells[index(vec3i(x+dx,y,z+dz))].m));
        }}
        if(mass>5.0){height=f32(y)+0.5;break;}
      }
      probe[0]=height;
    }
    @compute @workgroup_size(64) fn densityField(@builtin(global_invocation_id) id:vec3u) {
      let i=id.x;if(i>=u.counts.y){return;}let nz=u32(u.size.z);let ny=u32(u.size.y);
      let c=vec3i(vec3u(i/nz/ny,(i/nz)%ny,i%nz));
      let w=array<f32,3>(0.05,0.9,0.05);let grad=array<f32,3>(-0.5,0.0,0.5);
      var rho=0.0;var g=vec3f(0);
      for(var x=0;x<3;x++){for(var y=0;y<3;y++){for(var z=0;z<3;z++){
        let p=c+vec3i(x,y,z)-1;var m=0.0;
        if(all(p>=vec3i(0)) && all(p<vec3i(u.size.xyz))){m=dec(atomicLoad(&cells[index(p)].m));}
        rho+=m*w[x]*w[y]*w[z];
        g+=m*vec3f(grad[x]*w[y]*w[z],w[x]*grad[y]*w[z],w[x]*w[y]*grad[z]);
      }}}
      textureStore(field,c,vec4f(g,rho));
    }
  `;
  const VOLUME = QUAD + `
    struct Params { size:vec4f, gravity:vec4f, mouse:vec4f, push:vec4f, counts:vec4u, view:vec4f, nozzle:vec4f, clock:vec4f }
    @group(0) @binding(0) var field:texture_3d<f32>;
    @group(0) @binding(1) var linear:sampler;
    @group(0) @binding(2) var<uniform> u:Params;
    // Eight hardware-trilinear samples implement a cubic B-spline. Linear
    // interpolation alone leaves flat facets on a side-view silhouette.
    fn density(p:vec3f)->vec4f {
      let q=p-0.5;let cell=floor(q);let f=q-cell;let f2=f*f;let f3=f2*f;
      let w0=(1.0-f)*(1.0-f)*(1.0-f)/6.0;
      let w1=(3.0*f3-6.0*f2+4.0)/6.0;
      let w2=(-3.0*f3+3.0*f2+3.0*f+1.0)/6.0;let w3=f3/6.0;
      let g0=w0+w1;let g1=w2+w3;
      let a=(cell-1.0+w1/g0+0.5)/u.size.xyz;
      let b=(cell+1.0+w3/g1+0.5)/u.size.xyz;
      let x00=mix(textureSampleLevel(field,linear,vec3f(a.x,a.y,a.z),0.0),textureSampleLevel(field,linear,vec3f(b.x,a.y,a.z),0.0),g1.x);
      let x10=mix(textureSampleLevel(field,linear,vec3f(a.x,b.y,a.z),0.0),textureSampleLevel(field,linear,vec3f(b.x,b.y,a.z),0.0),g1.x);
      let x01=mix(textureSampleLevel(field,linear,vec3f(a.x,a.y,b.z),0.0),textureSampleLevel(field,linear,vec3f(b.x,a.y,b.z),0.0),g1.x);
      let x11=mix(textureSampleLevel(field,linear,vec3f(a.x,b.y,b.z),0.0),textureSampleLevel(field,linear,vec3f(b.x,b.y,b.z),0.0),g1.x);
      let sampled=mix(mix(x00,x10,g1.y),mix(x01,x11,g1.y),g1.z);
      // Exact free fall in air, then particles at the actual landing surface.
      // A jet narrower than a simulation cell must not be reconstructed as
      // a row of inflated blobs. Continuity: pi*r(y)^2*v(y) is constant.
      if(u.clock.w>0.5 && p.y>u.nozzle.y && p.y<u.push.w){
        let radial=vec2f(p.x-u.nozzle.x,p.z-u.nozzle.z);let r=length(radial);
        let speed=sqrt(u.gravity.w*u.gravity.w+0.8*max(0.0,u.size.y+2.0-p.y));
        let radius=u.nozzle.w*sqrt(u.gravity.w/speed);
        let jet=3.0*(1.0-smoothstep(max(0.0,radius-0.12),radius+0.12,r));
        if(jet>0.0){
          let drdy=0.2*radius/(speed*speed);
          let n=normalize(vec3f(radial.x,-radius*drdy,radial.y)+vec3f(0.00001,0,0));
          return sampled+vec4f(-n*jet,jet);
        }
      }
      return sampled;
    }
    fn room(r:vec3f)->vec3f {
      var c=mix(vec3f(0.012,0.008,0.006),vec3f(0.26,0.25,0.24),smoothstep(-0.1,0.9,r.y));
      // The top mirrors the room BEHIND the cup at this camera angle.
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
      let ray=normalize(vec3f(0.0,-0.24,1.0));
      var hit=false;var position=vec3f(0);var lastP=vec3f(xy+vec2f(0,0.48),0);
      var thickness=0.0;var maximum=0.0;var strongest=lastP;
      // The whole shallow cup is only ten grid cells deep, irrespective of
      // screen resolution. No marching through a large invisible tub.
      for(var k=0;k<=32;k++){
        let z=f32(k)*0.25;let p=vec3f(xy.x,xy.y-0.24*(z-2.0),z);
        let rho=density(p).w;
        thickness+=min(rho/3.0,1.0)*0.25;
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
    struct Drop { @builtin(position) pos:vec4f, @location(0) disk:vec2f, @location(1) centre:vec3f }
    @vertex fn dropVertex(@builtin(vertex_index) vertex:u32,@builtin(instance_index) i:u32)->Drop {
      let p=particles[i].p;
      let corner=array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(-1,1),vec2f(1,-1),vec2f(1,1))[vertex];
      var out:Drop;out.disk=corner;out.centre=p.xyz;
      let xy=vec2f((p.x-2.0)/(u.size.x-4.0),(p.y-2.0+0.24*(p.z-2.0))/(u.size.y-4.0));
      out.pos=vec4f(xy*2.0-1.0+corner*0.43*2.0/(u.size.xy-4.0),0,1);
      if(p.w<0.5 || density(p.xyz).w>0.65){out.pos=vec4f(3,3,0,1);}
      return out;
    }
    @fragment fn dropFragment(in:Drop)->Pixel {
      let r2=dot(in.disk,in.disk);if(r2>=1.0){discard;}
      let z=sqrt(1.0-r2);let n=normalize(vec3f(in.disk,-z));let ray=normalize(vec3f(0,-0.24,1));
      let F=0.02+0.98*pow(1.0-clamp(dot(-ray,n),0.0,1.0),5.0);
      let mm=2.0*0.43*z*u.view.w*1000.0;
      let through=exp(-vec3f(0.32,0.66,1.05)*mm)*vec3f(0.2,0.095,0.03);
      var c=(1.0-F)*through+F*room(reflect(ray,n));c=pow(c/(1.0+c),vec3f(1.0/2.2));
      let alpha=1.0-smoothstep(1.0-max(fwidth(r2),0.01),1.0,r2);
      var out:Pixel;out.color=vec4f(c*alpha,alpha);out.depth=clamp((in.centre.z-0.43*z)/u.size.z,0.0,1.0);return out;
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
    const grid=buffer('coffee3 momentum grid',dims.nx*dims.ny*dims.nz*16,U.STORAGE|U.COPY_DST);
    const uniform=buffer('coffee3 parameters',128,U.UNIFORM|U.COPY_DST);
    const probe=buffer('coffee3 landing surface',16,U.STORAGE|U.COPY_SRC);
    const module=async(label,code)=>{
      const m=device.createShaderModule({label,code});const info=await m.getCompilationInfo();
      const bad=info.messages.filter(x=>x.type==='error');if(bad.length)throw new Error(label+': '+bad.map(x=>x.message).join('; '));return m;
    };
    device.pushErrorScope('validation');
    const compute=await module('coffee3 MLS-MPM',COMPUTE);
    const fieldModule=await module('coffee3 density reconstruction',FIELD);
    const optics=await module('coffee3 volume optics',VOLUME);
    const drops=await module('coffee3 detached drops',DROPS);
    const stages={};
    for(const name of ['clear','scatter','pressure','forces','gather']){
      const pipeline=await device.createComputePipelineAsync({label:'coffee3 '+name,layout:'auto',compute:{module:compute,entryPoint:name}});
      // Auto layouts omit bindings unused by this entry point.
      const ids=name==='clear'?[1,2]:name==='forces'?[1,2]:[0,1,2];
      const resources=[particle,grid,uniform];
      stages[name]={pipeline,group:device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:ids.map(binding=>({binding,resource:{buffer:resources[binding]}}))})};
    }
    const fieldTexture=device.createTexture({label:'coffee3 3D density',dimension:'3d',size:[dims.nx,dims.ny,dims.nz],format:'rgba16float',usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});
    const fieldView=fieldTexture.createView();
    const fieldPipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:fieldModule,entryPoint:'densityField'}});
    const fieldGroup=device.createBindGroup({layout:fieldPipeline.getBindGroupLayout(0),entries:[{binding:1,resource:{buffer:grid}},{binding:2,resource:{buffer:uniform}},{binding:3,resource:fieldView}]});
    const probePipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:fieldModule,entryPoint:'surfaceProbe'}});
    const probeGroup=device.createBindGroup({layout:probePipeline.getBindGroupLayout(0),entries:[{binding:1,resource:{buffer:grid}},{binding:2,resource:{buffer:uniform}},{binding:4,resource:{buffer:probe}}]});
    const depthState={format:'depth24plus',depthWriteEnabled:true,depthCompare:'less-equal'};
    const shadePipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:optics,entryPoint:'quad'},fragment:{module:optics,entryPoint:'volume',targets:[{format}]},primitive:{topology:'triangle-list'},depthStencil:depthState});
    const dropPipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:drops,entryPoint:'dropVertex'},fragment:{module:drops,entryPoint:'dropFragment',targets:[{format,blend:{color:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'}}}]},primitive:{topology:'triangle-list'},depthStencil:depthState});
    const sampler=device.createSampler({minFilter:'linear',magFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge',addressModeW:'clamp-to-edge'});
    const shadeGroup=device.createBindGroup({layout:shadePipeline.getBindGroupLayout(0),entries:[{binding:0,resource:fieldView},{binding:1,resource:sampler},{binding:2,resource:{buffer:uniform}}]});
    const dropGroup=device.createBindGroup({layout:dropPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:fieldView},{binding:1,resource:sampler},{binding:2,resource:{buffer:uniform}},{binding:3,resource:{buffer:particle}}]});
    const validation=await device.popErrorScope();if(validation){device.destroy();throw new Error(validation.message);}
    let depthTexture,depthView;
    function resize(w,h){canvas.width=w;canvas.height=h;depthTexture?.destroy();depthTexture=device.createTexture({size:[w,h],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});depthView=depthTexture.createView();}
    function draw(encoder,count,measure){
      // Rebuild mass after the final advection, so the visible surface is this
      // frame's liquid, not the previous step's position or pressure grid.
      let p=encoder.beginComputePass();
      for(const name of ['clear','scatter']){
        const stage=stages[name];p.setPipeline(stage.pipeline);p.setBindGroup(0,stage.group);
        p.dispatchWorkgroups(Math.ceil((name==='clear'?dims.nx*dims.ny*dims.nz:count)/64));
      }
      p.setPipeline(fieldPipeline);p.setBindGroup(0,fieldGroup);p.dispatchWorkgroups(Math.ceil(dims.nx*dims.ny*dims.nz/64));
      if(measure){p.setPipeline(probePipeline);p.setBindGroup(0,probeGroup);p.dispatchWorkgroups(1);}p.end();
      p=encoder.beginRenderPass({colorAttachments:[{view:context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:0}}],depthStencilAttachment:{view:depthView,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});
      p.setPipeline(shadePipeline);p.setBindGroup(0,shadeGroup);p.draw(3);
      p.setPipeline(dropPipeline);p.setBindGroup(0,dropGroup);p.draw(6,count);p.end();
      if(measure){const read=device.createBuffer({size:16,usage:U.COPY_DST|U.MAP_READ});encoder.copyBufferToBuffer(probe,0,read,0,16);return read;}
    }
    function step(encoder,count){
      const p=encoder.beginComputePass();
      for(const name of ['clear','scatter','pressure','forces','gather']){
        const s=stages[name];p.setPipeline(s.pipeline);p.setBindGroup(0,s.group);
        p.dispatchWorkgroups(Math.ceil((name==='clear'||name==='forces'?dims.nx*dims.ny*dims.nz:count)/64));
      }p.end();
    }
    async function audit(count){
      const read=device.createBuffer({size:Math.max(80,count*80),usage:U.COPY_DST|U.MAP_READ});
      try{
        const e=device.createCommandEncoder();e.copyBufferToBuffer(particle,0,read,0,Math.max(80,count*80));device.queue.submit([e.finish()]);
        await read.mapAsync(GPUMapMode.READ);const data=new Float32Array(read.getMappedRange());
        let alive=0,finite=true,energy=0,meanX=0,meanY=0,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
        for(let i=0;i<count;i++){
          const k=i*20;for(let j=0;j<20;j++)if(!Number.isFinite(data[k+j]))finite=false;
          if(data[k+3]<0.5)continue;alive++;meanX+=data[k];meanY+=data[k+1];
          minY=Math.min(minY,data[k+1]);maxY=Math.max(maxY,data[k+1]);minZ=Math.min(minZ,data[k+2]);maxZ=Math.max(maxZ,data[k+2]);
          energy+=data[k+4]**2+data[k+5]**2+data[k+6]**2;
        }
        return {alive,emitted:count,lost:count-alive,finite,meanX:meanX/Math.max(1,alive),meanY:meanY/Math.max(1,alive),minY,maxY,minZ,maxZ,rmsSpeed:Math.sqrt(energy/Math.max(1,alive)),errors:[...errors]};
      }finally{read.destroy();}
    }
    async function surface(read){try{await read.mapAsync(GPUMapMode.READ);return new Float32Array(read.getMappedRange())[0];}finally{read.destroy();}}
    return {device,particle,uniform,errors,resize,draw,step,audit,surface,destroy(){depthTexture?.destroy();fieldTexture.destroy();for(const b of owned)b.destroy();context.unconfigure();device.destroy();}};
    } catch(error) { device.destroy(); throw error; }
  }

  async function pour(options={}){
    if(current||starting)return;starting=true;lastRun=null;
    const phone=typeof options.phone==='boolean'?options.phone:matchMedia('(pointer: coarse)').matches;
    // Reduced motion is a static cup, no compute work or moving highlights.
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){
      const cup=document.createElement('div');cup.dataset.coffee='3';cup.setAttribute('aria-hidden','true');
      cup.style.cssText='position:fixed;inset:25% 0 0;z-index:2147483645;pointer-events:none;background:linear-gradient(#382013 0,#130904 5%,#100704 100%);border-top:2px solid #7b6250';
      let timer;const still={stop(){cup.remove();clearTimeout(timer);if(current===still)current=null;}};
      document.body.appendChild(cup);current=still;starting=false;
      timer=setTimeout(()=>still.stop(),phone?40*60*1000:5000);return;
    }
    const canvas=document.createElement('canvas');canvas.dataset.coffee='3';canvas.setAttribute('aria-hidden','true');
    canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:2147483645;pointer-events:none';
    document.body.appendChild(canvas);let gpu;
    try{
      const W=innerWidth,H=innerHeight,d=dimensions(W,H,phone);gpu=await makeGPU(canvas,d);
      const abort=new AbortController(),signal=abort.signal;
      let stopped=false,raf=0,busy=false,holdTimer=0,last=performance.now(),elapsed=0,accumulator=0,count=0,emitted=0,emission=0,fullAt=-1,draining=false,drainAt=-1;
      const births=[];let landing=2,lastSurface=0,rippleEnergy=0.1;
      let tilt=[0,-1,0],targetTilt=[0,-1,0],pointer=false,mouse=[-100,-100],push=[0,0],lastPointer=0;
      let sleeping=false,quiet=0,lastAudit=0,lastSensor=0,lastMotion=0,orientationReference=null,motionVotes=0,frameMs=0,holdUntil=Infinity;
      const hold=Number.isFinite(options.holdSeconds)?Math.max(0,options.holdSeconds):(phone?40*60:5);
      const debug=/coffeedebug/.test(location.search);let hud;
      if(debug){hud=document.createElement('output');hud.style.cssText='position:fixed;top:8px;left:8px;z-index:2147483646;background:#0b0908e8;color:#fff2d9;padding:9px;font:12px/1.45 monospace;white-space:pre;pointer-events:none';document.body.appendChild(hud);}
      const params=new ArrayBuffer(128),f=new Float32Array(params),ints=new Uint32Array(params);
      const resolution=()=>{const scale=Math.min(devicePixelRatio||1,1.5,1000/innerWidth,1100/innerHeight);gpu.resize(Math.max(1,Math.round(innerWidth*scale)),Math.max(1,Math.round(innerHeight*scale)));};resolution();
      function wake(){
        quiet=0;
        if(sleeping){sleeping=false;last=performance.now();accumulator=0;}
        if(!raf&&!busy&&!document.hidden&&!stopped){last=performance.now();raf=requestAnimationFrame(frame);}
      }
      function stop(){if(stopped)return;stopped=true;cancelAnimationFrame(raf);clearTimeout(holdTimer);abort.abort();canvas.remove();hud?.remove();gpu.destroy();if(current?.canvas===canvas)current=null;}
      function writeParams(){
        const firstAge=emitted?(elapsed-births[0])/d.timeUnit:0;
        const lastAge=emitted>=d.target||draining?(elapsed-(births[emitted-1]??elapsed))/d.timeUnit:0;
        const bottom=Math.max(landing+0.25,d.ny+2-d.speed*firstAge-0.2*firstAge*firstAge);
        const top=d.ny+2-d.speed*lastAge-0.2*lastAge*lastAge;
        // Open the floor gate across the whole cup in 0.4 s. A permanently
        // narrow hole stranded two pools once they became shallower than a cell.
        const opening=draining?drainOpening(elapsed-drainAt):0;
        f.set([d.nx,d.ny,d.nz,d.viscosity],0);f.set([tilt[0]*0.4,tilt[1]*0.4,tilt[2]*0.4,d.speed],4);
        f.set([mouse[0],mouse[1],4,pointer?1:0],8);f.set([push[0],push[1],0,top],12);
        ints.set([count,d.nx*d.ny*d.nz,d.target,0],16);
        f.set([canvas.width,canvas.height,rippleEnergy,d.metresPerCell],20);
        f.set([2+d.inner*0.57,bottom,d.nz*0.5,d.radius],24);f.set([DT,elapsed,opening,emitted>count&&top>bottom?1:0],28);
        gpu.device.queue.writeBuffer(gpu.uniform,0,params);
      }
      function spawn(seconds){
        if(!draining&&emitted<d.target){
          emission+=d.flow*seconds/d.timeUnit;
          const n=Math.min(Math.floor(emission),d.target-emitted);emission-=n;
          for(let j=0;j<n;j++)births.push(elapsed-seconds+(j+0.5)/Math.max(1,n)*seconds);
          emitted+=n;
        }
        const before=count;
        while(count<emitted){
          const age=(elapsed-births[count])/d.timeUnit;
          const y=d.ny+2-d.speed*age-0.2*age*age;
          if(y>landing+0.8)break;count++;
        }
        const n=count-before;if(n<=0)return;
        const data=new Float32Array(n*20);
        const jet=jetAt(d,landing),impact=jet.speed,radius=jet.radius;
        // Every analytical parcel becomes exactly one GPU particle when it lands.
        // Its position, speed and narrowed radius follow the same free fall.
        for(let j=0;j<n;j++){
          const id=before+j,angle=id*2.39996323,r=radius*Math.sqrt((id*0.618033989)%1);
          const k=j*20;data[k]=2+d.inner*0.57+Math.cos(angle)*r;
          data[k+1]=Math.max(2,landing+0.8-impact*(j/n)*seconds/d.timeUnit);
          data[k+2]=d.nz*0.5+Math.sin(angle)*r;data[k+3]=1;data[k+5]=-impact;
        }
        gpu.device.queue.writeBuffer(gpu.particle,before*80,data);
        if(count===d.target){fullAt=elapsed;holdUntil=performance.now()+hold*1000;holdTimer=setTimeout(()=>{if(!stopped){draining=true;wake();}},hold*1000);}
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
        const next=raw.map(v=>clamp(v*motionSign,-3,3));
        const changed=next.some((v,i)=>Math.abs(v-targetTilt[i])>0.035);targetTilt=next;if(changed)wake();
      }
      function move(e){
        if(!pointer)return;
        const x=2+e.clientX/innerWidth*(d.nx-4),y=2+(1-e.clientY/innerHeight)*(d.ny-4);
        const now=performance.now(),dt=Math.max(0.01,(now-lastPointer)/1000);
        if(e.altKey){targetTilt=[(e.clientX/innerWidth-0.5)*1.8,-1,0];}
        else{push=[clamp((x-mouse[0])/dt*d.timeUnit*10,-30,30),clamp((y-mouse[1])/dt*d.timeUnit*10,-30,30)];}
        mouse=[x,y];lastPointer=now;wake();
      }
      addEventListener('pointerdown',e=>{pointer=true;mouse=[2+e.clientX/innerWidth*(d.nx-4),2+(1-e.clientY/innerHeight)*(d.ny-4)];lastPointer=performance.now();wake();},{signal,passive:true});
      addEventListener('pointermove',move,{signal,passive:true});
      addEventListener('pointerup',()=>{pointer=false;push=[0,0];},{signal,passive:true});
      addEventListener('pointercancel',()=>{pointer=false;push=[0,0];},{signal,passive:true});
      addEventListener('deviceorientation',orient,{signal,passive:true});addEventListener('devicemotion',motion,{signal,passive:true});
      addEventListener('resize',()=>{resolution();wake();},{signal,passive:true});
      document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{last=performance.now();wake();}},{signal});
      gpu.device.lost.then(info=>{if(!stopped){stop();notice('coffee3 paused because the graphics device was lost. Type coffee3 to pour again.');console.warn('coffee3 device lost:',info.message);}});
      async function frame(now){
        raf=0;if(stopped||document.hidden||busy)return;busy=true;
        try{
          const wall=clamp((now-last)/1000,0,0.05);last=now;
          const smoothing=1-Math.exp(-wall/0.06);tilt=tilt.map((v,i)=>v+(targetTilt[i]-v)*smoothing);
          const physicalStep=DT*d.timeUnit,budget=Math.min(40,Math.ceil(0.025/physicalStep));accumulator=Math.min(accumulator+wall,physicalStep*budget);
          if(now>=holdUntil){draining=true;sleeping=false;}
          if(draining&&drainAt<0)drainAt=elapsed;
          if(draining&&emitted===0){lastRun={alive:0,emitted:0,lost:0,inFlight:0,finite:true,errors:[]};stop();return;}
          const encoder=gpu.device.createCommandEncoder();
          const steps=sleeping?0:Math.min(budget,Math.floor(accumulator/physicalStep));
          elapsed+=steps*physicalStep;spawn(steps*physicalStep);writeParams();
          // One uniform snapshot and one continuous nozzle segment per frame.
          // Every substep reads the same particle count, never a future emission.
          for(let step=0;step<steps;step++)gpu.step(encoder,count);
          accumulator-=steps*physicalStep;
          const probe=gpu.draw(encoder,count,now-lastSurface>100);gpu.device.queue.submit([encoder.finish()]);
          await gpu.device.queue.onSubmittedWorkDone();
          if(stopped){probe?.destroy();return;}
          if(probe){landing=await gpu.surface(probe);lastSurface=now;if(stopped)return;}
          frameMs=frameMs*0.9+(performance.now()-now)*0.1;
          if(now-lastAudit>1500 && count>0){
            lastAudit=now;const book=await gpu.audit(count);if(stopped)return;
            if(!book.finite||gpu.errors.length)throw new Error('coffee3 GPU validation failed.');
            const speed=book.rmsSpeed*d.metresPerCell/d.timeUnit;
            rippleEnergy=clamp(speed/0.15,0,1);
            if(fullAt>=0&&!draining&&!pointer&&speed<0.008)quiet+=1.5;else quiet=0;
            if(quiet>=4)sleeping=true;
            if(hud)hud.textContent=`coffee3 · live 3D · ${frameMs.toFixed(1)} ms/frame work\n${book.alive.toLocaleString()} in cup · ${book.lost.toLocaleString()} out · ${emitted-count} falling\n${emitted.toLocaleString()} poured · ${d.fillSeconds.toFixed(1)} s calculated pour\n${(speed*1000).toFixed(1)} mm/s · ${sleeping?'sleeping':draining?'draining':'running'}`;
            if(draining&&book.alive===0&&emitted===count){lastRun={...book,emitted,inFlight:0,elapsed};stop();return;}
          }
          push=push.map(v=>v*0.75);
          if(sleeping)accumulator=0;
        }catch(error){if(stopped)return;stop();console.error(error);notice('coffee3 could not keep running on this graphics device.');}
        finally{busy=false;if(!stopped&&!sleeping&&!document.hidden&&!raf)raf=requestAnimationFrame(frame);}
      }
      current={canvas,stop,dims:d,async audit(){const snapshot={count,emitted};const book=await gpu.audit(snapshot.count);return{...book,emitted:snapshot.emitted,inFlight:snapshot.emitted-snapshot.count};},drain(){holdUntil=performance.now();wake();},tilt(x,y,z=0){targetTilt=[x,y,z];wake();},get state(){return{count,emitted,elapsed,fullAt,draining,sleeping,frameMs,errors:[...gpu.errors]};}};
      starting=false;raf=requestAnimationFrame(frame);
    }catch(error){gpu?.destroy();canvas.remove();starting=false;console.error(error);
      notice(error.message.length<180?error.message:'coffee3 could not initialise on this graphics device.');}
  }
  root.RELAY_COFFEE3={pour,dimensions,jetAt,drainOpening,orientationGravity,accelerationGravity,get active(){return current;},get lastRun(){return lastRun;}};
})(typeof window==='undefined'?globalThis:window);
