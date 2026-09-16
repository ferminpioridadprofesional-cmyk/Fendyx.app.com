'use strict';
let pc = null, localStream = null, callChannel = null, callRoom = null;
let makingOffer = false, ignoreOffer = false, peerPresent = false;
let callSeconds = 0, callClock = null, callCostTotal = 0, callRowId = null, callRate = 0, iAmClientFlag = false;
let callSetupDone = false, facingMode = 'user';

function ensureCallUI() {
  if (document.getElementById('fendyx-call-style')) return;
  const st = document.createElement('style');
  st.id = 'fendyx-call-style';
  st.textContent = `
    .video-wrap{position:relative;height:380px;background:#000;border-radius:16px;overflow:hidden;margin:10px 0}
    #remoteVideo{width:100%;height:100%;object-fit:cover}
    #localVideo{position:absolute;right:10px;bottom:10px;width:110px;height:150px;object-fit:cover;border-radius:12px;border:2px solid var(--border-strong);background:#111}
    #callStatusMsg{position:absolute;top:10px;left:12px;background:rgba(0,0,0,.55);padding:4px 10px;border-radius:999px;font-size:.8rem}
    .call-controls{display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap}
    .call-controls .btn-small{padding:12px 16px;font-size:.95rem}
    .incoming-call{position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:600;background:var(--card-2);border:2px solid var(--success);border-radius:18px;padding:14px 20px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 40px rgba(0,255,157,.35);animation:proxIn .4s;max-width:92vw}
    .incoming-call b{display:block}`;
  document.head.appendChild(st);
  const mc = document.querySelector('#modal-call .modal-content');
  if (mc) mc.innerHTML = `
    <div class="call-info"><span id="callTimer">00:00</span><span id="callCost">◈ 0.00</span></div>
    <div class="video-wrap">
      <video id="remoteVideo" autoplay playsinline muted></video>
      <video id="localVideo" autoplay playsinline muted></video>
      <div id="callStatusMsg" class="dim">Conectando…</div>
    </div>
    <div class="call-controls">
      <button id="btnMic" class="btn-small" onclick="toggleMic()">🎤 Silenciar</button>
      <button id="btnCam" class="btn-small" onclick="toggleCam()">📷 Cámara</button>
      <button id="btnFlip" class="btn-small" onclick="flipCamera()">🔄 Voltear</button>
      <button class="btn-small danger" onclick="endWebCall()">📞 Colgar</button>
    </div>`;
}

async function showIncomingCall(row) {
  ensureCallUI();
  const { data: caller } = await db.from('profiles').select('full_name').eq('id', row.client_id).single();
  const box = document.getElementById('incomingCall');
  if (!box) return;
  box.classList.remove('hidden');
  box.innerHTML = `<div><b>📞 ${caller?.full_name || 'Llamada'}</b><small>◈ ${row.rate_per_minute}/min · Videollamada FENDYX</small></div>
    <button class="btn-small success" onclick="acceptIncoming('${row.room_id}',${row.rate_per_minute},'${row.id}')">✅</button>
    <button class="btn-small danger" onclick="rejectIncoming('${row.id}')">❌</button>`;
  navigator.vibrate?.([300, 120, 300]);
  try {
    const ctx = window._fendyxAudioCtx || (window._fendyxAudioCtx = new (window.AudioContext || window.webkitAudioContext)());
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 660; g.gain.value = 0.2;
    o.start(); setTimeout(() => o.stop(), 400);
  } catch (e) {}
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
  callCostTotal = 0; callSeconds = 0; callSetupDone = false; facingMode = 'user';
  document.getElementById('callTimer').textContent = '00:00';
  document.getElementById('callCost').textContent = iAmClientFlag && callRate > 0 ? '◈ 0.00' : (currentProfile.unlimited_tokens ? '∞ ADMIN' : '◈ 0.00');
  document.getElementById('callStatusMsg').textContent = 'Solicitando cámara y micrófono…';
  openModal('modal-call');
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode }, width: { ideal: 640 }, height: { ideal: 480 } },
      audio: { echoCancellation: true, noiseSuppression: true }
    });
    document.getElementById('localVideo').srcObject = localStream;
  } catch (e) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      document.getElementById('localVideo').srcObject = localStream;
    } catch (e2) {
      showToast('❌ Permiso de cámara/micrófono denegado'); closeModal('modal-call'); return;
    }
  }
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
  pc = new RTCPeerConnection({ iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ]});
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  pc.ontrack = e => {
    const rv = document.getElementById('remoteVideo');
    if (rv) { rv.srcObject = e.streams[0]; rv.muted = false; }
    const msg = document.getElementById('callStatusMsg'); if (msg) msg.textContent = '🟢 Conectada';
  };
  pc.onicecandidate = e => { if (e.candidate) send({ type: 'ice', candidate: e.candidate }); };
  pc.onnegotiationneeded = async () => {
    try {
      makingOffer = true;
      await pc.setLocalDescription();
      send({ type: 'description', sdp: pc.localDescription });
    } catch (e) { console.warn(e); } finally { makingOffer = false; }
  };
  pc.onconnectionstatechange = () => {
    const msg = document.getElementById('callStatusMsg');
    if (pc.connectionState === 'connected') { if (msg) msg.textContent = '🟢 Conectada'; startCallClock(); }
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

// ===== VOLTEAR CÁMARA TRASERA =====
async function flipCamera() {
  if (!localStream || !pc) { showToast('Llamada no activa'); return; }
  facingMode = facingMode === 'user' ? 'environment' : 'user';
  const btn = document.getElementById('btnFlip');
  if (btn) btn.disabled = true;
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode }, width: { ideal: 640 }, height: { ideal: 480 } }
    });
    const newTrack = newStream.getVideoTracks()[0];
    const oldTrack = localStream.getVideoTracks()[0];
    if (oldTrack) { oldTrack.stop(); localStream.removeTrack(oldTrack); }
    localStream.addTrack(newTrack);
    document.getElementById('localVideo').srcObject = localStream;
    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) await sender.replaceTrack(newTrack);
    showToast(facingMode === 'environment' ? '🔄 Cámara trasera' : '🔄 Cámara frontal');
  } catch (e) {
    showToast('❌ No se pudo voltear la cámara');
    facingMode = facingMode === 'user' ? 'environment' : 'user';
  } finally {
    if (btn) btn.disabled = false;
  }
}

