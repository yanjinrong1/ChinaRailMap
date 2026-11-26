export function validateData(data) {
  if (!data || !Array.isArray(data.stations) || !Array.isArray(data.trains)) throw new Error('需要 stations 和 trains 数组，请参考示例文件。');
  if (!data.stations.length || data.stations.length > 20000 || data.trains.length > 100000) throw new Error('站点数量应为 1–20000，车次数量最多 100000。');
  const ids = new Set();
  for (const s of data.stations) {
    if (typeof s.id !== 'string' || !s.id || ids.has(s.id) || typeof s.name !== 'string' || !s.name || !Number.isFinite(s.lat) || Math.abs(s.lat)>90 || !Number.isFinite(s.lng) || Math.abs(s.lng)>180 || ![0,1,2].includes(s.level)) throw new Error('站点须有唯一 id、名称、有效经纬度和 level（0、1、2）。');
    ids.add(s.id);
  }
  const trains = new Set();
  for (const t of data.trains) {
    if (typeof t.id !== 'string' || !t.id || trains.has(t.id) || !Array.isArray(t.stops) || t.stops.length < 2 || t.stops.some(id=>!ids.has(id)) || new Set(t.stops).size!==t.stops.length) throw new Error('车次须有唯一 id 和至少两个按运行方向排列、已定义且不重复的停站。');
    trains.add(t.id);
  }
  return data;
}
export function reachable(data, origin) {
  const destinations = new Map();
  const services = [];
  for (const train of data.trains) {
    const index = train.stops.indexOf(origin);
    if (index < 0 || index === train.stops.length - 1) continue;
    services.push({...train, path:train.stops.slice(index)});
    train.stops.slice(index+1).forEach((id,offset)=>{
      if (!destinations.has(id)) destinations.set(id,[]);
      destinations.get(id).push({...train,path:train.stops.slice(index,index+offset+2)});
    });
  }
  return {destinations,services};
}
