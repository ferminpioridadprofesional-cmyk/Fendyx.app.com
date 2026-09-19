'use strict';
let _girlsList=[];let wkLbUrls=[],wkLbIdx=0,wkLbX=0;
const _we={interests:new Set(),preferences:new Set(),zodiac:null};
const CAT_ORDER=[{id:4,name:'⭐ Modelos Destacadas'},{id:3,name:'💎 Modelos'},{id:2,name:'🌙 Medias'},{id:1,name:'🌸 Inicial'}];
const DEFAULT_GIRL_CATS=[{id:1,name:'Inicial'},{id:2,name:'Medias'},{id:3,name:'Modelos'},{id:4,name:'Modelos Destacadas'}];
function girlCats(){return window._girlCategories||DEFAULT_GIRL_CATS;}
async function loadGirlCats(){try{const{data}=await db.from('app_branding').select('girl_categories').eq('id',1).single();window._girlCategories=data?.girl_categories||DEFAULT_GIRL_CATS;}catch(e){window._girlCategories=DEFAULT_GIRL_CATS;}}
function isNewGirl(created){if(!created)return false;return (Date.now()-new Date(created).getTime())<=3*24*60*60*1000;}
function toggleWChip(el,g,v){const s=_we[g];if(s.has(v)){s.delete(v);el.classList.remove('active');}else{s.add(v);el.classList.add('active');}}
function pickWZodiac(el,v){_we.zodiac=v;document.querySelectorAll('.wz-chip').forEach(z=>z.classList.remove('active'));el.classList.add('active');}
function injectGirlStyle(){if(document.getElementById('fendyx-girl-style'))return;const st=document.createElement('style');st.id='fendyx-girl-style';st.textContent=`
 @keyframes gFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
 @keyframes gShine{0%{background-position:-200% 0}100%{background-position:200% 0}}
 @keyframes gPulse{0%,100%{box-shadow:0 0 6px rgba(0,255,157,.4)}50%{box-shadow:0 0 16px rgba(0,255,157,.8)}}
 @keyframes topPulse{0%,100%{box-shadow:0 0 20px rgba(255,215,0,.6)}50%{box-shadow:0 0 40px rgba(255,215,0,.9)}}
 .adult-section{margin:16px 0;padding:14px;border-radius:18px;background:rgba(255,255,255,.02);border:1px solid var(--border)}
 .adult-section h3{margin:0 0 12px 0;font-size:1.1rem;display:flex;align-items:center;gap:8px}
 .adult-section h3 .cat-badge{font-size:.7rem;padding:3px 10px;border-radius:999px;background:var(--gradient);color:#04060c;font-weight:800}
 .girls-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
 @media(max-width:768px){.girls-row{grid-template-columns:repeat(2,1fr);}}
 .girl-card-sm{padding:10px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid var(--border);position:relative;transition:transform .18s,box-shadow .18s;cursor:pointer}
 .girl-card-sm:hover{transform:translateY(-3px);box-shadow:0 8px 20px rgba(0,0,0,.4)}
 .girl-card-sm .sm-photo{width:100%;height:110px;border-radius:10px;overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center;margin-bottom:6px}
 .girl-card-sm .sm-photo img{width:100%;height:100%;object-fit:cover;-webkit-object-fit:cover;object-position:center}
 .girl-card-sm .sm-name{font-weight:800;font-size:.85rem;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .girl-card-sm .sm-meta{display:flex;justify-content:space-between;align-items:center;font-size:.72rem;color:var(--dim);margin-bottom:6px}
 .girl-card-sm .sm-stars{color:#ffd700;font-size:.78rem}
 .girl-card-sm .sm-rate{color:var(--primary);font-weight:800}
 .girl-card-sm .sm-btns{display:flex;gap:4px}
 .girl-card-sm .sm-btns button{flex:1;padding:5px;font-size:.72rem;border-radius:8px}
 .new-tag-sm{position:absolute;top:6px;left:6px;background:linear-gradient(100deg,#00ff9d,#00d9ff);color:#042;font-weight:900;font-size:.6rem;padding:2px 8px;border-radius:999px;animation:gPulse 1.6s infinite;z-index:2;letter-spacing:1px}
 .see-more-btn{display:block;margin:12px auto 0;padding:8px 20px;border-radius:999px;background:rgba(0,217,255,.12);border:1px solid var(--primary);color:var(--primary);font-weight:800;font-size:.85rem;cursor:pointer;transition:all .2s}
 .see-more-btn:hover{background:var(--primary);color:#04060c;transform:translateY(-2px)}
 .mosaic-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:10px 0}
 @media(max-width:768px){.mosaic-grid{grid-template-columns:repeat(2,1fr);}}
 .girl-card{padding:14px;position:relative;transition:transform .18s ease,box-shadow .18s ease}
 .girl-card:hover{transform:translateY(-4px);box-shadow:0 10px 26px rgba(0,0,0,.45)}
 .new-tag{position:absolute;top:8px;left:8px;background:linear-gradient(100deg,#00ff9d,#00d9ff);color:#042;font-weight:900;font-size:.7rem;padding:4px 12px;border-radius:999px;animation:gPulse 1.6s infinite;z-index:2;letter-spacing:1px}
 .girl-photo{width:64%;max-width:210px;height:170px;margin:0 auto;border-radius:14px;overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid var(--border)}
 .girl-photo img{width:100%;height:100%;object-fit:contain;-webkit-object-fit:contain;object-position:center;transition:transform .25s}
 .girl-card:hover .girl-photo img{transform:scale(1.05)}
 .girl-initial{font-size:3rem;color:var(--dim)}
 .girl-thumbs{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;justify-content:center}
 .girl-thumbs img{width:52px;height:52px;object-fit:cover;-webkit-object-fit:cover;object-position:center;border-radius:9px;border:1px solid var(--border);cursor:pointer;transition:transform .15s}
 .girl-thumbs img:hover{transform:scale(1.12)}
 .girl-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap}
 .pf-hero{display:flex;gap:14px;align-items:center;margin-bottom:12px;position:relative}
 .pf-hero img,.pf-hero-letter{width:84px;height:84px;border-radius:50%;object-fit:cover;-webkit-object-fit:cover;flex-shrink:0;cursor:pointer}
 .pf-hero-letter{background:var(--gradient);color:#04060c;display:flex;align-items:center;justify-content:center;font-size:2.2rem;font-weight:900}
 .pf-meta{flex:1;text-align:left}
 .pf-meta b{font-size:1.25rem;display:block;margin-bottom:4px}
 .pf-gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}
 .pf-gallery img{width:100%;height:96px;object-fit:cover;-webkit-object-fit:cover;object-position:center;border-radius:12px;border:1px solid var(--border);cursor:pointer;transition:transform .18s}
 .pf-gallery img:hover{transform:scale(1.06)}
 .wk-card{padding:18px;border-radius:16px;border:1px solid var(--border);background:rgba(255,255,255,.03);text-align:center}
 .wk-name{font-family:'Orbitron';font-weight:900;font-size:1.3rem;margin-bottom:8px}
 .wk-row{display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0}
 .wk-rate{font-weight:800;color:var(--primary)}
 .wk-kyc{font-size:.85rem;color:var(--dim);margin:6px 0 14px}
 .wk-switch-row{display:flex;justify-content:center;align-items:center;gap:14px}
 .wk-state{font-weight:900;font-size:.95rem}
 .wk-state.on{color:var(--success)}.wk-state.off{color:var(--error)}
 .wk-switch{position:relative;display:inline-block;width:64px;height:32px}
 .wk-switch input{opacity:0;width:0;height:0}
 .wk-slider{position:absolute;inset:0;border-radius:999px;background:rgba(255,59,107,.25);border:1px solid var(--error);transition:.3s;cursor:pointer}
 .wk-slider:before{content:'';position:absolute;width:26px;height:26px;left:3px;top:2px;border-radius:50%;background:var(--error);transition:.3s;box-shadow:0 0 10px rgba(255,59,107,.6)}
 .wk-switch input:checked + .wk-slider{background:rgba(0,255,157,.2);border-color:var(--success);animation:gPulse 1.6s infinite}
 .wk-switch input:checked + .wk-slider:before{transform:translateX(32px);background:var(--success);box-shadow:0 0 14px rgba(0,255,157,.8)}
 .wk-pro{margin-top:14px;text-align:left;border-top:1px solid var(--border);padding-top:12px}
 .show-offer-btn{margin:16px auto;display:block;padding:14px 28px;border-radius:14px;background:linear-gradient(100deg,#ff2d95,#7b2bff);color:#fff;border:none;font-weight:800;font-size:1.05rem;cursor:pointer;box-shadow:0 0 24px rgba(255,45,149,.6);transition:all .2s;letter-spacing:.5px}
 .show-offer-btn:hover{transform:translateY(-2px);box-shadow:0 0 36px rgba(255,45,149,.8)}
 .top-models-section{padding:24px 10px;text-align:center;background:rgba(255,215,0,.04);border-radius:18px;margin:16px 0;border:1px solid rgba(255,215,0,.2)}
 .top-models-section h3{margin:0 0 16px 0;font-size:1.3rem;color:#ffd700;text-shadow:0 0 10px rgba(255,215,0,.4)}
 .top-podium{display:flex;justify-content:center;align-items:flex-end;gap:20px;margin:20px 0}
 .top-spot{display:flex;flex-direction:column;align-items:center;cursor:pointer;transition:transform .2s}
 .top-spot:hover{transform:scale(1.08)}
 .top-spot .top-photo{width:80px;height:80px;border-radius:50%;object-fit:cover;-webkit-object-fit:cover;border:3px solid var(--border);background:#000}
 .top-spot.top-1 .top-photo{width:110px;height:110px;border-color:#ffd700;animation:topPulse 2s infinite;box-shadow:0 0 30px rgba(255,215,0,.7)}
 .top-spot.top-2 .top-photo,.top-spot.top-3 .top-photo{border-color:#c0c0c0;box-shadow:0 0 15px rgba(192,192,192,.4)}
 .top-spot .top-rank{font-size:1.6rem;font-weight:900;margin-top:8px}
 .top-spot.top-1 .top-rank{color:#ffd700;font-size:2.2rem;text-shadow:0 0 10px rgba(255,215,0,.6)}
 .top-spot .top-name{font-size:.9rem;font-weight:700;margin-top:4px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}
 .top-spot .top-rate{font-size:.78rem;color:var(--dim);margin-top:2px}
 .wk-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0;padding:10px;background:rgba(0,0,0,.2);border-radius:12px}
 .wk-stat{text-align:center}
 .wk-stat .stat-val{font-size:1.1rem;font-weight:900;color:var(--primary)}
 .wk-stat .stat-label{font-size:.7rem;color:var(--dim);margin-top:2px}`;document.head.appendChild(st);}
