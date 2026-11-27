// Keep detailed OSM provenance in the downloadable audit database, outside the
// browser's live geometry objects. Split display assets below CDN file limits.
import fs from 'node:fs';
import pathModule from 'node:path';
import {readRouteData} from './read-route-data.mjs';
function packageRoutes(path){
const data=readRouteData(new URL('file://'+pathModule.resolve(path,'routes.json')));
for(const ref of Object.values(data.trainRoutes))for(const id of Object.values(ref.legs))if(!data.segments[id])throw Error(`Missing route variant: ${id}`);
const buckets=Array.from({length:16},()=>({}));
for(const [id,segment] of Object.entries(data.segments)){
 const {inference,...display}=segment;
 buckets[parseInt(id[0],16)][id]=display;
}
fs.mkdirSync(path+'geometry',{recursive:true});
data.segmentFiles=buckets.map((segments,i)=>{
 const filename=`geometry/${i.toString(16)}.json`;
 const payload=JSON.stringify(segments);if(Buffer.byteLength(payload)>25*1024*1024)throw Error('Railway shard exceeds CDN file limit');
 fs.writeFileSync(path+filename,payload);return filename;
});
data.segments={};
fs.writeFileSync(path+'routes.json',JSON.stringify(data));
console.log('Packaged railway geometry in 16 display shards');

}
packageRoutes('dist/timetable/');
const history='dist/timetable/snapshots/';
if(fs.existsSync(history))for(const entry of fs.readdirSync(history,{withFileTypes:true}))if(entry.isDirectory()&&!entry.name.startsWith('.'))packageRoutes(history+entry.name+'/');
