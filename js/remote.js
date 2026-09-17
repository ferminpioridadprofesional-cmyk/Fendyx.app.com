'use strict';
let _girlsList=[];let wkLbUrls=[],wkLbIdx=0,wkLbX=0;
let _wgKept=[],_wgNew=[];
const _we={interests:new Set(),preferences:new Set(),zodiac:null};
function toggleWChip(el,g,v){const s=_we[g];if(s.has(v)){s.delete(v);el.classList.remove('active');}else{s.add(v);el.classList.add('active');}}
function pickWZodiac(el,v){_we.zodiac=v;document.querySelectorAll('.wz-chip').forEach(z=>z.classList.remove('active'));el.classList.add('active');}
function injectGirlStyle(){if(document.getElementById('fendyx-girl-style'))return;const st=document.createElement('style');st.id='fendyx-girl-style';st.textContent=`
 .girl-card{padding:14px}
 .girl-photo{width:64%;max-width:210px;height:170px;margin:0 auto;border-radius:14px;overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid var(--border)}
 .girl-photo img{width:100%;height:100%;object-fit:contain;object-position:center}
 .girl-initial{font-size:3rem;color:var(--dim)}
 .girl-thumbs{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;justify-content:center}
 .girl-thumbs img{width:52px;height:52px;object-fit:cover;object-position:center;border-radius:9px;border:1px solid var(--border);cursor:pointer}
 .girl-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap}
 .pf-hero{display:flex;gap:14px;align-items:center;margin-bottom:12px;position:relative}
 .pf-hero img,.pf-hero-letter{width:84px;height:84px;border-radius:50%;object-fit:cover;flex-shrink:0;cursor:pointer}
 .pf-hero-letter{background:var(--gradient);color:#04060c;display:flex;align-items:center;justify-content:center;font-size:2.2rem;font-weight:900}
 .pf-meta{flex:1;text-align:left}
 .pf-meta b{font-size:1.25rem;display:block;margin-bottom:4px}
 .pf-gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}
 .pf-gallery img{width:100%;height:110px;object-fit:cover;object-position:center;border-radius:12px;border:1px solid var(--border);cursor:pointer}
 .thumbwrap{position:relative;display:inline-block;margin:4px}
 .thumbwrap img{width:80px;height:80px;object-fit:cover;border-radius:12px;border:1px solid var(--border)}
 .thumbwrap .del{position:absolute;top:-6px;right:-6px;width:24px;height:24px;border-radius:50%;border:none;background:var(--error);color:#fff;font-size:.8rem;cursor:pointer}
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
 .wk-switch input:checked + .wk-slider{background:rgba(0,255,157,.2);border-color:var(--success);animation:switchGlow 1.6s infinite}
 .wk-switch input:checked + .wk-slider:before{transform:translateX(32px);background:var(--success);box-shadow:0 0 14px rgba(0,255,157,.8)}
 @keyframes switchGlow{0%,100%{box-shadow:0 0 6px rgba(0,255,157,.3)}50%{box-shadow:0 0 18px rgba(0,255,157,.7)}}
 .wk-pro{margin-top:14px;text-align:left;border-top:1px solid var(--border);padding-top:12px}`;document.head.appendChild(st);}
