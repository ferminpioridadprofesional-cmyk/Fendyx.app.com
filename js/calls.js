'use strict';
let pc = null, localStream = null, callChannel = null, callRoom = null;
let callSeconds = 0, callClock = null, callCostTotal = 0, callRowId = null, callRate = 0, iAmClientFlag = false, isInitiatorFlag = false;
let callSetupDone = false, facingMode = 'user';
let offerSent = false, answerSent = false, pendingCandidates = [];

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
];

function ensureCallUI() {
  if (document.getElementById('fendyx-call-style')) return;
  const st = document.createElement('style');
  st.id = 'fendyx-call-style';
  st.textContent = `
    .video-wrap{position:relative;height:340px;background:#000;border-radius:16px;overflow:hidden;margin:10px 0}
    #remoteVideo{width:100%;height:100%;object-fit:cover}
    #localVideo{position:absolute;right:10px;bottom:10px;width:105px;height:140px;object-fit:cover;border-radius:12px;border:2px solid var(--border-strong);background:#111}
    #callStatusMsg{position:absolute;top:10px;left:12px;background:rgba(0,0,0,.55);padding:4px 10px;border-radius:999px;font-size:.8rem}
    .call-controls{display:flex;gap:8px;justify-content:center;margin-top:8px;flex-wrap:wrap}
    .call-controls .btn-small{padding:11px 14px;font-size:.9rem}
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
    <div class="call-info"><span id="callTimer">00:00</span><span id="callCost">◈ 0.00</span></div>
    <div class="video-wrap">
      <video id="remoteVideo" autoplay playsinline></video>
      <video id="localVideo" autoplay playsinline muted></video>
      <div id="callStatusMsg" class="dim">Conectando…</div>
    </div>
    <div class="call-controls">
      <button id="btnMic" class="btn-small" onclick="toggleMic()">🎤</button>
      <button id="btnCam" class="btn-small" onclick="toggleCam()">📷</button>
      <button id="btnFlip" class="btn-small" onclick="flipCamera()">🔄</button>
      <button class="btn-small danger" onclick="endWebCall()">📞</button>
    </div>
    <div class="call-chat">
      <div id="callChatList" class="call-chat-list"></div>
      <div class="call-chat-input"><input id="callChatInput" placeholder="Mensaje en la llamada…" onkeypress="if(event.key==='Enter')sendCallChat()"><button class="btn-small" onclick="sendCallChat()">➤</button></div>
    </div>`;
}

