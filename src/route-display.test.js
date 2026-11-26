import {test}from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {mergeDisplayRoutes,routeCoverage,focusedStopIds}from './route-display.js';
import {visibleStations}from './map-model.js';
const project=([x,y])=>({x,y});
test('reversed or nearly overlapping geometry is drawn once without changing stored paths',()=>{
 const line=[[0,0],[10,0],[20,0]],reverse=[...line].reverse(),near=[[0,.3],[10,.3],[20,.3]];
 const routes=[line,reverse,near].map(coordinates=>({pair:'A|B',coordinates}));
 const before=JSON.stringify(routes);const display=mergeDisplayRoutes(routes,project);assert.equal(display.length,1);assert.equal(JSON.stringify(routes),before);
});
test('genuinely different branches are retained even with the same endpoints',()=>{
 const a=[[0,0],[10,0],[20,0]],b=[[0,0],[10,7],[20,0]];
 assert.equal(mergeDisplayRoutes([a,b].map(coordinates=>({pair:'A|B',coordinates})),project).length,2);
});
test('opening a train forces its low-priority intermediate stops visible in point-to-point mode',()=>{
 const trains=[{id:'T',path:['A','B','C']}],viaIds=focusedStopIds(trains,'T');
 const stations=['A','B','C','D'].map(id=>({id,minZoom:10}));
 const visible=visibleStations(stations,{zoom:4,contains:()=>true,origin:'A',destination:'C',reachableIds:new Set(['B','C','D']),viaIds,project:()=>({x:1,y:1})});
 assert.deepEqual(visible.map(s=>s.id),['A','B','C']);assert.equal(focusedStopIds(trains,null).size,0);
});
test('Guangzhou Baiyun to Urumqi and Lhasa have timetables but no source shape',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../public/timetable/data.json',import.meta.url))),geometry=JSON.parse(fs.readFileSync(new URL('../public/timetable/routes.json',import.meta.url)));
 const names=new Map(data.stations.map(s=>[s.id,s.name]));
 for(const [code,destination]of [['Z138','乌鲁木齐'],['Z264','拉萨']]){
  const train=data.trains.find(t=>t.code===code&&names.get(t.stops[0])==='广州白云');assert.ok(train);assert.equal(names.get(train.stops.at(-1)),destination);
  const coverage=routeCoverage(train,geometry);assert.equal(coverage.sourceMissing,true);assert.equal(coverage.available,0);assert.ok(coverage.total>10);
  assert.equal(focusedStopIds([{...train,path:train.stops}],train.id).size,train.stops.length);
 }
});
