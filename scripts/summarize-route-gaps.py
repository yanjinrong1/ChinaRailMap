#!/usr/bin/env python3
"""Export every unresolved undirected station pair; retain all affected trains."""
import collections,csv,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
a=json.loads((root/'public/timetable/routing-audit.json').read_text());pairs={}
for leg in a['legs']:
 key=tuple(sorted((leg['from'],leg['to'])))
 row=pairs.setdefault(key,{'stations':dict(zip((leg['from'],leg['to']),(leg['fromName'],leg['toName']))),'codes':set(),'reasons':collections.Counter(),'legs':0})
 row['codes'].add(leg['code']);row['reasons'][leg['reason']]+=1;row['legs']+=1
out=root/'public/timetable/remaining-route-gaps.csv'
with out.open('w',encoding='utf-8-sig',newline='')as f:
 writer=csv.writer(f);writer.writerow(['起站ID','起站','终站ID','终站','缺口车次区间数','原因及数量','涉及车次'])
 for (a,b),row in sorted(pairs.items(),key=lambda x:(-x[1]['legs'],x[0])):
  writer.writerow([a,row['stations'][a],b,row['stations'][b],row['legs'],json.dumps(row['reasons'],ensure_ascii=False),' '.join(sorted(row['codes']))])
print(json.dumps({'uniquePairs':len(pairs),'unresolvedTrainLegs':sum(r['legs']for r in pairs.values()),'report':str(out)}))
