'use strict';
// =====================================================
// FENDYX - MOTOR DE VIDEOLLAMADAS WebRTC 1 A 1
// Gratis, integrado en la web/app, sin servicios externos
// Señalización: Supabase Realtime (broadcast)
// =====================================================
let pc = null, localStream = null, callChannel = null, callRoom = null;
let makingOffer = false, ignoreOffer = false, peerPresent = false;
let callSeconds = 0, callClock = null, callCostTotal = 0, callRowId = null, callRate = 0, iAmClientFlag = false;
let callSetupDone = false;

function ensureCallUI() {
  if (document.getElementById('fendyx-call-style')) return;
  const st = document.createElement('style');
  st.id = 'fendyx-call-style';
  st.textContent = `
    .video-wrap{position:relative;height:380px;background:#000;border-radius:16px;overflow:hidden;margin:10px 0}
    #remoteVideo{width:100%;height:100%;object-fit:cover}
    #localVideo{position:absolute;right:10px;bottom:10px;width:110px;height:150px;object-fit:cover;border-radius:12px;border:2px solid var(--border-strong);background:#111}
    #callStatusMsg{position:absolute;top:10px;left:12px;background:rgba(0,0,0,.55);padding:4px 10px;border-radius:999px;font-size:.8rem}
    .call-controls{display:flex;gap:10px;justify-content:center;margin-top:10px}
    .call-controls .btn-small{padding:12px 18px;font-size:1rem}
    .incoming-call{position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:500;background:var(--card-2);border:2px solid var(--success);border-radius:18px;padding:14px 20px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 40px rgba(0,255,157,.35);animation:proxIn .4s}
    .incoming-call b{display:block}`;
  document.head.appendChild(st);
  const mc = document.querySelector('#modal-call .modal-content');
  if (mc) mc.innerHTML = `
    <div class="call-info"><span id="callTimer">00:00</span><span id="callCost">◈ 0.00</span></div>
    <div class="video-wrap">
      <video id="remoteVideo" autoplay playsinline></video>
      <video id="localVideo" autoplay playsinline muted></video>
      <div id="callStatusMsg" class="dim">Conectando…</div>
    </div>
    <div class="call-controls">
      <button id="btnMic" class="btn-small" onclick="toggleMic()">🎤 Silenciar</button>
      <button id="btnCam" class="btn-small" onclick="toggleCam()">📷 Cámara</button>
      <button class="btn-small danger" onclick="endWebCall()">📞 Colgar</button>
    </div>`;
  if (!document.getElementById('incomingCall')) {
    const inc = document.createElement('div');
    inc.id = 'incomingCall'; inc.className = 'incoming-call hidden';
    document.body.appendChild(inc);
  }
}

async function showIncomingCall(row) {
  ensureCallUI();
  const { data: caller } = await db.from('profiles').select('full_name').eq('id', row.client_id).single();
  const box = document.getElementById('incomingCall');
  box.classList.remove('hidden');
  box.innerHTML = `<div><b>📞 ${caller?.full_name || 'Llamada'}</b><small>◈ ${row.rate_per_minute}/min · Videollamada FENDYX</small></div>
    <button class="btn-small success" onclick="acceptIncoming('${row.room_id}',${row.rate_per_minute},'${row.id}')">✅</button>
    <button class="btn-small danger" onclick="rejectIncoming('${row.id}')">❌</button>`;
  navigator.vibrate?.([300, 120, 300]);
}
async function acceptIncoming(room, rate, rowId) {
  document.getElementById('incomingCall').classList.add('hidden');
  await joinWebCall(room, { rate: parseFloat(rate) || 0, rowId, asClient: false });
}
async function rejectIncoming(rowId) {
  document.getElementById('incomingCall').classList.add('hidden');
  await db.from('video_calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', rowId);
}
function remoteHungUp(row) {
  if (callRoom && row.room_id === callRoom) { showToast('📞 La otra persona colgó'); cleanupCall(); }
}

async function startWebCall(room, opts = {}) { await beginCall(room, opts, true); }
async function joinWebCall(room, opts = {}) { await beginCall(room, opts, false); }

async function beginCall(room, opts, isInitiator) {
  ensureCallUI();
  if (pc) cleanupCall();
  callRoom = room; callRowId = opts.rowId || null; callRate = parseFloat(opts.rate) || 0; iAmClientFlag = !!opts.asClient;
  callCostTotal = 0; callSeconds = 0; callSetupDone = false;
  document.getElementById('callTimer').textContent = '00:00';
  document.getElementById('callCost').textContent = iAmClientFlag && callRate > 0 ? '◈ 0.00' : (currentProfile.unlimited_tokens ? '∞ ADMIN' : '◈ 0.00');
  document.getElementById('callStatusMsg').textContent = 'Solicitando cámara y micrófono…';
  openModal('modal-call');
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
    document.getElementById('localVideo').srcObject = localStream;
  } catch (e) { showToast('❌ Permiso de cámara/micrófono denegado'); closeModal('modal-call'); return; }
  callChannel = db.channel('call_' + room)
    .on('broadcast', { event: 'signal' }, ({ payload }) => handleSignal(payload))
    .on('broadcast', { event: 'hangup' }, () => { showToast('📞 La otra persona colgó'); cleanupCall(); });
  callChannel.subscribe(async status => {
    if (status !== 'SUBSCRIBED' || callSetupDone) return;
    callSetupDone = true;
    setupPeer(isInitiator);
  });
}

