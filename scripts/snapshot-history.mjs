// Archive a complete timetable + matching rail geometry before replacing it.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function snapshotEntry(directory,base){
 const {metadata:m}=JSON.parse(fs.readFileSync(path.join(directory,'data.json')));
 if(typeof m.release!=='string'||!/^[a-zA-Z0-9_-]+$/.test(m.release))throw Error('Invalid snapshot release ID');
 if(!fs.existsSync(path.join(directory,'routes.json')))throw Error('Snapshot has no matching geometry');
 return {id:m.release,date:m.updatedAt,base,validFrom:m.validFrom,validTo:m.validTo};
}
export function writeSnapshotIndex(root){
 const current=snapshotEntry(root,'/timetable/'),history=path.join(root,'snapshots');
 const entries=[current];
 if(fs.existsSync(history))for(const item of fs.readdirSync(history,{withFileTypes:true})){
  if(!item.isDirectory()||item.name.startsWith('.'))continue;
  const entry=snapshotEntry(path.join(history,item.name),`/timetable/snapshots/${item.name}/`);
  if(entry.id!==current.id)entries.push(entry);
 }
 entries.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
 const index={version:1,current:current.id,snapshots:entries};
 fs.writeFileSync(path.join(root,'snapshots.json.tmp'),JSON.stringify(index,null,2)+'\n');
 fs.renameSync(path.join(root,'snapshots.json.tmp'),path.join(root,'snapshots.json'));return index;
}
export function archiveCurrentSnapshot(root,incomingId){
 if(!fs.existsSync(path.join(root,'data.json')))return;
 const entry=snapshotEntry(root,'/timetable/');if(entry.id===incomingId)return;
 const history=path.join(root,'snapshots'),destination=path.join(history,entry.id);
 if(fs.existsSync(destination))return; // Published historical releases are immutable.
 fs.mkdirSync(history,{recursive:true});const temporary=fs.mkdtempSync(path.join(history,'.archive-'));
 try{
  for(const name of ['data.json','routes.json','geometry','routing-audit.json','remaining-route-gaps.csv','gap-investigation.json','gap-investigation.csv','LICENSE.txt']){
   const source=path.join(root,name);if(fs.existsSync(source))fs.cpSync(source,path.join(temporary,name),{recursive:true});
  }
  const routes=JSON.parse(fs.readFileSync(path.join(temporary,'routes.json')));
  for(const file of routes.segmentFiles||[])if(!fs.existsSync(path.join(temporary,file)))throw Error('Archive missing geometry shard');
  fs.renameSync(temporary,destination);
 }catch(error){fs.rmSync(temporary,{recursive:true,force:true});throw error;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=path.resolve('public/timetable');
 if(process.argv[2]==='archive')archiveCurrentSnapshot(root,process.argv[3]);
 else writeSnapshotIndex(root);
}
