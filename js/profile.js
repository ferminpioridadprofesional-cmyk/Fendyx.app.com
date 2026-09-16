'use strict';
let viewedUserId = null;
const INTERESTS = ['Música','Cine','Viajes','Gym','Lectura','Arte','Moda','Gaming','Cocina','Baile','Fotografía','Naturaleza'];
const PREFERENCES = ['Viajar','Coquetear','Música','Citas','Conversar','Cine y series','Cenas','Baile','Juegos','Deportes'];
const ZODIAC = ['♈ Aries','♉ Tauro','♊ Géminis','♋ Cáncer','♌ Leo','♍ Virgo','♎ Libra','♏ Escorpio','♐ Sagitario','♑ Capricornio','♒ Acuario','♓ Piscis'];
const _pe = { interests: new Set(), preferences: new Set(), zodiac: null };

function toggleChip(el, group, value) {
  const set = _pe[group];
  if (set.has(value)) { set.delete(value); el.classList.remove('active'); }
  else { set.add(value); el.classList.add('active'); }
}
function pickZodiac(el, value) {
  _pe.zodiac = value;
  document.querySelectorAll('.zodiac-chip').forEach(z => z.classList.remove('active'));
  el.classList.add('active');
}

async function loadProfileSection() {
  const p = currentProfile;
  document.getElementById('profileName').textContent = p.full_name || 'Usuario';
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
  _pe.interests = new Set(p.interests || []);
  _pe.preferences = new Set(p.preferences || []);
  _pe.zodiac = p.zodiac || null;
  const form = document.querySelector('#section-profileedit form');
  form.innerHTML = `
    <h3>✏️ Editor de Perfil Pro</h3>
    <label class="dim">Foto de perfil (1)</label>
    <input type="file" id="proAvatar" accept="image/*">
    <label class="dim">Fotos públicas (máximo 5)</label>
    <input type="file" id="proGallery" accept="image/*" multiple>
    <div id="proGalleryPrev" class="gallery-grid">${(p.gallery_urls || []).slice(0,5).map(u => `<img src="${u}">`).join('')}</div>
    <input type="text" id="proName" placeholder="Nombre" value="${p.full_name || ''}">
    <input type="number" id="proAge" placeholder="Edad" min="18" max="100" value="${p.age || ''}">
    <input type="text" id="proOccupation" placeholder="Ocupación" value="${p.occupation || ''}">
    <textarea id="proBio" placeholder="Descripción" rows="3">${p.bio || ''}</textarea>
    <label class="dim">🎯 Intereses (seleccionables)</label>
    <div class="chips-row">${INTERESTS.map(i => `<span class="chip ${_pe.interests.has(i) ? 'active' : ''}" onclick="toggleChip(this,'interests','${i}')">${i}</span>`).join('')}</div>
    <label class="dim">💫 Preferencias (seleccionables)</label>
    <div class="chips-row">${PREFERENCES.map(i => `<span class="chip ${_pe.preferences.has(i) ? 'active' : ''}" onclick="toggleChip(this,'preferences','${i}')">${i}</span>`).join('')}</div>
    <label class="dim">✨ Signo zodiacal (seleccionable)</label>
    <div class="chips-row">${ZODIAC.map(z => `<span class="chip zodiac-chip ${_pe.zodiac === z ? 'active' : ''}" onclick="pickZodiac(this,'${z}')">${z}</span>`).join('')}</div>
    <button type="submit" class="btn-primary">Guardar perfil</button>`;
}

async function saveProfilePro(e) {
  e.preventDefault();
  const p = currentProfile;
  const up = {
    full_name: document.getElementById('proName').value || p.full_name,
    age: parseInt(document.getElementById('proAge').value, 10) || p.age,
    occupation: document.getElementById('proOccupation').value,
    bio: document.getElementById('proBio').value,
    interests: Array.from(_pe.interests),
    preferences: Array.from(_pe.preferences),
    zodiac: _pe.zodiac
  };
  const av = document.getElementById('proAvatar').files[0];
  if (av) { const path = 'avatars/' + currentUser.id + '_' + Date.now() + '.png'; const r = await db.storage.from('fendyx-assets').upload(path, av); if (!r.error) up.avatar_url = db.storage.from('fendyx-assets').getPublicUrl(path).data.publicUrl; }
  const files = Array.from(document.getElementById('proGallery').files || []);
  if (files.length) {
    let gallery = [...(p.gallery_urls || [])];
    for (const f of files) {
      if (gallery.length >= 5) { showToast('⚠️ Máximo 5 fotos públicas'); break; }
      const path = 'gallery/' + currentUser.id + '_' + Date.now() + '_' + f.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const r = await db.storage.from('fendyx-assets').upload(path, f);
      if (!r.error) gallery.push(db.storage.from('fendyx-assets').getPublicUrl(path).data.publicUrl);
    }
    up.gallery_urls = gallery.slice(0, 5);
  }
  await db.from('profiles').update(up).eq('id', currentUser.id);
  await loadProfile(); updateHeader(); loadProfileSection(); fillProfilePro();
  showToast('✅ Perfil Pro actualizado');
}

