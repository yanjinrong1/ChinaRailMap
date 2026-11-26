"""Reviewed OSM station corrections, guarded against unrelated upstream changes."""
import json
from pathlib import Path
RULES=json.loads((Path(__file__).resolve().parents[2]/'config/station-coordinate-overrides.json').read_text())
def apply_station_locations(stations):
 applied=[]
 for rule in RULES:
  station=stations.get(rule['id'])
  if not station or station['name']!=rule['name']:continue
  point=[station['lat'],station['lng']]
  # Only replace the reviewed erroneous source location, or accept our own result.
  if not any(max(abs(a-b)for a,b in zip(point,expected))<.001 for expected in (rule['originalCoordinates'],rule['coordinates'])):continue
  station['lat'],station['lng']=rule['coordinates'];applied.append(rule)
 return applied
