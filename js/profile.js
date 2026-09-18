'use strict';
let viewedUserId=null;
const INTERESTS=['Música','Cine','Viajes','Gym','Lectura','Arte','Moda','Gaming','Cocina','Baile','Fotografía','Naturaleza'];
const PREFERENCES=['Viajar','Coquetear','Música','Citas','Conversar','Cine y series','Cenas','Baile','Juegos','Deportes'];
const ZODIAC=['♈ Aries','♉ Tauro','♊ Géminis','♋ Cáncer','♌ Leo','♍ Virgo','♎ Libra','♏ Escorpio','♐ Sagitario','♑ Capricornio','♒ Acuario','♓ Piscis'];
const _pe={interests:new Set(),preferences:new Set(),zodiac:null};
function toggleChip(el,g,v){const s=_pe[g];if(s.has(v)){s.delete(v);el.classList.remove('active');}else{s.add(v);el.classList.add('active');}}
function pickZodiac(el,v){_pe.zodiac=v;document.querySelectorAll('.zodiac-chip').forEach(z=>z.classList.remove('active'));el.classList.add('active');}
// ===== Máscara VIP grande y animada =====
function bigVipBadge(balance){const lv=userLevelInfo(balance);if(!lv)return `<div class="vip-big v0"><span class="vip-mask">🎭</span> Sin rango</div>`;return `<div class="vip-big v${lv.level}"><span class="vip-mask">🎭</span> ${lv.name}</div>`;}
function nextPayDate(){const now=new Date();const y=now.getFullYear(),m=now.getMonth(),d=now.getDate();const lastDay=new Date(y,m+1,0).getDate();const day30=Math.min(30,lastDay);let dt;if(d<15)dt=new Date(y,m,15);else if(d<day30)dt=new Date(y,m,day30);else dt=new Date(y,m+1,15);return dt.toISOString().slice(0,10);}
function injectProfileStyle(){if(document.getElementById('fendyx-profile-style'))return;const st=document.createElement('style');st.id='fendyx-profile-style';st.textContent=`
 .pf-gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}
 .pf-gallery img{width:100%;height:96px;object-fit:cover;object-position:center;border-radius:12px;border:1px solid var(--border);cursor:pointer}
 .pf-hero{display:flex;gap:14px;align-items:center;margin-bottom:12px;position:relative}
 .pf-hero img,.pf-hero-letter{width:84px;height:84px;border-radius:50%;object-fit:cover;flex-shrink:0}
 .pf-hero-letter{background:var(--gradient);color:#04060c;display:flex;align-items:center;justify-content:center;font-size:2.2rem;font-weight:900}
 .pf-meta{flex:1;text-align:left}
 .pf-meta b{font-size:1.25rem;display:block;margin-bottom:4px}
 .vip-box{text-align:center;padding:16px;border-radius:18px;border:1px solid var(--border);background:rgba(255,255,255,.03);margin:10px 0}
 .vip-big{display:inline-flex;align-items:center;gap:10px;padding:12px 24px;border-radius:18px;font-family:'Orbitron';font-weight:900;font-size:1.25rem;border:2px solid;position:relative;overflow:hidden;letter-spacing:1px}
 .vip-big .vip-mask{font-size:2rem;animation:maskFloat 2s ease-in-out infinite;filter:drop-shadow(0 0 6px currentColor)}
 @keyframes maskFloat{0%,100%{transform:translateY(0) rotate(-8deg) scale(1)}50%{transform:translateY(-6px) rotate(8deg) scale(1.12)}}
 .vip-big.v0{border-color:var(--border);color:var(--dim);background:rgba(255,255,255,.05)}
 .vip-big.v1{border-color:#ff8080;color:#ffb3b3;background:rgba(255,150,150,.12)}
 .vip-big.v2{border-color:#c0c0c0;color:#f0f0f0;background:rgba(255,255,255,.12);box-shadow:0 0 8px rgba(255,255,255,.2)}
 .vip-big.v3{border-color:#ffd700;color:#ffd75e;background:rgba(255,215,0,.12);animation:lvlGlow 2.2s infinite}
 .vip-big.v4{border-color:#0078ff;color:#7fb8ff;background:rgba(0,120,255,.14);animation:lvlGlow 1.7s infinite}
 .vip-big.v5{border-color:#ff003c;color:#ff8fa3;background:rgba(255,0,60,.14);animation:lvlGlow 1.3s infinite}
 .vip-big.v6{border-color:transparent;color:#fff;background:linear-gradient(100deg,rgba(255,255,255,.25),rgba(0,217,255,.35),rgba(255,255,255,.25));background-size:200%;animation:lvlShine 2s linear infinite;box-shadow:0 0 18px rgba(0,217,255,.55)}
 .vip-big.v7{border-color:transparent;color:#fff;background:linear-gradient(100deg,rgba(255,215,0,.4),rgba(255,45,149,.4),rgba(0,217,255,.4),rgba(255,215,0,.4));background-size:300%;animation:lvlShine 1.3s linear infinite,heroPulse 1.8s infinite;box-shadow:0 0 26px rgba(255,215,0,.75),0 0 40px rgba(255,45,149,.4)}`;document.head.appendChild(st);}