function setupPeer(isInitiator) {
  pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] });
  const polite = currentUser.id < (callRoom || '');
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  pc.ontrack = e => { document.getElementById('remoteVideo').srcObject = e.streams[0]; document.getElementById('callStatusMsg').textContent = '🟢 Conectada'; };
  pc.onicecandidate = e => { if (e.candidate) send({ type: 'ice', candidate: e.candidate }); };
  pc.onnegotiationneeded = async () => {
    try {
      makingOffer = true;
      await pc.setLocalDescription();
      send({ type: 'description', sdp: pc.localDescription });
    } catch (e) { console.warn(e); } finally { makingOffer = false; }
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') {
      document.getElementById('callStatusMsg').textContent = '🟢 Conectada';
      startCallClock();
    }
    if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
      if (callRoom) { showToast('📞 Llamada finalizada'); cleanupCall(); }
    }
  };
  send({ type: 'hello' });
}

function send(msg) {
  if (!callChannel) return;
  callChannel.send({ type: 'broadcast', event: 'signal', payload: { ...msg, from: currentUser.id } });
}

async function handleSignal(p) {
  if (!p || p.from === currentUser.id || !pc) return;
  if (p.type === 'hello') { peerPresent = true; return; }
  if (p.type === 'description') {
    const offerCollision = p.sdp.type === 'offer' && (makingOffer || pc.signalingState !== 'stable');
    const polite = currentUser.id < (callRoom || '');
    ignoreOffer = !polite && offerCollision;
    if (ignoreOffer) return;
    await pc.setRemoteDescription(p.sdp);
    if (p.sdp.type === 'offer') {
      await pc.setLocalDescription();
      send({ type: 'description', sdp: pc.localDescription });
    }
    return;
  }
  if (p.type === 'ice') { try { await pc.addIceCandidate(p.candidate); } catch (e) { if (!ignoreOffer) console.warn(e); } }
}

function startCallClock() {
  if (callClock) return;
  callClock = setInterval(async () => {
    callSeconds++;
    document.getElementById('callTimer').textContent = String(Math.floor(callSeconds / 60)).padStart(2, '0') + ':' + String(callSeconds % 60).padStart(2, '0');
    if (iAmClientFlag && callRate > 0 && callSeconds % 60 === 0 && callRowId) {
      const { data: nb, error } = await db.rpc('pay_call_minute', { p_call: callRowId });
      if (error || nb === -1) { showToast('❌ Saldo agotado o llamada inactiva'); endWebCall(); return; }
      callCostTotal += callRate;
      if (!currentProfile.unlimited_tokens) {
        currentProfile.tokens_balance = nb; updateHeader();
        document.getElementById('callCost').textContent = '◈ ' + callCostTotal.toFixed(2);
        if (nb <= 0) { showToast('❌ Saldo agotado. Llamada finalizada.'); endWebCall(); }
      } else {
        document.getElementById('callCost').textContent = '∞ ADMIN · trabajadora cobró ◈ ' + callCostTotal.toFixed(2);
      }
    }
  }, 1000);
}

function toggleMic() {
  if (!localStream) return;
  const t = localStream.getAudioTracks()[0];
  if (t) { t.enabled = !t.enabled; document.getElementById('btnMic').textContent = t.enabled ? '🎤 Silenciar' : '🔇 Activar'; }
}
function toggleCam() {
  if (!localStream) return;
  const t = localStream.getVideoTracks()[0];
  if (t) { t.enabled = !t.enabled; document.getElementById('btnCam').textContent = t.enabled ? '📷 Cámara' : '🚫 Cámara'; }
}

async function endWebCall() {
  if (callChannel) callChannel.send({ type: 'broadcast', event: 'hangup', payload: { from: currentUser.id } });
  if (callRowId) await db.from('video_calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callRowId);
  showToast('📞 Llamada finalizada · Costo: ' + (iAmClientFlag && callRate > 0 ? '◈ ' + callCostTotal.toFixed(2) : '◈ 0.00'));
  cleanupCall();
}
function cleanupCall() {
  if (callClock) { clearInterval(callClock); callClock = null; }
  if (pc) { try { pc.close(); } catch (e) {} pc = null; }
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  if (callChannel) { db.removeChannel(callChannel); callChannel = null; }
  callRoom = null; callRowId = null; callSetupDone = false; peerPresent = false;
  closeModal('modal-call');
}
