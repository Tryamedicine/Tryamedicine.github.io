/* Local SVG camera. All gesture listeners are scoped to the map viewport. */
(() => {
  'use strict';
  class RouteMapControls {
    constructor(element, onChange = () => {}) {
      this.element = element;
      this.onChange = onChange;
      this.pointers = new Map();
      this.zoom = 1; this.x = 0; this.y = 0;
      this.gestureActive = false;
      const bind = (type, fn) => element.addEventListener(type, fn, {passive:false});
      bind('pointerdown', e => {
        if (e.target?.closest?.('button')) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if(!this.pointers.size)this.didDrag=false;
        this.pointers.set(e.pointerId, this.local(e.clientX,e.clientY));
        element.setPointerCapture(e.pointerId);
        element.classList.add('dragging');
      });
      bind('pointermove', e => {
        if (!this.pointers.has(e.pointerId)) return;
        e.preventDefault();
        const before = [...this.pointers.values()];
        this.pointers.set(e.pointerId,this.local(e.clientX,e.clientY));
        const after = [...this.pointers.values()];
        if(before.length>1||Math.hypot(before[0].x-after[0].x,before[0].y-after[0].y)>5)this.didDrag=true;
        if (before.length === 1) {
          this.x += after[0].x-before[0].x;
          this.y += after[0].y-before[0].y;
        } else {
          const center = ps => ({x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2});
          const distance = ps => Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);
          const a=center(before), b=center(after);
          this.zoomAt(distance(after)/Math.max(distance(before),1),a,false);
          this.x += b.x-a.x; this.y += b.y-a.y;
        }
        this.draw();
      });
      const release = e => {
        this.pointers.delete(e.pointerId);
        if (!this.pointers.size) element.classList.remove('dragging');
      };
      for (const event of ['pointerup','pointercancel','lostpointercapture']) bind(event,release);
      element.addEventListener('click',e=>{if(this.didDrag){e.preventDefault();e.stopPropagation();}}, {capture:true});
      bind('wheel', e => {
        e.preventDefault();
        if (this.gestureActive) return;
        const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?570:1);
        this.zoomAt(Math.exp(-Math.max(-150,Math.min(150,pixels))*.006),this.local(e.clientX,e.clientY));
      });
      bind('dblclick',e=>{e.preventDefault();this.zoomAt(1.5,this.local(e.clientX,e.clientY));});
      // Safari's trackpad pinch uses GestureEvent; touch pinches use pointer events.
      bind('gesturestart',e=>{e.preventDefault();this.gestureActive=true;this.gestureScale=1;});
      bind('gesturechange',e=>{
        e.preventDefault();
        if(this.pointers.size<2)this.zoomAt(e.scale/this.gestureScale,this.local(e.clientX,e.clientY));
        this.gestureScale=e.scale;
      });
      bind('gestureend',e=>{e.preventDefault();this.gestureActive=false;});
      // Narrow Safari fallback: never disable browser zoom elsewhere on the page.
      bind('touchstart',e=>{if(e.touches.length>1)e.preventDefault();});
      bind('touchmove',e=>e.preventDefault());
      bind('keydown',e=>{
        if(e.key==='+'||e.key==='='){e.preventDefault();this.zoomAt(1.4);}
        else if(e.key==='-'){e.preventDefault();this.zoomAt(1/1.4);}
        else if(e.key==='0'||e.key==='Home'){e.preventDefault();this.reset();}
        else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
          e.preventDefault();this.x+=e.key==='ArrowLeft'?50:e.key==='ArrowRight'?-50:0;
          this.y+=e.key==='ArrowUp'?50:e.key==='ArrowDown'?-50:0;this.draw();
        }
      });
    }
    local(clientX,clientY) {
      const rect=this.element.getBoundingClientRect();
      const scale=Math.min(rect.width/900,rect.height/570);
      if(!Number.isFinite(clientX)||!Number.isFinite(clientY)||!scale)return {x:450,y:285};
      return {x:(clientX-rect.left-(rect.width-900*scale)/2)/scale,y:(clientY-rect.top-(rect.height-570*scale)/2)/scale};
    }
    zoomAt(factor,anchor={x:450,y:285},draw=true) {
      if(!Number.isFinite(factor)||factor<=0)return;
      const next=Math.max(1,Math.min(6,this.zoom*factor));
      const ratio=next/this.zoom;
      this.x=anchor.x-(anchor.x-this.x)*ratio;
      this.y=anchor.y-(anchor.y-this.y)*ratio;
      this.zoom=next;
      if(draw)this.draw();
    }
    reset() {
      this.zoom=1;this.x=0;this.y=0;this.pointers.clear();
      this.gestureActive=false;this.element.classList.remove('dragging');this.draw();
    }
    draw() {
      this.x=Math.max(900*(1-this.zoom),Math.min(0,this.x));
      this.y=Math.max(570*(1-this.zoom),Math.min(0,this.y));
      this.element.querySelector('#route-art')?.setAttribute('transform',`translate(${this.x} ${this.y}) scale(${this.zoom})`);
      this.onChange(this.zoom);
    }
  }
  window.RouteMapControls=RouteMapControls;
})();
