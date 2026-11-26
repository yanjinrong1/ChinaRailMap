#!/usr/bin/env python3
"""Extract only reviewed railway=ferry ways, preserving real OSM endpoint nodes."""
import argparse,json,pickle
from pathlib import Path
import osmium
p=argparse.ArgumentParser();p.add_argument('pbf');p.add_argument('--output',required=True);p.add_argument('--provenance',required=True);args=p.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
allowed={r['wayId']for r in json.loads((Path(__file__).resolve().parents[1]/'config/rail-ferries.json').read_text())}
class Ways(osmium.SimpleHandler):
 def __init__(self):super().__init__();self.ways={};self.ids=set()
 def way(self,w):
  if w.id not in allowed or w.tags.get('railway')!='ferry':return
  nodes=[n.ref for n in w.nodes];self.ids.update(nodes);self.ways[w.id]={'id':w.id,'nodes':nodes,'tags':dict(w.tags)}
class Nodes(osmium.SimpleHandler):
 def __init__(self):super().__init__();self.coords={}
 def node(self,n):self.coords[n.id]=(n.location.lat,n.location.lon)
w=Ways()
with osmium.io.Reader(args.pbf,osmium.osm.WAY)as reader:osmium.apply(reader,osmium.filter.TagFilter(('railway','ferry')),w)
n=Nodes()
with osmium.io.Reader(args.pbf,osmium.osm.NODE)as reader:osmium.apply(reader,osmium.filter.IdFilter(w.ids),n)
assert allowed==set(w.ways),'Reviewed ferry missing from this PBF'
for name,data in [('way_to_meta.pkl',w.ways),('node_coords.pkl',n.coords),('stations.pkl',{'features':{}}),('relations.pkl',{})]:
 with (out/name).open('wb')as f:pickle.dump(data,f,protocol=4)
with osmium.io.Reader(args.pbf)as reader:timestamp=reader.header().get('osmosis_replication_timestamp')
(out/'metadata.json').write_text(json.dumps({'index_format':1,'region':'qiongzhou-rail-ferry','data_date':timestamp[:10],'source':'Geofabrik OSM reviewed railway ferries'}));(out/'source-provenance.json').write_text(Path(args.provenance).read_text());print('Reviewed railway ferries:',len(w.ways),flush=True)