function ensureWkLightbox(){if(document.getElementById('wkLightbox'))return;const lb=document.createElement('div');lb.id='wkLightbox';lb.className='lb-wrap hidden';document.body.appendChild(lb);lb.addEventListener('touchstart',e=>{wkLbX=e.touches[0].clientX;});lb.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-wkLbX;if(dx>50)wkLbStep(-1);else if(dx<-50)wkLbStep(1);});}
function wkOpenLightbox(urls,idx){ensureWkLightbox();wkLbUrls=urls||[];wkLbIdx=idx||0;const lb=document.getElementById('wkLightbox');lb.innerHTML=`<button class="lb-close" onclick="wkCloseLightbox()">✕</button><button class="lb-btn lb-prev" onclick="wkLbStep(-1)">‹</button><img src="${wkLbUrls[wkLbIdx]||''}"><button class="lb-btn lb-next" onclick="wkLbStep(1)">›</button><div class="lb-dots">${wkLbUrls.map((_,i)=>`<span class="${i===wkLbIdx?'on':''}"></span>`).join('')}</div>`;lb.classList.remove('hidden');}
function wkLbStep(d){wkLbIdx=(wkLbIdx+d+wkLbUrls.length)%wkLbUrls.length;wkOpenLightbox(wkLbUrls,wkLbIdx);}
function wkCloseLightbox(){document.getElementById('wkLightbox')?.classList.add('hidden');}
function ensureWkModal(){if(document.getElementById('wkProfileModal'))return;const m=document.createElement('div');m.id='wkProfileModal';m.className='modal hidden';m.innerHTML=`<div class="modal-content wide" id="wkModalContent"></div>`;document.body.appendChild(m);}

