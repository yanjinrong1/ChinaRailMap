// Visual disambiguation only. Timetable IDs, geographic coordinates and routing
// never change; offsets are stable world-pixel positions at each map zoom.
import {stationWorldPoint} from './map-model.js';
export const STATION_SEPARATION_ZOOM=9;
export function stationDisplayGroups(data){
 const stations=data.stations,parents=stations.map((_,i)=>i),operators=new Map(stations.map(s=>[s.id,new Set()]));
 for(const train of data.trains)for(const id of train.stops)operators.get(id)?.add(train.operator||'unknown');
 const find=i=>parents[i]===i?i:(parents[i]=find(parents[i]));
 for(let i=0;i<stations.length;i++)for(let j=i+1;j<stations.length;j++){
  const a=stations[i],b=stations[j];if(Math.abs(a.lat-b.lat)>.00032)continue;
  const x=(a.lng-b.lng)*111320*Math.cos(a.lat*Math.PI/180),y=(a.lat-b.lat)*111320;
  if(Math.hypot(x,y)<=35)parents[find(j)]=find(i);
 }
 const clusters=new Map();stations.forEach((s,i)=>{const key=find(i);if(!clusters.has(key))clusters.set(key,[]);clusters.get(key).push(s);});
 const result=new Map();
 for(const members of clusters.values()){
  if(members.length<2)continue;members.sort((a,b)=>a.id.localeCompare(b.id));
  const center={lat:members.reduce((n,s)=>n+s.lat,0)/members.length,lng:members.reduce((n,s)=>n+s.lng,0)/members.length};
  const labels=members.map(s=>{const ops=operators.get(s.id);return ops.has('GDIC')?ops.has('CR')?'城际／国铁':'城际':ops.has('CR')?'国铁':'独立站点';});
  members.forEach((s,i)=>{const suffix=labels.filter(label=>label===labels[i]).length>1?`${labels[i]} · ${s.id}`:labels[i];result.set(s.id,{groupId:members[0].id,members:members.map(s=>s.id),index:i,center,suffix,name:`${s.name}（${suffix}）`});});
 }
 return result;
}
export function stationDisplayPoint(station,groups,zoom){
 const group=groups.get(station.id);
 if(!group||zoom<STATION_SEPARATION_ZOOM)return stationWorldPoint(station,zoom);
 const center=stationWorldPoint(group.center,zoom),n=group.members.length;
 if(n===2)return {x:center.x+(group.index===0?-16:16),y:center.y};
 const angle=-Math.PI/2+group.index*2*Math.PI/n,radius=Math.max(19,16/Math.sin(Math.PI/n));
 return {x:center.x+radius*Math.cos(angle),y:center.y+radius*Math.sin(angle)};
}
export function includeStationCompanions(visible,ranked,groups,zoom){
 if(zoom<STATION_SEPARATION_ZOOM)return visible;
 const ids=new Set(visible.map(s=>s.id)),wanted=new Set();
 for(const s of visible)for(const id of groups.get(s.id)?.members||[])wanted.add(id);
 return ranked.filter(s=>ids.has(s.id)||wanted.has(s.id)&&s.frequency>0);
}
