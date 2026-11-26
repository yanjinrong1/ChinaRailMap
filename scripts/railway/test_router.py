import io,pickle,unittest
from router import RailGraph,edge_weight,profile_for,DataOnlyUnpickler

class RoutingPolicyTests(unittest.TestCase):
 def test_conventional_cannot_take_unapproved_highspeed(self):
  tags={'railway':'rail','name':'京广高速铁路','gauge':'1435','highspeed':'yes'}
  self.assertIsNone(edge_weight(tags,{'operator':'CR','category':'conventional'},(30,114),10))
 def test_lanxin_requires_timetable_evidence_and_matching_line(self):
  stations={'A':{'name':'西宁'},'B':{'name':'张掖西'}};train={'stops':['A','B'],'operator':'CR','category':'conventional'};profile=profile_for(train,stations)
  self.assertTrue(profile['lanxin']);self.assertEqual(edge_weight({'railway':'rail','name':'兰新客专线','highspeed':'yes'},profile,(38,100),10),1)
  self.assertIsNone(edge_weight({'railway':'rail','name':'京广高速铁路','highspeed':'yes'},profile,(30,114),10))
  profile['lanxin']=False;self.assertIsNone(edge_weight({'railway':'rail','name':'兰新客专线','highspeed':'yes'},profile,(38,100),10))
 def test_operator_and_industrial_lines_are_isolated(self):
  cr={'operator':'CR','category':'conventional'};gd={'operator':'GDIC','category':'intercity-emu'}
  self.assertIsNone(edge_weight({'railway':'rail','name':'莞惠城际'},cr,(23,114),10))
  self.assertIsNone(edge_weight({'railway':'rail','name':'京广线'},gd,(23,113),10))
  self.assertIsNone(edge_weight({'railway':'rail','usage':'industrial'},cr,(30,114),10))
 def test_baiyun_stale_freight_override_is_narrowly_scoped(self):
  tags={'railway':'rail','name':'京广线','railway:traffic_mode':'freight'};p={'operator':'CR','category':'conventional','baiyunPassengerAccess':True}
  self.assertIsNotNone(edge_weight(tags,p,(23.24,113.23),1))
  self.assertIsNone(edge_weight(tags,p,(24,113.23),1));self.assertIsNone(edge_weight({**tags,'name':'某货运支线'},p,(23.24,113.23),1))
  self.assertIsNone(edge_weight(tags,{**p,'baiyunPassengerAccess':False},(23.24,113.23),1))
 def test_astar_chooses_allowed_rail_and_never_invents_disconnected_links(self):
  pos={1:[36,110],2:[36.05,110.05],3:[36,110.1],4:[36,111]}
  def edge(a,b,name,**tags):return {'a':a,'b':b,'way':a*10+b,'coordinates':[pos[a],pos[b]],'tags':{'railway':'rail','name':name,**tags}}
  graph=RailGraph([edge(1,3,'某高速铁路',highspeed='yes'),edge(1,2,'某普速线'),edge(2,3,'某普速线')],pos)
  a={'id':'A','lat':36,'lng':110};b={'id':'B','lat':36,'lng':110.1};p={'operator':'CR','category':'conventional'}
  route,error=graph.route(a,b,p);self.assertIsNone(error);self.assertEqual(route['lineNames'],['某普速线'])
  route,error=graph.route(a,{'id':'D','lat':36,'lng':111},p);self.assertIsNone(route);self.assertEqual(error,'station-not-on-allowed-railway')
 def test_passenger_passing_loops_allowed_but_yards_excluded(self):
  p={'operator':'CR','category':'conventional'};t={'railway':'rail','name':'京广线'}
  self.assertEqual(edge_weight({**t,'service':'siding'},p,(30,114),1),2)
  self.assertIsNone(edge_weight({**t,'service':'yard'},p,(30,114),1))
 def test_public_data_pickle_rejects_executable_objects(self):
  class Payload:
   def __reduce__(self):return (eval,('1+1',))
  with self.assertRaises(pickle.UnpicklingError):DataOnlyUnpickler(io.BytesIO(pickle.dumps(Payload()))).load()

if __name__=='__main__':unittest.main()
