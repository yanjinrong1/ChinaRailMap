# 行轨 · ChinaRailMap

中国铁路同车可达地图，Vite / Leaflet / MapLibre。内置真实时刻表快照，支持 qETRC 文件导入，以及浅色、深色、OSM 标准底图。

## 数据来源与范围

默认读取 `public/timetable/data.json`，来源 [wensimehrp/chinese-railway-gtfs](https://github.com/wensimehrp/chinese-railway-gtfs)，最新接入发布版本 `gtfs-20261124-112841`。发布于 2026-11-24，3250 个站点、11569 趟车次、463 组开行日记录；记录范围 2026-11-09 至 2027-02-13。运行数据由 RailGo-Parser 获取，坐标采用 OSM / WGS84。数据以 CC BY 4.0 发布，作者 wensimehrp (Jeremy Gao)。原 GTFS SHA-256、版本、来源、日期范围保存在 metadata。

这是一份第三方真实时刻表快照，不是 12306 实时余票接口；未查询临时停运或实时变更，不能把记录范围理解为每天都完整覆盖全国列车。按所选**乘车站当地日期**和服务日历计算，同一趟列车跨午夜后会换算始发日期。时刻详情显示到达、发车及相对乘车日的跨日信息。不推导换乘或反向列车。

`public/timetable/routes.json` 为 v2 逐车次经由库。每趟车保留自身 GTFS shape，并按 `train_id + operator + category + 有向停站序列` 校验；相同站点对可以有多条不同几何，不再复用第一趟车的路径。端点匹配容差从 5km 收紧到 750m，并拒绝同点吸附或站序回退。10057 个几何变体对应 63571 个有依据的车次区间；其余 33235 个车次区间缺少可靠几何，明确不绘制。来源走向仍不等同于逐段核验的官方经由。许可证见 `public/timetable/LICENSE.txt`。

车种区分 G/D/C 与普速 Z/K/T/V/N/Y/L 等；D/C 不被一律视为专用高速线。普速车可以保留自身来源路径中的兰新等混跑例外，不用字头全局禁用高速线。[12306 官方公告](https://www.12306.cn/mormhweb/zxdt_news/202306/t20230629_39558.html)提供了部分普速列车改经兰新客专的依据，但这里不将该历史公告当作所有现行班次的通行许可。

上游统一 agency_id=CR，实际包含广东城际。`config/rail-operators.json` 以广东城际特色停站、地域范围与 C/S 字头组合识别 325 趟广东城际车次，独立标为 GDIC，不能和国铁经由混用；不能仅凭 C 字头判断运营商。配置记录广州地铁／政府公告的来源，未识别项目仍标记“源数据标注”，不冒充已完成全部运营方核验。qETRC 导入车次没有匹配来源身份时不借用这些路径。

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

更新脚本解析 GitHub 最新 Release，下载 `output_gtfs.zip`，保留服务日历、站点和到发时间，将上游几何转换为紧凑的站间路径，再检查车次与运营方、车种的经由一致性；不再执行无约束 OSM 最短路补齐。需要 Python 3 和 Node.js。更新时间取自源数据，不冒充当天数据。更新会更改跟踪文件，需要正常同步源码并重新发布到 Sites；**没有设置后台自动更新任务**。

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
- 默认只加载约 5.4MB 时刻表，14MB 线路几何首次选站时才下载。拖动地图只更新可见站点，不遍历全国线路；复用可见 Canvas 圆点，路线只在选站、日期、线宽或主题变化时重画。已选可达站不受低 zoom 隐藏规则影响，保证能选择低频目的地。
- OpenFreeMap 样式使用完整 URL：`https://tiles.openfreemap.org/styles/positron/style.json` 与 `https://tiles.openfreemap.org/styles/dark/style.json`。MapLibre 4.7.1 按需加载，CSP Worker 作为同源文件输出，使用单 Worker 和较小瓦片缓存。Leaflet bridge 的许可见 `public/MAPLIBRE-LEAFLET-LICENSE.txt`。
- 矢量样式、Worker、WebGL 或网络失败时，10 秒内回落到已可用的 OSM 栅格瓦片，深浅备用样式只滤镜处理底图所在 Pane，不影响车站与路线颜色。面板明确显示实际使用的底图和重试入口。备用样式不是 OpenFreeMap 本身。
- 地图右下角工具栏包含图层、全国视图和缩放；图层面板支持细／粗线宽、Escape 关闭、点击外部关闭与焦点返回。偏好保存在浏览器。

取消始发、取消目的地、取消全部选择时保持当前缩放和中心，即便目的地提升为新始发站也不自动缩放。只有主动选择新站点或点击“全国视图”才调整视野。

## 车次聚焦、重线与缺线诊断

路线只画一笔，不偏移绘制往返方向；同站点对的反向或当前缩放下近乎重合的来源几何，在显示层合并（1.25px 容差），真实分歧经由继续保留。该处理不修改逐车次源几何，也不改变可达计算。

展开左侧车次卡片时，地图聚焦该车的当前乘车区间路径，并强制显示其沿途停站（不受频次层级隐藏）；同时只展开一张卡片。收起后恢复两站间所有车次的路线。停站沿用已选日期的时刻表，不会补造回程车次。

已核对当前快照：广州白云始发的 Z138（乌鲁木齐，29 个停站）与 Z264（拉萨，15 个停站）均有时刻表，但上游 GTFS 的 `shape_id` 为空，来源中没有对应线路几何。v2 停用无约束最短路后，这些线路不再被猜测补齐。车次卡片和地图会解释缺失原因，展开后仍显示有依据的全部区间停站。当前未恢复这两趟车的真实轨道几何。
