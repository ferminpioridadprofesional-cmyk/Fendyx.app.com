'use strict';
let jitsiApi = null, callInterval = null, callSeconds = 0, callCostTotal = 0, currentCallId = null, iAmClient = false, currentCallRate = 0;

async function loadGirls() {
  if (!requireActive()) return;
  const { data } = await db.from('profiles').select('*, role_details(*)').eq('role', 'remote_worker').eq('kyc_status', 'approved').order('is_online', { ascending: false });
  document.getElementById('girlsGrid').innerHTML = (data || []).map(w => {
    const rd = w.role_details?.[0], lv = levelInfo(rd?.worker_level);
    const photo = w.avatar_url || (w.gallery_urls || [])[0];
    return `<div class="card-item">${photo ? `<img src="${photo}" alt="">` : ''}
      <div class="card-title">${w.full_name}${w.age ? ', ' + w.age : ''} ${w.zodiac || ''}</div>
      <span class="status-pill ${w.is_online ? 'online' : 'offline'}">${w.is_online ? 'EN LÍNEA' : 'DESCONECTADA'}</span>
      <span class="role-badge">${lv.name} · ◈ ${rd?.rate_per_minute || lv.rate}/min</span>
      <div class="card-desc">${w.occupation || ''} ${w.occupation && w.bio ? '·' : ''} ${w.bio || ''}</div>
      <div class="chips-row" style="margin:6px 0">${(w.interests || []).slice(0,3).map(i => `<span class="chip">🎯 ${i}</span>`).join('')}</div>
      <div class="row-actions">
        <button class="btn-small success" onclick="startCall('${w.id}',${rd?.rate_per_minute || lv.rate})" ${w.is_online ? '' : 'disabled'}>📹 Llamar</button>
        <button class="btn-small" onclick="openProfile('${w.id}')">👤 Perfil</button>
        <button class="btn-small" onclick="openBook('${w.id}',${rd?.rate_per_minute || lv.rate})">📅 Agendar</button>
      </div></div>`;
  }).join('') || '<p class="empty-state">Aún no hay chicas verificadas en línea</p>';
}

async function loadWorkers() {
  const isWorker = currentProfile.role === 'remote_worker';
  document.getElementById('workerPanel').classList.toggle('hidden', !isWorker);
  if (isWorker) {
    const lv = levelInfo(roleDetails?.worker_level);
    document.getElementById('workerSpecialty').value = roleDetails?.specialty || '';
    document.getElementById('workerBio').value = currentProfile.bio || roleDetails?.bio || '';
    document.getElementById('workerOnline').checked = !!currentProfile.is_online;
    const info = document.getElementById('workerLevelInfo');
    if (info) info.innerHTML = `Tu nivel: <b>${lv.name}</b> · Tarifa: <b>◈ ${roleDetails?.rate_per_minute || lv.rate}/min</b> (la asigna el admin) · KYC: <b>${currentProfile.kyc_status}</b>`;
    loadMyCalls();
  }
  const { data } = await db.from('profiles').select('*, role_details(*)').eq('role', 'remote_worker').neq('id', currentUser.id);
  document.getElementById('workersGrid').innerHTML = (data || []).map(w => {
    const rd = w.role_details?.[0], lv = levelInfo(rd?.worker_level);
    return `<div class="card-item"><div class="card-title">${w.full_name}</div>
      <span class="status-pill ${w.is_online ? 'online' : 'offline'}">${w.is_online ? 'EN LÍNEA' : 'DESCONECTADO'}</span>
      <div class="card-desc">${rd?.specialty || ''} · ${stars(w.rating)}</div>
      <div class="price-tag">◈ ${rd?.rate_per_minute || lv.rate}/min</div><br>
      <button class="btn-small success" onclick="startCall('${w.id}',${rd?.rate_per_minute || lv.rate})" ${w.is_online ? '' : 'disabled'}>📹 Llamar</button>
      <button class="btn-small" onclick="openBook('${w.id}',${rd?.rate_per_minute || lv.rate})">📅 Agendar</button></div>`;
  }).join('') || '<p class="empty-state">Sin trabajadores remotos aún</p>';
}