function ensureWkLightbox(){if(document.getElementById('wkLightbox'))return;const lb=document.createElement('div');lb.id='wkLightbox';lb.className='lb-wrap hidden';document.body.appendChild(lb);lb.addEventListener('touchstart',e=>{wkLbX=e.touches[0].clientX;});lb.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-wkLbX;if(dx>50)wkLbStep(-1);else if(dx<-50)wkLbStep(1);});}
function wkOpenLightbox(urls,idx){ensureWkLightbox();wkLbUrls=urls||[];wkLbIdx=idx||0;const lb=document.getElementById('wkLightbox');lb.innerHTML=`<button class="lb-close" onclick="wkCloseLightbox()">✕</button><button class="lb-btn lb-prev" onclick="wkLbStep(-1)">‹</button><img src="${wkLbUrls[wkLbIdx]||''}"><button class="lb-btn lb-next" onclick="wkLbStep(1)">›</button><div class="lb-dots">${wkLbUrls.map((_,i)=>`<span class="${i===wkLbIdx?'on':''}"></span>`).join('')}</div>`;lb.classList.remove('hidden');}
function wkLbStep(d){wkLbIdx=(wkLbIdx+d+wkLbUrls.length)%wkLbUrls.length;wkOpenLightbox(wkLbUrls,wkLbIdx);}
function wkCloseLightbox(){document.getElementById('wkLightbox')?.classList.add('hidden');}
function ensureWkModal(){if(document.getElementById('wkProfileModal'))return;const m=document.createElement('div');m.id='wkProfileModal';m.className='modal hidden';m.innerHTML=`<div class="modal-content wide" id="wkModalContent"></div>`;document.body.appendChild(m);}
function renderWkProfile(data,preview){ensureWkModal();injectGirlStyle();const rd=data.role_details?.[0];const lv=Math.min(5,Math.max(1,parseInt(rd?.worker_level)||1));const net=rd?.rate_per_minute!=null?rd.rate_per_minute:levelInfo(lv).rate;const shown=preview?net:net*2;const name=data.model_name||'Modelo';const photos=(data.worker_gallery||[]).slice(0,5);const box=document.getElementById('wkModalContent');box.className='modal-content wide tier-'+lv;box.innerHTML=`
 <div class="modal-head"><h3>${name}</h3><button class="modal-close" onclick="closeModal('wkProfileModal')">✕</button></div>
 <div class="pf-hero">${(data.avatar_url||photos[0])?`<img src="${data.avatar_url||photos[0]}" onclick='wkOpenLightbox(${JSON.stringify(photos.length?photos:[data.avatar_url])},0)'>`:`<div class="pf-hero-letter">${name.charAt(0).toUpperCase()}</div>`}
  <div class="pf-meta"><b>${name}${data.age?' · '+data.age:''}</b>${levelBadge(lv)}<div style="margin-top:6px">◈ ${shown}/min · ${stars(data.rating||5)}</div>${data.zodiac?`<div class="dim">${data.zodiac}</div>`:''}</div></div>
 <p class="dim">${data.bio||rd?.bio||''}</p>
 <div class="chips-row">${(data.interests||[]).map(i=>`<span class="chip active">🎯 ${i}</span>`).join('')}${(data.preferences||[]).map(i=>`<span class="chip">💫 ${i}</span>`).join('')}</div>
 <h4 class="sub-title">📸 Galería</h4><div class="pf-gallery">${photos.map((u,i)=>`<img src="${u}" onclick='wkOpenLightbox(${JSON.stringify(photos)},${i})'>`).join('')||'<p class="dim">Sin fotos</p>'}</div>
 <div style="margin-top:12px">${preview?'<p class="dim">Vista previa (solo lectura) · TU ganancia neta: ◈ '+net+'/min</p>':`<button class="btn-primary" onclick="closeModal('wkProfileModal');startCall('${data.id}',${net})">📹 Llamar · ◈ ${shown}/min</button>`}</div>`;openModal('wkProfileModal');}
window._rwRenderProfile=async function(userId,preview){const{data}=await db.from('profiles').select('*, role_details(*)').eq('id',userId).single();if(!data)return;renderWkProfile(data,preview);};
async function openWorkerProfile(id){await window._rwRenderProfile(id,false);}
async function previewWorkerProfile(){await window._rwRenderProfile(currentUser.id,true);}
async function openGirlGallery(idx,i){const g=(_girlsList[idx]?.gallery)||[];if(!g.length)return;wkOpenLightbox(g,i);}
function girlCard(w,idx){const lvNum=Math.min(5,Math.max(1,parseInt(w.worker_level)||1));const clientRate=parseFloat(w.client_rate)||2;const name=w.display_name||'Modelo';const gallery=w.gallery||[];const mainPhoto=w.avatar_url||gallery[0]||'';return `<div class="card-item girl-card tier-${lvNum}">
 <div class="girl-photo" onclick="openGirlGallery(${idx},0)">${mainPhoto?`<img src="${mainPhoto}" alt="">`:`<span class="girl-initial">${name.charAt(0).toUpperCase()}</span>`}</div>
 ${gallery.length?`<div class="girl-thumbs">${gallery.map((g,i)=>`<img src="${g}" alt="" onclick="openGirlGallery(${idx},${i})">`).join('')}</div>`:''}
 <div class="girl-head"><div class="card-title" style="margin:0">${name}${w.age?', '+w.age:''}</div>${levelBadge(lvNum)}</div>
 <span class="status-pill ${w.is_online?'online':'offline'}">${w.is_online?'EN LÍNEA':'DESCONECTADA'}</span>
 <span class="role-badge">◈ ${clientRate}/min</span> ${w.zodiac?`<span class="chip">${w.zodiac}</span>`:''}
 <div class="chips-row" style="margin:6px 0">${(w.interests||[]).slice(0,3).map(i=>`<span class="chip">🎯 ${i}</span>`).join('')}</div>
 <div class="row-actions"><button class="btn-small" onclick="openWorkerProfile('${w.id}')">👤 Ver perfil y fotos</button><button class="btn-small success" onclick="startCall('${w.id}',${parseFloat(w.rate)||1})" ${w.is_online?'':'disabled'}>📹 Llamar</button></div></div>`;}
