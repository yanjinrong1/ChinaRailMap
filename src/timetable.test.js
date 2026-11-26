import {test}from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {chinaToday,displayTime,importTimetable}from './timetable.js';
import {reachable,validateData}from './network.js';
import {runsOnDate}from './service-calendar.js';
const station=(id)=>({id,name:id,lat:30,lng:110,level:0});
const fixture={stations:['A','B','C'].map(station),services:{S:['2026-11-25']},trains:[{id:'K1',serviceId:'S',stops:['A','B','C'],times:[['23:00:00','23:00:00'],['25:00:00','25:05:00'],['27:00:00','27:00:00']]}]};
test('boarding date is converted to origin service date after midnight',()=>{
 assert.equal(reachable(fixture,'B','2026-11-26').services.length,1);
 assert.equal(reachable(fixture,'B','2026-11-25').services.length,0);
 assert.equal(reachable(fixture,'A','2026-11-25').destinations.size,2);
 assert.equal(reachable(fixture,'A','2026-11-26').destinations.size,0);
 assert.equal(reachable(fixture,'C','2026-11-26').services.length,0);
});
test('times are displayed relative to boarding day and use China date',()=>{
 assert.equal(displayTime('27:00:00','25:05:00'),'03:00');
 assert.equal(displayTime('27:00:00','23:00:00'),'次日 03:00');
 assert.equal(chinaToday(new Date('2026-11-25T20:00:00Z')),'2026-11-26');
});
test('qETRC imports use real coordinate matching and roll midnight times',()=>{
 const q={trains:[{checi:['K1','',''],timetable:[{zhanming:'A',ddsj:'23:00:00',cfsj:'23:05:00'},{zhanming:'B',ddsj:'01:00:00',cfsj:'01:05:00'}]}]};
 const d=importTimetable(q,fixture.stations);assert.deepEqual(d.trains[0].stops,['A','B']);assert.equal(d.trains[0].times[1][1],'25:05:00');assert.equal(d.metadata.dateUnknown,true);
 q.trains[0].timetable[1].zhanming='missing';assert.throws(()=>importTimetable(q,fixture.stations),/无法定位/);
});
test('published snapshot is valid, keeps real stop order and includes calendars and arrival times',()=>{
 const d=validateData(JSON.parse(fs.readFileSync(new URL('../public/timetable/data.json',import.meta.url))));
 assert.equal(d.metadata.kind,'snapshot');assert.ok(d.trains.length>10000);assert.ok(d.stations.length>3000);
 for(const t of d.trains){assert.equal(t.times.length,t.stops.length);assert.ok(d.services[t.serviceId]?.length);assert.ok(!t.code.startsWith('DEMO'));}
 const origin=d.stations.find(s=>s.name==='珠海'),target=d.stations.find(s=>s.name==='北京西');
 const r=reachable(d,origin.id,'2026-11-26');assert.ok(r.destinations.get(target.id)?.some(t=>t.code==='G1044'));assert.equal(reachable(d,origin.id,'2030-01-01').services.length,0);
});
