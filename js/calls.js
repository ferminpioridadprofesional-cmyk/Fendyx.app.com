'use strict';
let pc=null,localStream=null,callChannel=null,callRoom=null;
let callSeconds=0,callClock=null,callCostTotal=0,callEarnTotal=0,callRowId=null,callRate=0,iAmClientFlag=false,isInitiatorFlag=false;
let callSetupDone=false,facingMode='user',currentDeviceId=null,currentMicId=null,callPeerId=null;
let offerSent=false,pendingCandidates=[],currentPolicy='all',policyAttempt=0;
let peerPresent=false,gotAnswer=false,gotOffer=false;
let helloTimer=null,ackTimer=null,offerTimer=null,watchdog=null,lastReconnectAt=0,callStartAt=0;
let micOn=true,camOn=true,netListenersOn=false,ringTimer=null;
let monPc=null,monChannel=null,monPcs={};
let lowTimer=null,clientBalanceLocal=0,_ratePick=0;
let turnCache=null,turnCacheAt=0;
async function resolveTurnServers(force){
  if(turnCache&&!force&&(Date.now()-turnCacheAt)<3600000)return turnCache;
  const out=[];
  try{
    const{data}=await db.from('app_branding').select('turn_config').eq('id',1).single();
    const raw=data?.turn_config;
    if(raw){
      if(raw.worker&&raw.worker.url){try{const r=await fetch(raw.worker.url);const j=await r.json();if(j&&j.urls&&j.username&&j.credential)out.push({urls:j.urls,username:j.username,credential:j.credential});}catch(e){}}
      if(Array.isArray(raw.servers))raw.servers.forEach(s=>{if(s&&s.urls&&s.username&&s.credential)out.push(s);});
      if(raw.urls&&raw.username&&raw.credential)out.push({urls:raw.urls,username:raw.username,credential:raw.credential});
    }
  }catch(e){}
  if(window._turnConfig&&window._turnConfig.urls&&window._turnConfig.username)out.push(window._turnConfig);
  if(out.length){turnCache=out;turnCacheAt=Date.now();}
  return out;
}
function buildIce(){
  const list=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302']},{urls:'stun:stun.cloudflare.com:3478'},{urls:'stun:stun.relay.metered.ca:80'}];
  (turnCache||[]).forEach(s=>list.push(s));
  list.push({urls:['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443','turn:openrelay.metered.ca:443?transport=tcp','turns:openrelay.metered.ca:443'],username:'openrelayproject',credential:'openrelayproject'});
  list.push({urls:['turn:relay.backups.cz:3478','turn:relay.backups.cz:5349?transport=tcp','turns:relay.backups.cz:5349'],username:'webrtc',credential:'webrtc'});
  return list;
}
// ===== Bitrate adaptativo: relay=bajo, P2P=alto =====
async function tuneBitrateAdaptive(){
  if(!pc)return;
  try{
    const stats=await pc.getStats();
    let isRelay=false;
    stats.forEach(rep=>{
      if(rep.type==='candidate-pair'&&(rep.selected||rep.state==='succeeded'&&rep.nominated)){
        const local=rep.localCandidateId?stats.get(rep.localCandidateId):null;
        if(local&&(local.candidateType==='relay'||local.candidateType==='relayed'))isRelay=true;
      }
    });
    const vMax=isRelay?500000:1500000, aMax=isRelay?32000:64000, fMax=isRelay?24:30;
    pc.getSenders().forEach(s=>{
      if(!s.track)return;
      const p=s.getParameters()||{};
      p.encodings=(p.encodings&&p.encodings.length)?p.encodings:[{}];
      p.encodings[0].maxBitrate=(s.track.kind==='video')?vMax:aMax;
      if(s.track.kind==='video')p.encodings[0].maxFramerate=fMax;
      s.setParameters(p).catch(()=>{});
    });
  }catch(e){}
}
function setStatus(t){const m=document.getElementById('callStatusMsg');if(m)m.textContent=t;}
function setChatState(t,ok){const c=document.getElementById('chatState');if(c){c.textContent=t;c.style.color=ok?'var(--success)':'var(--error)';c.style.fontWeight='800';}}
function showNetHint(on){const h=document.getElementById('netHint');if(h)h.classList.toggle('hidden',!on);}
function clearHello(){if(helloTimer){clearInterval(helloTimer);helloTimer=null;}}
function clearAck(){if(ackTimer){clearInterval(ackTimer);ackTimer=null;}}
function clearOffer(){if(offerTimer){clearInterval(offerTimer);offerTimer=null;}}
function startRing(){stopRing();try{const ctx=window._fendyxAudio||(window._fendyxAudio=new (window.AudioContext||window.webkitAudioContext)());ctx.resume?.();const beep=()=>{try{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=880;g.gain.setValueAtTime(0.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.35,ctx.currentTime+0.05);g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.4);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+0.45);}catch(e){}};beep();ringTimer=setInterval(beep,1200);}catch(e){}try{navigator.vibrate?.([400,200,400,200,400]);}catch(e){}}
function stopRing(){if(ringTimer){clearInterval(ringTimer);ringTimer=null;}try{navigator.vibrate?.(0);}catch(e){}}
function showLow(sec){const b=document.getElementById('lowTimeBanner');const s=document.getElementById('lowTimeSec');if(!b)return;b.classList.remove('hidden');let v=sec;if(s)s.textContent=v;if(lowTimer)clearInterval(lowTimer);lowTimer=setInterval(()=>{v--;if(v<=0){clearInterval(lowTimer);lowTimer=null;b.innerHTML='💸 Saldo agotado: llamada finalizada';setTimeout(()=>b.classList.add('hidden'),2500);}else if(s)s.textContent=v;},1000);}
function hideLow(){if(lowTimer){clearInterval(lowTimer);lowTimer=null;}const b=document.getElementById('lowTimeBanner');if(b)b.classList.add('hidden');}
// ===== Banner INICIAR SHOW 3-2-1 (se quita solo) =====
function startShowCountdown(){
  let ov=document.getElementById('showCountdown');
  if(!ov){ov=document.createElement('div');ov.id='showCountdown';ov.className='show-count';document.body.appendChild(ov);}
  ov.classList.remove('hidden');
  let n=3;
  const paint=()=>{ov.innerHTML=`<div class="show-box"><span class="show-title">🎬 INICIAR SHOW</span><span class="show-num">${n}</span></div>`;};
  paint();
  const iv=setInterval(()=>{n--;if(n<=0){clearInterval(iv);ov.classList.add('hidden');ov.innerHTML='';showToast('🎬 ¡Show en vivo!');}else paint();},1000);
}
function hideSvcBanner(){const b=document.getElementById('svcBanner');if(b)b.classList.add('hidden');}
async function loadPeerVip(rowId){if(!rowId)return;try{const{data:row}=await db.from('video_calls').select('client_id,worker_id').eq('id',rowId).single();if(!row)return;const otherId=iAmClientFlag?row.worker_id:row.client_id;callPeerId=otherId;const{data:op}=await db.from('profiles').select('tokens_balance').eq('id',otherId).single();const pv=document.getElementById('peerVip');if(pv&&op)pv.innerHTML=userLevelBadge(op.tokens_balance);}catch(e){}}
function showRatingModal(peerId,callId){let m=document.getElementById('rateModal');if(!m){m=document.createElement('div');m.id='rateModal';m.className='modal hidden';m.innerHTML=`<div class="modal-content"><div class="modal-head"><h3>⭐ Califica la llamada</h3><button class="modal-close" onclick="closeModal('rateModal')">✕</button></div><div id="rateStars" style="display:flex;gap:10px;justify-content:center;font-size:2.2rem;cursor:pointer;margin:14px 0"></div><p class="dim" style="text-align:center">Tu calificación mejora el posicionamiento de la modelo.</p></div>`;document.body.appendChild(m);}const wrap=document.getElementById('rateStars');wrap.innerHTML=[1,2,3,4,5].map(i=>`<span data-s="${i}" onclick="pickRateStar(${i})" style="opacity:.3;color:#888">★</span>`).join('');m.dataset.peer=peerId;m.dataset.call=callId||'';_ratePick=0;openModal('rateModal');}
function pickRateStar(i){_ratePick=i;document.querySelectorAll('#rateStars span').forEach(s=>{const v=parseInt(s.dataset.s);s.style.opacity=v<=i?'1':'.3';s.style.color=v<=i?'#ffd700':'#888';});setTimeout(submitRating,350);}
async function submitRating(){const m=document.getElementById('rateModal');const peer=m.dataset.peer;const call=m.dataset.call;if(!_ratePick||!peer)return;await db.from('call_ratings').insert({call_id:call||null,rater_id:currentUser.id,ratee_id:peer,stars:_ratePick});const{data:agg}=await db.from('call_ratings').select('stars').eq('ratee_id',peer);const list=agg||[];const avg=list.reduce((s,x)=>s+x.stars,0)/(list.length||1);await db.from('profiles').update({rating:avg}).eq('id',peer);_ratePick=0;closeModal('rateModal');showToast('⭐ Gracias por calificar');}
async function reportCall(){const reason=prompt('¿Por qué reportas a esta persona?');if(!reason||!reason.trim())return;await db.from('reports').insert({reporter_id:currentUser.id,target_user_id:callPeerId,type:'call',detail:reason});showToast('🚩 Reporte enviado al admin');await endWebCall();}
async function blockPeer(){if(!callPeerId)return;if(!confirm('¿Bloquear a esta persona? No podrán verse ni llamarse.'))return;await db.from('blocks').insert({blocker_id:currentUser.id,blocked_id:callPeerId});showToast('🚫 Bloqueado');await endWebCall();}
// ===== Servicio: PRIMERO guarda la fila, luego envía =====
async function openServiceForm(){
  const desc=prompt('Describe el servicio (ej: baile privado):');if(!desc||!desc.trim())return;
  const amt=parseFloat(prompt('Valor del servicio en tokens ($):'));if(isNaN(amt)||amt<=0)return;
  const{data,error}=await db.from('service_requests').insert({call_id:callRowId,worker_id:currentUser.id,client_id:callPeerId,description:desc.trim(),amount:amt,status:'pending'}).select().single();
  if(error||!data){showToast('❌ No se pudo crear la solicitud');return;}
  callChannel.send({type:'broadcast',event:'svcreq',payload:{from:currentUser.id,id:data.id,description:desc.trim(),amount:amt}});
  showToast('💫 Solicitud enviada al cliente');
}
function showSvcBanner(p){let b=document.getElementById('svcBanner');if(!b){b=document.createElement('div');b.id='svcBanner';b.className='incoming-call';document.body.appendChild(b);}b.classList.remove('hidden');b.innerHTML=`<div><b>💫 ${p.description}</b><small>◈ ${p.amount} tokens</small></div><button class="btn-small success" onclick="acceptService('${p.id}',${p.amount})">✅ Aceptar</button><button class="btn-small danger" onclick="rejectService('${p.id}')">❌</button>`;}
async function acceptService(id,amount){
  hideSvcBanner();
  const{data:nb,error}=await db.rpc('pay_service',{p_id:id});
  if(error){showToast('❌ Error al pagar: '+error.message);callChannel?.send({type:'broadcast',event:'svcdecision',payload:{from:currentUser.id,id,status:'rejected'}});return;}
  if(nb===-1){showToast('❌ Solicitud inválida o ya procesada');callChannel?.send({type:'broadcast',event:'svcdecision',payload:{from:currentUser.id,id,status:'rejected'}});return;}
  if(nb===-2){showToast('❌ Saldo insuficiente');callChannel?.send({type:'broadcast',event:'svcdecision',payload:{from:currentUser.id,id,status:'rejected'}});return;}
  currentProfile.tokens_balance=nb;updateHeader();
  callChannel?.send({type:'broadcast',event:'svcdecision',payload:{from:currentUser.id,id,status:'accepted'}});
  showToast('✅ Servicio pagado: ◈ '+amount);
  startShowCountdown();
}
function rejectService(id){hideSvcBanner();callChannel?.send({type:'broadcast',event:'svcdecision',payload:{from:currentUser.id,id,status:'rejected'}});showToast('❌ Servicio cancelado');}
function setForceRelay(on){currentPolicy=on?'relay':'all';showToast(on?'🔀 Forzando relay (TURN)':'🌐 Modo automático');forceReconnect();}
function ensureCallUI(){if(document.getElementById('fendyx-call-style'))return;const st=document.createElement('style');st.id='fendyx-call-style';st.textContent=`
 .video-wrap{position:relative;height:calc(100vh - 300px);min-height:300px;background:#000;border-radius:16px;overflow:hidden;margin:10px 0}
 #remoteVideo{width:100%;height:100%;object-fit:cover;background:#000}
 #localVideo{position:absolute;right:10px;bottom:10px;width:105px;height:140px;object-fit:cover;border-radius:12px;border:2px solid var(--border-strong);background:#111;transition:opacity .2s,filter .2s}
 #localVideo.camoff{opacity:.15;filter:grayscale(1)}
 #callStatusMsg{position:absolute;top:10px;left:12px;background:rgba(0,0,0,.55);padding:4px 10px;border-radius:999px;font-size:.8rem}
 .net-hint{position:absolute;bottom:10px;left:12px;right:12px;background:rgba(255,176,32,.92);color:#04060c;padding:6px 10px;border-radius:10px;font-size:.8rem;font-weight:800}
 .low-time{margin:8px 0;padding:10px 14px;border-radius:12px;background:rgba(255,59,107,.15);border:1px solid var(--error);color:var(--error);font-weight:800;text-align:center;animation:lvlGlow 1s infinite}
 .call-info{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 14px;background:rgba(0,217,255,.08);border:1px solid var(--border);border-radius:13px;font-family:'Orbitron';font-weight:800;color:var(--primary);flex-wrap:wrap}
 .chat-state{font-family:'Rajdhani';font-weight:800;font-size:.85rem}
 .call-controls{display:flex;gap:6px;justify-content:center;margin-top:8px;flex-wrap:wrap}
 .call-controls .btn-small{padding:10px 12px;font-size:.85rem}
 .call-controls .btn-small.off{opacity:.6;border-color:var(--error);color:var(--error)}
 .device-panel{margin-top:10px;padding:10px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.03);display:flex;flex-direction:column;gap:8px}
 .device-panel label{font-size:.8rem;color:var(--dim);font-weight:700}
 .device-panel select{width:100%;padding:9px 10px;background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:'Rajdhani'}
 .relay-toggle{display:flex;align-items:center;gap:8px;font-size:.85rem;color:var(--text)}
 .show-count{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:700;pointer-events:none}
 .show-box{display:flex;flex-direction:column;align-items:center;gap:6px;padding:28px 46px;border-radius:24px;background:linear-gradient(120deg,rgba(255,45,149,.92),rgba(123,43,255,.92),rgba(0,217,255,.92));background-size:200%;animation:lvlShine 1.2s linear infinite,heroPulse 1s infinite;box-shadow:0 0 40px rgba(255,45,149,.7);color:#fff;text-align:center}
 .show-title{font-family:'Orbitron';font-weight:900;font-size:1.4rem;letter-spacing:2px}
 .show-num{font-family:'Orbitron';font-size:4rem;font-weight:900;animation:heroPulse .9s infinite}
 .call-chat{margin-top:10px;border:1px solid var(--border);border-radius:12px;overflow:hidden}
 .call-chat-list{max-height:120px;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:6px;background:rgba(255,255,255,.03)}
 .call-chat-list .cc{padding:6px 10px;border-radius:10px;font-size:.85rem;max-width:85%}
 .call-chat-list .cc.me{align-self:flex-end;background:var(--gradient);color:#04060c}
 .call-chat-list .cc.them{align-self:flex-start;background:rgba(255,255,255,.1)}
 .call-chat-input{display:flex;gap:6px;padding:6px;border-top:1px solid var(--border)}
 .call-chat-input input{flex:1;padding:8px 10px;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:'Rajdhani'}
 .incoming-call{position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:600;background:var(--card-2);border:2px solid var(--success);border-radius:18px;padding:14px 20px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 40px rgba(0,255,157,.35);animation:proxIn .4s;max-width:92vw}
 .incoming-call b{display:block}
 .am-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:10px}
 .am-tile{position:relative;background:#000;border-radius:12px;overflow:hidden;aspect-ratio:4/3}
 .am-tile video{width:100%;height:100%;object-fit:cover}
 .am-tile span{position:absolute;top:6px;left:8px;background:rgba(0,0,0,.6);padding:2px 8px;border-radius:999px;font-size:.72rem}`;document.head.appendChild(st);
 const mc=document.querySelector('#modal-call .modal-content');
 if(mc)mc.innerHTML=`
  <div class="call-info"><span id="callTimer">00:00</span><span id="peerVip"></span><span id="chatState" class="chat-state">💬 Chat no conectado</span><span id="callCost">◈ 0.00</span></div>
  <div id="lowTimeBanner" class="low-time hidden">⏳ Se terminará en <b id="lowTimeSec">10</b> s por saldo</div>
  <div class="video-wrap"><video id="remoteVideo" autoplay playsinline></video><video id="localVideo" autoplay playsinline muted></video>
   <div id="callStatusMsg" class="dim">🎥 Conectando video…</div>
   <div id="netHint" class="net-hint hidden">📶 Red difícil: prueba 🔀 Forzar relay en ⚙️ o cambia de red.</div></div>
  <div class="call-controls">
   <button id="btnMic" class="btn-small" onclick="toggleMic()">🎤</button>
   <button id="btnCam" class="btn-small" onclick="toggleCam()">📷</button>
   <button id="btnFlip" class="btn-small" onclick="flipCamera()">🔄</button>
   <button id="btnSvc" class="btn-small" onclick="openServiceForm()">💫 Servicio</button>
   <button id="btnDev" class="btn-small" onclick="toggleDevicePanel()">⚙️</button>
   <button id="btnReport" class="btn-small" onclick="reportCall()">🚩</button>
   <button id="btnBlock" class="btn-small" onclick="blockPeer()">🚫</button>
   <button class="btn-small danger" onclick="endWebCall()">📞</button></div>
  <div id="devicePanel" class="device-panel hidden">
   <label>📷 Cámara</label><select id="selCam" onchange="changeCam(this.value)"></select>
   <label>🎤 Micrófono</label><select id="selMic" onchange="changeMic(this.value)"></select>
   <label class="relay-toggle"><input type="checkbox" id="relayForce" onchange="setForceRelay(this.checked)"> 🔀 Forzar relay (TURN) para redes difíciles</label>
  </div>
  <div class="call-chat"><div id="callChatList" class="call-chat-list"></div><div class="call-chat-input"><input id="callChatInput" placeholder="Mensaje en la llamada…" onkeypress="if(event.key==='Enter')sendCallChat()"><button class="btn-small" onclick="sendCallChat()">➤</button></div></div>`;}
