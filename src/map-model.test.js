import {test}from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {stationPriorities,selectionTransition,selectedPaths,visibleStations}from './map-model.js';
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
 assert.ok(visible.length<=30);assert.ok(visible.every(s=>s.minZoom<=4));
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
