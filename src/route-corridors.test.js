import {test} from 'node:test';import assert from 'node:assert/strict';
import {buildRouteTopology} from '../scripts/build-route-topology.mjs';
import {bundleStationCorridors} from './route-corridors.js';
import {topologyDisplayRoutes,stationAnchorNodes,stationAnchorPositions} from './route-topology.js';
function fixture(){
 const stations=['A','B','C','D'].map((id,i)=>({id,name:id,lat:30,lng:110+i*.01})),segments={
 AC:{stations:['A','C'],coordinates:[[30,110],[30,110.02]],operator:'CR'},
 BD:{stations:['B','D'],coordinates:[[30.0001,110.01],[30.0001,110.03]],operator:'CR'},
 AB:{stations:['A','B'],coordinates:[[30.0001,110],[30.0001,110.005],[30.0001,110.01]],operator:'CR'},
 BC:{stations:['B','C'],coordinates:[[30.0001,110.01],[30.0001,110.02]],operator:'CR'},
 detour:{stations:['A','C'],coordinates:[[30,110],[30.1,110.01],[30,110.02]],operator:'CR'},
 other:{stations:['A','C'],coordinates:[[30,110],[30,110.02]],operator:'GDIC'}};
 const geometry={segments,trainRoutes:{}};geometry.topology=buildRouteTopology(geometry,stations);return {geometry,stations:new Map(stations.map(s=>[s.id,s]))};
}
test('express and stopping shapes share corridors despite different station pairs and directional samples',()=>{
 const {geometry,stations}=fixture(),before=JSON.stringify(geometry),legs=['AC','AB','BC'].map(id=>({id,routeClass:'highspeed'}));
 const display=bundleStationCorridors(legs,geometry,stations);assert.equal(display.stats.corridors,2);assert.equal(display.stats.mergedVariants,2);assert.equal(display.legs.length,2);
 assert.equal(JSON.stringify(geometry),before);
});
test('partial overlaps B-C are shared even when neither source leg has matching endpoints',()=>{
 const {geometry,stations}=fixture(),display=bundleStationCorridors([{id:'AC',routeClass:'highspeed'},{id:'BD',routeClass:'highspeed'}],geometry,stations);
 assert.equal(display.stats.corridors,3);assert.equal(display.stats.mergedVariants,1);
 assert.deepEqual(Object.values(display.geometry.segments).map(s=>s.stations.join('|')).sort(),['A|B','B|C','C|D']);
});
test('shared service colors use the same corridor while real detours and operators remain separate',()=>{
 const {geometry,stations}=fixture(),display=bundleStationCorridors([{id:'AC',routeClass:'highspeed'},{id:'BD',routeClass:'intercity'},{id:'detour',routeClass:'highspeed'},{id:'other',routeClass:'highspeed'}],geometry,stations);
 const shared=Object.entries(display.geometry.segments).find(([,s])=>s.operator==='CR'&&s.stations.join('|')==='B|C')[0];
 assert.deepEqual(new Set(display.legs.filter(l=>l.id===shared).map(l=>l.routeClass)),new Set(['highspeed','intercity']));
 assert.ok(Object.values(display.geometry.segments).some(s=>s.operator==='GDIC'));assert.ok(Object.values(display.geometry.segments).some(s=>s.operator==='CR'&&s.stations.join('|')==='A|C'));
});
test('station noding retains exact station alignment after simplification and parallel offsets',()=>{
 const {geometry,stations}=fixture(),display=bundleStationCorridors([{id:'AC',routeClass:'highspeed'},{id:'BD',routeClass:'intercity'}],geometry,stations),g=display.geometry;
 const project=([lat,lng])=>({x:lng*1000,y:lat*1000}),routes=topologyDisplayRoutes(display.legs,g.topology,{project,unproject:p=>[p.x,p.y],gap:4,tolerance:100,protectedNodes:stationAnchorNodes(display.legs,g.topology),anchorPositions:stationAnchorPositions(display.legs,g,stations)});
 for(const id of ['B','C']){const s=stations.get(id);for(const type of ['highspeed','intercity'])assert.ok(routes.filter(b=>b.classes.includes(type)).some(b=>b.coordinates.flat().some(p=>p[0]===s.lng*1000&&p[1]===s.lat*1000)));}
});
