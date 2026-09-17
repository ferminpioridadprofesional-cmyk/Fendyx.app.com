'use strict';
let pc = null, localStream = null, callChannel = null, callRoom = null;
let callSeconds = 0, callClock = null, callCostTotal = 0, callRowId = null, callRate = 0, iAmClientFlag = false, isInitiatorFlag = false;
let callSetupDone = false, facingMode = 'user', currentDeviceId = null;
let offerSent = false, pendingCandidates = [], currentPolicy = 'all';
let peerPresent = false, gotAnswer = false, gotOffer = false;
let helloTimer = null, ackTimer = null, offerTimer = null, watchdog = null, lastReconnectAt = 0, callStartAt = 0;
let micOn = true, camOn = true, netListenersOn = false;

const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.voip.blackberry.com:3478' },
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp', 'turns:openrelay.metered.ca:443'], username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: ['turn:relay.backups.cz:3478', 'turn:relay.backups.cz:5349?transport=tcp', 'turns:relay.backups.cz:5349'], username: 'webrtc', credential: 'webrtc' }
];

function setStatus(t) { const m = document.getElementById('callStatusMsg'); if (m) m.textContent = t; }
function setChatState(t, ok) { const c = document.getElementById('chatState'); if (c) { c.textContent = t; c.style.color = ok ? 'var(--success)' : 'var(--error)'; c.style.fontWeight = '800'; } }
function showNetHint(on) { const h = document.getElementById('netHint'); if (h) h.classList.toggle('hidden', !on); }
function clearHello() { if (helloTimer) { clearInterval(helloTimer); helloTimer = null; } }
function clearAck() { if (ackTimer) { clearInterval(ackTimer); ackTimer = null; } }
function clearOffer() { if (offerTimer) { clearInterval(offerTimer); offerTimer = null; } }

function ensureCallUI() {
  if (document.getElementById('fendyx-call-style')) return;
  const st = document.createElement('style');
  st.id = 'fendyx-call-style';
  st.textContent = `
    .video-wrap{position:relative;height:340px;background:#000;border-radius:16px;overflow:hidden;margin:10px 0}
    #remoteVideo{width:100%;height:100%;object-fit:cover;background:#000}
    #localVideo{position:absolute;right:10px;bottom:10px;width:105px;height:140px;object-fit:cover;border-radius:12px;border:2px solid var(--border-strong);background:#111;transition:opacity .2s,filter .2s}
    #localVideo.camoff{opacity:.15;filter:grayscale(1)}
    #callStatusMsg{position:absolute;top:10px;left:12px;background:rgba(0,0,0,.55);padding:4px 10px;border-radius:999px;font-size:.8rem}
    .net-hint{position:absolute;bottom:10px;left:12px;right:12px;background:rgba(255,176,32,.92);color:#04060c;padding:6px 10px;border-radius:10px;font-size:.8rem;font-weight:800}
    .call-info{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 14px;background:rgba(0,217,255,.08);border:1px solid var(--border);border-radius:13px;font-family:'Orbitron';font-weight:800;color:var(--primary);flex-wrap:wrap}
    .chat-state{font-family:'Rajdhani';font-weight:800;font-size:.85rem}
    .call-controls{display:flex;gap:8px;justify-content:center;margin-top:8px;flex-wrap:wrap}
    .call-controls .btn-small{padding:11px 14px;font-size:.9rem}
    .call-controls .btn-small.off{opacity:.6;border-color:var(--error);color:var(--error)}
    .call-chat{margin-top:10px;border:1px solid var(--border);border-radius:12px;overflow:hidden}
    .call-chat-list{max-height:120px;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:6px;background:rgba(255,255,255,.03)}
    .call-chat-list .cc{padding:6px 10px;border-radius:10px;font-size:.85rem;max-width:85%}
    .call-chat-list .cc.me{align-self:flex-end;background:var(--gradient);color:#04060c}
    .call-chat-list .cc.them{align-self:flex-start;background:rgba(255,255,255,.1)}
    .call-chat-input{display:flex;gap:6px;padding:6px;border-top:1px solid var(--border)}
    .call-chat-input input{flex:1;padding:8px 10px;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:'Rajdhani'}
    .incoming-call{position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:600;background:var(--card-2);border:2px solid var(--success);border-radius:18px;padding:14px 20px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 40px rgba(0,255,157,.35);animation:proxIn .4s;max-width:92vw}
    .incoming-call b{display:block}`;
  document.head.appendChild(st);
  const mc = document.querySelector('#modal-call .modal-content');
  if (mc) mc.innerHTML = `
    <div class="call-info"><span id="callTimer">00:00</span><span id="chatState" class="chat-state">💬 Chat no conectado</span><span id="callCost">◈ 0.00</span></div>
    <div class="video-wrap">
      <video id="remoteVideo" autoplay playsinline></video>
      <video id="localVideo" autoplay playsinline muted></video>
      <div id="callStatusMsg" class="dim">🎥 Conectando video…</div>
      <div id="netHint" class="net-hint hidden">📶 El video no conecta en esta red. Cambia a datos móviles o activa/desactiva WiFi para conectar el video.</div>
    </div>
    <div class="call-controls">
      <button id="btnMic" class="btn-small" onclick="toggleMic()">🎤 Silenciar</button>
      <button id="btnCam" class="btn-small" onclick="toggleCam()">📷 Encendida</button>
      <button id="btnFlip" class="btn-small" onclick="flipCamera()">🔄</button>
      <button class="btn-small danger" onclick="endWebCall()">📞</button>
    </div>
    <div class="call-chat">
      <div id="callChatList" class="call-chat-list"></div>
      <div class="call-chat-input"><input id="callChatInput" placeholder="Mensaje en la llamada…" onkeypress="if(event.key==='Enter')sendCallChat()"><button class="btn-small" onclick="sendCallChat()">➤</button></div>
    </div>`;
}

