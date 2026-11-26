import test from 'node:test';
import assert from 'node:assert/strict';
import {reachable,validateData} from './network.js';
import {demoData} from './data.js';
test('demo station and train references are consistent',()=>{assert.equal(validateData(demoData),demoData);});
test('Zhuhai can reach Beijing West on the same demonstration train',()=>{
 const r=reachable(demoData,'珠海');
 const path=r.destinations.get('北京西')[0].path;
 assert.equal(path[0],'珠海');assert.equal(path.at(-1),'北京西');assert.ok(path.includes('广州南'));assert.ok(!r.destinations.has('珠海'));
});
test('reachability follows stop order and never creates transfers',()=>{
 const d={trains:[{id:'A',stops:['a','b','c']},{id:'B',stops:['c','d']}]};
 assert.deepEqual([...reachable(d,'b').destinations.keys()],['c']);
 assert.equal(reachable(d,'d').services.length,0);
});
test('rejects duplicate IDs, invalid coordinates and missing stop references',()=>{
 const d=structuredClone(demoData);d.stations[0].lat=100;assert.throws(()=>validateData(d));
 const e=structuredClone(demoData);e.trains[0].stops.push('missing');assert.throws(()=>validateData(e));
 const f=structuredClone(demoData);f.stations.push(f.stations[0]);assert.throws(()=>validateData(f));
});
