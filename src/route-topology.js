import {simplifySelection} from './route-lod.js';
import {segmentKey,trainReference,topologyCoordinates} from './rail-geometry.js';
export function topologyLeg(train,a,b,geometry,stations){
 const ref=trainReference(train,geometry),id=ref?.legs[segmentKey(a,b)],segment=geometry.segments[id];
 if(!segment||segment.status!=='routed'||segment.operator!==train.operator||segment.category!==train.category||segment.stations.join('|')!==segmentKey(a,b))return null;
 const index=train.stops.indexOf(a);if(index<0||train.stops[index+1]!==b)return null;
 for(const id of [a,b]){const station=stations.get(id),point=geometry.stationCoordinates?.[id];if(!station||!point||Math.abs(station.lat-point[0])>.00001||Math.abs(station.lng-point[1])>.00001)return null;}
 return geometry.topology?.legs[id]?{id,reverse:a>b}:null;
}
// Draw each service color continuously, independent of changes in the other
// colors sharing an edge. All chains use the same projected junction positions.
export function topologyDisplayRoutes(legs,topology,options={}){
 let edges=new Map();
 for(const {id,routeClass}of legs)for(const ref of topology.legs[id]||[]){const index=Math.abs(ref)-1;if(!edges.has(index))edges.set(index,new Set());edges.get(index).add(routeClass);}
 ({topology,edges}=simplifySelection(topology,edges,options.project,options.tolerance));
 const operators=new Map();
 for(const [index,classes]of edges){const operator=topology.sections[index][2];if(!operators.has(operator))operators.set(operator,{edges:[],classes:new Set()});const group=operators.get(operator);group.edges.push(index);for(const type of classes)group.classes.add(type);}
 const batches=[];
 for(const group of operators.values()){
  const types=[...group.classes].sort(),frames=options.project?junctionFrames(group.edges,topology,options.project):null;
  for(let lane=0;lane<types.length;lane++){
   const type=types[lane],adjacent=new Map(),pending=new Set(group.edges.filter(id=>edges.get(id).has(type))),coordinates=[];
   const offset=(lane-(types.length-1)/2)*(options.gap||3.5);
   const position=node=>{if(!frames)return topology.nodes[node];const f=frames.get(node);return options.unproject({x:f.point.x+f.x*offset*f.scale,y:f.point.y+f.y*offset*f.scale});};
   for(const id of pending)for(const node of topology.sections[id].slice(0,2)){if(!adjacent.has(node))adjacent.set(node,[]);adjacent.get(node).push(id);}
   const walk=(first,start)=>{const line=[position(start)];let edge=first,node=start;while(pending.has(edge)){pending.delete(edge);const [a,b]=topology.sections[edge];node=node===a?b:a;line.push(position(node));const next=adjacent.get(node);if(next.length!==2)break;edge=next.find(id=>pending.has(id));}coordinates.push(line);};
   for(const [node,ids]of adjacent)if(ids.length!==2)for(const edge of ids)if(pending.has(edge))walk(edge,node);
   for(const edge of pending)walk(edge,topology.sections[edge][0]);
   batches.push({classes:[type],coordinates,offsetApplied:!!frames});
  }
 }
 return batches;
}
function junctionFrames(edges,topology,project){
 const adjacent=new Map(),frames=new Map();
 for(const id of edges){const [a,b]=topology.sections[id];for(const [node,neighbor]of [[a,b],[b,a]]){if(!adjacent.has(node))adjacent.set(node,new Set());adjacent.get(node).add(neighbor);}}
 const points=new Map([...adjacent.keys()].map(id=>[id,project(topology.nodes[id])]));
 for(const [node,neighbors]of adjacent){
  const point=points.get(node),vectors=[...neighbors].map(id=>{const p=points.get(id),dx=p.x-point.x,dy=p.y-point.y,len=Math.hypot(dx,dy);return len>1e-9?{x:dx/len,y:dy/len}:null;}).filter(Boolean);
  let first=vectors[0]||{x:1,y:0},second=null,dot=1;
  for(let i=0;i<vectors.length;i++)for(let j=i+1;j<vectors.length;j++){const d=vectors[i].x*vectors[j].x+vectors[i].y*vectors[j].y;if(d<dot){dot=d;first=vectors[i];second=vectors[j];}}
  const tx=second?first.x-second.x:first.x,ty=second?first.y-second.y:first.y,len=Math.hypot(tx,ty)||1;
  frames.set(node,{point,x:-ty/len,y:tx/len,scale:second?Math.min(2,1/Math.max(.5,Math.sqrt((1-dot)/2))):1});
 }
 // Orient the shared normal field once per connected component, rather than
 // independently reversing each short chain (which could swap its offset side).
 const visited=new Set(),order=[...adjacent.keys()].sort((a,b)=>points.get(a).x-points.get(b).x||points.get(a).y-points.get(b).y);
 for(const root of order){if(visited.has(root))continue;const f=frames.get(root);if(f.x<0||(f.x===0&&f.y<0)){f.x=-f.x;f.y=-f.y;}visited.add(root);const queue=[root];
  for(let i=0;i<queue.length;i++){const node=queue[i],frame=frames.get(node);for(const next of adjacent.get(node)){if(visited.has(next))continue;const other=frames.get(next);if(frame.x*other.x+frame.y*other.y<0){other.x=-other.x;other.y=-other.y;}visited.add(next);queue.push(next);}}
 }
 return frames;
}
export function passedStations(train,geometry,stations){
 if(!train||!geometry.topology)return [];
 const stops=new Set(train.stops),seen=new Set(),result=[],path=train.path||train.stops;
 for(let i=1;i<path.length;i++){
  const leg=topologyLeg(train,path[i-1],path[i],geometry,stations);if(!leg)continue;
  let entries=geometry.topology.passages[leg.id]||[];if(leg.reverse)entries=[...entries].reverse();
  for(const entry of entries)if(!stops.has(entry.id)&&!seen.has(entry.id)){seen.add(entry.id);result.push({id:entry.id,status:'pass',inferred:true});}
 }
 return result;
}

