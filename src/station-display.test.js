import {test}from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {stationDisplayGroups,stationDisplayPoint,includeStationCompanions}from './station-display.js';
import {stationWorldPoint}from './map-model.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/timetable/data.json',import.meta.url)));
test('Baiyun halls separate by operator without changing source coordinates or IDs',()=>{
 const before=JSON.stringify(data.stations),groups=stationDisplayGroups(data),a=data.stations.find(s=>s.id==='GBA'),b=data.stations.find(s=>s.id==='GZA');
 assert.equal(groups.get('GBA').name,'广州白云（国铁）');assert.equal(groups.get('GZA').name,'广州白云（城际）');
 assert.deepEqual(stationDisplayPoint(a,groups,8),stationWorldPoint(a,8));
 for(const zoom of [9,11,13]){const x=stationDisplayPoint(a,groups,zoom),y=stationDisplayPoint(b,groups,zoom);assert.ok(Math.hypot(x.x-y.x,x.y-y.y)>=32);}
 assert.equal(JSON.stringify(data.stations),before);
 assert.equal(groups.get('HUA').groupId,groups.get('KBA').groupId);
});
test('all co-located IDs have unique labels and stable offsets across station ordering',()=>{
 const a=stationDisplayGroups(data),b=stationDisplayGroups({...data,stations:[...data.stations].reverse()});
 for(const [id,g]of a){assert.equal(g.name,b.get(id).name);const station=data.stations.find(s=>s.id===id);assert.deepEqual(stationDisplayPoint(station,a,11),stationDisplayPoint(station,b,11));}
 const harbin=['BAI','HBB'].map(id=>a.get(id).name);assert.notEqual(...harbin);
});
test('zoomed co-located stations remain individually selectable despite frequency thinning',()=>{
 const groups=stationDisplayGroups(data),ranked=data.stations.map(s=>({...s,frequency:1})),first=ranked.find(s=>s.id==='GBA');
 assert.deepEqual(includeStationCompanions([first],ranked,groups,8),[first]);
 assert.deepEqual(new Set(includeStationCompanions([first],ranked,groups,9).map(s=>s.id)),new Set(['GBA','GZA']));
});
