import {test} from 'node:test';import assert from 'node:assert/strict';
import {routeTolerance,simplifyIndices,simplifySelection} from './route-lod.js';
test('small-scale detail is removed while zooming in restores source vertices',()=>{
 const points=Array.from({length:100},(_,i)=>({x:i,y:i%2?.7:-.7}));
 assert.equal(simplifyIndices(points,routeTolerance(6)).length,2);
 assert.equal(simplifyIndices(points,routeTolerance(13)).length,100);
 assert.ok(simplifyIndices(points,routeTolerance(11)).length>2);
});
test('major bends, endpoints and explicitly protected points survive simplification',()=>{
 const points=[{x:0,y:0},{x:1,y:.1},{x:5,y:8},{x:9,y:.1},{x:10,y:0}];
 assert.ok(simplifyIndices(points,2).includes(2));assert.deepEqual(simplifyIndices(points,100,new Set([2])),[0,2,4]);
});
test('shared geometry simplifies once for every color without changing source topology',()=>{
 const topology={nodes:[[0,0],[1,.2],[2,0],[3,.2],[4,0]],sections:[[0,1,'CR'],[1,2,'CR'],[2,3,'CR'],[3,4,'CR']]};
 const edges=new Map(topology.sections.map((_,i)=>[i,new Set(['highspeed','intercity'])])),before=JSON.stringify(topology);
 const reduced=simplifySelection(topology,edges,([x,y])=>({x,y}),1);
 assert.equal(reduced.edges.size,1);assert.deepEqual([...reduced.edges.values()][0],new Set(['highspeed','intercity']));assert.equal(JSON.stringify(topology),before);
});
