import fs from 'node:fs';
export function readRouteData(file=new URL('../public/timetable/routes.json',import.meta.url)){
 const data=JSON.parse(fs.readFileSync(file));
 const base=new URL('.',file instanceof URL?file:new URL(file,`file://${process.cwd()}/`));
 for(const filename of data.segmentFiles||[])Object.assign(data.segments,JSON.parse(fs.readFileSync(new URL(filename,base))));
 return data;
}