// Display-only corridor matching: ignore up/down shape differences for the same
// operator, service color and station pair. Never replace a train's stored path.
export function deduplicateParallelLegs(legs,geometry,project,{pixelTolerance=1,corridorMeters=400,stationKey=id=>id}={}){
 const groups=new Map(),kept=[],cache=new Map();
 const points=id=>{if(!cache.has(id)){const path=topologyCoordinates(geometry.topology,id).map(project);cache.set(id,path);}return cache.get(id);};
 const near=(a,b,tolerance)=>a.every(p=>{let min=Infinity;for(let i=1;i<b.length;i++){const x=b[i].x-b[i-1].x,y=b[i].y-b[i-1].y,den=x*x+y*y,t=den?Math.max(0,Math.min(1,((p.x-b[i-1].x)*x+(p.y-b[i-1].y)*y)/den)):0;min=Math.min(min,Math.hypot(p.x-b[i-1].x-t*x,p.y-b[i-1].y-t*y));if(min<=tolerance)break;}return min<=tolerance;});
 const sorted=[...legs].sort((a,b)=>(geometry.topology.legs[b.id]?.length||0)-(geometry.topology.legs[a.id]?.length||0)||a.id.localeCompare(b.id));
 for(const leg of sorted){
  const segment=geometry.segments[leg.id],key=segment.operator+'|'+leg.routeClass+'|'+segment.stations.map(stationKey).sort().join('|'),path=points(leg.id);
  if(path.length<2){kept.push(leg);continue;}
  const coordinate=geometry.topology.nodes[geometry.topology.sections[Math.abs(geometry.topology.legs[leg.id][0])-1][0]],p=project(coordinate),q=project([coordinate[0]+corridorMeters/111320,coordinate[1]]),tolerance=Math.max(pixelTolerance,Math.hypot(p.x-q.x,p.y-q.y));
  const group=groups.get(key)||[];
  if(group.some(other=>near(path,other,tolerance)&&near(other,path,tolerance)))continue;
  group.push(path);groups.set(key,group);kept.push(leg);
 }
 return kept;
}