// ===== Helper: obtener role_details de forma robusta (objeto o array) =====
function getRoleDetails(data){
  if(!data)return null;
  const rd=data.role_details;
  if(!rd)return null;
  if(Array.isArray(rd))return rd[0]||null;
  if(typeof rd==='object')return rd;
  return null;
}
// ===== Helper: calcular tasa de aceptación =====
function calcAcceptanceRate(p){
  const acc=parseInt(p.calls_accepted||0);
  const rej=parseInt(p.calls_rejected||0);
  const total=acc+rej;
  if(total===0)return 0;
  return Math.round((acc/total)*100);
}

function renderWkProfile(data,preview){
  ensureWkModal();injectGirlStyle();
  const rd=getRoleDetails(data);
  const lv=Math.min(5,Math.max(1,parseInt(rd?.worker_level||data.worker_level||1)));
  const net=rd?.rate_per_minute!=null?parseFloat(rd.rate_per_minute):levelInfo(lv).rate;
  const shown=preview?net:net*2;
  const name=data.model_name||'Modelo';
  const photos=(data.worker_gallery||[]).slice(0,5);
  const acceptanceRate=calcAcceptanceRate(data);
  const callsAcc=parseInt(data.calls_accepted||0);
  const callsRej=parseInt(data.calls_rejected||0);
  const box=document.getElementById('wkModalContent');
  box.className='modal-content wide tier-'+lv;
  box.innerHTML=`
   <div class="modal-head"><h3>${name} ${isNewGirl(data.created_at)?'<span class="new-tag">NEW</span>':''}</h3><button class="modal-close" onclick="closeModal('wkProfileModal')">✕</button></div>
   <div class="pf-hero">${(data.avatar_url||photos[0])?`<img src="${data.avatar_url||photos[0]}" onclick='wkOpenLightbox(${JSON.stringify(photos.length?photos:[data.avatar_url])},0)'>`:`<div class="pf-hero-letter">${name.charAt(0).toUpperCase()}</div>`}
    <div class="pf-meta"><b>${name}${data.age?' · '+data.age:''}</b>${levelBadge(lv)} <span class="dim">⭐ ${parseFloat(data.rating||5).toFixed(1)}</span><div style="margin-top:6px">◈ ${shown}/min</div>${data.zodiac?`<div class="dim">${data.zodiac}</div>`:''}</div></div>
   <div class="wk-stats">
     <div class="wk-stat"><div class="stat-val">${acceptanceRate}%</div><div class="stat-label">Tasa aceptación</div></div>
     <div class="wk-stat"><div class="stat-val">${callsAcc}</div><div class="stat-label">Llamadas aceptadas</div></div>
     <div class="wk-stat"><div class="stat-val">${callsRej}</div><div class="stat-label">Llamadas rechazadas</div></div>
   </div>
   <p class="dim">${data.bio||rd?.bio||''}</p>
   <div class="chips-row">${(data.interests||[]).map(i=>`<span class="chip active"> ${i}</span>`).join('')}${(data.preferences||[]).map(i=>`<span class="chip">💫 ${i}</span>`).join('')}</div>
   <h4 class="sub-title">📸 Galería</h4><div class="pf-gallery">${photos.map((u,i)=>`<img src="${u}" onclick='wkOpenLightbox(${JSON.stringify(photos)},${i})'>`).join('')||'<p class="dim">Sin fotos</p>'}</div>
   <div style="margin-top:12px">${preview?'<p class="dim">Vista previa (solo lectura) · TU ganancia: ◈ '+net+'/min</p>':`<button class="btn-primary" onclick="closeModal('wkProfileModal');startCall('${data.id}',${net})">📹 Llamar ·  ${shown}/min</button>`}</div>`;
  openModal('wkProfileModal');
}
window._rwRenderProfile=async function(userId,preview){
  const{data}=await db.from('profiles').select('*, role_details(*)').eq('id',userId).single();
  if(!data)return;
  renderWkProfile(data,preview);
};
async function openWorkerProfile(id){await window._rwRenderProfile(id,false);}
async function previewWorkerProfile(){await window._rwRenderProfile(currentUser.id,true);}
async function openGirlGallery(idx,i){const g=(_girlsList[idx]?.gallery)||[];if(!g.length)return;wkOpenLightbox(g,i);}
function girlCardSmall(w){
  const lvNum=Math.min(5,Math.max(1,parseInt(w.worker_level)||1));
  const clientRate=parseFloat(w.client_rate)||2;
  const name=w.display_name||'Modelo';
  const mainPhoto=w.avatar_url||(w.gallery||[])[0]||'';
  const stars=parseFloat(w.avg_rating||w.rating||5).toFixed(1);
  return `<div class="girl-card-sm tier-${lvNum}">
   ${isNewGirl(w.created_at)?'<span class="new-tag-sm">NEW</span>':''}
   <div class="sm-photo" onclick="openWorkerProfile('${w.id}')">${mainPhoto?`<img src="${mainPhoto}">`:`<span class="girl-initial">${name.charAt(0)}</span>`}</div>
   <div class="sm-name">${name}${w.age?', '+w.age:''}</div>
   <div class="sm-meta"><span class="sm-stars">⭐ ${stars}</span><span class="sm-rate"> ${clientRate}/min</span></div>
   <div class="sm-btns">
     <button class="btn-small" onclick="openWorkerProfile('${w.id}')">👤</button>
     <button class="btn-small success" onclick="startCall('${w.id}',${parseFloat(w.rate)||1})" ${w.is_online?'':'disabled'}></button>
   </div></div>`;}
