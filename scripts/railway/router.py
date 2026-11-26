"""Offline routing on attributed OSM railway ways; never on road tiles.
Data adapters may supply raw rail-explorer indexes or an equivalent JSON graph.
"""
import builtins,collections,gzip,hashlib,heapq,json,math,pickle,re
from pathlib import Path

class DataOnlyUnpickler(pickle.Unpickler):
 def find_class(self,module,name):
  if module=='builtins' and name in ('set','frozenset'):return getattr(builtins,name)
  raise pickle.UnpicklingError('Non-data object in public OSM index')
def read_index(path):
 with Path(path).open('rb')as f:return DataOnlyUnpickler(f).load()
def km(a,b):
 y1,x1,y2,x2=map(math.radians,(*a,*b));h=math.sin((y2-y1)/2)**2+math.cos(y1)*math.cos(y2)*math.sin((x2-x1)/2)**2
 return 6371*2*math.asin(min(1,math.sqrt(h)))
GD_NAMES=re.compile('莞惠|佛莞|广佛环|广佛南环|佛肇|广肇|广惠|广清|广州东环|琶洲支线|琶莲|穗莞深|穗深|新白广')
GD_OPERATORS=re.compile('广东城际|广州地铁|广东珠三角城际')
FAST_NAMES=re.compile('高速|客运专线|客专|高铁')
LANXIN=re.compile('兰新.*(客|第二|二线|二双)|Lanxin.*(Passenger|Second)|兰新高铁',re.I)
OVERRIDES=json.loads((Path(__file__).resolve().parents[2]/'config/osm-routing-overrides.json').read_text())
MIXED_CORRIDORS=json.loads((Path(__file__).resolve().parents[2]/'config/mixed-traffic-corridors.json').read_text())
def mixed_corridor(tags,profile,position):
 if profile['operator']!='CR' or profile['category']!='conventional':return None
 for rule in MIXED_CORRIDORS:
  south,west,north,east=rule['bounds'];lat,lng=position
  if rule.get('requiresTimetableStation') and not profile.get('taiyuanSharedApproach'):continue
  if rule.get('requiresAnyTimetableStation') and not set(rule['requiresAnyTimetableStation']).intersection(profile.get('mixedTrafficStations',[])):continue
  if tags.get('name','')not in rule['lines'] and tags.get('_osmWayId')not in rule.get('wayIds',[]):continue
  if not(south<=lat<=north and west<=lng<=east):continue
  speeds=re.findall(r'\d+',str(tags.get('maxspeed','')))
  if speeds and max(map(int,speeds))>rule['maxspeed']:continue
  return rule['id']
 return None

RAIL_FERRIES=json.loads((Path(__file__).resolve().parents[2]/'config/rail-ferries.json').read_text())
def rail_ferry_allowed(tags,profile,position):
 if profile['operator']!='CR'or profile['category']!='conventional'or not profile.get('railFerry'):return False
 return any(tags.get('_osmWayId')==r['wayId']and r['bounds'][0]<=position[0]<=r['bounds'][2]and r['bounds'][1]<=position[1]<=r['bounds'][3]for r in RAIL_FERRIES)

FERRY_APPROACH_IDS={id for r in RAIL_FERRIES for id in r.get('boardingApproachWayIds',[])}
def ferry_approach_allowed(tags,profile,position):
 if profile['operator']!='CR'or profile['category']!='conventional'or not profile.get('railFerry'):return False
 return any(tags.get('_osmWayId')in r.get('boardingApproachWayIds',[])and r['boardingApproachBounds'][0]<=position[0]<=r['boardingApproachBounds'][2]and r['boardingApproachBounds'][1]<=position[1]<=r['boardingApproachBounds'][3]for r in RAIL_FERRIES)

PASSENGER_TRACK_OVERRIDES=json.loads((Path(__file__).resolve().parents[2]/'config/passenger-track-overrides.json').read_text())
PASSENGER_TRACK_IDS={id for r in PASSENGER_TRACK_OVERRIDES for id in r['wayIds']}
def passenger_track_allowed(tags,profile,position):
 if profile['operator']!='CR'or profile['category']!='conventional':return False
 return any(r['id']in profile.get('passengerTrackOverrides',[])and tags.get('_osmWayId')in r['wayIds']and r['bounds'][0]<=position[0]<=r['bounds'][2]and r['bounds'][1]<=position[1]<=r['bounds'][3]for r in PASSENGER_TRACK_OVERRIDES)

