export function shiftDate(date,days){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function runsOnDate(data,train,index,date){
 if(!date||!data.services||!train.serviceId)return true;
 const days=Math.floor(timeMinutes(train.times?.[index]?.[1]||'00:00:00')/1440);
 return data.services[train.serviceId]?.includes(shiftDate(date,-days))||false;
}
export function timeMinutes(time){if(!/^\d{1,3}:\d{2}(?::\d{2})?$/.test(time||''))return 0;const [h,m]=time.split(':').map(Number);return h*60+m;}
