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

test('rail ferry and cross-border gaps have real attributed geometry',()=>{
 const data=read('data'),g=readRouteData();
 const stationByName=new Map(data.stations.map(s=>[s.name,s.id]));
 for(const [a,b,maxKm,proof]of [['鸡西','柳毛',30,'passengerTrackOverrides'],['太原','汾河',20,'mixedTrafficCorridors'],['昆明','玉溪',130,'mixedTrafficCorridors']]){
  const pair=[stationByName.get(a),stationByName.get(b)].sort().join('|');let count=0;
  for(const train of data.trains){
   if(train.category!=='conventional'||!train.stops.some((id,i)=>i&&[id,train.stops[i-1]].sort().join('|')===pair))continue;
   const segment=g.segments[g.trainRoutes[train.id].legs[pair]];assert.ok(segment,`${train.code}: ${a}-${b}`);
   if(segment.source==='OSM inferred'){assert.ok(segment.inference.lengthKm<maxKm);assert.ok(segment.inference[proof].length);count++;}
  }
  assert.ok(count>=2);
 }
 for(const train of data.trains.filter(t=>['C4962','C4970','C4999'].includes(t.code))){
  assert.equal(train.operator,'GDIC');assert.equal(Object.keys(g.trainRoutes[train.id].legs).length,train.stops.length-1);
 }
 for(const code of ['D84','D86','D87','D88']){
  const train=data.trains.find(t=>t.code===code);assert.ok(train);
  assert.equal(Object.keys(g.trainRoutes[train.id].legs).length,train.stops.length-1);
 }
 let ferryCount=0;
 for(const train of data.trains){
  if(!train.stops.some(id=>stationByName.get('海口')===id))continue;
  for(const gid of Object.values(g.trainRoutes[train.id].legs)){
   const info=g.segments[gid].inference;if(!info?.railFerryWayIds?.length)continue;
   assert.deepEqual(info.railFerryWayIds,[25172513]);assert.ok(info.railFerryApproachWayIds.length);ferryCount++;
  }
 }
 assert.ok(ferryCount>=11);
});
