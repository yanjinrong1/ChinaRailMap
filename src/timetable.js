import {validateData} from './network.js';
export function chinaToday(now=new Date()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export {shiftDate,runsOnDate,timeMinutes} from './service-calendar.js';
import {timeMinutes} from './service-calendar.js';
export function displayTime(time,originTime='00:00:00'){
 if(!time)return '—';const minutes=timeMinutes(time),day=Math.floor(minutes/1440)-Math.floor(timeMinutes(originTime)/1440);
 return `${day>0?day===1?'次日 ':`${day}天后 `:''}${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
}
export function importTimetable(input,knownStations){
 if(Array.isArray(input?.stations))return validateData(input);
 const trains=Array.isArray(input)?input:input?.trains;
 if(!Array.isArray(trains))throw Error('请选择统一 JSON 或含 trains 的 qETRC .pyetgr / .pyetdb 文件。');
 const byName=new Map([...knownStations].map(s=>[s.name,s])),used=new Map(),missing=new Set();
 const result=trains.map((t,i)=>{
  if(!Array.isArray(t.timetable)||t.timetable.length<2)throw Error(`第 ${i+1} 趟车缺少有效 timetable。`);
  let previous=0;
  const times=t.timetable.map(stop=>{
   const row=[stop.ddsj,stop.cfsj].map(v=>{
    if(!/^\d{1,2}:[0-5]\d(?::[0-5]\d)?$/.test(v||''))throw Error(`第 ${i+1} 趟车存在无效到发时刻。`);
    let n=timeMinutes(v);while(n<previous)n+=1440;previous=n;
    return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}:00`;
   });return row;
  });
  const stops=t.timetable.map(stop=>{
   const name=stop.zhanming;if(typeof name!=='string')throw Error('qETRC 站名 zhanming 必须为字符串。');
   const s=byName.get(name);if(!s){missing.add(name);return name;}used.set(s.id,s);return s.id;
  });
  const code=Array.isArray(t.checi)?t.checi[0]:t.checi;if(typeof code!=='string'||!code)throw Error('qETRC 车次缺少 checi。');
  return {id:`qetrc-${i}-${code}`,code,stops,times,line:t.type||''};
 });
 if(missing.size)throw Error(`无法定位 ${missing.size} 个车站：${[...missing].slice(0,8).join('、')}。请用含这些车站经纬度的统一 JSON 导入；未部分导入。`);
 return validateData({metadata:{name:'qETRC 导入时刻表',kind:'import',dateUnknown:true},stations:[...used.values()],trains:result});
}

// Arrival elapsed from the user's boarding stop, not the train's first stop.
// Timetable hours are already unrolled beyond 24:00 by GTFS / the importer.
export function elapsedAtStation(train,stationId){
 if(!train)return null;
 const start=train.originIndex??0,index=train.stops.indexOf(stationId);
 if(index<start||(train.path&&!train.path.includes(stationId)))return null;
 const departure=train.times?.[start]?.[1]||train.times?.[start]?.[0];
 const arrival=train.times?.[index]?.[0]||train.times?.[index]?.[1];
 const valid=t=>/^\d{1,3}:[0-5]\d(?::[0-5]\d)?$/.test(t||'');
 if(!valid(departure)||!valid(arrival))return null;
 const minutes=index===start?0:timeMinutes(arrival)-timeMinutes(departure);
 if(minutes<0)return null;
 return `已行走 ${String(Math.floor(minutes/60)).padStart(2,'0')}：${String(minutes%60).padStart(2,'0')}`;
}
