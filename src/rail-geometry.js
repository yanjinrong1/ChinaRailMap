import {demoData} from './data.js';
export const segmentKey=(a,b)=>[a,b].sort().join('|');
// Never invent geometry for unknown pairs or imported stations at different coordinates.
export function routeParts(path,stations,geometry){
 const parts=[];
 for(let i=1;i<path.length;i++){
  const ids=[path[i-1],path[i]],segment=geometry.segments[segmentKey(...ids)];
  if(!segment||segment.status!=='routed')continue;
  if(ids.some(id=>{const a=stations.get(id),b=geometry.stationCoordinates?.[id]||demoData.stations.find(s=>s.id===id);const lat=Array.isArray(b)?b[0]:b?.lat,lng=Array.isArray(b)?b[1]:b?.lng;return !a||!b||Math.abs(a.lat-lat)>.00001||Math.abs(a.lng-lng)>.00001;}))continue;
  parts.push(ids[0]<ids[1]?segment.coordinates:[...segment.coordinates].reverse());
 }
 return parts;
}