let _lbUrls=[],_lbIdx=0,_lbX=0;
function openLightbox(urls,idx){_lbUrls=urls||[];_lbIdx=idx||0;let lb=document.getElementById('lbWrap');if(!lb){lb=document.createElement('div');lb.id='lbWrap';lb.className='lb-wrap';document.body.appendChild(lb);lb.addEventListener('touchstart',e=>{_lbX=e.touches[0].clientX;});lb.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-_lbX;if(dx>50)lbStep(-1);else if(dx<-50)lbStep(1);});}lb.innerHTML=`<button class="lb-close" onclick="closeLightbox()">✕</button><button class="lb-btn lb-prev" onclick="lbStep(-1)">‹</button><img src="${_lbUrls[_lbIdx]||''}"><button class="lb-btn lb-next" onclick="lbStep(1)">›</button><div class="lb-dots">${_lbUrls.map((_,i)=>`<span class="${i===_lbIdx?'on':''}"></span>`).join('')}</div>`;lb.classList.remove('hidden');}
function lbStep(d){_lbIdx=(_lbIdx+d+_lbUrls.length)%_lbUrls.length;openLightbox(_lbUrls,_lbIdx);}
function closeLightbox(){document.getElementById('lbWrap')?.classList.add('hidden');}

async function loadProfileSection(){
  const p=currentProfile;
  document.getElementById('profileName').textContent=p.full_name||'Usuario';
  document.getElementById('profileEmail').textContent=p.email;
  document.getElementById('profileRole').textContent=ROLE_LABELS[p.role]||p.role;
  document.getElementById('statTokens').textContent=p.unlimited_tokens?'∞':parseFloat(p.tokens_balance||0).toFixed(2);
  document.getElementById('statVerified').textContent=p.is_verified?'Sí ✅':'No';
  document.getElementById('statStatus').textContent=STATUS_LABELS[roleDetails?.relationship_status]||'—';
  document.getElementById('profileAvatar').textContent=(p.full_name||'U').charAt(0).toUpperCase();
  const img=document.getElementById('profileAvatarImg');
  if(p.avatar_url){img.src=p.avatar_url;img.style.display='block';document.getElementById('profileAvatar').style.display='none';}
  const sec=document.getElementById('section-profile');
  let vip=document.getElementById('profileVipBox');if(!vip){vip=document.createElement('div');vip.id='profileVipBox';sec.appendChild(vip);}
  const bal=parseFloat(p.tokens_balance||0);const nxt=userNextLevel(bal);
  vip.innerHTML=`<div class="vip-box">${bigVipBadge(bal)}${nxt?`<p class="dim" style="margin-top:10px">Recarga <b>◈ ${(nxt.min-bal).toFixed(2)}</b> más para alcanzar <b>🎭 ${nxt.name}</b></p>`:'<p class="dim" style="margin-top:10px">🏆 Nivel máximo alcanzado</p>'}</div>`;
  let gal=document.getElementById('profileNormalGallery');if(!gal){gal=document.createElement('div');gal.id='profileNormalGallery';sec.appendChild(gal);}
  const photos=(p.gallery_urls||[]).slice(0,3);
  gal.innerHTML=`<h4 class="sub-title">📸 Mis fotos (máx 3)</h4>${photos.length?`<div class="pf-gallery">${photos.map((u,i)=>`<img src="${u}" onclick='openLightbox(${JSON.stringify(photos)},${i})'>`).join('')}</div>`:'<p class="dim">Sin fotos aún</p>'}`;
  let kycBox=document.getElementById('profileKycBox');if(!kycBox){kycBox=document.createElement('div');kycBox.id='profileKycBox';sec.appendChild(kycBox);}
  if(p.role!=='remote_worker'){kycBox.innerHTML=p.kyc_status==='approved'?`<div class="owner-panel"><h3>🪪 Verificación de identidad</h3><p style="color:var(--success)">✅ Verificado: puedes llamar modelos</p></div>`:`<div class="owner-panel"><h3>🪪 Verificación para llamar (+18)</h3><p class="dim">Sube cédula + foto de rostro sin filtros/gorra/gafas. Solo el admin las ve.</p><form class="owner-form" onsubmit="submitClientKyc(event)"><label class="dim">📄 Cédula</label><label class="file-btn">📎 <span class="fb-txt">Seleccionar cédula</span><input type="file" id="ckId" accept="image/*" hidden required onchange="fbLabel(this)"></label><label class="dim">🤳 Rostro</label><label class="file-btn">📎 <span class="fb-txt">Seleccionar rostro</span><input type="file" id="ckFace" accept="image/*" hidden required onchange="fbLabel(this)"></label><button type="submit" class="btn-primary">Enviar verificación</button></form></div>`;}
  else{kycBox.innerHTML=`<div class="owner-panel"><h3>🪪 Verificación</h3><p>${p.kyc_status==='approved'?'✅ Verificada':'⏳ Pendiente'}</p></div>`;}
  // ===== Retiros USDT =====
  let wd=document.getElementById('profileWithdrawBox');if(!wd){wd=document.createElement('div');wd.id='profileWithdrawBox';sec.appendChild(wd);}
  const canWd=p.binance_id&&p.binance_email;
  wd.innerHTML=`<div class="owner-panel"><h3>💸 Retiros USDT (Binance)</h3>
    <p class="dim">Pagos los días <b>15 y 30</b> de cada mes (máx. 2 días de retraso: cae el 17 o el 2).</p>
    ${canWd?`<p class="dim">🪙 ID: <b>${p.binance_id}</b> · 📧 ${p.binance_email}</p>
      <div class="owner-form"><input type="number" id="wdAmount" min="1" step="0.01" placeholder="Monto a retirar (◈)">
      <button class="btn-primary" onclick="requestWithdrawal()">Solicitar retiro</button></div>`
     :`<p class="dim">⚠️ Configura tu <b>ID y email de Binance</b> en ✏️ Editar Perfil para poder retirar.</p>`}
    <div id="myWithdrawList" class="list-compact" style="margin-top:10px"></div></div>`;
  loadMyWithdrawals();
  let actions=document.getElementById('profileActions');if(!actions){actions=document.createElement('div');actions.id='profileActions';actions.className='row-buttons';actions.style.marginTop='14px';sec.appendChild(actions);}
  actions.innerHTML=`<button class="btn-secondary half" onclick="showSection('profileedit')">✏️ Editar Perfil</button><button class="btn-secondary half" style="border-color:var(--error);color:var(--error)" onclick="handleLogout()">🚪 Cerrar Sesión</button>`;
}
async function loadMyWithdrawals(){const{data}=await db.from('withdrawals').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(10);const el=document.getElementById('myWithdrawList');if(!el)return;el.innerHTML=(data||[]).map(w=>`<div class="row-item"><div class="row-main"><b>◈ ${parseFloat(w.amount).toFixed(2)}</b><small>${w.status==='paid'?'✅ Pagado':w.status==='rejected'?'❌ Rechazado':w.status==='approved'?'🟢 Aprobado':'⏳ Pendiente'} · 📅 ${w.scheduled_date||'—'}</small></div><small class="dim">${new Date(w.created_at).toLocaleDateString()}</small></div>`).join('')||'<p class="dim">Sin retiros solicitados</p>';}
async function requestWithdrawal(){
  const p=currentProfile;
  if(!p.binance_id||!p.binance_email){showToast('⚠️ Configura Binance en Editar Perfil');return;}
  if(p.tokens_locked){showToast('🔒 Tokens bloqueados por el admin');return;}
  const amt=parseFloat(document.getElementById('wdAmount').value);
  if(isNaN(amt)||amt<1)return showToast('Monto mínimo ◈1');
  const bal=parseFloat(p.tokens_balance||0);
  if(amt>bal)return showToast('❌ Saldo insuficiente');
  const nb=bal-amt;
  await db.from('profiles').update({tokens_balance:nb}).eq('id',currentUser.id);
  await db.from('token_transactions').insert({user_id:currentUser.id,amount:-amt,type:'withdrawal',description:'Solicitud de retiro USDT'});
  await db.from('withdrawals').insert({user_id:currentUser.id,amount:amt,method:'binance_usdt',status:'pending',scheduled_date:nextPayDate()});
  currentProfile.tokens_balance=nb;updateHeader();
  showToast('💸 Retiro solicitado: se paga el '+nextPayDate());
  loadProfileSection();
}
async function submitClientKyc(e){e.preventDefault();const up={kyc_status:'pending'};const idf=document.getElementById('ckId').files[0];const fcf=document.getElementById('ckFace').files[0];if(idf){const p1='kyc/'+currentUser.id+'_id_'+Date.now()+'.jpg';const r=await db.storage.from('fendyx-assets').upload(p1,idf);if(!r.error)up.id_card_url=db.storage.from('fendyx-assets').getPublicUrl(p1).data.publicUrl;}if(fcf){const p2='kyc/'+currentUser.id+'_face_'+Date.now()+'.jpg';const r=await db.storage.from('fendyx-assets').upload(p2,fcf);if(!r.error)up.face_photo_url=db.storage.from('fendyx-assets').getPublicUrl(p2).data.publicUrl;}await db.from('profiles').update(up).eq('id',currentUser.id);await loadProfile();loadProfileSection();showToast('📨 Verificación enviada');}

