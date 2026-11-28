export function initialStationOptions(stations,limit=50){
 return stations.filter(s=>s.frequency>0).sort((a,b)=>b.frequency-a.frequency||a.id.localeCompare(b.id)).slice(0,limit);
}
