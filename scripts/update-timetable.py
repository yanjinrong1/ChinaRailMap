#!/usr/bin/env python3
"""Fetch the latest published CC BY 4.0 GTFS and atomically build the website snapshot.
Usage: python scripts/update-timetable.py [local_gtfs.zip] [release_tag]
"""
import csv,io,json,zipfile,sys,urllib.request,re,tempfile,os,hashlib,math
from pathlib import Path
from collections import defaultdict,Counter
ROOT=Path(__file__).resolve().parents[1]
BASE='https://github.com/wensimehrp/chinese-railway-gtfs'
if len(sys.argv)>1:
 path=Path(sys.argv[1]);tag=sys.argv[2] if len(sys.argv)>2 else 'local-import'
else:
 response=urllib.request.urlopen(BASE+'/releases/latest',timeout=45)
 tag=response.url.rsplit('/',1)[-1]
 if not re.fullmatch(r'gtfs-\d{8}-\d{6}',tag):raise ValueError('Unexpected release tag')
 path=Path(tempfile.gettempdir())/'china-rail-gtfs-update.zip'
 urllib.request.urlretrieve(BASE+'/releases/download/'+tag+'/output_gtfs.zip',path)
z=zipfile.ZipFile(path)
def rows(name):return csv.DictReader(io.TextIOWrapper(z.open(name),encoding='utf-8-sig',newline=''))
def date(s):return f'{s[:4]}-{s[4:6]}-{s[6:]}'
feed=next(rows('feed_info.txt'))
services=defaultdict(list)
for r in rows('calendar_dates.txt'):
 if r['exception_type']=='1':services[r['service_id']].append(date(r['date']))
stations={r['stop_id']:{'id':r['stop_id'],'name':r['stop_name'],'lat':float(r['stop_lat']),'lng':float(r['stop_lon']),'level':2} for r in rows('stops.txt')}
route_agencies={r['route_id']:r['agency_id'] for r in rows('routes.txt')}
operator_config=json.loads((ROOT/'config/rail-operators.json').read_text())
trips={r['trip_id']:{'id':r['trip_id'],'code':r['trip_short_name'],'serviceId':r['service_id'],'operator':route_agencies.get(r['route_id'],'unknown'),'shape':r['shape_id'],'stops':[],'times':[]}for r in rows('trips.txt')}
times=defaultdict(list)
for r in rows('stop_times.txt'):times[r['trip_id']].append((int(r['stop_sequence']),r['stop_id'],r['arrival_time'],r['departure_time']))
skipped=[];frequency=Counter()
for tid,t in list(trips.items()):
 stops=sorted(times[tid]);ids=[r[1]for r in stops]
 if len(ids)<2 or any(id not in stations for id in ids) or len(set(ids))!=len(ids):
  skipped.append(tid);del trips[tid];continue
 t['stops']=ids;t['times']=[[r[2],r[3]]for r in stops];frequency.update(ids)
 prefix=t['code'][:1].upper()
 t['category']='high-speed-emu' if prefix=='G' else 'emu' if prefix=='D' else 'intercity-emu' if prefix=='C' else 'suburban' if prefix=='S' else 'conventional' if prefix in 'ZKTVNYL' or prefix.isdigit() else 'unknown'
 rule=operator_config['guangdongIntercity'];lo_lat,lo_lng,hi_lat,hi_lng=rule['bounds']
 if prefix in rule['prefixes'] and any(stations[id]['name'] in rule['distinctiveStations'] for id in ids) and all(lo_lat<=stations[id]['lat']<=hi_lat and lo_lng<=stations[id]['lng']<=hi_lng for id in ids):
  t['operator']=rule['operator'];t['operatorEvidence']='Guangdong corridor + distinctive stations + train prefix'
 else:t['operatorEvidence']='GTFS agency_id'
for id in list(stations):
 if not frequency[id]:del stations[id]
for i,(id,_) in enumerate(frequency.most_common()):
 if id in stations:stations[id]['level']=0 if i<35 else 1 if i<500 else 2
# Keep a compact station-pair geometry database derived from upstream railway shapes.
byshape=defaultdict(list)
for t in trips.values():
 if t['shape']:byshape[t['shape']].append(t)
