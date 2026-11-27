export function clampPanelPosition(x,y,width,height,containerWidth,containerHeight,margin=8){
 return {x:Math.max(margin,Math.min(x,Math.max(margin,containerWidth-width-margin))),y:Math.max(margin,Math.min(y,Math.max(margin,containerHeight-height-margin)))};
}
export function makeDraggablePanel(panel,handle,container){
 let drag=null,moved=false;
 const place=(x,y)=>{const p=clampPanelPosition(x,y,panel.offsetWidth,panel.offsetHeight,container.clientWidth,container.clientHeight);Object.assign(panel.style,{left:p.x+'px',top:p.y+'px',right:'auto',bottom:'auto'});};
 const current=()=>{const p=panel.getBoundingClientRect(),c=container.getBoundingClientRect();return {x:p.left-c.left,y:p.top-c.top};};
 handle.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.target.closest('button'))return;
  const p=current();drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:p.x,top:p.y};moved=true;
  handle.setPointerCapture(event.pointerId);panel.classList.add('dragging');event.preventDefault();event.stopPropagation();
 });
 handle.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;place(drag.left+event.clientX-drag.x,drag.top+event.clientY-drag.y);event.preventDefault();event.stopPropagation();});
 const end=event=>{if(!drag||event.pointerId!==drag.id)return;if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);drag=null;panel.classList.remove('dragging');};
 handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);handle.addEventListener('lostpointercapture',()=>{drag=null;panel.classList.remove('dragging');});
 handle.addEventListener('keydown',event=>{if(event.target!==handle)return;const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!delta)return;event.preventDefault();event.stopPropagation();const p=current(),step=event.shiftKey?1:10;moved=true;place(p.x+delta[0]*step,p.y+delta[1]*step);});
 const fit=()=>{if(!panel.hidden&&moved){const p=current();place(p.x,p.y);}};
 const observer=new ResizeObserver(fit);observer.observe(container);observer.observe(panel);
 return {fit};
}
