import unittest
from station_locations import apply_station_locations
from router import edge_weight
class LocationAndCorridorTests(unittest.TestCase):
 def test_renqiuxi_reviewed_coordinate_and_guard(self):
  stations={'RQI':{'id':'RQI','name':'任丘西','lat':38.472388,'lng':116.092395}}
  self.assertEqual(len(apply_station_locations(stations)),1)
  self.assertAlmostEqual(stations['RQI']['lat'],38.7029368)
  stations['RQI']['lat']=40
  self.assertEqual(apply_station_locations(stations),[])
 def test_mixed_corridors_are_bounded_and_not_350kmh(self):
  p={'operator':'CR','category':'conventional'}
  for name,pos in [('衡柳线',(25,110)),('石太客专线',(38,113)),('兰渝线',(32,106))]:
   tags={'railway':'rail','name':name,'highspeed':'yes','maxspeed':'200'}
   self.assertIsNotNone(edge_weight(tags,p,pos,1))
   self.assertIsNone(edge_weight({**tags,'maxspeed':'350'},p,pos,1))
   self.assertIsNone(edge_weight(tags,p,(30,120),1))
 def test_taiyuan_approach_does_not_unlock_mainline(self):
  p={'operator':'CR','category':'conventional','taiyuanSharedApproach':True}
  tags={'railway':'rail','name':'郑太客专线','maxspeed':'160','highspeed':'yes'}
  self.assertIsNotNone(edge_weight(tags,p,(37.8,112.6),1))
  self.assertIsNone(edge_weight(tags,p,(36,113),1))
  self.assertIsNone(edge_weight(tags,{**p,'taiyuanSharedApproach':False},(37.8,112.6),1))
 def test_rail_ferry_requires_reviewed_identity_and_through_train(self):
  tags={'railway':'ferry','name':'粤海轮渡线','_osmWayId':25172513}
  p={'operator':'CR','category':'conventional','railFerry':True}
  self.assertEqual(edge_weight(tags,p,(20.15,110.15),10),2)
  for changed in ({'railFerry':False},{'category':'emu'},{'operator':'GDIC'}):self.assertIsNone(edge_weight(tags,{**p,**changed},(20.15,110.15),10))
  self.assertIsNone(edge_weight({**tags,'_osmWayId':1},p,(20.15,110.15),10))
 def test_reviewed_unnamed_connector_does_not_unlock_neighboring_fast_tracks(self):
  from router import MIXED_CORRIDORS
  rule=next(r for r in MIXED_CORRIDORS if r['id']=='baxu-connectors');a,b,c,d=rule['bounds'];pos=((a+c)/2,(b+d)/2)
  tags={'railway':'rail','highspeed':'yes','_osmWayId':rule['wayIds'][0]};p={'operator':'CR','category':'conventional','mixedTrafficStations':['白洋淀']}
  self.assertIsNotNone(edge_weight(tags,p,pos,1))
  self.assertIsNone(edge_weight({**tags,'_osmWayId':999999},p,pos,1))
  self.assertIsNone(edge_weight(tags,{**p,'mixedTrafficStations':[]},pos,1))
 def test_jixi_passenger_throat_is_not_general_yard_permission(self):
  p={'operator':'CR','category':'conventional','passengerTrackOverrides':['jixi-liumao-throat']}
  tags={'railway':'rail','service':'yard','gauge':'1435','_osmWayId':1119200697};pos=(45.3206,130.8874)
  self.assertIsNotNone(edge_weight(tags,p,pos,.054))
  self.assertIsNone(edge_weight({**tags,'_osmWayId':123},p,pos,.054))
  self.assertIsNone(edge_weight(tags,{**p,'passengerTrackOverrides':[]},pos,.054))
