import fs from 'node:fs';
import {railRoute} from 'railroute-ts';
import {CHINA_NETWORK} from '@railroute-ts/china';
const data=JSON.parse(fs.readFileSync('public/timetable/data.json'));
const geometry=JSON.parse(fs.readFileSync('public/timetable/routes.json'));
const stations=new Map(data.stations.map(s=>[s.id,s]));
let count=0,missing=0;
for(const t of data.trains)for(let i=1;i<t.stops.length;i++){
 const ids=[t.stops[i-1],t.stops[i]].sort(),key=ids.join('|');if(geometry.segments[key])continue;
 const [a,b]=ids.map(id=>stations.get(id));
 try{
  const route=railRoute([a.lng,a.lat],[b.lng,b.lat],{network:CHINA_NETWORK,maxSnapDistanceKm:5,ferries:false});
  geometry.segments[key]={status:'routed',coordinates:route.geometry.coordinates.map(([lng,lat])=>[+lat.toFixed(5),+lng.toFixed(5)]),source:'OSM shortest rail path'};count++;
 }catch{geometry.segments[key]={status:'unavailable'};missing++;}
}
geometry.metadata.osm=CHINA_NETWORK.metadata;geometry.metadata.unavailablePairs=missing;
fs.writeFileSync('public/timetable/routes.json.tmp',JSON.stringify(geometry));fs.renameSync('public/timetable/routes.json.tmp','public/timetable/routes.json');
console.log({addedOsmPaths:count,unavailablePairs:missing});
