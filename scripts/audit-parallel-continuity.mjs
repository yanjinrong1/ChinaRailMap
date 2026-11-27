import fs from 'node:fs';
import {loadSnapshotGeometry} from '../src/snapshots.js';
import {reachable} from '../src/network.js';
import {topologyLeg,topologyDisplayRoutes} from '../src/route-topology.js';
import {trainRouteClass} from '../src/route-colors.js';
import {stationWorldPoint} from '../src/map-model.js';
const geometry=await loadSnapshotGeometry('/timetable/',async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync('dist'+url))}));
const data=JSON.parse(fs.readFileSync('dist/timetable/data.json')),stations=new Map(data.stations.map(s=>[s.id,s]));
const examples=[];
for(const name of ['广州南','广州白云','珠海']){
 const origin=data.stations.find(s=>s.name===name),trains=reachable(data,origin.id,'2026-11-27').services,legs=[],seen=new Set(),edges=new Map(),adjacent=new Map();
 for(const train of trains)for(let i=1;i<train.path.length;i++){
  const leg=topologyLeg(train,train.path[i-1],train.path[i],geometry,stations),routeClass=trainRouteClass(train);if(!leg)continue;const key=leg.id+'|'+routeClass;if(seen.has(key))continue;seen.add(key);legs.push({...leg,routeClass});
  for(const ref of geometry.topology.legs[leg.id]){const id=Math.abs(ref)-1;if(!edges.has(id))edges.set(id,new Set());edges.get(id).add(routeClass);}
 }
 for(const [id,classes]of edges)for(const node of geometry.topology.sections[id].slice(0,2)){if(!adjacent.has(node))adjacent.set(node,[]);adjacent.get(node).push([...classes].sort().join('|'));}
 let boundaries=0;
 for(const [id,masks]of adjacent){const [lat,lng]=geometry.topology.nodes[id];if(lat<26.5||lat>28.1||lng<112.2||lng>114)continue;if(new Set(masks).size>1&&['highspeed','intercity'].some(type=>masks.filter(mask=>mask.split('|').includes(type)).length>=2))boundaries++;}
 const project=([lat,lng])=>stationWorldPoint({lat,lng},9),start=performance.now();
 const batches=topologyDisplayRoutes(legs,geometry.topology,{project,unproject:p=>[p.x,p.y],gap:3.5});
 if(!batches.flatMap(b=>b.coordinates.flat()).every(p=>p.every(Number.isFinite)))throw Error('Invalid offset coordinate');
 examples.push({origin:name,hengyangZhuzhouOldStyleBoundaries:boundaries,colorBatches:batches.length,renderedChains:batches.reduce((n,b)=>n+b.coordinates.length,0),renderMilliseconds:Math.round(performance.now()-start)});
}
const report={cause:'Local color-set changes split chains and recomputed lane positions; independent chain orientation could also flip offsets.',fix:'Continuous per-color chains, consistent operator-wide lanes, and shared oriented offset junctions.',region:{south:26.5,north:28.1,west:112.2,east:114},examples};
fs.writeFileSync('reports/parallel-continuity-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
