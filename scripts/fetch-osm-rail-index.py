import urllib.request,json,hashlib,tarfile,pathlib,argparse
p=argparse.ArgumentParser();p.add_argument("--output",required=True);args=p.parse_args()
registry='https://ghcr.io';repo='sowevo/rail-explorer'
token=json.load(urllib.request.urlopen(registry+'/token?service=ghcr.io&scope=repository:'+repo+':pull'))['token']
manifest_digest='sha256:c43434aee235e5bfaf4ec0b712db9589deb20bb3377f832531b46718cbbed478'
layer={'digest':'sha256:bb9b9b7a11db12ffbad840634e6169937d9ca0b5adc5335bd8d3d163b10c0f9b'}
request=urllib.request.Request(registry+'/v2/'+repo+'/blobs/'+layer['digest'],headers={'Authorization':'Bearer '+token})
target=pathlib.Path(args.output);target.mkdir(parents=True,exist_ok=True)
path=target/'osm-data-layer.tar.gz';digest=hashlib.sha256()
with urllib.request.urlopen(request,timeout=60) as response,path.open('wb')as out:
 while chunk:=response.read(1024*1024):out.write(chunk);digest.update(chunk)
assert 'sha256:'+digest.hexdigest()==layer['digest']
allowed={'metadata.json','node_to_ways.pkl','way_to_nodes.pkl','node_coords.pkl','way_to_meta.pkl','relations.pkl','stations.pkl','DATA_LICENSE.txt'}
with tarfile.open(path)as archive:
 for member in archive:
  name=pathlib.PurePosixPath(member.name).name
  if member.isfile() and name in allowed:
   data=archive.extractfile(member).read();(target/name).write_bytes(data);print(name,len(data),flush=True)
(target/'registry-provenance.json').write_text(json.dumps({'repository':'https://github.com/Sowevo/rail-explorer','image':'ghcr.io/sowevo/rail-explorer:china','manifest':manifest_digest,'dataLayer':layer['digest']}))
