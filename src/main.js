import {bundleStationCorridors} from './route-corridors.js';
import {makeDraggablePanel} from './draggable-panel.js';
import {routeTolerance} from './route-lod.js';
import {topologyLeg,topologyDisplayRoutes,passedStations,stationAnchorNodes,stationAnchorPositions} from './route-topology.js';
import {snapshotTravelDate,loadSnapshotGeometry} from './snapshots.js';
import {trainRouteClass,ROUTE_COLORS,DARK_ROUTE_COLORS} from './route-colors.js';
import {createTranslator,addTranslations,registerStationNames,detectCountry,languageForCountry,languageForBrowser,LANGUAGE_KEY} from './i18n.js';
import interfaceCopy from './i18n-copy.js';
addTranslations(interfaceCopy);
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {createIcons, Upload, Info, Plus, Minus, X, Download, Layers, Maximize, ArrowLeftRight, List} from 'lucide';
const icons={Upload,Info,Plus,Minus,X,Download,Layers,Maximize,ArrowLeftRight,List};
import {stationAliases,stationDisplayDataset,stationDisplayGroups,stationDisplayPoint,includeStationCompanions,STATION_SEPARATION_ZOOM} from './station-display.js';
import {englishStationName} from './i18n.js';
import {demoData} from './data.js';
import {coloredDisplayRoutes,offsetRoute,routeCoverage,focusedStopIds} from './route-display.js';
import {reachable,validateData} from './network.js';
import {chinaToday,displayTime,importTimetable,elapsedAtStation} from './timetable.js';
import './style.css';
import {stationPriorities,selectionTransition,selectedPaths,visibleStations,shouldFitSelection} from './map-model.js';
import {routeVariantKey,routeParts,categoryLabels,operatorLabels} from './rail-geometry.js';

