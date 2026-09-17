'use strict';
let _girlsList = [];
const _we = { interests: new Set(), preferences: new Set(), zodiac: null };
function toggleWChip(el, g, v) { const s = _we[g]; if (s.has(v)) { s.delete(v); el.classList.remove('active'); } else { s.add(v); el.classList.add('active'); } }
function pickWZodiac(el, v) { _we.zodiac = v; document.querySelectorAll('.wz-chip').forEach(z => z.classList.remove('active')); el.classList.add('active'); }

function injectGirlStyle() {
  if (document.getElementById('fendyx-girl-style')) return;
  const st = document.createElement('style');
  st.id = 'fendyx-girl-style';
  st.textContent = `
    .girl-card{padding:14px}
    .girl-photo{width:100%;height:220px;border-radius:14px;overflow:hidden;background:#111;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid var(--border)}
    .girl-photo img{width:100%;height:100%;object-fit:cover;object-position:center}
    .girl-initial{font-size:3rem;color:var(--dim)}
    .girl-thumbs{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
    .girl-thumbs img{width:52px;height:52px;object-fit:cover;object-position:center;border-radius:9px;border:1px solid var(--border);cursor:pointer}
    .girl-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap}
    .wk-card{padding:18px;border-radius:16px;border:1px solid var(--border);background:rgba(255,255,255,.03);text-align:center}
    .wk-name{font-family:'Orbitron';font-weight:900;font-size:1.3rem;margin-bottom:8px}
    .wk-row{display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0}
    .wk-rate{font-weight:800;color:var(--primary)}
    .wk-kyc{font-size:.85rem;color:var(--dim);margin:6px 0 14px}
    .wk-switch-row{display:flex;justify-content:center;align-items:center;gap:14px}
    .wk-state{font-weight:900;font-size:.95rem}
    .wk-state.on{color:var(--success)} .wk-state.off{color:var(--error)}
    .wk-switch{position:relative;display:inline-block;width:64px;height:32px}
    .wk-switch input{opacity:0;width:0;height:0}
    .wk-slider{position:absolute;inset:0;border-radius:999px;background:rgba(255,59,107,.25);border:1px solid var(--error);transition:.3s;cursor:pointer}
    .wk-slider:before{content:'';position:absolute;width:26px;height:26px;left:3px;top:2px;border-radius:50%;background:var(--error);transition:.3s;box-shadow:0 0 10px rgba(255,59,107,.6)}
    .wk-switch input:checked + .wk-slider{background:rgba(0,255,157,.2);border-color:var(--success);animation:switchGlow 1.6s infinite}
    .wk-switch input:checked + .wk-slider:before{transform:translateX(32px);background:var(--success);box-shadow:0 0 14px rgba(0,255,157,.8)}
    @keyframes switchGlow{0%,100%{box-shadow:0 0 6px rgba(0,255,157,.3)}50%{box-shadow:0 0 18px rgba(0,255,157,.7)}}
    .wk-pro{margin-top:14px;text-align:left;border-top:1px solid var(--border);padding-top:12px}`;
  document.head.appendChild(st);
}
// Wrappers que garantizan que profile.js (lightbox + perfil) esté cargado
async function openWorkerProfile(id) { await loadScript('profile.js'); viewWorkerProfile(id, false); }
async function previewWorkerProfile() { await loadScript('profile.js'); viewWorkerProfile(currentUser.id, true); }
async function openGirlGallery(idx, i) {
  const g = (_girlsList[idx]?.gallery) || [];
  if (!g.length) return;
  if (typeof openLightbox !== 'function') await loadScript('profile.js');
  openLightbox(g, i);
}

