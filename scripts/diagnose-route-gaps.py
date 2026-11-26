#!/usr/bin/env python3
"""Diagnose every unresolved pair. Relaxed routes are hypotheses, never shipped geometry."""
import argparse,collections,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'railway'))
import router
from router import RailGraph,profile_for,read_index,km
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--index',required=True);p.add_argument('--cache',required=True);p.add_argument('--output',required=True);args=p.parse_args()
data=json.loads((root/'public/timetable/data.json').read_text());audit=json.loads((root/'public/timetable/routing-audit.json').read_text());stations={s['id']:s for s in data['stations']};trains={t['id']:t for t in data['trains']};graph=RailGraph.from_index(args.index,args.cache)
original=router.edge_weight
# Only for finding which fast-tagged edges obstruct an otherwise eligible route.
def diagnostic_weight(tags,profile,position,length):
 value=original(tags,profile,position,length)
 if value is not None:return value
 name=tags.get('name','')
 if profile['operator']!='CR'or profile['category']!='conventional'or tags.get('railway')!='rail'or tags.get('usage')in ('industrial','military','test')or tags.get('service')in ('yard','spur')or '1435'not in str(tags.get('gauge','1435'))or '城际'in name or '市域'in name or router.GD_NAMES.search(name)or router.GD_OPERATORS.search(tags.get('operator','')):return None
 return 2*(1.5 if tags.get('railway:traffic_mode')=='freight'else 1)
router.edge_weight=diagnostic_weight
anchors=collections.defaultdict(list)
for identity,item in read_index(Path(args.index)/'stations.pkl')['features'].items():
 if item.get('station_node'):anchors[item.get('name','').split(' ')[0].removesuffix('站')].append((identity,item))
station_diagnostics={}
for id in {l[k]for l in audit['legs']for k in ('from','to')}:
 s=stations[id];point=[s['lat'],s['lng']];matches=sorted([(km(point,item['coords']),identity,item)for identity,item in anchors[s['name']]],key=lambda x:x[0])[:4]
 station_diagnostics[id]={'id':id,'name':s['name'],'coordinates':point,'sameNameOsmStations':[{'distanceKm':round(d,3),'nodeId':ident[1],'coordinates':list(item['coords'])}for d,ident,item in matches],'unrestrictedCrSnaps':len(graph.snaps(s,{'operator':'CR','category':'high-speed-emu'}))}
pairs={}
for leg in audit['legs']:
 key='|'.join(sorted((leg['from'],leg['to'])));row=pairs.setdefault(key,{'pair':key,'stations':[station_diagnostics[id]for id in key.split('|')],'trainLegs':0,'trains':set(),'reasons':collections.Counter(),'profiles':{}});row['trainLegs']+=1;row['trains'].add(leg['code']);row['reasons'][leg['reason']]+=1
 train=trains[leg['trainId']];profile=profile_for(train,stations);pk=json.dumps(profile,sort_keys=True)
 if pk in row['profiles']:continue
 route,error=graph.route(stations[leg['from']],stations[leg['to']],profile)
 hypothesis={'profile':profile,'error':error}
 if route:
  ways=set(route['wayIds']);groups={}
  for e in graph.edges:
   if e['way']not in ways:continue
   pos=e['coordinates'][len(e['coordinates'])//2]
   if original(e['tags'],profile,pos,e['length'])is not None:continue
   name=e['tags'].get('name','');group=groups.setdefault(name,{'line':name,'wayIds':set(),'positions':[],'speeds':set()});group['wayIds'].add(e['way']);group['positions'].append(pos);group['speeds'].add(str(e['tags'].get('maxspeed','')))
  blocked=[]
  for group in groups.values():
   points=group.pop('positions');group['bounds']=[min(p[0]for p in points),min(p[1]for p in points),max(p[0]for p in points),max(p[1]for p in points)];group['wayIds']=sorted(group['wayIds']);group['speeds']=sorted(group['speeds']);blocked.append(group)
  hypothesis.update(lengthKm=route['lengthKm'],lineNames=route['lineNames'],blocked=blocked)
 row['profiles'][pk]=hypothesis
 print(len(pairs),key,error,flush=True)
rows=[]
for row in pairs.values():row['trains']=sorted(row['trains']);row['reasons']=dict(row['reasons']);row['profiles']=list(row['profiles'].values());rows.append(row)
Path(args.output).write_text(json.dumps({'inputUnresolvedTrainLegs':audit['unresolvedTrainLegs'],'uniquePairs':len(rows),'dataDate':graph.metadata.get('data_date'),'warning':'Diagnostic relaxation only. Not validated actual train paths.','pairs':rows},ensure_ascii=False,indent=2)+'\n')
