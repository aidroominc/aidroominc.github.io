// Run with Node after changing resource batches or map-pins.js; publish the index and index.html together.
const fs=require('fs'),vm=require('vm'),zlib=require('zlib'),path=require('path');
const root=__dirname,read=file=>fs.readFileSync(path.join(root,file),'utf8');
const app=read('app.js');
const scope={URLSearchParams,state:{saved:new Set()},esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),tel:v=>v.replace(/[^\d+]/g,''),cleanUrl:v=>{let u=v.replace(/[),.;]+$/g,'');return /^https?:\/\//i.test(u)?u:'https://'+u}};
vm.createContext(scope);
vm.runInContext(read('map-pins.js')+'\n'+app.slice(app.indexOf('function mapAddress'),app.indexOf('function render()')),scope);
const records=JSON.parse(read('resource-files.json')).flatMap(file=>JSON.parse(read(file)).map(r=>({id:r.id,number:r.number,title:r.title,category:r.category,categoryNumber:r.categoryNumber,summary:r.summary,phones:r.phones.slice(0,1),emails:r.emails.slice(0,1),urls:r.urls.slice(0,1),fields:{'physical address':r.fields['physical address']||'','geographic service area':r.fields['geographic service area']||''},searchText:r.searchText,_file:file,_mapAddress:scope.mapAddress(r),_pin:scope.savedMapLocation(r)})));
fs.writeFileSync(path.join(root,'directory-index-20261014.json'),JSON.stringify({encoding:'gzip-base64',data:zlib.gzipSync(Buffer.from(JSON.stringify(records)),{level:9}).toString('base64')}));
let html=read('index.html');
html=html.replace(/(<div id="results" class="results">)[\s\S]*?(<\/div>\s*<button id="loadMore")/,(_,a,b)=>a+records.slice(0,16).map(r=>scope.card(r)).join('')+b);
html=html.replace(/(<script type="application\/json" id="directoryBootstrap"[^>]*>)[\s\S]*?(<\/script>)/,(_,a,b)=>a.replace(/data-total="\d+"/, 'data-total="'+records.length+'"')+JSON.stringify(records.slice(0,16).map(({searchText,...r})=>r)).replace(/</g,'\\u003c')+b);
html=html.replace(/(<span id="resultCount">)[\s\S]*?(<\/span>)/,(_,a,b)=>a+records.length.toLocaleString('en-US')+' resources'+b);
const categories=[...new Map(records.map(r=>[r.categoryNumber,r.category])).entries()].sort((a,b)=>a[0]-b[0]);
html=html.replace(/(<select id="categoryFilter">)[\s\S]*?(<\/select>)/,(_,a,b)=>a+'<option value="">All categories</option>'+categories.map(([n,c])=>`<option value="${n}">${n}. ${scope.esc(c)}</option>`).join('')+b);
fs.writeFileSync(path.join(root,'index.html'),html);
console.log('Built full search index and initial cards for '+records.length+' resources.');
