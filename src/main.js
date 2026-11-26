import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {createIcons, TrainFront, ArrowUpRight, Upload, Search, MapPin, Route, ZoomIn, Info, LocateFixed, Plus, Minus, X, Download, LockKeyhole, ChevronDown} from 'lucide';
const icons={TrainFront,ArrowUpRight,Upload,Search,MapPin,Route,ZoomIn,Info,LocateFixed,Plus,Minus,X,Download,LockKeyhole,ChevronDown};
import {demoData} from './data.js';
import {reachable,validateData} from './network.js';
import {chinaToday,displayTime,importTimetable} from './timetable.js';
import './style.css';
import {maplibreGL} from '@maplibre/maplibre-gl-leaflet';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {segmentKey, routeParts} from './rail-geometry.js';

const icon = name => `<i data-lucide="${name}"></i>`;
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data={metadata:{kind:'loading'},stations:[],trains:[]}, snapshot=null, snapshotGeometry=null, selected=null, result=null, destination=null, query='', destinationQuery='';
let stationById=new Map(), networkEdges=[];
let travelDate=chinaToday();
document.querySelector('#app').innerHTML=`
<header><a class="brand" href="/" aria-label="行轨首页"><span class="brand-icon">${icon('train-front')}</span><strong>行轨<span>中国铁路可达地图</span></strong></a><nav><span class="nav-active">探索地图</span><button id="about">关于数据 ${icon('arrow-up-right')}</button></nav><div class="header-right"><span class="demo-badge"><b></b><span id="data-mode">正在加载时刻表</span></span><button id="import" class="import">${icon('upload')} 导入时刻表</button></div></header>
<main><aside><div class="intro"><div class="eyebrow">沿着铁轨，发现更多</div><h1>从一站出发，<br>看见所有可能。</h1><p>选择一个车站，探索列车可以带你去的地方。</p></div><div class="date-control"><label for="travel-date">乘车日期 <small>中国标准时间</small></label><input id="travel-date" type="date" aria-label="乘车日期"><button id="restore-snapshot" hidden>恢复内置快照</button><span id="data-summary" role="status">正在加载真实时刻表…</span></div><div class="search-box">${icon('search')}<input id="search" placeholder="搜索车站，如 珠海、广州南" autocomplete="off" aria-label="搜索出发站"><kbd>⌕</kbd></div><div id="search-results"></div><div id="panel"></div><div class="sidebar-bottom">${icon('info')}<span>真实时刻表快照 · 运行日期以数据源为准<br>实际开行与停站请以 12306 公布为准</span></div></aside><section class="map-area" aria-label="中国铁路地图"><div id="map"></div><div class="map-title"><span class="live-dot"></span><span>中国铁路网络</span><small id="map-subtitle">缩放地图，发现沿途车站</small></div><div class="map-top-right"><span id="station-count"></span> 个站点<button id="reset-view" aria-label="回到全国视图">${icon('locate-fixed')}</button></div><div id="selection-banner" hidden></div><div class="basemap-switch" role="group" aria-label="底图风格"><button data-basemap="positron">浅色</button><button data-basemap="dark">深色</button><button data-basemap="osm">原 OSM</button></div><div id="routing-status" role="status">正在加载铁路路径…</div><div class="zoom"><button id="zoom-in" aria-label="放大地图">${icon('plus')}</button><button id="zoom-out" aria-label="缩小地图">${icon('minus')}</button></div><div class="legend"><strong>地图图例</strong><span><b class="legend-hub"></b>枢纽站</span><span><b class="legend-station"></b>一般站点</span><span><b class="legend-route"></b>可达线路</span><small>放大地图可查看小站</small></div><div class="map-footer">铁路，让远方更近。<span>CHINA RAILWAY EXPLORER</span></div><div id="toast" role="status"></div></section></main>
<dialog id="about-dialog"><button class="close-dialog" aria-label="关闭">${icon('x')}</button><div class="eyebrow">数据说明</div><h2>一张可以探索的铁路地图</h2><p>默认使用 wensimehrp / chinese-railway-gtfs 发布的真实时刻表快照，运行数据由 RailGo-Parser 获取，站点坐标来自 OpenStreetMap。按乘车站当地日期筛选开行车次，跨午夜时按始发日换算。这里不查询实时余票或临时停运。</p><p id="snapshot-details">正在读取数据版本…</p><p>可达指同一趟列车在所选站之后的停站，不计算换乘。线路优先使用数据源提供的走向，缺失部分采用 OSM 铁路最短路；无法匹配时不画直线替代。铁路几何不等同于经官方核实的车次经由。</p><p>支持导入 qETRC .pyetgr / .pyetdb 文件，按车站名称匹配内置坐标。导入内容的真实性和有效日期由文件提供者负责。</p><a href="https://github.com/wensimehrp/chinese-railway-gtfs" target="_blank" rel="noreferrer">时刻表来源与更新</a> · <a href="https://github.com/CDK6182CHR/qETRC" target="_blank" rel="noreferrer">qETRC 项目</a><button id="download" class="primary">下载时刻表格式示例 ${icon('download')}</button><p class="fine">导入在浏览器本地完成，刷新后恢复内置真实时刻表快照。底图来自 OpenFreeMap / OpenStreetMap。铁路几何 © OpenStreetMap contributors，ODbL 1.0；OSM 路网快照 2026-09-02；时刻表与上游线路走向快照见版本说明。</p></dialog><input id="file" type="file" accept=".json,.pyetgr,.pyetdb,application/json" hidden>`;
const map=L.map('map',{zoomControl:false,minZoom:3,maxZoom:13,preferCanvas:true}).setView([34.5,106.5],4);
let basemapLayer, dark=false, basemapGeneration=0;
const attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
function setBasemap(style){
 if(!['positron','dark','osm'].includes(style))style='dark';
 if(style!=='osm'&&!maplibregl.supported())style='osm';
 if(basemapLayer)map.removeLayer(basemapLayer);
 dark=style==='dark';document.body.classList.toggle('dark-map',dark);
 const generation=++basemapGeneration;
 document.querySelectorAll('[data-basemap]').forEach(b=>{b.classList.toggle('active',b.dataset.basemap===style);b.setAttribute('aria-pressed',String(b.dataset.basemap===style));});
 try{localStorage.setItem('xinggui-basemap',style);}catch{}
 if(style==='osm')basemapLayer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution}).addTo(map);
 else{
  try{basemapLayer=maplibreGL({style:`https://tiles.openfreemap.org/styles/${style}`,interactive:false,attribution:'<a href="https://openfreemap.org/">OpenFreeMap</a> · '+attribution,maxTileCacheSize:48,fadeDuration:0}).addTo(map);
   basemapLayer.getMaplibreMap().on('error',()=>{if(generation===basemapGeneration)document.querySelector('#routing-status').textContent='底图资源加载遇到问题，可切换原 OSM。';});
  }catch{setBasemap('osm');}
 }
 drawMap();
}
let railGeometry={segments:{}},geometryReady=false;
async function loadSnapshot(){
 try{
  const [raw,geometry]=await Promise.all(['/timetable/data.json','/timetable/routes.json'].map(async url=>{const r=await fetch(url);if(!r.ok)throw Error('数据文件加载失败');return r.json();}));
  snapshot=validateData(raw);snapshotGeometry=geometry;map.attributionControl.addAttribution('时刻表 © <a href="https://github.com/wensimehrp/chinese-railway-gtfs">wensimehrp</a> · CC BY 4.0');applyDataset(snapshot,geometry);
 }catch(e){document.querySelector('#data-mode').textContent='加载失败';document.querySelector('#data-summary').textContent='时刻表加载失败，请刷新重试或导入文件。';document.querySelector('#routing-status').textContent='未加载时刻表';toast(e.message);}
}
function applyDataset(next,geometry){
 data={...next,metadata:next.metadata||{kind:'import'}};railGeometry=geometry||{segments:{}};geometryReady=true;
 stationById=new Map(data.stations.map(s=>[s.id,s]));
 const seen=new Set();networkEdges=[];
 for(const t of data.trains)for(let i=1;i<t.stops.length;i++){
  const a=t.stops[i-1],b=t.stops[i],key=segmentKey(a,b);if(seen.has(key))continue;seen.add(key);
  const parts=routeParts([a,b],stationById,railGeometry);if(parts.length)networkEdges.push({key,parts,bounds:L.latLngBounds(parts[0])});
 }
 const meta=data.metadata||{},isSnapshot=meta.kind==='snapshot';
 const input=document.querySelector('#travel-date');input.disabled=!isSnapshot;input.min=isSnapshot?meta.validFrom:'';input.max=isSnapshot?meta.validTo:'';
 document.querySelector('#restore-snapshot').hidden=isSnapshot||!snapshot;
 document.querySelector('#data-mode').textContent=isSnapshot?'真实时刻表快照':'导入时刻表';
 document.querySelector('#data-summary').textContent=isSnapshot?`更新于 ${meta.updatedAt} · ${data.trains.length.toLocaleString()} 趟车次`:'导入文件未核验开行日期';
 document.querySelector('.sidebar-bottom span').textContent=isSnapshot?'来源：chinese-railway-gtfs / RailGo-Parser · 实际开行请以 12306 为准':'用户导入时刻表 · 请自行核对来源与有效日期';
 const sm=snapshot?.metadata;
 if(sm)document.querySelector('#snapshot-details').textContent=`内置版本 ${sm.release}，${snapshot.stations.length} 个站点、${snapshot.trains.length} 趟车次；开行日记录范围 ${sm.validFrom} 至 ${sm.validTo}。CC BY 4.0，作者 wensimehrp (Jeremy Gao)。快照不代表所有日期的全部列车。`;
 clear();
}
const lines=L.layerGroup().addTo(map), markers=L.layerGroup().addTo(map), activeLines=L.layerGroup().addTo(map);
const refreshIcons=()=>createIcons({icons,attrs:{'stroke-width':1.7}});
let toastTimer;
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3400);}
function routeCoordinates(path){return path.map(id=>stationById.get(id)).map(s=>[s.lat,s.lng]);}
function stationPosition(s){
 const original=demoData.stations.find(x=>x.id===s.id);
 if(original&&Math.abs(original.lat-s.lat)<.00001&&Math.abs(original.lng-s.lng)<.00001){
  for(const [key,segment] of Object.entries(railGeometry.segments)){
   if(segment.status!=='routed')continue;
   const ids=key.split('|');if(ids[0]===s.id)return segment.coordinates[0];if(ids[1]===s.id)return segment.coordinates.at(-1);
  }
 }
 return [s.lat,s.lng];
}
function drawMap(){
  lines.clearLayers();markers.clearLayers();activeLines.clearLayers();
  const colors=['#ea7189','#e9a13b','#45bbaa','#6c9fea','#ae84d9','#d76a47','#84ab56'];
  function drawParts(parts,color,weight,opacity,layer){
   if(!parts.length)return;
   L.polyline(parts,{color:dark?'#14232e':'#fff',weight:weight+2,opacity,interactive:false,lineCap:'round',lineJoin:'round',smoothFactor:1}).addTo(layer);
   L.polyline(parts,{color,weight,opacity,interactive:false,lineCap:'round',lineJoin:'round',smoothFactor:1}).addTo(layer);
  }
  const bounds=map.getBounds().pad(.15),groups=colors.map(()=>[]);
  networkEdges.forEach((edge,i)=>{if(bounds.intersects(edge.bounds))groups[i%colors.length].push(...edge.parts);});
  groups.forEach((parts,i)=>drawParts(parts,colors[i],map.getZoom()<6?1.5:2.5,selected?.12:.6,lines));
  if(result){
    const paths=destination?result.destinations.get(destination):result.services;
    const seen=new Set(),active=[],missing=new Set();
    paths?.forEach(t=>t.path.slice(1).forEach((id,i)=>{
     const key=segmentKey(t.path[i],id);if(seen.has(key))return;seen.add(key);
     const parts=routeParts([t.path[i],id],stationById,railGeometry);if(parts.length)active.push(...parts);else missing.add(key);
    }));
    drawParts(active,destination?'#ffb44c':'#ef9b50',destination?4:3,.95,activeLines);
    document.querySelector('#routing-status').textContent=missing.size?`${missing.size} 个区间缺少线路几何，未绘制连线`:'铁路路径参考 · 实际经由以运行图为准';
  }else if(geometryReady)document.querySelector('#routing-status').textContent='铁路路径参考 · 选择出发站查看直达车次';
  const zoom=map.getZoom();
  data.stations.forEach(s=>{
    const isSelected=s.id===selected,isDestination=s.id===destination,isReachable=result?.destinations.has(s.id);
    if(!isSelected&&!isDestination&&!map.getBounds().pad(.1).contains([s.lat,s.lng]))return;
    if(!isSelected&&!isDestination&&s.level>0&&zoom<(s.level===1?5:7))return;
    const marker=L.circleMarker(stationPosition(s),{radius:isSelected?8:s.level===0?4.8:3.4,color:isSelected?'#fff':isReachable?'#db9b43':dark?'#bdcdd5':'#3d564b',weight:isSelected?3:1.5,fillColor:isSelected?'#efab48':'#fff',fillOpacity:1,opacity:selected&&!isSelected&&!isReachable?.38:1}).addTo(markers);
    marker.bindTooltip(escape(s.name),{permanent:isSelected||isDestination||s.level===0||zoom>=7,direction:'right',className:`station-label ${isSelected?'selected-label':''} ${selected&&!isSelected&&!isReachable?'muted-label':''}`,offset:[7,0]});
    marker.on('click',()=>choose(s.id));
  });
  document.querySelector('#station-count').textContent=data.stations.length;
}
function choose(id){
  if(selected){toast('请先取消当前站点，再选择其他出发站。');return;}
  selected=id;result=reachable(data,id,travelDate);destination=null;query='';destinationQuery='';document.querySelector('#search').value='';document.querySelector('#search-results').innerHTML='';
  renderPanel();drawMap();
}
function clear(){selected=null;result=null;destination=null;destinationQuery='';renderPanel();drawMap();}
function renderPanel(){
  const panel=document.querySelector('#panel');
  const input=document.querySelector('#search');input.disabled=!!selected;input.placeholder=selected?'取消当前选择后，可搜索其他站点':'搜索车站，如 珠海、广州南';
  const banner=document.querySelector('#selection-banner');banner.hidden=!selected;
  if(!selected){panel.innerHTML=`<div class="section-heading"><h2>从这里开始</h2><span>热门出发站</span></div><div class="popular">${['珠海','广州南','北京西','上海虹桥','成都东','武汉'].map(name=>data.stations.find(s=>s.name===name)?.id).filter(Boolean).map(id=>`<button data-station="${escape(id)}">${icon('map-pin')} ${escape(stationById.get(id).name)} ${icon('arrow-up-right')}</button>`).join('')}</div><div class="how-card"><span class="how-icon">${icon('route')}</span><h3>你的下一站，会在哪里？</h3><p>点击地图上的站点，点亮从这里出发的铁路网络。</p><div><span><b class="tiny-dot"></b>枢纽站始终可选</span><span>${icon('zoom-in')} 放大探索小站</span></div></div><div class="data-note"><span class="tag">${data.metadata.kind==='snapshot'?'真实时刻表快照':'导入数据'}</span><p>${data.stations.length.toLocaleString()} 个站点 · ${data.trains.length.toLocaleString()} 趟车次。${data.metadata.kind==='snapshot'?'按所选日期筛选，不含实时余票。':'导入数据的开行日期未核验。'}</p></div>`;}
  else{
    const s=stationById.get(selected);
    banner.innerHTML=`<span><b></b>正在探索 <strong>${escape(s.name)}</strong> 的可达网络</span><button id="banner-clear">取消选择 ${icon('x')}</button>`;
    panel.innerHTML=`<div class="selected-card"><div class="selected-top"><span>${icon('map-pin')} 当前出发站</span><button id="clear">取消选择 ${icon('x')}</button></div><h2>${escape(s.name)}<small>${escape(s.province||'')} · ${s.level===0?'铁路枢纽':'铁路车站'}</small></h2><div class="stats"><div><strong>${result.destinations.size}</strong><span>可达站点</span></div><div><strong>${result.services.length}</strong><span>途经车次</span></div></div><div class="lock-note">${icon('lock-keyhole')} 选择已锁定，取消后可切换出发站</div></div><div class="section-heading"><h2>可达站点</h2><span>${data.metadata.kind==='snapshot'?escape(travelDate):'导入时刻表'} · 同车直达</span></div><div class="destination-search">${icon('search')}<input id="destination-search" aria-label="筛选可达站点" placeholder="查找目的地" value="${escape(destinationQuery)}"></div><div id="destinations"></div>`;
    document.querySelector('#clear').onclick=clear;document.querySelector('#banner-clear').onclick=clear;
    document.querySelector('#destination-search').oninput=e=>{destinationQuery=e.target.value;renderDestinations();};
    renderDestinations();
  }
  panel.querySelectorAll('[data-station]').forEach(b=>b.onclick=()=>choose(b.dataset.station));refreshIcons();
}
function renderDestinations(){
  const entries=[...result.destinations].filter(([id])=>stationById.get(id).name.includes(destinationQuery.trim()));
  document.querySelector('#destinations').innerHTML=entries.length?entries.map(([id,trains])=>`<button class="destination ${destination===id?'active':''}" data-destination="${escape(id)}"><span class="destination-dot"></span><span><strong>${escape(stationById.get(id).name)}</strong><small>${escape(stationById.get(id).province||'')} · ${trains.length} 趟${data===demoData?'演示':''}车次</small></span>${icon(destination===id?'chevron-down':'arrow-up-right')}</button>${destination===id?renderJourneys(trains):''}`).join(''):`<div class="empty">${result.destinations.size?'没有匹配的目的地':'所选日期及当前数据中，没有从此站继续运行的列车。'}</div>`;
  document.querySelectorAll('[data-destination]').forEach(b=>b.onclick=()=>{destination=destination===b.dataset.destination?null:b.dataset.destination;renderDestinations();drawMap();if(destination){const path=result.destinations.get(destination)[0].path;map.fitBounds(L.latLngBounds(routeCoordinates(path)),{padding:[70,70],maxZoom:9});}});refreshIcons();
}
document.querySelector('#search').oninput=e=>{
  query=e.target.value.trim();const matches=query?data.stations.filter(s=>s.name.includes(query)).slice(0,30):[];
  document.querySelector('#search-results').innerHTML=query?`<div class="search-list">${matches.length?matches.map(s=>`<button data-id="${escape(s.id)}">${icon('map-pin')}<span>${escape(s.name)}</span><small>${escape(s.province||'')}</small></button>`).join(''):'<p>没有匹配的车站</p>'}</div>`:'';
  document.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>choose(b.dataset.id));refreshIcons();
};
document.querySelector('#zoom-in').onclick=()=>map.zoomIn();document.querySelector('#zoom-out').onclick=()=>map.zoomOut();document.querySelector('#reset-view').onclick=()=>map.setView([34.5,106.5],4);
const dialog=document.querySelector('dialog');document.querySelector('#about').onclick=()=>dialog.showModal();document.querySelector('.close-dialog').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
document.querySelector('#import').onclick=()=>document.querySelector('#file').click();
document.querySelector('#file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    if(file.size>30*1024*1024)throw new Error('文件不能超过 30 MB。');
    const imported=importTimetable(JSON.parse(await file.text()),snapshot?.stations||data.stations);
    applyDataset(imported,snapshotGeometry);toast(`已导入 ${data.stations.length} 个站点、${data.trains.length} 趟车次`);
  }catch(error){toast(`导入失败：${error.message}`);}finally{e.target.value='';}
};
document.querySelector('#download').onclick=()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(demoData,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='railway-example.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
function renderJourneys(trains){
 return `<div class="journey-list">${trains.slice(0,30).map(t=>{
  const i=t.originIndex||0,j=i+t.path.length-1,origin=t.times?.[i]?.[1];
  return `<details class="journey"><summary><strong>${escape(t.code||t.id)}</strong><span>${displayTime(origin,origin)} 出发 · ${displayTime(t.times?.[j]?.[0],origin)} 到达</span></summary><ol>${t.path.map((id,k)=>`<li><b>${escape(stationById.get(id).name)}</b><span>${displayTime(t.times?.[i+k]?.[0],origin)} / ${displayTime(t.times?.[i+k]?.[1],origin)}</span></li>`).join('')}</ol><small>到达 / 发车 · 不含实时余票</small></details>`;
 }).join('')}${trains.length>30?'<p>显示前 30 趟车次。</p>':''}</div>`;
}
document.querySelector('#travel-date').value=travelDate;
document.querySelector('#travel-date').onchange=e=>{
 if(!e.target.value)return;travelDate=e.target.value;
 destination=null;
 if(selected)result=reachable(data,selected,travelDate);
 const meta=data.metadata;document.querySelector('#data-summary').textContent=travelDate<meta.validFrom||travelDate>meta.validTo?'所选日期超出快照范围，暂无开行记录':`更新于 ${meta.updatedAt} · ${data.trains.length.toLocaleString()} 趟车次`;
 renderPanel();drawMap();
};
document.querySelector('#restore-snapshot').onclick=()=>applyDataset(snapshot,snapshotGeometry);
document.querySelectorAll('[data-basemap]').forEach(b=>b.onclick=()=>setBasemap(b.dataset.basemap));
let initialBasemap='dark';try{initialBasemap=localStorage.getItem('xinggui-basemap')||'dark';}catch{}
map.on('moveend',drawMap);renderPanel();setBasemap(initialBasemap);refreshIcons();loadSnapshot();