function armAutoUnmute(){const u=()=>{const rv=document.getElementById('remoteVideo');if(rv){rv.muted=false;rv.play().catch(()=>{});}window.removeEventListener('pointerdown',u,true);window.removeEventListener('keydown',u,true);};window.addEventListener('pointerdown',u,true);window.addEventListener('keydown',u,true);}
function playRemoteNow(){const rv=document.getElementById('remoteVideo');if(!rv)return;rv.muted=false;rv.play().catch(()=>armAutoUnmute());}
function armNetworkWatch(){if(netListenersOn)return;netListenersOn=true;const onChange=()=>{if(callRoom){setStatus('🔄 Cambió la red: reconectando…');forceReconnect();}};try{if(navigator.connection)navigator.connection.addEventListener('change',onChange);}catch(e){}window.addEventListener('online',onChange);window.addEventListener('offline',onChange);}
function toggleDevicePanel(){const p=document.getElementById('devicePanel');if(!p)return;if(!p.classList.toggle('hidden'))populateDevices();}
async function populateDevices(){try{const devs=await navigator.mediaDevices.enumerateDevices();const cams=devs.filter(d=>d.kind==='videoinput');const mics=devs.filter(d=>d.kind==='audioinput');const sc=document.getElementById('selCam'),sm=document.getElementById('selMic');if(sc)sc.innerHTML=cams.map((c,i)=>`<option value="${c.deviceId}" ${c.deviceId===currentDeviceId?'selected':''}>${c.label||('Cámara '+(i+1))}</option>`).join('');if(sm)sm.innerHTML=mics.map((m,i)=>`<option value="${m.deviceId}" ${m.deviceId===currentMicId?'selected':''}>${m.label||('Micrófono '+(i+1))}</option>`).join('');const rf=document.getElementById('relayForce');if(rf)rf.checked=(currentPolicy==='relay');}catch(e){}}
async function changeCam(id){if(!id||!pc||!localStream)return;try{const ns=await navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:id}},audio:false});applyVideoTrack(ns.getVideoTracks()[0]);showToast('📷 Cámara cambiada');}catch(e){showToast('❌ No se pudo');}}
async function changeMic(id){if(!id||!pc||!localStream)return;try{const ns=await navigator.mediaDevices.getUserMedia({audio:{deviceId:{exact:id}},video:false});applyAudioTrack(ns.getAudioTracks()[0]);showToast('🎤 Micrófono cambiado');}catch(e){showToast('❌ No se pudo');}}
function applyVideoTrack(nt){currentDeviceId=nt.getSettings?.().deviceId||nt.id;const ot=localStream.getVideoTracks()[0];if(ot){ot.stop();localStream.removeTrack(ot);}localStream.addTrack(nt);const lv=document.getElementById('localVideo');if(lv){lv.srcObject=localStream;lv.play().catch(()=>{});}const s=pc.getSenders().find(s=>s.track&&s.track.kind==='video');if(s)s.replaceTrack(nt);}
function applyAudioTrack(nt){currentMicId=nt.getSettings?.().deviceId||nt.id;const ot=localStream.getAudioTracks()[0];if(ot){ot.stop();localStream.removeTrack(ot);}localStream.addTrack(nt);const s=pc.getSenders().find(s=>s.track&&s.track.kind==='audio');if(s)s.replaceTrack(nt);}
async function showIncomingCall(row){ensureCallUI();const{data:c}=await db.from('profiles').select('full_name, model_name, tokens_balance').eq('id',row.client_id).single();const box=document.getElementById('incomingCall');if(!box)return;box.classList.remove('hidden');box.innerHTML=`<div><b>📞 ${c?.model_name||c?.full_name||'Llamada'}</b><small>◈ ${row.rate_per_minute}/min (tú ganas) · ${userLevelBadge(c?.tokens_balance)}</small></div><button class="btn-small success" onclick="acceptIncoming('${row.room_id}',${row.rate_per_minute},'${row.id}')">✅</button><button class="btn-small danger" onclick="rejectIncoming('${row.id}')">❌</button>`;startRing();}
async function acceptIncoming(room,rate,rowId){stopRing();document.getElementById('incomingCall').classList.add('hidden');await joinWebCall(room,{rate:parseFloat(rate)||0,rowId,asClient:false});}
async function rejectIncoming(rowId){stopRing();document.getElementById('incomingCall').classList.add('hidden');await db.from('video_calls').update({status:'ended',ended_at:new Date().toISOString(),ended_by:'worker'}).eq('id',rowId);}
function remoteHungUp(row){stopRing();const wasClient=iAmClientFlag;const peer=callPeerId;if(callRoom&&row.room_id===callRoom){showToast('📞 La otra persona colgó');cleanupCall();if(wasClient&&peer)showRatingModal(peer,row.room_id);}}
async function startWebCall(room,opts={}){await beginCall(room,opts,true);}
async function joinWebCall(room,opts={}){await beginCall(room,opts,false);}
async function beginCall(room,opts,initiator){ensureCallUI();armNetworkWatch();if(pc)teardownPC();clearHello();clearAck();clearOffer();hideLow();callRoom=room;callRowId=opts.rowId||null;callRate=parseFloat(opts.rate)||0;iAmClientFlag=!!opts.asClient;isInitiatorFlag=!!initiator;callPeerId=null;callCostTotal=0;callEarnTotal=0;callSeconds=0;callSetupDone=false;facingMode='user';offerSent=false;pendingCandidates=[];policyAttempt=0;currentPolicy='all';peerPresent=false;gotAnswer=false;gotOffer=false;lastReconnectAt=0;callStartAt=Date.now();micOn=true;camOn=true;clientBalanceLocal=parseFloat(currentProfile.tokens_balance||0);
 await resolveTurnServers();
 const bm=document.getElementById('btnMic');if(bm){bm.textContent='🎤';bm.classList.remove('off');}
 const bc=document.getElementById('btnCam');if(bc){bc.textContent='📷';bc.classList.remove('off');}
 const bs=document.getElementById('btnSvc');if(bs)bs.style.display=iAmClientFlag?'none':'';
 document.getElementById('callTimer').textContent='00:00';
 const pv0=document.getElementById('peerVip');if(pv0)pv0.innerHTML='';
 const cs=document.getElementById('callCost');if(cs){if(iAmClientFlag){cs.style.display='none';}else{cs.style.display='';cs.style.color='var(--success)';cs.textContent='+◈ 0.00';}}
 setChatState('💬 Chat no conectado',false);showNetHint(false);setStatus('📷 Solicitando cámara…');document.getElementById('callChatList').innerHTML='';document.getElementById('devicePanel')?.classList.add('hidden');hideSvcBanner();openModal('modal-call');
 loadPeerVip(callRowId);
 try{localStream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30},facingMode:{ideal:'user'}},audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}
 catch(e){try{localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});}catch(e2){showToast('❌ Permiso denegado');closeModal('modal-call');return;}}
 currentDeviceId=localStream.getVideoTracks()[0]?.getSettings?.().deviceId||null;currentMicId=localStream.getAudioTracks()[0]?.getSettings?.().deviceId||null;
 const lv=document.getElementById('localVideo');lv.srcObject=localStream;lv.muted=true;lv.classList.remove('camoff');lv.play().catch(()=>{});
 setStatus(isInitiatorFlag?'⏳ Llamando… espera respuesta':'📞 Contestando…');
 callChannel=db.channel('call_'+room)
  .on('broadcast',{event:'signal'},({payload})=>handleSignal(payload))
  .on('broadcast',{event:'chatmsg'},({payload})=>appendCallChat(payload.text,false))
  .on('broadcast',{event:'svcreq'},({payload})=>{if(iAmClientFlag)showSvcBanner(payload);})
  .on('broadcast',{event:'svcdecision'},({payload})=>{if(!iAmClientFlag){if(payload.status==='accepted'){showToast('✅ Cliente pagó el servicio');startShowCountdown();}else showToast('❌ El cliente canceló el servicio');}})
  .on('broadcast',{event:'hangup'},()=>{const wasClient=iAmClientFlag;const peer=callPeerId;showToast('📞 La otra persona colgó');cleanupCall();if(wasClient&&peer)showRatingModal(peer,room);});
 callChannel.subscribe(async s=>{if(s!=='SUBSCRIBED'||callSetupDone)return;callSetupDone=true;createPC(currentPolicy);startHelloLoop();startWatchdog();});}
