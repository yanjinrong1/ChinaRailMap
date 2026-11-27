import {test} from 'node:test';import assert from 'node:assert/strict';
import {buildRouteTopology} from '../scripts/build-route-topology.mjs';
import {topologyDisplayRoutes,passedStations} from './route-topology.js';
import {topologyCoordinates} from './rail-geometry.js';
function fixture(){
 const stations=[{id:'A',lat:30,lng:110},{id:'B',lat:30,lng:110.01},{id:'C',lat:30,lng:110.02},{id:'Nearby',lat:30.002,lng:110.01}];
 const segment=(ids,coordinates,operator='CR')=>({status:'routed',stations:ids,coordinates,operator,category:'emu'});
 const train=(id,stops,legs,operator='CR')=>({id,code:id,stops,operator,category:'emu',legs});
 const geometry={version:2,segments:{AC:segment(['A','C'],[[30,110],[30,110.02]]),AB:segment(['A','B'],[[30,110],[30,110.01]]),BC:segment(['B','C'],[[30,110.01],[30,110.02]]),parallel:segment(['A','C'],[[30.0001,110],[30.0001,110.02]]),other:segment(['A','C'],[[30,110],[30,110.02]],'GDIC')},trainRoutes:{D1:train('D1',['A','C'],{'A|C':'AC'}),D2:train('D2',['A','B','C'],{'A|B':'AB','B|C':'BC'})},stationCoordinates:Object.fromEntries(stations.map(s=>[s.id,[s.lat,s.lng]]))};
 geometry.topology=buildRouteTopology(geometry,stations);return {stations,geometry};
}
test('express and stopping services share atomic sections despite different stop patterns',()=>{
 const {geometry:g}=fixture(),t=g.topology;
 assert.deepEqual(t.legs.AC,[...t.legs.AB,...t.legs.BC]);
 const batches=topologyDisplayRoutes([{id:'AC',routeClass:'highspeed'},{id:'AB',routeClass:'highspeed'},{id:'BC',routeClass:'highspeed'}],t);
 assert.equal(batches.length,1);assert.equal(batches[0].coordinates.length,1);assert.equal(batches[0].coordinates[0].length,3);
 assert.deepEqual(t.trainPaths.D1,[{leg:'AC',reverse:false}]);assert.equal(t.trainPaths.D2.length,2);
 assert.deepEqual(topologyCoordinates(t,'AC'),[[30,110],[30,110.01],[30,110.02]]);
});
test('parallel tracks and separate operators are never merged',()=>{
 const {geometry:g}=fixture(),t=g.topology;
 for(const id of ['parallel','other'])assert.ok(t.legs[id].every(ref=>!t.legs.AC.includes(ref)));
});
test('passing stations require a shared stopping-track anchor, never just proximity',()=>{
 const {geometry:g,stations}=fixture(),byId=new Map(stations.map(s=>[s.id,s]));
 const express={...g.trainRoutes.D1,path:['A','C']},stopping={...g.trainRoutes.D2,path:['A','B','C']};
 assert.deepEqual(passedStations(express,g,byId),[{id:'B',status:'pass',inferred:true}]);assert.deepEqual(passedStations(stopping,g,byId),[]);
 const reverse={...express,id:'D3',code:'D3',stops:['C','A'],path:['C','A']};g.trainRoutes.D3={...reverse,legs:{'A|C':'AC'}};
 assert.equal(passedStations(reverse,g,byId)[0].id,'B');
 assert.deepEqual(passedStations({...express,operator:'GDIC'},g,byId),[]);
});
test('shared classes are drawn once each and reversed paths retain direction',()=>{
 const {geometry:g}=fixture(),t=g.topology;
 const batches=topologyDisplayRoutes([{id:'AC',routeClass:'highspeed'},{id:'AC',routeClass:'highspeed'},{id:'AB',routeClass:'conventional'}],t);
 assert.deepEqual(batches.map(b=>b.classes[0]).sort(),['conventional','highspeed']);assert.equal(batches.reduce((n,b)=>n+b.coordinates.reduce((m,c)=>m+c.length-1,0),0),3);
 assert.equal(batches.find(b=>b.classes[0]==='highspeed').coordinates.length,1);
});

