// Keep detailed OSM provenance in the downloadable audit database, outside the
// browser's live geometry objects. Split display assets below CDN file limits.
import fs from 'node:fs';
import pathModule from 'node:path';
import {buildRouteTopology} from './build-route-topology.mjs';
import {readRouteData} from './read-route-data.mjs';
function packageRoutes(path){
const data=readRouteData(new URL('file://'+pathModule.resolve(path,'routes.json')));
for(const ref of Object.values(data.trainRoutes))for(const id of Object.values(ref.legs))if(!data.segments[id])throw Error(`Missing route variant: ${id}`);
const timetable=JSON.parse(fs.readFileSync(path+'data.json'));
const topology=buildRouteTopology(data,timetable.stations);
const topologyPayload=JSON.stringify(topology);
fs.mkdirSync(path+'topology',{recursive:true});
const descriptor={version:topology.version,policy:topology.policy,files:[]};
for(const key of ['nodes','sections','sectionIds','legs','passages','trainPaths','pointLegs']){
 const file='topology/'+key+'.json',payload=JSON.stringify({[key]:topology[key]});
 if(Buffer.byteLength(payload)>25*1024*1024)throw Error('Topology shard exceeds CDN file limit');
 fs.writeFileSync(path+file,payload);descriptor.files.push(file);
}
fs.writeFileSync(path+'topology.json',JSON.stringify(descriptor));data.topologyFile='topology.json';
fs.mkdirSync('reports',{recursive:true});
if(path==='dist/timetable/')fs.writeFileSync('reports/topology-audit.json',JSON.stringify({snapshot:timetable.metadata.release,sourceLegs:Object.keys(data.segments).length,sourcePoints:Object.values(data.segments).reduce((n,s)=>n+s.coordinates.length,0),sharedNodes:topology.nodes.length,sharedSections:topology.sections.length,legSectionReferences:Object.values(topology.legs).reduce((n,s)=>n+s.length,0),trains:Object.keys(topology.trainPaths).length,passageCandidates:Object.values(topology.passages).reduce((n,s)=>n+s.length,0),topologyBytes:Buffer.byteLength(topologyPayload),policy:topology.policy},null,2)+'\n');
const buckets=Array.from({length:16},()=>({}));
for(const [id,segment] of Object.entries(data.segments)){
 const {inference,coordinates,...display}=segment;
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
