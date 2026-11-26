#!/usr/bin/env python3
"""Audit every train leg and fill missing geometry using an attributed OSM graph."""
import argparse,collections,gzip,hashlib,json,os,sys,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'railway'))
from station_locations import apply_station_locations
from router import RailGraph,profile_for,read_index,km,simplify_coordinates,FREIGHT_TAG_PENALTY
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--index',required=True);p.add_argument('--cache',default=str(root/'.cache/osm-attributed-graph.json.gz'));p.add_argument('--target',action='append');p.add_argument('--repair-identities',action='store_true');args=p.parse_args()
data=json.loads((root/'public/timetable/data.json').read_text());geometry=json.loads((root/'public/timetable/routes.json').read_text());stations={s['id']:s for s in data['stations']}
for filename in geometry.get('segmentFiles',[]):geometry['segments'].update(json.loads((root/'public/timetable'/filename).read_text()))
corrections=apply_station_locations(stations)
data['metadata']['stationCoordinateCorrections']=corrections
geometry['stationCoordinates']={id:[s['lat'],s['lng']]for id,s in stations.items()}
# A corrected station invalidates source geometry attached to its old location.
for ref in geometry['trainRoutes'].values():
 for pair,gid in list(ref['legs'].items()):
  segment=geometry['segments'][gid]
  if segment['source']=='OSM inferred':continue
  ids=pair.split('|');points=segment['coordinates']
  if any(km(geometry['stationCoordinates'][id],point)>.75 for id,point in zip(ids,(points[0],points[-1]))):ref['legs'].pop(pair)
