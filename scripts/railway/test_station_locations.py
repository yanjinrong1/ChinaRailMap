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
