/* Nordic 2027 — static, shareable trip plan. No accounts or tracking. */
(() => {
  'use strict';
  const trip = window.TRIP;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shortDate = date => `${Number(date.slice(5,7))}/${Number(date.slice(8,10))}`;
  const money = n => n.toLocaleString('zh-CN');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colors = {sight:'#2c6c85',stay:'#927125',airport:'#153642',paid:'#7360a6'};
  let region = 'lofoten', date = 'all', toastTimer;
  const camera = new window.RouteMapControls($('map-stage'), zoom => {
    $('zoom-in').disabled=zoom>=6; $('zoom-out').disabled=zoom<=1;
    $('map-scale').textContent=Math.round(zoom*100)+'%';
  });
  const regionDays = () => trip.days.filter(d => d.region === region);
  const chosenDays = () => regionDays().filter(d => date === 'all' || d.date === date);
  const regionInfo = () => trip.regions.find(r => r.id === region);
  const place = id => trip.places[id];
  const localRoute = d => d.route.map(place).filter(p => p.region === region);

  function points() {
    const data = new Map();
    for (const day of chosenDays()) {
      for (const id of [...day.route,...day.optional,...day.stays]) {
        const p = place(id);
        if (!p || p.region !== region) continue;
        if (!data.has(id)) data.set(id,{...p,type:'sight',optional:true});
        const item = data.get(id);
        if (day.route.includes(id)) item.optional = false;
        if (day.stays.includes(id)) item.type = 'stay';
        if (p.category === 'airport') item.type = 'airport';
      }
      for (const id of day.activities) {
        const activity = trip.activities.find(a => a.id === id);
        if (!activity) continue;
        const p = place(activity.place);
        if (!p || p.region !== region) continue;
        if (!data.has(p.id)) data.set(p.id,{...p,type:'paid',optional:true});
        else if (data.get(p.id).type === 'sight') data.get(p.id).type = 'paid';
      }
    }
    return [...data.values()];
  }
  function routes() {
    return {type:'FeatureCollection',features:chosenDays().map(d => ({type:'Feature',properties:{date:d.date},geometry:{type:'LineString',coordinates:localRoute(d).map(p => [p.lng,p.lat])}})).filter(f => f.geometry.coordinates.length > 1)};
  }
  function renderTabs() {
    $('regions').innerHTML = trip.regions.map(r => `<button type="button" class="region-btn" data-region="${r.id}" aria-pressed="${r.id===region}"><span>${r.dates}</span><strong>${r.name}<em>${r.label}</em></strong></button>`).join('');
    $('day-tabs').innerHTML = `<button type="button" class="day-btn" data-date="all" aria-pressed="${date==='all'}">全部<span>完整路线</span></button>` + regionDays().map((d,i) => `<button type="button" class="day-btn" data-date="${d.date}" aria-pressed="${date===d.date}" title="${esc(d.title)}">${shortDate(d.date)}<span>Day ${i+1}</span></button>`).join('');
    $('map-overline').textContent = regionInfo().name.toUpperCase() + (date==='all' ? ' / 全部行程' : ' / '+shortDate(date));
    $('map-title').textContent = date==='all' ? regionInfo().title : chosenDays()[0].title;
  }
  function renderDetail() {
    const days = regionDays();
    if (date === 'all') {
      const r = regionInfo();
      $('day-detail').innerHTML = `<div class="detail-date"><span>${r.dates}</span><span>${days.length}天日程</span></div><h3>${r.label}</h3><p class="detail-intro">${r.intro}</p>` + days.map(d => `<button class="overview-day" type="button" data-date="${d.date}"><span>${shortDate(d.date)} · 全程 Day ${d.number}</span><strong>${esc(d.title)} ↗</strong><small>${d.number===13?'夜宿':'住'}：${esc(d.stay)}</small></button>`).join('');
    } else {
      const d = chosenDays()[0], index = days.indexOf(d);
      const options = d.optional.map(place).filter(p => p.region === region);
      const activities = d.activities.map(id => trip.activities.find(a => a.id===id)).filter(Boolean);
      $('day-detail').innerHTML = `<div class="detail-date"><span>2027.${d.date.slice(5).replace('-','.')}</span><span>全程 DAY ${d.number}</span></div><h3>${esc(d.title)}</h3><p class="detail-intro">${esc(d.intro)}</p><dl class="detail-facts"><div><dt>今晚</dt><dd>${esc(d.stay)}</dd></div><div><dt>${d.drive.includes('小时')?'驾驶':'交通'}</dt><dd>${esc(d.drive)}${d.drive.includes('小时')?'<small> · 粗估，不含游览</small>':''}</dd></div></dl><ol class="route-list">${localRoute(d).map((p,i)=>`<li><span>${i+1}</span>${esc(p.label)}</li>`).join('')}</ol>${options.length?`<p class="activity-copy"><strong>有余力再去</strong>${options.map(p=>esc(p.label)).join(' · ')}</p>`:''}${activities.length?`<p class="activity-copy"><strong>可选付费体验 · 待预订</strong>${activities.map(a=>esc(a.name)).join(' / ')}</p>`:''}<p class="day-tip">${esc(d.tip)}</p><div class="day-pager"><button type="button" data-date="${days[index-1]?.date||''}" ${index===0?'disabled':''}>← 前一天</button><button type="button" data-date="all">区域总览</button><button type="button" data-date="${days[index+1]?.date||''}" ${index===days.length-1?'disabled':''}>后一天 →</button></div>`;
    }
    $('day-detail').scrollTop = 0;
  }
  function renderStatic() {
    $('full-itinerary').innerHTML = trip.days.map(d=>`<div class="schedule-row"><time datetime="${d.date}">${shortDate(d.date)}</time>${d.region==='return'?`<span>${esc(d.title)}</span>`:`<button type="button" data-jump="${d.region}/${d.date}">${esc(d.title)} ↗</button>`}<span class="stay-note">${d.number===14?'抵达':'夜宿'} · ${esc(d.stay)}</span></div>`).join('');
    $('budget-lines').innerHTML = trip.budget.map(b=>`<div class="budget-row"><span>${esc(b.name)}</span><strong>¥${money(b.low)}${b.low!==b.high?'–'+money(b.high):''}</strong></div>`).join('');
    const groups = [
      {title:'1月30日 · 上海 → 斯德哥尔摩',fare:'国际往返主票 ¥6,842 / 人',ids:[0,1]},
      {title:'2月1日 · 斯德哥尔摩 → EVE',fare:'¥877 / 人 · 经奥斯陆',ids:[2,3]},
      {title:'2月5日 · EVE → 冰岛',fare:'¥1,456 / 人 · 奥斯陆中转70分钟',ids:[4,5]},
      {title:'2月11–12日 · 冰岛 → 上海',fare:'已包含在国际主票内',ids:[6,7,8]}
    ];
    $('flights').innerHTML = groups.map(g=>`<div class="flight-group"><div><h3>${g.title}</h3><p class="fare">${g.fare}</p></div><div class="flight-segments">${g.ids.map(i=>{
      const f=trip.flights.segments[i];
      return `<div class="flight-segment"><small>${shortDate(f.departure_date)} · ${f.flight_number}</small><strong>${f.origin} → ${f.destination}</strong><p>${f.departure_time} — ${f.arrival_time}${f.arrival_date!==f.departure_date?' <small>次日</small>':''}</p></div>`;
    }).join('')}</div></div>`).join('');
  }

  // Local coastline schematic. Route segments show stop order, not road geometry.
  const mercY = lat => Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))*180/Math.PI;
  function renderFallback() {
    const pts = points(), w = 900, h = 570;
    const rect=$('map-stage').getBoundingClientRect();
    const ui=1/Math.min((rect.width||900)/w,(rect.height||570)/h);
    let minX=Math.min(...pts.map(p=>p.lng)),maxX=Math.max(...pts.map(p=>p.lng));
    let minY=Math.min(...pts.map(p=>mercY(p.lat))),maxY=Math.max(...pts.map(p=>mercY(p.lat)));
    const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    const scale=Math.min((w-180)/Math.max(maxX-minX,.035),(h-145)/Math.max(maxY-minY,.035));
    const project=(lng,lat)=>[w/2+(lng-cx)*scale,h/2-(mercY(lat)-cy)*scale];
    const pair=p=>project(p[0],p[1]).map(v=>v.toFixed(1)).join(',');
    let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(regionInfo().label)}当前行程地理示意图"><g id="route-art">`;
    svg += `<g fill="#f8faf7" stroke="#c3d3d8" stroke-width="1">${(window.GEOGRAPHY?.[region]||[]).map(r=>`<path d="M${r.map(pair).join('L')}Z"/>`).join('')}</g>`;
    svg += routes().features.map(f=>`<polyline points="${f.geometry.coordinates.map(pair).join(' ')}" fill="none" stroke="#2c6c85" stroke-width="3" stroke-dasharray="7 6" opacity=".8"/>`).join('');
    const occupied=[];
    pts.forEach((p,i)=>{
      const [x,y]=project(p.lng,p.lat),color=colors[p.type],radius=5*ui;
      svg+=`<g><title>${esc(p.label)}</title>${p.type==='stay'?`<rect x="${x-radius}" y="${y-radius}" width="${radius*2}" height="${radius*2}" rx="${2*ui}"`:`<circle cx="${x}" cy="${y}" r="${radius}"`} fill="${color}" stroke="white" stroke-width="${1.5*ui}"/>`;
      const important=p.type==='airport'||p.type==='stay'||date!=='all';
      if(important||i%3===0){
        const label=p.name.length>19?p.name.slice(0,18)+'…':p.name,tw=(label.length*6.4+12)*ui;
        const left=x>w-tw-20*ui;const tx=Math.max(8,left?x-tw-10*ui:x+10*ui);
        let ty=y-8*ui;
        for(let n=0;n<5;n++){
          if(!occupied.some(o=>Math.abs(o[1]-ty)<21*ui && tx<o[0]+o[2] && tx+tw>o[0])) break;
          ty+=21*ui;
        }
        if(ty<h-30*ui){occupied.push([tx,ty,tw]);svg+=`<rect x="${tx}" y="${ty-2*ui}" width="${tw}" height="${21*ui}" rx="${3*ui}" fill="#ffffffed"/><text x="${tx+6*ui}" y="${ty+13*ui}" font-size="${12*ui}" font-family="system-ui,sans-serif" fill="#153642">${esc(label)}</text>`;}
      }
      svg+='</g>';
    });
    svg+='</g><text x="875" y="32" text-anchor="end" font-size="13" fill="#536975" font-family="system-ui,sans-serif">N ↑</text><text x="884" y="557" text-anchor="end" font-size="10" fill="#536975" font-family="system-ui,sans-serif">Natural Earth · 地点与路线示意</text></svg>';
    $('fallback-map').innerHTML=svg;
    camera.reset();
  }

  function choose(nextRegion,nextDate='all',writeHash=true) {
    if(!trip.regions.some(r=>r.id===nextRegion))return;
    region=nextRegion;
    date=trip.days.some(d=>d.region===region&&d.date===nextDate)?nextDate:'all';
    renderTabs();renderDetail();renderFallback();
    if(writeHash)history.replaceState(null,'',`#${region}${date==='all'?'':'/'+date}`);
  }
  function readHash() {
    const [r,d]=location.hash.slice(1).split('/');
    if(trip.regions.some(x=>x.id===r))choose(r,d||'all',false);
  }
  $('regions').addEventListener('click',e=>{const b=e.target.closest('[data-region]');if(b)choose(b.dataset.region);});
  for(const id of ['day-tabs','day-detail'])$(id).addEventListener('click',e=>{const b=e.target.closest('[data-date]');if(b&&!b.disabled){choose(region,b.dataset.date);$('day-tabs').querySelector('[aria-pressed="true"]')?.scrollIntoView({block:'nearest',inline:'nearest',behavior:reduced?'instant':'smooth'});}});
  $('full-itinerary').addEventListener('click',e=>{const b=e.target.closest('[data-jump]');if(b){choose(...b.dataset.jump.split('/'));$('itinerary').scrollIntoView({behavior:reduced?'instant':'smooth'});}});
  $('reset-map').addEventListener('click',()=>camera.reset());
  $('zoom-in').addEventListener('click',()=>camera.zoomAt(1.4));
  $('zoom-out').addEventListener('click',()=>camera.zoomAt(1/1.4));
  function showToast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>{$('toast').hidden=true;},3200);}
  function shareURL(){return location.protocol==='file:'?'https://tryamedicine.github.io/nordic-2027/'+location.hash:location.href;}
  async function copyLink(){
    try{await navigator.clipboard.writeText(shareURL());showToast('链接已复制，发给朋友一起看。');return true;}catch(_){return false;}
  }
  $('share').addEventListener('click',async()=>{
    if(navigator.share){try{await navigator.share({title:'2027 北欧冬日行',text:'14天，斯德哥尔摩 → 罗弗敦 → 冰岛。我们的春节旅行计划。',url:shareURL()});return;}catch(e){if(e.name==='AbortError')return;}}
    if(await copyLink())return;
    $('share-link').value=shareURL();$('share-dialog').showModal();$('share-link').select();
  });
  $('copy-link').addEventListener('click',async()=>{if(await copyLink())$('share-dialog').close();else{$('share-link').select();showToast('请长按或手动复制上方链接。');}});
  window.addEventListener('hashchange',readHash);
  renderStatic();
  const initial=location.hash.slice(1).split('/');
  choose(trip.regions.some(r=>r.id===initial[0])?initial[0]:'lofoten',initial[1]||'all',false);
})();
