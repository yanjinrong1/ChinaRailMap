import {railRoute} from 'railroute-ts';
import {CHINA_NETWORK} from '@railroute-ts/china';
import {demoData} from '../src/data.js';
import {writeFileSync} from 'node:fs';
const stations=new Map(demoData.stations.map(s=>[s.id,s]));
const segments={};
for(const train of demoData.trains)for(let i=1;i<train.stops.length;i++){
 const ids=[train.stops[i-1],train.stops[i]].sort(),key=ids.join('|');if(segments[key])continue;
 const [a,b]=ids.map(id=>stations.get(id));
 try{
  const route=railRoute([a.lng,a.lat],[b.lng,b.lat],{network:CHINA_NETWORK,maxSnapDistanceKm:5,ferries:false});
  // Connectors represent repaired gaps in the source network; preserve that provenance.
  segments[key]={status:'routed',coordinates:route.geometry.coordinates.map(([lng,lat])=>[+lat.toFixed(5),+lng.toFixed(5)]),km:route.properties.length,snapKm:[route.properties.originSnapKm,route.properties.destinationSnapKm]};
 }catch(e){segments[key]={status:'unavailable',reason:e.name};}
}
writeFileSync('public/rail-routes.json',JSON.stringify({metadata:CHINA_NETWORK.metadata,segments}));
console.log(CHINA_NETWORK.metadata);console.log('Routed',Object.values(segments).filter(s=>s.status==='routed').length,'of',Object.keys(segments).length);
console.log('Missing',Object.entries(segments).filter(([,s])=>s.status!=='routed').map(([id,s])=>[id,s.reason]));
