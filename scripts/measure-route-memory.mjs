// Isolated V8 heap proxy; not a measurement of a complete browser tab or GPU.
import fs from 'node:fs';
import {loadSnapshotGeometry} from '../src/snapshots.js';
const root=process.argv[2]||'dist',runtime=process.argv.includes('--runtime');
global.gc();const before=process.memoryUsage().heapUsed;
const geometry=await loadSnapshotGeometry('/timetable/',async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(root+url))}),{runtime});
globalThis.retainedGeometry=geometry;global.gc();
console.log(JSON.stringify({root,runtime,heapMiB:Math.round((process.memoryUsage().heapUsed-before)/1048576*10)/10,topology:!!geometry.topology,loadedTopologyFields:Object.keys(geometry.topology||{})}));
if(process.argv.includes('--render')){
 const {reachable}=await import('../src/network.js');const {topologyLeg,topologyDisplayRoutes,deduplicateParallelLegs,stationAnchorNodes,stationAnchorPositions}=await import('../src/route-topology.js');
 const {trainRouteClass}=await import('../src/route-colors.js');const {stationWorldPoint}=await import('../src/map-model.js');const {routeTolerance}=await import('../src/route-lod.js');
 const data=JSON.parse(fs.readFileSync(root+'/timetable/data.json')),stations=new Map(data.stations.map(s=>[s.id,s])),trains=reachable(data,data.stations.find(s=>s.name==='广州白云').id,'2026-11-27').services,legs=[],seen=new Set();
 for(const train of trains)for(let i=1;i<train.path.length;i++){const leg=topologyLeg(train,train.path[i-1],train.path[i],geometry,stations);if(!leg)continue;const routeClass=trainRouteClass(train),key=leg.id+'|'+routeClass;if(!seen.has(key)){seen.add(key);legs.push({...leg,routeClass});}}
 const {bundleStationCorridors}=await import('../src/route-corridors.js');
 const optimize=process.argv.includes('--optimize'),project=([lat,lng])=>stationWorldPoint({lat,lng},7);
 global.gc();const startHeap=process.memoryUsage().heapUsed,start=performance.now();
 const prepared=optimize?bundleStationCorridors(legs,geometry,stations):{legs,geometry};
 const selected=prepared.legs,displayGeometry=prepared.geometry;globalThis.retainedDisplayGeometry=displayGeometry;
 globalThis.retainedDrawing=topologyDisplayRoutes(selected,displayGeometry.topology,{project,unproject:p=>[p.x,p.y],gap:3.5,tolerance:optimize?routeTolerance(7):0,...(optimize?{protectedNodes:stationAnchorNodes(selected,displayGeometry.topology),anchorPositions:stationAnchorPositions(selected,displayGeometry,stations)}:{})});
 const allocation=process.memoryUsage().heapUsed-startHeap,elapsed=performance.now()-start;global.gc();
 console.log(JSON.stringify({origin:'广州白云',zoom:7,optimize,sourceLegs:legs.length,displayLegs:selected.length,drawnVertices:globalThis.retainedDrawing.reduce((n,b)=>n+b.coordinates.reduce((m,p)=>m+p.length,0),0),allocationBeforeGC_MiB:Math.round(allocation/1048576*10)/10,retainedDrawingMiB:Math.round((process.memoryUsage().heapUsed-startHeap)/1048576*10)/10,renderMilliseconds:Math.round(elapsed)}));
}
