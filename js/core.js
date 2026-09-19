'use strict';
let currentUser=null,currentProfile=null,roleDetails=null,myLocation=null;
let cart={restId:null,items:[]};
let liveChannel=null,sharing=false,shareTimer=null;
let _cameFromAdults=false;
const loadedScripts={};
window._modulesConfig={};window._adultModules=['girls'];window._turnConfig=null;window._turnConfigRaw=null;
const LEVEL_META={1:{ico:'🥉',name:'Bronce',rate:0.2},2:{ico:'🥈',name:'Plata',rate:0.7},3:{ico:'🥇',name:'Oro',rate:1.2},4:{ico:'💠',name:'Platino',rate:2},5:{ico:'💎',name:'Diamante',rate:3}};
function levelInfo(n){return LEVEL_META[parseInt(n)]||LEVEL_META[1];}
function levelBadge(n){const lv=Math.min(5,Math.max(1,parseInt(n)||1));const m=LEVEL_META[lv];return `<span class="lvl lvl-${lv}"><span class="lvl-ico">${m.ico}</span>${m.name}</span>`;}
const DEFAULT_USER_LEVELS=[{level:1,name:'Crush',min:1,max:10},{level:2,name:'Lover',min:11,max:20},{level:3,name:'Sweetheart',min:21,max:50},{level:4,name:'Lancelot',min:51,max:100},{level:5,name:'Romeo',min:101,max:250},{level:6,name:'Casanova',min:251,max:499},{level:7,name:'Eros',min:500,max:null}];
window._userLevels=DEFAULT_USER_LEVELS;
function userLevelInfo(balance){const b=parseFloat(balance||0);const list=(window._userLevels||DEFAULT_USER_LEVELS).slice().sort((a,c)=>a.min-c.min);let out=null;for(const x of list){if(b>=x.min)out=x;}return out;}
function userLevelBadge(balance){const lv=userLevelInfo(balance);if(!lv)return `<span class="ulvl ulvl-0">🎭 Sin rango</span>`;return `<span class="ulvl ulvl-${lv.level}">🎭 ${lv.name}</span>`;}
function userNextLevel(balance){const b=parseFloat(balance||0);const list=(window._userLevels||DEFAULT_USER_LEVELS).slice().sort((a,c)=>a.min-c.min);return list.find(x=>b<x.min)||null;}
async function refreshTurn(){
  const raw=window._turnConfigRaw; if(!raw) return;
  try{
    if(raw.url){ const r=await fetch(raw.url); const j=await r.json(); if(j&&j.urls&&j.username&&j.credential) window._turnConfig={urls:j.urls,username:j.username,credential:j.credential}; }
    else if(raw.urls){ window._turnConfig={urls:raw.urls,username:raw.username,credential:raw.credential}; }
  }catch(e){}
}
const MODULE_DEFS=[{id:'map',n:'Mapa Social'},{id:'radar',n:'Radar Nocturno'},{id:'events',n:'Eventos'},{id:'restaurants',n:'Restaurantes'},{id:'reservations',n:'Reservas'},{id:'orders',n:'Pedidos'},{id:'marketplace',n:'Marketplace'},{id:'adults',n:'🔞 Área Adultos'},{id:'remote',n:'Trabajo'},{id:'delivery',n:'Zona Domiciliario'},{id:'chat',n:'Chat'}];
const MODULE_ICONS={map:'📍',radar:'🌙',events:'🎪',restaurants:'🍽️',reservations:'',orders:'📦',marketplace:'',adults:'🔞',remote:'💼',delivery:'🛵',chat:'',tokens:'◈',admin:'🛡️',kyc:'🪪'};
const ADULT_MODULE_NAMES={girls:'💃 Chicas',map:'📍 Mapa',radar:'🌙 Radar',chat:'💬 Chat',events:'🎪 Eventos',marketplace:'🛒 Market',restaurants:'🍽️ Restaurantes',orders:'📦 Pedidos'};
const _pm={};
function pmInit(id,kept,max){_pm[id]={kept:(kept||[]).slice(0,max),newFiles:[],max};}
function pmState(id){return _pm[id]||{kept:[],newFiles:[]};}
function pmTile(id,kind,i,src){return `<span class="pm-tile"><img src="${src}" alt=""><span class="pm-actions"><button type="button" class="pm-btn" title="Reemplazar" onclick="pmReplace('${id}','${kind}',${i})">🔄</button><button type="button" class="pm-btn del" title="Eliminar" onclick="pmRemove('${id}','${kind}',${i})">✕</button></span></span>`;}
function pmRender(id){const c=_pm[id];const el=document.getElementById(id);if(!el||!c)return;const kept=c.kept.map((u,i)=>pmTile(id,'kept',i,u)).join('');const nw=c.newFiles.map((f,i)=>pmTile(id,'new',i,URL.createObjectURL(f))).join('');const left=c.max-(c.kept.length+c.newFiles.length);const add=left>0?`<label class="pm-add" title="Añadir foto">＋<input type="file" accept="image/*" multiple hidden onchange="pmAdd('${id}',this)"></label>`:'';el.innerHTML=kept+nw+add;}
function pmAdd(id,input){const c=_pm[id];if(!c)return;for(const f of Array.from(input.files||[])){if(c.kept.length+c.newFiles.length>=c.max){showToast('⚠️ Máximo '+c.max+' fotos');break;}c.newFiles.push(f);}input.value='';pmRender(id);}
function pmRemove(id,kind,i){const c=_pm[id];if(!c)return;if(kind==='kept')c.kept.splice(i,1);else c.newFiles.splice(i,1);pmRender(id);}
function pmReplace(id,kind,i){const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.onchange=()=>{const f=inp.files[0];if(!f)return;const c=_pm[id];if(!c)return;if(kind==='kept'){c.kept.splice(i,1);c.newFiles.push(f);}else{c.newFiles[i]=f;}pmRender(id);};inp.click();}
function fbLabel(input){const lb=input.closest('.file-btn');if(lb){const t=lb.querySelector('.fb-txt');if(t)t.textContent=input.files&&input.files[0]?input.files[0].name:'Seleccionar archivo';}}
const TIER_CSS=`
 .lvl{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-weight:800;font-size:.78rem;border:1px solid;vertical-align:middle}
 .lvl-1{background:rgba(205,127,50,.15);color:#e0a06a;border-color:#cd7f32}
 .lvl-2{background:rgba(192,192,192,.15);color:#dcdcdc;border-color:#c0c0c0}
 .lvl-3{background:rgba(255,215,0,.15);color:#ffd75e;border-color:#ffd700;animation:lvlGlow 2.5s infinite}
 .lvl-4{background:rgba(0,217,255,.15);color:#7fe8ff;border-color:#00d9ff;animation:lvlGlow 1.8s infinite}
 .lvl-5{background:linear-gradient(100deg,rgba(255,45,149,.25),rgba(0,217,255,.25),rgba(255,45,149,.25));background-size:200%;color:#fff;border-color:transparent;animation:lvlShine 2.5s linear infinite;box-shadow:0 0 14px rgba(255,45,149,.45)}
 @keyframes lvlGlow{0%,100%{box-shadow:0 0 4px currentColor}50%{box-shadow:0 0 12px currentColor}}
 @keyframes lvlShine{0%{background-position:0%}100%{background-position:200%}}
 @keyframes heroPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
 .ulvl{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-weight:800;font-size:.78rem;border:1px solid;vertical-align:middle}
 .ulvl-0{background:rgba(255,255,255,.06);color:var(--dim);border-color:var(--border)}
 .ulvl-1{background:rgba(255,150,150,.15);color:#ffb3b3;border-color:#ff8080}
 .ulvl-2{background:rgba(255,255,255,.15);color:#e8e8e8;border-color:#c0c0c0}
 .ulvl-3{background:rgba(255,215,0,.15);color:#ffd75e;border-color:#ffd700;animation:lvlGlow 2.5s infinite}
 .ulvl-4{background:rgba(0,120,255,.15);color:#7fb8ff;border-color:#0078ff;animation:lvlGlow 2s infinite}
 .ulvl-5{background:rgba(255,0,60,.15);color:#ff8fa3;border-color:#ff003c;animation:lvlGlow 1.6s infinite}
 .ulvl-6{background:linear-gradient(100deg,rgba(255,255,255,.2),rgba(0,217,255,.2),rgba(255,255,255,.2));background-size:200%;color:#fff;border-color:transparent;animation:lvlShine 2.2s linear infinite;box-shadow:0 0 12px rgba(0,217,255,.4)}
 .ulvl-7{background:linear-gradient(100deg,rgba(255,215,0,.3),rgba(255,45,149,.3),rgba(255,215,0,.3));background-size:200%;color:#fff;border-color:transparent;animation:lvlShine 1.6s linear infinite,heroPulse 2s infinite;box-shadow:0 0 18px rgba(255,215,0,.6)}
 .app-header{position:relative}
 .header-left{cursor:pointer}
 .panic-top{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:38px;height:38px;border-radius:50%;border:1px solid #ff3b6b;background:rgba(255,59,107,.15);color:#ff3b6b;font-size:1rem;cursor:pointer;z-index:5}
 .mod-locked{opacity:.65}
 .mod-lock{display:block;font-size:.68rem;color:var(--warning);margin-top:4px;font-weight:700}
 .video-wrap{height:calc(100vh - 300px);min-height:300px}
 #remoteVideo{object-fit:cover;-webkit-object-fit:cover}
 .req-gate{padding:24px;border-radius:16px;border:1px solid var(--border);background:rgba(255,176,32,.08);text-align:center}
 .req-gate h3{margin-bottom:10px}
 .req-gate ul{list-style:none;margin:12px 0;display:flex;flex-direction:column;gap:8px}
 .lb-wrap{position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:900;display:flex;align-items:center;justify-content:center}
 .lb-wrap img{max-width:100%;max-height:88vh;object-fit:contain;-webkit-object-fit:contain}
 .lb-btn{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.12);border:none;color:#fff;font-size:2rem;width:48px;height:48px;border-radius:50%;cursor:pointer}
 .lb-prev{left:10px}.lb-next{right:10px}
 .lb-close{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.12);border:none;color:#fff;font-size:1.4rem;width:42px;height:42px;border-radius:50%;cursor:pointer}
 .lb-dots{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:6px}
 .lb-dots span{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.4)}
 .lb-dots span.on{background:#fff}
 .pm-grid{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
 .pm-tile{position:relative;width:76px;height:76px;border-radius:12px;overflow:hidden;border:1px solid var(--border);background:#111;flex:0 0 auto}
 .pm-tile img{width:100%;height:100%;object-fit:cover;-webkit-object-fit:cover}
 .pm-actions{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:center;gap:4px;padding:3px;background:linear-gradient(transparent,rgba(0,0,0,.8))}
 .pm-btn{width:26px;height:26px;border-radius:8px;border:none;background:rgba(255,255,255,.2);color:#fff;font-size:.78rem;cursor:pointer;line-height:1}
 .pm-btn.del{background:var(--error)}
 .pm-add{width:76px;height:76px;border-radius:12px;border:2px dashed var(--border-strong);display:flex;align-items:center;justify-content:center;font-size:1.6rem;color:var(--dim);cursor:pointer;background:rgba(255,255,255,.03);flex:0 0 auto}
 .pm-add:hover{border-color:var(--primary);color:var(--primary)}
 .file-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:12px;border:1px solid var(--border-strong);background:rgba(0,217,255,.08);color:var(--text);cursor:pointer;font-weight:700;font-size:.9rem;margin:6px 0}
 .file-btn .fb-txt{color:var(--dim);font-weight:500;font-size:.78rem;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .adult-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0;border-bottom:1px solid var(--border);padding-bottom:10px}
 .adult-tab{padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:rgba(255,255,255,.04);cursor:pointer;font-weight:700;font-size:.85rem;transition:all .2s;-webkit-tap-highlight-color:transparent}
 .adult-tab:hover{background:rgba(255,255,255,.08)}
 .adult-tab.on{background:var(--gradient);color:#04060c;border-color:transparent;box-shadow:0 0 12px rgba(0,217,255,.4)}
 @keyframes gFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
 @keyframes topPulse{0%,100%{box-shadow:0 0 20px rgba(255,215,0,.6)}50%{box-shadow:0 0 40px rgba(255,215,0,.9)}}
 .top-models-section{padding:20px 10px;text-align:center}
 .top-models-section h3{margin:0 0 16px 0;font-size:1.2rem;color:var(--primary)}
 .top-podium{display:flex;justify-content:center;align-items:flex-end;gap:20px;margin:20px 0}
 .top-spot{display:flex;flex-direction:column;align-items:center;cursor:pointer;transition:transform .2s}
 .top-spot:hover{transform:scale(1.05)}
 .top-spot .top-photo{width:80px;height:80px;border-radius:50%;object-fit:cover;-webkit-object-fit:cover;border:3px solid var(--border);background:#000}
 .top-spot.top-1 .top-photo{width:100px;height:100px;border-color:#ffd700;animation:topPulse 2s infinite}
 .top-spot.top-2 .top-photo,.top-spot.top-3 .top-photo{border-color:#c0c0c0}
 .top-spot .top-rank{font-size:1.5rem;font-weight:900;margin-top:8px}
 .top-spot.top-1 .top-rank{color:#ffd700;font-size:2rem}
 .top-spot .top-name{font-size:.85rem;font-weight:700;margin-top:4px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .top-spot .top-rate{font-size:.75rem;color:var(--dim);margin-top:2px}`;
