import {pinyin} from 'pinyin-pro';
export const languageForCountry=country=>['CN','HK','MO','TW'].includes(String(country).toUpperCase())?'zh':'en';
export const languageForBrowser=languages=>(languages||[]).some(value=>/^zh(?:-|$)/i.test(value))?'zh':'en';
export const LANGUAGE_KEY='china-rail-language';
const words={
 '中国铁路互动地图':'China Interactive Rail Map','中国铁路互动地图首页':'China Interactive Rail Map home','国铁标志':'China Railway emblem','中国铁路地图':'China railway map',
 '正在加载数据库…':'Loading database…','正在加载铁路路径…':'Loading railway routes…','地图工具':'Map tools','数据来源与说明':'Data & sources','地图与线条':'Map & lines','回到全国视图':'Reset map view','放大地图':'Zoom in','缩小地图':'Zoom out','放大':'Zoom in','缩小':'Zoom out','关闭地图与线条':'Close map settings','底图风格':'Map style','深色':'Dark','简洁浅色':'Light','彩色地图':'Color','OSM 标准':'OSM Standard','完整街道信息':'Full street detail','线条粗细 · 全局':'Line width · global','细（默认）':'Thin (default)','粗':'Thick','地图数据来自 OpenStreetMap':'Map data © OpenStreetMap','重新加载底图':'Reload map','地图图例':'Map legend','主要枢纽':'Major hubs','区域枢纽':'Regional hubs','一般车站':'Other stations','可达线路':'Reachable routes','大小按车次，显示兼顾区域':'Size by frequency; visibility balances regions','关闭':'Close','正在加载时刻表':'Loading timetable','正在读取数据版本…':'Loading data version…','时刻表来源与更新':'Timetable source & updates','自动缺线清单':'Route coverage audit','qETRC 项目':'qETRC project','导入时刻表':'Import timetable','恢复内置快照':'Restore snapshot','下载时刻表格式示例':'Download timetable example',
 '选择始发站':'Choose departure','点击地图车站':'Click a station','放大地图可选择更多车站':'Zoom in to select more stations','始发车站':'Departure','始发':'From','目的地':'Destination','终点站':'Terminus','始发站':'First station','取消始发站':'Clear departure','取消目的地站':'Clear destination','交换始发站和目的地':'Swap departure and destination','点击可达车站选择目的地。':'Click a reachable station to choose a destination.','可达站点':'Reachable stations','途经车次':'Train services','所选日期没有此方向的直达车次。':'No direct trains in this direction on the selected date.','所选日期及当前数据中没有匹配的直达车次。':'No direct trains found for this date in the current dataset.','车次完整始终站':'Full train origin and terminus','到达 / 发车 · 不含实时余票':'Arrival / departure · no live seat availability','真实时刻表快照':'Timetable snapshot','导入文件未核验开行日期':'Service dates in this import are unverified','用户导入时刻表 · 请自行核对来源与有效日期':'Imported timetable · verify its source and service dates','来源：chinese-railway-gtfs / RailGo-Parser · 实际开行请以 12306 为准':'Source: chinese-railway-gtfs / RailGo-Parser · confirm service with 12306','选择始发站，查看同车可达车站':'Choose a departure station to explore direct destinations','此站在所选日期没有同车直达车次。':'No direct train to this station on the selected date.','两站间铁路路径 · 展开左侧车次可查看沿途站点':'Routes between stations · expand a train to see its stops','已显示同车可达路线 · 再选一站查看车次':'Direct routes shown · select a destination to see trains','已显示可达线路 · 含 OSM 推算经由，展开车次查看':'Routes shown · includes OSM-inferred paths; expand a train for details',
 '展开后将加载线路几何并显示沿途停站。':'Expand to load the route and display stops.','来源无几何，且受约束 OSM 寻路未通过验证；可查看停站，未强行补线。':'No verified route geometry is available. Stops are shown without a fabricated route.','线路几何已提供 · 展开时在地图显示本车次区间停站。':'Route available · expand to show this journey’s stops on the map.','部分区间待补全':'Some sections are missing','运营方未核验':'Unverified operator','车种未核验':'Unverified train category','国铁':'China Railway','广东城际':'Guangdong Intercity','高速动车':'High-speed EMU','动车':'EMU','城际动车':'Intercity EMU','市郊列车':'Suburban train','普速列车':'Conventional train','加载失败':'Loading failed','时刻表加载失败，请刷新重试或导入文件。':'Timetable failed to load. Reload or import a file.','时刻表加载失败':'Failed to load timetable','铁路路径加载失败':'Failed to load routes','铁路路径分片加载失败':'Failed to load route data','文件不能超过 30 MB。':'File must not exceed 30 MB.','OSM 备用瓦片也无法加载，请检查网络后重试。':'OSM fallback tiles also failed. Check your connection and retry.','浏览器无法启用 WebGL':'WebGL is unavailable','地图资源未找到（404）':'Map resource not found (404)','地图资源或网络连接失败':'Map resource or network connection failed','加载超过 20 秒':'Loading exceeded 20 seconds','未知错误':'Unknown error','地图资源请求失败':'Map resource request failed','时刻表':'Timetable'
};
const patterns=[
 [/^第 (\d+) 趟车缺少有效 timetable。$/,(_,n)=>`Train ${n} is missing a valid timetable.`],
 [/^第 (\d+) 趟车存在无效到发时刻。$/,(_,n)=>`Train ${n} contains invalid arrival/departure times.`],
 [/^无法定位 (\d+) 个车站：(.+)。请用含这些车站经纬度的统一 JSON 导入；未部分导入。$/,(_,n,names)=>`Cannot locate ${n} stations: ${names}. Import a JSON file containing their coordinates. No partial import was performed.`],

 [/^数据库更新 (.+) · (.+) 趟车次$/,(_,date,count)=>`Database updated ${date} · ${count} trains`],
 [/^(\d+) 趟直达车次$/,(_,n)=>`${n} direct trains`],[/^(\d+) 趟车次( · 区域代表站)?$/,(_,n,regional)=>`${n} trains${regional?' · regional representative':''}`],
 [/^已行走 (.+)$/,(_,time)=>`Elapsed ${time.replace('：',':')}`],
 [/^次日 (\d{2}:\d{2})$/,(_,time)=>`${time}+1`],[/^(\d+)天后 (\d{2}:\d{2})$/,(_,d,time)=>`${time}+${d}`],
 [/^(.+) 出发 · (.+) 到达$/,(_,a,b)=>`${translateText(a)} dep · ${translateText(b)} arr`],
 [/^正在加载 (.+)，暂用 OSM 备用样式…$/,(_,n)=>`Loading ${n}; using OSM fallback…`],
 [/^正在加载 (.+) · (.+)$/,(_,n,e)=>`Loading ${n} · ${translateText(e)}`],
 [/^(.+) · 地图数据来自 OpenStreetMap$/,(_,n)=>`${translateText(n)} · Map data © OpenStreetMap`],
 [/^(.+) 加载失败：(.+)。暂用 OSM (深色|浅色)备用样式。$/,(_,n,e,style)=>`${n} failed: ${translateText(e)}. Using OSM ${style==='深色'?'dark':'light'} fallback.`],
 [/^(.+) · (\d+) 个区间为 OSM 推算经由( · 部分区间待补全)?$/,(_,code,n,missing)=>`${code} · ${n} OSM-inferred sections${missing?' · some sections missing':''}`],
 [/^(.+)：来源缺少线路几何，已显示 (\d+) 个停站$/,(_,code,n)=>`${code}: source route unavailable; ${n} stops shown`],
 [/^(.+)：(\d+) 个区间缺少几何，停站已显示$/,(_,code,n)=>`${code}: ${n} sections missing; stops shown`],
 [/^(.+) · (\d+) 个区间停站$/,(_,code,n)=>`${code} · ${n} journey stops`],
 [/^(\d+) 个区间待补全( · 含 OSM 推算经由)?$/,(_,n,inferred)=>`${n} sections missing${inferred?' · includes OSM-inferred paths':''}`],
 [/^线路覆盖 (\d+) \/ (\d+) 个区间，其中 (\d+) 个区间为 OSM 推算经由（非官方车次轨迹）。$/,(_,a,b,n)=>`Route coverage: ${a} / ${b} sections; ${n} inferred from OSM (not official train tracks).`],
 [/^线路几何覆盖 (\d+) \/ (\d+) 个区间，缺失部分不补线。$/,(_,a,b)=>`Route coverage: ${a} / ${b} sections. Missing sections are not fabricated.`],
 [/^已导入 (\d+) 个站点、(\d+) 趟车次$/,(_,a,b)=>`Imported ${a} stations and ${b} trains`],
 [/^导入失败：(.+)$/,(_,e)=>`Import failed: ${translateText(e)}`],
 [/^取消(始发|目的地)站 (.+)$/,(_,role,name)=>`Clear ${role==='始发'?'departure':'destination'} ${translateText(name)}`],
 [/^内置版本 (.+)，(\d+) 个站点、(\d+) 趟车次；开行日记录范围 (.+) 至 (.+)。CC BY 4.0，作者 wensimehrp \(Jeremy Gao\)。快照不代表所有日期的全部列车。$/,(_,release,stations,trains,from,to)=>`Snapshot ${release}: ${stations} stations, ${trains} trains; service records ${from} to ${to}. CC BY 4.0 by wensimehrp (Jeremy Gao). Coverage varies by date.`]
];
const properNames={'北京':'Beijing','重庆':'Chongqing','上海':'Shanghai','广州':'Guangzhou','深圳':'Shenzhen','西安':'Xi’an','乌鲁木齐':'Urumqi','拉萨':'Lhasa','香港':'Hong Kong','香港西九龙':'Hong Kong West Kowloon','澳门':'Macao','台北':'Taipei','琅勃拉邦':'Luang Prabang','万荣':'Vang Vieng','万象':'Vientiane','孟赛':'Muang Xay','磨丁':'Boten'};
const stationNames=new Map();
export function englishStationName(name){
 if(properNames[name])return properNames[name];
 const direction={东:'East',西:'West',南:'South',北:'North'}[name.at(-1)];
 const stem=direction&&name.length>2?name.slice(0,-1):name;
 const base=properNames[stem]||(()=>{const roman=pinyin(stem,{toneType:'none',type:'array'}).join('');return roman.charAt(0).toUpperCase()+roman.slice(1);})();
 return `${base}${stem!==name?' '+direction:''}`;
}
export function registerStationNames(stations){for(const s of stations)stationNames.set(s.name,englishStationName(s.name));}
export function addTranslations(entries){Object.assign(words,entries);}
export function translateText(value){
 const text=value.trim();let translated=words[text]??stationNames.get(text);
 if(translated===undefined)for(const [pattern,format]of patterns){const match=text.match(pattern);if(match){translated=format(...match);break;}}
 if(translated===undefined&&text.includes(' / ')){const result=text.split(' / ').map(part=>translateText(part)).join(' / ');if(result!==text)translated=result;}
 if(translated===undefined&&text.includes(' · ')){const parts=text.split(' · ');const result=parts.map(part=>translateText(part)).join(' · ');if(result!==text)translated=result;}
 if(translated===undefined)return value;
 return value.replace(text,translated);
}
export async function detectCountry(fetcher=fetch){
 for(const url of ['/api/region','/cdn-cgi/trace','https://www.cloudflare.com/cdn-cgi/trace']){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),1800);
  try{
   const response=await fetcher(url,{signal:controller.signal,cache:'no-store',credentials:'omit'});
   if(!response.ok)continue;
   const body=await response.text();let country;
   if(url==='/api/region'){try{country=JSON.parse(body).country;}catch{}}
   else country=body.match(/^loc=([A-Z]{2})$/m)?.[1];
   if(/^[A-Z]{2}$/.test(country||'')&&!['XX','T1'].includes(country))return country;
  }catch{}finally{clearTimeout(timer);}
 }
 return null;
}
// Keep the original text per node so switching back restores Chinese, including
// live text updated asynchronously by map events. Never rewrite station IDs/data.
export function createTranslator(root){
 let language='zh';const sources=new WeakMap(),attributes=new WeakMap();
 function text(node){
  if(!node.nodeValue?.trim()||['SCRIPT','STYLE'].includes(node.parentElement?.tagName))return;
  let record=sources.get(node);if(!record||record.rendered!==node.nodeValue)record={source:node.nodeValue};
  const rendered=language==='en'?translateText(record.source):record.source;
  if(node.nodeValue!==rendered)node.nodeValue=rendered;
  sources.set(node,{source:record.source,rendered});
 }
 function element(el){
  for(const key of ['aria-label','title','alt','placeholder']){
   const current=el.getAttribute(key);if(current===null)continue;
   let records=attributes.get(el)||{},record=records[key];if(!record||record.rendered!==current)record={source:current};
   const rendered=language==='en'?translateText(record.source):record.source;
   if(current!==rendered)el.setAttribute(key,rendered);records[key]={source:record.source,rendered};attributes.set(el,records);
  }
 }
 function visit(node){
  if(node.nodeType===3){text(node);return;}
  if(node.nodeType!==1)return;element(node);
  const walker=node.ownerDocument.createTreeWalker(node,5);let child;
  while((child=walker.nextNode())){if(child.nodeType===3)text(child);else element(child);}
 }
 const observer=new MutationObserver(records=>{
  for(const record of records){if(record.type==='characterData')text(record.target);else if(record.type==='attributes')element(record.target);else for(const node of record.addedNodes)visit(node);}
 });
 observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','alt','placeholder']});
 return {setLanguage(value){language=value;visit(root);},refresh(){visit(root);},get language(){return language;},disconnect(){observer.disconnect();}};
}
