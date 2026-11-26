#!/usr/bin/env python3
"""Reconcile the entire 101-pair investigation baseline with the rebuilt geometry."""
import collections,csv,json
from pathlib import Path
root=Path(__file__).resolve().parents[1];base=json.loads((root/'reports/gap-diagnostics-before.json').read_text());audit=json.loads((root/'public/timetable/routing-audit.json').read_text());data=json.loads((root/'public/timetable/data.json').read_text());g=json.loads((root/'public/timetable/routes.json').read_text());segments={}
for file in g['segmentFiles']:segments.update(json.loads((root/'public/timetable'/file).read_text()))
remaining=collections.Counter('|'.join(sorted((l['from'],l['to'])))for l in audit['legs']);trains={t['code']:t for t in data['trains']};corrections={r['id']:r for r in json.loads((root/'config/station-coordinate-overrides.json').read_text())};rules={r['id']:r for r in json.loads((root/'config/mixed-traffic-corridors.json').read_text())};rows=[]
for item in sorted(base['pairs'],key=lambda r:(-r['trainLegs'],r['pair'])):
 pair=item['pair'];ids=pair.split('|');names='—'.join(s['name']for s in item['stations']);matched=[];used=[];lines=set();urls=set();lengths=[];kinds=[]
 for code in item['trains']:
  t=trains[code];ref=g['trainRoutes'][t['id']];segment=segments.get(ref['legs'].get(pair))
  if not segment:continue
  info=segment.get('inference',{});used+=info.get('mixedTrafficCorridors',[]);lines.update(info.get('lineNames',[]))
  if info.get('lengthKm')is not None:lengths.append(info['lengthKm'])
  if info.get('railFerryWayIds'):kinds.append('OSM铁路轮渡及限定登船轨道');urls.add('https://www.openstreetmap.org/way/25172513')
  if info.get('passengerTrackOverrides'):kinds.append('限定客运咽喉轨道');urls.add('https://www.openstreetmap.org/way/1119200697')
  if t['operator']=='GDIC':kinds.append('广东城际运营方识别');urls.add('https://jtj.gz.gov.cn/gkmlpt/content/10/10947/post_10947514.html')
 for id in ids:
  if id in corrections and id in {'CPP','LIJ','QOL','TTE','AOP'}:matched.append(corrections[id]['name']);urls.add(corrections[id]['url'])
 if matched:kinds.append('站点坐标／同名站消歧：'+','.join(matched))
 if any(id in ids for id in ('VBM','VFM','VJM','VOM','YTM')):kinds.append('补充老挝OSM路网');urls.add('https://download.geofabrik.de/asia/laos.html')
 if used:
  kinds.append('有范围与停站条件的混跑／共用接入规则')
  for key in set(used):urls.update(rules[key].get('evidence',[]))
 note='；'.join(dict.fromkeys(kinds))or '复核真实共享OSM节点与允许线路'
 if remaining[pair]:note+='；仍缺路径，未用诊断中的无约束候选替代'
 rows.append(dict(pair=pair,stations=names,before=item['trainLegs'],remaining=remaining[pair],status='已补齐'if not remaining[pair]else '仍有缺口',diagnosis=note,trains=item['trains'],corridors=sorted(set(used)),lineNames=sorted(lines),lengthKmRange=[min(lengths),max(lengths)]if lengths else None,evidence=sorted(urls)))
summary={'baselinePairs':base['uniquePairs'],'baselineMissingTrainLegs':base['inputUnresolvedTrainLegs'],'remainingPairs':len(remaining),'remainingTrainLegs':audit['unresolvedTrainLegs'],'allTrainsScanned':audit['allTrainsScanned'],'note':'Coverage means geometry is available. OSM-inferred paths and track assignments are not official per-train routings. Diagnostic relaxed candidates were not automatically published.','pairs':rows}
(root/'public/timetable/gap-investigation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
with (root/'public/timetable/gap-investigation.csv').open('w',encoding='utf-8-sig',newline='')as f:
 w=csv.writer(f);w.writerow(['区间','原缺口车次区间数','现缺口数','状态','诊断与修复','车次','采用规则','当前经由线路','来源'])
 for r in rows:w.writerow([r['stations'],r['before'],r['remaining'],r['status'],r['diagnosis'],' '.join(r['trains']),' '.join(r['corridors']),' / '.join(r['lineNames']),' '.join(r['evidence'])])
md=['# 剩余缺口逐对调查','',f"本轮基线共 {base['uniquePairs']} 对站点、{base['inputUnresolvedTrainLegs']} 个车次区间。重算后剩余 {len(remaining)} 对站点、{audit['unresolvedTrainLegs']} 个车次区间。",'', '先全量定位被排除的轨道、同名站点及数据边界，再按有依据的走廊、站点和具体轨道 ID 修复。放宽全部高速标签得到的候选仅用于诊断，不直接进入生产地图。','', '几何覆盖率不代表官方经由准确率：新增线路为 OSM 推算，站内具体股道仍存在不确定性。逐条来源、线路名和规则 ID 见 [CSV](../public/timetable/gap-investigation.csv)，修复前具体被排除的 OSM way ID 和标签见 [诊断基线](gap-diagnostics-before.json)。','', '| 区间 | 原缺口数 | 现缺口数 | 诊断与修复 |','|---|---:|---:|---|']
md += [f"| {r['stations']} | {r['before']} | {r['remaining']} | {r['diagnosis']} |"for r in rows]
(root/'reports/route-gap-investigation.md').write_text('\n'.join(md)+'\n');print(json.dumps({k:v for k,v in summary.items()if k!='pairs'},ensure_ascii=False))