TAG_FIELDS=('railway','name','name:zh','official_name','ref','operator','owner','highspeed','maxspeed','gauge','electrified','usage','service','railway:traffic_mode','access','layer','bridge','tunnel')
def freight_override(tags,profile,position):
 for key,rule in OVERRIDES.items():
  south,west,north,east=rule['bounds'];lat,lng=position
  if profile.get(key)and tags.get('name')==rule['line']and south<=lat<=north and west<=lng<=east:
   if rule.get('operator',profile['operator'])==profile['operator']and rule.get('category',profile['category'])==profile['category']:return key
 return None

FREIGHT_TAG_PENALTY=1.5

def edge_weight(tags,profile,position,length):
 weight=_base_edge_weight(tags,profile,position,length)
 if weight is None:return None
 # A freight label is uncertain evidence, not a passenger prohibition.
 if tags.get('railway:traffic_mode')=='freight'and not freight_override(tags,profile,position):weight*=FREIGHT_TAG_PENALTY
 return weight

def _base_edge_weight(tags,profile,position,length):
 """None means forbidden. Unknown tags are penalized, never interpreted as proof."""
 if tags.get('railway')=='ferry':return 2 if rail_ferry_allowed(tags,profile,position)else None
 if tags.get('railway')!='rail' or (tags.get('service') in ('yard','spur')and not(ferry_approach_allowed(tags,profile,position)or passenger_track_allowed(tags,profile,position))) or tags.get('usage') in ('industrial','military','test'):return None
 gauge=str(tags.get('gauge',''));name=' '.join(str(tags.get(k,''))for k in ('name','name:zh','official_name'));operator=str(tags.get('operator',''))
 if gauge and '1435' not in gauge:return None
 gd=bool(GD_NAMES.search(name)or GD_OPERATORS.search(operator))
 fast=tags.get('highspeed')=='yes' or bool(FAST_NAMES.search(name))
 try:fast=fast or float(re.findall(r'\d+',str(tags.get('maxspeed','')))[0])>=250
 except (IndexError,ValueError):pass
 if profile['operator']=='GDIC':
  if gd:return 1
  # Only short, unnamed station connectors within the already connected local network.
  if name or operator or length>1:return None
  return 5
 if gd:return None
 if tags.get('service')=='yard':return 3 if ferry_approach_allowed(tags,profile,position)or passenger_track_allowed(tags,profile,position)else None
 if profile['category']=='conventional':
  if '城际' in name or '市域' in name:return None
  if fast:
   lat,lng=position
   if not mixed_corridor(tags,profile,position) and not(profile.get('lanxin') and 34<lat<45 and 85<lng<105 and LANXIN.search(name)):return None
  return 2 if tags.get('service')=='siding' else 1 if name else 1.12
 if profile['category']=='high-speed-emu':return 2 if tags.get('service')=='siding' else 1 if fast else 1.6
 return 2 if tags.get('service')=='siding' else 1 if name else 1.08

def profile_for(train,stations):
 names={stations[id]['name']for id in train['stops']}
 # Intermediate stations unique to the Lanxin passenger corridor constitute
 # timetable evidence; this is not a blanket exemption for every Z/K/T train.
 lanxin=train.get('operator')=='CR'and train.get('category')=='conventional'and bool(names&{'张掖西','高台南','酒泉南','嘉峪关南','柳园南','鄯善北','吐鲁番北'})
 profile={'taiyuanSharedApproach':train.get('operator')=='CR'and train.get('category')=='conventional'and '太原'in names,'operator':train.get('operator','unknown'),'category':train.get('category','unknown'),'lanxin':lanxin,'baiyunPassengerAccess':train.get('operator')=='CR'and '广州白云'in names}
 profile['passengerTrackOverrides']=sorted(r['id']for r in PASSENGER_TRACK_OVERRIDES if set(r['requiresAllTimetableStations'])<=names)
 profile['railFerry']=profile['operator']=='CR'and profile['category']=='conventional'and bool(names.intersection({n for r in RAIL_FERRIES for n in r['requiresIslandStation']}))and any(stations[id]['lat']>20.3 for id in train['stops'])
 required={name for rule in MIXED_CORRIDORS for name in rule.get('requiresAnyTimetableStation',[])}
 profile['mixedTrafficStations']=sorted(names.intersection(required))
 rule=OVERRIDES['guangmaoPassengerDiversion']
 if profile['operator']==rule['operator']and profile['category']==rule['category']and rule['requiresTimetableStation']in names and names.intersection(rule['requiresAnyTimetableStation']):profile['guangmaoPassengerDiversion']=True
 return profile