async function saveWorkerProfile(e) {
  e.preventDefault();
  await db.from('role_details').upsert({
    user_id: currentUser.id, role_type: 'remote_worker',
    specialty: document.getElementById('workerSpecialty').value,
    bio: document.getElementById('workerBio').value
  }, { onConflict: 'user_id' });
  await db.from('profiles').update({ bio: document.getElementById('workerBio').value, is_online: document.getElementById('workerOnline').checked }).eq('id', currentUser.id);
  showToast('✅ Perfil profesional guardado');
  await loadProfile(); loadWorkers();
}

function fillKycForm() {
  const p = currentProfile;
  const box = document.getElementById('kycStatusBox');
  const st = { none: '⚪ No aplica', pending: '⏳ Pendiente de revisión por el admin', approved: '✅ Verificada: ya puedes recibir llamadas', rejected: '❌ Rechazada: ' + (p.kyc_note || 'revisa tus fotos') }[p.kyc_status] || '⚪';
  box.innerHTML = `<h3>Estado de verificación</h3><p>${st}</p>
    ${p.id_card_url ? `<img class="kyc-img" src="${p.id_card_url}">` : ''}${p.face_photo_url ? `<img class="kyc-img" src="${p.face_photo_url}">` : ''}
    <p class="dim">WhatsApp registrado: ${p.whatsapp || '—'}</p>`;
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
  await loadProfile(); fillKycForm();
  showToast(' Documentos enviados. El admin los revisará.');
}

async function loadMyCalls() {
  const { data } = await db.from('video_calls').select('*, profiles!video_calls_client_id_fkey(full_name)').eq('worker_id', currentUser.id).eq('status', 'active');
  document.getElementById('myCallsList').innerHTML = (data || []).map(c =>
    `<div class="row-item"><div class="row-main"><b>📞 ${c.profiles?.full_name || 'Cliente'}</b><small>◈ ${c.rate_per_minute}/min</small></div><button class="btn-small success" onclick="joinCall('${c.id}','${c.room_id}',${c.rate_per_minute})">Contestar</button></div>`).join('')
    || '<p class="empty-state">Sin llamadas entrantes</p>';
}

async function startCall(workerId, rate) {
  if (!requireActive()) return;
  rate = parseFloat(rate) || 0.2;
  if (!currentProfile.unlimited_tokens && parseFloat(currentProfile.tokens_balance) < rate) { showToast('❌ Saldo insuficiente para 1 minuto'); return; }
  const roomId = 'FENDYX' + Date.now();
  const { data: call } = await db.from('video_calls').insert({ worker_id: workerId, client_id: currentUser.id, room_id: roomId, rate_per_minute: rate, status: 'active', started_at: new Date().toISOString() }).select().single();
  iAmClient = true; currentCallRate = rate; openCallUI(call.id, roomId);
}
async function joinCall(callId, roomId, rate) { iAmClient = false; currentCallRate = rate; openCallUI(callId, roomId); }
function openCallUI(callId, roomId) {
  currentCallId = callId; callSeconds = 0; callCostTotal = 0;
  document.getElementById('callTimer').textContent = '00:00';
  document.getElementById('callCost').textContent = currentProfile.unlimited_tokens ? '∞ ADMIN' : '◈ 0.00';
  openModal('modal-call');
  jitsiApi = new JitsiMeetExternalAPI('meet.jit.si', { roomName: roomId, width: '100%', height: '100%', parentNode: document.getElementById('jitsiContainer'), userInfo: { displayName: currentProfile.full_name }, configOverwrite: { prejoinPageEnabled: false }, interfaceConfigOverwrite: { SHOW_JITSI_WATERMARK: false } });
  callInterval = setInterval(async () => {
    callSeconds++;
    document.getElementById('callTimer').textContent = String(Math.floor(callSeconds / 60)).padStart(2, '0') + ':' + String(callSeconds % 60).padStart(2, '0');
    if (iAmClient && callSeconds % 60 === 0) {
      const { data: nb, error } = await db.rpc('pay_call_minute', { p_call: currentCallId });
      if (error || nb === -1) { showToast('❌ Saldo agotado o llamada inactiva.'); endCall(); return; }
      callCostTotal += currentCallRate;
      if (!currentProfile.unlimited_tokens) {
        currentProfile.tokens_balance = nb; updateHeader();
        document.getElementById('callCost').textContent = '◈ ' + callCostTotal.toFixed(2);
        if (nb <= 0) { showToast('❌ Saldo agotado. Llamada finalizada.'); endCall(); }
      } else {
        document.getElementById('callCost').textContent = '∞ ADMIN · trabajadora cobró ◈ ' + callCostTotal.toFixed(2);
      }
    }
  }, 1000);
}
async function endCall() {
  if (jitsiApi) { jitsiApi.dispose(); jitsiApi = null; }
  if (callInterval) { clearInterval(callInterval); callInterval = null; }
  if (currentCallId) await db.from('video_calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', currentCallId);
  currentCallId = null; closeModal('modal-call');
  showToast('📞 Llamada finalizada · Costo: ' + (currentProfile.unlimited_tokens ? '∞ (admin)' : '◈ ' + callCostTotal.toFixed(2)));
}

