import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {createIcons, TrainFront, ArrowUpRight, Upload, Search, MapPin, Route, ZoomIn, Info, LocateFixed, Plus, Minus, X, Download, Layers, Maximize} from 'lucide';
const icons={TrainFront,ArrowUpRight,Upload,Search,MapPin,Route,ZoomIn,Info,LocateFixed,Plus,Minus,X,Download,Layers,Maximize};
import {demoData} from './data.js';
import {mergeDisplayRoutes,routeCoverage,focusedStopIds} from './route-display.js';
import {reachable,validateData} from './network.js';
import {chinaToday,displayTime,importTimetable} from './timetable.js';
import './style.css';
import {stationPriorities,selectionTransition,selectedPaths,visibleStations,shouldFitSelection} from './map-model.js';
import {routeVariantKey,routeParts,categoryLabels,operatorLabels} from './rail-geometry.js';

const icon = name => `<i data-lucide="${name}"></i>`;
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data={metadata:{kind:'loading'},stations:[],trains:[]}, snapshot=null, snapshotGeometry=null, selected=null, result=null, destination=null, query='', destinationQuery='';
let stationById=new Map(), rankedStations=[], visibleMarkers=new Map();
let geometryPromise=null;
let travelDate=chinaToday(),focusedTrainId=null;
document.querySelector('#app').innerHTML=`
<header><a class="brand" href="/" aria-label="行轨首页"><span class="brand-icon">${icon('train-front')}</span><strong>行轨<span>中国铁路可达地图</span></strong></a><nav><span class="nav-active">探索地图</span><button id="about">关于数据 ${icon('arrow-up-right')}</button></nav><div class="header-right"><span class="demo-badge"><b></b><span id="data-mode">正在加载时刻表</span></span><button id="import" class="import">${icon('upload')} 导入时刻表</button></div></header>
<main><aside><div class="intro"><div class="eyebrow">沿着铁轨，发现更多</div><h1>从一站出发，<br>看见所有可能。</h1><p>选择一个车站，探索列车可以带你去的地方。</p></div><div class="date-control"><label for="travel-date">乘车日期 <small>中国标准时间</small></label><input id="travel-date" type="date" aria-label="乘车日期"><button id="restore-snapshot" hidden>恢复内置快照</button><span id="data-summary" role="status">正在加载真实时刻表…</span></div><div class="search-box">${icon('search')}<input id="search" placeholder="搜索车站，如 珠海、广州南" autocomplete="off" aria-label="搜索出发站"><kbd>⌕</kbd></div><div id="search-results"></div><div id="panel"></div><div class="sidebar-bottom">${icon('info')}<span>真实时刻表快照 · 运行日期以数据源为准<br>实际开行与停站请以 12306 公布为准</span></div></aside><section class="map-area" aria-label="中国铁路地图"><div id="map"></div><div class="map-title"><span class="live-dot"></span><span>中国铁路网络</span><small id="map-subtitle">缩放地图，发现沿途车站</small></div><div class="map-top-right"><span id="station-count"></span> 个站点</div><div id="selection-banner" hidden></div><div id="routing-status" role="status">正在加载铁路路径…</div><div class="map-tools" role="group" aria-label="地图工具"><button id="layers-toggle" aria-label="地图与线条" aria-expanded="false" aria-controls="layer-panel" title="地图与线条">${icon('layers')}</button><button id="reset-view" aria-label="回到全国视图" title="回到全国视图">${icon('maximize')}</button><button id="zoom-in" aria-label="放大地图" title="放大">${icon('plus')}</button><button id="zoom-out" aria-label="缩小地图" title="缩小">${icon('minus')}</button></div><section id="layer-panel" role="dialog" aria-modal="false" aria-labelledby="layer-heading" hidden><div class="layer-heading"><h2 id="layer-heading">地图与线条</h2><button id="layers-close" aria-label="关闭地图与线条">${icon('x')}</button></div><fieldset class="basemap-options"><legend class="sr-only">底图风格</legend><label class="basemap-option"><input type="radio" name="basemap" data-basemap="dark" value="dark"><span class="map-swatch swatch-dark" aria-hidden="true"></span><span><strong>深色</strong><small>OpenFreeMap Dark</small></span></label><label class="basemap-option"><input type="radio" name="basemap" data-basemap="positron" value="positron"><span class="map-swatch swatch-light" aria-hidden="true"></span><span><strong>简洁浅色</strong><small>OpenFreeMap Positron</small></span></label><label class="basemap-option"><input type="radio" name="basemap" data-basemap="osm" value="osm"><span class="map-swatch swatch-osm" aria-hidden="true"></span><span><strong>OSM 标准</strong><small>完整街道信息</small></span></label></fieldset><fieldset class="line-options"><legend>线条粗细 · 全局</legend><label><input type="radio" name="line-weight" value="fine" checked><span class="line-sample fine"></span>细（默认）</label><label><input type="radio" name="line-weight" value="bold"><span class="line-sample bold"></span>粗</label></fieldset><p id="basemap-status" role="status">地图数据来自 OpenStreetMap</p><button id="basemap-retry" hidden>重新加载底图</button></section><div class="legend"><strong>地图图例</strong><span><b class="legend-major"></b>高频大站</span><span><b class="legend-regional"></b>中频车站</span><span><b class="legend-minor"></b>低频小站</span><span><b class="legend-route"></b>可达线路</span><small>车次越多，图标越大</small></div><div class="map-footer">铁路，让远方更近。<span>CHINA RAILWAY EXPLORER</span></div><div id="toast" role="status"></div></section></main>
<dialog id="about-dialog"><button class="close-dialog" aria-label="关闭">${icon('x')}</button><div class="eyebrow">数据说明</div><h2>一张可以探索的铁路地图</h2><p>默认使用 wensimehrp / chinese-railway-gtfs 发布的真实时刻表快照，运行数据由 RailGo-Parser 获取，站点坐标来自 OpenStreetMap。按乘车站当地日期筛选开行车次，跨午夜时按始发日换算。这里不查询实时余票或临时停运。</p><p id="snapshot-details">正在读取数据版本…</p><p>可达指同一趟列车在所选站之后的停站，不计算换乘。线路优先采用每趟车自己的来源走向；缺失时使用保留线路名、高速线、运营方、轨距等属性的 OSM 路网逐站推算，并明确标注。仍无法通过约束检查的区间列入自动缺线清单。铁路几何不等同于经官方核实的车次经由。</p><p>支持导入 qETRC .pyetgr / .pyetdb 文件，按车站名称匹配内置坐标。导入内容的真实性和有效日期由文件提供者负责。</p><a href="https://github.com/wensimehrp/chinese-railway-gtfs" target="_blank" rel="noreferrer">时刻表来源与更新</a> · <a href="/timetable/routing-audit.json" target="_blank" rel="noreferrer">自动缺线清单</a> · <a href="https://github.com/CDK6182CHR/qETRC" target="_blank" rel="noreferrer">qETRC 项目</a><button id="download" class="primary">下载时刻表格式示例 ${icon('download')}</button><p class="fine">导入在浏览器本地完成，刷新后恢复内置真实时刻表快照。深浅底图来自 OpenFreeMap，无法连接时使用 OSM 栅格的备用视觉样式。铁路几何 © OpenStreetMap contributors，ODbL 1.0；OSM 路网日期与推算来源见自动审计记录；时刻表与上游线路走向快照见版本说明。</p></dialog><input id="file" type="file" accept=".json,.pyetgr,.pyetdb,application/json" hidden>`;
const map=L.map('map',{zoomControl:false,minZoom:3,maxZoom:13,preferCanvas:true}).setView([34.5,106.5],4);
let basemapLayer,vectorLayer,dark=false,basemapGeneration=0,basemapStyle='dark',basemapTimer,vectorPromise;
let lineWeight='fine';try{lineWeight=localStorage.getItem('xinggui-line-weight')==='bold'?'bold':'fine';}catch{}
const attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
map.createPane('baseTiles');map.getPane('baseTiles').style.zIndex=200;
map.createPane('vectorBase');map.getPane('vectorBase').style.zIndex=201;
function setRasterStyle(style){map.getPane('baseTiles').classList.toggle('osm-dark',style==='dark');map.getPane('baseTiles').classList.toggle('osm-light',style==='positron');}
function ensureRaster(){
 if(basemapLayer)return;
 basemapLayer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{pane:'baseTiles',maxZoom:19,attribution,keepBuffer:1,updateWhenIdle:true,updateWhenZooming:false}).addTo(map);
 basemapLayer.on('tileerror',()=>{if(!vectorLayer){document.querySelector('#basemap-status').textContent='OSM 备用瓦片也无法加载，请检查网络后重试。';document.querySelector('#basemap-retry').hidden=false;}});
}
async function setBasemap(style){
 if(!['positron','dark','osm'].includes(style))style='dark';
 basemapStyle=style;const generation=++basemapGeneration;clearTimeout(basemapTimer);
 if(vectorLayer){map.removeLayer(vectorLayer);vectorLayer=null;}
 dark=style==='dark';document.body.classList.toggle('dark-map',dark);setRasterStyle(style);ensureRaster();
 document.querySelectorAll('[name="basemap"]').forEach(r=>r.checked=r.value===style);
 try{localStorage.setItem('xinggui-basemap',style);}catch{}
 const name=style==='dark'?'OpenFreeMap Dark':'OpenFreeMap Positron';
 const status=document.querySelector('#basemap-status'),retry=document.querySelector('#basemap-retry');retry.hidden=true;
 drawMap();
 if(style==='osm'){status.textContent='OSM 标准 · 地图数据来自 OpenStreetMap';return;}
 status.textContent=`正在加载 ${name}，暂用 OSM 备用样式…`;
 function fallback(){
  if(generation!==basemapGeneration)return;clearTimeout(basemapTimer);
  if(vectorLayer){map.removeLayer(vectorLayer);vectorLayer=null;}
  ensureRaster();status.textContent=`${name} 暂不可用，已使用 OSM ${dark?'深色':'浅色'}备用样式。`;retry.hidden=false;
 }
 try{
  vectorPromise??=import('./vector-basemap.js');const {createVectorLayer}=await vectorPromise;
  if(generation!==basemapGeneration)return;
  const layer=createVectorLayer(`https://tiles.openfreemap.org/styles/${style}/style.json`,'<a href="https://openfreemap.org/">OpenFreeMap</a> · © OpenMapTiles · '+attribution);
  vectorLayer=layer;layer.addTo(map);const gl=layer.getMaplibreMap();
  gl.on('load',()=>{
   if(generation!==basemapGeneration||vectorLayer!==layer)return;clearTimeout(basemapTimer);
   if(basemapLayer){map.removeLayer(basemapLayer);basemapLayer=null;}
   status.textContent=`${name} · 地图数据来自 OpenStreetMap`;retry.hidden=true;
  });
  gl.on('error',fallback);basemapTimer=setTimeout(fallback,10000);
 }catch{fallback();}
}
let railGeometry={segments:{}},geometryReady=false;
async function loadSnapshot(){
 try{
  const r=await fetch('/timetable/data.json');if(!r.ok)throw Error('时刻表加载失败');
  snapshot=validateData(await r.json());map.attributionControl.addAttribution('时刻表 © <a href="https://github.com/wensimehrp/chinese-railway-gtfs">wensimehrp</a> · CC BY 4.0');applyDataset(snapshot,null);
 }catch(e){document.querySelector('#data-mode').textContent='加载失败';document.querySelector('#data-summary').textContent='时刻表加载失败，请刷新重试或导入文件。';toast(e.message);}
}
async function ensureGeometry(){
 if(snapshotGeometry)return snapshotGeometry;
 if(!geometryPromise)geometryPromise=fetch('/timetable/routes.json').then(r=>{if(!r.ok)throw Error('铁路路径加载失败');return r.json();}).then(async json=>{
  const files=json.segmentFiles||[];
  // Bound concurrent downloads and avoid retaining detailed routing audit tags.
  for(let i=0;i<files.length;i+=4){const chunks=await Promise.all(files.slice(i,i+4).map(async file=>{const r=await fetch('/timetable/'+file);if(!r.ok)throw Error('铁路路径分片加载失败');return r.json();}));for(const chunk of chunks)Object.assign(json.segments,chunk);}
  snapshotGeometry=json;return json;}).catch(e=>{geometryPromise=null;throw e;});
 return geometryPromise;
}
function rebuildPriorities(){rankedStations=stationPriorities(data,travelDate);visibleMarkers.forEach(marker=>marker.remove());visibleMarkers.clear();}
function applyDataset(next,geometry){
 data={...next,metadata:next.metadata||{kind:'import'}};railGeometry=geometry||{segments:{}};geometryReady=!!geometry;
 stationById=new Map(data.stations.map(s=>[s.id,s]));
 rebuildPriorities();
 visibleMarkers.forEach(marker=>marker.remove());visibleMarkers.clear();
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
const markers=L.layerGroup().addTo(map),activeLines=L.layerGroup().addTo(map),selectionChips=L.layerGroup().addTo(map);
let routeRevision=0,drawnRouteRevision=-1,drawnStyle='',chipKey='';
const refreshIcons=()=>createIcons({icons,attrs:{'stroke-width':1.7}});
let toastTimer;
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3400);}
function stationPosition(s){return [s.lat,s.lng];}
function drawRoutes(){
 const style=`${dark}-${lineWeight}-${map.getZoom()}`;
 if(drawnRouteRevision===routeRevision&&drawnStyle===style)return;
 drawnRouteRevision=routeRevision;drawnStyle=style;activeLines.clearLayers();
 if(!selected){document.querySelector('#routing-status').textContent='选择始发站，查看同车可达车站';return;}
 if(!geometryReady){document.querySelector('#routing-status').textContent='正在加载铁路路径…';return;}
 const seen=new Set(),routes=[],missing=new Set(),trains=selectedPaths(result,destination).filter(t=>!focusedTrainId||t.id===focusedTrainId);
 for(const train of trains)for(let i=1;i<train.path.length;i++){
  const a=train.path[i-1],b=train.path[i],key=routeVariantKey(train,a,b,railGeometry);if(seen.has(key))continue;seen.add(key);
  const route=routeParts([a,b],stationById,railGeometry,train);if(route.length)routes.push(...route.map(coordinates=>({pair:[a,b].sort().join('|'),coordinates})));else missing.add(key);
 }
 const parts=mergeDisplayRoutes(routes,coordinates=>map.project(coordinates,map.getZoom()));
 if(parts.length){
  const weight=lineWeight==='bold'?4:2;
  L.polyline(parts,{color:destination?'#ffad46':'#e99b52',weight,opacity:.9,interactive:false,smoothFactor:1.5}).addTo(activeLines);
 }
 const focus=trains.find(t=>t.id===focusedTrainId);
 if(focus){
  const coverage=routeCoverage(focus,railGeometry);
  document.querySelector('#routing-status').textContent=coverage.inferred?`${focus.code||focus.id} · ${coverage.inferred} 个区间为 OSM 推算经由${coverage.available<coverage.total?' · 部分区间待补全':''}`:coverage.sourceMissing?`${focus.code||focus.id}：来源缺少线路几何，已显示 ${focus.path.length} 个停站`:missing.size?`${focus.code||focus.id}：${missing.size} 个区间缺少几何，停站已显示`:`${focus.code||focus.id} · ${focus.path.length} 个区间停站`;
 }else{
  const inferred=trains.some(t=>routeCoverage(t,railGeometry).inferred>0);
  document.querySelector('#routing-status').textContent=missing.size?`${missing.size} 个区间待补全${inferred?' · 含 OSM 推算经由':''}`:inferred?'已显示可达线路 · 含 OSM 推算经由，展开车次查看':(destination?'两站间铁路路径 · 展开左侧车次可查看沿途站点':'已显示同车可达路线 · 再选一站查看车次');
 }
}
function drawChips(){
 const key=`${selected}|${destination}`;if(key===chipKey)return;chipKey=key;selectionChips.clearLayers();
 for(const [id,role]of [[selected,'origin'],[destination,'destination']]){
  if(!id)continue;const station=stationById.get(id);
  const marker=L.marker(stationPosition(station),{keyboard:false,zIndexOffset:1000,icon:L.divIcon({className:'station-chip-anchor',iconSize:[1,1],iconAnchor:role==='origin'?[-12,20]:[12,20],html:`<div class="station-chip ${role}"><span><small>${role==='origin'?'始发':'目的地'}</small><strong>${escape(station.name)}</strong></span><button type="button" aria-label="取消${role==='origin'?'始发':'目的地'}站 ${escape(station.name)}">×</button></div>`})}).addTo(selectionChips);
  const element=marker.getElement();L.DomEvent.disableClickPropagation(element);element.querySelector('button').onclick=()=>changeSelection({type:role==='origin'?'remove-origin':'remove-destination'});
 }
}
function drawStations(){
 const bounds=map.getBounds().pad(.08),ids=new Set(result?.destinations.keys()||[]),viaIds=focusedStopIds(selectedPaths(result,destination),focusedTrainId);
 const stations=visibleStations(rankedStations,{zoom:map.getZoom(),contains:s=>bounds.contains([s.lat,s.lng]),origin:selected,destination,reachableIds:ids,viaIds,project:s=>map.latLngToContainerPoint([s.lat,s.lng])});
 const wanted=new Set(stations.map(s=>s.id));
 for(const[id,marker]of visibleMarkers)if(!wanted.has(id)){markers.removeLayer(marker);visibleMarkers.delete(id);}
 for(const station of stations){
  const isSelected=station.id===selected||station.id===destination;
  const style={radius:isSelected?8:viaIds.has(station.id)?5:station.radius,color:isSelected?'#fff':dark?'#d5e4ec':'#fff',weight:isSelected?2.5:1.2,fillColor:station.id===selected?'#f39a37':station.id===destination?'#b468eb':viaIds.has(station.id)?'#ffbd69':station.tier==='major'?'#198bd2':station.tier==='regional'?'#64b7d1':'#a2abb5',fillOpacity:1};
  let marker=visibleMarkers.get(station.id);
  if(!marker){
   marker=L.circleMarker(stationPosition(station),style).addTo(markers);
   marker.bindTooltip(`${escape(station.name)} <small>${station.frequency} 趟车次</small>`,{permanent:false,direction:'top',className:'station-hover',offset:[0,-5]});
   marker.on('click',()=>choose(station.id));visibleMarkers.set(station.id,marker);
  }else marker.setStyle(style).setRadius(style.radius);
 }
 document.querySelector('#station-count').textContent=`${stations.length} / ${data.stations.length}`;
}
function drawMap(){drawRoutes();drawStations();drawChips();}
function changeSelection(action){
 const before={origin:selected,destination},next=selectionTransition(before,action,new Set(result?.destinations.keys()||[]));
 if(action.type==='pick'&&selected&&next===before){if(action.id!==selected)toast('此站在所选日期没有同车直达车次。');return;}
 focusedTrainId=null;
 const originChanged=selected!==next.origin;selected=next.origin;destination=next.destination;
 if(originChanged)result=selected?reachable(data,selected,travelDate):null;
 query='';destinationQuery='';document.querySelector('#search').value='';document.querySelector('#search-results').innerHTML='';
 routeRevision++;renderPanel();drawMap();
 if(shouldFitSelection(action,before,next)){
  const ids=destination?new Set(selectedPaths(result,destination).flatMap(t=>t.path)):new Set([selected,...result.destinations.keys()]);
  const points=[...ids].map(id=>stationById.get(id)).filter(Boolean).map(stationPosition);
  if(points.length>1)map.fitBounds(L.latLngBounds(points),{padding:[55,55],maxZoom:destination?9:7});
 }
 if(selected&&!geometryReady){const currentDataset=data;ensureGeometry().then(json=>{
  if(currentDataset!==data)return;railGeometry=json;geometryReady=true;routeRevision++;updateRouteAvailability();drawMap();
 }).catch(e=>{document.querySelector('#routing-status').textContent=e.message;toast(e.message);});}
}
function choose(id){changeSelection({type:'pick',id});}
function clear(){changeSelection({type:'reset'});}
function renderPanel(){
  const panel=document.querySelector('#panel');
  const input=document.querySelector('#search');input.disabled=false;input.placeholder=selected?'搜索同车可达的目的地':'搜索始发车站，如 珠海、广州南';input.setAttribute('aria-label',selected?'搜索目的地车站':'搜索出发站');
  const banner=document.querySelector('#selection-banner');banner.hidden=true;
  if(!selected){panel.innerHTML=`<div class="section-heading"><h2>从这里开始</h2><span>热门出发站</span></div><div class="popular">${['珠海','广州南','北京西','上海虹桥','成都东','武汉'].map(name=>data.stations.find(s=>s.name===name)?.id).filter(Boolean).map(id=>`<button data-station="${escape(id)}">${icon('map-pin')} ${escape(stationById.get(id).name)} ${icon('arrow-up-right')}</button>`).join('')}</div><div class="how-card"><span class="how-icon">${icon('route')}</span><h3>你的下一站，会在哪里？</h3><p>先选始发站查看可达网络，再选目的地查看两站间的路线与车次。</p><div><span><b class="tiny-dot"></b>高频车站优先显示</span><span>${icon('zoom-in')} 放大探索小站</span></div></div><div class="data-note"><span class="tag">${data.metadata.kind==='snapshot'?'真实时刻表快照':'导入数据'}</span><p>${data.stations.length.toLocaleString()} 个站点 · ${data.trains.length.toLocaleString()} 趟车次。${data.metadata.kind==='snapshot'?'按所选日期筛选，不含实时余票。':'导入数据的开行日期未核验。'}</p></div>`;}
  else{
    const origin=stationById.get(selected),target=stationById.get(destination);
    panel.innerHTML=`<div class="selection-summary"><div class="endpoint"><span><small>始发车站</small><strong>${escape(origin.name)}</strong></span><button id="clear-origin" aria-label="取消始发站">${icon('x')}</button></div>${target?`<div class="endpoint destination-endpoint"><span><small>目的地</small><strong>${escape(target.name)}</strong></span><button id="clear-destination" aria-label="取消目的地站">${icon('x')}</button></div>`:'<p>点击地图上的可达车站，或搜索目的地。</p>'}</div>`;
    document.querySelector('#clear-origin').onclick=()=>changeSelection({type:'remove-origin'});
    if(target){
     document.querySelector('#clear-destination').onclick=()=>changeSelection({type:'remove-destination'});
     const trains=result.destinations.get(destination)||[];
     panel.insertAdjacentHTML('beforeend',`<div class="section-heading"><h2>${trains.length} 趟直达车次</h2><span>${escape(travelDate)}</span></div>${renderJourneys(trains)}`);
    }else{
     panel.insertAdjacentHTML('beforeend',`<div class="stats"><div><strong>${result.destinations.size}</strong><span>可达站点</span></div><div><strong>${result.services.length}</strong><span>途经车次</span></div></div><div class="section-heading"><h2>可达站点</h2><span>${escape(travelDate)}</span></div><div class="destination-search">${icon('search')}<input id="destination-search" aria-label="筛选可达站点" placeholder="查找目的地" value="${escape(destinationQuery)}"></div><div id="destinations"></div>`);
     document.querySelector('#destination-search').oninput=e=>{destinationQuery=e.target.value;renderDestinations();};renderDestinations();
    }
  }
  panel.querySelectorAll('[data-station]').forEach(b=>b.onclick=()=>choose(b.dataset.station));refreshIcons();
}
function renderDestinations(){
 const entries=[...result.destinations].filter(([id])=>stationById.get(id).name.includes(destinationQuery.trim())).sort((a,b)=>b[1].length-a[1].length);
 const container=document.querySelector('#destinations');if(!container)return;
 container.innerHTML=entries.length?entries.map(([id,trains])=>`<button class="destination" data-destination="${escape(id)}"><span class="destination-dot"></span><span><strong>${escape(stationById.get(id).name)}</strong><small>${trains.length} 趟直达车次</small></span></button>`).join(''):'<div class="empty">所选日期及当前数据中没有匹配的直达车次。</div>';
 container.querySelectorAll('[data-destination]').forEach(b=>b.onclick=()=>choose(b.dataset.destination));refreshIcons();
}
document.querySelector('#search').oninput=e=>{
  query=e.target.value.trim();const matches=query?rankedStations.filter(s=>s.name.includes(query)&&(!selected||result.destinations.has(s.id))).slice(0,30):[];
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
 return `<div class="journey-list">${trains.map(t=>{
  const i=t.originIndex||0,j=i+t.path.length-1,origin=t.times?.[i]?.[1];
  return `<details class="journey" data-train-id="${escape(t.id)}" ${focusedTrainId===t.id?'open':''}><summary><strong>${escape(t.code||t.id)}</strong><span>${displayTime(origin,origin)} 出发 · ${displayTime(t.times?.[j]?.[0],origin)} 到达</span></summary><p class="route-availability" data-route-availability="${escape(t.id)}">${escape(routeAvailabilityText(t))}</p><ol>${t.path.map((id,k)=>`<li><b>${escape(stationById.get(id).name)}</b><span>${displayTime(t.times?.[i+k]?.[0],origin)} / ${displayTime(t.times?.[i+k]?.[1],origin)}</span></li>`).join('')}</ol><small>${escape(operatorLabels[t.operator]||'运营方未核验')} · ${escape(categoryLabels[t.category]||'车种未核验')}<br>到达 / 发车 · 不含实时余票</small></details>`;
 }).join('')}</div>`;
}
function routeAvailabilityText(train){
 if(!geometryReady)return '展开后将加载线路几何并显示沿途停站。';
 const coverage=routeCoverage(train,railGeometry);
 if(coverage.inferred)return `线路覆盖 ${coverage.available} / ${coverage.total} 个区间，其中 ${coverage.inferred} 个区间为 OSM 推算经由（非官方车次轨迹）。`;
 if(coverage.sourceMissing)return '来源无几何，且受约束 OSM 寻路未通过验证；可查看停站，未强行补线。';
 if(coverage.available<coverage.total)return `线路几何覆盖 ${coverage.available} / ${coverage.total} 个区间，缺失部分不补线。`;
 return '线路几何已提供 · 展开时在地图显示本车次区间停站。';
}
function updateRouteAvailability(){
 const trains=selectedPaths(result,destination);
 document.querySelectorAll('[data-route-availability]').forEach(el=>{const train=trains.find(t=>t.id===el.dataset.routeAvailability);if(train)el.textContent=routeAvailabilityText(train);});
}
document.querySelector('#panel').addEventListener('toggle',event=>{
 const details=event.target;if(!details.matches?.('details[data-train-id]'))return;
 const id=details.dataset.trainId;
 if(details.open){
  focusedTrainId=id;
  document.querySelectorAll('details[data-train-id]').forEach(other=>{if(other!==details)other.open=false;});
 }else if(focusedTrainId===id)focusedTrainId=null;else return;
 routeRevision++;drawMap();
},true);
document.querySelector('#travel-date').value=travelDate;
document.querySelector('#travel-date').onchange=e=>{
 if(!e.target.value)return;travelDate=e.target.value;focusedTrainId=null;
 rebuildPriorities();
 if(selected)result=reachable(data,selected,travelDate);
 if(destination&&!result?.destinations.has(destination))destination=null;
 routeRevision++;
 const meta=data.metadata;document.querySelector('#data-summary').textContent=travelDate<meta.validFrom||travelDate>meta.validTo?'所选日期超出快照范围，暂无开行记录':`更新于 ${meta.updatedAt} · ${data.trains.length.toLocaleString()} 趟车次`;
 renderPanel();drawMap();
};
document.querySelector('#restore-snapshot').onclick=()=>applyDataset(snapshot,snapshotGeometry);
const layerPanel=document.querySelector('#layer-panel'),layersToggle=document.querySelector('#layers-toggle');
function showLayers(open,returnFocus=false){layerPanel.hidden=!open;layersToggle.setAttribute('aria-expanded',String(open));if(open)layerPanel.querySelector('[name="basemap"]:checked')?.focus();else if(returnFocus)layersToggle.focus();}
layersToggle.onclick=()=>showLayers(layerPanel.hidden);
document.querySelector('#layers-close').onclick=()=>showLayers(false,true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!layerPanel.hidden){e.preventDefault();showLayers(false,true);}});
document.addEventListener('pointerdown',e=>{if(!layerPanel.hidden&&!layerPanel.contains(e.target)&&!layersToggle.contains(e.target))showLayers(false);});
L.DomEvent.disableClickPropagation(layerPanel);L.DomEvent.disableScrollPropagation(layerPanel);
document.querySelectorAll('[name="basemap"]').forEach(r=>r.onchange=()=>{if(r.checked)setBasemap(r.value);});
document.querySelector('#basemap-retry').onclick=()=>{vectorPromise=null;setBasemap(basemapStyle);};
document.querySelectorAll('[name="line-weight"]').forEach(r=>{r.checked=r.value===lineWeight;r.onchange=()=>{lineWeight=r.value;try{localStorage.setItem('xinggui-line-weight',lineWeight);}catch{}drawMap();};});
let initialBasemap='dark';try{initialBasemap=localStorage.getItem('xinggui-basemap')||'dark';}catch{}
map.on('moveend',drawStations);map.on('zoomend',drawRoutes);renderPanel();setBasemap(initialBasemap);refreshIcons();loadSnapshot();