function startCallClock() {
  if (callClock) return;
  callClock = setInterval(async () => {
    callSeconds++;
    const t = document.getElementById('callTimer');
    if (t) t.textContent = String(Math.floor(callSeconds / 60)).padStart(2, '0') + ':' + String(callSeconds % 60).padStart(2, '0');
    if (iAmClientFlag && callRate > 0 && callSeconds % 60 === 0 && callRowId) {
      const { data: nb, error } = await db.rpc('pay_call_minute', { p_call: callRowId });
      if (error || nb === -1) { showToast('❌ Saldo agotado o llamada inactiva'); endWebCall(); return; }
      callCostTotal += callRate;
      if (!currentProfile.unlimited_tokens) {
        currentProfile.tokens_balance = nb; updateHeader();
        const c = document.getElementById('callCost'); if (c) c.textContent = '◈ ' + callCostTotal.toFixed(2);
        if (nb <= 0) { showToast('❌ Saldo agotado. Llamada finalizada.'); endWebCall(); }
      } else {
        const c = document.getElementById('callCost'); if (c) c.textContent = '∞ ADMIN · trabajadora cobró ◈ ' + callCostTotal.toFixed(2);
      }
    }
  }, 1000);
}

function toggleMic() {
  if (!localStream) return;
  const t = localStream.getAudioTracks()[0];
  if (t) { t.enabled = !t.enabled; const b = document.getElementById('btnMic'); if (b) b.textContent = t.enabled ? '🎤 Silenciar' : '🔇 Activar'; }
}
function toggleCam() {
  if (!localStream) return;
  const t = localStream.getVideoTracks()[0];
  if (t) { t.enabled = !t.enabled; const b = document.getElementById('btnCam'); if (b) b.textContent = t.enabled ? '📷 Cámara' : '🚫 Cámara'; }
}

async function endWebCall() {
  if (callChannel) { try { callChannel.send({ type: 'broadcast', event: 'hangup', payload: { from: currentUser.id } }); } catch(e){} }
  if (callRowId) await db.from('video_calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callRowId);
  showToast('📞 Llamada finalizada · Costo: ' + (iAmClientFlag && callRate > 0 ? '◈ ' + callCostTotal.toFixed(2) : '◈ 0.00'));
  cleanupCall();
}
function cleanupCall() {
  if (callClock) { clearInterval(callClock); callClock = null; }
  if (pc) { try { pc.close(); } catch (e) {} pc = null; }
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  if (callChannel) { try { db.removeChannel(callChannel); } catch(e){} callChannel = null; }
  callRoom = null; callRowId = null; callSetupDone = false; peerPresent = false;
  closeModal('modal-call');
}