function armAutoUnmute() {
  const unmute = () => { const rv = document.getElementById('remoteVideo'); if (rv) { rv.muted = false; rv.play().catch(() => {}); } window.removeEventListener('pointerdown', unmute, true); window.removeEventListener('keydown', unmute, true); };
  window.addEventListener('pointerdown', unmute, true);
  window.addEventListener('keydown', unmute, true);
}
function playRemoteNow() { const rv = document.getElementById('remoteVideo'); if (!rv) return; rv.muted = false; rv.play().catch(() => armAutoUnmute()); }

function armNetworkWatch() {
  if (netListenersOn) return; netListenersOn = true;
  const onChange = () => { if (callRoom) { setStatus('🔄 Cambió la red: reconectando video…'); forceReconnect(); } };
  try { if (navigator.connection) navigator.connection.addEventListener('change', onChange); } catch (e) {}
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
}

async function showIncomingCall(row) {
  ensureCallUI();
  const { data: caller } = await db.from('profiles').select('full_name, model_name').eq('id', row.client_id).single();
  const box = document.getElementById('incomingCall'); if (!box) return;
  box.classList.remove('hidden');
  box.innerHTML = `<div><b>📞 ${caller?.model_name || caller?.full_name || 'Llamada'}</b><small>◈ ${row.rate_per_minute}/min</small></div>
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
function remoteHungUp(row) { if (callRoom && row.room_id === callRoom) { showToast('📞 La otra persona colgó'); cleanupCall(); } }

async function startWebCall(room, opts = {}) { await beginCall(room, opts, true); }
async function joinWebCall(room, opts = {}) { await beginCall(room, opts, false); }

async function beginCall(room, opts, initiator) {
  ensureCallUI(); armNetworkWatch();
  if (pc) teardownPC();
  clearHello(); clearAck(); clearOffer();
  callRoom = room; callRowId = opts.rowId || null; callRate = parseFloat(opts.rate) || 0;
  iAmClientFlag = !!opts.asClient; isInitiatorFlag = !!initiator;
  callCostTotal = 0; callSeconds = 0; callSetupDone = false; facingMode = 'user';
  offerSent = false; pendingCandidates = []; currentPolicy = 'all';
  peerPresent = false; gotAnswer = false; gotOffer = false; lastReconnectAt = 0; callStartAt = Date.now();
  micOn = true; camOn = true;
  const bm = document.getElementById('btnMic'); if (bm) { bm.textContent = '🎤 Silenciar'; bm.classList.remove('off'); }
  const bc = document.getElementById('btnCam'); if (bc) { bc.textContent = '📷 Encendida'; bc.classList.remove('off'); }
  document.getElementById('callTimer').textContent = '00:00';
  // El que llama NO ve descuento; la trabajadora SÍ ve ganancia
  const costSpan = document.getElementById('callCost');
  if (costSpan) {
    if (iAmClientFlag) { costSpan.style.display = 'none'; }
    else { costSpan.style.display = ''; costSpan.style.color = 'var(--success)'; costSpan.textContent = '+0.00 ◈'; }
  }
  setChatState('💬 Chat no conectado', false);
  showNetHint(false);
  setStatus('📷 Solicitando cámara…');
  document.getElementById('callChatList').innerHTML = '';
  openModal('modal-call');
  try { localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' } }, audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) { try { localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); } catch (e2) { showToast('❌ Permiso de cámara/micrófono denegado'); closeModal('modal-call'); return; } }
  currentDeviceId = localStream.getVideoTracks()[0]?.getSettings?.().deviceId || null;
  const lv = document.getElementById('localVideo'); lv.srcObject = localStream; lv.muted = true; lv.classList.remove('camoff'); lv.play().catch(() => {});
  setStatus(isInitiatorFlag ? '⏳ Llamando… espera respuesta' : '📞 Contestando…');
  callChannel = db.channel('call_' + room)
    .on('broadcast', { event: 'signal' }, ({ payload }) => handleSignal(payload))
    .on('broadcast', { event: 'chatmsg' }, ({ payload }) => appendCallChat(payload.text, false))
    .on('broadcast', { event: 'hangup' }, () => { showToast('📞 La otra persona colgó'); cleanupCall(); });
  callChannel.subscribe(async status => {
    if (status !== 'SUBSCRIBED' || callSetupDone) return;
    callSetupDone = true;
    createPC('all');
    startHelloLoop();
    startWatchdog();
  });
}

function startHelloLoop() { clearHello(); send({ type: 'hello' }); helloTimer = setInterval(() => { if (!peerPresent) send({ type: 'hello' }); else clearHello(); }, 1000); }
function startAckLoop() { clearAck(); send({ type: 'helloAck' }); ackTimer = setInterval(() => { if (!gotOffer) send({ type: 'helloAck' }); else clearAck(); }, 1000); }
function startOfferLoop() { if (offerTimer) return; createOffer(); offerTimer = setInterval(() => { if (!gotAnswer) createOffer(); else clearOffer(); }, 1500); }

function teardownPC() { if (pc) { try { pc.close(); } catch (e) {} pc = null; } offerSent = false; pendingCandidates = []; }

function createPC(policy) {
  currentPolicy = policy || 'all';
  teardownPC();
  pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 6, iceTransportPolicy: currentPolicy });
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  pc.ontrack = e => { const rv = document.getElementById('remoteVideo'); if (rv) { rv.srcObject = e.streams[0]; playRemoteNow(); } };
  pc.onicecandidate = e => { if (e.candidate) send({ type: 'ice', candidate: e.candidate }); };
  pc.oniceconnectionstatechange = () => {
    const s = pc.iceConnectionState;
    if (s === 'checking') setStatus('🎥 Conectando video…');
    if (s === 'disconnected') { try { pc.restartIce(); } catch (e) {} setStatus('🟡 Video: estabilizando…'); }
    if (s === 'failed') queueReconnect(600);
  };
  pc.onconnectionstatechange = () => {
    const st = pc.connectionState;
    if (st === 'connected') {
      setStatus('🟢 Video conectado'); showNetHint(false);
      playRemoteNow(); const lv = document.getElementById('localVideo'); if (lv) lv.play().catch(() => {});
      startCallClock();
    }
    else if (st === 'failed') queueReconnect(600);
    else if (st === 'closed' && callRoom) { showToast('📞 Llamada finalizada'); cleanupCall(); }
  };
}

function forceReconnect() {
  if (!callRoom) return;
  gotAnswer = false; gotOffer = false; pendingCandidates = [];
  createPC(currentPolicy);
  startHelloLoop();
  if (isInitiatorFlag) setTimeout(() => { if (peerPresent && !gotAnswer) startOfferLoop(); }, 800);
}
function queueReconnect(delay) {
  const now = Date.now();
  if (now - lastReconnectAt < 1500) return;
  lastReconnectAt = now;
  setStatus('🟡 Video: reintentando…');
  setTimeout(() => { if (callRoom) forceReconnect(); }, delay || 800);
}
function startWatchdog() {
  if (watchdog) return;
  watchdog = setInterval(() => {
    if (!callRoom || !pc) return;
    if (pc.connectionState !== 'connected') {
      if (Date.now() - callStartAt > 12000) showNetHint(true);
      const now = Date.now();
      if (now - lastReconnectAt > 5000) { lastReconnectAt = now; setStatus('🟡 Video: reintentando…'); forceReconnect(); }
    } else showNetHint(false);
  }, 5000);
}

function send(msg) { if (callChannel) callChannel.send({ type: 'broadcast', event: 'signal', payload: { ...msg, from: currentUser.id } }); }
function flushCandidates() { while (pendingCandidates.length && pc) { const c = pendingCandidates.shift(); pc.addIceCandidate(c).catch(() => {}); } }
async function createOffer() {
  if (!pc) return;
  offerSent = true;
  try { const o = await pc.createOffer(); await pc.setLocalDescription(o); send({ type: 'description', sdp: pc.localDescription }); }
  catch (e) { offerSent = false; }
}
async function handleSignal(p) {
  if (!p || p.from === currentUser.id) return;
  if (p.type === 'hello' || p.type === 'helloAck') {
    const wasPresent = peerPresent;
    peerPresent = true; clearHello();
    if (!wasPresent) setChatState('💬 Chat conectado', true);
    if (!pc || pc.connectionState === 'failed' || pc.connectionState === 'closed') createPC(currentPolicy);
    if (p.type === 'hello' && !isInitiatorFlag) { if (!gotOffer) startAckLoop(); }
    if (isInitiatorFlag) startOfferLoop();
    return;
  }
  if (!pc) return;
  if (p.type === 'description') {
    try {
      if (p.sdp.type === 'offer' && !isInitiatorFlag) {
        gotOffer = true; clearAck();
        await pc.setRemoteDescription(p.sdp); flushCandidates();
        const a = await pc.createAnswer(); await pc.setLocalDescription(a); send({ type: 'description', sdp: pc.localDescription });
      } else if (p.sdp.type === 'answer' && isInitiatorFlag) {
        if (!gotAnswer) { gotAnswer = true; clearOffer(); await pc.setRemoteDescription(p.sdp); flushCandidates(); }
      }
    } catch (e) {}
    return;
  }
  if (p.type === 'ice') { if (pc.remoteDescription) pc.addIceCandidate(p.candidate).catch(() => {}); else pendingCandidates.push(p.candidate); }
}

// VOLTEO ROBUSTO: usa el deviceId exacto de la otra lente (arregla Android)
async function flipCamera() {
  if (!localStream || !pc) return;
  let cams = [];
  try { cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); } catch (e) {}
  if (cams.length < 2) { showToast('❌ Este modelo tiene una sola cámara'); return; }
  facingMode = facingMode === 'user' ? 'environment' : 'user';
  let target = cams.find(c => c.deviceId !== currentDeviceId) || cams[0];
  try {
    const ns = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: target.deviceId } }, audio: false });
    const nt = ns.getVideoTracks()[0];
    currentDeviceId = nt.getSettings?.().deviceId || target.deviceId;
    const ot = localStream.getVideoTracks()[0];
    if (ot) { ot.stop(); localStream.removeTrack(ot); }
    localStream.addTrack(nt);
    const lv = document.getElementById('localVideo'); lv.srcObject = localStream; lv.play().catch(() => {});
    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) await sender.replaceTrack(nt);
    showToast(facingMode === 'environment' ? '🔄 Cámara trasera' : '🔄 Cámara frontal');
  } catch (e) { showToast('❌ No se pudo voltear en este modelo'); }
}

function toggleMic() {
  const t = localStream?.getAudioTracks()[0]; if (!t) return;
  micOn = !micOn; t.enabled = micOn;
  const b = document.getElementById('btnMic'); if (b) { b.textContent = micOn ? '🎤 Silenciar' : '🔇 Silenciado'; b.classList.toggle('off', !micOn); }
  showToast(micOn ? '🎤 Micrófono activo: te escuchan' : '🔇 Silenciado: no te escuchan');
}
function toggleCam() {
  const t = localStream?.getVideoTracks()[0]; if (!t) return;
  camOn = !camOn; t.enabled = camOn;
  const lv = document.getElementById('localVideo'); if (lv) lv.classList.toggle('camoff', !camOn);
  const b = document.getElementById('btnCam'); if (b) { b.textContent = camOn ? '📷 Encendida' : '🚫 Apagada'; b.classList.toggle('off', !camOn); }
  showToast(camOn ? '📷 Cámara encendida' : '🚫 Cámara apagada');
}

function appendCallChat(text, mine) {
  const list = document.getElementById('callChatList'); if (!list) return;
  list.insertAdjacentHTML('beforeend', `<div class="cc ${mine ? 'me' : 'them'}">${text}</div>`);
  list.scrollTop = list.scrollHeight;
}
function sendCallChat() {
  const inp = document.getElementById('callChatInput'); if (!inp) return;
  const text = inp.value.trim(); if (!text || !callChannel) return;
  inp.value = '';
  appendCallChat(text, true);
  callChannel.send({ type: 'broadcast', event: 'chatmsg', payload: { from: currentUser.id, text } });
}

function startCallClock() {
  if (callClock) return;
  callClock = setInterval(async () => {
    callSeconds++;
    const t = document.getElementById('callTimer');
    if (t) t.textContent = String(Math.floor(callSeconds / 60)).padStart(2, '0') + ':' + String(callSeconds % 60).padStart(2, '0');
    const minutes = Math.floor(callSeconds / 60);
    // TRABAJADORA: ve su ganancia en vivo
    if (!iAmClientFlag) {
      const earned = (callRate * minutes).toFixed(2);
      const c = document.getElementById('callCost'); if (c) c.textContent = '+' + earned + ' ◈';
    }
    // CLIENTE: descuenta cada minuto; si no tiene, corta con mensaje
    if (iAmClientFlag && callRate > 0 && callSeconds % 60 === 0 && callRowId) {
      const { data: nb, error } = await db.rpc('pay_call_minute', { p_call: callRowId });
      if (error || nb === -1 || (nb !== null && nb <= 0)) {
        showToast('❌ Necesitas más tokens para llamar o continuar la llamada');
        endWebCall(); return;
      }
      callCostTotal += callRate;
      currentProfile.tokens_balance = nb; updateHeader();
    }
  }, 1000);
}

async function endWebCall() {
  if (callChannel) { try { callChannel.send({ type: 'broadcast', event: 'hangup', payload: { from: currentUser.id } }); } catch (e) {} }
  if (callRowId) await db.from('video_calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callRowId);
  cleanupCall();
}
function cleanupCall() {
  if (callClock) { clearInterval(callClock); callClock = null; }
  if (watchdog) { clearInterval(watchdog); watchdog = null; }
  clearHello(); clearAck(); clearOffer();
  teardownPC();
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  if (callChannel) { try { db.removeChannel(callChannel); } catch (e) {} callChannel = null; }
  callRoom = null; callRowId = null; callSetupDone = false;
  showNetHint(false);
  closeModal('modal-call');
}