document.addEventListener('DOMContentLoaded',async()=>{initPWA();await loadBranding();const isApp=!!document.getElementById('section-dashboard');const{data:{session}}=await db.auth.getSession();if(isApp){if(!session){location.replace('index.html');return;}currentUser=session.user;window._fendyxToken=session.access_token;await enterApp();}else if(session)location.replace('app.html');});
function initPWA(){if(!document.querySelector('link[rel="manifest"]')){const l=document.createElement('link');l.rel='manifest';l.href='manifest.json';document.head.appendChild(l);const m=document.createElement('meta');m.name='theme-color';m.content='#00d9ff';document.head.appendChild(m);const a=document.createElement('link');a.rel='apple-touch-icon';a.href='icons/icon.svg';document.head.appendChild(a);}if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});const unlock=()=>{try{window._fendyxAudio=window._fendyxAudio||new (window.AudioContext||window.webkitAudioContext)();window._fendyxAudio.resume();}catch(e){}window.removeEventListener('pointerdown',unlock);};window.addEventListener('pointerdown',unlock);}
function setWorkerOnlineDB(on){if(!currentUser)return Promise.resolve();if(currentProfile)currentProfile.is_online=on;return db.from('profiles').update({is_online:on}).eq('id',currentUser.id);}
function beaconOffline(){const t=window._fendyxToken;if(!t||!currentUser)return;try{fetch(SUPABASE_URL+'/rest/v1/profiles?id=eq.'+currentUser.id,{method:'PATCH',keepalive:true,headers:{'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+t,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({is_online:false})});}catch(e){}}
function armPresence(){const intent=()=>localStorage.getItem('fendyx_online_intent')==='1';if(intent()&&!document.hidden)setWorkerOnlineDB(true);document.addEventListener('visibilitychange',()=>{if(document.hidden)setWorkerOnlineDB(false);else if(intent())setWorkerOnlineDB(true);});window.addEventListener('pagehide',beaconOffline);window.addEventListener('beforeunload',beaconOffline);}
async function ensureAutoActive(){if(!currentProfile||currentProfile.role==='admin')return;const bal=parseFloat(currentProfile.tokens_balance||0);if(bal>=5&&!currentProfile.is_active){await db.from('profiles').update({is_active:true}).eq('id',currentUser.id);currentProfile.is_active=true;}}
async function enterApp(){try{await loadProfile();if(!currentProfile)await repairProfile();if(!currentProfile){await db.auth.signOut();location.replace('index.html');return;}if(currentProfile.is_banned){localStorage.setItem('fendyx_ban_reason',currentProfile.ban_reason||'Sin razón');await db.auth.signOut();location.replace('index.html?banned=1');return;}injectDynamicUI();await ensureRoleDetails();await ensureAutoActive();await refreshTurn();setInterval(refreshTurn,6*3600*1000);window.addEventListener('online',refreshTurn);if(currentProfile.role==='remote_worker'){armPresence();if(currentProfile.kyc_status==='approved')loadScript('calls.js');}updateHeader();loadModules();const last=localStorage.getItem('fendyx_last_section');const valid=last&&LOADERS[last]&&((last!=='delivery'||currentProfile.role==='delivery')&&(last!=='adults'||currentProfile.kyc_status==='approved'||currentProfile.role==='admin')&&(last!=='remote'||currentProfile.role==='remote_worker')&&(last!=='kyc'||currentProfile.role==='remote_worker')&&(last!=='admin'||currentProfile.role==='admin'));showSection(valid?last:'dashboard');startRealtime();}catch(e){console.error(e);showToast('️ Error de carga: '+e.message);}}
async function repairProfile(){const{data}=await db.from('profiles').select('*').eq('id',currentUser.id).single();if(data){currentProfile=data;return;}const meta=JSON.parse(localStorage.getItem('fendyx_pending_meta')||'{}');const{data:c,error}=await db.from('profiles').insert({id:currentUser.id,email:currentUser.email,full_name:meta.full_name||'Usuario',role:meta.role||'user',age:meta.age||null,gender:meta.gender||null,referral_code:(currentUser.id||'').replace(/-/g,'').slice(0,8).toUpperCase(),tokens_balance:0,is_active:false}).select().single();if(!error)currentProfile=c;}
async function loadProfile(){const{data}=await db.from('profiles').select('*').eq('id',currentUser.id).single();currentProfile=data;const{data:rd}=await db.from('role_details').select('*').eq('user_id',currentUser.id).single();roleDetails=rd;}
async function ensureRoleDetails(){if(roleDetails)return;const meta=JSON.parse(localStorage.getItem('fendyx_pending_meta')||'{}');const{data}=await db.from('role_details').insert({user_id:currentUser.id,role_type:currentProfile.role,rif:meta.rif||null,business_name:meta.business_name||null,address:meta.address||null,license_number:meta.license||null,vehicle_plate:meta.plate||null,vehicle_type:meta.vehicle||null,specialty:meta.specialty||null,bio:meta.bio||null,rate_per_minute:currentProfile.role==='remote_worker'?0.2:null}).select().single();roleDetails=data;localStorage.removeItem('fendyx_pending_meta');}
async function loadBranding(){const{data}=await db.from('app_branding').select('*').eq('id',1).single();if(!data)return;window._modulesConfig=data.modules_config||{};window._userLevels=data.user_levels||DEFAULT_USER_LEVELS;window._girlCategories=data.girl_categories||window._girlCategories;window._turnConfigRaw=data.turn_config||null;const rawAdult=data.adult_modules;window._adultModules=(rawAdult&&Array.isArray(rawAdult)&&rawAdult.length)?rawAdult:['girls'];await refreshTurn();const setLogo=(i,f)=>{const img=document.getElementById(i),fl=document.getElementById(f);if(!img||!fl)return;if(data.logo_url){img.src=data.logo_url;img.style.display='inline-block';fl.style.display='none';}else{img.style.display='none';fl.style.display='block';}};setLogo('authLogo','authLogoFallback');setLogo('headerLogo','headerLogoFallback');setLogo('adminLogoPreview','adminLogoFallback');const n=data.app_name||'FENDYX';['authAppName','headerAppName'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=n;});const an=document.getElementById('adminAppName');if(an&&!an.value)an.value=n;}
function injectDynamicUI(){if(document.getElementById('fendyx-extra-style'))return;const st=document.createElement('style');st.id='fendyx-extra-style';st.textContent=TIER_CSS+`
 .kyc-img{width:120px;height:85px;object-fit:cover;-webkit-object-fit:cover;border-radius:10px;border:1px solid var(--border-strong);margin:4px;cursor:pointer}
 .ref-code{font-family:'Orbitron';letter-spacing:3px;color:var(--primary);font-weight:900}
 .incoming-call{position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:600;background:var(--card-2);border:2px solid var(--success);border-radius:18px;padding:14px 20px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 40px rgba(0,255,157,.35);animation:proxIn .4s;max-width:92vw}
 .incoming-call b{display:block}`;document.head.appendChild(st);
 const hl=document.querySelector('.header-left');if(hl){hl.style.cursor='pointer';hl.onclick=()=>showSection('dashboard');}
 const header=document.querySelector('.app-header');
 if(header&&!document.getElementById('panicTop')){const b=document.createElement('button');b.id='panicTop';b.className='panic-top';b.textContent='🆘';b.onclick=()=>{if(confirm('¿Enviar ALERTA DE PÁNICO al administrador con tu ubicación actual?'))sendPanic('general');};header.appendChild(b);}
 const av=document.getElementById('userAvatar');if(av)av.onclick=()=>toggleUserMenu();
 if(!document.getElementById('incomingCall')){const inc=document.createElement('div');inc.id='incomingCall';inc.className='incoming-call hidden';document.body.appendChild(inc);}
 if(!document.getElementById('section-adults')){
   const ad=document.createElement('section');
   ad.id='section-adults';
   ad.className='app-section';
   ad.innerHTML=`
     <div class="section-header"><h2>🔞 Área Adultos +18</h2><button class="btn-back" onclick="showSection('dashboard')">← Volver</button></div>
     <div id="adultsGate"></div>
     <div id="adultTabs" class="adult-tabs"></div>
     <div id="adultContent"></div>`;
   document.querySelector('.app-main').appendChild(ad);
 }
 const kyc=document.createElement('section');kyc.id='section-kyc';kyc.className='app-section';
 kyc.innerHTML=`<div class="section-header"><h2>🪪 Mi Verificación</h2><button class="btn-back" onclick="showSection('dashboard')">← Volver</button></div><div id="kycStatusBox" class="owner-panel"></div><form class="owner-panel owner-form" onsubmit="submitKycDocs(event)"><input type="text" id="kycWhatsapp" placeholder="WhatsApp" required><label class="dim">📄 Cédula</label><label class="file-btn">📎 <span class="fb-txt">Seleccionar cédula</span><input type="file" id="kycIdCard" accept="image/*" hidden required onchange="fbLabel(this)"></label><label class="dim">🤳 Rostro</label><label class="file-btn">📎 <span class="fb-txt">Seleccionar rostro</span><input type="file" id="kycFace" accept="image/*" hidden required onchange="fbLabel(this)"></label><button type="submit" class="btn-primary">Enviar</button></form>`;
 document.querySelector('.app-main').appendChild(kyc);
 const mc=document.querySelector('#modal-recharge .modal-content');
 if(mc)mc.innerHTML=`<div class="modal-head"><h3>◈ Solicitar recarga</h3><button class="modal-close" onclick="closeModal('modal-recharge')">✕</button></div><p class="dim">Mínimo 3 tokens ($3). Con 5+ tu cuenta queda activa para siempre.</p><div class="owner-form"><input type="number" id="reqAmount" placeholder="Monto (mín 3)" min="3"><select id="reqMethod"><option value="binance">🪙 Binance Pay</option><option value="pago_movil">📱 Pago Móvil</option><option value="zelle">💵 Zelle</option></select><input type="text" id="reqRef" placeholder="Referencia / hash"><label class="dim">📸 Captura del pago</label><label class="file-btn"> <span class="fb-txt">Seleccionar captura</span><input type="file" id="reqProof" accept="image/*" hidden onchange="fbLabel(this)"></label><button type="button" class="btn-primary" onclick="submitRechargeRequest()">Enviar</button></div><h4 class="sub-title">Mis solicitudes</h4><div id="myRechargeList" class="list-compact"></div>`;
 const recBtn=document.querySelector('#section-tokens .row-buttons .btn-primary');
 if(recBtn)recBtn.onclick=async()=>{openModal('modal-recharge');await loadScript('tokens.js');loadMyRecharges();};
 const tabs=document.querySelector('.admin-tabs');
 const add=(key,label,html)=>{if(tabs&&!tabs.querySelector('[data-'+key+'-tab]')){tabs.insertAdjacentHTML('beforeend',`<button class="admin-tab" data-${key}-tab onclick="switchAdminTab('${key}',this)">${label}</button>`);const p=document.createElement('div');p.id='admin-'+key;p.className='admin-panel';p.innerHTML=html;document.getElementById('section-admin').appendChild(p);}};
 add('rates','💰 Tarifas','<p class="dim">Ganancia NETA de la modelo por minuto.</p><div id="levelsRateList" class="list-compact"></div>');
 add('vip','🎭 Niveles VIP','<p class="dim">Saldo mínimo para cada máscara.</p><div id="vipLevelsList" class="list-compact"></div>');
 add('cats',' Categorías','<p class="dim">Renombra las 4 categorías y asigna cada modelo.</p><div id="catNamesList" class="list-compact"></div><h4 class="sub-title">Asignar modelos</h4><div id="catModelsList" class="list-compact"></div>');
 add('featured','⭐ Destacadas','<p class="dim">Top 3 modelos por categoría según calificaciones.</p><div class="row-buttons"><select class="btn-small" id="featFilter" onchange="setFeatPeriod(this.value)"><option value="dia">Diario</option><option value="semana">Semanal</option><option value="mes" selected>Mensual</option></select></div><div id="featList" class="list-compact"></div>');
 add('workers','💃 Trabajadoras','<p class="dim">Asigna nivel y tarifa individual.</p><div id="adminWorkersList" class="list-compact"></div>');
 add('recharges','💳 Recargas','<div id="rechargeRequestsList" class="list-compact"></div>');
 add('earnings','💵 Ganancias App','<div class="row-buttons"><select class="btn-small" id="earnFilter" onchange="setEarnPeriod(this.value)"><option value="hoy">Hoy</option><option value="semana">Última semana</option><option value="quincena" selected>Última quincena</option><option value="todo">Todo</option></select></div><div id="earnKpis" class="row-buttons" style="flex-wrap:wrap"></div><div id="earnBreak" class="list-compact"></div><div id="earnList" class="list-compact"></div>');
 add('payouts','💸 Pagos','<p class="dim">Lo que la app debe pagar por retiros (días 15 y 30).</p><div class="row-buttons"><select class="btn-small" id="payFilter" onchange="setPayPeriod(this.value)"><option value="hoy">Hoy</option><option value="semana">Última semana</option><option value="quincena" selected>Última quincena</option><option value="todo">Todo</option></select></div><div id="payKpis" class="row-buttons" style="flex-wrap:wrap"></div><div id="payOwed" class="list-compact"></div><div id="payList" class="list-compact"></div>');
 add('turn','📡 TURN','<p class="dim">Servidor TURN (Metered/Cloudflare/propio).</p><div class="owner-form"><label class="dim">URL Worker Cloudflare (opcional)</label><input type="text" id="turnUrl" placeholder="https://xxx.workers.dev"><label class="dim">URLs TURN (separadas por coma)</label><input type="text" id="turnUrls" placeholder="turn:global.relay.metered.ca:80, ..."><label class="dim">Usuario</label><input type="text" id="turnUser"><label class="dim">Credencial</label><input type="text" id="turnCred"><button class="btn-primary" onclick="saveTurnConfig()">💾 Guardar TURN</button><p class="dim" id="turnStatus" style="margin-top:8px"></p></div>');
 add('adultcfg','🔞 Área Adultos','<p class="dim">Elige qué módulos viven DENTRO del Área Adultos +18.</p><div id="adultModsList" class="list-compact"></div>');
 add('safety','🚨 Seguridad','<h3 class="sub-title">🆘 Pánico</h3><div id="panicList" class="list-compact"></div><h3 class="sub-title">🚩 Reportes</h3><div id="reportsList" class="list-compact"></div>');
 add('modules','🧩 Apartados','<p class="dim">Activa, marca "próximamente" u oculta cada apartado.</p><div id="modulesConfigList" class="list-compact"></div>');
 add('supervision','👁 Supervisión','<p class="dim">Llamadas en vivo. Mosaico invisible.</p><div id="liveCallsList" class="list-compact"></div>');}
async function sendPanic(context,callId){const pos=await getPos();await db.from('panic_alerts').insert({user_id:currentUser.id,context:context||'general',call_id:callId||null,latitude:pos?.lat||null,longitude:pos?.lng||null});navigator.vibrate?.([400,150,400]);showToast('🆘 Alerta enviada al administrador');}
async function reportUser(targetId,reason){await db.from('reports').insert({reporter_id:currentUser.id,target_user_id:targetId,type:'user',detail:reason});showToast(' Reporte enviado');}
function requireActive(){return true;}
function requireBalance(min){if(currentProfile.role==='admin'||currentProfile.unlimited_tokens)return true;const b=parseFloat(currentProfile.tokens_balance||0);if(b<min){showToast('◈ Saldo insuficiente. Recarga para continuar.');showSection('tokens');return false;}return true;}
function showLocked(name){showToast('🔒 '+name+' estará disponible próximamente.');}
function toggleUserMenu(){document.getElementById('userMenu')?.classList.toggle('hidden');}
document.addEventListener('click',e=>{if(!e.target.closest('.user-avatar')&&!e.target.closest('.user-menu')&&!e.target.closest('.header-left'))document.getElementById('userMenu')?.classList.add('hidden');});
function buildUserMenu(){const m=document.getElementById('userMenu');if(!m)return;let h=`<div class="menu-item" onclick="showSection('profile')">👤 Mi Perfil</div>`;if(currentProfile.role==='remote_worker')h+=`<div class="menu-item" onclick="showSection('profileedit')">✏️ Perfil Pro</div>`;if(currentProfile.role==='admin')h+=`<div class="menu-item" onclick="showSection('admin')">🛡️ Panel Admin</div>`;h+=`<div class="menu-item logout" onclick="handleLogout()">🚪 Cerrar Sesión</div>`;m.innerHTML=h;}
function updateHeader(){if(!currentProfile)return;const t=document.getElementById('userTokens');if(t)t.textContent=currentProfile.unlimited_tokens?'∞':parseFloat(currentProfile.tokens_balance||0).toFixed(2);const av=document.getElementById('userAvatar');if(av)av.textContent=(currentProfile.full_name||'U').charAt(0).toUpperCase();const w=document.getElementById('welcomeName');if(w)w.textContent=(currentProfile.full_name||'Usuario').split(' ')[0];const wr=document.getElementById('welcomeRole');if(wr)wr.textContent='Rol: '+(ROLE_LABELS[currentProfile.role]||'Usuario');document.getElementById('btnJoinKyc')?.classList.toggle('hidden',!!currentProfile.is_verified);buildUserMenu();}
async function handleLogout(){if(shareTimer)clearInterval(shareTimer);sharing=false;if(currentProfile?.role==='remote_worker'){localStorage.setItem('fendyx_online_intent','0');beaconOffline();}localStorage.removeItem('fendyx_last_section');await db.auth.signOut();location.replace('index.html');}
function moduleState(id){return (window._modulesConfig||{})[id]||'on';}
function buildBottomNav(){const nav=document.querySelector('.bottom-nav');if(!nav)return;const adultMods=window._adultModules||['girls'];const items=[{id:'dashboard',ico:'🏠',n:'Inicio'},{id:'map',ico:'',n:'Mapa'},{id:'radar',ico:'🌙',n:'Radar'},{id:'chat',ico:'💬',n:'Chat'},{id:'tokens',ico:'',n:'Tokens'}];nav.innerHTML=items.filter(it=>moduleState(it.id)!=='hidden'&&!adultMods.includes(it.id)).map(it=>{const st=moduleState(it.id);return `<button class="nav-item" data-nav="${it.id}" onclick="${st==='off'?`showLocked('${it.n}')`:`showSection('${it.id}')`}"><span class="nav-icon">${it.ico}</span><span class="nav-label">${it.n}</span></button>`;}).join('');}
function loadModules(){
  const role=currentProfile.role;
  const adultMods=window._adultModules||['girls'];
  let mods=[];
  for(const d of MODULE_DEFS){
    if(adultMods.includes(d.id))continue;
    if(d.id==='adults'&&role==='remote_worker')continue;
    if(d.id==='remote'&&role!=='remote_worker')continue;
    if(d.id==='delivery'&&role!=='delivery')continue;
    const st=moduleState(d.id);
    if(st==='hidden')continue;
    mods.push({id:d.id,n:d.n,state:st});
  }
  if(moduleState('tokens')!=='hidden')mods.push({id:'tokens',n:'Tokens',state:moduleState('tokens')});
  if(role==='remote_worker'&&currentProfile.kyc_status!=='approved')mods.unshift({id:'kyc',n:'Mi Verificación',state:'on'});
  document.getElementById('modulesGrid').innerHTML=mods.map(m=>`<div class="module-card ${m.state==='off'?'mod-locked':''}" onclick="${m.state==='off'?`showLocked('${m.n}')`:`showSection('${m.id}')`}"><span class="icon">${MODULE_ICONS[m.id]||'•'}</span><h3>${m.n}</h3>${m.state==='off'?'<span class="mod-lock"> Próximamente</span>':''}</div>`).join('');
  buildBottomNav();
}
const MODULE_FILES={map:'map.js',radar:'radar.js',events:'radar.js',restaurants:'restaurants.js',reservations:'restaurants.js',orders:'orders.js',delivery:'delivery.js',remote:'remote.js',adults:'remote.js',girls:'remote.js',kyc:'remote.js',marketplace:'market.js',chat:'chat.js',tokens:'tokens.js',profile:'profile.js',profileedit:'profile.js',admin:'admin.js',calls:'calls.js'};
const LOADERS={map:()=>{initMap();autoLocate();loadMapUsers();},radar:()=>loadRadar(),events:()=>loadEvents(),restaurants:()=>loadRestaurants(),reservations:()=>loadReservations(),orders:()=>loadOrders(),delivery:()=>loadDeliveryHub(),remote:()=>loadWorkers(),adults:()=>loadAdults(),girls:()=>loadAdults(),kyc:()=>fillKycForm(),marketplace:()=>loadMarketplace(),chat:()=>loadConversations(),tokens:()=>loadTransactions(),profile:()=>loadProfileSection(),profileedit:()=>fillProfilePro(),admin:()=>loadAdmin()};
function loadScript(file){if(loadedScripts[file])return loadedScripts[file];loadedScripts[file]=new Promise(res=>{const s=document.createElement('script');s.src='js/'+file;s.onload=res;s.onerror=res;document.body.appendChild(s);});return loadedScripts[file];}
let _currentAdultTab='girls';
function renderAdultTabs(){
  const tabsEl=document.getElementById('adultTabs');
  const contentEl=document.getElementById('adultContent');
  const gateEl=document.getElementById('adultsGate');
  if(!tabsEl||!contentEl)return;
  const adultMods=window._adultModules||['girls'];
  const ok=currentProfile.role==='admin'||currentProfile.kyc_status==='approved';
  if(!ok){
    gateEl.innerHTML=`<div class="req-gate"><h3>🔞 Área exclusiva para adultos verificados</h3><p class="dim">Debes completar tu <b>verificación de identidad (KYC)</b> para entrar.</p><div class="row-buttons" style="justify-content:center"><button class="btn-primary" onclick="showSection('profile')">🪪 Verificarme ahora</button></div></div>`;
    tabsEl.innerHTML='';contentEl.innerHTML='';return;
  }
  gateEl.innerHTML='';
  tabsEl.innerHTML=adultMods.map(m=>`<button class="adult-tab ${_currentAdultTab===m?'on':''}" onclick="switchAdultTab('${m}')">${ADULT_MODULE_NAMES[m]||m}</button>`).join('');
  loadAdultTabContent(_currentAdultTab);
}
function switchAdultTab(tab){_currentAdultTab=tab;renderAdultTabs();}
window.enterAdultModule=function(tab){_cameFromAdults=true;showSection(tab);};
async function loadAdultTabContent(tab){
  const contentEl=document.getElementById('adultContent');
  if(!contentEl)return;
  if(tab==='girls'){
    await loadScript('remote.js');
    if(typeof loadAdults==='function')await loadAdults();
    return;
  }
  const moduleInfo={
    map:{icon:'📍',name:'Mapa Social',desc:'Explora usuarios cercanos en tiempo real'},
    radar:{icon:'',name:'Radar Nocturno',desc:'Descubre la vida nocturna de tu ciudad'},
    chat:{icon:'💬',name:'Chat',desc:'Mensajes en tiempo real con otros usuarios'},
    events:{icon:'🎪',name:'Eventos',desc:'Próximos eventos y actividades'},
    marketplace:{icon:'🛒',name:'Marketplace',desc:'Compra y vende productos'},
    restaurants:{icon:'🍽️',name:'Restaurantes',desc:'Descubre los mejores lugares'},
    orders:{icon:'📦',name:'Pedidos',desc:'Sistema de pedidos y entregas'}
  };
  const info=moduleInfo[tab]||{icon:'📦',name:tab,desc:'Módulo disponible'};
  contentEl.innerHTML=`
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center">
      <div style="font-size:4rem;margin-bottom:16px;animation:gFloat 2s ease-in-out infinite">${info.icon}</div>
      <h2 style="margin:0 0 8px 0;font-size:1.5rem">${info.name}</h2>
      <p class="dim" style="margin:0 0 24px 0;max-width:400px">${info.desc}</p>
      <button class="btn-primary" style="padding:12px 32px;font-size:1rem" onclick="enterAdultModule('${tab}')">🚪 Entrar al módulo</button>
      <p class="dim" style="margin-top:16px;font-size:.8rem">Se abrirá en pantalla completa · Usa ← para volver</p>
    </div>`;
}
async function showSection(name){
  const adultMods=window._adultModules||['girls'];
  if(name==='adults'||adultMods.includes(name)){
    if(currentProfile.role!=='admin'&&currentProfile.kyc_status!=='approved'){
      showToast('🔞 Área +18: requiere verificación de identidad aprobada');
      showSection('dashboard');return;
    }
  }
  const def=MODULE_DEFS.find(d=>d.id===name);
  if(def){const st=moduleState(name);if(st==='off'){showLocked(def.n);return;}if(st==='hidden'){showSection('dashboard');return;}}
  document.querySelectorAll('.app-section').forEach(s=>s.classList.remove('active'));
  document.getElementById('section-'+name)?.classList.add('active');
  document.getElementById('userMenu')?.classList.add('hidden');
  try{localStorage.setItem('fendyx_last_section',name);}catch(e){}
  document.querySelectorAll('.bottom-nav .nav-item').forEach(n=>n.classList.toggle('active',n.dataset.nav===name));
  if(MODULE_FILES[name])await loadScript(MODULE_FILES[name]);
  if(LOADERS[name]){try{await LOADERS[name]();}catch(e){console.error(e);}}
  if(name==='adults'){
    _currentAdultTab='girls';
    _cameFromAdults=false;
    setTimeout(()=>renderAdultTabs(),100);
  }
  if(_cameFromAdults&&name!=='adults'){
    setTimeout(()=>{
      document.querySelectorAll('.btn-back').forEach(btn=>{
        if(btn.textContent.includes('Volver')||btn.textContent.includes('←')){
          btn.onclick=(e)=>{e.preventDefault();_cameFromAdults=false;showSection('adults');};
          btn.textContent='← Área Adultos';
        }
      });
    },200);
  }
}
function isIOS(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}
function getPos(){return new Promise(res=>{if(!navigator.geolocation)return res(null);const opts=isIOS()?{enableHighAccuracy:false,timeout:15000,maximumAge:30000}:{enableHighAccuracy:true,timeout:10000,maximumAge:0};navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lng:p.coords.longitude}),err=>{if(err.code===1){showToast(isIOS()?'📍 iOS: Ajustes → Privacidad → Localización → Safari → permitir':' Permiso denegado');return res(null);}navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lng:p.coords.longitude}),()=>res(null),{enableHighAccuracy:!opts.enableHighAccuracy,timeout:15000,maximumAge:60000});},opts);});}
async function toggleShareLocation(){const btn=document.getElementById('btnShareLocation');if(sharing){sharing=false;if(shareTimer)clearInterval(shareTimer);await db.from('user_locations').update({is_sharing:false}).eq('user_id',currentUser.id);if(btn)btn.textContent='📡 Compartir ubicación';showToast('📴 Dejaste de compartir');return;}const first=await getPos();if(!first)return;sharing=true;myLocation=first;await db.from('user_locations').upsert({user_id:currentUser.id,latitude:first.lat,longitude:first.lng,is_sharing:true},{onConflict:'user_id'});if(btn)btn.textContent='🔴 EN VIVO (tocar para parar)';if(map)map.setView([first.lat,first.lng],14);loadMapUsers();shareTimer=setInterval(async()=>{const p=await getPos();if(!p||!sharing)return;myLocation=p;await db.from('user_locations').upsert({user_id:currentUser.id,latitude:p.lat,longitude:p.lng,is_sharing:true},{onConflict:'user_id'});loadMapUsers();},6000);showToast('📡 Compartiendo ubicación');}
function autoLocate(){if(!sharing)toggleShareLocation();}
function haversine(a,b,c,d){const R=6371000,t=x=>x*Math.PI/180;const dLa=t(c-a),dLo=t(d-b);const h=Math.sin(dLa/2)**2+Math.cos(t(a))*Math.cos(t(c))*Math.sin(dLo/2)**2;return R*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
function fmtDist(m){return m<1000?Math.round(m)+' m':(m/1000).toFixed(1)+' km';}
function stars(r){const n=Math.round(parseFloat(r)||0);return '★★★★★'.slice(0,n)+'☆☆☆☆☆'.slice(0,5-n);}
function driverLevel(n){return n>=150?'💎 Élite':n>=50?'🥇 Experto':n>=10?'🥈 Confiable':'🥉 Nuevo';}
function openModal(id){document.getElementById(id)?.classList.remove('hidden');}
function closeModal(id){document.getElementById(id)?.classList.add('hidden');}
function showToast(msg){const t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.classList.remove('hidden');clearTimeout(window._tt);window._tt=setTimeout(()=>t.classList.add('hidden'),2800);}
async function deductTokens(amount,desc){if(currentProfile.unlimited_tokens)return;if(currentProfile.tokens_locked){showToast('🔒 Tokens bloqueados por el admin');return false;}const avail=parseFloat(currentProfile.tokens_balance||0)-parseFloat(currentProfile.tokens_retained||0);if(avail<amount){showToast(' Saldo disponible insuficiente');return false;}const nb=parseFloat(currentProfile.tokens_balance)-amount;await db.from('profiles').update({tokens_balance:nb}).eq('id',currentUser.id);await db.from('token_transactions').insert({user_id:currentUser.id,amount:-amount,type:'consumption',description:desc});currentProfile.tokens_balance=nb;updateHeader();return true;}
async function addTokens(amount,desc){const nb=parseFloat(currentProfile.tokens_balance||0)+amount;await db.from('profiles').update({tokens_balance:nb}).eq('id',currentUser.id);await db.from('token_transactions').insert({user_id:currentUser.id,amount,type:'transfer',description:desc});currentProfile.tokens_balance=nb;updateHeader();}
function startRealtime(){if(liveChannel)return;liveChannel=db.channel('fendyx-live')
 .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},p=>{if(typeof onMessageRealtime==='function')onMessageRealtime(p.new);})
 .on('postgres_changes',{event:'INSERT',schema:'public',table:'panic_alerts'},()=>{if(currentProfile.role==='admin'){showToast('🆘 ¡ALERTA DE PÁNICO!');navigator.vibrate?.([300,100,300]);}})
 .on('postgres_changes',{event:'INSERT',schema:'public',table:'show_offers'},p=>{if(currentProfile.role==='remote_worker'&&typeof loadShowOffers==='function')loadShowOffers();})
 .on('postgres_changes',{event:'INSERT',schema:'public',table:'show_offer_responses'},p=>{if(typeof loadMyShowResponses==='function')loadMyShowResponses();})
 .on('postgres_changes',{event:'*',schema:'public',table:'role_details'},()=>{if(document.getElementById('section-adults')?.classList.contains('active')&&_currentAdultTab==='girls')loadAdults();if(typeof loadWorkers==='function'&&document.getElementById('section-remote')?.classList.contains('active'))loadWorkers();if(typeof loadWorkersAdmin==='function'&&document.getElementById('admin-workers')?.classList.contains('active'))loadWorkersAdmin();})
 .on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles'},async p=>{if(p.new.id===currentUser.id){await loadProfile();await ensureAutoActive();updateHeader();if(document.getElementById('section-tokens')?.classList.contains('active'))loadTransactions?.();}if(document.getElementById('section-adults')?.classList.contains('active')&&_currentAdultTab==='girls')loadAdults();})
 .on('postgres_changes',{event:'UPDATE',schema:'public',table:'recharge_requests'},p=>{if(p.new.user_id===currentUser.id){showToast(p.new.status==='approved'?'✅ Recarga aprobada':p.new.status==='rejected'?' Recarga rechazada':'');updateHeader();if(document.getElementById('section-tokens')?.classList.contains('active'))loadTransactions?.();}})
 .on('postgres_changes',{event:'INSERT',schema:'public',table:'video_calls'},async p=>{if(p.new.worker_id===currentUser.id&&p.new.status==='active'){await loadScript('calls.js');if(typeof showIncomingCall==='function')showIncomingCall(p.new);}})
 .on('postgres_changes',{event:'UPDATE',schema:'public',table:'video_calls'},async p=>{if(p.new.status==='ended'&&(p.new.worker_id===currentUser.id||p.new.client_id===currentUser.id)){await loadScript('calls.js');if(typeof remoteHungUp==='function')remoteHungUp(p.new);}})
 .on('postgres_changes',{event:'*',schema:'public',table:'orders'},()=>{if(typeof loadOrders==='function'&&document.getElementById('section-orders')?.classList.contains('active'))loadOrders();if(typeof loadDeliveryHub==='function'&&document.getElementById('section-delivery')?.classList.contains('active'))loadDeliveryHub();})
 .on('postgres_changes',{event:'*',schema:'public',table:'radar_presences'},()=>{if(typeof loadRadarUsers==='function'&&document.getElementById('section-radar')?.classList.contains('active'))loadRadarUsers();})
 .on('postgres_changes',{event:'INSERT',schema:'public',table:'recharge_requests'},()=>{if(currentProfile.role==='admin'&&typeof loadRechargeRequests==='function'&&document.getElementById('admin-recharges')?.classList.contains('active'))loadRechargeRequests();})
 .on('postgres_changes',{event:'UPDATE',schema:'public',table:'app_branding'},()=>loadBranding().then(()=>{if(currentProfile){loadModules();}}))
 .subscribe();}