test('section IDs remain stable if source route order is changed',()=>{
 const {geometry:g,stations}=fixture(),ids=new Set(g.topology.sectionIds);
 const reversed={...g,segments:Object.fromEntries(Object.entries(g.segments).reverse())};
 assert.deepEqual(new Set(buildRouteTopology(reversed,stations).sectionIds),ids);
});

test('zero-length source legs retain their location without inventing a section',()=>{
 const {geometry:g,stations}=fixture();g.segments.zero={...g.segments.AB,coordinates:[[30,110],[30,110]]};
 const topology=buildRouteTopology(g,stations);assert.deepEqual(topology.legs.zero,[]);assert.deepEqual(topologyCoordinates(topology,'zero'),[[30,110]]);
});

test('ambiguous station locations with different names cannot become inferred passing stations',()=>{
 const {geometry:g,stations}=fixture();stations.forEach(s=>s.name=s.id);stations.push({id:'Wrong',name:'Different station',lat:30,lng:110.01});
 g.topology=buildRouteTopology(g,stations);assert.deepEqual(passedStations({...g.trainRoutes.D1,path:['A','C']},g,new Map(stations.map(s=>[s.id,s]))),[]);
});

const screen={project:([x,y])=>({x,y}),unproject:p=>[p.x,p.y],gap:4};
test('a color stays continuous and keeps its lane when companion colors start and end',()=>{
 const topology={nodes:[[0,0],[10,0],[20,0],[30,0]],sections:[[0,1,'CR'],[1,2,'CR'],[2,3,'CR']],legs:{red:[1,2,3],blueStart:[1],blueEnd:[3]}};
 const routes=topologyDisplayRoutes([{id:'red',routeClass:'highspeed'},{id:'blueStart',routeClass:'intercity'},{id:'blueEnd',routeClass:'intercity'}],topology,screen);
 const red=routes.find(b=>b.classes[0]==='highspeed');assert.deepEqual(red.coordinates,[[[0,-2],[10,-2],[20,-2],[30,-2]]]);
 const blue=routes.find(b=>b.classes[0]==='intercity');assert.equal(blue.coordinates.length,2);assert.ok(blue.coordinates.flat().every(p=>p[1]===2));
});
test('all branches meet at the exact same offset junction without endpoint gaps',()=>{
 const topology={nodes:[[0,0],[10,0],[20,0],[10,10]],sections:[[0,1,'CR'],[1,2,'CR'],[1,3,'CR']],legs:{red:[1,2,3],blue:[1,2]}};
 const routes=topologyDisplayRoutes([{id:'red',routeClass:'highspeed'},{id:'blue',routeClass:'intercity'}],topology,screen);
 const red=routes.find(b=>b.classes[0]==='highspeed');assert.equal(red.coordinates.length,3);
 const ends=red.coordinates.flatMap(line=>[line[0],line.at(-1)]),counts=new Map();for(const p of ends){const key=p.join(',');counts.set(key,(counts.get(key)||0)+1);}assert.ok([...counts.values()].includes(3));
});
test('opposite section traversal and reordered legs produce the same parallel lanes',()=>{
 const topology={nodes:[[0,0],[10,5],[20,0]],sections:[[0,1,'CR'],[1,2,'CR']],legs:{forward:[1,2],reverse:[-2,-1]}};
 const a=topologyDisplayRoutes([{id:'forward',routeClass:'highspeed'},{id:'reverse',routeClass:'intercity'}],topology,screen);
 const b=topologyDisplayRoutes([{id:'reverse',routeClass:'intercity'},{id:'forward',routeClass:'highspeed'}],topology,screen);
 const normalize=batches=>batches.map(b=>[b.classes[0],b.coordinates.flat().map(p=>p.join(',')).sort()]).sort();assert.deepEqual(normalize(a),normalize(b));
});