segments={};train_routes={};shape_count=0;unmatched=0
for t in trips.values():train_routes[t['id']]={'code':t['code'],'operator':t['operator'],'category':t['category'],'stops':t['stops'],'legs':{},'shapeId':t['shape']}
# Iterative Douglas-Peucker, preserving rail endpoints.
def simplify(ps,tol=.0007):
 if len(ps)<3:return ps
 keep={0,len(ps)-1};stack=[(0,len(ps)-1)]
 while stack:
  a,b=stack.pop();ay,ax=ps[a];by,bx=ps[b];dx=bx-ax;dy=by-ay;den=dx*dx+dy*dy;far=tol*tol;at=None
  for i in range(a+1,b):
   py,px=ps[i];t=max(0,min(1,((px-ax)*dx+(py-ay)*dy)/den))if den else 0
   d=(px-ax-t*dx)**2+(py-ay-t*dy)**2
   if d>far:far=d;at=i
  if at is not None:keep.add(at);stack.extend([(a,at),(at,b)])
 return [[round(ps[i][0],5),round(ps[i][1],5)]for i in sorted(keep)]
def consume(sid,points):
 global shape_count,unmatched
 if sid not in byshape or not points:return
 shape_count+=1
 for train in byshape[sid]:
  positions={}
  for id in train['stops']:
   s=stations[id];factor=math.cos(s['lat']*math.pi/180)
   j=min(range(len(points)),key=lambda j:(points[j][0]-s['lat'])**2+((points[j][1]-s['lng'])*factor)**2)
   km=math.hypot(points[j][0]-s['lat'],(points[j][1]-s['lng'])*factor)*111
   # Avoid attaching a nearby parallel railway/station several kilometres away.
   if km<=.75:positions[id]=j
  direction=None
  for a,b in zip(train['stops'],train['stops'][1:]):
   if a not in positions or b not in positions:unmatched+=1;continue
   ia,ib=positions[a],positions[b]
   if ia==ib:unmatched+=1;continue
   sign=1 if ib>ia else -1
   if direction is None:direction=sign
   if sign!=direction:unmatched+=1;continue
   ids=sorted([a,b]);key='|'.join(ids);ia,ib=[positions[id] for id in ids]
   coords=points[min(ia,ib):max(ia,ib)+1]
   if ia>ib:coords=list(reversed(coords))
   coordinates=simplify(coords)
   # Deduplicate only identical geometry in the same operator/category, never station pairs.
   identity=json.dumps([train['operator'],train['category'],coordinates],separators=(',',':'))
   gid=hashlib.sha256(identity.encode()).hexdigest()[:24]
   segments.setdefault(gid,{'status':'routed','coordinates':coordinates,'source':'train-specific GTFS shape','operator':train['operator'],'category':train['category'],'stations':ids})
   train_routes[train['id']]['legs'][key]=gid
current=None;points=[]
for r in rows('shapes.txt'):
 sid=r['shape_id']
 if current is not None and sid!=current:consume(current,points);points=[]
 current=sid
 if sid in byshape:points.append((float(r['shape_pt_lat']),float(r['shape_pt_lon'])))
if current is not None:consume(current,points)
for t in trips.values():t.pop('shape',None)
meta={'name':'中国铁路真实时刻表快照','kind':'snapshot','sourceName':'wensimehrp / chinese-railway-gtfs','sourceUrl':BASE,'releaseUrl':BASE+'/releases/tag/'+tag,'release':tag,'updatedAt':date(feed['feed_version']),'validFrom':date(feed['feed_start_date']),'validTo':date(feed['feed_end_date']),'timezone':'Asia/Shanghai','license':'CC BY 4.0','upstream':'RailGo-Parser','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'excludedTrips':len(skipped),'geometry':'逐车次来源线路，按运营方及车种隔离；无路径时不作无约束寻路' }
payload={'metadata':meta,'stations':list(stations.values()),'trains':list(trips.values()),'services':dict(services)}
geometry={'metadata':{'source':BASE,'license':'CC BY 4.0','snapshot':meta['updatedAt']},'stationCoordinates':{id:[s['lat'],s['lng']]for id,s in stations.items()},'segments':segments,'version':2,'trainRoutes':train_routes}
for name,obj in [('data.json',payload),('routes.json',geometry)]:
 target=ROOT/'public/timetable'/name;target.parent.mkdir(parents=True,exist_ok=True)
 tmp=target.with_suffix('.tmp');tmp.write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':')));os.replace(tmp,target)
print(json.dumps({'stations':len(stations),'trips':len(trips),'services':len(services),'geometryVariants':len(segments),'trainSpecificLegs':sum(len(r['legs'])for r in train_routes.values()),'unmatchedLegs':unmatched,'shapes':shape_count,'metadata':meta},ensure_ascii=False,indent=2))
