'use strict';
let viewedUserId = null;
const INTERESTS = ['Música','Cine','Viajes','Gym','Lectura','Arte','Moda','Gaming','Cocina','Baile','Fotografía','Naturaleza'];
const PREFERENCES = ['Viajar','Coquetear','Música','Citas','Conversar','Cine y series','Cenas','Baile','Juegos','Deportes'];
const ZODIAC = ['♈ Aries','♉ Tauro','♊ Géminis','♋ Cáncer','♌ Leo','♍ Virgo','♎ Libra','♏ Escorpio','♐ Sagitario','♑ Capricornio','♒ Acuario','♓ Piscis'];
const _pe = { interests:new Set(), preferences:new Set(), zodiac:null };
function toggleChip(el,g,v){const s=_pe[g];if(s.has(v)){s.delete(v);el.classList.remove('active');}else{s.add(v);el.classList.add('active');}}
function pickZodiac(el,v){_pe.zodiac=v;document.querySelectorAll('.zodiac-chip').forEach(z=>z.classList.remove('active'));el.classList.add('active');}
function injectProfileStyle(){
  if(document.getElementById('fendyx-profile-style'))return;
  const st=document.createElement('style');st.id='fendyx-profile-style';
  st.textContent=`
    .pf-gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}
    .pf-gallery img{width:100%;height:110px;object-fit:cover;object-position:center;border-radius:12px;border:1px solid var(--border);cursor:pointer}
    .pf-hero{display:flex;gap:14px;align-items:center;margin-bottom:12px;position:relative}
    .pf-hero img,.pf-hero-letter{width:84px;height:84px;border-radius:50%;object-fit:cover;flex-shrink:0}
    .pf-hero-letter{background:var(--gradient);color:#04060c;display:flex;align-items:center;justify-content:center;font-size:2.2rem;font-weight:900}
    .pf-meta{flex:1;text-align:left}
    .pf-meta b{font-size:1.25rem;display:block;margin-bottom:4px}`;
  document.head.appendChild(st);
}
function getHeroEl(){return document.querySelector('#modal-userprofile .pf-hero')||document.querySelector('#modal-userprofile .up-hero');}
let _lbUrls=[], _lbIdx=0, _lbX=null;
function openLightbox(urls, idx){
  _lbUrls=urls||[]; _lbIdx=idx||0;
  let lb=document.getElementById('lbWrap');
  if(!lb){lb=document.createElement('div');lb.id='lbWrap';lb.className='lb-wrap';document.body.appendChild(lb);
    lb.addEventListener('touchstart',e=>{_lbX=e.touches[0].clientX;});
    lb.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-_lbX;if(dx>50)lbStep(-1);else if(dx<-50)lbStep(1);});}
  lb.innerHTML=`<button class="lb-close" onclick="closeLightbox()">✕</button>
    <button class="lb-btn lb-prev" onclick="lbStep(-1)">‹</button>
    <img id="lbImg" src="${_lbUrls[_lbIdx]||''}">
    <button class="lb-btn lb-next" onclick="lbStep(1)">›</button>
    <div class="lb-dots">${_lbUrls.map((_,i)=>`<span class="${i===_lbIdx?'on':''}"></span>`).join('')}</div>`;
  lb.classList.remove('hidden');
}
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
  let gal=document.getElementById('profileNormalGallery');
  if(!gal){gal=document.createElement('div');gal.id='profileNormalGallery';sec.appendChild(gal);}
  const photos=(p.gallery_urls||[]).slice(0,3);
  gal.innerHTML=`<h4 class="sub-title">📸 Mis fotos (máx 3)</h4>${photos.length?`<div class="pf-gallery">${photos.map((u,i)=>`<img src="${u}" onclick='openLightbox(${JSON.stringify(photos)},${i})'>`).join('')}</div>`:'<p class="dim">Sin fotos aún</p>'}`;
  let kycBox=document.getElementById('profileKycBox');
  if(!kycBox){kycBox=document.createElement('div');kycBox.id='profileKycBox';sec.appendChild(kycBox);}
  if(p.role!=='remote_worker'){
    kycBox.innerHTML = p.kyc_status==='approved'
      ? `<div class="owner-panel"><h3>🪪 Verificación de identidad</h3><p style="color:var(--success)">✅ Verificado: puedes llamar modelos</p></div>`
      : `<div class="owner-panel"><h3>🪪 Verificación para llamar (+18)</h3><p class="dim">Para llamar modelos debes verificar tu identidad. Solo el admin ve estos documentos.</p>
         <form class="owner-form" onsubmit="submitClientKyc(event)">
           <label class="dim">📄 Cédula (legible)</label><input type="file" id="ckId" accept="image/*" required>
           <label class="dim">🤳 Foto de tu cara (sin filtros, gorra ni gafas)</label><input type="file" id="ckFace" accept="image/*" required>
           <button type="submit" class="btn-primary">Enviar verificación</button></form></div>`;
  } else {
    kycBox.innerHTML=`<div class="owner-panel"><h3>🪪 Verificación</h3><p>${p.kyc_status==='approved'?'✅ Verificada':'⏳ Pendiente'}</p></div>`;
  }
  let actions=document.getElementById('profileActions');
  if(!actions){actions=document.createElement('div');actions.id='profileActions';actions.className='row-buttons';actions.style.marginTop='14px';sec.appendChild(actions);}
  actions.innerHTML=`<button class="btn-secondary half" onclick="showSection('profileedit')">✏️ Editar Perfil</button>
    <button class="btn-secondary half" style="border-color:var(--error);color:var(--error)" onclick="handleLogout()">🚪 Cerrar Sesión</button>`;
}
async function submitClientKyc(e){
  e.preventDefault();
  const up={kyc_status:'pending'};
  const idf=document.getElementById('ckId').files[0];
  const fcf=document.getElementById('ckFace').files[0];
  if(idf){const p1='kyc/'+currentUser.id+'_id_'+Date.now()+'.jpg';const r=await db.storage.from('fendyx-assets').upload(p1,idf);if(!r.error)up.id_card_url=db.storage.from('fendyx-assets').getPublicUrl(p1).data.publicUrl;}
  if(fcf){const p2='kyc/'+currentUser.id+'_face_'+Date.now()+'.jpg';const r=await db.storage.from('fendyx-assets').upload(p2,fcf);if(!r.error)up.face_photo_url=db.storage.from('fendyx-assets').getPublicUrl(p2).data.publicUrl;}
  await db.from('profiles').update(up).eq('id',currentUser.id);
  await loadProfile(); loadProfileSection();
  showToast('📨 Verificación enviada. El admin la revisará.');
}
function fillProfilePro(){
  const p=currentProfile;
  const form=document.querySelector('#section-profileedit form');
  form.innerHTML=`<h3>✏️ Editar Perfil (público)</h3>
    <label class="dim">Foto de perfil</label><input type="file" id="proAvatar" accept="image/*">
    <label class="dim">Fotos públicas (máx 3)</label><input type="file" id="proGallery" accept="image/*" multiple>
    <div id="proGalleryPrev" class="pf-gallery">${(p.gallery_urls||[]).slice(0,3).map(u=>`<img src="${u}">`).join('')}</div>
    <label class="dim">Nombre</label><input type="text" id="proName" value="${p.full_name||''}">
    <label class="dim">Edad</label><input type="number" id="proAge" min="18" max="100" value="${p.age||''}">
    <label class="dim">Ocupación</label><input type="text" id="proOccupation" value="${p.occupation||''}">
    <label class="dim">Descripción</label><textarea id="proBio" rows="3">${p.bio||''}</textarea>
    <button type="submit" class="btn-primary">Guardar</button>`;
}
async function saveProfilePro(e){
  e.preventDefault();
  const p=currentProfile;
  const up={full_name:document.getElementById('proName').value||p.full_name,age:parseInt(document.getElementById('proAge').value,10)||p.age,occupation:document.getElementById('proOccupation').value,bio:document.getElementById('proBio').value};
  const av=document.getElementById('proAvatar').files[0];
  if(av){const path='avatars/'+currentUser.id+'_'+Date.now()+'.png';const r=await db.storage.from('fendyx-assets').upload(path,av);if(!r.error)up.avatar_url=db.storage.from('fendyx-assets').getPublicUrl(path).data.publicUrl;}
  const files=Array.from(document.getElementById('proGallery').files||[]);
  if(files.length){let g=[...(p.gallery_urls||[])];for(const f of files){if(g.length>=3){showToast('⚠️ Máx 3 fotos');break;}const path='gallery/'+currentUser.id+'_'+Date.now()+'_'+f.name.replace(/[^a-zA-Z0-9.]/g,'_');const r=await db.storage.from('fendyx-assets').upload(path,f);if(!r.error)g.push(db.storage.from('fendyx-assets').getPublicUrl(path).data.publicUrl);}up.gallery_urls=g.slice(0,3);}
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
  const mc=document.querySelector('#modal-userprofile .modal-content'); if(mc) mc.className='modal-content wide';
  const hero=getHeroEl();
  if(hero)hero.outerHTML=`<div class="pf-hero">
    ${data.avatar_url?`<img src="${data.avatar_url}" onclick='openLightbox(${JSON.stringify([data.avatar_url,...photos])},0)'>`:`<div class="pf-hero-letter">${displayName.charAt(0).toUpperCase()}</div>`}
    <div class="pf-meta"><b>${displayName}${data.age?' · '+data.age+' años':''}</b>
    <span class="role-badge">${ROLE_LABELS[data.role==='remote_worker'?'user':data.role]||'Usuario'}</span>
    <div style="margin-top:6px">${stars(data.rating||5)} ${parseFloat(data.rating||5).toFixed(1)}</div>
    ${data.occupation?`<div class="dim" style="margin-top:4px">${data.occupation}</div>`:''}</div></div>`;
  document.getElementById('upVerified').innerHTML='';
  document.getElementById('upRating').textContent=stars(data.rating||5)+' '+parseFloat(data.rating||5).toFixed(1);
  document.getElementById('upBio').innerHTML=data.bio||'Sin descripción.';
  document.getElementById('upInterests').innerHTML='<p class="dim">Información privada</p>';
  const gal=document.getElementById('upGallery');
  if(gal)gal.outerHTML=`<div id="upGallery"><h4 class="sub-title">📸 Fotos</h4>${photos.length?`<div class="pf-gallery">${photos.map((u,i)=>`<img src="${u}" onclick='openLightbox(${JSON.stringify(photos)},${i})'>`).join('')}</div>`:'<p class="dim">Sin fotos</p>'}</div>`;
  const actions=document.getElementById('upActions');
  actions.innerHTML=`${data.id!==currentUser.id?`<button class="btn-secondary" onclick="messageFromProfile()">💬 Mensaje</button>`:''}
    ${data.id!==currentUser.id?`<button class="btn-secondary" style="border-color:var(--error);color:var(--error)" onclick="reportFromProfile()">🚩 Reportar</button>`:''}`;
  openModal('modal-userprofile');
}
async function viewWorkerProfile(userId, preview){
  injectProfileStyle();
  const {data}=await db.from('profiles').select('*, role_details(*)').eq('id',userId).single();
  if(!data)return;
  viewedUserId=userId;
  const rd=data.role_details?.[0];
  const lvNum=Math.min(5,Math.max(1,parseInt(rd?.worker_level)||1));
  const name=data.model_name||'Modelo';
  const photos=(data.worker_gallery||[]).slice(0,5);
  const mc=document.querySelector('#modal-userprofile .modal-content'); if(mc) mc.className='modal-content wide tier-'+lvNum;
  document.getElementById('upName').textContent=name;
  const hero=getHeroEl();
  if(hero)hero.outerHTML=`<div class="pf-hero">
    ${(data.avatar_url||photos[0])?`<img src="${data.avatar_url||photos[0]}" onclick='openLightbox(${JSON.stringify(photos.length?photos:[data.avatar_url])},0)'>`:`<div class="pf-hero-letter">${name.charAt(0).toUpperCase()}</div>`}
    <div class="pf-meta"><b>${name}${data.age?' · '+data.age:''}</b>${levelBadge(lvNum)}
    <div style="margin-top:6px">◈ ${rd?.rate_per_minute||levelInfo(lvNum).rate}/min · ${stars(data.rating||5)}</div>
    ${data.zodiac?`<div class="dim">${data.zodiac}</div>`:''}</div></div>`;
  document.getElementById('upVerified').innerHTML=data.is_verified?'<span style="color:var(--success)">✅ Verificada</span>':'';
  document.getElementById('upRating').textContent=stars(data.rating||5)+' '+parseFloat(data.rating||5).toFixed(1);
  document.getElementById('upBio').innerHTML=data.bio||rd?.bio||'';
  document.getElementById('upInterests').innerHTML=(data.interests||[]).map(i=>`<span class="chip active">🎯 ${i}</span>`).join('')+(data.preferences||[]).map(i=>`<span class="chip">💫 ${i}</span>`).join('')||'<p class="dim">—</p>';
  const gal=document.getElementById('upGallery');
  if(gal)gal.outerHTML=`<div id="upGallery"><h4 class="sub-title">📸 Galería</h4>${photos.length?`<div class="pf-gallery">${photos.map((u,i)=>`<img src="${u}" onclick='openLightbox(${JSON.stringify(photos)},${i})'>`).join('')}</div>`:'<p class="dim">Sin fotos</p>'}</div>`;
  const actions=document.getElementById('upActions');
  const rate=rd?.rate_per_minute!=null?rd.rate_per_minute:levelInfo(lvNum).rate;
  actions.innerHTML= preview ? '<p class="dim">Vista previa (solo lectura)</p>'
    : `<button class="btn-primary" onclick="callFromProfile('${data.id}',${rate})">📹 Llamar · ◈ ${rate}/min</button>`;
  openModal('modal-userprofile');
}
async function reportFromProfile(){const r=prompt('Motivo del reporte:');if(!r||!r.trim())return;await reportUser(viewedUserId,r.trim());closeModal('modal-userprofile');}
async function callFromProfile(id,rate){closeModal('modal-userprofile');await loadScript('remote.js');startCall(id,rate);}
async function messageFromProfile(){if(viewedUserId){await loadScript('chat.js');startChatWith(viewedUserId);}}
async function joinKycRoom(){await loadScript('calls.js');document.getElementById('kycTitle').textContent='🎥 KYC en curso';document.getElementById('kycVerifyBtn').classList.add('hidden');await joinWebCall('FENDYX_KYC_'+currentUser.id.slice(0,8),{rate:0,rowId:null,asClient:false});}
function closeKyc(){if(typeof callRoom!=='undefined'&&callRoom)endWebCall();else closeModal('modal-kyc');}
