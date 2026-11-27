import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readRouteData} from './read-route-data.mjs';
import {topologyCoordinates} from '../src/rail-geometry.js';
import {topologyDisplayRoutes,passedStations,topologyLeg} from '../src/route-topology.js';
import {trainRouteClass} from '../src/route-colors.js';
import {reachable} from '../src/network.js';
const source=readRouteData();
const {loadSnapshotGeometry}=await import('../src/snapshots.js');
const geometry=await loadSnapshotGeometry('/timetable/',async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync('dist'+url))}));
const data=JSON.parse(fs.readFileSync('dist/timetable/data.json')),stations=new Map(data.stations.map(s=>[s.id,s]));
const key=p=>p.map(n=>n.toFixed(5)).join(',');
let checked=0;
for(const [id,segment]of Object.entries(source.segments)){
 const points=topologyCoordinates(geometry.topology,id).map(key);let i=0;
 for(const point of segment.coordinates.map(key)){while(i<points.length&&points[i]!==point)i++;assert.ok(i<points.length,`Original path vertex missing in ${id}`);}
 checked++;
}
assert.equal(new Set(geometry.topology.sectionIds).size,geometry.topology.sections.length);
const examples=[];
for(const name of ['广州南','重庆西','广州白云']){
 const station=data.stations.find(s=>s.name===name),result=reachable(data,station.id,'2026-11-27'),legs=[],ids=new Set();
 for(const train of result.services)for(let i=1;i<train.path.length;i++){
  const leg=topologyLeg(train,train.path[i-1],train.path[i],geometry,stations);assert.ok(leg,`${train.id}: topology leg missing`);
  const id=leg.id,routeClass=trainRouteClass(train),key=routeClass+'|'+id;if(ids.has(key))continue;ids.add(key);legs.push({id,routeClass});
 }
 const batches=topologyDisplayRoutes(legs,geometry.topology);
 const sectionRefs=legs.reduce((n,leg)=>n+geometry.topology.legs[leg.id].length,0);
 const uniqueSections=new Set(legs.flatMap(leg=>geometry.topology.legs[leg.id].map(ref=>leg.routeClass+'|'+Math.abs(ref)))).size;
 examples.push({station:name,trains:result.services.length,sourceLegs:legs.length,sectionReferences:sectionRefs,uniqueSections,sharedSectionReduction:Math.round((1-uniqueSections/sectionRefs)*1000)/10,renderedChains:batches.reduce((n,b)=>n+b.coordinates.length,0)});
}
let trainsWithPassages=0,totalPassages=0;const samples=[];
for(const train of data.trains){const passages=passedStations(train,geometry,stations);if(passages.length){trainsWithPassages++;totalPassages+=passages.length;if(samples.length<5)samples.push({code:train.code,passingStations:passages.map(p=>stations.get(p.id).name)});}}
const audit=JSON.parse(fs.readFileSync('reports/topology-audit.json'));
Object.assign(audit,{verifiedOriginalLegs:checked,originalPathVerticesPreserved:true,examples,trainsWithPassages,totalPassages,passageSamples:samples});
fs.writeFileSync('reports/topology-audit.json',JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify({checked,examples,trainsWithPassages,totalPassages}));
