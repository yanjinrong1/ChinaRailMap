import {test} from 'node:test';import assert from 'node:assert/strict';import {nextMobileSheet} from './mobile-sheet.js';
test('mobile sheet starts closed and opens only when both stations are selected',()=>{
 let state={key:null,expanded:false};state=nextMobileSheet(state,null,null);assert.equal(state.expanded,false);state=nextMobileSheet(state,'A',null);assert.equal(state.expanded,false);state=nextMobileSheet(state,'A','B');assert.equal(state.expanded,true);
});
test('manual collapse survives same-journey rerenders while a new pair reopens it',()=>{
 const open=nextMobileSheet({key:null,expanded:false},'A','B'),closed={...open,expanded:false};assert.equal(nextMobileSheet(closed,'A','B'),closed);assert.equal(nextMobileSheet(closed,'A','C').expanded,true);assert.equal(nextMobileSheet(closed,'B','A').expanded,true);assert.deepEqual(nextMobileSheet(closed,'A',null),{key:null,expanded:false});
});
