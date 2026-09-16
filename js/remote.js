'use strict';
let jitsiApi = null, callInterval = null, callSeconds = 0, callCostTotal = 0, currentCallId = null, iAmClient = false, currentCallRate = 0;

async function loadWorkers() {
  const isWorker = currentProfile.role === 'remote_worker';
  document.getElementById('workerPanel').classList.toggle('hidden', !isWorker);
  if (isWorker) renderWorkerZone();
  const { data } = await db.from('profiles').select('*, role_details(*)')
    .eq('role', 'remote_worker').eq('gender', 'female').eq('worker_status', 'active').eq('is_banned', false)
    .neq('id', currentUser.id);
  document.getElementById('workersGrid').innerHTML = (data || []).map(w => {
    const rd = w.role_details?.[0];
    return `<div class="card-item">
      ${w.avatar_url ? `<img src="${w.avatar_url}" alt="">` : ''}
      <div class="card-title">${w.full_name}</div>
      <span class="status-pill ${w.is_online ? 'online' : 'offline'}">${w.is_online ? 'EN LÍNEA' : 'DESCONECTADA'}</span>
      <div class="card-desc">${rd?.specialty || 'Sin especialidad'} · ${stars(w.rating)}</div>
      <div class="card-meta">Nivel ${w.worker_level || 1}/5 · ${rd?.bio || ''}</div>
      <div class="price-tag">◈ ${parseFloat(rd?.rate_per_minute || 0.2).toFixed(2)}/min</div><br>
      <button class="btn-small success" onclick="startCall('${w.id}',${rd?.rate_per_minute || 0.2})" ${w.is_online ? '' : 'disabled'}>📹 Llamar</button>
      <button class="btn-small" onclick="openBook('${w.id}',${rd?.rate_per_minute || 0.2})">📅 Agendar</button>
      <button class="btn-small" onclick="openProfile('${w.id}')">👤</button></div>`;
  }).join('') || '<p class="empty-state">No hay trabajadoras activas en este momento</p>';
}

function renderWorkerZone() {
  const st = currentProfile.worker_status;
  const panel = document.getElementById('workerPanel');
  if (st === 'incomplete' || !st) {
    panel.innerHTML = `<h3>🪪 Verificación obligatoria (+18)</h3>
      <p class="dim">Sube tus documentos. El admin los revisará manualmente y activará tu cuenta para trabajar.</p>
      <form class="owner-form" onsubmit="submitVerification(event)">
        <label class="dim">📄 Foto de tu cédula (legible)</label>
        <input type="file" id="idCardFile" accept="image/*" required>
        <label class="dim">🤳 Foto reciente de tu rostro (sin filtros ni gafas)</label>
        <input type="file" id="faceFile" accept="image/*" required>
        <label class="dim">📱 WhatsApp (con código de país, ej: 584141234567)</label>
        <input type="tel" id="whatsappInput" placeholder="584141234567" required>
        <button type="submit" class="btn-primary">Enviar a verificación</button>
      </form>`;
    return;
  }
  if (st === 'pending') {
    panel.innerHTML = `<h3>⏳ Documentos en revisión</h3><p class="dim">El administrador está verificando tu cédula y foto. Te avisaremos al activarte. Esto suele tomar menos de 24 horas.</p>`;
    return;
  }
  if (st === 'rejected') {
    panel.innerHTML = `<h3>❌ Verificación rechazada</h3><p class="dim">Motivo: ${currentProfile.ban_reason || 'Documentos inválidos'}. Corrige y vuelve a enviar.</p>
      <button class="btn-primary" onclick="currentProfile.worker_status='incomplete';renderWorkerZone()">Reintentar</button>`;
    return;
  }
  panel.innerHTML = `<h3>⚙️ Mi perfil profesional</h3>
    <div class="rep-card" style="margin-bottom:12px"><span class="rep-level">Nivel ${currentProfile.worker_level || 1}/5</span>
    <div class="price-tag" style="margin-top:8px">◈ ${parseFloat(roleDetails?.rate_per_minute || 0.2).toFixed(2)}/min</div>
    <p class="dim" style="margin-top:6px">Tu nivel y tarifa los ajusta el administrador</p></div>
    <form class="owner-form" onsubmit="saveWorkerProfile(event)">
      <input type="text" id="workerSpecialty" placeholder="Especialidad" value="${roleDetails?.specialty || ''}">
      <textarea id="workerBio" placeholder="Descripción">${currentProfile.bio || roleDetails?.bio || ''}</textarea>
      <label class="check-line"><input type="checkbox" id="workerOnline" ${currentProfile.is_online ? 'checked' : ''}> Disponible para llamadas</label>
      <button type="submit" class="btn-primary">Guardar</button>
    </form>
    <h3>📞 Llamadas hacia mí</h3><div id="myCallsList" class="list-compact"></div>`;
  loadMyCalls();
}

