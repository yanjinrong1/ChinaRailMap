#!/usr/bin/env python3
"""Build data-only railway indexes from a local Geofabrik PBF (requires osmium)."""
import argparse,datetime,hashlib,json,pickle
from pathlib import Path
import osmium
p=argparse.ArgumentParser();p.add_argument('pbf');p.add_argument('--output',required=True);p.add_argument('--source-url',default='https://download.geofabrik.de/asia/china-latest.osm.pbf');args=p.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
class Ways(osmium.SimpleHandler):
 def __init__(self):super().__init__();self.ways={};self.ids=set()
 def way(self,w):
  ids=[n.ref for n in w.nodes];self.ids.update(ids);self.ways[w.id]={'id':w.id,'nodes':ids,'tags':dict(w.tags)}
class Nodes(osmium.SimpleHandler):
 def __init__(self):super().__init__();self.coords={}
 def node(self,n):self.coords[n.id]=(n.location.lat,n.location.lon)
class Relations(osmium.SimpleHandler):
 def __init__(self):super().__init__();self.items={}
 def relation(self,r):self.items[r.id]={'id':r.id,'tags':dict(r.tags),'members':[{'type':m.type,'ref':m.ref,'role':m.role}for m in r.members]}
class Stations(osmium.SimpleHandler):
 def __init__(self):super().__init__();self.items={}
 def node(self,n):
  t=dict(n.tags);self.items[('n',n.id)]={'name':t.get('name:zh')or t.get('name',''),'coords':(n.location.lat,n.location.lon),'rail':True,'station_node':t.get('railway')in('station','halt'),'stop_position':t.get('railway')=='stop'}
print('Extract railway ways',flush=True);ways=Ways()
with osmium.io.Reader(args.pbf,osmium.osm.WAY)as reader:osmium.apply(reader,osmium.filter.TagFilter(('railway','rail')),ways)
print('Extract connected railway coordinates',len(ways.ways),'ways',flush=True);nodes=Nodes()
with osmium.io.Reader(args.pbf,osmium.osm.NODE)as reader:osmium.apply(reader,osmium.filter.IdFilter(ways.ids),nodes)
print('Extract railway relations',flush=True);relations=Relations()
with osmium.io.Reader(args.pbf,osmium.osm.RELATION)as reader:osmium.apply(reader,osmium.filter.TagFilter(('route','railway'),('route','tracks')),relations)
print('Extract exact-name station anchors',flush=True);stations=Stations()
with osmium.io.Reader(args.pbf,osmium.osm.NODE)as reader:osmium.apply(reader,osmium.filter.TagFilter(('railway','station'),('railway','halt'),('railway','stop')),stations)
for name,data in [('way_to_meta.pkl',ways.ways),('node_coords.pkl',nodes.coords),('relations.pkl',relations.items),('stations.pkl',{'features':stations.items})]:
 with (out/name).open('wb')as f:pickle.dump(data,f,protocol=4)
with osmium.io.Reader(args.pbf)as reader:timestamp=reader.header().get('osmosis_replication_timestamp')
meta={'index_format':1,'region':'china','data_timestamp':timestamp,'data_date':timestamp[:10]if timestamp else 'unknown','generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'Geofabrik OpenStreetMap extract'}
(out/'metadata.json').write_text(json.dumps(meta))
hash=hashlib.sha256()
with open(args.pbf,'rb')as f:
 while chunk:=f.read(8*1024*1024):hash.update(chunk)
(out/'source-provenance.json').write_text(json.dumps({'url':args.source_url,'sha256':hash.hexdigest(),'license':'ODbL-1.0','attribution':'© OpenStreetMap contributors; extracts by Geofabrik'}))
print(json.dumps({'ways':len(ways.ways),'nodes':len(nodes.coords),'stations':len(stations.items),'metadata':meta}),flush=True)
