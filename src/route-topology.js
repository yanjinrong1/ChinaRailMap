import {segmentKey,trainReference} from './rail-geometry.js';
export function topologyLeg(train,a,b,geometry,stations){
 const ref=trainReference(train,geometry),id=ref?.legs[segmentKey(a,b)],segment=geometry.segments[id];
 if(!segment||segment.status!=='routed'||segment.operator!==train.operator||segment.category!==train.category||segment.stations.join('|')!==segmentKey(a,b))return null;
 const index=train.stops.indexOf(a);if(index<0||train.stops[index+1]!==b)return null;
 for(const id of [a,b]){const station=stations.get(id),point=geometry.stationCoordinates?.[id];if(!station||!point||Math.abs(station.lat-point[0])>.00001||Math.abs(station.lng-point[1])>.00001)return null;}
 return geometry.topology?.legs[id]?{id,reverse:a>b}:null;
}
// Group selected edges by service colors, then join degree-two chains. The
// renderer draws one polyline per continuous chain, rather than per service leg.
export function topologyDisplayRoutes(legs,topology){
 const edges=new Map();
 for(const {id,routeClass}of legs)for(const ref of topology.legs[id]||[]){const index=Math.abs(ref)-1;if(!edges.has(index))edges.set(index,new Set());edges.get(index).add(routeClass);}
 const groups=new Map();
 for(const [index,classes]of edges){const types=[...classes].sort(),key=types.join('|')+'|'+topology.sections[index][2];if(!groups.has(key))groups.set(key,{classes:types,edges:[]});groups.get(key).edges.push(index);}
 const batches=[];
 for(const group of groups.values()){
  const adjacent=new Map(),pending=new Set(group.edges),coordinates=[];
  for(const id of pending)for(const node of topology.sections[id].slice(0,2)){if(!adjacent.has(node))adjacent.set(node,[]);adjacent.get(node).push(id);}
  const walk=(first,start)=>{const line=[topology.nodes[start]];let edge=first,node=start;while(pending.has(edge)){pending.delete(edge);const [a,b]=topology.sections[edge];node=node===a?b:a;line.push(topology.nodes[node]);const next=adjacent.get(node);if(next.length!==2)break;edge=next.find(id=>pending.has(id));}coordinates.push(line);};
  for(const [node,ids]of adjacent)if(ids.length!==2)for(const edge of ids)if(pending.has(edge))walk(edge,node);
  for(const edge of pending)walk(edge,topology.sections[edge][0]);
  batches.push({classes:group.classes,coordinates});
 }
 return batches;
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
