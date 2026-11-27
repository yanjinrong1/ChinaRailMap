import {test}from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {trainRouteClass}from './route-colors.js';import {coloredDisplayRoutes,offsetRoute}from './route-display.js';
const project=([x,y])=>({x,y});
test('current snapshot train categories consistently match requested visual groups',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../public/timetable/data.json',import.meta.url)));
 const categories={'high-speed-emu':'highspeed',emu:'highspeed','intercity-emu':'intercity',suburban:'intercity',conventional:'conventional'};
 for(const train of data.trains)assert.equal(trainRouteClass(train),categories[train.category],train.code);
 assert.equal(trainRouteClass(data.trains.find(t=>t.code==='D84')),'highspeed'); // Display group, not a permission to use high-speed-only tracks.
 assert.equal(trainRouteClass(data.trains.find(t=>t.code==='C4962')),'intercity');
});
test('shared and reversed tracks retain all service colors without duplicate parallel geometry',()=>{
 const a=[[0,0],[10,0],[20,0]],routes=[{pair:'A|B',coordinates:a,routeClass:'highspeed'},{pair:'A|B',coordinates:[...a].reverse(),routeClass:'conventional'},{pair:'A|B',coordinates:a,routeClass:'intercity'},{pair:'A|B',coordinates:a,routeClass:'highspeed'}];
 const before=JSON.stringify(routes),batches=coloredDisplayRoutes(routes,project);
 assert.equal(batches.length,1);assert.equal(batches[0].coordinates.length,1);
 assert.deepEqual(new Set(batches[0].classes),new Set(['highspeed','conventional','intercity']));assert.equal(JSON.stringify(routes),before);
});
test('distinct high-speed and conventional branches are not collapsed just because endpoints match',()=>{
 const routes=[{pair:'A|B',coordinates:[[0,0],[10,0],[20,0]],routeClass:'highspeed'},{pair:'A|B',coordinates:[[0,0],[10,8],[20,0]],routeClass:'conventional'}];
 const batches=coloredDisplayRoutes(routes,project);assert.equal(batches.length,2);assert.ok(batches.every(b=>b.classes.length===1));
});

test('parallel offsets are direction-independent, bounded at bends, and do not mutate geometry',()=>{
 const line=[[0,0],[10,0],[10,10]],before=JSON.stringify(line),unproject=p=>[p.x,p.y];
 const forward=offsetRoute(line,3,project,unproject);
 assert.deepEqual(forward,offsetRoute([...line].reverse(),3,project,unproject));
 assert.deepEqual(forward[0],[0,3]);assert.deepEqual(offsetRoute(line,-3,project,unproject)[0],[0,-3]);
 forward.forEach((p,i)=>assert.ok(Math.hypot(p[0]-line[i][0],p[1]-line[i][1])<=6));
 assert.equal(JSON.stringify(line),before);assert.equal(offsetRoute(line,0,project,unproject),line);
 const hairpin=offsetRoute([[0,0],[10,0],[0,.001]],3,project,unproject);assert.ok(hairpin.flat().every(Number.isFinite));
});