async function submitVerification(e) {
  e.preventDefault();
  const idf = document.getElementById('idCardFile').files[0];
  const facef = document.getElementById('faceFile').files[0];
  const wa = document.getElementById('whatsappInput').value.replace(/\D/g, '');
  if (!idf || !facef || wa.length < 10) { showToast('Completa cédula, foto y WhatsApp'); return; }
  const p1 = 'verify/' + currentUser.id + '_cedula_' + Date.now() + '.jpg';
  const p2 = 'verify/' + currentUser.id + '_rostro_' + Date.now() + '.jpg';
  const r1 = await db.storage.from('fendyx-assets').upload(p1, idf);
  const r2 = await db.storage.from('fendyx-assets').upload(p2, facef);
  if (r1.error || r2.error) { showToast('❌ Error al subir fotos'); return; }
  await db.from('profiles').update({
    id_card_url: db.storage.from('fendyx-assets').getPublicUrl(p1).data.publicUrl,
    face_photo_url: db.storage.from('fendyx-assets').getPublicUrl(p2).data.publicUrl,
    phone_whatsapp: wa, worker_status: 'pending', ban_reason: null
  }).eq('id', currentUser.id);
  await loadProfile(); renderWorkerZone();
  showToast('✅ Documentos enviados. El admin te verificará.');
}

async function saveWorkerProfile(e) {
  e.preventDefault();
  if (currentProfile.worker_status !== 'active') { showToast('⚠️ Aún no estás verificada'); return; }
  await db.from('role_details').upsert({
    user_id: currentUser.id, role_type: 'remote_worker',
    specialty: document.getElementById('workerSpecialty').value,
    rate_per_minute: parseFloat(roleDetails?.rate_per_minute || 0.2),
    bio: document.getElementById('workerBio').value
  }, { onConflict: 'user_id' });
  await db.from('profiles').update({ bio: document.getElementById('workerBio').value, is_online: document.getElementById('workerOnline').checked }).eq('id', currentUser.id);
  showToast('✅ Perfil guardado');
  await loadProfile(); loadWorkers();
}

async function loadMyCalls() {
  const el = document.getElementById('myCallsList'); if (!el) return;
  const { data } = await db.from('video_calls').select('*, profiles!video_calls_client_id_fkey(full_name)').eq('worker_id', currentUser.id).eq('status', 'active');
  el.innerHTML = (data || []).map(c =>
    `<div class="row-item"><div class="row-main"><b>📞 ${c.profiles?.full_name || 'Cliente'}</b><small>◈ ${c.rate_per_minute}/min</small></div><button class="btn-small success" onclick="joinCall('${c.id}','${c.room_id}',${c.rate_per_minute})">Contestar</button></div>`).join('')
    || '<p class="empty-state">Sin llamadas entrantes</p>';
}

