import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {demoData} from './data.js';
import {routeParts} from './rail-geometry.js';
const geometry=JSON.parse(fs.readFileSync(new URL('../public/rail-routes.json',import.meta.url)));
const stations=new Map(demoData.stations.map(s=>[s.id,s]));
test('all demo service legs have multi-point rail geometry in both directions',()=>{
 for(const t of demoData.trains){const parts=routeParts(t.stops,stations,geometry);assert.equal(parts.length,t.stops.length-1,t.id);for(const p of parts)assert.ok(p.length>2);}
});
test('reverse travel uses reversed rail geometry',()=>{
 const forward=routeParts(['珠海','中山'],stations,geometry)[0];
 assert.deepEqual(routeParts(['中山','珠海'],stations,geometry)[0],[...forward].reverse());
});
test('unknown or moved imported stations never get invented straight connections',()=>{
 assert.deepEqual(routeParts(['珠海','未知站'],stations,geometry),[]);
 const moved=new Map(stations);moved.set('中山',{...stations.get('中山'),lat:30});
 assert.deepEqual(routeParts(['珠海','中山'],moved,geometry),[]);
});
