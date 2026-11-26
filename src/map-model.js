import {runsOnDate,timeMinutes} from './service-calendar.js';
export function stationPriorities(data,date){
 const counts=new Map(data.stations.map(s=>[s.id,0])),calendarCache=new Map();
 for(const train of data.trains)train.stops.forEach((id,i)=>{
  let active=true;
  if(date&&data.services&&train.serviceId){const day=Math.floor(timeMinutes(train.times?.[i]?.[1]||'00:00:00')/1440),key=`${train.serviceId}:${day}`;if(!calendarCache.has(key))calendarCache.set(key,runsOnDate(data,train,i,date));active=calendarCache.get(key);}
  if(active)counts.set(id,(counts.get(id)||0)+1);
 });
 return data.stations.map(s=>({...s,frequency:counts.get(s.id)||0})).sort((a,b)=>b.frequency-a.frequency||a.id.localeCompare(b.id)).map((s,rank)=>({...s,tier:rank<100&&s.frequency>0?'major':rank<800&&s.frequency>0?'regional':'minor',minZoom:s.frequency===0?10:rank<30?3:rank<100?5:rank<300?6:rank<800?7:8,radius:Math.min(7,2.3+Math.log2(1+s.frequency)*.48)}));
}
export function selectionTransition(state,action,reachableIds=new Set()){
 const {origin,destination}=state;
 switch(action.type){
  case 'pick':if(!origin)return {origin:action.id,destination:null};if(action.id!==origin&&reachableIds.has(action.id))return {origin,destination:action.id};return state;
  case 'remove-origin':return {origin:destination||null,destination:null};
  case 'remove-destination':return {origin,destination:null};
  case 'reset':return {origin:null,destination:null};
  default:return state;
 }
}
// No origin means no route computation or drawing.
export function selectedPaths(result,destination){return result?(destination?result.destinations.get(destination)||[]:result.services):[];}
export function visibleStations(stations,{zoom,contains,origin,destination,reachableIds,project,cellSize=26}){
 const occupied=new Set(),visible=[];
 for(const s of stations){
  const forced=s.id===origin||s.id===destination;
  if(!contains(s)&&!forced)continue;
  if(origin){if(!forced&&(destination||!reachableIds.has(s.id)))continue;}
  else if(zoom<s.minZoom)continue;
  if(!origin&&!forced){const p=project(s),key=`${Math.floor(p.x/cellSize)},${Math.floor(p.y/cellSize)}`;if(occupied.has(key))continue;occupied.add(key);}
  visible.push(s);
 }
 return visible;
}
