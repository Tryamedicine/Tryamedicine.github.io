/* OpenFreeMap renderer, with an independently usable local fallback. */
(() => {
  'use strict';
  class TravelMap {
    constructor({camera,onPlace,onResize}) {
      this.camera=camera;this.onPlace=onPlace;this.onResize=onResize;
      this.points=[];this.markers=[];this.ready=false;this.failed=false;this.manual=false;
      this.$=id=>document.getElementById(id);
      this.init();
      this.$('map-mode-toggle').addEventListener('click',()=>{
        if(this.failed){this.map?.remove();this.map=null;this.failed=false;this.ready=false;this.manual=false;this.init();}
        else this.manual=!this.manual;
        this.visibility();this.fit(false);
      });
      this.$('map-fullscreen').addEventListener('click',()=>this.expanded?this.exit():this.enter());
      document.addEventListener('fullscreenchange',()=>{
        if(document.fullscreenElement===this.$('map-workspace'))this.nativeEntered=true;
        else if(this.nativeEntered){this.nativeEntered=false;this.collapse();}
      });
      document.addEventListener('keydown',e=>{
        if(!this.expanded||this.$('place-dialog').open)return;
        if(e.key==='Escape'){e.preventDefault();this.exit();}
        if(e.key==='Tab'){
          const focusable=[...this.$('map-workspace').querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')].filter(x=>x.getClientRects().length&&!x.closest('[inert]'));
          const first=focusable[0],last=focusable.at(-1);
          if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
          else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
        }
      });
      if(window.ResizeObserver)new ResizeObserver(()=>{
        this.map?.resize();if(!this.visible())this.onResize?.();
      }).observe(this.$('map-stage'));
    }
    visible(){return this.ready&&!this.failed&&!this.manual;}
    visibility(){
      const visible=this.visible();
      this.$('map').classList.toggle('ready',visible);
      this.$('map').inert=!visible;
      this.$('map').style.pointerEvents=visible?'auto':'none';
      this.$('map').setAttribute('aria-hidden',String(!visible));
      this.$('fallback-map').inert=visible;
      this.$('fallback-map').setAttribute('aria-hidden',String(visible));
      this.$('map-status').textContent=visible?'OpenFreeMap':'路线示意';
      this.$('map-mode-toggle').textContent=this.failed?'重试底图':visible?'示意图':'真实底图';
      this.$('map-scale').hidden=visible;
      this.$('zoom-in').disabled=visible?false:this.camera.zoom>=6;
      this.$('zoom-out').disabled=visible?false:this.camera.zoom<=1;
    }
    init(){
      this.loaded=false;
      if(!window.maplibregl){this.failed=true;this.visibility();return;}
      try{
        this.map=new maplibregl.Map({container:'map',style:'./assets/map-style.json',center:[14,68.1],zoom:5,attributionControl:false,dragRotate:false,touchPitch:false,pitchWithRotate:false,cooperativeGestures:false});
        this.map.touchZoomRotate.disableRotation();
        this.map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
        this.map.on('load',()=>{
          this.loaded=true;
          this.map.addSource('trip-routes',{type:'geojson',data:this.routes||{type:'FeatureCollection',features:[]}});
          this.map.addLayer({id:'trip-route-lines',type:'line',source:'trip-routes',paint:{'line-color':'#2c6c85','line-width':3,'line-dasharray':[2,2],'line-opacity':.85}});
          this.draw();this.fit(false);
        });
        this.map.on('idle',()=>{if(!this.failed&&this.loaded){this.ready=true;this.visibility();}});
        this.map.on('error',()=>{this.failed=true;this.visibility();});
        this.map.on('webglcontextlost',()=>{this.failed=true;this.visibility();});
        // Safari trackpad gestures are not allowed to magnify the page.
        if(!this.gestureBound){
        this.gestureBound=true;
        const el=this.$('map');let lastScale=1,touches=0;
        el.addEventListener('touchstart',e=>{touches=e.touches.length;if(touches>1)e.preventDefault();},{passive:false});
        el.addEventListener('touchend',e=>{touches=e.touches.length;},{passive:true});
        el.addEventListener('gesturestart',e=>{e.preventDefault();lastScale=1;},{passive:false});
        el.addEventListener('gesturechange',e=>{
          e.preventDefault();if(touches<2&&this.visible())this.map.jumpTo({zoom:this.map.getZoom()+Math.log2(e.scale/lastScale)});lastScale=e.scale;
        },{passive:false});
        el.addEventListener('gestureend',e=>e.preventDefault(),{passive:false});
        }
      }catch(_){this.failed=true;}
      this.visibility();
    }
    update(points,routes){this.points=points;this.routes=routes;this.draw();this.fit();this.visibility();}
    draw(){
      if(!this.loaded||this.failed)return;
      this.map.getSource('trip-routes')?.setData(this.routes);
      this.markers.forEach(m=>m.remove());this.markers=[];
      this.points.forEach(p=>{
        const el=document.createElement('button');el.className='place-marker';el.type='button';el.dataset.type=p.type;
        el.setAttribute('aria-label','查看'+p.label+'介绍');
        const dot=document.createElement('span');dot.className='place-dot';dot.textContent=p.type==='airport'?'✈':p.type==='stay'?'⌂':p.type==='paid'?'◇':'';el.appendChild(dot);
        if(p.type==='airport'||p.type==='stay'||this.points.length<10){const label=document.createElement('span');label.className='marker-label';label.textContent=p.name;el.appendChild(label);}
        el.addEventListener('click',()=>this.onPlace(p.id));
        this.markers.push(new maplibregl.Marker({element:el}).setLngLat([p.lng,p.lat]).addTo(this.map));
      });
    }
    fit(animate=true){
      if(!this.loaded||this.failed||!this.points.length)return;
      const bounds=new maplibregl.LngLatBounds();this.points.forEach(p=>bounds.extend([p.lng,p.lat]));
      this.map.stop();this.map.fitBounds(bounds,{padding:65,maxZoom:13,duration:animate&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches?750:0});
    }
    reset(){if(this.visible())this.fit();else this.camera.reset();}
    zoomBy(factor){if(this.visible())this.map.zoomTo(this.map.getZoom()+Math.log2(factor),{duration:180});else this.camera.zoomAt(factor);}
    async enter(){
      if(this.expanded)return;
      this.expanded=true;this.previousFocus=document.activeElement;this.oldOverflow=document.body.style.overflow;
      document.body.style.overflow='hidden';
      const workspace=this.$('map-workspace');workspace.classList.add('is-expanded');
      workspace.setAttribute('role','dialog');workspace.setAttribute('aria-modal','true');
      this.$('map-fullscreen').textContent='退出全屏 ⤡';this.$('map-fullscreen').setAttribute('aria-expanded','true');
      this.$('map-fullscreen').focus();this.map?.resize();this.fit(false);
      // iPhone and embedded browsers retain the full-viewport layout if native fullscreen is unavailable.
      try{if(workspace.requestFullscreen)await workspace.requestFullscreen();}catch(_){}
    }
    async exit(){
      if(document.fullscreenElement===this.$('map-workspace')){try{await document.exitFullscreen();}catch(_){}}
      this.collapse();
    }
    collapse(){
      if(!this.expanded)return;
      this.expanded=false;this.nativeEntered=false;
      const workspace=this.$('map-workspace');workspace.classList.remove('is-expanded');workspace.removeAttribute('role');workspace.removeAttribute('aria-modal');
      document.body.style.overflow=this.oldOverflow;
      this.$('map-fullscreen').textContent='全屏地图 ⤢';this.$('map-fullscreen').setAttribute('aria-expanded','false');
      this.map?.resize();this.fit(false);this.previousFocus?.focus();
    }
  }
  window.TravelMap=TravelMap;
})();