const icon = name => `<i data-lucide="${name}"></i>`;
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data={metadata:{kind:'loading'},stations:[],trains:[]}, snapshot=null, snapshotGeometry=null, selected=null, result=null, destination=null;
let stationById=new Map(), rankedStations=[], visibleMarkers=new Map();
let stationGroups=new Map(),aliases=new Map(),displayData=null;
let geometryPromise=null,snapshotIndex=null,activeSnapshot=null,snapshotLoadRevision=0;
let travelDate=chinaToday(),focusedTrainId=null;
document.querySelector('#app').innerHTML=`<main><aside><div class="brand-row"><a class="app-brand" href="/" aria-label="中国铁路互动地图首页"><img src="/china-railway.svg" width="40" height="44" alt="国铁标志"><span><h1>中国铁路互动地图</h1><span class="app-brand-en">China Interactive Rail Map</span></span></a><button id="language-toggle" class="language-switch" type="button" role="switch" aria-label="English interface" aria-checked="false"><span class="language-text">CN</span><span class="language-knob" aria-hidden="true"></span></button></div><div id="panel"></div><footer class="database-footer"><span id="data-summary" role="status">正在加载数据库…</span></footer></aside><section class="map-area" aria-label="中国铁路地图"><div id="map"></div><label class="snapshot-control" for="snapshot-select"><span>数据库日期</span><select id="snapshot-select" aria-label="数据库日期" disabled><option>正在加载…</option></select></label><div class="map-top-right"><span id="station-count"></span> 个站点</div><div id="routing-status" role="status">正在加载铁路路径…</div><div class="map-tools" role="group" aria-label="地图工具"><button id="about" aria-label="数据来源与说明" title="数据来源与说明" aria-expanded="false" aria-controls="source-panel">${icon('info')}</button><button id="legend-toggle" aria-label="地图图例" title="地图图例" aria-expanded="false" aria-controls="legend-panel">${icon('list')}</button><button id="layers-toggle" aria-label="地图与线条" aria-expanded="false" aria-controls="layer-panel" title="地图与线条">${icon('layers')}</button><button id="reset-view" aria-label="回到全国视图" title="回到全国视图">${icon('maximize')}</button><button id="zoom-in" aria-label="放大地图" title="放大">${icon('plus')}</button><button id="zoom-out" aria-label="缩小地图" title="缩小">${icon('minus')}</button></div><section id="layer-panel" role="dialog" aria-modal="false" aria-labelledby="layer-heading" hidden><div class="layer-heading"><h2 id="layer-heading">地图与线条</h2><button id="layers-close" aria-label="关闭地图与线条">${icon('x')}</button></div><fieldset class="basemap-options"><legend class="sr-only">底图风格</legend><label class="basemap-option"><input type="radio" name="basemap" data-basemap="dark" value="dark"><span class="map-swatch swatch-dark" aria-hidden="true"></span><span><strong>深色</strong><small>OpenFreeMap Dark</small></span></label><label class="basemap-option"><input type="radio" name="basemap" data-basemap="positron" value="positron"><span class="map-swatch swatch-light" aria-hidden="true"></span><span><strong>简洁浅色</strong><small>OpenFreeMap Positron</small></span></label><label class="basemap-option"><input type="radio" name="basemap" data-basemap="liberty" value="liberty"><span class="map-swatch swatch-liberty" aria-hidden="true"></span><span><strong>彩色地图</strong><small>OpenFreeMap Liberty</small></span></label><label class="basemap-option"><input type="radio" name="basemap" data-basemap="osm" value="osm"><span class="map-swatch swatch-osm" aria-hidden="true"></span><span><strong>OSM 标准</strong><small>完整街道信息</small></span></label></fieldset><fieldset class="line-options"><legend>线条粗细 · 全局</legend><label><input type="radio" name="line-weight" value="fine" checked><span class="line-sample fine"></span>细（默认）</label><label><input type="radio" name="line-weight" value="bold"><span class="line-sample bold"></span>粗</label></fieldset><p id="basemap-status" role="status">地图数据来自 OpenStreetMap</p><button id="basemap-retry" hidden>重新加载底图</button></section><section id="source-panel" role="dialog" aria-modal="false" aria-label="信息" hidden><button id="source-close" class="close-dialog" aria-label="关闭">${icon('x')}</button><section class="source-section"><button type="button" id="source-heading" class="source-accordion" aria-expanded="false" aria-controls="source-scroll">数据来源与说明<span aria-hidden="true">⌄</span></button><div id="source-scroll" class="source-scroll" tabindex="0" role="region" aria-labelledby="source-heading" hidden><p><span id="data-mode">正在加载时刻表</span></p><p id="data-origin"></p><p>默认使用 wensimehrp / chinese-railway-gtfs 发布的真实时刻表快照，运行数据由 RailGo-Parser 获取，站点坐标来自 OpenStreetMap。按乘车站当地日期筛选开行车次，跨午夜时按始发日换算。这里不查询实时余票或临时停运。</p><p id="snapshot-details">正在读取数据版本…</p><p>可达指同一趟列车在所选站之后的停站，不计算换乘。线路优先采用每趟车自己的来源走向；缺失时使用保留线路名、高速线、运营方、轨距等属性的 OSM 路网逐站推算，并明确标注。OSM 货运标签仅增加寻路代价，不再直接禁行；工业专用线、车种与运营方等约束仍保留。仍无法通过约束检查的区间列入自动缺线清单。铁路几何不等同于经官方核实的车次经由。</p><p>支持导入 qETRC .pyetgr / .pyetdb 文件，按车站名称匹配内置坐标。导入内容的真实性和有效日期由文件提供者负责。</p><a href="https://github.com/wensimehrp/chinese-railway-gtfs" target="_blank" rel="noreferrer">时刻表来源与更新</a> · <a href="/timetable/routing-audit.json" data-snapshot-audit target="_blank" rel="noreferrer">自动缺线清单</a> · <a href="https://github.com/CDK6182CHR/qETRC" target="_blank" rel="noreferrer">qETRC 项目</a><div class="source-actions"><button id="import" class="primary">${icon('upload')} 导入时刻表</button><button id="restore-snapshot" hidden>恢复内置快照</button></div><button id="download" class="primary">下载时刻表格式示例 ${icon('download')}</button><p class="fine">导入在浏览器本地完成，刷新后恢复内置真实时刻表快照。深浅底图来自 OpenFreeMap，无法连接时使用 OSM 栅格的备用视觉样式。铁路几何 © OpenStreetMap contributors，ODbL 1.0；OSM 路网日期与推算来源见自动审计记录；时刻表与上游线路走向快照见版本说明。</p></div></section><section class="changelog-section" aria-labelledby="changelog-heading"><h3 id="changelog-heading">更新日志</h3><div class="changelog-scroll" tabindex="0" role="region" aria-labelledby="changelog-heading"><article><time datetime="2026-11-27">2026-11-27</time><h4>不同停站车次共线合并</h4><p>按共同车站拆分显示区间，让直达车和分段停站车共享同一条线，修复深圳北至葵潭、合肥至六安等区域的同色重线。</p></article><article><time datetime="2026-11-27">2026-11-27</time><h4>图例布局与绿皮车配色</h4><p>图例默认关闭，车站大小和车次类型分列展示；打开时避开工具栏，普速线改用更明亮的绿皮车绿色。</p></article><article><time datetime="2026-11-27">2026-11-27</time><h4>可拖动图例</h4><p>图例独立为浮窗，可从工具栏开关，拖动标题栏移动，右上角关闭。</p></article><article><time datetime="2026-11-27">2026-11-27</time><h4>车站与线路对齐</h4><p>简化线路时保留停靠和通过站锚点，平行线在车站附近收拢，防止线路拉直后偏离站点。</p></article><article><time datetime="2026-11-27">2026-11-27</time><h4>线路降噪与内存优化</h4><p>缩小时简化展线和细碎弯折，放大后恢复细节；近似上下行轨道合并显示，并减少非绘图数据加载。</p></article><article><time datetime="2026-11-27">2026-11-27</time><h4>并行线路连续性</h4><p>各颜色独立连续绘制，共线颜色变化时保持偏移位置，分段交界共用节点，修复短段跳位和缝隙。</p></article><article><time datetime="2026-11-27">2026-11-27</time><h4>共享路段与通过站</h4><p>已计算的车次路径拆为共享路段，同类别共线路段只绘制一次。展开车次可查看路径识别的通过站，不提供推算通过时间。</p></article><article><time datetime="2026-11-27">2026-11-27</time><h4>历史数据库切换</h4><p>地图左上角可按数据库日期切换快照。更新时保留旧时刻表及对应线路，历史版本按当时日期查看车次。</p></article><article><time datetime="2026-11-27">2026-11-27</time><h4>信息面板整理</h4><p>信息面板分为说明、更新日志和图例：说明默认收起，日志独立滚动，图例始终显示。</p></article><article><time datetime="2026-11-27">2026-11-27</time><h4>站点合并与场区区分</h4><p>同站同运营单位的重复代码合并显示并汇总车次，只有运营单位不同时才区分站点。</p></article><article><time datetime="2026-11-27">2026-11-27</time><h4>线路配色与并行显示</h4><p>G/D 车次用红色、C/S 用蓝色，其他车次用深绿色；共线区间使用错开的并行实线，蓝色已调亮。</p></article><article><time datetime="2026-11-27">2026-11-27</time><h4>双语与行程交互</h4><p>支持中英文切换、始发地与目的地互换、途中站点已行走时间，以及紧凑的跨日时间标记。</p></article></div></section></section><section id="legend-panel" role="dialog" aria-modal="false" aria-labelledby="legend-heading" hidden><div class="legend-window-heading" id="legend-drag-handle" tabindex="0" aria-label="拖动图例" title="拖动以移动图例"><h3 id="legend-heading">地图图例</h3><button id="legend-close" type="button" aria-label="关闭图例" title="关闭图例">${icon('x')}</button></div><div class="legend"><div class="legend-column"><h4>车站</h4><span><b class="legend-major"></b>主要枢纽</span><span><b class="legend-regional"></b>区域枢纽</span><span><b class="legend-minor"></b>一般车站</span></div><div class="legend-column"><h4>车次类型</h4><span><b class="legend-route route-highspeed"></b>G/D 车次</span><span><b class="legend-route route-conventional"></b>其他车次</span><span><b class="legend-route route-intercity"></b>C/S 车次</span></div></div></section><div id="toast" role="status"></div></section></main><input id="file" type="file" accept=".json,.pyetgr,.pyetdb,application/json" hidden>`;
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
 if(!['positron','dark','liberty','osm'].includes(style))style='dark';
 basemapStyle=style;const generation=++basemapGeneration;clearTimeout(basemapTimer);
 if(vectorLayer){map.removeLayer(vectorLayer);vectorLayer=null;}
 dark=style==='dark';document.body.classList.toggle('dark-map',dark);setRasterStyle(style);ensureRaster();
 document.querySelectorAll('[name="basemap"]').forEach(r=>r.checked=r.value===style);
 try{localStorage.setItem('xinggui-basemap',style);}catch{}
 const name={dark:'OpenFreeMap Dark',positron:'OpenFreeMap Positron',liberty:'OpenFreeMap Liberty'}[style];
 const status=document.querySelector('#basemap-status'),retry=document.querySelector('#basemap-retry');retry.hidden=true;
 drawMap();
 if(style==='osm'){status.textContent='OSM 标准 · 地图数据来自 OpenStreetMap';return;}
 status.textContent=`正在加载 ${name}，暂用 OSM 备用样式…`;
 let vectorLoaded=false,lastError='';
 const errorText=message=>/webgl/i.test(message)?'浏览器无法启用 WebGL':/404/.test(message)?'地图资源未找到（404）':/20 秒/.test(message)?message:'地图资源或网络连接失败';
 function fallback(reason){
  if(generation!==basemapGeneration)return;clearTimeout(basemapTimer);
  if(vectorLayer){map.removeLayer(vectorLayer);vectorLayer=null;}
  ensureRaster();status.textContent=`${name} 加载失败：${errorText(reason||lastError||'未知错误')}。暂用 OSM ${dark?'深色':'浅色'}备用样式。`;retry.hidden=false;
 }
 try{
  vectorPromise??=import('./vector-basemap.js');const {createVectorLayer}=await vectorPromise;
  if(generation!==basemapGeneration)return;
  const layer=createVectorLayer(`https://tiles.openfreemap.org/styles/${style}`,'<a href="https://openfreemap.org/">OpenFreeMap</a> · © OpenMapTiles · '+attribution);
  vectorLayer=layer;layer.addTo(map);const gl=layer.getMaplibreMap();
  gl.on('load',()=>{
   if(generation!==basemapGeneration||vectorLayer!==layer)return;vectorLoaded=true;clearTimeout(basemapTimer);
   if(basemapLayer){map.removeLayer(basemapLayer);basemapLayer=null;}
   status.textContent=`${name} · 地图数据来自 OpenStreetMap`;retry.hidden=true;
  });
  gl.on('error',event=>{lastError=event.error?.message||'地图资源请求失败';console.warn('OpenFreeMap:',lastError);if(!vectorLoaded)status.textContent=`正在加载 ${name} · ${errorText(lastError)}`;});basemapTimer=setTimeout(()=>fallback(lastError||'加载超过 20 秒'),20000);
 }catch(error){console.warn('OpenFreeMap initialization:',error.message);fallback(error.message);}
}
let railGeometry={segments:{}},geometryReady=false;
const snapshotSelect=document.querySelector('#snapshot-select');
L.DomEvent.disableClickPropagation(document.querySelector('.snapshot-control'));
L.DomEvent.disableScrollPropagation(document.querySelector('.snapshot-control'));
snapshotSelect.onchange=()=>switchSnapshot(snapshotSelect.value);
async function loadSnapshot(){
 try{
  const r=await fetch('/timetable/snapshots.json');if(!r.ok)throw Error('数据库版本列表加载失败');
  snapshotIndex=await r.json();
  snapshotSelect.innerHTML=snapshotIndex.snapshots.map(entry=>`<option value="${escape(entry.id)}">${escape(entry.date)}${snapshotIndex.snapshots.filter(other=>other.date===entry.date).length>1?' · '+escape(entry.id.replace(/^gtfs-/,'')):''}</option>`).join('');
  map.attributionControl.addAttribution('时刻表 © <a href="https://github.com/wensimehrp/chinese-railway-gtfs">wensimehrp</a> · CC BY 4.0');
  await switchSnapshot(snapshotIndex.current);
 }catch(e){document.querySelector('#data-mode').textContent='加载失败';document.querySelector('#data-summary').textContent='时刻表加载失败，请刷新重试或导入文件。';toast(e.message);}
}
async function switchSnapshot(id){
 const entry=snapshotIndex.snapshots.find(item=>item.id===id);if(!entry)return;
 const revision=++snapshotLoadRevision;snapshotSelect.disabled=true;
 try{
  const r=await fetch(entry.base+'data.json');if(!r.ok)throw Error('时刻表加载失败');
  const next=validateData(await r.json());if(revision!==snapshotLoadRevision)return;
  if(next.metadata?.release!==entry.id)throw Error('数据库版本不匹配');
  activeSnapshot=entry;snapshot=next;snapshotGeometry=null;geometryPromise=null;
  travelDate=snapshotTravelDate(entry,snapshotIndex.current,chinaToday());
  snapshotSelect.value=entry.id;applyDataset(snapshot,null);
  document.querySelectorAll('[data-snapshot-audit]').forEach(link=>link.href=entry.base+'routing-audit.json');
 }catch(error){if(revision===snapshotLoadRevision){snapshotSelect.value=activeSnapshot?.id||snapshotIndex.current;toast(error.message);if(!snapshot)throw error;}}
 finally{if(revision===snapshotLoadRevision)snapshotSelect.disabled=false;}
}
async function ensureGeometry(){
 if(snapshotGeometry)return snapshotGeometry;
 if(!geometryPromise){
  const entry=activeSnapshot;
  const pending=loadSnapshotGeometry(entry?.base||'/timetable/',fetch,{runtime:true}).then(json=>{if(activeSnapshot===entry)snapshotGeometry=json;return json;}).catch(error=>{if(geometryPromise===pending)geometryPromise=null;throw error;});
  geometryPromise=pending;
 }
 return geometryPromise;
}
function rebuildPriorities(){rankedStations=stationPriorities(displayData||data,travelDate);visibleMarkers.forEach(marker=>marker.remove());visibleMarkers.clear();}
function applyDataset(next,geometry){
 registerStationNames(next.stations);
 data={...next,metadata:next.metadata||{kind:'import'}};railGeometry=geometry||{segments:{}};geometryReady=!!geometry;
 stationById=new Map(data.stations.map(s=>[s.id,s]));
 aliases=stationAliases(data);displayData=stationDisplayDataset(data,aliases);
 stationGroups=stationDisplayGroups(displayData);
 const suffixes={'国铁':'China Railway','城际':'Intercity','城际／国铁':'Intercity / China Railway','独立站点':'Separate station'};
 addTranslations(Object.fromEntries([...stationGroups].map(([id,g])=>[g.name,`${englishStationName(stationById.get(id).name)} (${g.suffix.split(' · ').map(part=>suffixes[part]||part).join(' · ')})`])));
 rebuildPriorities();
 visibleMarkers.forEach(marker=>marker.remove());visibleMarkers.clear();
 const meta=data.metadata||{},isSnapshot=meta.kind==='snapshot';
 document.querySelector('#restore-snapshot').hidden=isSnapshot||!snapshot;
 document.querySelector('#data-mode').textContent=isSnapshot?'真实时刻表快照':'导入时刻表';
 document.querySelector('#data-summary').textContent=isSnapshot?`数据库更新 ${meta.updatedAt} · ${data.trains.length.toLocaleString()} 趟车次`:'导入文件未核验开行日期';
 document.querySelector('#data-origin').textContent=isSnapshot?'来源：chinese-railway-gtfs / RailGo-Parser · 实际开行请以 12306 为准':'用户导入时刻表 · 请自行核对来源与有效日期';
 const sm=snapshot?.metadata;
 if(sm)document.querySelector('#snapshot-details').textContent=`内置版本 ${sm.release}，${snapshot.stations.length} 个站点、${snapshot.trains.length} 趟车次；开行日记录范围 ${sm.validFrom} 至 ${sm.validTo}。CC BY 4.0，作者 wensimehrp (Jeremy Gao)。快照不代表所有日期的全部列车。`;
 clear();
}
const stationLeaders=L.layerGroup().addTo(map);
const markers=L.layerGroup().addTo(map),activeLines=L.layerGroup().addTo(map),selectionChips=L.layerGroup().addTo(map);
let routeRevision=0,drawnRouteRevision=-1,drawnStyle='',chipKey='',displayLegRevision=-1,displayLegCache=[],displayGeometryCache=null;
const refreshIcons=()=>createIcons({icons,attrs:{'stroke-width':1.7}});
let toastTimer;
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3400);}
function stationPosition(s){return [s.lat,s.lng];}
function stationDisplayPosition(s){const point=stationDisplayPoint(s,stationGroups,map.getZoom());return map.unproject(L.point(point.x,point.y),map.getZoom());}
function stationName(id){const key=aliases.get(id)||id;return stationGroups.get(key)?.name||stationById.get(key)?.name||id;}
function drawRoutes(){
 const style=`${dark}-${lineWeight}-${map.getZoom()}`;
 if(drawnRouteRevision===routeRevision&&drawnStyle===style)return;
 drawnRouteRevision=routeRevision;drawnStyle=style;activeLines.clearLayers();
 if(!selected){document.querySelector('#routing-status').textContent='选择始发站，查看同车可达车站';return;}
 if(!geometryReady){document.querySelector('#routing-status').textContent='正在加载铁路路径…';return;}
 const seen=new Set(),routes=[],topologyLegs=[],missing=new Set(),trains=selectedPaths(result,destination).filter(t=>!focusedTrainId||t.id===focusedTrainId);
 for(const train of trains)for(let i=1;i<train.path.length;i++){
  const routeClass=trainRouteClass(train);
  const a=train.path[i-1],b=train.path[i],key=routeClass+'|'+routeVariantKey(train,a,b,railGeometry);if(seen.has(key))continue;seen.add(key);
  const leg=topologyLeg(train,a,b,railGeometry,stationById);if(leg){topologyLegs.push({...leg,routeClass});continue;}
  const route=routeParts([a,b],stationById,railGeometry,train);if(route.length)routes.push(...route.map(coordinates=>({pair:[a,b].sort().join('|'),coordinates,routeClass})));else missing.add(key);
 }
 const palette=dark?DARK_ROUTE_COLORS:ROUTE_COLORS,weight=lineWeight==='bold'?4:2;
 const projection={project:point=>map.project(point,map.getZoom()),unproject:point=>map.unproject(L.point(point.x,point.y),map.getZoom()),gap:weight+1.5,tolerance:routeTolerance(map.getZoom())};
 if(railGeometry.topology&&displayLegRevision!==routeRevision){const display=bundleStationCorridors(topologyLegs,railGeometry,stationById,{stationKey:id=>aliases.get(id)||id});displayLegCache=display.legs;displayGeometryCache=display.geometry;displayLegRevision=routeRevision;}
 const displayLegs=railGeometry.topology?displayLegCache:topologyLegs;
 if(railGeometry.topology){projection.protectedNodes=stationAnchorNodes(displayLegs,displayGeometryCache.topology);projection.anchorPositions=stationAnchorPositions(displayLegs,displayGeometryCache,stationById,id=>aliases.get(id)||id);}
 const batches=[...coloredDisplayRoutes(routes,projection.project),...(railGeometry.topology?topologyDisplayRoutes(displayLegs,displayGeometryCache.topology,projection):[])];
 for(const batch of batches)batch.classes.forEach((type,index)=>{
  const offset=(index-(batch.classes.length-1)/2)*(weight+1.5);
  const coordinates=batch.offsetApplied?batch.coordinates:batch.coordinates.map(line=>offsetRoute(line,offset,point=>map.project(point,map.getZoom()),point=>map.unproject(L.point(point.x,point.y),map.getZoom())));
  L.polyline(coordinates,{color:palette[type],weight,opacity:.95,interactive:false,smoothFactor:batch.offsetApplied?0:1,lineCap:'round',lineJoin:'round'}).addTo(activeLines);
 });
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
 const key=`${selected}|${destination}|${map.getZoom()}`;if(key===chipKey)return;chipKey=key;selectionChips.clearLayers();
 for(const [id,role]of [[selected,'origin'],[destination,'destination']]){
  if(!id)continue;const station=stationById.get(id);
  const marker=L.marker(stationDisplayPosition(station),{keyboard:false,zIndexOffset:1000,icon:L.divIcon({className:'station-chip-anchor',iconSize:[1,1],iconAnchor:role==='origin'?[-12,20]:[12,20],html:`<div class="station-chip ${role}"><span><small>${role==='origin'?'始发':'目的地'}</small><strong>${escape(stationName(station.id))}</strong></span><button type="button" aria-label="取消${role==='origin'?'始发':'目的地'}站 ${escape(stationName(station.id))}">×</button></div>`})}).addTo(selectionChips);
  const element=marker.getElement();L.DomEvent.disableClickPropagation(element);element.querySelector('button').onclick=()=>changeSelection({type:role==='origin'?'remove-origin':'remove-destination'});
 }
}
function drawStations(){
 const focusedTrain=selectedPaths(result,destination).find(t=>t.id===focusedTrainId);
 const stopIds=new Set(focusedTrain?.stops.map(id=>aliases.get(id)||id)||[]);
 const passIds=new Set(passedStations(focusedTrain,railGeometry,stationById).map(s=>aliases.get(s.id)||s.id).filter(id=>!stopIds.has(id)));
 const bounds=map.getBounds().pad(.08),ids=new Set(result?.destinations.keys()||[]),viaIds=new Set([...focusedStopIds(selectedPaths(result,destination),focusedTrainId)].map(id=>aliases.get(id)||id).concat([...passIds]));
 let stations=visibleStations(rankedStations,{zoom:map.getZoom(),contains:s=>bounds.contains([s.lat,s.lng]),origin:selected,destination,reachableIds:ids,viaIds,project:s=>map.latLngToContainerPoint([s.lat,s.lng])});
 if(!selected)stations=includeStationCompanions(stations,rankedStations,stationGroups,map.getZoom());
 stationLeaders.clearLayers();
 const wanted=new Set(stations.map(s=>s.id));
 for(const[id,marker]of visibleMarkers)if(!wanted.has(id)){markers.removeLayer(marker);visibleMarkers.delete(id);}
 for(const station of stations){
  const isSelected=station.id===selected||station.id===destination,isPass=passIds.has(station.id);
  const style={radius:isSelected?8:isPass?3.5:viaIds.has(station.id)?5:station.radius,color:isSelected?'#fff':dark?'#d5e4ec':'#fff',weight:isSelected?2.5:1.2,fillColor:isPass?'#91a7b5':station.id===selected?'#f39a37':station.id===destination?'#b468eb':viaIds.has(station.id)?'#ffbd69':station.tier==='major'?'#198bd2':station.tier==='regional'?'#64b7d1':'#a2abb5',fillOpacity:1};
  const position=stationDisplayPosition(station);
  if(map.getZoom()>=STATION_SEPARATION_ZOOM&&stationGroups.has(station.id))L.polyline([stationPosition(station),position],{color:'#8096a3',weight:1,opacity:.65,dashArray:'2 3',interactive:false}).addTo(stationLeaders);
  const elapsed=elapsedAtStation(focusedTrain,focusedTrain?.stops.find(id=>(aliases.get(id)||id)===station.id)||station.id);
  const tooltip=`${escape(stationName(station.id))} <small>${isPass?'通过（路径推算）':elapsed||`${station.frequency} 趟车次${station.regionalRepresentative?' · 区域代表站':''}`}</small>`;
  let marker=visibleMarkers.get(station.id);
  if(!marker){
   marker=L.circleMarker(position,style).addTo(markers);
   marker.bindTooltip(tooltip,{permanent:false,direction:'top',className:'station-hover',offset:[0,-5]});
   marker.on('click',()=>choose(station.id));visibleMarkers.set(station.id,marker);
  }else {marker.setLatLng(position).setStyle(style).setRadius(style.radius);marker.setTooltipContent(tooltip);}
 }
 document.querySelector('#station-count').textContent=`${stations.length} / ${rankedStations.length}`;
}
function drawMap(){drawRoutes();drawStations();drawChips();}
function changeSelection(action){
 const before={origin:selected,destination},next=selectionTransition(before,action,new Set(result?.destinations.keys()||[]));
 if(action.type==='pick'&&selected&&next===before){if(action.id!==selected)toast('此站在所选日期没有同车直达车次。');return;}
 focusedTrainId=null;
 const originChanged=selected!==next.origin;selected=next.origin;destination=next.destination;
 if(originChanged)result=selected?reachable(data,selected,travelDate,aliases):null;
 if(!selected){displayLegCache=[];displayGeometryCache=null;displayLegRevision=-1;}
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
function choose(id){changeSelection({type:'pick',id:aliases.get(id)||id});}
function clear(){changeSelection({type:'reset'});}
function renderPanel(){
  const panel=document.querySelector('#panel');
  if(!selected){panel.innerHTML=`<div class="section-heading"><h2>选择始发站</h2><span>点击地图车站</span></div><div class="popular">${['珠海','广州南','广州白云','北京西','上海虹桥','成都东','武汉','西安北','杭州东','深圳北','重庆北','郑州东'].map(name=>data.stations.find(s=>s.name===name)?.id).filter(Boolean).map(id=>`<button data-station="${escape(id)}">${escape(stationName(id))}</button>`).join('')}</div><p class="selection-hint">放大地图可选择更多车站</p>`;}
  else{
    const origin=stationById.get(selected),target=stationById.get(destination);
    panel.innerHTML=`<div class="selection-summary"><div class="endpoint"><span><small>始发车站</small><strong>${escape(stationName(origin.id))}</strong></span><button id="clear-origin" aria-label="取消始发站">${icon('x')}</button></div>${target?`<button type="button" id="swap-stations" class="swap-stations" aria-label="交换始发站和目的地" title="交换始发站和目的地">${icon('arrow-left-right')}</button><div class="endpoint destination-endpoint"><span><small>目的地</small><strong>${escape(stationName(target.id))}</strong></span><button id="clear-destination" aria-label="取消目的地站">${icon('x')}</button></div>`:'<p>点击可达车站选择目的地。</p>'}</div>`;
    document.querySelector('#clear-origin').onclick=()=>changeSelection({type:'remove-origin'});
    if(target){
     document.querySelector('#swap-stations').onclick=()=>{changeSelection({type:'swap'});document.querySelector('#swap-stations')?.focus();};
     document.querySelector('#clear-destination').onclick=()=>changeSelection({type:'remove-destination'});
     const trains=result.destinations.get(destination)||[];
     panel.insertAdjacentHTML('beforeend',`<div class="section-heading"><h2>${trains.length} 趟直达车次</h2><span>${escape(travelDate)}</span></div>${trains.length?renderJourneys(trains):'<p class="empty">所选日期没有此方向的直达车次。</p>'}`);
    }else{
     panel.insertAdjacentHTML('beforeend',`<div class="stats"><div><strong>${result.destinations.size}</strong><span>可达站点</span></div><div><strong>${result.services.length}</strong><span>途经车次</span></div></div><div class="section-heading"><h2>可达站点</h2><span>${escape(travelDate)}</span></div><div id="destinations"></div>`);
     renderDestinations();
    }
  }
  panel.querySelectorAll('[data-station]').forEach(b=>b.onclick=()=>choose(b.dataset.station));refreshIcons();
}
function renderDestinations(){
 const entries=[...result.destinations].sort((a,b)=>b[1].length-a[1].length);
 const container=document.querySelector('#destinations');if(!container)return;
 container.innerHTML=entries.length?entries.map(([id,trains])=>`<button class="destination" data-destination="${escape(id)}"><span class="destination-dot"></span><span><strong>${escape(stationName(id))}</strong><small>${trains.length} 趟直达车次</small></span></button>`).join(''):'<div class="empty">所选日期及当前数据中没有匹配的直达车次。</div>';
 container.querySelectorAll('[data-destination]').forEach(b=>b.onclick=()=>choose(b.dataset.destination));refreshIcons();
}
document.querySelector('#zoom-in').onclick=()=>map.zoomIn();document.querySelector('#zoom-out').onclick=()=>map.zoomOut();document.querySelector('#reset-view').onclick=()=>map.setView([34.5,106.5],4);
const sourcePanel=document.querySelector('#source-panel'),sourceToggle=document.querySelector('#about');
function showSources(open,returnFocus=false){sourcePanel.hidden=!open;sourceToggle.setAttribute('aria-expanded',String(open));if(open)showLayers(false);else if(returnFocus)sourceToggle.focus();}
sourceToggle.onclick=()=>showSources(sourcePanel.hidden);
document.querySelector('#source-heading').onclick=event=>{const button=event.currentTarget,open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));document.querySelector('#source-scroll').hidden=!open;};
document.querySelector('#source-close').onclick=()=>showSources(false,true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!sourcePanel.hidden){e.preventDefault();showSources(false,true);}});
document.addEventListener('pointerdown',e=>{if(!sourcePanel.hidden&&!sourcePanel.contains(e.target)&&!sourceToggle.contains(e.target))showSources(false);});
L.DomEvent.disableClickPropagation(sourcePanel);L.DomEvent.disableScrollPropagation(sourcePanel);
const legendPanel=document.querySelector('#legend-panel'),legendToggle=document.querySelector('#legend-toggle');
const legendArea=document.querySelector('.map-area');
const legendDrag=makeDraggablePanel(legendPanel,document.querySelector('#legend-drag-handle'),legendArea,{initialPosition:()=>{
 const toolbar=document.querySelector('.map-tools').getBoundingClientRect(),area=legendArea.getBoundingClientRect();
 return {x:toolbar.left-area.left-legendPanel.offsetWidth-12,y:toolbar.bottom-area.top-legendPanel.offsetHeight};
}});
function showLegend(open,returnFocus=false){legendPanel.hidden=!open;legendToggle.setAttribute('aria-expanded',String(open));if(open)legendDrag.fit();else if(returnFocus)legendToggle.focus();}
legendToggle.onclick=()=>showLegend(legendPanel.hidden);
document.querySelector('#legend-close').onclick=()=>showLegend(false,true);
legendPanel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();showLegend(false,true);}});
L.DomEvent.disableClickPropagation(legendPanel);L.DomEvent.disableScrollPropagation(legendPanel);

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
  return `<details class="journey" data-train-id="${escape(t.id)}" ${focusedTrainId===t.id?'open':''}><summary><strong class="train-code" data-route-class="${trainRouteClass(t)}">${escape(t.code||t.id)}</strong><span>${displayTime(origin,origin)} 出发 · ${displayTime(t.times?.[j]?.[0],origin)} 到达</span></summary><dl class="train-endpoints" aria-label="车次完整始终站"><div><dt>始发站</dt><dd>${escape(stationById.get(t.stops[0])?.name||t.stops[0])}</dd></div><div><dt>终点站</dt><dd>${escape(stationById.get(t.stops.at(-1))?.name||t.stops.at(-1))}</dd></div></dl><p class="route-availability" data-route-availability="${escape(t.id)}">${escape(routeAvailabilityText(t))}</p><ol>${t.path.map((id,k)=>`<li><b>${escape(stationName(id))}</b><span>${displayTime(t.times?.[i+k]?.[0],origin)} / ${displayTime(t.times?.[i+k]?.[1],origin)}</span></li>`).join('')}</ol><small>${escape(operatorLabels[t.operator]||'运营方未核验')} · ${escape(categoryLabels[t.category]||'车种未核验')}<br>到达 / 发车 · 不含实时余票</small></details>`;
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
document.querySelector('#restore-snapshot').onclick=()=>applyDataset(snapshot,snapshotGeometry);
const layerPanel=document.querySelector('#layer-panel'),layersToggle=document.querySelector('#layers-toggle');
function showLayers(open,returnFocus=false){layerPanel.hidden=!open;layersToggle.setAttribute('aria-expanded',String(open));if(open)showSources(false);if(open)layerPanel.querySelector('[name="basemap"]:checked')?.focus();else if(returnFocus)layersToggle.focus();}
layersToggle.onclick=()=>showLayers(layerPanel.hidden);
document.querySelector('#layers-close').onclick=()=>showLayers(false,true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!layerPanel.hidden){e.preventDefault();showLayers(false,true);}});
document.addEventListener('pointerdown',e=>{if(!layerPanel.hidden&&!layerPanel.contains(e.target)&&!layersToggle.contains(e.target))showLayers(false);});
L.DomEvent.disableClickPropagation(layerPanel);L.DomEvent.disableScrollPropagation(layerPanel);
document.querySelectorAll('[name="basemap"]').forEach(r=>r.onchange=()=>{if(r.checked)setBasemap(r.value);});
document.querySelector('#basemap-retry').onclick=()=>{vectorPromise=null;setBasemap(basemapStyle);};
document.querySelectorAll('[name="line-weight"]').forEach(r=>{r.checked=r.value===lineWeight;r.onchange=()=>{lineWeight=r.value;try{localStorage.setItem('xinggui-line-weight',lineWeight);}catch{}drawMap();};});
let initialBasemap='dark';try{initialBasemap=localStorage.getItem('xinggui-basemap')||'dark';}catch{}
map.on('moveend',drawStations);map.on('zoomend',()=>{drawRoutes();drawChips();});renderPanel();setBasemap(initialBasemap);refreshIcons();loadSnapshot();

