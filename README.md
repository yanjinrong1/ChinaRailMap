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

## 地图性能、选站与底图

- 默认无路线、无常驻站名；站名只在悬停时显示。站点按所选日期的车次数排序，蓝色大圆点代表高频站、青色代表中频站、灰色小圆点代表低频站。最高频 30 站从 zoom 3 开始显示，随后在 zoom 5/6/7/8 逐级增加；默认模式按视野裁剪和 26px 网格避让。低频站也可通过搜索选择。
- 首次选站显示该始发站的全部同车可达站及铁路路径；再次选站显示两站之间的路线，左侧展开车次列表。已选站点在地图上显示可取消的名称盒。取消目的地保留始发站；取消始发站会将现有目的地提升为新始发站，重新计算该方向的可达车次。
- 默认只加载 4.5MB 时刻表，14MB 线路几何首次选站时才下载。拖动地图只更新可见站点，不遍历全国线路；复用可见 Canvas 圆点，路线只在选站、日期、线宽或主题变化时重画。已选可达站不受低 zoom 隐藏规则影响，保证能选择低频目的地。
- OpenFreeMap 样式使用完整 URL：`https://tiles.openfreemap.org/styles/positron/style.json` 与 `https://tiles.openfreemap.org/styles/dark/style.json`。MapLibre 4.7.1 按需加载，CSP Worker 作为同源文件输出，使用单 Worker 和较小瓦片缓存。Leaflet bridge 的许可见 `public/MAPLIBRE-LEAFLET-LICENSE.txt`。
- 矢量样式、Worker、WebGL 或网络失败时，10 秒内回落到已可用的 OSM 栅格瓦片，深浅备用样式只滤镜处理底图所在 Pane，不影响车站与路线颜色。面板明确显示实际使用的底图和重试入口。备用样式不是 OpenFreeMap 本身。
- 地图右下角工具栏包含图层、全国视图和缩放；图层面板支持细／粗线宽、Escape 关闭、点击外部关闭与焦点返回。偏好保存在浏览器。
