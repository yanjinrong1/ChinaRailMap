// Validate source and inferred geometry. The old compact unclassified graph is
// never used; attributed OSM filling is a separate explicit batch command.
import fs from 'node:fs';
import {readRouteData} from './read-route-data.mjs';
const data=JSON.parse(fs.readFileSync('public/timetable/data.json'));
const geometry=readRouteData();
if(geometry.version!==2)throw Error('Rebuild train-specific geometry with update-timetable.py first.');
let total=0,available=0;
for(const train of data.trains){
 const ref=geometry.trainRoutes[train.id];
 if(!ref||ref.operator!==train.operator||ref.category!==train.category)throw Error(`Routing identity mismatch: ${train.id}`);
 for(let i=1;i<train.stops.length;i++){
  total++;const key=[train.stops[i-1],train.stops[i]].sort().join('|'),segment=geometry.segments[ref.legs[key]];
  if(segment){if(segment.operator!==train.operator||segment.category!==train.category)throw Error('Cross-profile geometry');available++;}
 }
}
geometry.metadata.policy='Source train shapes preferred; attributed, constrained OSM inference marked separately';
geometry.metadata.totalTrainLegs=total;geometry.metadata.availableTrainLegs=available;geometry.metadata.unavailableTrainLegs=total-available;
fs.writeFileSync('public/timetable/routes.json.tmp',JSON.stringify(geometry.segmentFiles?{...geometry,segments:{}}:geometry));fs.renameSync('public/timetable/routes.json.tmp','public/timetable/routes.json');
console.log({totalTrainLegs:total,availableTrainLegs:available,unavailableTrainLegs:total-available,unconstrainedFallback:false});