async function viewUserProfile(userId) {
  const { data } = await db.from('profiles').select('*, role_details(*)').eq('id', userId).single();
  if (!data) return;
  viewedUserId = userId;
  const rd = data.role_details?.[0];
  const lv = levelInfo(rd?.worker_level);
  document.getElementById('upName').textContent = data.full_name || 'Usuario';
  const img = document.getElementById('upAvatar'), let_ = document.getElementById('upAvatarLetter');
  if (data.avatar_url) { img.src = data.avatar_url; img.classList.remove('hidden'); let_.classList.add('hidden'); }
  else { img.classList.add('hidden'); let_.classList.remove('hidden'); let_.textContent = (data.full_name || 'U').charAt(0).toUpperCase(); }
  document.getElementById('upRole').textContent = ROLE_LABELS[data.role] || data.role;
  document.getElementById('upVerified').textContent = data.is_verified ? ' ✅ Verificado' : '';
  document.getElementById('upRating').textContent = stars(data.rating || 5) + ' ' + parseFloat(data.rating || 5).toFixed(1);
  const meta = [data.age ? data.age + ' años' : '', data.occupation, data.zodiac].filter(Boolean).join(' · ');
  document.getElementById('upBio').innerHTML = `${meta ? '<b>' + meta + '</b><br>' : ''}${data.bio || rd?.bio || 'Sin descripción.'}`;
  document.getElementById('upInterests').innerHTML =
    (data.interests || []).map(i => `<span class="chip active">🎯 ${i}</span>`).join('') +
    (data.preferences || []).map(i => `<span class="chip">💫 ${i}</span>`).join('') || '<p class="dim">Sin intereses publicados</p>';
  document.getElementById('upGallery').innerHTML = (data.gallery_urls || []).slice(0, 5).map(u => `<img src="${u}" onclick="window.open('${u}')">`).join('') || '<p class="dim">Sin fotos públicas</p>';
  const actions = document.getElementById('upActions');
  const canCall = data.role === 'remote_worker' && data.kyc_status === 'approved' && data.id !== currentUser.id;
  actions.innerHTML = `
    ${canCall ? `<button class="btn-primary" onclick="callFromProfile('${data.id}',${rd?.rate_per_minute || lv.rate})">📹 Llamar · ◈ ${rd?.rate_per_minute || lv.rate}/min</button>` : ''}
    ${data.id !== currentUser.id ? `<button class="btn-secondary" onclick="messageFromProfile()">💬 Enviar mensaje</button>` : ''}
    ${data.id !== currentUser.id ? `<button class="btn-secondary" style="border-color:var(--error);color:var(--error)" onclick="reportFromProfile()">🚩 Reportar perfil</button>` : ''}`;
  openModal('modal-userprofile');
}
async function reportFromProfile() {
  const reason = prompt('Motivo del reporte (estafa, acoso, suplantación, contenido inapropiado…):');
  if (!reason || !reason.trim()) return;
  await reportUser(viewedUserId, reason.trim());
  closeModal('modal-userprofile');
}
async function callFromProfile(id, rate) {
  closeModal('modal-userprofile');
  await loadScript('remote.js');
  startCall(id, rate);
}
async function messageFromProfile() { if (viewedUserId) { await loadScript('chat.js'); startChatWith(viewedUserId); } }

async function joinKycRoom() {
  await loadScript('calls.js');
  document.getElementById('kycTitle').textContent = '🎥 Verificación KYC en curso';
  document.getElementById('kycVerifyBtn').classList.add('hidden');
  await joinWebCall('FENDYX_KYC_' + currentUser.id.slice(0, 8), { rate: 0, rowId: null, asClient: false });
}
function closeKyc() {
  if (typeof callRoom !== 'undefined' && callRoom) { endWebCall(); }
  else { closeModal('modal-kyc'); }
}