function startHelloLoop(){clearHello();send({type:'hello'});helloTimer=setInterval(()=>{if(!peerPresent)send({type:'hello'});else clearHello();},1000);}
function startAckLoop(){clearAck();send({type:'helloAck'});ackTimer=setInterval(()=>{if(!gotOffer)send({type:'helloAck'});else clearAck();},1000);}
function startOfferLoop(){if(offerTimer)return;createOffer();offerTimer=setInterval(()=>{if(!gotAnswer)createOffer();else clearOffer();},1500);}
function teardownPC(){if(pc){try{pc.close();}catch(e){}pc=null;}offerSent=false;pendingCandidates=[];}
function createPC(policy){currentPolicy=policy||'all';teardownPC();pc=new RTCPeerConnection({iceServers:buildIce(),iceCandidatePoolSize:6,iceTransportPolicy:currentPolicy});localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));pc.ontrack=e=>{const rv=document.getElementById('remoteVideo');if(rv){rv.srcObject=e.streams[0];playRemoteNow();}};pc.onicecandidate=e=>{if(e.candidate)send({type:'ice',candidate:e.candidate});};pc.oniceconnectionstatechange=()=>{const s=pc.iceConnectionState;if(s==='checking')setStatus('🎥 Conectando video…');if(s==='disconnected'){try{pc.restartIce();}catch(e){}setStatus('🟡 Estabilizando…');}if(s==='failed')queueReconnect(600);};pc.onconnectionstatechange=()=>{const st=pc.connectionState;if(st==='connected'){setStatus(currentPolicy==='relay'?'🟢 Video conectado (relay)':'🟢 Video conectado');showNetHint(false);tuneBitrateAdaptive();playRemoteNow();const lv=document.getElementById('localVideo');if(lv)lv.play().catch(()=>{});startCallClock();}else if(st==='failed')queueReconnect(600);else if(st==='closed'&&callRoom){showToast('📞 Llamada finalizada');cleanupCall();}};}
function forceReconnect(){if(!callRoom)return;gotAnswer=false;gotOffer=false;pendingCandidates=[];resolveTurnServers().then(()=>{createPC(currentPolicy);startHelloLoop();if(isInitiatorFlag)setTimeout(()=>{if(peerPresent&&!gotAnswer)startOfferLoop();},800);});}
function queueReconnect(d){const now=Date.now();if(now-lastReconnectAt<1500)return;lastReconnectAt=now;policyAttempt++;currentPolicy=(policyAttempt%2===1)?'relay':'all';setStatus(currentPolicy==='relay'?'🟡 Reintentando vía relay (TURN)…':'🟡 Reintentando…');setTimeout(()=>{if(callRoom)forceReconnect();},d||800);}
function startWatchdog(){if(watchdog)return;watchdog=setInterval(()=>{if(!callRoom||!pc)return;if(pc.connectionState!=='connected'){if(Date.now()-callStartAt>12000)showNetHint(true);const now=Date.now();if(now-lastReconnectAt>5000){lastReconnectAt=now;policyAttempt++;currentPolicy=(policyAttempt%2===1)?'relay':'all';setStatus(currentPolicy==='relay'?'🟡 Reintentando vía relay (TURN)…':'🟡 Reintentando…');forceReconnect();}}else showNetHint(false);},5000);}
function send(msg){if(callChannel)callChannel.send({type:'broadcast',event:'signal',payload:Object.assign({from:currentUser.id},msg)});}
function flushCandidates(){while(pendingCandidates.length&&pc){const c=pendingCandidates.shift();pc.addIceCandidate(c).catch(()=>{});}}
async function createOffer(){if(!pc)return;offerSent=true;try{const o=await pc.createOffer();await pc.setLocalDescription(o);send({type:'description',sdp:pc.localDescription});}catch(e){offerSent=false;}}
async function handleSignal(p){if(!p||p.from===currentUser.id)return;
 if(p.silent&&p.type==='hello'){setupMonitorFor(p.from);return;}
 if(p.type==='bye-monitor'){if(monPc){monPc.close();monPc=null;}return;}
 if(p.type==='lowtime'){showLow(p.seconds);return;}
 if(p.mon){if(p.to!==currentUser.id)return;if(p.type==='mon-answer'){monPc?.setRemoteDescription(p.sdp).catch(()=>{});return;}if(p.type==='mon-ice'){monPc?.addIceCandidate(p.candidate).catch(()=>{});return;}return;}
 if(p.type==='hello'||p.type==='helloAck'){const was=peerPresent;peerPresent=true;clearHello();if(!was)setChatState('💬 Chat conectado',true);if(!pc||pc.connectionState==='failed'||pc.connectionState==='closed')createPC(currentPolicy);if(p.type==='hello'&&!isInitiatorFlag){if(!gotOffer)startAckLoop();}if(isInitiatorFlag)startOfferLoop();return;}
 if(!pc)return;
 if(p.type==='description'){try{if(p.sdp.type==='offer'&&!isInitiatorFlag){gotOffer=true;clearAck();await pc.setRemoteDescription(p.sdp);flushCandidates();const a=await pc.createAnswer();await pc.setLocalDescription(a);send({type:'description',sdp:pc.localDescription});}else if(p.sdp.type==='answer'&&isInitiatorFlag){if(!gotAnswer){gotAnswer=true;clearOffer();await pc.setRemoteDescription(p.sdp);flushCandidates();}}}catch(e){}return;}
 if(p.type==='ice'){if(pc.remoteDescription)pc.addIceCandidate(p.candidate).catch(()=>{});else pendingCandidates.push(p.candidate);}}
