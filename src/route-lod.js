// Rendering-only screen-space detail. Source geometry and routing never change.
export function routeTolerance(zoom){return zoom<=5?3.5:zoom<=7?2.5:zoom<=9?1.8:zoom<=11?.75:zoom===12?.25:0;}
export function simplifyIndices(points,tolerance,protectedIndices=new Set()){
 if(points.length<=2||tolerance<=0)return points.map((_,i)=>i);
 const keep=new Set([0,points.length-1,...protectedIndices]),anchors=[...keep].sort((a,b)=>a-b),stack=[];
 for(let i=1;i<anchors.length;i++)stack.push([anchors[i-1],anchors[i]]);
 while(stack.length){const [start,end]=stack.pop(),a=points[start],b=points[end],dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;let distance=tolerance*tolerance,index=-1;
  for(let i=start+1;i<end;i++){const p=points[i],t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0,d=(p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2;if(d>distance){distance=d;index=i;}}
  if(index>=0){keep.add(index);stack.push([start,index],[index,end]);}
 }
 return [...keep].sort((a,b)=>a-b);
}
export function simplifySelection(topology,edges,project,tolerance){
 if(!project||!tolerance)return {topology,edges};
 const groups=new Map(),degrees=new Map();
 for(const [id,classes]of edges){const edge=topology.sections[id],key=edge[2]+'|'+[...classes].sort().join('|');if(!groups.has(key))groups.set(key,{classes,ids:[]});groups.get(key).ids.push(id);for(const node of edge.slice(0,2))degrees.set(node,(degrees.get(node)||0)+1);}
 const sections=[],result=new Map(),projected=new Map();
 const point=id=>{if(!projected.has(id))projected.set(id,project(topology.nodes[id]));return projected.get(id);};
 for(const group of groups.values()){
  const pending=new Set(group.ids),adjacent=new Map();
  for(const id of pending)for(const node of topology.sections[id].slice(0,2)){if(!adjacent.has(node))adjacent.set(node,[]);adjacent.get(node).push(id);}
  const walk=(start,first)=>{const path=[start];let node=start,edge=first;
   while(pending.has(edge)){pending.delete(edge);const [a,b]=topology.sections[edge];node=node===a?b:a;path.push(node);const neighbors=adjacent.get(node);if(neighbors.length!==2||degrees.get(node)!==2)break;edge=neighbors.find(id=>pending.has(id));}
   const indices=simplifyIndices(path.map(point),tolerance);
   for(let i=1;i<indices.length;i++){const a=path[indices[i-1]],b=path[indices[i]];if(a===b)continue;const index=sections.length;sections.push([a,b,topology.sections[first][2]]);result.set(index,group.classes);}
  };
  for(const [node,ids]of adjacent)if(ids.length!==2||degrees.get(node)!==2)for(const id of ids)if(pending.has(id))walk(node,id);
  for(const id of pending)walk(topology.sections[id][0],id);
 }
 return {topology:{nodes:topology.nodes,sections},edges:result};
}
