import {test}from 'node:test';
import assert from 'node:assert/strict';
import {selectionTransition,shouldFitSelection}from './map-model.js';
import {elapsedAtStation}from './timetable.js';
import {reachable}from './network.js';
test('swap re-queries the opposite direction without requiring reverse reachability',()=>{
 const state={origin:'A',destination:'B'},next=selectionTransition(state,{type:'swap'},new Set(['B']));
 assert.deepEqual(next,{origin:'B',destination:'A'});
 assert.equal(shouldFitSelection({type:'swap'},state,next),false);
 const data={trains:[{id:'out',stops:['A','B']},{id:'back',stops:['B','A']}]};
 assert.equal(reachable(data,next.origin).destinations.get(next.destination)[0].id,'back');
 assert.equal(selectionTransition({origin:'A',destination:null},{type:'swap'}).origin,'A');
});
test('elapsed arrival starts at the selected boarding station and includes dwell and midnight',()=>{
 const train={stops:['A','B','C','D'],originIndex:1,path:['B','C','D'],times:[['20:00','20:05'],['23:40','23:50'],['25:05','25:15'],['49:10','49:15']]};
 assert.equal(elapsedAtStation(train,'A'),null);
 assert.equal(elapsedAtStation(train,'B'),'已行走 00：00');
 assert.equal(elapsedAtStation(train,'C'),'已行走 01：15');
 assert.equal(elapsedAtStation(train,'D'),'已行走 25：20');
 assert.equal(elapsedAtStation({...train,path:['B','C']},'D'),null);
 assert.equal(elapsedAtStation({...train,times:[]},'C'),null);
 assert.equal(elapsedAtStation(null,'C'),null);
});
