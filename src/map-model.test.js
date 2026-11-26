import {test}from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {stationPriorities,stationWorldPoint,selectionTransition,selectedPaths,visibleStations}from './map-model.js';
import {reachable}from './network.js';
const d=JSON.parse(fs.readFileSync(new URL('../public/timetable/data.json',import.meta.url)));
test('two picks select a destination; removing origin promotes destination and recalculates direction',()=>{
 const origin=d.stations.find(s=>s.name==='珠海').id,result=reachable(d,origin,'2026-11-26');const dest=[...result.destinations.keys()][0];
 let state=selectionTransition({origin:null,destination:null},{type:'pick',id:origin});assert.equal(state.origin,origin);
 state=selectionTransition(state,{type:'pick',id:dest},new Set(result.destinations.keys()));assert.deepEqual(state,{origin,destination:dest});
 assert.ok(selectedPaths(result,dest).every(t=>t.path[0]===origin&&t.path.at(-1)===dest));
 state=selectionTransition(state,{type:'remove-origin'});assert.deepEqual(state,{origin:dest,destination:null});
 const promoted=reachable(d,state.origin,'2026-11-26');assert.ok(promoted.services.every(t=>t.path[0]===dest));
 assert.deepEqual(selectionTransition(state,{type:'remove-origin'}),{origin:null,destination:null});
});
test('removing destination retains origin; unreachable picks never infer transfers',()=>{
 const s={origin:'A',destination:'B'};assert.deepEqual(selectionTransition(s,{type:'remove-destination'}),{origin:'A',destination:null});
 assert.equal(selectionTransition(s,{type:'pick',id:'C'},new Set(['B'])),s);
 assert.deepEqual(selectedPaths(null,null),[]);assert.deepEqual(selectedPaths({services:[1],destinations:new Map()},'missing'),[]);
});
test('frequency drives size, colors, and zoom visibility; low zoom stays sparse',()=>{
 const ranked=stationPriorities(d,'2026-11-26');assert.ok(ranked[0].frequency>ranked.at(-1).frequency);assert.ok(ranked[0].radius>ranked.at(-1).radius);assert.equal(ranked[0].tier,'major');
 const visible=visibleStations(ranked,{zoom:4,contains:()=>true,origin:null,destination:null,reachableIds:new Set(),project:s=>({x:s.lng*10,y:s.lat*10})});
 assert.ok(visible.length<=100);assert.ok(visible.every(s=>s.minZoom<=4));
 const low=ranked.find(s=>s.minZoom>=8);assert.ok(!visible.some(s=>s.id===low.id));
 // A low-frequency reachable station must still be available as a destination at low zoom.
 const selected=visibleStations(ranked,{zoom:4,contains:()=>true,origin:ranked[0].id,destination:null,reachableIds:new Set([low.id]),project:()=>({x:0,y:0})});
 assert.ok(selected.some(s=>s.id===low.id));
});
test('viewport culling and collision avoidance never remove selected endpoints',()=>{
 const s=[{id:'A',minZoom:3},{id:'B',minZoom:3}];
 const normal=visibleStations(s,{zoom:4,contains:()=>true,origin:null,destination:null,reachableIds:new Set(),project:()=>({x:1,y:1})});assert.equal(normal.length,1);
 const endpoints=visibleStations(s,{zoom:3,contains:()=>false,origin:'A',destination:'B',reachableIds:new Set(),project:()=>({x:1,y:1})});assert.equal(endpoints.length,2);
});

test('regional hubs appear early without inflating their actual-frequency symbols',()=>{
 const ranked=stationPriorities(d,'2026-11-27'),byName=new Map(ranked.map(s=>[s.name,s]));
 for(const name of ['乌鲁木齐','喀什','拉萨','哈密','和田']){
  const s=byName.get(name);assert.ok(s.frequency>0);assert.ok(s.minZoom<=4,`${name}: ${s.minZoom}`);assert.ok(s.regionalRepresentative);
 }
 assert.ok(byName.get('西宁').minZoom<=5);
 assert.ok(byName.get('乌鲁木齐南').minZoom>byName.get('乌鲁木齐').minZoom);
 assert.ok(byName.get('拉萨').radius<byName.get('上海虹桥').radius);
 for(const s of ranked)assert.equal(s.radius,Math.min(7,2.3+Math.log2(1+s.frequency)*.48));
 const nationwide=visibleStations(ranked,{zoom:4,contains:()=>true,origin:null,destination:null,reachableIds:new Set(),project:s=>stationWorldPoint(s,4)});
 assert.ok(nationwide.length>30&&nationwide.length<100);
 for(let i=0;i<nationwide.length;i++)for(let j=0;j<i;j++){
  const a=stationWorldPoint(nationwide[i],4),b=stationWorldPoint(nationwide[j],4);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=26-1e-8);
 }
});
test('world-based membership stays stable while panning and grows with zoom',()=>{
 const ranked=stationPriorities(d,'2026-11-27');
 const view=(zoom,dx=0)=>visibleStations(ranked,{zoom,contains:()=>true,origin:null,destination:null,reachableIds:new Set(),project:s=>{const p=stationWorldPoint(s,zoom);return {x:p.x+dx,y:p.y+dx};}});
 assert.deepEqual(view(4).map(s=>s.id),view(4,137).map(s=>s.id));
 const at5=new Set(view(5).map(s=>s.id));assert.ok(view(4).every(s=>at5.has(s.id)));
 const clipped=visibleStations(ranked,{zoom:4,contains:s=>s.lng<100,origin:null,destination:null,reachableIds:new Set(),project:s=>stationWorldPoint(s,4)});
 assert.deepEqual(clipped.map(s=>s.id),view(4).filter(s=>s.lng<100).map(s=>s.id));
 assert.ok(view(13).every(s=>s.frequency>0));
});
test('regional weighting does not invent activity or depend on source station order',()=>{
 const station=(id,lat,lng)=>({id,name:id,lat,lng});
 const data={stations:[station('busy',30,120),station('west',40,80),station('empty',32,90),station('nearby',40.01,80.01)],trains:[...Array.from({length:100},(_,i)=>({id:`E${i}`,stops:['busy']})),...Array.from({length:12},(_,i)=>({id:`W${i}`,stops:['west']})),{id:'local',stops:['nearby']}]};
 const a=stationPriorities(data),b=stationPriorities({...data,stations:[...data.stations].reverse()});
 assert.deepEqual(a.map(s=>[s.id,s.minZoom]),b.map(s=>[s.id,s.minZoom]));assert.equal(a.find(s=>s.id==='empty').minZoom,Infinity);
 assert.ok(a.find(s=>s.id==='west').minZoom<a.find(s=>s.id==='nearby').minZoom);
});
