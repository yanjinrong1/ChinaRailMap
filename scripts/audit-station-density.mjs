import fs from 'node:fs';import assert from 'node:assert/strict';
import {stationPriorities,visibleStations,stationSpacing,stationWorldPoint} from '../src/map-model.js';
import {stationAliases,stationDisplayDataset,stationDisplayGroups,stationDisplayPoint} from '../src/station-display.js';import {reachable} from '../src/network.js';
const data=JSON.parse(fs.readFileSync('public/timetable/data.json')),aliases=stationAliases(data),display=stationDisplayDataset(data,aliases),groups=stationDisplayGroups(display),ranked=stationPriorities(display,'2026-11-28'),results=[];
for(const name of ['哈尔滨','广州南','乌鲁木齐']){
 const station=data.stations.find(s=>s.name===name),origin=aliases.get(station.id),result=reachable(data,origin,'2026-11-28',aliases),reachableIds=new Set(result.destinations.keys()),eligible=ranked.filter(s=>s.id===origin||reachableIds.has(s.id));
 for(const zoom of [4,6,9]){
  const project=s=>stationDisplayPoint(s,groups,zoom),points=eligible.map(project),cx=(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2,cy=(Math.min(...points.map(p=>p.y))+Math.max(...points.map(p=>p.y)))/2;
  for(const [screen,width,height]of [['mobile',390,650],['desktop',1100,760]]){
   const contains=s=>{const p=project(s);return Math.abs(p.x-cx)<=width/2&&Math.abs(p.y-cy)<=height/2;},before=eligible.filter(s=>contains(s)||s.id===origin),after=visibleStations(ranked,{zoom,contains,origin,destination:null,reachableIds,project});
   assert.ok(after.some(s=>s.id===origin));let minDistance=Infinity;for(let i=0;i<after.length;i++)for(let j=0;j<i;j++){const a=project(after[i]),b=project(after[j]);minDistance=Math.min(minDistance,Math.hypot(a.x-b.x,a.y-b.y));}
   assert.ok(minDistance>=stationSpacing(zoom)-1e-8,'Insufficient station spacing');
   results.push({origin:name,screen,zoom,reachableStations:reachableIds.size,beforeVisible:before.length,afterVisible:after.length,minimumGapPixels:Math.round(minDistance*10)/10});
  }
 }
}
const report={date:'2026-11-28',policy:'Same pixel-distance selection on desktop and mobile; endpoints pinned, regional hierarchy preserved, timetable/reachability unchanged.',results};fs.writeFileSync('reports/station-density-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(results.filter(r=>r.origin==='哈尔滨'&&r.zoom===4)));