const translator=createTranslator(document.querySelector('#app'));
let language=languageForBrowser(navigator.languages||[navigator.language]),manualLanguage=false;
try{const saved=localStorage.getItem(LANGUAGE_KEY);if(['zh','en'].includes(saved)){language=saved;manualLanguage=true;}}catch{}
function setLanguage(value,manual=false){
 language=value;if(manual){manualLanguage=true;try{localStorage.setItem(LANGUAGE_KEY,value);}catch{}}
 document.documentElement.lang=value==='en'?'en':'zh-CN';
 document.title=value==='en'?'China Interactive Rail Map':'中国铁路互动地图 · China Interactive Rail Map';
 const toggle=document.querySelector('#language-toggle');toggle.setAttribute('aria-checked',String(value==='en'));toggle.querySelector('.language-text').textContent=value==='en'?'EN':'CN';
 translator.setLanguage(value);
 // Rebuild only presentation, preserving selected stations, train and map viewport.
 chipKey='';routeRevision++;renderPanel();drawMap();translator.refresh();
}
document.querySelector('#language-toggle').onclick=()=>setLanguage(language==='en'?'zh':'en',true);
setLanguage(language);
if(!manualLanguage)detectCountry().then(country=>{if(country&&!manualLanguage)setLanguage(languageForCountry(country));});
