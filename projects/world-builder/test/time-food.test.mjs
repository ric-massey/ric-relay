import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People=createRequire(import.meta.url)("../people.js");
const options={people:40,map:"small",talk:0.8,seed:11,plague:"none"};
const print=w=>JSON.stringify({ people:w.people, friends:w.people.map(p=>[...p.friends]), factions:w.factions,villages:w.villages,stock:[...w.stock],events:w.events,chatter:w.chatter,stats:w.stats() });
const batched=People.create(options), hourly=People.create(options), framed=People.create(options);
batched.advance(1200);
for(let i=0;i<24;i++)hourly.step(1);
for(let i=0;i<72000;i++)framed.advance(1/60);
assert.equal(print(batched),print(hourly),"headless hours and browser seconds must produce the same world");
assert.equal(print(batched),print(framed),"fast-forward and frame-sized calls must produce the same world");
assert.equal(batched.days,1);assert.equal(batched.tick,24);assert.equal(batched.activityTicks,6000);
assert.ok(batched.chatter.some(c=>c.day>0 && c.day<batched.days-1/6000),"batch calls must timestamp when speech happens, not at the batch end");
assert.throws(()=>batched.advance(-1),RangeError);assert.throws(()=>batched.step(Infinity),RangeError);

// Isolate feeding from work so the daily ration has a measurable meaning.
function resting(extra={}){
 const w=People.create({...options,people:20,talk:0,births:0,...extra});
 for(const p of w.people){p.age=30;p.dieAt=120;p.food=20;p.goods=0;p.partner=0;p.mum=0;p.dad=0;p.task="idle";p.wait=100000;p.tx=p.x;p.ty=p.y;}
 return w;
}
for(const life of [20,120]){
 const w=resting({life}),p=w.people[0],food=p.food,age=p.age;
 w.step(24);
 assert.ok(Math.abs(p.food-(food-1))<1e-9,"an adult eats one adult-day ration per day regardless of lifespan");
 assert.ok(Math.abs(p.age-age-1/365)<1e-9,"aging uses the same calendar day");
}
{
 const w=resting(),p=w.people[0];p.age=2;p.job="child";
 const small=w.dailyNeed(p);p.age=12;const older=w.dailyNeed(p);p.age=30;assert.ok(small<older&&older<w.dailyNeed(p));
 const v=w.villages[p.home],need=w.people.filter(q=>q.home===v.id).reduce((n,q)=>n+w.dailyNeed(q),0);
 v.food=need*3;assert.ok(Math.abs(w.storeDays(v)-3)<1e-10,"store estimates use actual residents' needs");
}
{
 const w=resting({money:"shared"}),p=w.people[0],v=w.villages[p.home];
 p.food=0;p.age=2;p.job="child";p.mum=w.people[1].id;w.people[1].food=1;v.food=0;
 w.step(1);assert.ok(p.food>0&&p.hungry===0,"a parent shares a meal without needing more than a whole day's food");
}
{
 const w=resting(),p=w.people[0];w.stock.fill(0);const fert=[...w.fert].reduce((a,b)=>a+b,0);
 w.step(24);
 assert.ok(Math.abs(w.stock.reduce((a,b)=>a+b,0)-fert*w.tileCapacity/60*w.settings.rich)<0.01,"crops replenish on the documented sixty-day scale");
}
{
 const w=resting({money:"shared",hunger:1}),p=w.people[0];p.food=0;
 w.villages[p.home].food=0;w.step(24);
 assert.ok(p.hp>0&&p.hp<1&&p.hungry===24,"missing a day's food creates sustained hunger, not instant death");
 const money=w.stats().money, dead=w.people[1].id;w.people[1].dieAt=w.people[1].age;w.step(1);
 assert.equal(w.byId.has(dead),false);assert.ok(Math.abs(w.stats().money-money)<1e-9);
}
// Exercise scheduled mechanisms at an imminent boundary, not by skipping years.
{
 const w=resting({term:3});const f=w.factions[0];f.voteAt=0;const before=w.stats().elections;
 w.step(24);assert.ok(w.stats().elections>before);assert.equal(f.voteAt-w.tick,3*People.YEAR);
}
for(const inherit of ["kids","faction","village"]){
 const w=resting({inherit}),p=w.people[0],child=w.people.find(q=>q!==p&&q.home===p.home);
 for(const q of w.people)q.coins=0;for(const v of w.villages)v.till=0;for(const f of w.factions)f.treasury=0;
 p.coins=10;p.dieAt=p.age;child.mum=p.id;const id=p.id,home=p.home,faction=p.f;
 w.step(1);assert.equal(w.byId.has(id),false);assert.ok(Math.abs(w.stats().money-10)<1e-9);
 assert.equal(p.food,0,"a dead person's returned food cannot also feed children from their old pockets");
 if(inherit==="kids")assert.equal(child.coins,10);
 if(inherit==="faction")assert.equal(w.factions[faction].treasury,10);
 if(inherit==="village")assert.ok(w.people.filter(q=>q.home===home).every(q=>q.coins>0));
}
// Births add people, not a newly minted bag of food. Use fed couples and
// stop at a real birth; never shorten their calendar or force an outcome.
function families(births) {
 const w=People.create({...options,people:400,factions:1,villages:4,crowd:200,life:20,grown:6,births,war:false,talk:0,soldiers:0});
 for(const p of w.people){p.age=8;p.dieAt=20;p.food=100;p.partner=0;p.mum=0;p.dad=0;p.job="farmer";p.wait=1000000;p.task="idle";p.tx=p.x;p.ty=p.y;}
 for(const v of w.villages){const people=w.people.filter(p=>p.home===v.id);for(let i=0;i+1<people.length;i+=2){people[i].partner=people[i+1].id;people[i+1].partner=people[i].id;}}
 return w;
}
{
 const w=families(1),off=families(0),total=w=>w.people.reduce((n,p)=>n+p.food,0)+w.villages.reduce((n,v)=>n+v.food,0),before=total(w);
 for(let h=0;h<168 && w.stats().births===0;h+=6){w.step(6);off.step(6);}
 assert.ok(w.stats().births>0,"fed-couple fixture must include an actual birth");
 assert.equal(off.stats().births,0,"births disabled must hold under the same fertile circumstances");
 assert.ok(total(w)<=before-400*w.tick/24+1e-5,"a newborn must be fed from existing supplies, not bring setup rations");
}
console.log("Time and food: same world through frames/hours/batches, daily rations, child needs, household meals, crop growth and sustained hunger pass.");