async function startCall(workerId, rate) {
  if (!requireActive()) return;
  if (parseFloat(currentProfile.tokens_balance) < rate) { showToast('❌ Saldo insuficiente para 1 minuto'); return; }
  const roomId = 'FENDYX' + Date.now();
  const { data: call } = await db.from('video_calls').insert({ worker_id: workerId, client_id: currentUser.id, room_id: roomId, rate_per_minute: rate, status: 'active', started_at: new Date().toISOString() }).select().single();
  iAmClient = true; currentCallRate = rate; openCallUI(call.id, roomId);
}
async function joinCall(callId, roomId, rate) { iAmClient = false; currentCallRate = rate; openCallUI(callId, roomId); }
function openCallUI(callId, roomId) {
  currentCallId = callId; callSeconds = 0; callCostTotal = 0;
  document.getElementById('callTimer').textContent = '00:00';
  document.getElementById('callCost').textContent = '◈ 0.00';
  openModal('modal-call');
  jitsiApi = new JitsiMeetExternalAPI('meet.jit.si', { roomName: roomId, width: '100%', height: '100%', parentNode: document.getElementById('jitsiContainer'), userInfo: { displayName: currentProfile.full_name }, configOverwrite: { prejoinPageEnabled: false }, interfaceConfigOverwrite: { SHOW_JITSI_WATERMARK: false } });
  callInterval = setInterval(async () => {
    callSeconds++;
    document.getElementById('callTimer').textContent = String(Math.floor(callSeconds / 60)).padStart(2, '0') + ':' + String(callSeconds % 60).padStart(2, '0');
    if (iAmClient && callSeconds % 60 === 0) {
      callCostTotal += currentCallRate;
      document.getElementById('callCost').textContent = '◈ ' + callCostTotal.toFixed(2);
      const nb = parseFloat(currentProfile.tokens_balance) - currentCallRate;
      await db.from('profiles').update({ tokens_balance: nb }).eq('id', currentUser.id);
      await db.from('token_transactions').insert({ user_id: currentUser.id, amount: -currentCallRate, type: 'consumption', description: 'Videollamada minuto ' + (callSeconds / 60) });
      currentProfile.tokens_balance = nb; updateHeader();
      if (nb <= 0) { showToast('❌ Saldo agotado. Llamada finalizada.'); endCall(); }
    }
  }, 1000);
}
async function endCall() {
  if (jitsiApi) { jitsiApi.dispose(); jitsiApi = null; }
  if (callInterval) { clearInterval(callInterval); callInterval = null; }
  if (currentCallId) await db.from('video_calls').update({ status: 'ended', ended_at: new Date().toISOString(), total_cost: callCostTotal }).eq('id', currentCallId);
  currentCallId = null; closeModal('modal-call');
  showToast('📞 Llamada finalizada · Costo: ◈ ' + callCostTotal.toFixed(2));
}
function openBook(workerId, rate) { window._bookTarget = { workerId, rate }; openModal('modal-book'); }
async function confirmBooking() {
  if (!requireActive()) return;
  const d = document.getElementById('bookDate').value, t = document.getElementById('bookTime').value;
  if (!d || !t) { showToast('Elige fecha y hora'); return; }
  const dur = parseInt(document.getElementById('bookDuration').value);
  const price = (window._bookTarget.rate * dur).toFixed(2);
  await db.from('bookings').insert({ worker_id: window._bookTarget.workerId, client_id: currentUser.id, book_date: d, book_time: t, duration_min: dur, price });
  closeModal('modal-book'); showToast('📅 Solicitud enviada'); loadAgenda();
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
  document.getElementById('myBookingsList').innerHTML = rows.map(b =>
    `<div class="row-item"><div class="row-main"><b>${b.profiles?.full_name || 'Sesión'}</b><small>🗓️ ${b.book_date} · ${b.book_time} · ${b.duration_min} min · ◈ ${b.price}</small></div>
     <div class="row-actions"><span class="order-status ${b.status === 'confirmed' ? 'st-delivered' : b.status === 'cancelled' ? 'st-cancelled' : 'st-pending'}">${b.status}</span>
     ${b.status === 'confirmed' && b.client_id === currentUser.id ? `<button class="btn-small success" onclick="startCall('${b.worker_id}',${(b.price / b.duration_min).toFixed(2)})">📹 Iniciar</button>` : ''}
     ${b.status === 'pending' && b.client_id === currentUser.id ? `<button class="btn-small danger" onclick="setBooking('${b.id}','cancelled')">Cancelar</button>` : ''}</div></div>`).join('')
    || '<p class="empty-state">Sin citas aún</p>';
}
async function setBooking(id, status) { await db.from('bookings').update({ status }).eq('id', id); showToast('✅ Cita actualizada'); loadAgenda(); }