function girlCard(w, idx) {
  const lvNum = Math.min(5, Math.max(1, parseInt(w.worker_level) || 1));
  const rate = parseFloat(w.rate_per_minute) || levelInfo(lvNum).rate;
  const name = w.display_name || 'Modelo';
  const gallery = w.gallery || [];
  const mainPhoto = w.avatar_url || gallery[0] || '';
  return `<div class="card-item girl-card tier-${lvNum}">
    <div class="girl-photo" onclick="openGirlGallery(${idx},0)">${mainPhoto ? `<img src="${mainPhoto}" alt="">` : `<span class="girl-initial">${name.charAt(0).toUpperCase()}</span>`}</div>
    ${gallery.length ? `<div class="girl-thumbs">${gallery.map((g, i) => `<img src="${g}" alt="" onclick="openGirlGallery(${idx},${i})">`).join('')}</div>` : ''}
    <div class="girl-head"><div class="card-title" style="margin:0">${name}${w.age ? ', ' + w.age : ''}</div>${levelBadge(lvNum)}</div>
    <span class="status-pill ${w.is_online ? 'online' : 'offline'}">${w.is_online ? 'EN LÍNEA' : 'DESCONECTADA'}</span>
    <span class="role-badge">◈ ${rate}/min</span> ${w.zodiac ? `<span class="chip">${w.zodiac}</span>` : ''}
    <div class="card-desc">${w.occupation || ''}</div>
    <div class="chips-row" style="margin:6px 0">${(w.interests || []).slice(0, 3).map(i => `<span class="chip">🎯 ${i}</span>`).join('')}</div>
    <div class="row-actions">
      <button class="btn-small" onclick="openWorkerProfile('${w.id}')">👤 Ver perfil y fotos</button>
      <button class="btn-small success" onclick="startCall('${w.id}',${rate})" ${w.is_online ? '' : 'disabled'}>📹 Llamar</button>
    </div>
  </div>`;
}
async function fetchPublicWorkers() {
  const { data, error } = await db.rpc('get_public_workers');
  if (error) { showToast('❌ ' + error.message); return []; }
  return (typeof data === 'string' ? JSON.parse(data) : data) || [];
}
async function loadGirls() {
  if (!requireActive()) return;
  injectGirlStyle();
  await loadScript('profile.js');
  _girlsList = await fetchPublicWorkers();
  document.getElementById('girlsGrid').innerHTML = _girlsList.map((w, i) => girlCard(w, i)).join('') || '<p class="empty-state">No hay chicas verificadas en línea</p>';
}

