import {runsOnDate,timeMinutes} from './service-calendar.js';
// Fixed world coordinates keep station membership independent of viewport panning.
export function stationWorldPoint(station,zoom){
 const lat=Math.max(-85,Math.min(85,station.lat))*Math.PI/180,scale=256*2**zoom;
 return {x:(station.lng+180)/360*scale,y:(.5-Math.log(Math.tan(Math.PI/4+lat/2))/(2*Math.PI))*scale};
}
function earthPoint(s){const lat=s.lat*Math.PI/180,lng=s.lng*Math.PI/180;return [6371*Math.cos(lat)*Math.cos(lng),6371*Math.cos(lat)*Math.sin(lng),6371*Math.sin(lat)];}
function regionalScores(stations){
 const bins=new Map(),cell=250,key=p=>p.map(v=>Math.floor(v/cell)).join('|');
 for(const s of stations){s.earth=earthPoint(s);const k=key(s.earth);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(s);}
 for(const s of stations){
  const cellId=s.earth.map(v=>Math.floor(v/cell));let strongest=s.frequency;
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
   for(const neighbor of bins.get([cellId[0]+x,cellId[1]+y,cellId[2]+z].join('|'))||[]){
    const distance=Math.hypot(...s.earth.map((v,i)=>v-neighbor.earth[i]));
    if(distance<=cell)strongest=Math.max(strongest,neighbor.frequency*(1-distance/cell));
   }
  }
  s.localImportance=Math.min(1,Math.log1p(s.frequency)/Math.log1p(strongest||1));
 }
 for(const s of stations)delete s.earth;
}
function assignVisibility(stations){
 const active=stations.filter(s=>s.frequency>0),maxFrequency=active[0]?.frequency||1;
 regionalScores(active);
 for(const s of active)s.displayPriority=.4*Math.log1p(s.frequency)/Math.log1p(maxFrequency)+.6*s.localImportance;
 const regional=[...active].sort((a,b)=>b.displayPriority-a.displayPriority||b.frequency-a.frequency||a.id.localeCompare(b.id));
 const chosen=new Set();
 for(let zoom=3;zoom<=13;zoom++){
  const occupied=new Map(),coverage=new Set(),cellSize=28,coverageSize=64;
  const bucket=p=>[Math.floor(p.x/cellSize),Math.floor(p.y/cellSize)];
  const coverageKey=p=>`${Math.floor(p.x/coverageSize)}|${Math.floor(p.y/coverageSize)}`;
  function add(s){const p=stationWorldPoint(s,zoom),k=bucket(p).join('|');if(!occupied.has(k))occupied.set(k,[]);occupied.get(k).push(p);coverage.add(coverageKey(p));if(!chosen.has(s.id)){chosen.add(s.id);s.minZoom=zoom;}}
  function fits(s,distance){const p=stationWorldPoint(s,zoom),[x,y]=bucket(p),span=Math.ceil(distance/cellSize);for(let dx=-span;dx<=span;dx++)for(let dy=-span;dy<=span;dy++)for(const other of occupied.get(`${x+dx}|${y+dy}`)||[])if(Math.hypot(p.x-other.x,p.y-other.y)<distance)return false;return true;}
  for(const s of active)if(chosen.has(s.id))add(s);
  // Preserve absolute-frequency hubs, with actual distance avoidance across cell edges.
  for(const s of active)if(!chosen.has(s.id)&&zoom>=s.nationalMinZoom&&fits(s,28))add(s);
  const threshold=zoom===3?.82:zoom===4?.68:zoom===5?.5:.3,minFrequency=zoom<=4?8:zoom===5?3:1;
  // Fill geographical gaps using the strongest nearby representative, not a province quota.
  for(const s of regional){
   if(chosen.has(s.id)||s.frequency<minFrequency||s.localImportance<threshold)continue;
   if(coverage.has(coverageKey(stationWorldPoint(s,zoom)))||!fits(s,36))continue;
   add(s);s.regionalRepresentative=true;
  }
 }
 for(const s of stations){s.layoutStable=true;s.tier=s.frequency>0&&s.globalRank<100?'major':s.frequency>0&&(s.globalRank<800||s.regionalRepresentative&&s.minZoom<=5)?'regional':'minor';}
}
export function stationPriorities(data,date){
 const counts=new Map(data.stations.map(s=>[s.id,0])),calendarCache=new Map();
 for(const train of data.trains)train.stops.forEach((id,i)=>{
  let active=true;
  if(date&&data.services&&train.serviceId){const day=Math.floor(timeMinutes(train.times?.[i]?.[1]||'00:00:00')/1440),key=`${train.serviceId}:${day}`;if(!calendarCache.has(key))calendarCache.set(key,runsOnDate(data,train,i,date));active=calendarCache.get(key);}
  if(active)counts.set(id,(counts.get(id)||0)+1);
 });
 const ranked=data.stations.map(s=>({...s,frequency:counts.get(s.id)||0})).sort((a,b)=>b.frequency-a.frequency||a.id.localeCompare(b.id)).map((s,rank)=>({...s,globalRank:rank,nationalMinZoom:rank<30?3:rank<100?5:rank<300?6:rank<800?7:8,minZoom:Infinity,radius:Math.min(7,2.3+Math.log2(1+s.frequency)*.48)}));
 assignVisibility(ranked);return ranked;
}
export function selectionTransition(state,action,reachableIds=new Set()){
 const {origin,destination}=state;
 switch(action.type){
  case 'pick':if(!origin)return {origin:action.id,destination:null};if(action.id!==origin&&reachableIds.has(action.id))return {origin,destination:action.id};return state;
  case 'swap':return origin&&destination?{origin:destination,destination:origin}:state;
  case 'remove-origin':return {origin:destination||null,destination:null};
  case 'remove-destination':return {origin,destination:null};
  case 'reset':return {origin:null,destination:null};
  default:return state;
 }
}
// No origin means no route computation or drawing.
export function selectedPaths(result,destination){return result?(destination?result.destinations.get(destination)||[]:result.services):[];}
export function stationSpacing(zoom){return zoom<=8?28:zoom===9?24:zoom===10?20:zoom===11?16:zoom===12?12:8;}
export function stationMarkerDimensions(station,{zoom,selected=false,via=false,passing=false}){
 if(selected)return {radius:8,weight:2.5};
 const scale=zoom<=5?.7:zoom<=7?.82:zoom<=9?.92:1;
 return {radius:(passing?3.5:via?Math.min(5,station.radius||5):station.radius||3)*scale,weight:zoom<=7?.7:1.1};
}
export function visibleStations(stations,{zoom,contains,origin,destination,reachableIds=new Set(),project,viaIds=new Set(),passIds=new Set(),companionIds=new Set(),cellSize=stationSpacing(zoom)}){
 const endpoint=s=>s.id===origin||s.id===destination;
 const candidates=stations.filter(s=>{
  if(endpoint(s))return true;
  if(passIds.has(s.id)&&zoom<9)return false;
  if(origin)return viaIds.has(s.id)||(!destination&&reachableIds.has(s.id));
  return companionIds.has(s.id)||zoom>=s.minZoom;
 });
 const priority=s=>endpoint(s)?0:(viaIds.has(s.id)&&!passIds.has(s.id)||companionIds.has(s.id))?1:passIds.has(s.id)?3:2;
 candidates.sort((a,b)=>priority(a)-priority(b)||(a.minZoom??99)-(b.minZoom??99)||(b.displayPriority||0)-(a.displayPriority||0)||(b.frequency||0)-(a.frequency||0)||a.id.localeCompare(b.id));
 const occupied=new Map(),visible=[],bucket=p=>[Math.floor(p.x/cellSize),Math.floor(p.y/cellSize)];
 // Lay out every eligible candidate before viewport culling, so panning does
 // not change which station wins a local collision at the edge of the screen.
 for(const s of candidates){
  const p=project(s),[x,y]=bucket(p);let fits=true;
  if(!endpoint(s))for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const other of occupied.get(`${x+dx}|${y+dy}`)||[])if(Math.hypot(p.x-other.x,p.y-other.y)<cellSize-1e-8)fits=false;
  if(!fits)continue;
  const key=`${x}|${y}`;if(!occupied.has(key))occupied.set(key,[]);occupied.get(key).push(p);
  if(contains(s)||endpoint(s))visible.push(s);
 }
 return visible;
}

export function shouldFitSelection(action,before,after){
 return action.type==='pick'&&!!after.origin&&(before.origin!==after.origin||before.destination!==after.destination);
}