async function showIncomingCall(row) {
  ensureCallUI();
  const { data: caller } = await db.from('profiles').select('full_name').eq('id', row.client_id).single();
  const box = document.getElementById('incomingCall'); if (!box) return;
  box.classList.remove('hidden');
  box.innerHTML = `<div><b>📞 ${caller?.full_name || 'Llamada'}</b><small>◈ ${row.rate_per_minute}/min</small></div>
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
  ensureCallUI();
  if (pc) cleanupCall();
  callRoom = room; callRowId = opts.rowId || null; callRate = parseFloat(opts.rate) || 0;
  iAmClientFlag = !!opts.asClient; isInitiatorFlag = !!initiator;
  callCostTotal = 0; callSeconds = 0; callSetupDone = false; facingMode = 'user';
  offerSent = false; answerSent = false; pendingCandidates = [];
  document.getElementById('callTimer').textContent = '00:00';
  document.getElementById('callCost').textContent = iAmClientFlag && callRate > 0 ? '◈ 0.00' : (currentProfile.unlimited_tokens ? '∞ ADMIN' : '◈ 0.00');
  document.getElementById('callStatusMsg').textContent = 'Solicitando cámara…';
  document.getElementById('callChatList').innerHTML = '';
  openModal('modal-call');
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' } }, audio: { echoCancellation: true, noiseSuppression: true } });
    document.getElementById('localVideo').srcObject = localStream;
  } catch (e) {
    try { localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); document.getElementById('localVideo').srcObject = localStream; }
    catch (e2) { showToast('❌ Permiso de cámara/micrófono denegado'); closeModal('modal-call'); return; }
  }
  callChannel = db.channel('call_' + room)
    .on('broadcast', { event: 'signal' }, ({ payload }) => handleSignal(payload))
    .on('broadcast', { event: 'chatmsg' }, ({ payload }) => appendCallChat(payload.text, false))
    .on('broadcast', { event: 'hangup' }, () => { showToast('📞 La otra persona colgó'); cleanupCall(); });
  callChannel.subscribe(async status => {
    if (status !== 'SUBSCRIBED' || callSetupDone) return;
    callSetupDone = true;
    setupPeer();
    send({ type: 'hello' });
    if (isInitiatorFlag) setTimeout(() => { if (!offerSent && pc) createOffer(); }, 2500);
  });
}

function setupPeer() {
  pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  pc.ontrack = e => { const rv = document.getElementById('remoteVideo'); if (rv) { rv.srcObject = e.streams[0]; rv.muted = false; } const m = document.getElementById('callStatusMsg'); if (m) m.textContent = '🟢 Conectada'; };
  pc.onicecandidate = e => { if (e.candidate) send({ type: 'ice', candidate: e.candidate }); };
  pc.onconnectionstatechange = () => {
    const m = document.getElementById('callStatusMsg');
    const st = pc.connectionState;
    if (st === 'connected') { if (m) m.textContent = '🟢 Conectada'; startCallClock(); }
    else if (st === 'disconnected') { if (m) m.textContent = '🟡 Reconectando…'; }
    else if (st === 'failed' || st === 'closed') { if (callRoom) { showToast('📞 Llamada finalizada'); cleanupCall(); } }
  };
}

function send(msg) { if (callChannel) callChannel.send({ type: 'broadcast', event: 'signal', payload: { ...msg, from: currentUser.id } }); }
function flushCandidates() { while (pendingCandidates.length && pc) { const c = pendingCandidates.shift(); pc.addIceCandidate(c).catch(() => {}); } }
async function createOffer() {
  if (offerSent || !pc) return;
  offerSent = true;
  try { const o = await pc.createOffer(); await pc.setLocalDescription(o); send({ type: 'description', sdp: pc.localDescription }); }
  catch (e) { offerSent = false; console.warn(e); }
}

async function handleSignal(p) {
  if (!p || p.from === currentUser.id || !pc) return;
  if (p.type === 'hello') {
    if (!isInitiatorFlag) send({ type: 'helloAck' });
    if (isInitiatorFlag && !offerSent) createOffer();
    return;
  }
  if (p.type === 'helloAck') { if (isInitiatorFlag && !offerSent) createOffer(); return; }
  if (p.type === 'description') {
    try {
      if (p.sdp.type === 'offer' && !isInitiatorFlag) {
        await pc.setRemoteDescription(p.sdp); flushCandidates();
        if (!answerSent) { answerSent = true; const a = await pc.createAnswer(); await pc.setLocalDescription(a); send({ type: 'description', sdp: pc.localDescription }); }
      } else if (p.sdp.type === 'answer' && isInitiatorFlag) {
        await pc.setRemoteDescription(p.sdp); flushCandidates();
      }
    } catch (e) { console.warn(e); }
    return;
  }
  if (p.type === 'ice') {
    if (pc.remoteDescription) { pc.addIceCandidate(p.candidate).catch(() => {}); }
    else pendingCandidates.push(p.candidate);
  }
}

// ===== CHAT DENTRO DE LA LLAMADA =====
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

async function flipCamera() {
  if (!localStream || !pc) return;
  facingMode = facingMode === 'user' ? 'environment' : 'user';
  try {
    const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode } } });
    const nt = ns.getVideoTracks()[0];
    const ot = localStream.getVideoTracks()[0];
    if (ot) { ot.stop(); localStream.removeTrack(ot); }
    localStream.addTrack(nt);
    document.getElementById('localVideo').srcObject = localStream;
    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) await sender.replaceTrack(nt);
    showToast(facingMode === 'environment' ? '🔄 Trasera' : '🔄 Frontal');
  } catch (e) { showToast('❌ No se pudo voltear'); }
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
        if (nb <= 0) { showToast('❌ Saldo agotado'); endWebCall(); }
      } else { const c = document.getElementById('callCost'); if (c) c.textContent = '∞ ADMIN'; }
    }
  }, 1000);
}
function toggleMic() { const t = localStream?.getAudioTracks()[0]; if (t) t.enabled = !t.enabled; }
function toggleCam() { const t = localStream?.getVideoTracks()[0]; if (t) t.enabled = !t.enabled; }

async function endWebCall() {
  if (callChannel) { try { callChannel.send({ type: 'broadcast', event: 'hangup', payload: { from: currentUser.id } }); } catch (e) {} }
  if (callRowId) await db.from('video_calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callRowId);
  showToast('📞 Llamada finalizada · Costo: ◈ ' + callCostTotal.toFixed(2));
  cleanupCall();
}
function cleanupCall() {
  if (callClock) { clearInterval(callClock); callClock = null; }
  if (pc) { try { pc.close(); } catch (e) {} pc = null; }
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  if (callChannel) { try { db.removeChannel(callChannel); } catch (e) {} callChannel = null; }
  callRoom = null; callRowId = null; callSetupDone = false; offerSent = false; answerSent = false; pendingCandidates = [];
  closeModal('modal-call');
}
