// Retained command name for update compatibility. Unconstrained shortest-path
// filling is deliberately disabled: this compact OSM graph drops highspeed and
// operator tags, so it cannot safely distinguish CR conventional/HSR/GDIC tracks.
import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync('public/timetable/data.json'));
const geometry=JSON.parse(fs.readFileSync('public/timetable/routes.json'));
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
geometry.metadata.policy='Only train-specific source shapes; no unclassified OSM fallback';
geometry.metadata.totalTrainLegs=total;geometry.metadata.availableTrainLegs=available;geometry.metadata.unavailableTrainLegs=total-available;
fs.writeFileSync('public/timetable/routes.json.tmp',JSON.stringify(geometry));fs.renameSync('public/timetable/routes.json.tmp','public/timetable/routes.json');
console.log({totalTrainLegs:total,availableTrainLegs:available,unavailableTrainLegs:total-available,unconstrainedFallback:false});
