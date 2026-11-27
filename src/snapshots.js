export function snapshotTravelDate(entry,currentId,today){
 const preferred=entry.id===currentId?today:entry.date;
 return preferred<entry.validFrom?entry.validFrom:preferred>entry.validTo?entry.validTo:preferred;
}
export async function loadSnapshotGeometry(base,fetcher=fetch,{runtime=false}={}){
 const read=async file=>{const r=await fetcher(base+file);if(!r.ok)throw Error('铁路路径加载失败');return r.json();};
 const json=await read('routes.json');json.segments||={};
 if(json.topologyFile){
  json.topology=await read(json.topologyFile);const files=(json.topology.files||[]).filter(file=>!runtime||!/(?:sectionIds|trainPaths)\.json$/.test(file));
  for(let i=0;i<files.length;i+=4)for(const chunk of await Promise.all(files.slice(i,i+4).map(read)))Object.assign(json.topology,chunk);
 }
 const files=json.segmentFiles||[];
 for(let i=0;i<files.length;i+=4){const chunks=await Promise.all(files.slice(i,i+4).map(read));for(const chunk of chunks)Object.assign(json.segments,chunk);}
 return json;
}
