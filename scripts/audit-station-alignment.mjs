import fs from 'node:fs';import assert from 'node:assert/strict';
import {loadSnapshotGeometry} from '../src/snapshots.js';import {reachable} from '../src/network.js';
import {topologyLeg,topologyDisplayRoutes,deduplicateParallelLegs,stationAnchorNodes,stationAnchorPositions} from '../src/route-topology.js';
import {stationAliases} from '../src/station-display.js';import {stationWorldPoint} from '../src/map-model.js';import {trainRouteClass} from '../src/route-colors.js';import {routeTolerance} from '../src/route-lod.js';
const g=await loadSnapshotGeometry('/timetable/',async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync('dist'+url))}),{runtime:true}),data=JSON.parse(fs.readFileSync('dist/timetable/data.json')),stations=new Map(data.stations.map(s=>[s.id,s])),aliases=stationAliases(data),results=[];
for(const name of ['东莞','广州白云'])for(const zoom of [5,7,9]){
 const origin=data.stations.find(s=>s.name===name&&data.trains.some(t=>t.operator==='CR'&&t.stops.includes(s.id))),trains=reachable(data,aliases.get(origin.id),'2026-11-28',aliases).services,legs=[],seen=new Set();
 for(const train of trains)for(let i=1;i<train.path.length;i++){const leg=topologyLeg(train,train.path[i-1],train.path[i],g,stations);if(!leg)continue;const routeClass=trainRouteClass(train),key=leg.id+'|'+routeClass;if(!seen.has(key)){seen.add(key);legs.push({...leg,routeClass});}}
 const project=([lat,lng])=>stationWorldPoint({lat,lng},zoom),selected=deduplicateParallelLegs(legs,g,project,{pixelTolerance:0,stationKey:id=>aliases.get(id)||id}),pins=stationAnchorNodes(selected,g.topology),positions=stationAnchorPositions(selected,g,stations,id=>aliases.get(id)||id);
 const options={project,unproject:p=>[p.x,p.y],gap:3.5,tolerance:routeTolerance(zoom)},before=topologyDisplayRoutes(selected,g.topology,{...options,tolerance:zoom<=5?3.5:zoom<=7?2.5:1.8}),after=topologyDisplayRoutes(selected,g.topology,{...options,protectedNodes:pins,anchorPositions:positions});
 const key=p=>p.map(n=>n.toFixed(6)).join(','),rendered=new Set(after.flatMap(b=>b.coordinates.flat().map(key)));
 let maxBeforeGap=0;
 for(const coordinate of positions.values()){
  const p=project(coordinate);assert.ok(rendered.has(key([p.x,p.y])),'Station anchor was removed or offset');let distance=Infinity;
  for(const batch of before)for(const line of batch.coordinates)for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/den)):0;distance=Math.min(distance,Math.hypot(p.x-a[0]-t*dx,p.y-a[1]-t*dy));}
  maxBeforeGap=Math.max(maxBeforeGap,distance);
 }
 results.push({origin:name,zoom,protectedStationNodes:pins.size,alignedStationNodes:positions.size,maximumOldGapPixels:Math.round(maxBeforeGap*100)/100,newAnchorGapPixels:0,drawnVertices:after.reduce((n,b)=>n+b.coordinates.reduce((m,l)=>m+l.length,0),0)});
}
const report={scope:'Production renderer, 2026-11-28 services, Dongguan and Guangzhou Baiyun; every unambiguous station anchor must survive and align exactly at all tested zoom levels.',results};fs.writeFileSync('reports/station-alignment-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
