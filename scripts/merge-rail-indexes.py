#!/usr/bin/env python3
"""Merge attributed Geofabrik railway indexes by OSM identity, retaining provenance."""
import argparse,json,pickle,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'railway'))
from router import read_index
p=argparse.ArgumentParser();p.add_argument('--input',action='append',required=True);p.add_argument('--output',required=True);args=p.parse_args();out=Path(args.output);out.mkdir(exist_ok=True,parents=True)
for filename in ('way_to_meta.pkl','node_coords.pkl','relations.pkl','stations.pkl'):
 combined={}
 for directory in args.input:
  data=read_index(Path(directory)/filename)
  if filename=='stations.pkl':data=data['features']
  for id,item in data.items():
   if filename=='way_to_meta.pkl'and id in combined and len(combined[id]['nodes'])>len(item['nodes']):continue
   combined[id]=item
 with (out/filename).open('wb')as f:pickle.dump({'features':combined}if filename=='stations.pkl'else combined,f,protocol=4)
 print(filename,len(combined),flush=True)
metas=[json.loads((Path(d)/'metadata.json').read_text())for d in args.input];provenance=[json.loads((Path(d)/'source-provenance.json').read_text())for d in args.input]
(out/'metadata.json').write_text(json.dumps({'index_format':1,'region':'china-and-laos','data_date':min(m['data_date']for m in metas),'source':'Geofabrik OpenStreetMap China + Laos extracts','inputMetadata':metas}))
(out/'source-provenance.json').write_text(json.dumps({'inputs':provenance,'license':'ODbL-1.0','attribution':'© OpenStreetMap contributors; extracts by Geofabrik'}))
