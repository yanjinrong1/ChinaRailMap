import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {createIcons, TrainFront, ArrowUpRight, Upload, Search, MapPin, Route, ZoomIn, Info, LocateFixed, Plus, Minus, X, Download, LockKeyhole, ChevronDown} from 'lucide';
const icons={TrainFront,ArrowUpRight,Upload,Search,MapPin,Route,ZoomIn,Info,LocateFixed,Plus,Minus,X,Download,LockKeyhole,ChevronDown};
import {demoData} from './data.js';
import {reachable,validateData} from './network.js';
import './style.css';

const icon = name => `<i data-lucide="${name}"></i>`;
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data=demoData, selected=null, result=null, destination=null, query='', destinationQuery='';
let stationById=new Map(data.stations.map(s=>[s.id,s]));
document.querySelector('#app').innerHTML=`
<header><a class="brand" href="/" aria-label="行轨首页"><span class="brand-icon">${icon('train-front')}</span><strong>行轨<span>中国铁路可达地图</span></strong></a><nav><span class="nav-active">探索地图</span><button id="about">关于数据 ${icon('arrow-up-right')}</button></nav><div class="header-right"><span class="demo-badge"><b></b><span id="data-mode">演示数据</span></span><button id="import" class="import">${icon('upload')} 导入时刻表</button></div></header>
<main><aside><div class="intro"><div class="eyebrow">沿着铁轨，发现更多</div><h1>从一站出发，<br>看见所有可能。</h1><p>选择一个车站，探索列车可以带你去的地方。</p></div><div class="search-box">${icon('search')}<input id="search" placeholder="搜索车站，如 珠海、广州南" autocomplete="off" aria-label="搜索出发站"><kbd>⌕</kbd></div><div id="search-results"></div><div id="panel"></div><div class="sidebar-bottom">${icon('info')}<span>演示时刻表 · 站间连线仅供示意<br>实际开行与停站请以 12306 公布为准</span></div></aside><section class="map-area" aria-label="中国铁路地图"><div id="map"></div><div class="map-title"><span class="live-dot"></span><span>中国铁路网络</span><small id="map-subtitle">缩放地图，发现沿途车站</small></div><div class="map-top-right"><span id="station-count"></span> 个站点<button id="reset-view" aria-label="回到全国视图">${icon('locate-fixed')}</button></div><div id="selection-banner" hidden></div><div class="zoom"><button id="zoom-in" aria-label="放大地图">${icon('plus')}</button><button id="zoom-out" aria-label="缩小地图">${icon('minus')}</button></div><div class="legend"><strong>地图图例</strong><span><b class="legend-hub"></b>枢纽站</span><span><b class="legend-station"></b>一般站点</span><span><b class="legend-route"></b>可达线路</span><small>放大地图可查看小站</small></div><div class="map-footer">铁路，让远方更近。<span>CHINA RAILWAY EXPLORER</span></div><div id="toast" role="status"></div></section></main>
<dialog id="about-dialog"><button class="close-dialog" aria-label="关闭">${icon('x')}</button><div class="eyebrow">数据说明</div><h2>一张可以探索的铁路地图</h2><p>当前内置数据用于验证交互，车次编号 DEMO 开头，停站组合为人工演示，不能用于出行。站点坐标为近似位置，线路使用站间直线，未包含真实轨道几何。</p><p>可达指同一趟列车从所选站出发的后续停站，不计算换乘。枢纽站在所有缩放级别显示，区域站与小站随放大逐级显示。选站后需取消才能更换。</p><p>qETRC 是运行图编辑工具，支持列车和时刻表数据管理。全国实时数据仍需获得可用、允许使用的数据源。此版本支持导入统一 JSON 时刻表，暂未实现 qETRC 原生文件转换。</p><a href="https://github.com/CDK6182CHR/qETRC" target="_blank" rel="noreferrer">查看 qETRC 项目 ↗</a><button id="download" class="primary">下载时刻表格式示例 ${icon('download')}</button><p class="fine">导入在浏览器本地完成，刷新后恢复演示数据。本地地理底图来自 Natural Earth（公共领域），仅供地理概览。</p></dialog><input id="file" type="file" accept=".json,application/json" hidden>`;
const map=L.map('map',{zoomControl:false,minZoom:3,maxZoom:13,preferCanvas:true}).setView([34.5,106.5],4);
map.attributionControl.addAttribution('<a href="https://www.naturalearthdata.com/about/terms-of-use/">Natural Earth</a> · 地理概览');
fetch('/world.json').then(response=>{if(!response.ok)throw new Error('底图加载失败');return response.json();}).then(geo=>{
  L.geoJSON(geo,{style:{color:'#d1dacb',weight:1,fillColor:'#f7f8f1',fillOpacity:1},interactive:false}).addTo(map).bringToBack();
}).catch(()=>toast('地理底图加载失败，请刷新页面。'));
const lines=L.layerGroup().addTo(map), markers=L.layerGroup().addTo(map), activeLines=L.layerGroup().addTo(map);
const refreshIcons=()=>createIcons({icons,attrs:{'stroke-width':1.7}});
let toastTimer;
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3400);}
function routeCoordinates(path){return path.map(id=>stationById.get(id)).map(s=>[s.lat,s.lng]);}
function drawMap(){
  lines.clearLayers();markers.clearLayers();activeLines.clearLayers();
  const edges=new Set();
  data.trains.forEach(t=>t.stops.slice(1).forEach((id,i)=>{
    const edge=[t.stops[i],id].sort().join('|');if(edges.has(edge))return;edges.add(edge);
    L.polyline(routeCoordinates([t.stops[i],id]),{color:'#8eaaa3',weight:1.5,opacity:selected?.22:.48,interactive:false}).addTo(lines);
  }));
  if(result){
    const paths=destination?result.destinations.get(destination):result.services;
    paths?.forEach(t=>L.polyline(routeCoordinates(t.path),{color:destination?'#d97235':'#dc8953',weight:destination?4:2.8,opacity:.85,interactive:false}).addTo(activeLines));
  }
  const zoom=map.getZoom();
  data.stations.forEach(s=>{
    const isSelected=s.id===selected,isDestination=s.id===destination,isReachable=result?.destinations.has(s.id);
    if(!isSelected&&!isDestination&&s.level>0&&zoom<(s.level===1?5:7))return;
    const marker=L.circleMarker([s.lat,s.lng],{radius:isSelected?8:s.level===0?4.8:3.4,color:isSelected?'#fff':isReachable?'#cb723b':'#567e73',weight:isSelected?3:1.5,fillColor:isSelected?'#d87537':isReachable?'#f6c3a1':'#f9faf6',fillOpacity:1,opacity:selected&&!isSelected&&!isReachable?.38:1}).addTo(markers);
    marker.bindTooltip(escape(s.name),{permanent:isSelected||isDestination||s.level===0||zoom>=7,direction:'right',className:`station-label ${isSelected?'selected-label':''} ${selected&&!isSelected&&!isReachable?'muted-label':''}`,offset:[7,0]});
    marker.on('click',()=>choose(s.id));
  });
  document.querySelector('#station-count').textContent=data.stations.length;
}
function choose(id){
  if(selected){toast('请先取消当前站点，再选择其他出发站。');return;}
  selected=id;result=reachable(data,id);destination=null;query='';destinationQuery='';document.querySelector('#search').value='';document.querySelector('#search-results').innerHTML='';
  renderPanel();drawMap();
}
function clear(){selected=null;result=null;destination=null;destinationQuery='';renderPanel();drawMap();}
function renderPanel(){
  const panel=document.querySelector('#panel');
  const input=document.querySelector('#search');input.disabled=!!selected;input.placeholder=selected?'取消当前选择后，可搜索其他站点':'搜索车站，如 珠海、广州南';
  const banner=document.querySelector('#selection-banner');banner.hidden=!selected;
  if(!selected){panel.innerHTML=`<div class="section-heading"><h2>从这里开始</h2><span>热门出发站</span></div><div class="popular">${['珠海','广州南','北京西','上海虹桥','成都东','武汉'].filter(id=>stationById.has(id)).map(id=>`<button data-station="${escape(id)}">${icon('map-pin')} ${escape(stationById.get(id).name)} ${icon('arrow-up-right')}</button>`).join('')}</div><div class="how-card"><span class="how-icon">${icon('route')}</span><h3>你的下一站，会在哪里？</h3><p>点击地图上的站点，点亮从这里出发的铁路网络。</p><div><span><b class="tiny-dot"></b>枢纽站始终可选</span><span>${icon('zoom-in')} 放大探索小站</span></div></div><div class="data-note"><span class="tag">交互原型</span><p>已收录 ${data.stations.length} 个示例站点与 ${data.trains.length} 趟演示车次。可导入完整时刻表探索更多站点。</p></div>`;}
  else{
    const s=stationById.get(selected);
    banner.innerHTML=`<span><b></b>正在探索 <strong>${escape(s.name)}</strong> 的可达网络</span><button id="banner-clear">取消选择 ${icon('x')}</button>`;
    panel.innerHTML=`<div class="selected-card"><div class="selected-top"><span>${icon('map-pin')} 当前出发站</span><button id="clear">取消选择 ${icon('x')}</button></div><h2>${escape(s.name)}<small>${escape(s.province||'')} · ${s.level===0?'铁路枢纽':'铁路车站'}</small></h2><div class="stats"><div><strong>${result.destinations.size}</strong><span>可达站点</span></div><div><strong>${result.services.length}</strong><span>途经车次</span></div></div><div class="lock-note">${icon('lock-keyhole')} 选择已锁定，取消后可切换出发站</div></div><div class="section-heading"><h2>可达站点</h2><span>同车直达 · 不含换乘</span></div><div class="destination-search">${icon('search')}<input id="destination-search" aria-label="筛选可达站点" placeholder="查找目的地" value="${escape(destinationQuery)}"></div><div id="destinations"></div>`;
    document.querySelector('#clear').onclick=clear;document.querySelector('#banner-clear').onclick=clear;
    document.querySelector('#destination-search').oninput=e=>{destinationQuery=e.target.value;renderDestinations();};
    renderDestinations();
  }
  panel.querySelectorAll('[data-station]').forEach(b=>b.onclick=()=>choose(b.dataset.station));refreshIcons();
}
function renderDestinations(){
  const entries=[...result.destinations].filter(([id])=>stationById.get(id).name.includes(destinationQuery.trim()));
  document.querySelector('#destinations').innerHTML=entries.length?entries.map(([id,trains])=>`<button class="destination ${destination===id?'active':''}" data-destination="${escape(id)}"><span class="destination-dot"></span><span><strong>${escape(stationById.get(id).name)}</strong><small>${escape(stationById.get(id).province||'')} · ${trains.length} 趟${data===demoData?'演示':''}车次</small></span>${icon(destination===id?'chevron-down':'arrow-up-right')}</button>${destination===id?`<div class="journey"><span>途经站点 · ${escape(trains[0].id)}</span><p>${trains[0].path.map(stop=>escape(stationById.get(stop).name)).join(' → ')}</p><small>站间连线为示意，实际经由以运行图为准</small></div>`:''}`).join(''):`<div class="empty">${result.destinations.size?'没有匹配的目的地':'当前数据中，没有从此站继续运行的列车。'}</div>`;
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
    const imported=validateData(JSON.parse(await file.text()));
    data=imported;stationById=new Map(data.stations.map(s=>[s.id,s]));clear();
    document.querySelector('#data-mode').textContent='已导入数据';document.querySelector('.sidebar-bottom span').textContent='用户导入时刻表 · 有效日期与准确性请核对数据来源';toast(`已导入 ${data.stations.length} 个站点、${data.trains.length} 趟车次`);
  }catch(error){toast(`导入失败：${error.message}`);}finally{e.target.value='';}
};
document.querySelector('#download').onclick=()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(demoData,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='railway-example.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
map.on('zoomend',drawMap);renderPanel();drawMap();refreshIcons();