function openBook(workerId, rate) { window._bookTarget = { workerId, rate }; openModal('modal-book'); }
async function confirmBooking() {
  const d = document.getElementById('bookDate').value, t = document.getElementById('bookTime').value;
  if (!d || !t) { showToast('Elige fecha y hora'); return; }
  const dur = parseInt(document.getElementById('bookDuration').value);
  const price = (window._bookTarget.rate * dur).toFixed(2);
  await db.from('bookings').insert({ worker_id: window._bookTarget.workerId, client_id: currentUser.id, book_date: d, book_time: t, duration_min: dur, price });
  closeModal('modal-book'); showToast('📅 Solicitud enviada.'); loadAgenda();
}
async function loadAgenda() {
  const isWorker = currentProfile.role === 'remote_worker';
  document.getElementById('workerBookingsWrap').classList.toggle('hidden', !isWorker);
  if (isWorker) {
    const { data: req } = await db.from('bookings').select('*, profiles(full_name)').eq('worker_id', currentUser.id).eq('status', 'pending').order('book_date');
    document.getElementById('workerBookingsList').innerHTML = (req || []).map(b =>
      `<div class="row-item"><div class="row-main"><b>${b.profiles?.full_name}</b><small>🗓️ ${b.book_date} · ${b.book_time} · ${b.duration_min} min · ◈ ${b.price}</small></div>
       <div class="row-actions"><button class="btn-small success" onclick="setBooking('${b.id}','confirmed')">✅</button><button class="btn-small danger" onclick="setBooking('${b.id}','cancelled')">✕</button></div></div>`).join('')
      || '<p class="empty-state">Sin solicitudes pendientes</p>';
  }
  const { data: mine } = await db.from('bookings').select('*, profiles(full_name)').order('book_date', { ascending: false }).limit(20);
  const rows = (mine || []).filter(b => b.client_id === currentUser.id || b.worker_id === currentUser.id);
  document.getElementById('myBookingsList').innerHTML = rows.map(b => {
    const canStart = b.status === 'confirmed' && b.client_id === currentUser.id;
    return `<div class="row-item"><div class="row-main"><b>${b.profiles?.full_name || 'Sesión'}</b><small>🗓️ ${b.book_date} · ${b.book_time} · ${b.duration_min} min · ◈ ${b.price}</small></div>
      <div class="row-actions"><span class="order-status ${b.status === 'confirmed' ? 'st-delivered' : b.status === 'cancelled' ? 'st-cancelled' : 'st-pending'}">${b.status}</span>
      ${canStart ? `<button class="btn-small success" onclick="startCall('${b.worker_id}',${(b.price / b.duration_min).toFixed(2)})">📹 Iniciar</button>` : ''}
      ${b.status === 'pending' && b.client_id === currentUser.id ? `<button class="btn-small danger" onclick="setBooking('${b.id}','cancelled')">Cancelar</button>` : ''}</div></div>`;
  }).join('') || '<p class="empty-state">Sin citas aún</p>';
}
async function setBooking(id, status) { await db.from('bookings').update({ status }).eq('id', id); showToast('✅ Cita actualizada'); loadAgenda(); }
