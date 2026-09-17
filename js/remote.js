'use strict';

function injectGirlStyle() {
  if (document.getElementById('fendyx-girl-style')) return;
  const st = document.createElement('style');
  st.id = 'fendyx-girl-style';
  st.textContent = `
    .girl-card{padding:14px}
    .girl-photo{width:100%;height:220px;border-radius:14px;overflow:hidden;background:#111;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid var(--border)}
    .girl-photo img{width:100%;height:100%;object-fit:cover}
    .girl-initial{font-size:3rem;color:var(--dim)}
    .girl-thumbs{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
    .girl-thumbs img{width:52px;height:52px;object-fit:cover;border-radius:9px;border:1px solid var(--border);cursor:pointer}
    .girl-thumbs img:hover{border-color:var(--border-strong)}`;
  document.head.appendChild(st);
}

function girlCard(w) {
  const rd = w.role_details?.[0], lv = levelInfo(rd?.worker_level);
  const rate = (rd?.rate_per_minute != null ? rd.rate_per_minute : lv.rate);
  const displayName = w.model_name || w.full_name;
  const mainPhoto = w.avatar_url || (w.gallery_urls || [])[0] || '';
  const gallery = (w.gallery_urls || []).slice(0, 5);
  return `<div class="card-item girl-card">
    <div class="girl-photo" onclick="openProfile('${w.id}')">${mainPhoto ? `<img src="${mainPhoto}" alt="">` : `<span class="girl-initial">${(displayName || '?').charAt(0).toUpperCase()}</span>`}</div>
    ${gallery.length ? `<div class="girl-thumbs">${gallery.map(g => `<img src="${g}" alt="" onclick="event.stopPropagation();openProfile('${w.id}')">`).join('')}</div>` : ''}
    <div class="card-title">${displayName || '—'}${w.age ? ', ' + w.age : ''} ${w.zodiac || ''}</div>
    <span class="status-pill ${w.is_online ? 'online' : 'offline'}">${w.is_online ? 'EN LÍNEA' : 'DESCONECTADA'}</span>
    <span class="role-badge">${lv.name} · ◈ ${rate}/min</span>
    <div class="card-desc">${w.occupation || ''}</div>
    <div class="chips-row" style="margin:6px 0">${(w.interests || []).slice(0, 3).map(i => `<span class="chip">🎯 ${i}</span>`).join('')}</div>
    <div class="row-actions">
      <button class="btn-small" onclick="openProfile('${w.id}')">👤 Ver perfil y fotos</button>
      <button class="btn-small success" onclick="startCall('${w.id}',${rate})" ${w.is_online ? '' : 'disabled'}>📹 Llamar</button>
    </div>
  </div>`;
}

async function loadGirls() {
  if (!requireActive()) return;
  injectGirlStyle();
  const { data } = await db.from('profiles').select('*, role_details(*)').eq('role', 'remote_worker').eq('kyc_status', 'approved').order('is_online', { ascending: false });
  document.getElementById('girlsGrid').innerHTML = (data || []).map(girlCard).join('') || '<p class="empty-state">No hay chicas verificadas en línea</p>';
}

async function loadWorkers() {
  const isWorker = currentProfile.role === 'remote_worker';
  const grid = document.getElementById('workersGrid');
  const panel = document.getElementById('workerPanel');
  if (isWorker) {
    grid.style.display = 'none'; grid.innerHTML = '';
    panel.classList.remove('hidden');
    const lv = levelInfo(roleDetails?.worker_level);
    document.getElementById('workerSpecialty').value = roleDetails?.specialty || '';
    document.getElementById('workerBio').value = currentProfile.bio || roleDetails?.bio || '';
    document.getElementById('workerOnline').checked = !!currentProfile.is_online;
    const info = document.getElementById('workerLevelInfo');
    if (info) info.innerHTML = `Nombre artístico: <b>${currentProfile.model_name || '(defínelo en Perfil Pro)'}</b><br>Tu nivel: <b>${lv.name}</b> · Tarifa: <b>◈ ${roleDetails?.rate_per_minute != null ? roleDetails.rate_per_minute : lv.rate}/min</b> · KYC: <b>${currentProfile.kyc_status}</b><br>${currentProfile.is_online ? '🟢 EN LÍNEA: recibes llamadas' : '🔴 DESCONECTADA: no recibes llamadas'}`;
    loadMyCalls();
    return;
  }
  injectGirlStyle();
  grid.style.display = '';
  panel.classList.add('hidden');
  const { data } = await db.from('profiles').select('*, role_details(*)').eq('role', 'remote_worker').eq('kyc_status', 'approved').neq('id', currentUser.id);
  grid.innerHTML = (data || []).map(girlCard).join('') || '<p class="empty-state">Sin trabajadoras</p>';
}

