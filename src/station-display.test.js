import {test}from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {stationAliases,stationDisplayDataset,stationDisplayGroups,stationDisplayPoint,includeStationCompanions}from './station-display.js';
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
 assert.equal(a.has('BAI'),false);assert.equal(a.has('HBB'),false);
});
test('zoomed co-located stations remain individually selectable despite frequency thinning',()=>{
 const groups=stationDisplayGroups(data),ranked=data.stations.map(s=>({...s,frequency:1})),first=ranked.find(s=>s.id==='GBA');
 assert.deepEqual(includeStationCompanions([first],ranked,groups,8),[first]);
 assert.deepEqual(new Set(includeStationCompanions([first],ranked,groups,9).map(s=>s.id)),new Set(['GBA','GZA']));
});

test('same-operator duplicate codes merge without losing either codes trains or raw routing references',async()=>{
 const {reachable}=await import('./network.js');
 const before=JSON.stringify(data),aliases=stationAliases(data),display=stationDisplayDataset(data,aliases),groups=stationDisplayGroups(display);
 for(const name of ['成都东','武昌','哈尔滨']){
  const sources=data.stations.filter(s=>s.name===name),ids=new Set(sources.map(s=>s.id)),canonical=aliases.get(sources[0].id);
  assert.ok(sources.length>1);assert.equal(new Set(sources.map(s=>aliases.get(s.id))).size,1);
  assert.equal(display.stations.filter(s=>s.name===name).length,1);assert.equal(groups.has(canonical),false);
  const result=reachable(data,canonical,undefined,aliases);
  const expected=data.trains.filter(t=>t.stops.some((id,i)=>ids.has(id)&&i<t.stops.length-1));
  assert.deepEqual(new Set(result.services.map(t=>t.id)),new Set(expected.map(t=>t.id)));
  for(const t of result.services){assert.deepEqual(t.stops,data.trains.find(raw=>raw.id===t.id).stops);assert.ok(ids.has(t.path[0]));}
  for(const id of result.destinations.keys())assert.equal(aliases.get(id),id);
 }
 assert.notEqual(aliases.get('GBA'),aliases.get('GZA'));assert.equal(groups.get('GBA').name,'广州白云（国铁）');
 assert.equal(groups.get('GZA').name,'广州白云（城际）');assert.equal(JSON.stringify(data),before);
});
test('same names in distant places and nearby different names never merge',()=>{
 const stations=[{id:'a',name:'同名',lat:30,lng:110},{id:'b',name:'同名',lat:31,lng:110},{id:'c',name:'另一站',lat:30,lng:110}];
 const aliases=stationAliases({stations,trains:[{operator:'CR',stops:['a','b','c']}]});assert.deepEqual([...aliases],[['a','a'],['b','b'],['c','c']]);
});
