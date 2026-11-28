import {test} from 'node:test';import assert from 'node:assert/strict';import {initialStationOptions} from './station-options.js';
test('initial station options use the fifty highest actual frequencies without changing input',()=>{
 const stations=Array.from({length:80},(_,i)=>({id:'s'+i,frequency:i,displayPriority:100-i})),before=JSON.stringify(stations),options=initialStationOptions(stations);
 assert.equal(options.length,50);assert.equal(options[0].frequency,79);assert.equal(options.at(-1).frequency,30);assert.equal(JSON.stringify(stations),before);
});
test('initial options exclude stations with no active trains and break ties consistently',()=>{
 const a={id:'A',frequency:10},b={id:'B',frequency:10};assert.deepEqual(initialStationOptions([{id:'empty',frequency:0},b,a]),[a,b]);assert.deepEqual(initialStationOptions([]),[]);
});
