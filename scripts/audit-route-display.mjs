import fs from 'node:fs';
import {loadSnapshotGeometry} from '../src/snapshots.js';
import {deduplicateParallelLegs,topologyDisplayRoutes,topologyLeg,stationAnchorNodes,stationAnchorPositions} from '../src/route-topology.js';
import {stationWorldPoint} from '../src/map-model.js';
import {reachable} from '../src/network.js';
import {trainRouteClass} from '../src/route-colors.js';
import {routeTolerance} from '../src/route-lod.js';
const geometry=await loadSnapshotGeometry('/timetable/',async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync('dist'+url))}),{runtime:true});
const data=JSON.parse(fs.readFileSync('dist/timetable/data.json')),stations=new Map(data.stations.map(s=>[s.id,s])),project=([lat,lng])=>stationWorldPoint({lat,lng},7),corridors=[];
for(const names of [['天水南','宝鸡南'],['兰州西','定西北'],['宝鸡南','西安北']]){
 const pair=names.sort().join('|'),legs=Object.entries(geometry.segments).filter(([,s])=>['high-speed-emu','emu'].includes(s.category)&&s.stations.map(id=>stations.get(id).name).sort().join('|')===pair).map(([id])=>({id,routeClass:'highspeed'}));
 const display=deduplicateParallelLegs(legs,geometry,project,{pixelTolerance:0});corridors.push({stations:names,sourceVariants:legs.length,displayVariants:display.length});
}
const result=reachable(data,data.stations.find(s=>s.name==='广州白云').id,'2026-11-27'),legs=[],seen=new Set();
for(const train of result.services)for(let i=1;i<train.path.length;i++){const leg=topologyLeg(train,train.path[i-1],train.path[i],geometry,stations);if(!leg)continue;const routeClass=trainRouteClass(train),key=leg.id+'|'+routeClass;if(!seen.has(key)){seen.add(key);legs.push({...leg,routeClass});}}
const selected=deduplicateParallelLegs(legs,geometry,project,{pixelTolerance:0}),levels=[];
for(const zoom of [4,7,10,13]){
 const projection=([lat,lng])=>stationWorldPoint({lat,lng},zoom),options={project:projection,unproject:p=>[p.x,p.y],gap:3.5},count=batches=>batches.reduce((n,b)=>n+b.coordinates.reduce((m,c)=>m+c.length,0),0);
 const before=count(topologyDisplayRoutes(legs,geometry.topology,options)),after=count(topologyDisplayRoutes(selected,geometry.topology,{...options,tolerance:routeTolerance(zoom),protectedNodes:stationAnchorNodes(selected,geometry.topology),anchorPositions:stationAnchorPositions(selected,geometry,stations)}));
 levels.push({zoom,tolerancePixels:routeTolerance(zoom),beforeVertices:before,afterVertices:after,reductionPercent:Math.round((1-after/before)*1000)/10});
}
const report={measurementScope:'Display vertex counts on current snapshot, Guangzhou Baiyun reachable network; original paths and timetable unchanged.',corridorToleranceMeters:400,corridors,levels};
fs.writeFileSync('reports/route-display-performance.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
