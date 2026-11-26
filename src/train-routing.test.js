import {readRouteData} from '../scripts/read-route-data.mjs';
import {test}from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {routeParts,routeVariantKey,segmentKey}from './rail-geometry.js';
import {shouldFitSelection}from './map-model.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/timetable/data.json',import.meta.url)));
const geometry=readRouteData();
const stations=new Map(data.stations.map(s=>[s.id,s]));
test('source identity separates same endpoints for EMU and conventional trains',()=>{
 const high=data.trains.find(t=>t.code==='C4231'),regular=data.trains.find(t=>t.code==='Y733');
 const key=Object.keys(geometry.trainRoutes[high.id].legs).find(key=>geometry.trainRoutes[regular.id].legs[key]&&key.split('|').map(id=>stations.get(id).name).includes('磁窑')&&key.split('|').map(id=>stations.get(id).name).includes('兖州'));
 assert.ok(key);const[a,b]=key.split('|');
 const ordered=t=>t.stops.indexOf(a)<t.stops.indexOf(b)?[a,b]:[b,a];
 const hp=routeParts(ordered(high),stations,geometry,high),rp=routeParts(ordered(regular),stations,geometry,regular);
 assert.equal(hp.length,1);assert.equal(rp.length,1);assert.notEqual(routeVariantKey(high,a,b,geometry),routeVariantKey(regular,a,b,geometry));
 assert.notDeepEqual(geometry.segments[geometry.trainRoutes[high.id].legs[key]].coordinates,geometry.segments[geometry.trainRoutes[regular.id].legs[key]].coordinates);
});
test('Guangdong Intercity is identified by corridor stations, not every C train',()=>{
 const gd=data.trains.find(t=>t.code==='C4707'),national=data.trains.find(t=>t.code==='C818');assert.equal(gd.operator,'GDIC');assert.equal(national.operator,'CR');
 const ref=geometry.trainRoutes[gd.id];assert.equal(ref.operator,'GDIC');
 const key=Object.keys(ref.legs)[0],ids=key.split('|');const start=gd.stops.indexOf(ids[0]);const path=gd.stops[start+1]===ids[1]?ids:[...ids].reverse();
 assert.equal(routeParts(path,stations,geometry,gd).length,1);
 assert.deepEqual(routeParts(path,stations,geometry,{...gd,operator:'CR'}),[]);
});
test('missing source geometry never borrows another train or an unrestricted shortest path',()=>{
 const missing=data.trains.find(t=>!Object.keys(geometry.trainRoutes[t.id].legs).length);assert.ok(missing);
 assert.deepEqual(routeParts(missing.stops,stations,geometry,missing),[]);
 const t=data.trains.find(t=>Object.keys(geometry.trainRoutes[t.id].legs).length);assert.deepEqual(routeParts(t.stops,stations,geometry,{...t,id:'unverified-import'}),[]);
 assert.deepEqual(routeParts(t.stops,stations,geometry,{...t,category:'wrong-class'}),[]);
});
test('conventional trains may use their own source path without a blanket high-speed exclusion',()=>{
 const t=data.trains.find(t=>t.category==='conventional'&&Object.keys(geometry.trainRoutes[t.id].legs).length);assert.ok(t);
 assert.ok(routeParts(t.stops,stations,geometry,t).length>0);
});
test('all referenced shapes remain within their train operator and category',()=>{
 for(const t of data.trains){const ref=geometry.trainRoutes[t.id];assert.deepEqual(ref.stops,t.stops);
  for(const id of Object.values(ref.legs)){const s=geometry.segments[id];assert.equal(s.operator,t.operator);assert.equal(s.category,t.category);assert.ok(['train-specific GTFS shape','OSM inferred'].includes(s.source));}
 }
});
test('cancel actions preserve view even when the destination becomes the origin',()=>{
 const before={origin:'A',destination:'B'},promoted={origin:'B',destination:null};
 for(const type of ['remove-origin','remove-destination','reset'])assert.equal(shouldFitSelection({type},before,promoted),false);
 assert.equal(shouldFitSelection({type:'pick'},before,{origin:'A',destination:'C'}),true);
});