async function fetchPublicWorkers(){const{data,error}=await db.rpc('get_public_workers');if(error){showToast('❌ '+error.message);return[];}return (typeof data==='string'?JSON.parse(data):data)||[];}
async function loadGirls(){injectGirlStyle();const gate=document.getElementById('girlsGate');const grid=document.getElementById('girlsGrid');const bal=parseFloat(currentProfile.tokens_balance||0);const kycOk=currentProfile.kyc_status==='approved';const moneyOk=bal>=1||currentProfile.unlimited_tokens||currentProfile.role==='admin';if(!(kycOk&&moneyOk)){grid.innerHTML='';gate.innerHTML=`<div class="req-gate"><h3>🔒 Acceso al área de videollamadas</h3><p class="dim">Para garantizar un entorno seguro y verificado, debes cumplir:</p><ul><li>${kycOk?'✅':'❌'} <b>Verificación de identidad (KYC)</b> aprobada (cédula + foto de rostro).</li><li>${moneyOk?'✅':'❌'} <b>Mínimo 1 token ($1)</b> en tu cuenta.</li></ul><div class="row-buttons" style="justify-content:center">${!kycOk?`<button class="btn-primary" onclick="showSection('profile')">🪪 Verificar identidad</button>`:''}${!moneyOk?`<button class="btn-primary" onclick="showSection('tokens')">◈ Recargar</button>`:''}</div></div>`;return;}gate.innerHTML='';_girlsList=await fetchPublicWorkers();grid.innerHTML=_girlsList.map((w,i)=>girlCard(w,i)).join('')||'<p class="empty-state">No hay chicas verificadas en línea</p>';}

// ===== Gestión galería de modelo (máx 5) =====
function wgRender(){const wrap=document.getElementById('wpGalleryPrev');if(!wrap)return;const kept=_wgKept.map((u,i)=>`<span class="thumbwrap"><img src="${u}"><button type="button" class="del" onclick="wgRemoveKept(${i})">✕</button></span>`).join('');const nw=_wgNew.map((f,i)=>`<span class="thumbwrap"><img src="${URL.createObjectURL(f)}"><button type="button" class="del" onclick="wgRemoveNew(${i})">✕</button></span>`).join('');wrap.innerHTML=(kept+nw)||'<p class="dim">Sin fotos de modelo</p>';}
function wgRemoveKept(i){_wgKept.splice(i,1);wgRender();}
function wgRemoveNew(i){_wgNew.splice(i,1);wgRender();}
function wgOnFiles(input){const files=Array.from(input.files||[]);for(const f of files){if(_wgKept.length+_wgNew.length>=5){showToast('⚠️ Máx 5 fotos');break;}_wgNew.push(f);}input.value='';wgRender();}