function setupMonitorFor(adminId){if(monPc||!localStream||!callChannel)return;monPc=new RTCPeerConnection({iceServers:buildIce()});localStream.getTracks().forEach(t=>monPc.addTrack(t,localStream));monPc.onicecandidate=e=>{if(e.candidate&&callChannel)callChannel.send({type:'broadcast',event:'signal',payload:{from:currentUser.id,to:adminId,mon:true,type:'mon-ice',candidate:e.candidate}});};monPc.createOffer().then(o=>monPc.setLocalDescription(o)).then(()=>{if(callChannel)callChannel.send({type:'broadcast',event:'signal',payload:{from:currentUser.id,to:adminId,mon:true,type:'mon-offer',sdp:monPc.localDescription}});}).catch(()=>{});}
function ensureAmModal(){if(document.getElementById('amModal'))return;const m=document.createElement('div');m.id='amModal';m.className='modal hidden';m.innerHTML=`<div class="modal-content wide"><div class="modal-head"><h3>👁 Supervisión en vivo</h3><button class="modal-close" onclick="stopAdminMonitor()">✕</button></div><div id="amGrid" class="am-grid"></div></div>`;document.body.appendChild(m);}
function amAddTile(id,name){const g=document.getElementById('amGrid');if(!g||g.querySelector('[data-tile="'+id+'"]'))return;g.insertAdjacentHTML('beforeend',`<div class="am-tile" data-tile="${id}"><video autoplay playsinline muted></video><span>${name}</span></div>`);}
function amSetTileVideo(id,stream){const t=document.querySelector('[data-tile="'+id+'"] video');if(t)t.srcObject=stream;}
async function startAdminMonitor(roomId){ensureAmModal();stopAdminMonitor(true);const{data:row}=await db.from('video_calls').select('*, c:profiles!video_calls_client_id_fkey(full_name,model_name), w:profiles!video_calls_worker_id_fkey(full_name,model_name)').eq('room_id',roomId).single();monChannel=db.channel('call_'+roomId).on('broadcast',{event:'signal'},({payload})=>handleMonSignal(payload));await new Promise(res=>monChannel.subscribe(s=>{if(s==='SUBSCRIBED')res();}));document.getElementById('amGrid').innerHTML='';if(row){amAddTile(row.client_id,row.c?.model_name||row.c?.full_name||'Cliente');amAddTile(row.worker_id,row.w?.model_name||row.w?.full_name||'Modelo');}openModal('amModal');monChannel.send({type:'broadcast',event:'signal',payload:{from:currentUser.id,type:'hello',silent:true}});}
async function handleMonSignal(p){if(!p||p.from===currentUser.id)return;if(p.mon&&p.to===currentUser.id){if(p.type==='mon-offer'){const npc=new RTCPeerConnection({iceServers:buildIce()});monPcs[p.from]=npc;npc.onicecandidate=e=>{if(e.candidate&&monChannel)monChannel.send({type:'broadcast',event:'signal',payload:{from:currentUser.id,to:p.from,mon:true,type:'mon-ice',candidate:e.candidate}});};npc.ontrack=e=>amSetTileVideo(p.from,e.streams[0]);await npc.setRemoteDescription(p.sdp);const a=await npc.createAnswer();await npc.setLocalDescription(a);monChannel.send({type:'broadcast',event:'signal',payload:{from:currentUser.id,to:p.from,mon:true,type:'mon-answer',sdp:npc.localDescription}});}else if(p.type==='mon-ice'){monPcs[p.from]?.addIceCandidate(p.candidate).catch(()=>{});}}}
function stopAdminMonitor(keepModal){if(monChannel){try{monChannel.send({type:'broadcast',event:'signal',payload:{from:currentUser.id,type:'bye-monitor'}});}catch(e){}try{db.removeChannel(monChannel);}catch(e){}monChannel=null;}Object.values(monPcs).forEach(p=>{try{p.close();}catch(e){}});monPcs={};if(!keepModal)closeModal('amModal');}
async function flipCamera(){if(!localStream||!pc)return;let cams=[];try{cams=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');}catch(e){}if(cams.length<2){showToast('❌ Una sola cámara');return;}facingMode=facingMode==='user'?'environment':'user';const others=cams.filter(c=>c.deviceId!==currentDeviceId);let ns=null;for(const c of others){try{ns=await navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:c.deviceId}},audio:false});break;}catch(e){}}if(!ns){try{ns=await navigator.mediaDevices.getUserMedia({video:{facingMode:{exact:facingMode}},audio:false});}catch(e){}}if(!ns){try{ns=await navigator.mediaDevices.getUserMedia({video:{facingMode:facingMode},audio:false});}catch(e){}}if(!ns){showToast('❌ No se pudo; usa ⚙️');return;}const nt=ns.getVideoTracks()[0];const nid=nt.getSettings?.().deviceId||null;if(nid&&nid===currentDeviceId){showToast('❌ No cambió; usa ⚙️');return;}applyVideoTrack(nt);showToast(facingMode==='environment'?'🔄 Trasera':'🔄 Frontal');}
function toggleMic(){const t=localStream?.getAudioTracks()[0];if(!t)return;micOn=!micOn;t.enabled=micOn;const b=document.getElementById('btnMic');if(b){b.classList.toggle('off',!micOn);}showToast(micOn?'🎤 Te escuchan':'🔇 Silenciado');}
function toggleCam(){const t=localStream?.getVideoTracks()[0];if(!t)return;camOn=!camOn;t.enabled=camOn;const lv=document.getElementById('localVideo');if(lv)lv.classList.toggle('camoff',!camOn);const b=document.getElementById('btnCam');if(b){b.classList.toggle('off',!camOn);}showToast(camOn?'📷 Encendida':'🚫 Apagada');}
function appendCallChat(t,mine){const l=document.getElementById('callChatList');if(!l)return;l.insertAdjacentHTML('beforeend',`<div class="cc ${mine?'me':'them'}">${t}</div>`);l.scrollTop=l.scrollHeight;}
function sendCallChat(){const i=document.getElementById('callChatInput');if(!i)return;const t=i.value.trim();if(!t||!callChannel)return;i.value='';appendCallChat(t,true);callChannel.send({type:'broadcast',event:'chatmsg',payload:{from:currentUser.id,text:t}});}
function startCallClock(){if(callClock)return;callClock=setInterval(async()=>{callSeconds++;const t=document.getElementById('callTimer');if(t)t.textContent=String(Math.floor(callSeconds/60)).padStart(2,'0')+':'+String(callSeconds%60).padStart(2,'0');
 const clientPerSec=callRate*2/60,workerPerSec=callRate/60;
 callCostTotal+=clientPerSec;callEarnTotal+=workerPerSec;
 if(!iAmClientFlag){const cs=document.getElementById('callCost');if(cs)cs.textContent='+◈ '+callEarnTotal.toFixed(3);}
 if(iAmClientFlag){clientBalanceLocal-=clientPerSec;const remSec=Math.floor(clientBalanceLocal/clientPerSec);if(remSec<=10&&remSec>0){send({type:'lowtime',seconds:remSec});showLow(remSec);}}
 if(callRowId&&callSeconds%5===0){
   const{data:nb,error}=await db.rpc('tick_call',{p_call:callRowId,p_seconds:5});
   if(error||nb===-1){showToast('❌ Saldo insuficiente para continuar');await doFinish(iAmClientFlag?'client':'worker');return;}
   if(iAmClientFlag){currentProfile.tokens_balance=nb;clientBalanceLocal=nb;updateHeader();}
   tuneBitrateAdaptive();
 }},1000);}
async function doFinish(endedBy){if(callRowId){await db.rpc('finish_call',{p_call:callRowId,p_seconds:callSeconds%5,p_ended_by:endedBy});}cleanupCall();}
async function finishAndClose(){await doFinish(iAmClientFlag?'client':'worker');}
async function endWebCall(){stopRing();const wasClient=iAmClientFlag;const peer=callPeerId;const room=callRoom;
 if(callChannel){try{callChannel.send({type:'broadcast',event:'hangup',payload:{from:currentUser.id}});}catch(e){}}
 if(monPc){monPc.close();monPc=null;}
 await doFinish(wasClient?'client':'worker');
 showToast('📞 Llamada finalizada');
 if(wasClient&&peer)showRatingModal(peer,room);}
function cleanupCall(){stopRing();hideLow();hideSvcBanner();if(callClock){clearInterval(callClock);callClock=null;}if(watchdog){clearInterval(watchdog);watchdog=null;}clearHello();clearAck();clearOffer();teardownPC();if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;}if(callChannel){try{db.removeChannel(callChannel);}catch(e){}callChannel=null;}callRoom=null;callRowId=null;callSetupDone=false;showNetHint(false);closeModal('modal-call');}