function fillProfilePro(){
  const p=currentProfile;
  _pe.interests=new Set(p.interests||[]);_pe.preferences=new Set(p.preferences||[]);_pe.zodiac=p.zodiac||null;
  pmInit('pmAvatar',p.avatar_url?[p.avatar_url]:[],1);
  pmInit('pmNormal',(p.gallery_urls||[]),3);
  const form=document.querySelector('#section-profileedit form');
  form.innerHTML=`<h3>✏️ Editar Perfil (público)</h3>
    <label class="dim">Foto de perfil</label><div id="pmAvatar" class="pm-grid"></div>
    <label class="dim">Fotos públicas (máx 3)</label><div id="pmNormal" class="pm-grid"></div>
    <label class="dim">Nombre</label><input type="text" id="proName" value="${p.full_name||''}">
    <label class="dim">Edad</label><input type="number" id="proAge" min="18" max="100" value="${p.age||''}">
    <label class="dim">Ocupación</label><input type="text" id="proOccupation" value="${p.occupation||''}">
    <label class="dim">Descripción</label><textarea id="proBio" rows="3">${p.bio||''}</textarea>
    <h4 class="sub-title">🪙 Pagos y retiros (Binance USDT)</h4>
    <label class="dim">ID Binance</label><input type="text" id="proBinanceId" value="${p.binance_id||''}" placeholder="Ej: 123456789">
    <label class="dim">Email de Binance</label><input type="email" id="proBinanceEmail" value="${p.binance_email||''}" placeholder="tucorreo@binance.com">
    <button type="submit" class="btn-primary">Guardar</button>`;
  pmRender('pmAvatar');pmRender('pmNormal');
}
async function saveProfilePro(e){
  e.preventDefault();
  const p=currentProfile;
  const up={full_name:document.getElementById('proName').value||p.full_name,age:parseInt(document.getElementById('proAge').value,10)||p.age,occupation:document.getElementById('proOccupation').value,bio:document.getElementById('proBio').value,interests:Array.from(_pe.interests),preferences:Array.from(_pe.preferences),zodiac:_pe.zodiac,binance_id:document.getElementById('proBinanceId').value.trim()||null,binance_email:document.getElementById('proBinanceEmail').value.trim()||null};
  const av=pmState('pmAvatar');
  if(av.newFiles.length){const f=av.newFiles[0];const path='avatars/'+currentUser.id+'_'+Date.now()+'.png';const r=await db.storage.from('fendyx-assets').upload(path,f);if(!r.error)up.avatar_url=db.storage.from('fendyx-assets').getPublicUrl(path).data.publicUrl;}
  else if(av.kept.length===0){up.avatar_url=null;}
  else{up.avatar_url=av.kept[0];}
  const g=pmState('pmNormal');let gallery=[...g.kept];
  for(const f of g.newFiles){if(gallery.length>=3)break;const path='gallery/'+currentUser.id+'_'+Date.now()+'_'+f.name.replace(/[^a-zA-Z0-9.]/g,'_');const r=await db.storage.from('fendyx-assets').upload(path,f);if(!r.error)gallery.push(db.storage.from('fendyx-assets').getPublicUrl(path).data.publicUrl);}
  up.gallery_urls=gallery.slice(0,3);
  await db.from('profiles').update(up).eq('id',currentUser.id);
  await loadProfile();updateHeader();loadProfileSection();fillProfilePro();
  showToast('✅ Perfil actualizado');
}
async function viewUserProfile(userId){
  injectProfileStyle();
  const {data}=await db.from('profiles').select('*').eq('id',userId).single();
  if(!data)return;
  viewedUserId=userId;
  const displayName=data.full_name||'Usuario';
  const photos=(data.gallery_urls||[]).slice(0,3);
  document.getElementById('upName').textContent=displayName;
  const mc=document.querySelector('#modal-userprofile .modal-content');if(mc)mc.className='modal-content wide';
  const hero=document.querySelector('#modal-userprofile .pf-hero')||document.querySelector('#modal-userprofile .up-hero');
  if(hero)hero.outerHTML=`<div class="pf-hero">${data.avatar_url?`<img src="${data.avatar_url}" onclick='openLightbox(${JSON.stringify([data.avatar_url,...photos])},0)'>`:`<div class="pf-hero-letter">${displayName.charAt(0).toUpperCase()}</div>`}<div class="pf-meta"><b>${displayName}${data.age?' · '+data.age+' años':''}</b><span class="role-badge">${ROLE_LABELS[data.role==='remote_worker'?'user':data.role]||'Usuario'}</span><div style="margin-top:8px">${bigVipBadge(data.tokens_balance)}</div><div style="margin-top:6px">${stars(data.rating||5)} ${parseFloat(data.rating||5).toFixed(1)}</div>${data.occupation?`<div class="dim" style="margin-top:4px">${data.occupation}</div>`:''}</div></div>`;
  document.getElementById('upVerified').innerHTML='';
  document.getElementById('upRating').textContent=stars(data.rating||5)+' '+parseFloat(data.rating||5).toFixed(1);
  document.getElementById('upBio').innerHTML=data.bio||'Sin descripción.';
  document.getElementById('upInterests').innerHTML='<p class="dim">Información privada</p>';
  const gal=document.getElementById('upGallery');
  if(gal)gal.outerHTML=`<div id="upGallery"><h4 class="sub-title">📸 Fotos</h4>${photos.length?`<div class="pf-gallery">${photos.map((u,i)=>`<img src="${u}" onclick='openLightbox(${JSON.stringify(photos)},${i})'>`).join('')}</div>`:'<p class="dim">Sin fotos</p>'}</div>`;
  const actions=document.getElementById('upActions');
  actions.innerHTML=`${data.id!==currentUser.id?`<button class="btn-secondary" onclick="messageFromProfile()">💬 Mensaje</button>`:''}${data.id!==currentUser.id?`<button class="btn-secondary" style="border-color:var(--error);color:var(--error)" onclick="reportFromProfile()">🚩 Reportar</button>`:''}`;
  openModal('modal-userprofile');
}
async function viewWorkerProfile(userId,preview){await loadScript('remote.js');return window._rwRenderProfile?window._rwRenderProfile(userId,preview):null;}
async function reportFromProfile(){const r=prompt('Motivo del reporte:');if(!r||!r.trim())return;await reportUser(viewedUserId,r.trim());closeModal('modal-userprofile');}
async function callFromProfile(id,rate){closeModal('modal-userprofile');await loadScript('remote.js');startCall(id,rate);}
async function messageFromProfile(){if(viewedUserId){await loadScript('chat.js');startChatWith(viewedUserId);}}
async function joinKycRoom(){await loadScript('calls.js');document.getElementById('kycTitle').textContent='🎥 KYC en curso';document.getElementById('kycVerifyBtn').classList.add('hidden');await joinWebCall('FENDYX_KYC_'+currentUser.id.slice(0,8),{rate:0,rowId:null,asClient:false});}
function closeKyc(){if(typeof callRoom!=='undefined'&&callRoom)endWebCall();else closeModal('modal-kyc');}
