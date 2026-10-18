// Keep the complete search corpus off the UI thread. No search or location leaves the browser.
let records, loading;
export function loadDirectory() {
  return loading ||= readDirectory().catch(error=>{loading=null;throw error});
}
async function readDirectory() {
  if (records) return records;
  if (typeof DecompressionStream === 'function') {
    const response = await fetch('directory-index-20261014.json?v=20261018-provider-websites');
    if (!response.ok) throw new Error('Search index unavailable');
    const packed = await response.json();
    const bytes = Uint8Array.from(atob(packed.data), c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    records = JSON.parse(await new Response(stream).text());
  } else {
    // Older browsers retain the original complete dataset and search behavior.
    const files = await (await fetch('resource-files.json')).json();
    const pinsText=await (await fetch('map-pins.js?v=20261011-fort-logan')).text();
    const pins=JSON.parse(pinsText.slice(pinsText.indexOf('Object.freeze(')+14,pinsText.lastIndexOf(');')));
    records = (await Promise.all(files.map(async file => {
      const response = await fetch(file+'?v=20261018-provider-websites');
      if (!response.ok) throw new Error('Resource data unavailable');
      return (await response.json()).map(r => ({...r, _file:file,_mapAddress:mapAddress(r),_pin:(()=>{const c=pins[mapAddress(r)];return c?{lat:c[0],lon:c[1]}:null})()}));
    }))).flat();
  }
  return records;
}
export function searchResources(resources, state) {
  const terms = state.query.toLowerCase().replace(/[^a-z0-9+]+/g,' ').trim().split(/\s+/).filter(x=>x.length>1);
  const expressions = terms.map(t=>new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'));
  const matches=[];
  for (const r of resources) {
    if (state.category && String(r.categoryNumber)!==state.category) continue;
    if (state.area && !r.searchText.includes(state.area.toLowerCase())) continue;
    if (state.free && !/\bfree\b|no fee|without charge/.test(r.searchText)) continue;
    if (state.open && !/24\s*\/\s*7|24 hours|24\/7\/365/.test(r.searchText)) continue;
    if (state.zip) {
      const raw=r.fields['geographic service area']||'';
      const coverage=/search area|verify provider coverage/i.test(raw)?'':raw;
      const listed=[r.fields['physical address']||'',coverage].join(' ');
      if (![...listed.matchAll(/\b(\d{5})(?:-\d{4})?\b/g)].some(m=>m[1]===state.zip) && !/\bstatewide\b|\ball colorado\b|\bacross colorado\b|\bnationwide\b|\bnational\b|\bunited states\b/i.test(coverage)) continue;
    }
    let score=terms.length?0:1;
    for (let i=0;i<terms.length;i++) {
      const t=terms[i];
      if(r.title.toLowerCase().includes(t))score+=12;
      if(r.category.toLowerCase().includes(t))score+=8;
      if(r.summary.toLowerCase().includes(t))score+=6;
      score+=Math.min((r.searchText.match(expressions[i])||[]).length,8);
    }
    if(score>0)matches.push({r,score});
  }
  if(state.sort==='title')matches.sort((a,b)=>a.r.title.localeCompare(b.r.title));
  else if(state.sort==='category')matches.sort((a,b)=>a.r.categoryNumber-b.r.categoryNumber||a.r.title.localeCompare(b.r.title));
  else matches.sort((a,b)=>b.score-a.score||a.r.number-b.r.number);
  return {count:matches.length,resources:matches.slice(0,state.shown).map(x=>publicCard(x.r))};
}
function publicCard({searchText,...r}) {return r;}
if(typeof document==='undefined' && typeof self!=='undefined') {
  self.onmessage=async ({data})=>{
    try {
      const resources=await loadDirectory();
      const result=data.type==='lookup'?{resources:resources.filter(r=>data.ids.includes(r.id)).map(publicCard)}:searchResources(resources,data.state);
      self.postMessage({id:data.id,...result});
    } catch(error) {self.postMessage({id:data.id,error:'The directory could not be loaded. Please refresh to try again.'});}
  };
}

function mapAddress(r){
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
