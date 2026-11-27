import {demoData} from './data.js';
export const segmentKey=(a,b)=>[a,b].sort().join('|');
export function trainReference(train,geometry){
 if(!train)return null;
 const ref=geometry.trainRoutes?.[train.id];
 if(!ref||ref.code!==(train.code||train.id)||ref.operator!==train.operator||ref.category!==train.category||ref.stops.length!==train.stops.length||ref.stops.some((id,i)=>id!==train.stops[i]))return null;
 return ref;
}
export function routeVariantKey(train,a,b,geometry){
 const ref=trainReference(train,geometry),id=ref?.legs[segmentKey(a,b)];
 return id?`${ref.operator}|${ref.category}|${id}`:`unavailable|${train?.operator||'unknown'}|${train?.category||'unknown'}|${segmentKey(a,b)}`;
}
// A geometry is bound to its source train, operator, category and ordered timetable.
// Equal endpoints alone never authorize using another train's route.
export function routeParts(path,stations,geometry,train){
 const parts=[],ref=geometry.version===2?trainReference(train,geometry):null;
 if(geometry.version===2&&!ref)return parts;
 if(geometry.version!==2&&train&&!train.id.startsWith('DEMO-'))return parts;
 for(let i=1;i<path.length;i++){
  const ids=[path[i-1],path[i]],key=segmentKey(...ids),segment=geometry.segments[geometry.version===2?ref.legs[key]:key];
  if(!segment||segment.status!=='routed')continue;
  if(geometry.version===2){
   const start=train.stops.indexOf(ids[0]);
   if(start<0||train.stops[start+1]!==ids[1]||segment.operator!==ref.operator||segment.category!==ref.category||segment.stations.join('|')!==key)continue;
  }
  if(ids.some(id=>{const a=stations.get(id),b=geometry.stationCoordinates?.[id]||demoData.stations.find(s=>s.id===id);const lat=Array.isArray(b)?b[0]:b?.lat,lng=Array.isArray(b)?b[1]:b?.lng;return !a||!b||Math.abs(a.lat-lat)>.00001||Math.abs(a.lng-lng)>.00001;}))continue;
  const coordinates=segment.coordinates||topologyCoordinates(geometry.topology,idFromSegment(ref,ids));
  parts.push(ids[0]<ids[1]?coordinates:[...coordinates].reverse());
 }
 return parts;
}
export const categoryLabels={'high-speed-emu':'高速动车','emu':'动车','intercity-emu':'城际动车','suburban':'市域／城际','conventional':'普速列车','unknown':'车种未核验'};
export const operatorLabels={CR:'国铁（源数据标注）',GDIC:'广东城际'};

function idFromSegment(ref,ids){return ref?.legs[segmentKey(...ids)];}
export function topologyCoordinates(topology,id){
 const refs=topology?.legs[id];if(!refs?.length){const node=topology?.pointLegs?.[id];return node===undefined?[]:[topology.nodes[node]];}
 const points=refs.map(ref=>{const [a,b]=topology.sections[Math.abs(ref)-1];return topology.nodes[ref>0?a:b];});
 const last=refs.at(-1),[a,b]=topology.sections[Math.abs(last)-1];points.push(topology.nodes[last>0?b:a]);return points;
}
