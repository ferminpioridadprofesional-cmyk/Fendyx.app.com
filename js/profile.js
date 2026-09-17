'use strict';
let viewedUserId = null;
const INTERESTS = ['Música','Cine','Viajes','Gym','Lectura','Arte','Moda','Gaming','Cocina','Baile','Fotografía','Naturaleza'];
const PREFERENCES = ['Viajar','Coquetear','Música','Citas','Conversar','Cine y series','Cenas','Baile','Juegos','Deportes'];
const ZODIAC = ['♈ Aries','♉ Tauro','♊ Géminis','♋ Cáncer','♌ Leo','♍ Virgo','♎ Libra','♏ Escorpio','♐ Sagitario','♑ Capricornio','♒ Acuario','♓ Piscis'];
const _pe = { interests: new Set(), preferences: new Set(), zodiac: null };
function toggleChip(el, group, value) { const s = _pe[group]; if (s.has(value)) { s.delete(value); el.classList.remove('active'); } else { s.add(value); el.classList.add('active'); } }
function pickZodiac(el, value) { _pe.zodiac = value; document.querySelectorAll('.zodiac-chip').forEach(z => z.classList.remove('active')); el.classList.add('active'); }
function injectProfileStyle() {
  if (document.getElementById('fendyx-profile-style')) return;
  const st = document.createElement('style');
  st.id = 'fendyx-profile-style';
  st.textContent = `
    .pf-gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}
    .pf-gallery img{width:100%;height:110px;object-fit:cover;border-radius:12px;border:1px solid var(--border);cursor:pointer;transition:transform .15s}
    .pf-gallery img:hover{transform:scale(1.05)}
    .pf-lightbox{position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:800;display:flex;align-items:center;justify-content:center;padding:20px;cursor:pointer}
    .pf-lightbox img{max-width:100%;max-height:90vh;object-fit:contain;border-radius:10px}
    .pf-hero{display:flex;gap:14px;align-items:center;margin-bottom:12px;position:relative}
    .pf-hero img,.pf-hero-letter{width:84px;height:84px;border-radius:50%;object-fit:cover;flex-shrink:0}
    .pf-hero-letter{background:var(--gradient);color:#04060c;display:flex;align-items:center;justify-content:center;font-size:2.2rem;font-weight:900}
    .pf-meta{flex:1;text-align:left}
    .pf-meta b{font-size:1.25rem;display:block;margin-bottom:4px}`;
  document.head.appendChild(st);
}
function openLightbox(url) { const lb = document.createElement('div'); lb.className = 'pf-lightbox'; lb.innerHTML = `<img src="${url}">`; lb.onclick = () => lb.remove(); document.body.appendChild(lb); }
async function loadProfileSection() {
  const p = currentProfile;
  document.getElementById('profileName').textContent = p.model_name || p.full_name || 'Usuario';
  document.getElementById('profileEmail').textContent = p.email;
  document.getElementById('profileRole').textContent = ROLE_LABELS[p.role] || p.role;
  document.getElementById('statTokens').textContent = p.unlimited_tokens ? '∞' : parseFloat(p.tokens_balance || 0).toFixed(2);
  document.getElementById('statVerified').textContent = p.is_verified ? 'Sí ✅' : 'No';
  document.getElementById('statStatus').textContent = STATUS_LABELS[roleDetails?.relationship_status] || '—';
  document.getElementById('profileAvatar').textContent = (p.full_name || 'U').charAt(0).toUpperCase();
  const img = document.getElementById('profileAvatarImg');
  if (p.avatar_url) { img.src = p.avatar_url; img.style.display = 'block'; document.getElementById('profileAvatar').style.display = 'none'; }
}
function fillProfilePro() {
  const p = currentProfile;
  _pe.interests = new Set(p.interests || []); _pe.preferences = new Set(p.preferences || []); _pe.zodiac = p.zodiac || null;
  const form = document.querySelector('#section-profileedit form');
  form.innerHTML = `<h3>✏️ Editor de Perfil Pro</h3>
    ${currentProfile.role === 'remote_worker' ? `<label class="dim">Nombre artístico</label><input type="text" id="proModelName" value="${p.model_name || ''}">` : ''}
    <label class="dim">Nombre (privado)</label><input type="text" id="proName" value="${p.full_name || ''}">
    <label class="dim">Edad</label><input type="number" id="proAge" min="18" max="100" value="${p.age || ''}">
    <label class="dim">Ocupación</label><input type="text" id="proOccupation" value="${p.occupation || ''}">
    <label class="dim">Descripción</label><textarea id="proBio" rows="3">${p.bio || ''}</textarea>
    <label class="dim">Foto de perfil</label><input type="file" id="proAvatar" accept="image/*">
    <label class="dim">Fotos públicas (máx 5)</label><input type="file" id="proGallery" accept="image/*" multiple>
    <div id="proGalleryPrev" class="pf-gallery">${(p.gallery_urls || []).slice(0, 5).map(u => `<img src="${u}" onclick="openLightbox('${u}')">`).join('')}</div>
    <label class="dim">🎯 Intereses</label><div class="chips-row">${INTERESTS.map(i => `<span class="chip ${_pe.interests.has(i) ? 'active' : ''}" onclick="toggleChip(this,'interests','${i}')">${i}</span>`).join('')}</div>
    <label class="dim">💫 Preferencias</label><div class="chips-row">${PREFERENCES.map(i => `<span class="chip ${_pe.preferences.has(i) ? 'active' : ''}" onclick="toggleChip(this,'preferences','${i}')">${i}</span>`).join('')}</div>
    <label class="dim">✨ Zodiaco</label><div class="chips-row">${ZODIAC.map(z => `<span class="chip zodiac-chip ${_pe.zodiac === z ? 'active' : ''}" onclick="pickZodiac(this,'${z}')">${z}</span>`).join('')}</div>
    <button type="submit" class="btn-primary">Guardar perfil</button>`;
}
async function saveProfilePro(e) {
  e.preventDefault();
  const p = currentProfile;
  const up = { full_name: document.getElementById('proName').value || p.full_name, age: parseInt(document.getElementById('proAge').value, 10) || p.age, occupation: document.getElementById('proOccupation').value, bio: document.getElementById('proBio').value, interests: Array.from(_pe.interests), preferences: Array.from(_pe.preferences), zodiac: _pe.zodiac };
  const mn = document.getElementById('proModelName'); if (mn) up.model_name = mn.value.trim();
  const av = document.getElementById('proAvatar').files[0];
  if (av) { const path = 'avatars/' + currentUser.id + '_' + Date.now() + '.png'; const r = await db.storage.from('fendyx-assets').upload(path, av); if (!r.error) up.avatar_url = db.storage.from('fendyx-assets').getPublicUrl(path).data.publicUrl; }
  const files = Array.from(document.getElementById('proGallery').files || []);
  if (files.length) { let g = [...(p.gallery_urls || [])]; for (const f of files) { if (g.length >= 5) { showToast('⚠️ Máx 5'); break; } const path = 'gallery/' + currentUser.id + '_' + Date.now() + '_' + f.name.replace(/[^a-zA-Z0-9.]/g, '_'); const r = await db.storage.from('fendyx-assets').upload(path, f); if (!r.error) g.push(db.storage.from('fendyx-assets').getPublicUrl(path).data.publicUrl); } up.gallery_urls = g.slice(0, 5); }
  await db.from('profiles').update(up).eq('id', currentUser.id);
  await loadProfile(); updateHeader(); loadProfileSection(); fillProfilePro();
  showToast('✅ Perfil Pro actualizado');
}
async function viewUserProfile(userId) {
  injectProfileStyle();
  const { data } = await db.from('profiles').select('*, role_details(*)').eq('id', userId).single();
  if (!data) return;
  viewedUserId = userId;
  const rd = data.role_details?.[0];
  const lvNum = Math.min(5, Math.max(1, parseInt(rd?.worker_level) || 1));
  const displayName = (data.role === 'remote_worker' ? (data.model_name || data.full_name) : data.full_name) || 'Usuario';
  const mainPhoto = data.avatar_url || (data.gallery_urls || [])[0] || '';
  const allPhotos = [mainPhoto, ...(data.gallery_urls || [])].filter(Boolean).slice(0, 6);
  document.getElementById('upName').textContent = displayName;
  const modalContent = document.querySelector('#modal-userprofile .modal-content');
  if (modalContent) { modalContent.className = 'modal-content wide tier-' + lvNum; }
  const hero = document.querySelector('#modal-userprofile .pf-hero');
  if (hero) hero.outerHTML = `<div class="pf-hero">
    ${mainPhoto ? `<img src="${mainPhoto}" onclick="openLightbox('${mainPhoto}')">` : `<div class="pf-hero-letter">${(displayName || '?').charAt(0).toUpperCase()}</div>`}
    <div class="pf-meta"><b>${displayName}${data.age ? ' · ' + data.age + ' años' : ''}</b>
    ${data.role === 'remote_worker' ? levelBadge(lvNum) : `<span class="role-badge">${ROLE_LABELS[data.role] || data.role}</span>`}
    ${data.is_verified ? ' <span style="color:var(--success)">✅</span>' : ''}
    <div style="margin-top:6px">${stars(data.rating || 5)} ${parseFloat(data.rating || 5).toFixed(1)}</div>
    ${data.occupation ? `<div class="dim" style="margin-top:4px">${data.occupation}</div>` : ''}</div></div>`;
  document.getElementById('upVerified').innerHTML = data.zodiac ? `<span class="chip">${data.zodiac}</span>` : '';
  document.getElementById('upRating').textContent = stars(data.rating || 5) + ' ' + parseFloat(data.rating || 5).toFixed(1);
  document.getElementById('upBio').innerHTML = data.bio || rd?.bio || 'Sin descripción.';
  document.getElementById('upInterests').innerHTML = (data.interests || []).map(i => `<span class="chip active">🎯 ${i}</span>`).join('') + (data.preferences || []).map(i => `<span class="chip">💫 ${i}</span>`).join('') || '<p class="dim">Sin intereses</p>';
  const gal = document.getElementById('upGallery');
  if (gal) gal.outerHTML = `<div id="upGallery"><h4 class="sub-title">📸 Galería</h4>${allPhotos.length ? `<div class="pf-gallery">${allPhotos.map(u => `<img src="${u}" onclick="openLightbox('${u}')">`).join('')}</div>` : '<p class="dim">Sin fotos</p>'}</div>`;
  const actions = document.getElementById('upActions');
  const canCall = data.role === 'remote_worker' && data.kyc_status === 'approved' && data.id !== currentUser.id;
  const rate = rd?.rate_per_minute != null ? rd.rate_per_minute : levelInfo(lvNum).rate;
  actions.innerHTML = `${canCall ? `<button class="btn-primary" onclick="callFromProfile('${data.id}',${rate})">📹 Llamar · ◈ ${rate}/min</button>` : ''}
    ${data.id !== currentUser.id ? `<button class="btn-secondary" onclick="messageFromProfile()">💬 Mensaje</button>` : ''}
    ${data.id !== currentUser.id ? `<button class="btn-secondary" style="border-color:var(--error);color:var(--error)" onclick="reportFromProfile()">🚩 Reportar</button>` : ''}`;
  openModal('modal-userprofile');
}
async function reportFromProfile() { const r = prompt('Motivo del reporte:'); if (!r || !r.trim()) return; await reportUser(viewedUserId, r.trim()); closeModal('modal-userprofile'); }
async function callFromProfile(id, rate) { closeModal('modal-userprofile'); await loadScript('remote.js'); startCall(id, rate); }
async function messageFromProfile() { if (viewedUserId) { await loadScript('chat.js'); startChatWith(viewedUserId); } }
async function joinKycRoom() { await loadScript('calls.js'); document.getElementById('kycTitle').textContent = '🎥 KYC en curso'; document.getElementById('kycVerifyBtn').classList.add('hidden'); await joinWebCall('FENDYX_KYC_' + currentUser.id.slice(0, 8), { rate: 0, rowId: null, asClient: false }); }
function closeKyc() { if (typeof callRoom !== 'undefined' && callRoom) endWebCall(); else closeModal('modal-kyc'); }