async function loadWorkers(){const isWorker=currentProfile.role==='remote_worker';const grid=document.getElementById('workersGrid');const panel=document.getElementById('workerPanel');
 if(isWorker){injectGirlStyle();grid.style.display='none';grid.innerHTML='';panel.classList.remove('hidden');const p=currentProfile;const lvNum=Math.min(5,Math.max(1,parseInt(roleDetails?.worker_level)||1));const net=roleDetails?.rate_per_minute!=null?roleDetails.rate_per_minute:levelInfo(lvNum).rate;const on=!!p.is_online;_we.interests=new Set(p.interests||[]);_we.preferences=new Set(p.preferences||[]);_we.zodiac=p.zodiac||null;_wgKept=[...(p.worker_gallery||[])].slice(0,5);_wgNew=[];
  const INTERESTS=['Música','Cine','Viajes','Gym','Lectura','Arte','Moda','Gaming','Cocina','Baile','Fotografía','Naturaleza'];const PREFERENCES=['Viajar','Coquetear','Música','Citas','Conversar','Cine y series','Cenas','Baile','Juegos','Deportes'];const ZODIAC=['♈ Aries','♉ Tauro','♊ Géminis','♋ Cáncer','♌ Leo',' Virgo','♎ Libra','♏ Escorpio','♐ Sagitario','♑ Capricornio','♒ Acuario','♓ Piscis'];
  panel.innerHTML=`<h3>💼 Mi Trabajo</h3><div class="wk-card tier-${lvNum}">
   <div class="wk-name">🎭 ${p.model_name||'Modelo'}</div>
   <div class="wk-row">${levelBadge(lvNum)} <span class="wk-rate">TU ganancia: ◈ ${net}/min</span></div>
   <div class="wk-kyc">${p.kyc_status==='approved'?'✅ Verificación KYC aprobada':'⏳ Verificación KYC pendiente'} · El cliente paga ◈ ${(net*2).toFixed(2)}/min</div>
   <div class="wk-switch-row"><span id="wkState" class="wk-state ${on?'on':'off'}">${on?'🟢 EN LÍNEA':'🔴 DESCONECTADA'}</span><label class="wk-switch"><input type="checkbox" id="wkToggle" ${on?'checked':''} onchange="setWorkerOnline(this.checked)"><span class="wk-slider"></span></label></div>
   <p class="dim" style="margin-top:12px">Solo recibes llamadas con la app/página <b>abierta</b> y el switch en verde.</p>
   <div class="row-buttons" style="margin-top:10px"><button class="btn-secondary half" onclick="previewWorkerProfile()">👁 Previsualizar perfil</button></div>
   <div class="wk-pro"><h4 class="sub-title">🎭 Mi Perfil de Modelo</h4><form class="owner-form" onsubmit="saveWorkerPro(event)">
    <label class="dim">Nombre artístico</label><input type="text" id="wpModel" value="${p.model_name||''}">
    <label class="dim">Fotos de modelo (máx 5) — toca ✕ para eliminar</label>
    <div id="wpGalleryPrev" class="pf-gallery"></div>
    <input type="file" id="wpGallery" accept="image/*" multiple onchange="wgOnFiles(this)">
    <label class="dim">Descripción</label><textarea id="wpBio" rows="3">${p.bio||''}</textarea>
    <label class="dim">🎯 Intereses</label><div class="chips-row">${INTERESTS.map(i=>`<span class="chip ${_we.interests.has(i)?'active':''}" onclick="toggleWChip(this,'interests','${i}')">${i}</span>`).join('')}</div>
    <label class="dim">💫 Preferencias</label><div class="chips-row">${PREFERENCES.map(i=>`<span class="chip ${_we.preferences.has(i)?'active':''}" onclick="toggleWChip(this,'preferences','${i}')">${i}</span>`).join('')}</div>
    <label class="dim">✨ Zodiaco</label><div class="chips-row">${ZODIAC.map(z=>`<span class="chip wz-chip ${_we.zodiac===z?'active':''}" onclick="pickWZodiac(this,'${z}')">${z}</span>`).join('')}</div>
    <button type="submit" class="btn-primary">💾 Guardar Perfil de Modelo</button></form></div></div>`;
  wgRender();
  return;}
 injectGirlStyle();grid.style.display='';panel.classList.add('hidden');_girlsList=await fetchPublicWorkers();grid.innerHTML=_girlsList.map((w,i)=>girlCard(w,i)).join('')||'<p class="empty-state">Sin trabajadoras</p>';}
