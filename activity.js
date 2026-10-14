/* Aid Room aggregate activity tracking. Never pass raw user input or location data. */
(function () {
  'use strict';
  const page = /maps\.html$/.test(location.pathname) ? 'maps' : 'navigator';
  const allowed = new Set(['resource_id','resource_category','action_type','search_topic','result_band','zip_filter','filter_type','filter_value','travel_mode','distance_band','duration_band','error_type','feature','count']);
  const events = new Set(['tool_open','resource_visible','resource_action','directory_search','directory_filter','directory_feature','map_search','route_request','route_success','route_error','map_feature']);
  window.aidActivity = function (name, values = {}) {
    try {
      if (!events.has(name) || typeof window.gtag !== 'function') return;
      const data = {tool_page: page, tracking_version:'1', page_location:location.origin + location.pathname, page_referrer:''};
      for (const [key,value] of Object.entries(values)) {
        if (allowed.has(key) && (typeof value === 'number' || typeof value === 'string')) data[key] = typeof value === 'string' ? value.slice(0,80) : value;
      }
      window.gtag('event',name,data);
    } catch (_) { /* Analytics must never interrupt access to help. */ }
  };
  const emit=window.aidActivity;
  emit('tool_open');
  if(page==='maps') {
    document.addEventListener('click',e=>{
      const b=e.target.closest('button');
      if(b && ['locate','swap','clearRoute','print','home','fitPins'].includes(b.id)) emit('map_feature',{feature:b.id});
    },true);
    document.getElementById('mode')?.addEventListener('change',e=>emit('map_feature',{feature:'travel_mode',travel_mode:e.target.value}));
    document.getElementById('searchForm')?.addEventListener('submit',()=>emit('map_search'));
    return;
  }
  const seen = new Set();
  const observer = new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(!entry.isIntersecting || document.visibilityState==='hidden') return;
    const card=entry.target, id=card.querySelector('[data-open]')?.dataset.open;
    if(id && !seen.has(id)) {seen.add(id);emit('resource_visible',{resource_id:id,resource_category:card.querySelector('.category-tag')?.textContent || ''});}
  }),{threshold:0.5});
  const results=document.getElementById('results');
  function observeCards(){observer.disconnect();results.querySelectorAll('.card').forEach(c=>observer.observe(c));}
  observeCards();
  new MutationObserver(observeCards).observe(results,{childList:true});
  function context(el) {
    const box=el.closest('.card') || el.closest('#detailDialog');
    return {resource_id:el.dataset.open || el.dataset.save || el.dataset.mapResource || box?.querySelector('[data-open]')?.dataset.open || box?.dataset.resource || '',resource_category:box?.querySelector('.category-tag')?.textContent || ''};
  }
  document.addEventListener('click',e=>{
    const el=e.target.closest('a,button');if(!el)return;
    const c=context(el);let action='';
    if(el.dataset.mapResource)action='maps';else if(el.dataset.open)action='details';else if(el.dataset.save)action=el.getAttribute('aria-pressed')==='true' || /Remove/.test(el.textContent)?'unsave':'save';
    else if(c.resource_id && el.tagName==='A') {const href=el.getAttribute('href')||'';action=href.startsWith('tel:')?'call':href.startsWith('mailto:')?'email':/^https?:/.test(href)?'website':'';}
    if(action)emit('resource_action',{...c,action_type:action});
    if(['loadMore','shortlistButton','copyShortlist','clearShortlist','clearFilters','emptyClear'].includes(el.id))emit('directory_feature',{feature:el.id});
  },true);
  function topic(text) {
    const q=text.toLowerCase();
    const topics=[['housing',/shelter|hous|homeless|rent/],['food',/food|meal|pantry|hunger/],['mental_health',/mental|counsel|therapy|crisis/],['recovery',/recover|substance|addiction|detox|sober/],['healthcare',/health|medical|dental|doctor/],['transportation',/transport|bus|ride/],['benefits',/benefit|snap|medicaid|disability/],['legal',/legal|lawyer|court/],['employment',/job|employ|work/]];
    return !q.trim()?'browse':topics.find(x=>x[1].test(q))?.[0] || 'other';
  }
  let timer;
  function search() {clearTimeout(timer);timer=setTimeout(function recordSearch(){
    if(results.parentElement?.getAttribute('aria-busy')==='true'){timer=setTimeout(recordSearch,250);return;}
    const n=parseInt(document.getElementById('resultCount').textContent,10);
    if(!Number.isFinite(n))return;
    emit('directory_search',{search_topic:topic(document.getElementById('searchInput').value),result_band:n===0?'zero':n<=10?'1-10':n<=50?'11-50':n<=200?'51-200':'201+',zip_filter:/^\d{5}$/.test(document.getElementById('zipFilter').value)?document.getElementById('zipFilter').value:'none'});
  },900);}
  document.getElementById('searchInput').addEventListener('input',search);
  document.getElementById('quickChips').addEventListener('click',search);
  for(const id of ['categoryFilter','areaFilter','zipFilter','freeFilter','openFilter','sortSelect']) {
    document.getElementById(id).addEventListener(id==='zipFilter'?'input':'change',e=>{
      if(id==='zipFilter' && !/^\d{5}$/.test(e.target.value) && e.target.value!=='')return;
      emit('directory_filter',{filter_type:id,filter_value:e.target.type==='checkbox'?String(e.target.checked):e.target.value || 'all'});search();
    });
  }
})();