async function loadWorkers() {
  const isWorker = currentProfile.role === 'remote_worker';
  const grid = document.getElementById('workersGrid');
  const panel = document.getElementById('workerPanel');
  if (isWorker) {
    injectGirlStyle();
    await loadScript('profile.js');
    grid.style.display = 'none'; grid.innerHTML = '';
    panel.classList.remove('hidden');
    const p = currentProfile;
    const lvNum = Math.min(5, Math.max(1, parseInt(roleDetails?.worker_level) || 1));
    const rate = roleDetails?.rate_per_minute != null ? roleDetails.rate_per_minute : levelInfo(lvNum).rate;
    const on = !!p.is_online;
    _we.interests = new Set(p.interests || []); _we.preferences = new Set(p.preferences || []); _we.zodiac = p.zodiac || null;
    const INTERESTS = ['Música','Cine','Viajes','Gym','Lectura','Arte','Moda','Gaming','Cocina','Baile','Fotografía','Naturaleza'];
    const PREFERENCES = ['Viajar','Coquetear','Música','Citas','Conversar','Cine y series','Cenas','Baile','Juegos','Deportes'];
    const ZODIAC = ['♈ Aries','♉ Tauro','♊ Géminis','♋ Cáncer','♌ Leo','♍ Virgo','♎ Libra','♏ Escorpio','♐ Sagitario','♑ Capricornio','♒ Acuario','♓ Piscis'];
    panel.innerHTML = `<h3>💼 Mi Trabajo</h3>
      <div class="wk-card tier-${lvNum}">
        <div class="wk-name">🎭 ${p.model_name || 'Modelo'}</div>
        <div class="wk-row">${levelBadge(lvNum)} <span class="wk-rate">◈ ${rate}/min</span></div>
        <div class="wk-kyc">${p.kyc_status === 'approved' ? '✅ Verificación KYC aprobada' : '⏳ Verificación KYC pendiente'}</div>
        <div class="wk-switch-row">
          <span id="wkState" class="wk-state ${on ? 'on' : 'off'}">${on ? '🟢 EN LÍNEA' : '🔴 DESCONECTADA'}</span>
          <label class="wk-switch"><input type="checkbox" id="wkToggle" ${on ? 'checked' : ''} onchange="setWorkerOnline(this.checked)"><span class="wk-slider"></span></label>
        </div>
        <p class="dim" style="margin-top:12px">Solo recibes llamadas con la app/página <b>abierta</b> y el switch en verde.</p>
        <div class="row-buttons" style="margin-top:10px">
          <button class="btn-secondary half" onclick="previewWorkerProfile()">👁 Previsualizar perfil</button>
        </div>
        <div class="wk-pro">
          <h4 class="sub-title">🎭 Mi Perfil de Modelo (solo visible en Videollamada con chicas)</h4>
          <form class="owner-form" onsubmit="saveWorkerPro(event)">
            <label class="dim">Nombre artístico</label><input type="text" id="wpModel" value="${p.model_name || ''}">
            <label class="dim">Fotos de modelo (máx 5)</label><input type="file" id="wpGallery" accept="image/*" multiple>
            <div class="girl-thumbs">${(p.worker_gallery || []).slice(0, 5).map(g => `<img src="${g}">`).join('')}</div>
            <label class="dim">Descripción</label><textarea id="wpBio" rows="3">${p.bio || ''}</textarea>
            <label class="dim">🎯 Intereses</label><div class="chips-row">${INTERESTS.map(i => `<span class="chip ${_we.interests.has(i) ? 'active' : ''}" onclick="toggleWChip(this,'interests','${i}')">${i}</span>`).join('')}</div>
            <label class="dim">💫 Preferencias</label><div class="chips-row">${PREFERENCES.map(i => `<span class="chip ${_we.preferences.has(i) ? 'active' : ''}" onclick="toggleWChip(this,'preferences','${i}')">${i}</span>`).join('')}</div>
            <label class="dim">✨ Zodiaco</label><div class="chips-row">${ZODIAC.map(z => `<span class="chip wz-chip ${_we.zodiac === z ? 'active' : ''}" onclick="pickWZodiac(this,'${z}')">${z}</span>`).join('')}</div>
            <button type="submit" class="btn-primary">💾 Guardar Perfil de Modelo</button>
          </form>
        </div>
      </div>`;
    return;
  }
  injectGirlStyle();
  await loadScript('profile.js');
  grid.style.display = '';
  panel.classList.add('hidden');
  _girlsList = await fetchPublicWorkers();
  grid.innerHTML = _girlsList.map((w, i) => girlCard(w, i)).join('') || '<p class="empty-state">Sin trabajadoras</p>';
}
async function saveWorkerPro(e) {
  e.preventDefault();
  const p = currentProfile;
  const up = { model_name: document.getElementById('wpModel').value.trim(), bio: document.getElementById('wpBio').value, interests: Array.from(_we.interests), preferences: Array.from(_we.preferences), zodiac: _we.zodiac };
  const files = Array.from(document.getElementById('wpGallery').files || []);
  if (files.length) { let g = [...(p.worker_gallery || [])]; for (const f of files) { if (g.length >= 5) { showToast('⚠️ Máx 5 fotos'); break; } const path = 'wgallery/' + currentUser.id + '_' + Date.now() + '_' + f.name.replace(/[^a-zA-Z0-9.]/g, '_'); const r = await db.storage.from('fendyx-assets').upload(path, f); if (!r.error) g.push(db.storage.from('fendyx-assets').getPublicUrl(path).data.publicUrl); } up.worker_gallery = g.slice(0, 5); }
  await db.from('profiles').update(up).eq('id', currentUser.id);
  await loadProfile(); loadWorkers();
  showToast('✅ Perfil de Modelo guardado');
}
async function setWorkerOnline(on) {
  localStorage.setItem('fendyx_online_intent', on ? '1' : '0');
  await setWorkerOnlineDB(on);
  const st = document.getElementById('wkState');
  if (st) { st.className = 'wk-state ' + (on ? 'on' : 'off'); st.textContent = on ? '🟢 EN LÍNEA' : '🔴 DESCONECTADA'; }
  showToast(on ? '🟢 En línea: te pueden llamar' : '🔴 Desconectada');
}
function fillKycForm() {
  const p = currentProfile;
  const box = document.getElementById('kycStatusBox');
  const st = { none: '⚪ No aplica', pending: '⏳ Pendiente', approved: '✅ Verificada', rejected: '❌ Rechazada: ' + (p.kyc_note || '') }[p.kyc_status] || '⚪';
  box.innerHTML = `<h3>Verificación</h3><p>${st}</p><p class="dim">Real: <b>${p.full_name || '—'}</b> · Artístico: <b>${p.model_name || '—'}</b></p>${p.id_card_url ? `<img class="kyc-img" src="${p.id_card_url}">` : ''}${p.face_photo_url ? `<img class="kyc-img" src="${p.face_photo_url}">` : ''}`;
  document.getElementById('kycWhatsapp').value = p.whatsapp || '';
}
async function submitKycDocs(e) {
  e.preventDefault();
  const up = { whatsapp: document.getElementById('kycWhatsapp').value, kyc_status: 'pending' };
  const idf = document.getElementById('kycIdCard').files[0];
  const fcf = document.getElementById('kycFace').files[0];
  if (idf) { const p1 = 'kyc/' + currentUser.id + '_id_' + Date.now() + '.jpg'; const r = await db.storage.from('fendyx-assets').upload(p1, idf); if (!r.error) up.id_card_url = db.storage.from('fendyx-assets').getPublicUrl(p1).data.publicUrl; }
  if (fcf) { const p2 = 'kyc/' + currentUser.id + '_face_' + Date.now() + '.jpg'; const r = await db.storage.from('fendyx-assets').upload(p2, fcf); if (!r.error) up.face_photo_url = db.storage.from('fendyx-assets').getPublicUrl(p2).data.publicUrl; }
  await db.from('profiles').update(up).eq('id', currentUser.id);
  await loadProfile(); fillKycForm(); showToast('📨 Enviado');
}
async function startCall(workerId, rate) {
  if (!requireActive()) return;
  if (currentProfile.role !== 'admin' && currentProfile.kyc_status !== 'approved') { showToast('🪪 Verifica tu identidad (cédula + rostro) en Mi Perfil para llamar'); showSection('profile'); return; }
  rate = parseFloat(rate) || 0.2;
  const { data: wk } = await db.from('profiles').select('is_online, kyc_status').eq('id', workerId).single();
  if (!wk || wk.kyc_status !== 'approved') { showToast('❌ No verificada'); return; }
  if (!wk.is_online) { showToast('❌ No está en línea ahora'); return; }
  if (!currentProfile.unlimited_tokens && parseFloat(currentProfile.tokens_balance) < rate) { showToast('❌ Saldo insuficiente'); return; }
  const roomId = 'FENDYX' + Date.now();
  const { data: call } = await db.from('video_calls').insert({ worker_id: workerId, client_id: currentUser.id, room_id: roomId, rate_per_minute: rate, status: 'active', started_at: new Date().toISOString() }).select().single();
  await loadScript('calls.js');
  await startWebCall(roomId, { rate, rowId: call.id, asClient: true });
}
async function joinCall(callId, roomId, rate) { await loadScript('calls.js'); await joinWebCall(roomId, { rate: parseFloat(rate) || 0, rowId: callId, asClient: false }); }
