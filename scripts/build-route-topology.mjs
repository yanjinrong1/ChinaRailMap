import {createHash} from 'node:crypto';
// Conservative geometric topology over completed routes. No new routing occurs.
// Exact common vertices/edges are shared across stop patterns; parallel tracks,
// crossings without a common vertex, and different operators remain separate.
export function buildRouteTopology(geometry,stations){
 const nodes=[],nodeByKey=new Map(),sections=[],sectionByKey=new Map(),legs={},pointLegs={},anchors=new Map();
 const node=p=>{const key=p.map(n=>n.toFixed(5)).join(',');if(!nodeByKey.has(key)){nodeByKey.set(key,nodes.length);nodes.push(p);}return nodeByKey.get(key);};
 const pointPaths=new Map(),operatorNodes=new Map();
 for(const [id,segment] of Object.entries(geometry.segments)){
  const path=segment.coordinates.map(node);pointPaths.set(id,path);
  if(!operatorNodes.has(segment.operator))operatorNodes.set(segment.operator,new Set());for(const p of path)operatorNodes.get(segment.operator).add(p);
 }
 // Spatial indexing allows A-C and A-B-C to share the same atomic edges even
 // when only the stopping service supplied the intermediate collinear vertex B.
 const grids=new Map(),cell=.02;
 for(const [operator,ids]of operatorNodes){const grid=new Map();for(const id of ids){const p=nodes[id],key=`${Math.floor(p[0]/cell)},${Math.floor(p[1]/cell)}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(id);}grids.set(operator,grid);}
 const splitCache=new Map();
 function split(a,b,operator){
  const reverse=a>b,key=`${operator}|${Math.min(a,b)}|${Math.max(a,b)}`;
  if(!splitCache.has(key)){
   const start=nodes[Math.min(a,b)],end=nodes[Math.max(a,b)],cos=Math.cos(start[0]*Math.PI/180),dx=(end[1]-start[1])*cos,dy=end[0]-start[0],den=dx*dx+dy*dy,found=[[0,Math.min(a,b)],[1,Math.max(a,b)]];
   if(den){
    const grid=grids.get(operator),steps=Math.ceil(Math.max(Math.abs(end[0]-start[0]),Math.abs(end[1]-start[1]))/cell),seen=new Set();
    for(let k=0;k<=steps;k++){
     const t=steps?k/steps:0,x=Math.floor((start[0]+dy*t)/cell),y=Math.floor((start[1]+(end[1]-start[1])*t)/cell);
     for(let i=x-1;i<=x+1;i++)for(let j=y-1;j<=y+1;j++)for(const id of grid.get(`${i},${j}`)||[]){
      if(seen.has(id)||id===a||id===b)continue;seen.add(id);const p=nodes[id],px=(p[1]-start[1])*cos,py=p[0]-start[0],position=(px*dx+py*dy)/den;
      // Sub-centimeter tolerance only: never collapse nearby parallel railways.
      if(position>1e-8&&position<1-1e-8&&Math.hypot(px-position*dx,py-position*dy)*111320<.01)found.push([position,id]);
     }
    }
   }
   found.sort((a,b)=>a[0]-b[0]);splitCache.set(key,found.map(p=>p[1]));
  }
  const result=splitCache.get(key);return reverse?[...result].reverse():result;
 }
 const stationById=new Map(stations.map(s=>[s.id,s])),locationNames=new Map();
 for(const station of stations){const key=[station.lat,station.lng].join(',');if(!locationNames.has(key))locationNames.set(key,new Set());locationNames.get(key).add(station.name);}
 const distance=(a,b)=>Math.hypot((a[0]-b.lat)*111320,(a[1]-b.lng)*111320*Math.cos(b.lat*Math.PI/180));
 for(const [id,segment]of Object.entries(geometry.segments)){
  const raw=pointPaths.get(id),path=[];
  for(let i=1;i<raw.length;i++){if(raw[i]===raw[i-1])continue;const points=split(raw[i-1],raw[i],segment.operator);if(!path.length)path.push(points[0]);path.push(...points.slice(1));}
  if(!path.length&&raw.length)path.push(raw[0]);
  const refs=[];
  for(let i=1;i<path.length;i++){
   const a=path[i-1],b=path[i];if(a===b)continue;const key=`${segment.operator}|${Math.min(a,b)}|${Math.max(a,b)}`;
   if(!sectionByKey.has(key)){sectionByKey.set(key,sections.length);sections.push([Math.min(a,b),Math.max(a,b),segment.operator]);}
   refs.push((sectionByKey.get(key)+1)*(a<b?1:-1));
  }
  legs[id]=refs;if(!refs.length&&path.length)pointLegs[id]=path[0];
  // A passage requires the very same track node used by a routed stopping
  // service at this station, not merely a railway somewhere near the station.
  for(const [stationId,nodeId]of [[segment.stations[0],path[0]],[segment.stations[1],path.at(-1)]]){
   const station=stationById.get(stationId);if(nodeId===undefined||!station||locationNames.get([station.lat,station.lng].join(',')).size>1||distance(nodes[nodeId],station)>120)continue;
   const key=`${segment.operator}|${nodeId}`;if(!anchors.has(key))anchors.set(key,new Set());anchors.get(key).add(stationId);
  }
 }
 const passages={};
 for(const [id,refs]of Object.entries(legs)){
  const operator=geometry.segments[id].operator,found=[],seen=new Set();
  const path=refs.map(ref=>{const edge=sections[Math.abs(ref)-1];return ref>0?edge[0]:edge[1];});
  if(refs.length){const ref=refs.at(-1),edge=sections[Math.abs(ref)-1];path.push(ref>0?edge[1]:edge[0]);}
  for(let i=0;i<path.length;i++)for(const stationId of anchors.get(`${operator}|${path[i]}`)||[]){if(!seen.has(stationId)){seen.add(stationId);found.push({id:stationId,nodeIndex:i});}}
  if(found.length)passages[id]=found;
 }
 const trainPaths={};
 for(const [id,train]of Object.entries(geometry.trainRoutes))trainPaths[id]=train.stops.slice(1).map((b,i)=>{const a=train.stops[i];return {leg:train.legs[[a,b].sort().join('|')],reverse:a>b};});
 const sectionIds=sections.map(([a,b,operator])=>createHash('sha256').update(operator+'|'+[nodes[a],nodes[b]].map(p=>p.map(n=>n.toFixed(5)).join(',')).sort().join('|')).digest('hex').slice(0,16));
 return {version:1,sectionIds,pointLegs,policy:'Exact shared track geometry; station passage inferred only at a shared stopping-route anchor within 120m, without inferred times.',nodes,sections,legs,passages,trainPaths};
}