function girlCard(w,idx){
  const lvNum=Math.min(5,Math.max(1,parseInt(w.worker_level)||1));
  const clientRate=parseFloat(w.client_rate)||2;
  const name=w.display_name||'Modelo';
  const gallery=w.gallery||[];
  const mainPhoto=w.avatar_url||gallery[0]||'';
  return `<div class="card-item girl-card tier-${lvNum}">
   ${isNewGirl(w.created_at)?'<span class="new-tag">NEW</span>':''}
   <div class="girl-photo" onclick="openGirlGallery(${idx},0)">${mainPhoto?`<img src="${mainPhoto}" alt="">`:`<span class="girl-initial">${name.charAt(0).toUpperCase()}</span>`}</div>
   ${gallery.length?`<div class="girl-thumbs">${gallery.map((g,i)=>`<img src="${g}" alt="" onclick="openGirlGallery(${idx},${i})">`).join('')}</div>`:''}
   <div class="girl-head"><div class="card-title" style="margin:0">${name}${w.age?', '+w.age:''}</div>${levelBadge(lvNum)}</div>
   <span class="status-pill ${w.is_online?'online':'offline'}">${w.is_online?'EN LÍNEA':'DESCONECTADA'}</span>
   <span class="role-badge">◈ ${clientRate}/min</span> <span class="dim">⭐ ${parseFloat(w.rating||5).toFixed(1)}</span>
   <div class="chips-row" style="margin:6px 0">${(w.interests||[]).slice(0,3).map(i=>`<span class="chip">🎯 ${i}</span>`).join('')}</div>
   <div class="row-actions"><button class="btn-small" onclick="openWorkerProfile('${w.id}')">👤 Ver perfil</button><button class="btn-small success" onclick="startCall('${w.id}',${parseFloat(w.rate)||1})" ${w.is_online?'':'disabled'}>📹 Llamar</button></div></div>`;}

