# 行轨 · ChinaRailMap

中国铁路同车可达地图，Vite / Leaflet / MapLibre。内置真实时刻表快照，支持 qETRC 文件导入，以及浅色、深色、OSM 标准底图。

## 数据来源与范围

默认读取 `public/timetable/data.json`，来源 [wensimehrp/chinese-railway-gtfs](https://github.com/wensimehrp/chinese-railway-gtfs)，最新接入发布版本 `gtfs-20261124-112841`。发布于 2026-11-24，3250 个站点、11569 趟车次、463 组开行日记录；记录范围 2026-11-09 至 2027-02-13。运行数据由 RailGo-Parser 获取，坐标采用 OSM / WGS84。数据以 CC BY 4.0 发布，作者 wensimehrp (Jeremy Gao)。原 GTFS SHA-256、版本、来源、日期范围保存在 metadata。

这是一份第三方真实时刻表快照，不是 12306 实时余票接口；未查询临时停运或实时变更，不能把记录范围理解为每天都完整覆盖全国列车。按所选**乘车站当地日期**和服务日历计算，同一趟列车跨午夜后会换算始发日期。时刻详情显示到达、发车及相对乘车日的跨日信息。不推导换乘或反向列车。

`public/timetable/routes.json` 优先采用上游 GTFS 线路走向，按站点裁切、简化；缺失区间由 `@railroute-ts/china` OSM 铁路网络计算最短路径，端点吸附限制 5km。210 个无法匹配的区间明确缺失，不画直线替代。几何并非经官方核验的实际车次经由。来源在每个区间的 `source` 字段中，许可证见 `public/timetable/LICENSE.txt`。

## 开发与验证

```sh
npm ci --cache /workspace/.npm
npm run dev
npm test
npm run build
```

## 更新真实时刻表

```sh
npm run data:update
npm test
npm run build
```

更新脚本解析 GitHub 最新 Release，下载 `output_gtfs.zip`，保留服务日历、站点和到发时间，将上游几何转换为紧凑的站间路径，再为缺失区间补充 OSM 寻路。需要 Python 3 和 Node.js。更新时间取自源数据，不冒充当天数据。更新会更改跟踪文件，需要正常同步源码并重新发布到 Sites；**没有设置后台自动更新任务**。

也可使用已下载的 GTFS，锁定版本以复现：

```sh
python scripts/update-timetable.py /absolute/path/output_gtfs.zip gtfs-20261124-112841
node scripts/fill-timetable-routes.mjs
```

## 导入 qETRC

网站“导入时刻表”接受 `.pyetgr`、`.pyetdb` 和 JSON。读取 `trains[].checi` 与 `trains[].timetable` 中的 `zhanming`、`ddsj`、`cfsj`，按名称匹配内置站点坐标，并处理午夜时刻回绕。未知站点会列出错误并拒绝整次导入，避免偷偷缩短停站序列。qETRC 不含可验证开行日历时，页面明确标记“开行日期未核验”，不冒充当前真实数据。导入仅保存在页面内存，可恢复内置快照。

统一 JSON 支持 `stations`、`trains` 数组；站点含 `id,name,lat,lng,level`，车次含 `id,stops`，可选 `code,times`。示例下载仍为明确标注的 DEMO 格式示例，默认地图不再使用它。

旧演示路径 `public/rail-routes.json` 与 Natural Earth `public/world.json` 仅作为原型资料保留；默认不加载。

## 地图工具与底图渲染

OpenFreeMap Dark / Positron 与日本直通地图使用相同的 MapLibre GL 4.7.1 和 Leaflet bridge，版本固定。bridge 仅将原 UMD 包装改为 ESM；许可在 `public/MAPLIBRE-LEAFLET-LICENSE.txt`。不再在初始化失败时静默改成 OSM，面板中显示加载状态、网络错误、WebGL 不可用提示与重试入口。

地图右下角统一工具栏包含图层、全国视图、站名开关和缩放。图层面板提供三种底图和全局细／粗线宽，支持 Escape 关闭、点击外部关闭与键盘焦点返回。底图、线宽、站名显示偏好保存在本机浏览器。
