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
 const overrides=new Map([...(options.anchorPositions||[])].map(([id,point])=>[topology.nodes[id],point]));
 const project=options.project?(point=>options.project(overrides.get(point)||point)):null;
 let edges=new Map();
 for(const {id,routeClass}of legs)for(const ref of topology.legs[id]||[]){const index=Math.abs(ref)-1;if(!edges.has(index))edges.set(index,new Set());edges.get(index).add(routeClass);}
 ({topology,edges}=simplifySelection(topology,edges,project,options.tolerance,options.protectedNodes));
 const operators=new Map();
 for(const [index,classes]of edges){const operator=topology.sections[index][2];if(!operators.has(operator))operators.set(operator,{edges:[],classes:new Set()});const group=operators.get(operator);group.edges.push(index);for(const type of classes)group.classes.add(type);}
 const batches=[];
 for(const group of operators.values()){
  const types=[...group.classes].sort(),frames=options.project?junctionFrames(group.edges,topology,project,options.protectedNodes):null;
  for(let lane=0;lane<types.length;lane++){
   const type=types[lane],adjacent=new Map(),pending=new Set(group.edges.filter(id=>edges.get(id).has(type))),coordinates=[];
   const offset=(lane-(types.length-1)/2)*(options.gap||3.5);
   const position=node=>{if(!frames)return topology.nodes[node];const f=frames.get(node);return options.unproject({x:f.point.x+f.x*offset*f.scale*f.taper,y:f.point.y+f.y*offset*f.scale*f.taper});};
   for(const id of pending)for(const node of topology.sections[id].slice(0,2)){if(!adjacent.has(node))adjacent.set(node,[]);adjacent.get(node).push(id);}
   const walk=(first,start)=>{const line=[position(start)];let edge=first,node=start;while(pending.has(edge)){pending.delete(edge);const [a,b]=topology.sections[edge];node=node===a?b:a;line.push(position(node));const next=adjacent.get(node);if(next.length!==2)break;edge=next.find(id=>pending.has(id));}coordinates.push(line);};
   for(const [node,ids]of adjacent)if(ids.length!==2)for(const edge of ids)if(pending.has(edge))walk(edge,node);
   for(const edge of pending)walk(edge,topology.sections[edge][0]);
   batches.push({classes:[type],coordinates,offsetApplied:!!frames});
  }
 }
 return batches;
}
function junctionFrames(edges,topology,project,protectedNodes=new Set()){
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
 // Bring parallel strokes together at station anchors, with a short screen-
 // space taper, so marker locations and route geometry stay aligned.
 const grid=new Map(),radius=10;
 for(const id of protectedNodes){const p=points.get(id);if(!p)continue;const key=`${Math.floor(p.x/radius)},${Math.floor(p.y/radius)}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(p);}
 for(const [id,f]of frames){let distance=radius;const x=Math.floor(f.point.x/radius),y=Math.floor(f.point.y/radius);
  for(let i=x-1;i<=x+1;i++)for(let j=y-1;j<=y+1;j++)for(const p of grid.get(`${i},${j}`)||[])distance=Math.min(distance,Math.hypot(f.point.x-p.x,f.point.y-p.y));
  f.taper=protectedNodes.has(id)?0:distance/radius;
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

// Retain stops and inferred passages on the selected display geometry. These
// pins affect display simplification/offsets only, never source station locations.
export function stationAnchorNodes(legs,topology){
 const nodes=new Set();
 const at=(refs,index)=>{if(!refs.length)return undefined;const last=index>=refs.length,ref=refs[last?refs.length-1:index],[a,b]=topology.sections[Math.abs(ref)-1];return last?(ref>0?b:a):(ref>0?a:b);};
 for(const {id}of legs){const refs=topology.legs[id]||[];
  for(const index of [0,refs.length,...(topology.passages?.[id]||[]).map(p=>p.nodeIndex)]){const node=at(refs,index);if(node!==undefined)nodes.add(node);}
  if(topology.pointLegs?.[id]!==undefined)nodes.add(topology.pointLegs[id]);
 }
 return nodes;
}

export function stationAnchorPositions(legs,geometry,stations,stationKey=id=>id){
 const topology=geometry.topology,positions=new Map(),ambiguous=new Set();
 const nodeAt=(refs,index)=>{if(!refs.length)return undefined;const last=index>=refs.length,ref=refs[last?refs.length-1:index],[a,b]=topology.sections[Math.abs(ref)-1];return last?(ref>0?b:a):(ref>0?a:b);};
 for(const {id}of legs){const refs=topology.legs[id]||[],segment=geometry.segments[id];
  const anchors=[{id:segment.stations[0],nodeIndex:0},{id:segment.stations[1],nodeIndex:refs.length},...(topology.passages?.[id]||[])];
  for(const entry of anchors){const node=nodeAt(refs,entry.nodeIndex),station=stations.get(stationKey(entry.id));if(node===undefined||!station||ambiguous.has(node))continue;
   const point=topology.nodes[node],distance=Math.hypot((point[0]-station.lat)*111320,(point[1]-station.lng)*111320*Math.cos(station.lat*Math.PI/180));if(distance>500)continue;
   const coordinate=[station.lat,station.lng],previous=positions.get(node);
   if(previous&&Math.hypot((previous[0]-coordinate[0])*111320,(previous[1]-coordinate[1])*111320*Math.cos(station.lat*Math.PI/180))>30){positions.delete(node);ambiguous.add(node);}else positions.set(node,coordinate);
  }
 }
 return positions;
}
