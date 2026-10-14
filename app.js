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
let directoryWorker, inlineEngine, requestId=0, searchVersion=0;
const pendingRequests=new Map(), profiles=new Map();
state.resources=JSON.parse(document.getElementById('directoryBootstrap').textContent);
state.filtered=state.resources;state.total=Number(document.getElementById("directoryBootstrap").dataset.total)||13366;
async function directoryRequest(type,values) {
  if(inlineEngine) {const records=await inlineEngine.loadDirectory();return type==='lookup'?{resources:records.filter(r=>values.ids.includes(r.id))}:inlineEngine.searchResources(records,values.state);}
  const id=++requestId;
  return new Promise((resolve,reject)=>{pendingRequests.set(id,{resolve,reject});directoryWorker.postMessage({id,type,...values});});
}
async function apply(){
  const version=++searchVersion;
  $(".results-section").setAttribute("aria-busy","true");
  try {
    const result=await directoryRequest('search',{state:{query:state.query,category:state.category,area:state.area,zip:state.zip,free:state.free,open:state.open,sort:state.sort,shown:state.shown}});
    if(version!==searchVersion)return;
    for(const r of result.resources)if(!state.resources.some(x=>x.id===r.id))state.resources.push(r);
    state.filtered=result.resources;state.total=result.count;render();
  }catch(error){if(version!==searchVersion)return;$('#resultCount').textContent=error.message;$('.results-section').setAttribute('aria-busy','false');}
}
function mapAddress(r){
 if(Object.prototype.hasOwnProperty.call(r,'_mapAddress'))return r._mapAddress;
 const raw=(r.fields['physical address']||'').trim();

 // Evaluate each listed location separately: a PO box or service-area note must not hide a real office.
 for(let part of raw.replace(/\.\s+Mailing address:/gi,';Mailing address:').split(/[;\n]/)){
  if(/confidential|no physical|\bP\.?\s*O\.?\s*Box\b|\bPost Office Box\b|mailing|client services NOT offered|\bvaries\b|past locations/i.test(part))continue;
  part=part.replace(/\([^)]*(?:\)|$)/g,'').trim();
  const match=part.match(/\b\d{1,6}[a-z]?(?:-\d+)?\s+(?:[^,;\n]+),\s*[^;\n]+/i);
  if(!match)continue;
  let address=match[0].replace(/\.\s+(?:Behavioral health|Mailing|Not confirmed|Contact|Call|Visit)\b.*$/i,'').replace(/[.\s]+$/,'');
  if(!/[A-Za-zÀ-ž]/.test(address.split(',')[0])||/\b(?:resources?|hotline|hours?|zip codes?|phone)\b/i.test(address.split(',')[0]))continue;
  const zipEnd=address.match(/^.*?,.*?(?:,\s*|\b[A-Z]{2}\s+)\d{5}(?:-\d{4})?\b/);
  return zipEnd?zipEnd[0]:address;
 }
 for(const [key,value] of Object.entries(r.fields)){
  if(key!=='physical address'&&/^(?:location listings|key locations|locations \()/i.test(key)){const address=mapAddress({fields:{'physical address':value}});if(address)return address;}
 }
 return '';
}
function savedMapLocation(r){
 if(Object.prototype.hasOwnProperty.call(r,"_pin"))return r._pin;
 const address=mapAddress(r),coordinates=typeof aidroomMapPins==='undefined'?null:aidroomMapPins[address];
 if(!address||!Array.isArray(coordinates)||coordinates.length!==2||!coordinates.every(Number.isFinite)||Math.abs(coordinates[0])>90||Math.abs(coordinates[1])>180)return null;
 return {lat:coordinates[0],lon:coordinates[1]};
}
function mapsUrl(r,place){const params=new URLSearchParams({name:r.title,address:mapAddress(r),lat:place.lat,lon:place.lon});return 'maps.html?v=3#'+params.toString()}
function mapsSection(r){
 const address=mapAddress(r);if(!address)return '';
 const place=savedMapLocation(r);
 return '<section class="maps-section" aria-label="Resource location"><p><strong>Address:</strong> '+esc(address)+'</p>'+(place?'<h3>Maps</h3><a href="'+esc(mapsUrl(r,place))+'" data-map-resource="'+esc(r.id)+'">Open in Maps</a>':'')+'</section>';
}
function card(r){const phone=r.phones[0],email=r.emails[0],url=r.urls[0];return `<article class="card"><div class="card-top"><span class="category-tag">${esc(r.category)}</span><button class="save-button" type="button" data-save="${r.id}" aria-label="${state.saved.has(r.id)?"Remove from":"Add to"} saved resources" aria-pressed="${state.saved.has(r.id)}">${state.saved.has(r.id)?"★":"☆"}</button></div><h2>${esc(r.title)}</h2><p>${esc(r.summary||"Open the resource profile for access, eligibility, and contact details.")}</p><div class="meta"><span>Resource ${r.number}</span>${r.fields["geographic service area"]?`<span>${esc(r.fields["geographic service area"].slice(0,54))}</span>`:""}${phone?`<span>${esc(phone)}</span>`:""}${email?`<span>${esc(email)}</span>`:""}<span>Verified</span></div><div class="card-actions">${phone?`<a href="tel:${tel(phone)}">Call</a>`:""}${email?`<a class="secondary" href="mailto:${esc(email)}">Email</a>`:""}${url?`<a class="secondary" href="${esc(cleanUrl(url))}" target="_blank" rel="noopener">Website</a>`:""}<button class="secondary" type="button" data-open="${r.id}">Details</button></div>${mapsSection(r)}</article>`}
function render(){const shown=state.filtered.slice(0,state.shown);$("#results").innerHTML=shown.map(card).join("");$("#resultCount").textContent=`${state.total} resource${state.total===1?"":"s"}`;const bits=[];if(state.query)bits.push(`matching “${state.query}”`);if(state.category)bits.push($("#categoryFilter").selectedOptions[0].text);if(state.area)bits.push(state.area);if(state.zip)bits.push(`ZIP ${state.zip} and statewide / nationwide services`);$("#activeSummary").textContent=bits.join(" · ");$("#loadMore").hidden=shown.length>=state.filtered.length;$("#emptyState").hidden=state.total>0;$(".results-section").setAttribute("aria-busy","false");saveState()}
let detailVersion=0;
async function showDetail(id){
 const version=++detailVersion;let r=state.resources.find(x=>x.id===id);if(!r)return;
 if(r._file&&!r._full){
  $('#detailDialog').dataset.resource=id;
  $('#detailContent').innerHTML='<div class="dialog-head"><h2>'+esc(r.title)+'</h2><button class="close-dialog" type="button" aria-label="Close">×</button></div><div class="dialog-body" role="status">Loading resource details…</div>';
  if(!$('#detailDialog').open)$('#detailDialog').showModal();
  try {
   if(!profiles.has(r._file))profiles.set(r._file,fetch(r._file).then(response=>{if(!response.ok)throw Error('Profile unavailable');return response.json()}).catch(error=>{profiles.delete(r._file);throw error}));
   const full=(await profiles.get(r._file)).find(x=>x.id===id);if(!full)throw Error('Profile unavailable');
   Object.assign(r,full,{_full:true});
   if(version!==detailVersion||!$('#detailDialog').open||$('#detailDialog').dataset.resource!==id)return;
  } catch(error){if(version===detailVersion&&$('#detailDialog').open)$('#detailContent').innerHTML='<div class="dialog-head"><h2>'+esc(r.title)+'</h2><button class="close-dialog" type="button" aria-label="Close">×</button></div><div class="dialog-body"><p>Details could not be loaded. Please try again.</p><button type="button" data-open="'+esc(id)+'">Try again</button></div>';return;}
 }
 renderDetail(id);
}
function renderDetail(id){const r=state.resources.find(x=>x.id===id);if(!r)return;const excluded=new Set(["resource category","service summary"]);const fields=Object.entries(r.fields).filter(([k,v])=>v&&!excluded.has(k));const phone=r.phones[0],email=r.emails[0],url=r.urls[0];$("#detailContent").innerHTML=`<div class="dialog-head"><span class="category-tag">${esc(r.category)}</span><h2>${esc(r.title)}</h2><p>Resource ${r.number} · Verified</p><button class="close-dialog" type="button" aria-label="Close">×</button></div><div class="dialog-body"><p class="dialog-summary">${esc(r.summary)}</p><div class="dialog-actions">${phone?`<a href="tel:${tel(phone)}">Call ${esc(phone)}</a>`:""}${email?`<a class="secondary" href="mailto:${esc(email)}">Email</a>`:""}${url?`<a class="secondary" href="${esc(cleanUrl(url))}" target="_blank" rel="noopener">Open website</a>`:""}<button class="secondary" type="button" data-save="${r.id}">${state.saved.has(r.id)?"Remove from":"Add to"} referral list</button></div>${mapsSection(r)}<dl class="field-grid">${fields.map(([k,v])=>`<dt>${esc(labels[k]||k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>`;$("#detailDialog").dataset.resource=id;$("#detailDialog").showModal()}
async function showShortlist(){let rs=state.resources.filter(r=>state.saved.has(r.id));if(rs.length!==state.saved.size){try{const result=await directoryRequest('lookup',{ids:[...state.saved]});rs=result.resources;for(const r of rs)if(!state.resources.some(x=>x.id===r.id))state.resources.push(r);}catch(error){toast('Saved resources could not be loaded. Please try again.');return;}}rs.sort((a,b)=>a.number-b.number);$("#shortlistContent").innerHTML=`<div class="dialog-head"><span class="category-tag">Your selections</span><h2>Saved resources</h2><p>${rs.length} saved resource${rs.length===1?"":"s"}</p><button class="close-dialog" type="button" aria-label="Close">×</button></div><div class="dialog-body">${rs.length?rs.map(r=>`<div class="shortlist-item"><div><strong>${esc(r.title)}</strong><small>${esc(r.phones[0]||r.urls[0]||r.category)}</small></div><button class="remove-item" data-save="${r.id}" type="button">Remove</button></div>`).join(""):'<div class="shortlist-empty">Use the star button to save useful resources here.</div>'}<div class="dialog-actions">${rs.length?'<button id="copyShortlist" type="button">Copy saved resources</button><button id="clearShortlist" class="secondary" type="button">Clear list</button>':""}</div></div>`;$("#shortlistDialog").showModal();$("#copyShortlist")?.addEventListener("click",()=>{const text=rs.map(r=>`${r.title}\n${r.phones[0]||""}${r.urls[0]?`\n${cleanUrl(r.urls[0])}`:""}\n${r.summary}`).join("\n\n");navigator.clipboard.writeText(text).then(()=>toast("Saved resources copied"))});$("#clearShortlist")?.addEventListener("click",()=>{state.saved.clear();saveState();showShortlist();render()})}
async function init(){
 try {
  directoryWorker=new Worker('directory-worker-20261014.js',{type:'module'});
  directoryWorker.onmessage=({data})=>{const pending=pendingRequests.get(data.id);if(!pending)return;pendingRequests.delete(data.id);data.error?pending.reject(Error(data.error)):pending.resolve(data)};
  directoryWorker.onerror=async()=>{directoryWorker.terminate();try{inlineEngine=await import('./directory-worker-20261014.js');for(const pending of pendingRequests.values())pending.reject(Error('Search is restarting…'));pendingRequests.clear();await apply()}catch(error){$('#resultCount').textContent='The directory could not be loaded. Please refresh to try again.'}};
 }catch(error){inlineEngine=await import('./directory-worker-20261014.js')}
 saveState();
 if(!history.state?.aidroomDirectoryView&&!new URLSearchParams(location.search).has('restore')){state.filtered=state.resources.slice(0,16);render()}
 await restoreDirectoryView();
}

$("#searchInput").addEventListener("input",e=>{state.query=e.target.value;state.shown=16;apply()});$("#categoryFilter").addEventListener("change",e=>{state.category=e.target.value;state.shown=16;apply()});$("#areaFilter").addEventListener("change",e=>{state.area=e.target.value;state.shown=16;apply()});$("#freeFilter").addEventListener("change",e=>{state.free=e.target.checked;apply()});$("#openFilter").addEventListener("change",e=>{state.open=e.target.checked;apply()});$("#sortSelect").addEventListener("change",e=>{state.sort=e.target.value;apply()});$("#clearFilters").addEventListener("click",clearAll);$("#emptyClear").addEventListener("click",clearAll);$("#loadMore").addEventListener("click",()=>{state.shown+=16;apply()});$("#shortlistButton").addEventListener("click",showShortlist);$("#quickChips").addEventListener("click",e=>{if(!e.target.matches(".chip"))return;document.querySelectorAll(".chip").forEach(c=>c.setAttribute("aria-pressed","false"));e.target.setAttribute("aria-pressed","true");state.query=e.target.textContent;$("#searchInput").value=state.query;state.shown=16;apply()});document.addEventListener("click",e=>{if(e.target.closest("[data-map-resource]"))rememberDirectoryView();const save=e.target.closest("[data-save]");if(save){toggleSaved(save.dataset.save);if($("#shortlistDialog").open)showShortlist();return}const open=e.target.closest("[data-open]");if(open)showDetail(open.dataset.open);if(e.target.matches(".close-dialog"))e.target.closest("dialog").close()});document.addEventListener("keydown",e=>{if(e.key==="/"&&!/input|textarea|select/i.test(document.activeElement.tagName)){e.preventDefault();$("#searchInput").focus()}if(e.key==="Escape")document.querySelectorAll("dialog[open]").forEach(d=>d.close())});document.querySelectorAll("dialog").forEach(d=>d.addEventListener("click",e=>{if(e.target===d)d.close()}));init().catch(()=>{$("#resultCount").textContent="The directory could not be loaded.";$(".results-section").setAttribute("aria-busy","false")});

$("#zipFilter").addEventListener("input",e=>{const value=e.target.value.trim();state.zip=/^\d{5}$/.test(value)?value:"";state.shown=16;updateZipHelp();apply()});

const directoryViewKey="aidroom-directory-view-v1";
function rememberDirectoryView(){
  const detail=$("#detailDialog");
  const view={query:state.query,category:state.category,area:state.area,zip:state.zip,zipInput:$("#zipFilter").value,free:state.free,open:state.open,sort:state.sort,shown:state.shown,scrollY:window.scrollY,detailId:detail.open?detail.dataset.resource:null,detailScroll:detail.scrollTop,chip:document.querySelector('.chip[aria-pressed="true"]')?.textContent||""};
  try{sessionStorage.setItem(directoryViewKey,JSON.stringify(view))}catch{}
  try{history.replaceState({...history.state,aidroomDirectoryView:view},"")}catch{}
}
async function restoreDirectoryView(){
  let view=history.state?.aidroomDirectoryView;
  if(!view&&new URLSearchParams(location.search).has("restore")){try{view=JSON.parse(sessionStorage.getItem(directoryViewKey)||"null")}catch{}}
  if(!view){apply();return}
  for(const key of ["query","category","area","zip"]){state[key]=typeof view[key]==="string"?view[key]:""}
  state.free=!!view.free;state.open=!!view.open;state.sort=["relevance","title","category"].includes(view.sort)?view.sort:"relevance";
  state.shown=Math.max(16,Number(view.shown)||16);
  $("#searchInput").value=state.query;$("#categoryFilter").value=state.category;$("#areaFilter").value=state.area;$("#zipFilter").value=view.zipInput||state.zip;$("#freeFilter").checked=state.free;$("#openFilter").checked=state.open;$("#sortSelect").value=state.sort;updateZipHelp();
  document.querySelectorAll('.chip').forEach(c=>c.setAttribute("aria-pressed",String(c.textContent===view.chip)));
  await apply();
  if(view.detailId){if(!state.resources.some(r=>r.id===view.detailId)){const result=await directoryRequest("lookup",{ids:[view.detailId]});state.resources.push(...result.resources)}await showDetail(view.detailId);}
  requestAnimationFrame(()=>requestAnimationFrame(()=>{window.scrollTo(0,Number(view.scrollY)||0);if(view.detailId)$("#detailDialog").scrollTop=Number(view.detailScroll)||0}));
}