async function saveWorkerPro(e){e.preventDefault();const p=currentProfile;const up={model_name:document.getElementById('wpModel').value.trim(),bio:document.getElementById('wpBio').value,interests:Array.from(_we.interests),preferences:Array.from(_we.preferences),zodiac:_we.zodiac};let gallery=[..._wgKept];for(const f of _wgNew){if(gallery.length>=5)break;const path='wgallery/'+currentUser.id+'_'+Date.now()+'_'+f.name.replace(/[^a-zA-Z0-9.]/g,'_');const r=await db.storage.from('fendyx-assets').upload(path,f);if(!r.error)gallery.push(db.storage.from('fendyx-assets').getPublicUrl(path).data.publicUrl);}up.worker_gallery=gallery.slice(0,5);await db.from('profiles').update(up).eq('id',currentUser.id);await loadProfile();loadWorkers();showToast('✅ Perfil de Modelo guardado');}
async function setWorkerOnline(on){localStorage.setItem('fendyx_online_intent',on?'1':'0');await setWorkerOnlineDB(on);const st=document.getElementById('wkState');if(st){st.className='wk-state '+(on?'on':'off');st.textContent=on?'🟢 EN LÍNEA':'🔴 DESCONECTADA';}showToast(on?'🟢 En línea: te pueden llamar':'🔴 Desconectada');}
function fillKycForm(){const p=currentProfile;const box=document.getElementById('kycStatusBox');const st={none:'⚪ No aplica',pending:'⏳ Pendiente',approved:'✅ Verificada',rejected:'❌ Rechazada: '+(p.kyc_note||'')}[p.kyc_status]||'⚪';box.innerHTML=`<h3>Verificación</h3><p>${st}</p><p class="dim">Real: <b>${p.full_name||'—'}</b> · Artístico: <b>${p.model_name||'—'}</b></p>${p.id_card_url?`<img class="kyc-img" src="${p.id_card_url}">`:''}${p.face_photo_url?`<img class="kyc-img" src="${p.face_photo_url}">`:''}`;document.getElementById('kycWhatsapp').value=p.whatsapp||'';}
async function submitKycDocs(e){e.preventDefault();const up={whatsapp:document.getElementById('kycWhatsapp').value,kyc_status:'pending'};const idf=document.getElementById('kycIdCard').files[0];const fcf=document.getElementById('kycFace').files[0];if(idf){const p1='kyc/'+currentUser.id+'_id_'+Date.now()+'.jpg';const r=await db.storage.from('fendyx-assets').upload(p1,idf);if(!r.error)up.id_card_url=db.storage.from('fendyx-assets').getPublicUrl(p1).data.publicUrl;}if(fcf){const p2='kyc/'+currentUser.id+'_face_'+Date.now()+'.jpg';const r=await db.storage.from('fendyx-assets').upload(p2,fcf);if(!r.error)up.face_photo_url=db.storage.from('fendyx-assets').getPublicUrl(p2).data.publicUrl;}await db.from('profiles').update(up).eq('id',currentUser.id);await loadProfile();fillKycForm();showToast('📨 Enviado');}
async function startCall(workerId,netRate){netRate=parseFloat(netRate)||1;const clientRate=netRate*2;const{data:wk}=await db.from('profiles').select('is_online, kyc_status').eq('id',workerId).single();if(!wk||wk.kyc_status!=='approved'){showToast('❌ No verificada');return;}if(!wk.is_online){showToast('❌ No está en línea ahora');return;}if(currentProfile.role!=='admin'&&currentProfile.kyc_status!=='approved'){showToast('🪪 Verifica tu identidad en Mi Perfil para llamar');showSection('profile');return;}if(!requireBalance(clientRate))return;const roomId='FENDYX'+Date.now();const{data:call}=await db.from('video_calls').insert({worker_id:workerId,client_id:currentUser.id,room_id:roomId,rate_per_minute:netRate,status:'active',started_at:new Date().toISOString()}).select().single();await loadScript('calls.js');await startWebCall(roomId,{rate:netRate,rowId:call.id,asClient:true});}
async function joinCall(callId,roomId,rate){await loadScript('calls.js');await joinWebCall(roomId,{rate:parseFloat(rate)||0,rowId:callId,asClient:false});}