(root/'public/timetable/data.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
graph=RailGraph.from_index(args.index,args.cache);print('Routing starts',flush=True)
# Repair coordinate mismatches using exact-name OSM railway station anchors.
# No coordinate is guessed or silently replaced in the source timetable.
station_features=read_index(Path(args.index)/'stations.pkl')['features'];anchors=collections.defaultdict(list)
def normalize(name):return str(name).split(' ')[0].removesuffix('站')
for identity,item in station_features.items():
 if item.get('rail')and item.get('coords')and (item.get('station_node')or item.get('stop_position')):anchors[normalize(item.get('name',''))].append((identity,item))
del station_features
def alternatives(station):
 origin=(station['lat'],station['lng']);found=[]
 for identity,item in anchors.get(normalize(station['name']),[]):
  distance=km(origin,item['coords'])
  if .05<distance<=3:found.append((distance,identity,item))
 return [{**station,'id':station['id']+'@'+str(identity),'lat':item['coords'][0],'lng':item['coords'][1],'osmAnchor':str(identity)}for _,identity,item in sorted(found,key=lambda x:x[0])[:3]]
def inferred_route(a,b,profile):
 route,error=graph.route(a,b,profile)
 if route:return route,None
 choices=[]
 for aa in [a,*alternatives(a)]:
  for bb in [b,*alternatives(b)]:
   if aa is a and bb is b:continue
   candidate,reason=graph.route(aa,bb,profile)
   if candidate:
    candidate['stationMatches']=[{'id':a['id'],'osmAnchor':aa.get('osmAnchor'),'coordinate':[aa['lat'],aa['lng']]},{'id':b['id'],'osmAnchor':bb.get('osmAnchor'),'coordinate':[bb['lat'],bb['lng']]}];choices.append(candidate)
 if choices:return min(choices,key=lambda r:r['lengthKm']),None
 return None,error
cache={};report=[];fixed=0;failed=collections.Counter();start=time.monotonic()
trains=sorted(data['trains'],key=lambda t:(t['code']not in ('Z138','Z264'),t['code']))
partial=bool(args.target or args.repair_identities)
if args.target:trains=[t for t in trains if t['code']in args.target]
if args.repair_identities:trains=[t for t in trains if any(geometry['segments'][gid]['stations']!=key.split('|')for key,gid in geometry['trainRoutes'][t['id']]['legs'].items())]
if partial:
 previous=json.loads((root/'public/timetable/routing-audit.json').read_text());processed={t['id']for t in trains}
 if previous.get('dataDate')!=graph.metadata.get('data_date')or previous.get('freightTagPolicy')!='soft-penalty'or previous.get('freightTagPenalty')!=FREIGHT_TAG_PENALTY:raise SystemExit('Run a full audit before a partial rebuild with changed data/policy')
 report=[leg for leg in previous['legs']if leg['trainId']not in processed];failed.update(leg['reason']for leg in report)
 all_scanned=previous.get('allTrainsScanned',False)and previous.get('dataDate')==graph.metadata.get('data_date')
else:all_scanned=True
print('Trains to reroute:',len(trains),flush=True)
for count,train in enumerate(trains):
 ref=geometry['trainRoutes'][train['id']];profile=profile_for(train,stations)
 for a,b in zip(train['stops'],train['stops'][1:]):
  key='|'.join(sorted((a,b)))
  existing=geometry['segments'].get(ref['legs'].get(key))
  if existing and existing['source']!='OSM inferred'and existing['stations']==key.split('|'):continue
  identity=(json.dumps(profile,sort_keys=True),a,b)
  if identity not in cache:cache[identity]=inferred_route(stations[a],stations[b],profile)
  route,error=cache[identity]
  if route:
   cs=simplify_coordinates(route['coordinates']);cs=cs if a<b else list(reversed(cs));cs=[[round(y,5),round(x,5)]for y,x in cs]
   gid=hashlib.sha256(json.dumps([profile,sorted([a,b]),cs],separators=(',',':')).encode()).hexdigest()[:24]
   geometry['segments'][gid]={'status':'routed','coordinates':cs,'source':'OSM inferred','operator':train['operator'],'category':train['category'],'stations':sorted([a,b]),'inference':{k:v for k,v in route.items()if k!='coordinates'},'dataDate':graph.metadata.get('data_date')}
   ref['legs'][key]=gid;fixed+=1
  else:ref['legs'].pop(key,None);failed[error]+=1;report.append({'trainId':train['id'],'code':train['code'],'from':a,'to':b,'fromName':stations[a]['name'],'toName':stations[b]['name'],'reason':error})
 if train['code']in ('Z138','Z264')or count%250==0:print(count,train['code'],'covered',len(ref['legs']),'/',len(train['stops'])-1,'fixed',fixed,'seconds',round(time.monotonic()-start),flush=True)
fixed=sum(1 for ref in geometry['trainRoutes'].values()for gid in ref['legs'].values()if geometry['segments'][gid]['source']=='OSM inferred')
geometry['metadata']['osmInference']={'dataDate':graph.metadata.get('data_date'),'source':graph.metadata.get('source','OSM / Geofabrik'),'license':'ODbL-1.0','freightTagPolicy':'soft-penalty','freightTagPenalty':FREIGHT_TAG_PENALTY,'provenance':graph.metadata.get('provenance'),'fixedTrainLegs':fixed,'failures':dict(failed),'allTrainsScanned':all_scanned}
used={id for r in geometry['trainRoutes'].values()for id in r['legs'].values()};geometry['segments']={id:s for id,s in geometry['segments'].items()if id in used}
buckets=[{}for _ in range(16)]
for gid,segment in geometry['segments'].items():buckets[int(gid[0],16)][gid]=segment
geometry['segmentFiles']=[]
(root/'public/timetable/geometry').mkdir(exist_ok=True)
for i,bucket in enumerate(buckets):
 filename=f'geometry/{i:x}.json';destination=root/'public/timetable'/filename;temp=destination.with_suffix('.tmp');temp.write_text(json.dumps(bucket,ensure_ascii=False,separators=(',',':')));os.replace(temp,destination);geometry['segmentFiles'].append(filename)
geometry['segments']={}
target=root/'public/timetable/routes.json';tmp=target.with_suffix('.tmp');tmp.write_text(json.dumps(geometry,ensure_ascii=False,separators=(',',':')));os.replace(tmp,target)
total=sum(len(t['stops'])-1 for t in data['trains'])
(root/'public/timetable/routing-audit.json').write_text(json.dumps({'allTrainsScanned':all_scanned,'trainsScanned':len(data['trains']),'reroutedTrains':len(trains),'totalTrainLegs':total,'sourceTrainLegs':total-fixed-len(report),'inferredTrainLegs':fixed,'availableTrainLegs':total-len(report),'dataDate':graph.metadata.get('data_date'),'source':graph.metadata.get('source'),'provenance':graph.metadata.get('provenance'),'freightTagPolicy':'soft-penalty','freightTagPenalty':FREIGHT_TAG_PENALTY,'unresolvedTrainLegs':len(report),'reasons':dict(failed),'legs':report},ensure_ascii=False,separators=(',',':')))
print(json.dumps({'filled':fixed,'unresolved':len(report),'reasons':dict(failed)},ensure_ascii=False))
