// Rendering-only deduplication. The per-train geometry database is never modified.
// Nearby samples collapse only within a sub-pixel corridor at the current zoom.
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
function compact(points){const out=[points[0]];for(let i=1;i<points.length-1;i++)if(Math.hypot(points[i].x-out.at(-1).x,points[i].y-out.at(-1).y)>.5)out.push(points[i]);out.push(points.at(-1));return out;}
function near(a,b,tolerance){
 for(let i=0;i<a.length;i++){let min=Infinity;for(let j=1;j<b.length;j++)min=Math.min(min,segmentDistance(a[i],b[j-1],b[j]));if(min>tolerance)return false;}
 const p=a.at(-1);return b.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<=tolerance);
}
export function mergeDisplayRoutes(routes,project,tolerance=1.25){
 const groups=new Map(),kept=[];
 for(const route of routes){
  if(route.coordinates.length<2)continue;
  const points=compact(route.coordinates.map(project)),group=groups.get(route.pair)||[];
  if(group.some(other=>near(points,other,tolerance)&&near(other,points,tolerance)))continue;
  group.push(points);groups.set(route.pair,group);kept.push(route.coordinates);
 }
 return kept;
}
export function routeCoverage(train,geometry){
 const path=train.path||train.stops,ref=geometry.trainRoutes?.[train.id];
 let available=0,inferred=0;
 for(let i=1;i<path.length;i++){const key=[path[i-1],path[i]].sort().join('|');const segment=geometry.segments?.[ref?.legs[key]];if(segment){available++;if(segment.source==='OSM inferred')inferred++;}}
 return {total:Math.max(0,path.length-1),available,inferred,sourceGeometryMissing:!!ref&&!ref.shapeId,sourceMissing:!!ref&&!ref.shapeId&&available===0};
}
export function focusedStopIds(trains,id){return new Set(trains.find(t=>t.id===id)?.path||[]);}

// Shared geometry is represented once, carrying every service color that uses it.
// Alternating strokes can then show mixed services without inventing parallel tracks.
export function coloredDisplayRoutes(routes,project,tolerance=1.25){
 const groups=new Map(),kept=[];
 for(const route of routes){
  if(route.coordinates.length<2)continue;
  const points=compact(route.coordinates.map(project));let group=groups.get(route.pair);
  if(!group){group=[];groups.set(route.pair,group);}
  let match=group.find(other=>near(points,other.points,tolerance)&&near(other.points,points,tolerance));
  if(!match){match={points,coordinates:route.coordinates,classes:new Set()};group.push(match);kept.push(match);}
  match.classes.add(route.routeClass);
 }
 const batches=new Map();
 for(const route of kept){const classes=[...route.classes].sort(),key=classes.join('|');if(!batches.has(key))batches.set(key,{classes,coordinates:[]});batches.get(key).coordinates.push(route.coordinates);}
 return [...batches.values()];
}
