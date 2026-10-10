const state={resources:[],filtered:[],shown:16,query:"",category:"",area:"",zip:"",free:false,open:false,sort:"relevance",saved:new Set(JSON.parse(localStorage.getItem("aidroom-shortlist")||"[]"))};
const $=s=>document.querySelector(s);const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const labels={"resource category":"Resource category","organization name":"Organization","program name":"Program","service summary":"Service summary","detailed services":"Services","population served":"Who it serves","geographic service area":"Service area","county or counties served":"Counties served","physical address":"Address","primary phone number":"Phone","crisis/after-hours number":"Crisis / after-hours","text number":"Text","official website":"Website","direct program link":"Program link","hours of operation":"Hours","access method":"How to access","eligibility":"Eligibility","required documents":"Documents needed","fees":"Cost","insurance accepted":"Insurance","availability for uninsured":"Uninsured clients","languages":"Languages","accessibility":"Accessibility","transportation access":"Transportation","response times":"Response time","restrictions":"Restrictions","currently active":"Current status","important note":"Important note","date verified":"Date verified","citation":"Source","source":"Source","verification status":"Verification status","faith-based":"Faith-based"};
const quick=["Emergency & crisis","Shelter","Food","Mental health","Recovery","Benefits","Legal help","Transportation"];
function tokenize(q){return q.toLowerCase().replace(/[^a-z0-9+]+/g," ").trim().split(/\s+/).filter(x=>x.length>1)}
function score(r,tokens){if(!tokens.length)return 1;let n=0;for(const t of tokens){if(r.title.toLowerCase().includes(t))n+=12;if(r.category.toLowerCase().includes(t))n+=8;if(r.summary.toLowerCase().includes(t))n+=6;const hits=(r.searchText.match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"g"))||[]).length;n+=Math.min(hits,8)}return n}
function tel(v){return v.replace(/[^\d+]/g,"")}
function cleanUrl(v){let u=v.replace(/[),.;]+$/g,"");return /^https?:\/\//i.test(u)?u:`https://${u}`}
function toast(msg){const e=$("#toast");e.textContent=msg;e.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove("show"),1800)}
function saveState(){localStorage.setItem("aidroom-shortlist",JSON.stringify([...state.saved]));$("#shortlistCount").textContent=state.saved.size}
function toggleSaved(id){state.saved.has(id)?state.saved.delete(id):state.saved.add(id);saveState();render();toast(state.saved.has(id)?"Added to referral list":"Removed from referral list")}
function clearAll(){state.query=state.category=state.area=state.zip="";state.free=state.open=false;state.shown=16;$("#searchInput").value="";$("#categoryFilter").value="";$("#areaFilter").value="";$("#zipFilter").value="";updateZipHelp();$("#freeFilter").checked=false;$("#openFilter").checked=false;document.querySelectorAll(".chip").forEach(c=>c.setAttribute("aria-pressed","false"));apply()}
function zipMatches(r,zip){if(!zip)return true;const f=r.fields;const rawCoverage=f["geographic service area"]||"";const coverage=/search area|verify provider coverage/i.test(rawCoverage)?"":rawCoverage;const listed=[f["physical address"]||"",coverage].join(" ");const matches=[...listed.matchAll(/\b(\d{5})(?:-\d{4})?\b/g)].map(m=>m[1]);return matches.includes(zip)||/\bstatewide\b|\ball colorado\b|\bacross colorado\b|\bnationwide\b|\bnational\b|\bunited states\b/i.test(coverage)}
function updateZipHelp(){const raw=$("#zipFilter").value.trim();const invalid=raw!==""&&!/^\d{5}$/.test(raw);$("#zipFilter").setAttribute("aria-invalid",String(invalid));$("#zipHelp").textContent=invalid?"Enter a complete five-digit ZIP code to filter results.":"Matches addresses and listed service ZIPs, plus statewide and nationwide services. Nearby ZIPs and unlisted coverage are not included."}
function apply(){const terms=tokenize(state.query);state.filtered=state.resources.map(r=>({...r,_score:score(r,terms)})).filter(r=>(!terms.length||r._score>0)&&(!state.category||String(r.categoryNumber)===state.category)&&(!state.area||r.searchText.includes(state.area.toLowerCase()))&&zipMatches(r,state.zip)&&(!state.free||/\bfree\b|no fee|without charge/.test(r.searchText))&&(!state.open||/24\s*\/\s*7|24 hours|24\/7\/365/.test(r.searchText)));if(state.sort==="title")state.filtered.sort((a,b)=>a.title.localeCompare(b.title));else if(state.sort==="category")state.filtered.sort((a,b)=>a.categoryNumber-b.categoryNumber||a.title.localeCompare(b.title));else state.filtered.sort((a,b)=>b._score-a._score||a.number-b.number);render()}
function mapAddress(r){
 const raw=(r.fields['physical address']||'').trim();
 if(!raw||/confidential|no physical|not (?:available|confirmed|provided|stated|listed|specified)|unknown|state\s*wide|nation\s*wide|online only|virtual only/i.test(raw))return '';
 for(const part of raw.split(/[;\n]/)){
  if(/\bP\.?\s*O\.?\s*Box\b|\bPost Office Box\b|mailing|client services NOT offered|\bvaries\b/i.test(part))continue;
  const match=part.match(/\b\d{1,6}[a-z]?(?:-\d+)?\s+(?:(?:[NSEW]\.?|North|South|East|West)\s+)?(?:[\w.'-]+\s+){0,6}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Highway|Hwy|Parkway|Pkwy|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl|Way|Circle|Cir|Trail|Trl|Terrace|Ter|Broadway)\b[^;\n]*/i);
  if(match)return match[0].trim();
 }
 return '';
}
const MAP_GEOCODING_KEY="95b8b4ee8f2b42c685a7cd99d2872b8c";
const mapChecks=new Map();
let activeMapChecks=0;const mapCheckQueue=[];
async function mapCheckSlot(){if(activeMapChecks>=2)await new Promise(resolve=>mapCheckQueue.push(resolve));activeMapChecks++}
function releaseMapCheck(){activeMapChecks--;mapCheckQueue.shift()?.()}
function mapMatch(item,address){
 const number=address.match(/^\d+[a-z]?(?:-\d+)?/i)?.[0].toLowerCase();
 const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const street=address.split(',')[0].replace(/\b(?:suite|ste|unit|floor|fl)\.?\s+.*$/i,'');
 const words=street.toLowerCase().match(/[a-z0-9]+/g)||[];
 const returned=normalize(item.street);
 const distinctive=words.filter(w=>w!==number&&!/^(n|s|e|w|north|south|east|west|st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|way|place|pl|ct|court|ln|lane|pkwy|parkway|hwy|highway|cir|circle|trail|trl|terrace|ter)$/.test(w));
 const zip=address.match(/\b\d{5}(?:-\d{4})?\b/)?.[0].slice(0,5);
 return !!number&&normalize(item.housenumber)===normalize(number)&&!!returned&&distinctive.length>0&&distinctive.every(w=>returned.includes(normalize(w)))&&(!zip||String(item.postcode||'').slice(0,5)===zip)&&Number.isFinite(item.lon)&&Number.isFinite(item.lat)&&Math.abs(item.lon)<=180&&Math.abs(item.lat)<=90;
}
async function checkMapAddress(address){
 if(mapChecks.has(address))return mapChecks.get(address);
 const task=(async()=>{
  try{
   const storageKey='aidroom-map-pin-v2:'+address;
   let cached;try{cached=JSON.parse(localStorage.getItem(storageKey)||'null')}catch{}
   if(cached&&Date.now()-cached.time<30*86400000&&mapMatch(cached.place,address))return cached.place;
   const query=address.replace(/\([^)]*\)/g,'').replace(/\b(?:suite|ste|unit|floor|fl)\.?\s+[A-Za-z0-9-]+,?/gi,'').trim();
   const url=new URL('https://api.geoapify.com/v1/geocode/search');
   url.search=new URLSearchParams({text:query,limit:'3',format:'json',apiKey:MAP_GEOCODING_KEY});
   await mapCheckSlot();let response;try{response=await fetch(url,{signal:AbortSignal.timeout(12000)})}finally{releaseMapCheck()}
   if(!response.ok)return null;
   const place=((await response.json()).results||[]).find(item=>mapMatch(item,address))||null;
   if(place)try{localStorage.setItem(storageKey,JSON.stringify({time:Date.now(),place}))}catch{}
   return place;
  }catch{return null}
 })();mapChecks.set(address,task);return task;
}
function mapsUrl(r,place){const params=new URLSearchParams({name:r.title,address:mapAddress(r),lat:place.lat,lon:place.lon});return 'maps.html?v=3#'+params.toString()}
function mapsSection(r){const address=mapAddress(r);return address?'<section class="maps-section" aria-label="Maps"><p><strong>Address:</strong> '+esc(address)+'</p><span data-map-check="'+esc(r.id)+'"></span></section>':''}
let mapObserver;
function hydrateMaps(){
 mapObserver?.disconnect();
 mapObserver=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;const node=entry.target;mapObserver.unobserve(node);const r=state.resources.find(x=>x.id===node.dataset.mapCheck);if(!r)continue;checkMapAddress(mapAddress(r)).then(place=>{if(!place||!node.isConnected)return;node.innerHTML='<h3>Maps</h3><a href="'+esc(mapsUrl(r,place))+'" data-map-resource="'+esc(r.id)+'">Open in Maps</a>'})}},{rootMargin:'200px'});
 document.querySelectorAll('[data-map-check]').forEach(node=>mapObserver.observe(node));
}
function card(r){const phone=r.phones[0],email=r.emails[0],url=r.urls[0];return `<article class="card"><div class="card-top"><span class="category-tag">${esc(r.category)}</span><button class="save-button" type="button" data-save="${r.id}" aria-label="${state.saved.has(r.id)?"Remove from":"Add to"} saved resources" aria-pressed="${state.saved.has(r.id)}">${state.saved.has(r.id)?"★":"☆"}</button></div><h2>${esc(r.title)}</h2><p>${esc(r.summary||"Open the resource profile for access, eligibility, and contact details.")}</p><div class="meta"><span>Resource ${r.number}</span>${r.fields["geographic service area"]?`<span>${esc(r.fields["geographic service area"].slice(0,54))}</span>`:""}${phone?`<span>${esc(phone)}</span>`:""}${email?`<span>${esc(email)}</span>`:""}<span>Verified</span></div><div class="card-actions">${phone?`<a href="tel:${tel(phone)}">Call</a>`:""}${email?`<a class="secondary" href="mailto:${esc(email)}">Email</a>`:""}${url?`<a class="secondary" href="${esc(cleanUrl(url))}" target="_blank" rel="noopener">Website</a>`:""}<button class="secondary" type="button" data-open="${r.id}">Details</button></div>${mapsSection(r)}</article>`}
function render(){const shown=state.filtered.slice(0,state.shown);$("#results").innerHTML=shown.map(card).join("");$("#resultCount").textContent=`${state.filtered.length} resource${state.filtered.length===1?"":"s"}`;const bits=[];if(state.query)bits.push(`matching “${state.query}”`);if(state.category)bits.push($("#categoryFilter").selectedOptions[0].text);if(state.area)bits.push(state.area);if(state.zip)bits.push(`ZIP ${state.zip} and statewide / nationwide services`);$("#activeSummary").textContent=bits.join(" · ");$("#loadMore").hidden=shown.length>=state.filtered.length;$("#emptyState").hidden=state.filtered.length>0;$(".results-section").setAttribute("aria-busy","false");saveState();hydrateMaps()}
function showDetail(id){const r=state.resources.find(x=>x.id===id);if(!r)return;const excluded=new Set(["resource category","service summary"]);const fields=Object.entries(r.fields).filter(([k,v])=>v&&!excluded.has(k));const phone=r.phones[0],email=r.emails[0],url=r.urls[0];$("#detailContent").innerHTML=`<div class="dialog-head"><span class="category-tag">${esc(r.category)}</span><h2>${esc(r.title)}</h2><p>Resource ${r.number} · Verified</p><button class="close-dialog" type="button" aria-label="Close">×</button></div><div class="dialog-body"><p class="dialog-summary">${esc(r.summary)}</p><div class="dialog-actions">${phone?`<a href="tel:${tel(phone)}">Call ${esc(phone)}</a>`:""}${email?`<a class="secondary" href="mailto:${esc(email)}">Email</a>`:""}${url?`<a class="secondary" href="${esc(cleanUrl(url))}" target="_blank" rel="noopener">Open website</a>`:""}<button class="secondary" type="button" data-save="${r.id}">${state.saved.has(r.id)?"Remove from":"Add to"} referral list</button></div>${mapsSection(r)}<dl class="field-grid">${fields.map(([k,v])=>`<dt>${esc(labels[k]||k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>`;$("#detailDialog").dataset.resource=id;$("#detailDialog").showModal();hydrateMaps()}
function showShortlist(){const rs=state.resources.filter(r=>state.saved.has(r.id));$("#shortlistContent").innerHTML=`<div class="dialog-head"><span class="category-tag">Your selections</span><h2>Saved resources</h2><p>${rs.length} saved resource${rs.length===1?"":"s"}</p><button class="close-dialog" type="button" aria-label="Close">×</button></div><div class="dialog-body">${rs.length?rs.map(r=>`<div class="shortlist-item"><div><strong>${esc(r.title)}</strong><small>${esc(r.phones[0]||r.urls[0]||r.category)}</small></div><button class="remove-item" data-save="${r.id}" type="button">Remove</button></div>`).join(""):'<div class="shortlist-empty">Use the star button to save useful resources here.</div>'}<div class="dialog-actions">${rs.length?'<button id="copyShortlist" type="button">Copy saved resources</button><button id="clearShortlist" class="secondary" type="button">Clear list</button>':""}</div></div>`;$("#shortlistDialog").showModal();$("#copyShortlist")?.addEventListener("click",()=>{const text=rs.map(r=>`${r.title}\n${r.phones[0]||""}${r.urls[0]?`\n${cleanUrl(r.urls[0])}`:""}\n${r.summary}`).join("\n\n");navigator.clipboard.writeText(text).then(()=>toast("Saved resources copied"))});$("#clearShortlist")?.addEventListener("click",()=>{state.saved.clear();saveState();showShortlist();render()})}
async function init(){const files=await (await fetch("resource-files.json")).json();state.resources=(await Promise.all(files.map(async file=>{const res=await fetch(file);if(!res.ok)throw new Error("Resource data unavailable");return res.json()}))).flat();const categories=[...new Map(state.resources.map(r=>[r.categoryNumber,r.category])).entries()].sort((a,b)=>a[0]-b[0]);$("#categoryFilter").insertAdjacentHTML("beforeend",categories.map(([n,c])=>`<option value="${n}">${n}. ${esc(c)}</option>`).join(""));$("#quickChips").innerHTML=quick.map(q=>`<button class="chip" type="button" aria-pressed="false">${q}</button>`).join("");state.filtered=[...state.resources];restoreDirectoryView()}
$("#searchInput").addEventListener("input",e=>{state.query=e.target.value;state.shown=16;apply()});$("#categoryFilter").addEventListener("change",e=>{state.category=e.target.value;state.shown=16;apply()});$("#areaFilter").addEventListener("change",e=>{state.area=e.target.value;state.shown=16;apply()});$("#freeFilter").addEventListener("change",e=>{state.free=e.target.checked;apply()});$("#openFilter").addEventListener("change",e=>{state.open=e.target.checked;apply()});$("#sortSelect").addEventListener("change",e=>{state.sort=e.target.value;apply()});$("#clearFilters").addEventListener("click",clearAll);$("#emptyClear").addEventListener("click",clearAll);$("#loadMore").addEventListener("click",()=>{state.shown+=16;render()});$("#shortlistButton").addEventListener("click",showShortlist);$("#quickChips").addEventListener("click",e=>{if(!e.target.matches(".chip"))return;document.querySelectorAll(".chip").forEach(c=>c.setAttribute("aria-pressed","false"));e.target.setAttribute("aria-pressed","true");state.query=e.target.textContent;$("#searchInput").value=state.query;state.shown=16;apply()});document.addEventListener("click",e=>{if(e.target.closest("[data-map-resource]"))rememberDirectoryView();const save=e.target.closest("[data-save]");if(save){toggleSaved(save.dataset.save);if($("#shortlistDialog").open)showShortlist();return}const open=e.target.closest("[data-open]");if(open)showDetail(open.dataset.open);if(e.target.matches(".close-dialog"))e.target.closest("dialog").close()});document.addEventListener("keydown",e=>{if(e.key==="/"&&!/input|textarea|select/i.test(document.activeElement.tagName)){e.preventDefault();$("#searchInput").focus()}if(e.key==="Escape")document.querySelectorAll("dialog[open]").forEach(d=>d.close())});document.querySelectorAll("dialog").forEach(d=>d.addEventListener("click",e=>{if(e.target===d)d.close()}));init().catch(()=>{$("#resultCount").textContent="The directory could not be loaded.";$(".results-section").setAttribute("aria-busy","false")});

$("#zipFilter").addEventListener("input",e=>{const value=e.target.value.trim();state.zip=/^\d{5}$/.test(value)?value:"";state.shown=16;updateZipHelp();apply()});

const directoryViewKey="aidroom-directory-view-v1";
function rememberDirectoryView(){
  const detail=$("#detailDialog");
  const view={query:state.query,category:state.category,area:state.area,zip:state.zip,zipInput:$("#zipFilter").value,free:state.free,open:state.open,sort:state.sort,shown:state.shown,scrollY:window.scrollY,detailId:detail.open?detail.dataset.resource:null,detailScroll:detail.scrollTop,chip:document.querySelector('.chip[aria-pressed="true"]')?.textContent||""};
  try{sessionStorage.setItem(directoryViewKey,JSON.stringify(view))}catch{}
  try{history.replaceState({...history.state,aidroomDirectoryView:view},"")}catch{}
}
function restoreDirectoryView(){
  let view=history.state?.aidroomDirectoryView;
  if(!view&&new URLSearchParams(location.search).has("restore")){try{view=JSON.parse(sessionStorage.getItem(directoryViewKey)||"null")}catch{}}
  if(!view){apply();return}
  for(const key of ["query","category","area","zip"]){state[key]=typeof view[key]==="string"?view[key]:""}
  state.free=!!view.free;state.open=!!view.open;state.sort=["relevance","title","category"].includes(view.sort)?view.sort:"relevance";
  state.shown=Math.min(state.resources.length,Math.max(16,Number(view.shown)||16));
  $("#searchInput").value=state.query;$("#categoryFilter").value=state.category;$("#areaFilter").value=state.area;$("#zipFilter").value=view.zipInput||state.zip;$("#freeFilter").checked=state.free;$("#openFilter").checked=state.open;$("#sortSelect").value=state.sort;updateZipHelp();
  document.querySelectorAll('.chip').forEach(c=>c.setAttribute("aria-pressed",String(c.textContent===view.chip)));
  apply();
  if(view.detailId&&state.resources.some(r=>r.id===view.detailId))showDetail(view.detailId);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{window.scrollTo(0,Number(view.scrollY)||0);if(view.detailId)$("#detailDialog").scrollTop=Number(view.detailScroll)||0}));
}

