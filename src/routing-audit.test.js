import {readRouteData} from '../scripts/read-route-data.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=name=>JSON.parse(fs.readFileSync(new URL(`../public/timetable/${name}.json`,import.meta.url)));
test('every timetable leg has geometry or an explicit automated audit failure',()=>{
 const data=read('data'),geometry=readRouteData(),audit=read('routing-audit');
 assert.equal(audit.allTrainsScanned,true);
 const missing=new Set(audit.legs.map(l=>`${l.trainId}|${l.from}|${l.to}`));
 let unresolved=0,inferred=0;
 for(const train of data.trains){
  const ref=geometry.trainRoutes[train.id];assert.ok(ref);
  for(let i=1;i<train.stops.length;i++){
   const a=train.stops[i-1],b=train.stops[i],segment=geometry.segments[ref.legs[[a,b].sort().join('|')]];
   if(!segment){unresolved++;assert.ok(missing.has(`${train.id}|${a}|${b}`),`${train.code}: omitted audit leg`);continue;}
   assert.equal(segment.operator,train.operator);assert.equal(segment.category,train.category);assert.deepEqual(segment.stations,[a,b].sort(),`${train.code}: station-pair geometry mismatch`);
   if(segment.source==='OSM inferred'){inferred++;assert.ok(segment.inference.wayIds.length);assert.ok(segment.dataDate);assert.equal(segment.inference.freightTagPolicy,'soft-penalty');assert.equal(segment.inference.freightTagPenalty,1.5);assert.ok(segment.inference.softFreightWayIds.every(id=>segment.inference.wayIds.includes(id)));}
  }
 }
 assert.equal(unresolved,audit.unresolvedTrainLegs);assert.ok(inferred>30000);
});

test('all Baiyun to Zhaoqing missing legs use the documented northern Guangmao diversion',()=>{
 const data=read('data'),g=readRouteData(),audit=read('routing-audit');let checked=0;
 for(const train of data.trains)for(let i=1;i<train.stops.length;i++){
  const pair=[train.stops[i-1],train.stops[i]].sort().join('|');if(pair!=='GBA|ZVQ')continue;
  const segment=g.segments[g.trainRoutes[train.id].legs[pair]];assert.ok(segment,train.code);checked++;
  assert.equal(segment.source,'OSM inferred');assert.ok(segment.inference.lengthKm<150);
  for(const name of ['京广线','江大联络线','广珠线','沙狮联络线','广茂线'])assert.ok(segment.inference.lineNames.includes(name),`${train.code}: ${name}`);
  assert.ok(segment.inference.tagOverrides.includes('guangmaoPassengerDiversion'));
  assert.equal(segment.inference.lineNames.some(n=>n.includes('城际')),false);
 }
 assert.ok(checked>=6);assert.equal(audit.legs.some(l=>[l.from,l.to].sort().join('|')==='GBA|ZVQ'),false);
});

test('reviewed OSM station corrections agree with the geometry coordinate registry',()=>{
 const data=read('data'),g=readRouteData();
 const corrections=JSON.parse(fs.readFileSync(new URL('../config/station-coordinate-overrides.json',import.meta.url)));
 for(const correction of corrections){
  const station=data.stations.find(s=>s.id===correction.id);assert.ok(station);
  assert.deepEqual([station.lat,station.lng],correction.coordinates);
  assert.deepEqual(g.stationCoordinates[station.id],correction.coordinates);
 }
});
test('Taiyuan-Shijiazhuang North and Guilin North-Liuzhou have audited mixed-traffic geometry',()=>{
 const data=read('data'),g=readRouteData();
 for(const [pair,corridor]of [['TYV|VVP','shitai'],['GBZ|LZZ','hengliu']]){
  let checked=0;
  for(const train of data.trains){
   if(train.category!=='conventional')continue;
   const ref=g.trainRoutes[train.id];
   if(!train.stops.some((a,i)=>i&&[a,train.stops[i-1]].sort().join('|')===pair))continue;
   const segment=g.segments[ref.legs[pair]];assert.ok(segment,`${train.code} ${pair}`);
   assert.ok(segment.inference.mixedTrafficCorridors.includes(corridor));
   assert.ok(segment.inference.lengthKm<300);checked++;
  }
  assert.ok(checked>0,pair);
 }
});
