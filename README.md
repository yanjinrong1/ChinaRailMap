# 中国铁路可达地图 · China Railway Map

中国铁路同车可达地图，Vite / Leaflet / MapLibre。内置真实时刻表快照，支持 qETRC 文件导入，以及浅色、深色、OSM 标准底图。

## 数据来源与范围

默认读取 `public/timetable/data.json`，来源 [wensimehrp/chinese-railway-gtfs](https://github.com/wensimehrp/chinese-railway-gtfs)，最新接入发布版本 `gtfs-20261124-112841`。发布于 2026-11-24，3250 个站点、11569 趟车次、463 组开行日记录；记录范围 2026-11-09 至 2027-02-13。运行数据由 RailGo-Parser 获取，坐标采用 OSM / WGS84。数据以 CC BY 4.0 发布，作者 wensimehrp (Jeremy Gao)。原 GTFS SHA-256、版本、来源、日期范围保存在 metadata。

这是一份第三方真实时刻表快照，不是 12306 实时余票接口；未查询临时停运或实时变更，不能把记录范围理解为每天都完整覆盖全国列车。按所选**乘车站当地日期**和服务日历计算，同一趟列车跨午夜后会换算始发日期。时刻详情显示到达、发车及相对乘车日的跨日信息。不推导换乘或反向列车。

`public/timetable/routes.json` 为 v2 逐车次经由库。每趟车保留自身 GTFS shape，并按 `train_id + operator + category + 有向停站序列` 校验；相同站点对可以有多条不同几何，不再复用第一趟车的路径。端点匹配容差从 5km 收紧到 750m，并拒绝同点吸附或站序回退。上游形状当前覆盖 63570 个车次区间；其余区间自动在保留属性的 OSM 铁路图中逐站寻路。原始形状优先，不用推算结果覆盖它。每个推算区间记录 OSM way ID、线路名称、吸附距离、线路类别、运营方与数据日期，并明确标记为“OSM 推算经由”。本次全量扫描 11569 趟车、96806 个停站区间，补齐 33236 个，合计覆盖 96806 个（100%），剩余 0 个未通过约束检查。全量覆盖数字与所有未解决区间见 `public/timetable/routing-audit.json`，不需要人工逐条发现缺线。来源走向仍不等同于逐段核验的官方经由。许可证见 `public/timetable/LICENSE.txt`。

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

- 默认无路线、无常驻站名；站名只在悬停时显示。站点按当前中国日期计算停靠车次数。全国高频站优先，另比较周边 250km 内的加权最高车次，并以 40% 全国规模、60% 局部重要性的得分补充区域代表站。每个缩放级别使用固定世界坐标 64px 覆盖网格补空白，普通候选最小间距 26px、区域补充 36px；逐级保留已显示车站，拖动时仅裁剪视野，不重选代表。蓝色为主要枢纽、青色为区域枢纽、灰色为一般站，圆点半径始终由实际车次数量决定。无当天开行记录的站不自动补入；放大地图可探索小站。
- 首次选站显示该始发站的全部同车可达站及铁路路径；再次选站显示两站之间的路线，左侧展开车次列表。已选站点在地图上显示可取消的名称盒。取消目的地保留始发站；取消始发站会将现有目的地提升为新始发站，重新计算该方向的可达车次。
- 默认只加载约 5.4MB 时刻表，线路几何首次选站时才下载，部署时分为 16 个小文件且剥离详细审计标签，避免超大单文件。拖动地图只更新可见站点，不遍历全国线路；复用可见 Canvas 圆点，路线只在选站、日期、线宽或主题变化时重画。已选可达站不受低 zoom 隐藏规则影响，保证能选择低频目的地。
- OpenFreeMap 样式使用完整 URL：`https://tiles.openfreemap.org/styles/positron` 与 `https://tiles.openfreemap.org/styles/dark`。MapLibre 4.7.1 按需加载，CSP Worker 作为同源文件输出，使用单 Worker 和较小瓦片缓存。Leaflet bridge 的许可见 `public/MAPLIBRE-LEAFLET-LICENSE.txt`。
- 矢量样式、Worker、WebGL 或网络失败时，10 秒内回落到已可用的 OSM 栅格瓦片，深浅备用样式只滤镜处理底图所在 Pane，不影响车站与路线颜色。面板明确显示实际使用的底图和重试入口。备用样式不是 OpenFreeMap 本身。
- 地图右下角工具栏包含图层、全国视图和缩放；图层面板支持细／粗线宽、Escape 关闭、点击外部关闭与焦点返回。偏好保存在浏览器。

取消始发、取消目的地、取消全部选择时保持当前缩放和中心，即便目的地提升为新始发站也不自动缩放。只有主动选择新站点或点击“全国视图”才调整视野。

## 车次聚焦、重线与缺线诊断

路线只画一笔，不偏移绘制往返方向；同站点对的反向或当前缩放下近乎重合的来源几何，在显示层合并（1.25px 容差），真实分歧经由继续保留。该处理不修改逐车次源几何，也不改变可达计算。

展开左侧车次卡片时，地图聚焦该车的当前乘车区间路径，并强制显示其沿途停站（不受频次层级隐藏）；同时只展开一张卡片。收起后恢复两站间所有车次的路线。停站沿用已选日期的时刻表，不会补造回程车次。

已核对当前快照：广州白云始发的 Z138（乌鲁木齐，29 个停站）与 Z264（拉萨，15 个停站）均有时刻表，但上游 GTFS 的 `shape_id` 为空，来源中没有对应线路几何。推算使用时刻表停站约束，在京广、陇海、兰青及兰新客专／青藏等允许线路上逐段寻路。车次卡片和地图标明推算性质，展开后显示全部区间停站。目前已用有属性约束的 OSM 推算补齐 Z138 的 28/28、Z264 的 14/14 个区间；这不代表已获得官方实际经由。


## 自动审计和 OSM 补线

本次使用数据时间为 2026-11-24 的 Geofabrik 中国及老挝原始 OSM PBF，保留线路名、运营方、highspeed、maxspeed、gauge、usage、service 等标签，按真实共享 OSM 节点连接铁路拓扑；不连接地图上交叉但不同层的轨道，不跨断点造直线。普速不进入未经核实的高速线；石太、衡柳、秦沈、兰渝、怀衡、昌福、南龙、衢九按有出处的混跑走廊、名称和地理范围放行，规则见 `config/mixed-traffic-corridors.json`。太原局部共用低速接入轨道还要求该车停靠太原，具体股道仍属 OSM 推断，不代表官方运行图。兰新客专例外需要该车停站证据；广东城际与国铁隔离。24 个明显错位或同名误配站点按同名、局部唯一且接入铁路的 OSM 站点校正，原坐标、OSM 节点 ID 和数据日期见 `config/station-coordinate-overrides.json`。生成器仅在原坐标仍匹配审阅记录时应用修正，并清除旧坐标对应的失效形状。其余站点优先使用时刻表坐标，必要时仅尝试 3km 内同名 OSM 站点锚点并记录匹配。客运会让线允许带惩罚通行，编组场与专用支线排除。广州白云改造后旧货运标签的局部修正、广茂客车北绕广珠线的限定例外及出处见 `config/osm-routing-overrides.json`。

```sh
python -m pip install -r scripts/railway/requirements.txt
python scripts/extract-osm-rail-index.py /absolute/path/china-latest.osm.pbf --output /absolute/path/index
python scripts/build-osm-inferred-routes.py --index /absolute/path/index --cache .cache/osm-graph.json.gz
node scripts/fill-timetable-routes.mjs
npm run test:routing
npm test
npm run build
```

缓存与输入索引配套使用，数据或路由策略变更后须删除旧缓存。生成器扫描所有车次，保留来源几何并重算推算区间，输出覆盖统计与完整失败清单。无法吸附、网络不连通、明显绕行等区间仍不绘制，避免用错误线路掩盖缺失。45m 显示简化只用于输出折线，不改变寻路拓扑与审计长度。OSM 衍生数据按 ODbL 1.0 署名发布，完整衍生数据库保存在源码 routes.json 与 geometry/*.json 中；许可证见 timetable/LICENSE.txt。


广州白云—肇庆的普速推算按京广线—江大联络线—广珠线北段—沙狮联络线—广茂线连接。OSM 广珠线北段仍带 freight 标签，2023 年广茂客车改线后不宜以此直接禁行。修正仅适用于国铁普速、时刻表同时含广州白云及肇庆／三水，并限制广珠线北段的名称与地理范围；该低代价例外不扩展到广珠城际、广珠线南段或广东城际；其他带货运标签的普通铁路按统一软惩罚处理。推算结果记录 `guangmaoPassengerDiversion` 例外与 OSM way ID。该修正不代表获得了官方逐车次轨迹。


## 紧凑界面

移除顶部横幅与宣传文案，左栏使用按参考图重绘的国铁 SVG 标志和中英文标题。移除日期、始发站搜索与目的地搜索控件；默认仍按中国当地当天日期和服务日历筛选，可在列表标题查看当前日期，通过地图与快捷车站选择站点。左栏缩小行距、边距、端点卡片和停站列表字号，数据库更新时间固定在左下角。地图工具栏的信息按钮打开数据来源弹窗，保留许可、导入、恢复快照与示例下载入口。


区域显示预处理在数据加载／恢复时执行，通过 250km 地心坐标网格限制邻站比较，再预计算 zoom 3–13 的稳定集合；不在每次拖动时重复比较全国车站。附近车次采用随距离衰减的最高值，避免把东部站点密集程度误当作当地单站重要性；低缩放补充站仍有最少 8 趟的门槛，zoom 5 放宽到 3 趟。同城近邻由距离避让控制。当前 2026-11-27 快照测试中，乌鲁木齐、喀什在 zoom 3，拉萨、哈密、和田在 zoom 4，西宁在 zoom 5；这些级别由数据推导，没有城市名单加权。已选择的站、同车可达站和聚焦车次的沿途站继续按原有规则显示。


OSM 的 `railway:traffic_mode=freight` 现在作为软约束：仍满足车种、运营方、轨距、线路用途等规则的轨道，可以通行，但寻路代价乘以 1.5，使相近距离下优先使用客运／混合线路。有公开客运经由依据的白云接入和广茂北绕区间保留普通权重。编组场、工业／军用／试验用途、支线专用轨、不同轨距及不允许的高速线仍按原规则排除。没有通过 OSM 拓扑检查的断点不会用直线连接。每条推算记录货运标记轨道的 `freightTaggedWayIds`、未获已知例外减免的 `softFreightWayIds` 和使用的权重。原始 GTFS 来源几何不被改写，展示仍为 OSM 推算。

几何 ID 同时包含运营方、车种、站点对与坐标，避免不同站点 ID 在同坐标下误共享经由；全量验证检查每条引用的站点对。`--repair-identities` 可重算身份不一致的车次，`--target CODE` 可重算指定车次，两者保留其他车次的审计结果，并要求相同的 OSM 日期和货运标签策略。

按站点对汇总缺口：`python scripts/summarize-route-gaps.py`，生成 `public/timetable/remaining-route-gaps.csv`，含全部涉及车次及失败原因。


本轮完整调查覆盖前一轮剩余的 101 对站点、267 个车次区间，逐对结论见 [调查报告](reports/route-gap-investigation.md)。`scripts/diagnose-route-gaps.py` 的放宽规则仅产生诊断候选，不会修改生产几何。正式寻路使用逐条审核的走廊、停站条件和轨道 ID；`config/passenger-track-overrides.json` 仅放行鸡西—柳毛间约 54m 的特定站场连接轨道，其他编组场轨道仍然禁止。

中老境外缺口通过补充同日期的 [Geofabrik 老挝数据](https://download.geofabrik.de/asia/laos.html) 解决；保留独立下载 URL、SHA-256 和合并来源。使用 `scripts/extract-osm-rail-index.py` 分别提取两个国家的索引，使用 `scripts/extract-osm-rail-ferries.py` 从中国 PBF 提取已审核的铁路轮渡，然后用 `scripts/merge-rail-indexes.py --input 中国索引 --input 老挝索引 --input 轮渡索引 --output 合并索引` 合并。调整保留的轨道集合后必须使用新的图缓存或删除旧缓存。

琼州海峡使用真实 OSM `railway=ferry` way 25172513；五段登船接入轨道长约 1.10km，只允许有两岸停站证据的国铁普速列车使用。轨道仅按共享 OSM 节点连接，不按位置靠近就造连接。经由记录保留轮渡及登船轨道 ID；没有将汽车渡轮当作铁路使用。几何全覆盖并不等于经由已获官方逐车次认证，所有补充经由仍明确标记为 OSM 推算。


## Cloudflare Pages

部署名称：`china-interactive-rail-map`，期望地址 `https://china-interactive-rail-map.pages.dev`。此名称必须由 Cloudflare 在创建时确认可用；配置文件不代表已经部署。

推荐在 Cloudflare Pages 连接本 GitHub 仓库，生产分支 `main`，构建命令 `npm run build`，产物目录 `dist`，根目录保持仓库根目录。这样后续推送会自动构建。Pages 项目名填写 `china-interactive-rail-map`。

也可在有 Cloudflare 授权的终端执行：

```sh
npx --yes wrangler@4 login
npx --yes wrangler@4 pages project create china-interactive-rail-map --production-branch=main
npm run deploy:pages
```

已有同名 Pages 项目时无需再次创建。CLI 上传是手动发布，不会自动建立 GitHub 集成。不要把 API token 写进配置或提交仓库。部署结果以 Cloudflare 返回的成功状态和实际域名为准；大陆地区及外部地图服务的可用性仍需实测。


## 中英文界面

标题为 China Interactive Rail Map。标题右侧 EN / CN 圆点开关可即时切换，手动选择保存在本地浏览器。首次访问优先通过同源 `/api/region` 的 Cloudflare `request.cf.country` 判断地区；CN、HK、MO、TW 默认中文，其余已识别地区默认英文。静态 Sites 无 Pages Functions 时，改用 Cloudflare trace 的地区代码；网络或地区判断失败时回退到浏览器语言。不会读取设备定位，地区接口只返回国家／地区代码，不返回或存储 IP。

语言切换不改变数据、车次 ID、选择状态或地图视角。英文站名使用常见英文名或拼音，线路几何仍使用原始站点 ID。Cloudflare Pages 的地区接口位于 `functions/api/region.js`；静态资源仍由 CDN 提供。仅推送 `a1` 时，若 Pages 生产分支仍是 `main`，它只会产生预览构建，不会覆盖生产站。


## 重叠站点的视觉区分

地图按真实坐标识别 35m 内的独立站点 ID；放大至 zoom 9 及以上时，以稳定的屏幕像素偏移分开展示，并用细虚线指向真实位置。两站图标中心间距为 32px，多站环形排列。没有始发站筛选时，若组中一站已经显示，会同时显示该组有开行车次的其他站点；选定始发站后仍严格保留同车可达筛选。

悬停、选中框和目的地列表按时刻表运营方注明国铁／城际；运营方仍相同时附站点代码，避免猜测高铁场或普速场。此处理不修改数据坐标、站点 ID、车次或铁路线路几何，中文和英文均可区分。


## 线路颜色

按车次前缀分组显示：G／D 为红色，C／S 为深蓝色，其余为深绿色；图例及车次编号使用对应颜色，深色底图适当提高亮度。同一站点对的重叠几何会保留所有车种颜色，以交替色段展示共线，不新增平行轨迹。各类实际走向不同的线路仍单独保留。

当前快照核对：G 4355、D 2463；C 2503、S 894；Z 157、N 110、V 1075、Y 12。分组共 6818／3397／1354 趟，详见 `reports/train-color-audit.json`。D 属动车，不代表每段都走高速铁路；此处仅调整展示颜色，原来的普速／动车／高速动车经由规则和运营方隔离保持不变。12306 新车次公告确认 Z／N／V 为普速、Y 为普速旅游，动车组车次暂不变。