// ===== FIX: botón "Ver más" aparece siempre que haya al menos 1 modelo =====
function renderCategorySection(catId,catName,models){
  const top4=models.slice(0,4);
  const hasModels=models.length>=1;
  return `<div class="adult-section">
   <h3>${catName} <span class="cat-badge">${models.length} modelo${models.length!==1?'s':''}</span></h3>
   ${top4.length?`<div class="girls-row">${top4.map(w=>girlCardSmall(w)).join('')}</div>`:'<p class="dim" style="text-align:center;padding:20px">Sin modelos en esta categoría aún</p>'}
   ${hasModels?`<button class="see-more-btn" onclick="loadCategoryFull(${catId},'${catName.replace(/'/g,"\\'")}')">✨ Ver todas las modelos de ${catName} (${models.length})</button>`:''}
  </div>`;}

async function loadAdults(){
  injectGirlStyle();
  await loadGirlCats();
  const contentEl=document.getElementById('adultContent');
  if(!contentEl){console.error('adultContent no existe');return;}
  
  // TOP Modelos + Botón Ofertar Show justo debajo
  let html=`
    <div class="top-models-section" id="topModelsSection">
      <h3>🏆 TOP Modelos del Día</h3>
      <p class="dim">Cargando…</p>
    </div>`;
  
  // Botón Ofertar Show (solo clientes) - AHORA VA DESPUÉS DEL TOP
  if(currentProfile.role!=='remote_worker'){
    html+=`<button class="show-offer-btn" onclick="openShowOfferModal()">🎭 Ofertar Show Privado</button>`;
  }
  
  // Categorías
  for(const cat of CAT_ORDER){
    try{
      const{data,error}=await db.rpc('get_top_models',{p_cat:cat.id,p_days:30,p_limit:4});
      if(error){console.error('Error get_top_models:',error);html+=`<div class="adult-section"><h3>${cat.name}</h3><p class="dim">Error al cargar</p></div>`;continue;}
      const models=(typeof data==='string'?JSON.parse(data):data)||[];
      html+=renderCategorySection(cat.id,cat.name,models);
    }catch(e){console.error('Error loading category:',e);html+=`<div class="adult-section"><h3>${cat.name}</h3><p class="dim">No disponible</p></div>`;}
  }
  
  contentEl.innerHTML=html;
  
  try{await loadTopModels();}catch(e){console.error('Error loading top models:',e);const s=document.getElementById('topModelsSection');if(s)s.innerHTML='<h3>🏆 TOP Modelos del Día</h3><p class="dim">No disponible temporalmente</p>';}
}

async function loadTopModels(){
  const section=document.getElementById('topModelsSection');
  if(!section){console.error('topModelsSection no existe');return;}
  try{
    const{data,error}=await db.rpc('get_daily_top_models');
    if(error){console.error('Error get_daily_top_models:',error);section.innerHTML='<h3>🏆 TOP Modelos del Día</h3><p class="dim">Función no disponible</p>';return;}
    const models=(typeof data==='string'?JSON.parse(data):data)||[];
    if(models.length===0){section.innerHTML='<h3> TOP Modelos del Día</h3><p class="dim">Sin datos aún</p>';return;}
    const order=[1,0,2];
    const positions=['top-2','top-1','top-3'];
    const medals=['','🥇','🥉'];
    let html='<h3>🏆 TOP Modelos del Día</h3><div class="top-podium">';
    order.forEach((idx,i)=>{
      const m=models[idx];
      if(m){
        html+=`<div class="top-spot ${positions[i]}" onclick="openWorkerProfile('${m.id}')">
          <img class="top-photo" src="${m.avatar_url||''}" alt="${m.display_name}" onerror="this.style.display='none'">
          <div class="top-rank">${medals[i]}</div>
          <div class="top-name">${m.display_name}</div>
          <div class="top-rate">◈ ${m.client_rate}/min · ⭐ ${m.acceptance_rate||0}%</div>
        </div>`;
      }
    });
    html+='</div>';
    section.innerHTML=html;
  }catch(e){console.error('Error en loadTopModels:',e);section.innerHTML='<h3>🏆 TOP Modelos del Día</h3><p class="dim">Error al cargar</p>';}
}

async function openShowOfferModal(){
  if(currentProfile.role==='remote_worker'){showToast('⚠️ Las modelos no pueden ofertar shows');return;}
  const desc=prompt('🎭 Describe el show que deseas:\n(Ej: baile privado, conversación íntima, etc.)');
  if(!desc||!desc.trim()){showToast('❌ Descripción requerida');return;}
  const amount=parseFloat(prompt('💰 Cantidad de tokens que ofreces:'));
  if(isNaN(amount)||amount<1){showToast('❌ Monto inválido (mínimo 1 token)');return;}
  const balance=parseFloat(currentProfile.tokens_balance||0);
  if(balance<amount){showToast('❌ Saldo insuficiente');return;}
  try{
    const{data,error}=await db.from('show_offers').insert({client_id:currentUser.id,description:desc.trim(),amount:amount,status:'pending'}).select().single();
    if(error){console.error('Error inserting show offer:',error);showToast('❌ Error al enviar oferta: '+error.message);return;}
    showToast('✅ Oferta enviada a todas las modelos');
  }catch(e){console.error('Error en openShowOfferModal:',e);showToast('❌ Error inesperado');}
}

async function loadCategoryFull(catId,catName){
  injectGirlStyle();
  const contentEl=document.getElementById('adultContent');
  if(!contentEl)return;
  contentEl.innerHTML=`<div class="section-header" style="margin-bottom:10px"><h2>${catName}</h2><button class="btn-back" onclick="loadAdults()">← Volver</button></div><p class="dim" style="text-align:center">Cargando…</p>`;
  try{
    const{data,error}=await db.rpc('get_category_models',{p_cat:catId});
    if(error){console.error('Error get_category_models:',error);contentEl.innerHTML=`<div class="section-header"><h2>${catName}</h2><button class="btn-back" onclick="loadAdults()">← Volver</button></div><p class="empty-state">Error: ${error.message}</p>`;return;}
    const models=(typeof data==='string'?JSON.parse(data):data)||[];
    _girlsList=models;
    contentEl.innerHTML=`<div class="section-header" style="margin-bottom:10px"><h2>${catName}</h2><button class="btn-back" onclick="loadAdults()">← Volver</button></div><div class="mosaic-grid">${models.map((w,i)=>girlCard(w,i)).join('')||'<p class="empty-state">Sin modelos</p>'}</div>`;
  }catch(e){console.error('Error loading full category:',e);contentEl.innerHTML=`<div class="section-header"><h2>${catName}</h2><button class="btn-back" onclick="loadAdults()">← Volver</button></div><p class="empty-state">Error al cargar</p>`;}
}

async function loadWorkers(){
  const isWorker=currentProfile.role==='remote_worker';
  const grid=document.getElementById('workersGrid');
  const panel=document.getElementById('workerPanel');
  if(isWorker){
    injectGirlStyle();
    grid.style.display='none';grid.innerHTML='';
    panel.classList.remove('hidden');
    const p=currentProfile;
    const lvNum=Math.min(5,Math.max(1,parseInt(roleDetails?.worker_level)||1));
    const net=roleDetails?.rate_per_minute!=null?roleDetails.rate_per_minute:levelInfo(lvNum).rate;
    const on=!!p.is_online;
    _we.interests=new Set(p.interests||[]);_we.preferences=new Set(p.preferences||[]);_we.zodiac=p.zodiac||null;
    pmInit('pmWorker',(p.worker_gallery||[]),5);
    const INTERESTS=['Música','Cine','Viajes','Gym','Lectura','Arte','Moda','Gaming','Cocina','Baile','Fotografía','Naturaleza'];
    const PREFERENCES=['Viajar','Coquetear','Música','Citas','Conversar','Cine y series','Cenas','Baile','Juegos','Deportes'];
    const ZODIAC=['♈ Aries',' Tauro','♊ Géminis','♋ Cáncer','♌ Leo','♍ Virgo','♎ Libra','♏ Escorpio','♐ Sagitario','♑ Capricornio','♒ Acuario','♓ Piscis'];
    panel.innerHTML=`<h3>💼 Mi Trabajo</h3><div class="wk-card tier-${lvNum}">
     <div class="wk-name"> ${p.model_name||'Modelo'}</div>
     <div class="wk-row">${levelBadge(lvNum)} <span class="wk-rate">TU ganancia: ◈ ${net}/min</span></div>
     <div class="wk-kyc">${p.kyc_status==='approved'?'✅ Verificación KYC aprobada':'⏳ Verificación KYC pendiente'}</div>
     <div class="wk-switch-row"><span id="wkState" class="wk-state ${on?'on':'off'}">${on?'🟢 EN LÍNEA':'🔴 DESCONECTADA'}</span><label class="wk-switch"><input type="checkbox" id="wkToggle" ${on?'checked':''} onchange="setWorkerOnline(this.checked)"><span class="wk-slider"></span></label></div>
     <p class="dim" style="margin-top:12px">Solo recibes llamadas con la app/página <b>abierta</b> y el switch en verde.</p>
     <div class="row-buttons" style="margin-top:10px"><button class="btn-secondary half" onclick="previewWorkerProfile()">👁 Previsualizar perfil</button></div>
     <div class="wk-pro"><h4 class="sub-title"> Mi Perfil de Modelo</h4><form class="owner-form" onsubmit="saveWorkerPro(event)">
      <label class="dim">Nombre artístico</label><input type="text" id="wpModel" value="${p.model_name||''}">
      <label class="dim">Fotos de modelo (máx 5)</label><div id="pmWorker" class="pm-grid"></div>
      <label class="dim">Descripción</label><textarea id="wpBio" rows="3">${p.bio||''}</textarea>
      <label class="dim"> Intereses</label><div class="chips-row">${INTERESTS.map(i=>`<span class="chip ${_we.interests.has(i)?'active':''}" onclick="toggleWChip(this,'interests','${i}')">${i}</span>`).join('')}</div>
      <label class="dim">💫 Preferencias</label><div class="chips-row">${PREFERENCES.map(i=>`<span class="chip ${_we.preferences.has(i)?'active':''}" onclick="toggleWChip(this,'preferences','${i}')">${i}</span>`).join('')}</div>
      <label class="dim">✨ Zodiaco</label><div class="chips-row">${ZODIAC.map(z=>`<span class="chip wz-chip ${_we.zodiac===z?'active':''}" onclick="pickWZodiac(this,'${z}')">${z}</span>`).join('')}</div>
      <button type="submit" class="btn-primary"> Guardar Perfil de Modelo</button></form></div></div>`;
    pmRender('pmWorker');return;
  }
  injectGirlStyle();grid.style.display='';panel.classList.add('hidden');await loadAdults();
}
async function saveWorkerPro(e){e.preventDefault();const p=currentProfile;const up={model_name:document.getElementById('wpModel').value.trim(),bio:document.getElementById('wpBio').value,interests:Array.from(_we.interests),preferences:Array.from(_we.preferences),zodiac:_we.zodiac};const g=pmState('pmWorker');let gallery=[...g.kept];for(const f of g.newFiles){if(gallery.length>=5)break;const path='wgallery/'+currentUser.id+'_'+Date.now()+'_'+f.name.replace(/[^a-zA-Z0-9.]/g,'_');const r=await db.storage.from('fendyx-assets').upload(path,f);if(!r.error)gallery.push(db.storage.from('fendyx-assets').getPublicUrl(path).data.publicUrl);}up.worker_gallery=gallery.slice(0,5);await db.from('profiles').update(up).eq('id',currentUser.id);await loadProfile();loadWorkers();showToast('✅ Perfil de Modelo guardado');}
async function setWorkerOnline(on){localStorage.setItem('fendyx_online_intent',on?'1':'0');await setWorkerOnlineDB(on);const st=document.getElementById('wkState');if(st){st.className='wk-state '+(on?'on':'off');st.textContent=on?' EN LÍNEA':'🔴 DESCONECTADA';}showToast(on?'🟢 En línea: te pueden llamar':'🔴 Desconectada');}
function fillKycForm(){const p=currentProfile;const box=document.getElementById('kycStatusBox');const st={none:'⚪ No aplica',pending:'⏳ Pendiente',approved:'✅ Verificada',rejected:'❌ Rechazada: '+(p.kyc_note||'')}[p.kyc_status]||'⚪';box.innerHTML=`<h3>Verificación</h3><p>${st}</p><p class="dim">Real: <b>${p.full_name||'—'}</b> · Artístico: <b>${p.model_name||'—'}</b></p>${p.id_card_url?`<img class="kyc-img" src="${p.id_card_url}">`:''}${p.face_photo_url?`<img class="kyc-img" src="${p.face_photo_url}">`:''}`;document.getElementById('kycWhatsapp').value=p.whatsapp||'';}
async function submitKycDocs(e){e.preventDefault();const up={whatsapp:document.getElementById('kycWhatsapp').value,kyc_status:'pending'};const idf=document.getElementById('kycIdCard').files[0];const fcf=document.getElementById('kycFace').files[0];if(idf){const p1='kyc/'+currentUser.id+'_id_'+Date.now()+'.jpg';const r=await db.storage.from('fendyx-assets').upload(p1,idf);if(!r.error)up.id_card_url=db.storage.from('fendyx-assets').getPublicUrl(p1).data.publicUrl;}if(fcf){const p2='kyc/'+currentUser.id+'_face_'+Date.now()+'.jpg';const r=await db.storage.from('fendyx-assets').upload(p2,fcf);if(!r.error)up.face_photo_url=db.storage.from('fendyx-assets').getPublicUrl(p2).data.publicUrl;}await db.from('profiles').update(up).eq('id',currentUser.id);await loadProfile();fillKycForm();showToast('📨 Enviado');}
async function startCall(workerId,netRate){netRate=parseFloat(netRate)||1;const clientRate=netRate*2;const{data:wk}=await db.from('profiles').select('is_online, kyc_status').eq('id',workerId).single();if(!wk||wk.kyc_status!=='approved'){showToast('❌ No verificada');return;}if(!wk.is_online){showToast('❌ No está en línea ahora');return;}if(currentProfile.role!=='admin'&&currentProfile.kyc_status!=='approved'){showToast(' Verifica tu identidad en Mi Perfil para llamar');showSection('profile');return;}if(!requireBalance(clientRate))return;const roomId='FENDYX'+Date.now();const{data:call}=await db.from('video_calls').insert({worker_id:workerId,client_id:currentUser.id,room_id:roomId,rate_per_minute:netRate,status:'active',started_at:new Date().toISOString()}).select().single();await loadScript('calls.js');await startWebCall(roomId,{rate:netRate,rowId:call.id,asClient:true});}
async function joinCall(callId,roomId,rate){await loadScript('calls.js');await joinWebCall(roomId,{rate:parseFloat(rate)||0,rowId:callId,asClient:false});}
