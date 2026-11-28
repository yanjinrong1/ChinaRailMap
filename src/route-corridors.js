import {topologyCoordinates} from './rail-geometry.js';
// Display-only station noding. A through A-C shape and stopping A-B/B-C shapes
// can share one corridor even when they came from different source samples.
export function bundleStationCorridors(legs,geometry,stations,{stationKey=id=>id,toleranceMeters=400}={}){
 const anchors=new Map(),paths=new Map();
 const add=(operator,id)=>{id=stationKey(id);const s=stations.get(id);if(!s)return;let group=anchors.get(operator);if(!group){group=new Map();anchors.set(operator,group);}group.set(id,{id,coordinate:[s.lat,s.lng]});};
 for(const leg of legs){const segment=geometry.segments[leg.id];for(const id of segment.stations)add(segment.operator,id);for(const p of geometry.topology.passages?.[leg.id]||[])add(segment.operator,p.id);}
 const chunks=new Map();
 for(const leg of legs){
  const segment=geometry.segments[leg.id],operator=segment.operator;
  if(!paths.has(leg.id))paths.set(leg.id,topologyCoordinates(geometry.topology,leg.id));const coordinates=paths.get(leg.id);if(coordinates.length<2)continue;
  const cos=Math.cos(coordinates[0][0]*Math.PI/180),project=p=>({x:p[1]*111320*cos,y:p[0]*111320}),points=coordinates.map(project),cumulative=[0];
  let south=Infinity,north=-Infinity,west=Infinity,east=-Infinity;
  for(let i=0;i<points.length;i++){const p=coordinates[i];south=Math.min(south,p[0]);north=Math.max(north,p[0]);west=Math.min(west,p[1]);east=Math.max(east,p[1]);if(i)cumulative.push(cumulative[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));}
  const total=cumulative.at(-1),endIds=segment.stations.map(stationKey),end=(id,index)=>{
   const anchor=anchors.get(operator)?.get(id),point=coordinates[index],a=anchor&&project(anchor.coordinate),b=project(point);
   return anchor&&Math.hypot(a.x-b.x,a.y-b.y)<=500?{id,coordinate:anchor.coordinate}:{id:`point:${operator}:${point.join(',')}`,coordinate:point};
  };
  const first=end(endIds[0],0),last=end(endIds[1],coordinates.length-1),matches=[{...first,distance:0},{...last,distance:total}];
  const latMargin=toleranceMeters/111320,lngMargin=latMargin/cos;
  for(const anchor of anchors.get(operator)?.values()||[]){
   if(endIds.includes(anchor.id))continue;const [lat,lng]=anchor.coordinate;if(lat<south-latMargin||lat>north+latMargin||lng<west-lngMargin||lng>east+lngMargin)continue;
   const p=project(anchor.coordinate);let nearest=Infinity,distance=0;
   for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0,d=Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);if(d<nearest){nearest=d;distance=cumulative[i-1]+t*(cumulative[i]-cumulative[i-1]);}}
   if(nearest<=toleranceMeters&&distance>1&&distance<total-1)matches.push({...anchor,distance});
  }
  matches.sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
  for(let i=1;i<matches.length;i++){
   const a=matches[i-1],b=matches[i];if(a.id===b.id||b.distance-a.distance<.1)continue;
   let line=[a.coordinate,...coordinates.filter((_,index)=>cumulative[index]>a.distance+.1&&cumulative[index]<b.distance-.1),b.coordinate];
   const ids=[a.id,b.id];if(ids[0]>ids[1]){ids.reverse();line=line.reverse();}
   const key=operator+'|'+ids.join('|');if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push({operator,ids,coordinates:line,routeClass:leg.routeClass});
  }
 }
 const nodes=[],sections=[],displayLegs=[],displaySegments={},topologyLegs={},nodeIndex=new Map(),edgeIndex=new Map();let variants=0,merged=0,displayCount=0;
 const node=(coordinate,operator,anchor)=>{const key=operator+'|'+(anchor?'station:'+anchor:coordinate.map(n=>n.toFixed(5)).join(','));if(!nodeIndex.has(key)){nodeIndex.set(key,nodes.length);nodes.push(coordinate);}return nodeIndex.get(key);};
 const near=(a,b,tolerance)=>a.every(p=>{let min=Infinity;for(let i=1;i<b.length;i++){const x=b[i].x-b[i-1].x,y=b[i].y-b[i-1].y,den=x*x+y*y,t=den?Math.max(0,Math.min(1,((p.x-b[i-1].x)*x+(p.y-b[i-1].y)*y)/den)):0;min=Math.min(min,Math.hypot(p.x-b[i-1].x-t*x,p.y-b[i-1].y-t*y));if(min<=tolerance)break;}return min<=tolerance;});
 for(const group of chunks.values()){
  group.sort((a,b)=>b.coordinates.length-a.coordinates.length);const kept=[];
  for(const chunk of group){variants++;const cos=Math.cos(chunk.coordinates[0][0]*Math.PI/180),points=chunk.coordinates.map(([lat,lng])=>({x:lng*111320*cos,y:lat*111320}));
   let match=kept.find(other=>near(points,other.points,toleranceMeters)&&near(other.points,points,toleranceMeters));
   if(match){match.classes.add(chunk.routeClass);merged++;}else kept.push({...chunk,points,classes:new Set([chunk.routeClass])});
  }
  for(const chunk of kept){const id=`corridor:${displayCount++}`,path=chunk.coordinates.map((point,i)=>node(point,chunk.operator,i===0?chunk.ids[0]:i===chunk.coordinates.length-1?chunk.ids[1]:null)),refs=[];
   for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];if(a===b)continue;const key=chunk.operator+'|'+[a,b].sort((x,y)=>x-y).join('|');if(!edgeIndex.has(key)){edgeIndex.set(key,sections.length);sections.push([Math.min(a,b),Math.max(a,b),chunk.operator]);}refs.push((edgeIndex.get(key)+1)*(a<b?1:-1));}
   topologyLegs[id]=refs;displaySegments[id]={operator:chunk.operator,stations:chunk.ids};for(const routeClass of chunk.classes)displayLegs.push({id,routeClass});
  }
 }
 return {legs:displayLegs,geometry:{segments:displaySegments,topology:{nodes,sections,legs:topologyLegs,passages:{},pointLegs:{}}},stats:{sourceLegs:legs.length,splitVariants:variants,mergedVariants:merged,corridors:Object.keys(topologyLegs).length}};
}