async function saveWorkerProfile(e) {
  e.preventDefault();
  await db.from('role_details').upsert({ user_id: currentUser.id, role_type: 'remote_worker', specialty: document.getElementById('workerSpecialty').value, bio: document.getElementById('workerBio').value }, { onConflict: 'user_id' });
  await db.from('profiles').update({ bio: document.getElementById('workerBio').value, is_online: document.getElementById('workerOnline').checked }).eq('id', currentUser.id);
  currentProfile.is_online = document.getElementById('workerOnline').checked;
  showToast(currentProfile.is_online ? '🟢 En línea: recibiendo llamadas' : '🔴 Desconectada');
  loadWorkers();
}

function fillKycForm() {
  const p = currentProfile;
  const box = document.getElementById('kycStatusBox');
  const st = { none: '⚪ No aplica', pending: '⏳ Pendiente', approved: '✅ Verificada', rejected: '❌ Rechazada: ' + (p.kyc_note || '') }[p.kyc_status] || '⚪';
  box.innerHTML = `<h3>Verificación</h3><p>${st}</p><p class="dim">Nombre real (cédula): <b>${p.full_name || '—'}</b> · Nombre artístico: <b>${p.model_name || '—'}</b></p>${p.id_card_url ? `<img class="kyc-img" src="${p.id_card_url}">` : ''}${p.face_photo_url ? `<img class="kyc-img" src="${p.face_photo_url}">` : ''}`;
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

async function loadMyCalls() {
  const { data } = await db.from('video_calls').select('*, profiles!video_calls_client_id_fkey(full_name, model_name)').eq('worker_id', currentUser.id).eq('status', 'active');
  document.getElementById('myCallsList').innerHTML = (data || []).map(c =>
    `<div class="row-item"><div class="row-main"><b>📞 ${c.profiles?.model_name || c.profiles?.full_name || 'Cliente'}</b><small>◈ ${c.rate_per_minute}/min</small></div>
     <button class="btn-small success" onclick="joinCall('${c.id}','${c.room_id}',${c.rate_per_minute})">Contestar</button></div>`).join('')
    || '<p class="empty-state">Sin llamadas entrantes</p>';
}

async function startCall(workerId, rate) {
  if (!requireActive()) return;
  rate = parseFloat(rate) || 0.2;
  const { data: wk } = await db.from('profiles').select('is_online, kyc_status').eq('id', workerId).single();
  if (!wk || wk.kyc_status !== 'approved') { showToast('❌ Trabajadora no verificada'); return; }
  if (!wk.is_online) { showToast('❌ La trabajadora NO está en línea ahora'); return; }
  if (!currentProfile.unlimited_tokens && parseFloat(currentProfile.tokens_balance) < rate) { showToast('❌ Saldo insuficiente'); return; }
  const roomId = 'FENDYX' + Date.now();
  const { data: call } = await db.from('video_calls').insert({ worker_id: workerId, client_id: currentUser.id, room_id: roomId, rate_per_minute: rate, status: 'active', started_at: new Date().toISOString() }).select().single();
  await loadScript('calls.js');
  await startWebCall(roomId, { rate, rowId: call.id, asClient: true });
}
async function joinCall(callId, roomId, rate) {
  await loadScript('calls.js');
  await joinWebCall(roomId, { rate: parseFloat(rate) || 0, rowId: callId, asClient: false });
}
