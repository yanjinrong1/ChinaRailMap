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
   assert.equal(segment.operator,train.operator);assert.equal(segment.category,train.category);
   if(segment.source==='OSM inferred'){inferred++;assert.ok(segment.inference.wayIds.length);assert.ok(segment.dataDate);}
  }
 }
 assert.equal(unresolved,audit.unresolvedTrainLegs);assert.ok(inferred>30000);
});
