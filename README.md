# 行轨 · ChinaRailMap

中国铁路可达地图交互原型。使用 Vite、原生 JavaScript 和 Leaflet，包含本地地理底图。

## 开发

需要 Node.js 22 或更高版本。

```sh
npm ci --cache /workspace/.npm
npm run dev -- --port 5173
```

```sh
npm test
npm run build
```

## 已实现

- 枢纽站始终显示，区域站在缩放级别 5 起显示，小站在级别 7 起显示。搜索可选择任意已收录站点。
- 单出发站锁定，取消后才可更换。
- 根据车次停站顺序计算同车直达，展示后续可达站点与站间示意连线。
- 目的地筛选、单条行程高亮、全国视图与移动端布局。
- 本地 JSON 导入，验证经纬度、ID、停站引用。可在“关于数据”下载完整示例。

## 数据范围

内置 67 个近似坐标的示例站点、40 趟人工构造的演示车次。DEMO 车次及其停站组合不能用于出行。尚未收录全国站点、全国真实时刻表、日期有效性或真实轨道几何。可达计算不包含换乘，不推导实际乘车时间。

qETRC 的 README 与列车序列化代码已做调研。它是运行图编辑程序，列车文件包含 checi 和 timetable，不能直接作为全国实时查询服务。原生 qETRC 导入、全国数据采集与定期刷新尚未实现。

导入格式如下，stops 按列车运行方向排列，level 的 0、1、2 分别表示枢纽、区域站和小站。导入仅保存在当前页面内存，刷新恢复演示数据。

```json
{
  "metadata": { "name": "数据集名称", "updatedAt": "2026-11-26" },
  "stations": [
    { "id": "zhuhai", "name": "珠海", "lat": 22.239, "lng": 113.519, "level": 1, "province": "广东" },
    { "id": "guangzhounan", "name": "广州南", "lat": 22.989, "lng": 113.269, "level": 0, "province": "广东" }
  ],
  "trains": [ { "id": "EXAMPLE", "line": "示例线路", "stops": ["zhuhai", "guangzhounan"] } ]
}
```

## 地理底图

`public/world.json` 来自 Natural Earth 1:110m 地理数据（公共领域），用于离线地理概览。其边界概化精度有限，正式发布需要核对地图规范。

来源 https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson

使用条款 https://www.naturalearthdata.com/about/terms-of-use/