class RailGraph:
 def __init__(self,edges,positions,metadata=None):
  self.edges=edges;self.positions=positions;
  for e in edges:e['tags']['_osmWayId']=e['way']
  self.metadata=metadata or {};self.adj=collections.defaultdict(list);self.grid=collections.defaultdict(set);self.weight_cache={};self.snap_cache={}
  for i,e in enumerate(edges):
   self.adj[e['a']].append((e['b'],i));self.adj[e['b']].append((e['a'],i));coords=e['coordinates'];e['length']=sum(km(a,b)for a,b in zip(coords,coords[1:]))
   for a,b in zip(coords,coords[1:]):
    for y in range(math.floor(min(a[0],b[0])*50),math.floor(max(a[0],b[0])*50)+1):
     for x in range(math.floor(min(a[1],b[1])*50),math.floor(max(a[1],b[1])*50)+1):self.grid[y,x].add(i)
 @classmethod
 def from_index(cls,directory,cache=None):
  directory=Path(directory)
  if cache and Path(cache).exists():
   with gzip.open(cache,'rt')as f:data=json.load(f)
   return cls(data['edges'],{int(k):v for k,v in data['positions'].items()},data['metadata'])
  print('Reading attributed railway ways',flush=True);raw=read_index(directory/'way_to_meta.pkl');ways={}
  for id,item in raw.items():
   tags=item['tags']
   if (tags.get('railway')=='rail'or tags.get('railway')=='ferry'and id in {r['wayId']for r in RAIL_FERRIES}) and (tags.get('service') not in ('yard','spur')or id in FERRY_APPROACH_IDS or id in PASSENGER_TRACK_IDS) and tags.get('usage') not in ('industrial','military','test'):
    ways[id]={'nodes':item['nodes'],'tags':{k:tags[k]for k in TAG_FIELDS if k in tags}}
  del raw
  relations=read_index(directory/'relations.pkl')
  for r in relations.values():
   tags=r['tags']
   if tags.get('route')not in ('railway','tracks'):continue
   for member in r['members']:
    if member['type']=='w' and member['ref']in ways:
     t=ways[member['ref']]['tags']
     for k in ('name','operator','ref'):
      if not t.get(k)and tags.get(k):t[k]=tags[k]
  del relations
  counts=collections.Counter()
  for way in ways.values():counts.update(set(way['nodes']))
  print('Reading railway coordinates',len(ways),'ways',flush=True);coords=read_index(directory/'node_coords.pkl');edges=[];positions={}
  for wid,way in ways.items():
   nodes=way['nodes'];start=0
   if len(nodes)<2:continue
   for i in range(1,len(nodes)):
    if i!=len(nodes)-1 and counts[nodes[i]]<2:continue
    ids=nodes[start:i+1];start=i
    if ids[0]==ids[-1]or any(id not in coords for id in ids):continue
    a,b=ids[0],ids[-1];positions[a]=coords[a];positions[b]=coords[b]
    edges.append({'a':a,'b':b,'way':wid,'tags':way['tags'],'coordinates':[coords[id]for id in ids]})
  del coords,ways,counts
  meta=json.loads((directory/'metadata.json').read_text());provenance=directory/'source-provenance.json'
  if not provenance.exists():provenance=directory/'registry-provenance.json'
  meta['provenance']=json.loads(provenance.read_text())
  if cache:
   with gzip.open(cache,'wt')as f:json.dump({'metadata':meta,'positions':positions,'edges':edges},f,separators=(',',':'))
  print('Graph compressed:',len(edges),'edges',len(positions),'junctions',flush=True)
  return cls(edges,positions,meta)
 def weights(self,profile):
  key=json.dumps(profile,sort_keys=True)
  if key not in self.weight_cache:
   self.weight_cache[key]=[edge_weight(e['tags'],profile,e['coordinates'][len(e['coordinates'])//2],e['length'])for e in self.edges]
  return self.weight_cache[key]
 def snaps(self,station,profile):
  key=(json.dumps(profile,sort_keys=True),station['id'])
  if key in self.snap_cache:return self.snap_cache[key]
  point=(station['lat'],station['lng']);y,x=math.floor(point[0]*50),math.floor(point[1]*50);candidates=set()
  for dy in (-1,0,1):
   for dx in (-1,0,1):candidates.update(self.grid.get((y+dy,x+dx),()))
  weights=self.weights(profile);found=[];scale=math.cos(math.radians(point[0]))
  for eid in candidates:
   if weights[eid]is None:continue
   e=self.edges[eid];cs=e['coordinates'];along=0;best=None
   for j,(a,b)in enumerate(zip(cs,cs[1:])):
    ay,ax=(a[0]-point[0])*111,(a[1]-point[1])*111*scale;by,bx=(b[0]-point[0])*111,(b[1]-point[1])*111*scale;dy,dx=by-ay,bx-ax;den=dx*dx+dy*dy;t=max(0,min(1,-(ax*dx+ay*dy)/den))if den else 0
    distance=math.hypot(ax+t*dx,ay+t*dy);segment_length=km(a,b)
    if best is None or distance<best[0]:best=(distance,eid,j,t,[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])],along+t*segment_length)
    along+=segment_length
   if best and best[0]<=1:found.append(best)
  found.sort(key=lambda item:item[0]);result=found[:32]
  self.snap_cache[key]=result;return result
 def route(self,a,b,profile,max_visits=500000):
  if profile['operator']not in ('CR','GDIC')or profile['category']=='unknown':return None,'unsupported-profile'
  starts,ends=self.snaps(a,profile),self.snaps(b,profile)
  if not starts or not ends:return None,'station-not-on-allowed-railway'
  weights=self.weights(profile);targets=collections.defaultdict(list);dist={};prev={};source={};heap=[];target=(b['lat'],b['lng']);best=math.inf;winner=None
  for snap in ends:
   e=self.edges[snap[1]];w=weights[snap[1]]
   targets[e['a']].append((snap[5]*w,snap,False));targets[e['b']].append(((e['length']-snap[5])*w,snap,True))
  for snap in starts:
   e=self.edges[snap[1]];w=weights[snap[1]]
   for node,cost,side in ((e['a'],snap[5]*w,False),(e['b'],(e['length']-snap[5])*w,True)):
    cost+=snap[0]*3
    if cost<dist.get(node,math.inf):dist[node]=cost;prev[node]=None;source[node]=(snap,side);heapq.heappush(heap,(cost+km(self.positions[node],target),cost,node))
  # A direct partial edge needs no graph junction.
  direct=None
  for start in starts:
   for end in ends:
    if start[1]==end[1]:
     cost=abs(start[5]-end[5])*weights[start[1]]+(start[0]+end[0])*3
     if cost<best:best=cost;direct=(start,end)
  visited=0
  while heap:
   estimate,cost,node=heapq.heappop(heap)
   if estimate>best:break
   if cost!=dist.get(node):continue
   visited+=1
   if visited>max_visits:return None,'search-limit'
   for tail,snap,side in targets.get(node,[]):
    value=cost+tail+snap[0]*3
    if value<best:best=value;winner=(node,snap,side);direct=None
   for nxt,eid in self.adj[node]:
    w=weights[eid]
    if w is None:continue
    value=cost+self.edges[eid]['length']*w
    if value<dist.get(nxt,math.inf):dist[nxt]=value;prev[nxt]=(node,eid);heapq.heappush(heap,(value+km(self.positions[nxt],target),value,nxt))
  if direct:
   start,end=direct;e=self.edges[start[1]];lo,hi=sorted((start,end),key=lambda s:s[5]);points=[lo[4],*e['coordinates'][lo[2]+1:hi[2]+1],hi[4]]
   if start[5]>end[5]:points.reverse()
   edge_ids=[start[1]]
  elif winner:
   node,end,end_side=winner;chain=[]
   while prev[node]is not None:
    old,eid=prev[node];chain.append((eid,old,node));node=old
   start,start_side=source[node];edge_ids=[start[1]];e=self.edges[start[1]];j=start[2]
   points=[start[4],*e['coordinates'][j+1:]]if start_side else [start[4],*reversed(e['coordinates'][:j+1])]
   for eid,old,nxt in reversed(chain):
    cs=self.edges[eid]['coordinates'];points.extend(cs[1:]if self.edges[eid]['a']==old else list(reversed(cs))[1:]);edge_ids.append(eid)
   e=self.edges[end[1]];j=end[2];points.extend([*reversed(e['coordinates'][j+1:]),end[4]]if end_side else [*e['coordinates'][:j+1],end[4]]);edge_ids.append(end[1])
  else:return None,'disconnected-allowed-network'
  length=sum(km(x,y)for x,y in zip(points,points[1:]));straight=km((a['lat'],a['lng']),(b['lat'],b['lng']))
  if length>3*straight+30:
   self.last_failure={'lengthKm':length,'straightKm':straight,'startSnap':start[0],'endSnap':end[0],'lines':list(dict.fromkeys(self.edges[id]['tags'].get('name','')for id in edge_ids))}
   return None,'excessive-detour'
  tags=[self.edges[id]['tags']for id in dict.fromkeys(edge_ids)];names=list(dict.fromkeys(t.get('name')for t in tags if t.get('name')))
  freight_edges=[self.edges[id]for id in edge_ids if self.edges[id]['tags'].get('railway:traffic_mode')=='freight']
  soft_edges=[e for e in freight_edges if not freight_override(e['tags'],profile,e['coordinates'][len(e['coordinates'])//2])]
  return {'coordinates':points,'freightTagPolicy':'soft-penalty','freightTagPenalty':FREIGHT_TAG_PENALTY,'freightTaggedWayIds':list(dict.fromkeys(e['way']for e in freight_edges)),'softFreightWayIds':list(dict.fromkeys(e['way']for e in soft_edges)),'tagOverrides':sorted({freight_override(self.edges[id]['tags'],profile,self.edges[id]['coordinates'][len(self.edges[id]['coordinates'])//2])for id in edge_ids if self.edges[id]['tags'].get('railway:traffic_mode')=='freight'}-{None}),'passengerTrackOverrides':sorted({r['id']for r in PASSENGER_TRACK_OVERRIDES if any(self.edges[id]['way']in r['wayIds']for id in edge_ids)}),'railFerryApproachWayIds':list(dict.fromkeys(self.edges[id]['way']for id in edge_ids if self.edges[id]['way']in FERRY_APPROACH_IDS)),'railFerryWayIds':list(dict.fromkeys(self.edges[id]['way']for id in edge_ids if self.edges[id]['tags'].get('railway')=='ferry')),'mixedTrafficCorridors':sorted({mixed_corridor(self.edges[id]['tags'],profile,self.edges[id]['coordinates'][len(self.edges[id]['coordinates'])//2])for id in edge_ids}-{None}),'lengthKm':round(length,2),'wayIds':list(dict.fromkeys(self.edges[id]['way']for id in edge_ids)),'lineNames':names,'snapKm':[round(start[0],3),round(end[0],3)],'profile':profile},None

def simplify_coordinates(points,tolerance_km=.045):
 """Preserve endpoints while reducing map-display geometry to a 45m tolerance."""
 if len(points)<3:return points
 factor=math.cos(math.radians(sum(p[0]for p in points)/len(points)));xy=[(p[1]*111*factor,p[0]*111)for p in points];keep={0,len(points)-1};stack=[(0,len(points)-1)];threshold=tolerance_km**2
 while stack:
  a,b=stack.pop();ax,ay=xy[a];bx,by=xy[b];dx,dy=bx-ax,by-ay;den=dx*dx+dy*dy;far=threshold;index=None
  for i in range(a+1,b):
   x,y=xy[i];t=max(0,min(1,((x-ax)*dx+(y-ay)*dy)/den))if den else 0;distance=(x-ax-t*dx)**2+(y-ay-t*dy)**2
   if distance>far:far=distance;index=i
  if index is not None:keep.add(index);stack.extend(((a,index),(index,b)))
 return [points[i]for i in sorted(keep)]
