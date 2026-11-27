import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {snapshotTravelDate,loadSnapshotGeometry} from './snapshots.js';
import {archiveCurrentSnapshot,writeSnapshotIndex} from '../scripts/snapshot-history.mjs';
test('new releases preserve the complete old database and its geometry without overwriting history',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rail-snapshot-'));
 const write=(id,date,value)=>{
  fs.writeFileSync(path.join(root,'data.json'),JSON.stringify({metadata:{release:id,updatedAt:date,validFrom:date,validTo:date},trains:[value]}));
  fs.mkdirSync(path.join(root,'geometry'),{recursive:true});
  fs.writeFileSync(path.join(root,'routes.json'),JSON.stringify({segmentFiles:['geometry/a.json'],segments:{}}));
  fs.writeFileSync(path.join(root,'geometry/a.json'),JSON.stringify({route:value}));
 };
 try{
  write('old','2026-11-24','old-train');archiveCurrentSnapshot(root,'new');
  write('new','2026-11-27','new-train');
  const index=writeSnapshotIndex(root);assert.equal(index.current,'new');assert.deepEqual(index.snapshots.map(s=>s.id),['new','old']);
  const old=path.join(root,'snapshots/old');assert.deepEqual(JSON.parse(fs.readFileSync(path.join(old,'geometry/a.json'))),{route:'old-train'});
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(old,'data.json'))).trains,['old-train']);
  archiveCurrentSnapshot(root,'new');assert.equal(fs.existsSync(path.join(root,'snapshots/new')),false);
  write('old','2026-11-24','changed');archiveCurrentSnapshot(root,'another');assert.deepEqual(JSON.parse(fs.readFileSync(path.join(old,'data.json'))).trains,['old-train']);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('historical geometry shards load exclusively from the selected release directory',async()=>{
 const calls=[],responses={'routes.json':{segmentFiles:['geometry/0.json'],segments:{}},'geometry/0.json':{old:{coordinates:[[1,2],[3,4]]}}};
 const base='/timetable/snapshots/old/';
 const result=await loadSnapshotGeometry(base,async url=>{calls.push(url);return {ok:true,json:async()=>structuredClone(responses[url.slice(base.length)])};});
 assert.deepEqual(calls,[base+'routes.json',base+'geometry/0.json']);assert.ok(result.segments.old);
 await assert.rejects(loadSnapshotGeometry(base,async()=>({ok:false})),/铁路路径加载失败/);
});
test('historical calendars use the snapshot date while the current version uses today within its validity',()=>{
 const old={id:'old',date:'2026-11-24',validFrom:'2026-11-09',validTo:'2027-02-13'};
 assert.equal(snapshotTravelDate(old,'new','2027-03-01'),'2026-11-24');
 assert.equal(snapshotTravelDate(old,'old','2026-11-27'),'2026-11-27');
 assert.equal(snapshotTravelDate(old,'old','2027-03-01'),'2027-02-13');
});
