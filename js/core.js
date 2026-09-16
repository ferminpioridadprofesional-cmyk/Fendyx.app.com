'use strict';
let currentUser = null, currentProfile = null, roleDetails = null, myLocation = null;
let cart = { restId: null, items: [] };
let liveChannel = null;
const loadedScripts = {};
const WORKER_LEVELS = [
  { n: 1, name: 'Bronce', rate: 0.2 },
  { n: 2, name: 'Plata', rate: 0.7 },
  { n: 3, name: 'Oro', rate: 1.2 },
  { n: 4, name: 'Platino', rate: 2.0 },
  { n: 5, name: 'Diamante', rate: 3.0 }
];
function levelInfo(n) { return WORKER_LEVELS.find(l => l.n === parseInt(n)) || WORKER_LEVELS[0]; }

document.addEventListener('DOMContentLoaded', async () => {
  initPWA();
  await loadBranding();
  const isApp = !!document.getElementById('section-dashboard');
  const { data: { session } } = await db.auth.getSession();
  if (isApp) {
    if (!session) { location.replace('index.html'); return; }
    currentUser = session.user;
    await enterApp();
  } else if (session) { location.replace('app.html'); }
});

function initPWA() {
  if (!document.querySelector('link[rel="manifest"]')) {
    const l = document.createElement('link'); l.rel = 'manifest'; l.href = 'manifest.json'; document.head.appendChild(l);
    const m = document.createElement('meta'); m.name = 'theme-color'; m.content = '#00d9ff'; document.head.appendChild(m);
    const a = document.createElement('link'); a.rel = 'apple-touch-icon'; a.href = 'icons/icon.svg'; document.head.appendChild(a);
    const t = document.createElement('meta'); t.name = 'mobile-web-app-capable'; t.content = 'yes'; document.head.appendChild(t);
    const v = document.createElement('meta'); v.name = 'apple-mobile-web-app-status-bar-style'; v.content = 'black-translucent'; document.head.appendChild(v);
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.type === 'SW_UPDATED') showToast('🔄 Nueva versión disponible, recarga');
    });
  }
}

async function enterApp() {
  try {
    await loadProfile();
    if (!currentProfile) await repairProfile();
    if (!currentProfile) { await db.auth.signOut(); location.replace('index.html'); return; }
    if (currentProfile.is_banned) {
      localStorage.setItem('fendyx_ban_reason', currentProfile.ban_reason || 'Sin razón especificada');
      await db.auth.signOut();
      location.replace('index.html?banned=1');
      return;
    }
    injectDynamicUI();
    await ensureRoleDetails();
    // Si eres trabajadora remota, precargar calls.js para que el timbre funcione desde cualquier sección
    if (currentProfile.role === 'remote_worker' && currentProfile.kyc_status === 'approved') {
      loadScript('calls.js');
    }
    updateHeader(); loadModules();
    // Restaurar sección desde localStorage (compatible con iOS Safari y PWA)
    const last = localStorage.getItem('fendyx_last_section');
    const valid = last && LOADERS[last] && (
      (last !== 'delivery' || currentProfile.role === 'delivery') &&
      (last !== 'girls' || currentProfile.role !== 'remote_worker') &&
      (last !== 'kyc' || currentProfile.role === 'remote_worker') &&
      (last !== 'admin' || currentProfile.role === 'admin')
    );
    showSection(valid ? last : 'dashboard');
    startRealtime();
  } catch (e) { console.error(e); showToast('⚠️ Error de carga: ' + e.message); }
}

async function repairProfile() {
  const { data } = await db.from('profiles').select('*').eq('id', currentUser.id).single();
  if (data) { currentProfile = data; return; }
  const meta = JSON.parse(localStorage.getItem('fendyx_pending_meta') || '{}');
  const { data: created, error } = await db.from('profiles').insert({
    id: currentUser.id, email: currentUser.email,
    full_name: meta.full_name || currentUser.email?.split('@')[0] || 'Usuario',
    role: meta.role || 'user', age: meta.age || null, gender: meta.gender || null,
    referral_code: (currentUser.id || '').replace(/-/g, '').slice(0, 8).toUpperCase(),
    tokens_balance: 0, is_active: false
  }).select().single();
  if (!error) currentProfile = created;
}

async function loadProfile() {
  const { data } = await db.from('profiles').select('*').eq('id', currentUser.id).single();
  currentProfile = data;
  const { data: rd } = await db.from('role_details').select('*').eq('user_id', currentUser.id).single();
  roleDetails = rd;
}
async function ensureRoleDetails() {
  if (roleDetails) return;
  const meta = JSON.parse(localStorage.getItem('fendyx_pending_meta') || '{}');
  const { data } = await db.from('role_details').insert({
    user_id: currentUser.id, role_type: currentProfile.role,
    rif: meta.rif || null, business_name: meta.business_name || null, address: meta.address || null,
    license_number: meta.license || null, vehicle_plate: meta.plate || null, vehicle_type: meta.vehicle || null,
    specialty: meta.specialty || null, bio: meta.bio || null,
    rate_per_minute: currentProfile.role === 'remote_worker' ? 0.2 : null
  }).select().single();
  roleDetails = data;
  localStorage.removeItem('fendyx_pending_meta');
}

async function loadBranding() {
  const { data } = await db.from('app_branding').select('*').eq('id', 1).single();
  if (!data) return;
  const setLogo = (i, f) => { const img = document.getElementById(i), fl = document.getElementById(f); if (!img || !fl) return;
    if (data.logo_url) { img.src = data.logo_url; img.style.display = 'inline-block'; fl.style.display = 'none'; }
    else { img.style.display = 'none'; fl.style.display = 'block'; } };
  setLogo('authLogo', 'authLogoFallback'); setLogo('headerLogo', 'headerLogoFallback'); setLogo('adminLogoPreview', 'adminLogoFallback');
  const n = data.app_name || 'FENDYX';
  ['authAppName', 'headerAppName'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = n; });
  const an = document.getElementById('adminAppName'); if (an && !an.value) an.value = n;
}

function injectDynamicUI() {
  if (document.getElementById('fendyx-extra-style')) return;
  const st = document.createElement('style');
  st.id = 'fendyx-extra-style';
  st.textContent = `
    .activation-banner{position:fixed;top:62px;left:0;right:0;z-index:115;background:linear-gradient(100deg,rgba(255,176,32,.96),rgba(255,59,107,.92));color:#04060c;padding:10px 16px;font-weight:700;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;text-align:center}
    body.has-banner .app-main{padding-top:130px}
    .kyc-img{width:120px;height:85px;object-fit:cover;border-radius:10px;border:1px solid var(--border-strong);margin:4px;cursor:pointer}
    .ref-code{font-family:'Orbitron';letter-spacing:3px;color:var(--primary);font-weight:900}
    .panic-fab{position:fixed;right:20px;bottom:170px;z-index:160;width:56px;height:56px;border-radius:50%;border:2px solid #ff3b6b;background:rgba(255,59,107,.18);color:#ff3b6b;font-size:1.4rem;cursor:pointer;backdrop-filter:blur(8px);animation:pulse 2.5s infinite}
    .incoming-call{position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:600;background:var(--card-2);border:2px solid var(--success);border-radius:18px;padding:14px 20px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 40px rgba(0,255,157,.35);animation:proxIn .4s;max-width:92vw}
    .incoming-call b{display:block}`;
  document.head.appendChild(st);

  const banner = document.createElement('div');
  banner.id = 'activationBanner'; banner.className = 'activation-banner hidden';
  banner.innerHTML = `⚠️ <b>Cuenta inactiva.</b> Solicita una recarga (mín 3) y espera verificación. <button class="btn-small success" onclick="showSection('tokens')">Recargar</button>`;
  document.querySelector('.app-header').after(banner);

  const panic = document.createElement('button');
  panic.id = 'panicBtn'; panic.className = 'panic-fab'; panic.textContent = '🆘';
  panic.title = 'Botón de pánico';
  panic.onclick = () => sendPanic('general');
  document.body.appendChild(panic);

  // Banner GLOBAL de llamada entrante (siempre en el DOM, funciona desde cualquier sección)
  if (!document.getElementById('incomingCall')) {
    const inc = document.createElement('div');
    inc.id = 'incomingCall'; inc.className = 'incoming-call hidden';
    document.body.appendChild(inc);
  }

  const girls = document.createElement('section');
  girls.id = 'section-girls'; girls.className = 'app-section';
  girls.innerHTML = `<div class="section-header"><h2>💃 Videollamada con chicas</h2><button class="btn-back" onclick="showSection('dashboard')">← Volver</button></div>
    <p class="dim">Chicas +18 verificadas por FENDYX (cédula + rostro + WhatsApp). Tarifa por nivel: ◈ 0.2 – 3 por minuto.</p>
    <div id="girlsGrid" class="cards-grid"></div>`;
  document.querySelector('.app-main').appendChild(girls);

  const kyc = document.createElement('section');
  kyc.id = 'section-kyc'; kyc.className = 'app-section';
  kyc.innerHTML = `<div class="section-header"><h2>🪪 Mi Verificación</h2><button class="btn-back" onclick="showSection('dashboard')">← Volver</button></div>
    <div id="kycStatusBox" class="owner-panel"></div>
    <form class="owner-panel owner-form" onsubmit="submitKycDocs(event)">
      <input type="text" id="kycWhatsapp" placeholder="WhatsApp (ej: +58 414 1234567)" required>
      <label class="dim">📄 Foto de tu cédula (legible)</label>
      <input type="file" id="kycIdCard" accept="image/*" required>
      <label class="dim">🤳 Foto reciente de tu rostro (sin filtros ni gafas)</label>
      <input type="file" id="kycFace" accept="image/*" required>
      <button type="submit" class="btn-primary">Enviar para verificación</button>
    </form>`;
  document.querySelector('.app-main').appendChild(kyc);

  const mc = document.querySelector('#modal-recharge .modal-content');
  if (mc) mc.innerHTML = `
    <div class="modal-head"><h3>◈ Solicitar recarga</h3><button class="modal-close" onclick="closeModal('modal-recharge')">✕</button></div>
    <p class="dim">El pago lo verifica el administrador (o el bot Binance al activarse). Mínimo 3 tokens ($3).</p>
    <div class="owner-form">
      <input type="number" id="reqAmount" placeholder="Monto a recargar (mín 3)" min="3">
      <select id="reqMethod">
        <option value="binance">🪙 Binance Pay (manual hasta activar bot)</option>
        <option value="pago_movil">📱 Pago Móvil</option>
        <option value="zelle">💵 Zelle</option>
      </select>
      <input type="text" id="reqRef" placeholder="Nº de referencia / hash de transacción">
      <label class="dim">📸 Captura del pago realizado</label>
      <input type="file" id="reqProof" accept="image/*">
      <button type="button" class="btn-primary" onclick="submitRechargeRequest()">Enviar a verificación</button>
    </div>
    <h4 class="sub-title">Mis solicitudes</h4>
    <div id="myRechargeList" class="list-compact"></div>`;
  const recBtn = document.querySelector('#section-tokens .row-buttons .btn-primary');
  if (recBtn) recBtn.onclick = async () => { openModal('modal-recharge'); await loadScript('tokens.js'); loadMyRecharges(); };

  const tabs = document.querySelector('.admin-tabs');
  if (tabs && !tabs.querySelector('[data-workers-tab]')) {
    tabs.insertAdjacentHTML('beforeend', `<button class="admin-tab" data-workers-tab onclick="switchAdminTab('workers',this)">💃 Trabajadoras</button>`);
    const panel = document.createElement('div');
    panel.id = 'admin-workers'; panel.className = 'admin-panel';
    panel.innerHTML = `<p class="dim">Asigna nivel (1-5) o tarifa personalizada (0.2 – 3 $/min).</p><div id="adminWorkersList" class="list-compact"></div>`;
    document.getElementById('section-admin').appendChild(panel);
  }
  if (tabs && !tabs.querySelector('[data-recharges-tab]')) {
    tabs.insertAdjacentHTML('beforeend', `<button class="admin-tab" data-recharges-tab onclick="switchAdminTab('recharges',this)">💳 Recargas</button>`);
    const panel2 = document.createElement('div');
    panel2.id = 'admin-recharges'; panel2.className = 'admin-panel';
    panel2.innerHTML = `<p class="dim">Verifica que el monto exacto llegó antes de aprobar.</p><div id="rechargeRequestsList" class="list-compact"></div>`;
    document.getElementById('section-admin').appendChild(panel2);
  }
  if (tabs && !tabs.querySelector('[data-safety-tab]')) {
    tabs.insertAdjacentHTML('beforeend', `<button class="admin-tab" data-safety-tab onclick="switchAdminTab('safety',this)">🚨 Seguridad</button>`);
    const panel3 = document.createElement('div');
    panel3.id = 'admin-safety'; panel3.className = 'admin-panel';
    panel3.innerHTML = `<h3 class="sub-title">🆘 Alertas de pánico</h3><div id="panicList" class="list-compact"></div>
      <h3 class="sub-title">🚩 Reportes y auto-moderación</h3><div id="reportsList" class="list-compact"></div>`;
    document.getElementById('section-admin').appendChild(panel3);
  }
}

async function sendPanic(context, callId) {
  const pos = await getPos();
  await db.from('panic_alerts').insert({
    user_id: currentUser.id, context: context || 'general', call_id: callId || null,
    latitude: pos?.lat || null, longitude: pos?.lng || null
  });
  navigator.vibrate?.([400, 150, 400]);
  showToast('🆘 Alerta enviada al admin con tu ubicación en vivo');
}
async function reportUser(targetId, reason) {
  await db.from('reports').insert({ reporter_id: currentUser.id, target_user_id: targetId, type: 'user', detail: reason });
  showToast('🚩 Reporte enviado. Moderación lo revisará.');
}

function requireActive() {
  if (currentProfile.role === 'admin' || currentProfile.unlimited_tokens) return true;
  if (!currentProfile.is_active) {
    showToast('⚠️ Cuenta inactiva: solicita una recarga (mín 3) y espera verificación');
    showSection('tokens');
    return false;
  }
  return true;
}

function updateHeader() {
  if (!currentProfile) return;
  const t = document.getElementById('userTokens');
  if (t) t.textContent = currentProfile.unlimited_tokens ? '∞' : parseFloat(currentProfile.tokens_balance || 0).toFixed(2);
  const av = document.getElementById('userAvatar'); if (av) av.textContent = (currentProfile.full_name || 'U').charAt(0).toUpperCase();
  const w = document.getElementById('welcomeName'); if (w) w.textContent = (currentProfile.full_name || 'Usuario').split(' ')[0];
  const wr = document.getElementById('welcomeRole'); if (wr) wr.textContent = 'Rol: ' + (ROLE_LABELS[currentProfile.role] || 'Usuario');
  document.querySelector('.admin-only')?.classList.toggle('hidden', currentProfile.role !== 'admin');
  document.getElementById('btnJoinKyc')?.classList.toggle('hidden', !!currentProfile.is_verified);
  const banner = document.getElementById('activationBanner');
  const inactive = !currentProfile.is_active && currentProfile.role !== 'admin' && !currentProfile.unlimited_tokens;
  if (banner) banner.classList.toggle('hidden', !inactive);
  document.body.classList.toggle('has-banner', inactive);
}
function toggleUserMenu() { document.getElementById('userMenu').classList.toggle('hidden'); }
document.addEventListener('click', e => {
  if (!e.target.closest('.user-avatar') && !e.target.closest('.user-menu')) document.getElementById('userMenu')?.classList.add('hidden');
});
async function handleLogout() { localStorage.removeItem('fendyx_last_section'); await db.auth.signOut(); location.replace('index.html'); }

function loadModules() {
  const mods = [
    { id: 'map', icon: '📍', n: 'Mapa Social' },
    { id: 'radar', icon: '🌙', n: 'Radar Nocturno' },
    { id: 'events', icon: '🎪', n: 'Eventos' },
    { id: 'restaurants', icon: '🍽️', n: 'Restaurantes' },
    { id: 'reservations', icon: '📅', n: 'Reservas' },
    { id: 'orders', icon: '📦', n: 'Pedidos' },
    { id: 'remote', icon: '💼', n: 'Trabajo Remoto' },
    { id: 'marketplace', icon: '🛒', n: 'Marketplace' },
    { id: 'chat', icon: '💬', n: 'Chat' },
    { id: 'tokens', icon: '◈', n: 'Tokens' },
    { id: 'profile', icon: '👤', n: 'Mi Perfil' },
    { id: 'profileedit', icon: '✏️', n: 'Perfil Pro' }
  ];
  if (currentProfile.role !== 'remote_worker') mods.splice(2, 0, { id: 'girls', icon: '💃', n: 'Videollamada con chicas' });
  if (currentProfile.role === 'remote_worker' && currentProfile.kyc_status !== 'approved') mods.unshift({ id: 'kyc', icon: '🪪', n: 'Mi Verificación' });
  if (currentProfile.role === 'delivery') mods.splice(7, 0, { id: 'delivery', icon: '🛵', n: 'Zona Domiciliario' });
  if (currentProfile.role === 'admin') mods.unshift({ id: 'admin', icon: '🛡️', n: 'Panel Admin' });
  document.getElementById('modulesGrid').innerHTML = mods.map(m =>
    `<div class="module-card" onclick="showSection('${m.id}')"><span class="icon">${m.icon}</span><h3>${m.n}</h3></div>`).join('');
}

const MODULE_FILES = {
  map: 'map.js', radar: 'radar.js', events: 'radar.js', restaurants: 'restaurants.js', reservations: 'restaurants.js',
  orders: 'orders.js', delivery: 'delivery.js', remote: 'remote.js', girls: 'remote.js', kyc: 'remote.js', agenda: 'remote.js',
  marketplace: 'market.js', chat: 'chat.js', tokens: 'tokens.js', profile: 'profile.js', profileedit: 'profile.js', admin: 'admin.js',
  calls: 'calls.js'
};
const LOADERS = {
  map: () => { initMap(); autoLocate(); loadMapUsers(); },
  radar: () => loadRadar(), events: () => loadEvents(),
  restaurants: () => loadRestaurants(), reservations: () => loadReservations(),
  orders: () => loadOrders(), delivery: () => loadDeliveryHub(),
  remote: () => loadWorkers(), girls: () => loadGirls(), kyc: () => fillKycForm(),
  marketplace: () => loadMarketplace(), chat: () => loadConversations(), tokens: () => loadTransactions(),
  profile: () => loadProfileSection(), profileedit: () => fillProfilePro(), admin: () => loadAdmin()
};
function loadScript(file) {
  if (loadedScripts[file]) return loadedScripts[file];
  loadedScripts[file] = new Promise(res => {
    const s = document.createElement('script');
    s.src = 'js/' + file + '?v=' + Date.now(); // cache-bust para cambios en vivo
    s.onload = res; s.onerror = res;
    document.body.appendChild(s);
  });
  return loadedScripts[file];
}
async function showSection(name) {
  document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-' + name)?.classList.add('active');
  document.getElementById('userMenu')?.classList.add('hidden');
  // Persistencia iOS-friendly: localStorage en lugar de sessionStorage
  try { localStorage.setItem('fendyx_last_section', name); } catch(e) {}
  const navMap = { dashboard: 0, map: 1, radar: 2, chat: 3, tokens: 4 };
  document.querySelectorAll('.bottom-nav .nav-item').forEach((n, i) => n.classList.toggle('active', i === navMap[name]));
  if (MODULE_FILES[name]) await loadScript(MODULE_FILES[name]);
  if (LOADERS[name]) { try { await LOADERS[name](); } catch (e) { console.error(e); } }
}

function haversine(a, b, c, d) {
  const R = 6371000, t = x => x * Math.PI / 180;
  const dLa = t(c - a), dLo = t(d - b);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function fmtDist(m) { return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1) + ' km'; }
function stars(r) { const n = Math.round(parseFloat(r) || 0); return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }
function driverLevel(n) { return n >= 150 ? '💎 Élite' : n >= 50 ? '🥇 Experto' : n >= 10 ? '🥈 Confiable' : '🥉 Nuevo'; }

// ===== GPS COMPATIBLE iOS Safari =====
function getPos() {
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      err => {
        // iOS a veces falla la primera vez, reintentamos con opciones más relajadas
        navigator.geolocation.getCurrentPosition(
          p => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => {
            if (err.code === 1) showToast('📍 iOS: permite la ubicación en Ajustes → Safari → Ubicación');
            res(null);
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}
function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }
function showToast(msg) {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(window._tt); window._tt = setTimeout(() => t.classList.add('hidden'), 2800);
}
async function deductTokens(amount, desc) {
  if (currentProfile.unlimited_tokens) return;
  const nb = parseFloat(currentProfile.tokens_balance) - amount;
  await db.from('profiles').update({ tokens_balance: nb }).eq('id', currentUser.id);
  await db.from('token_transactions').insert({ user_id: currentUser.id, amount: -amount, type: 'consumption', description: desc });
  currentProfile.tokens_balance = nb; updateHeader();
}
async function addTokens(amount, desc) {
  const nb = parseFloat(currentProfile.tokens_balance || 0) + amount;
  await db.from('profiles').update({ tokens_balance: nb }).eq('id', currentUser.id);
  await db.from('token_transactions').insert({ user_id: currentUser.id, amount, type: 'transfer', description: desc });
  currentProfile.tokens_balance = nb; updateHeader();
}

function startRealtime() {
  if (liveChannel) return;
  liveChannel = db.channel('fendyx-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => { if (typeof onMessageRealtime === 'function') onMessageRealtime(p.new); })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'panic_alerts' }, () => {
      if (currentProfile.role === 'admin') { showToast('🆘 ¡ALERTA DE PÁNICO! Revisa Seguridad'); navigator.vibrate?.([300, 100, 300]); }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, p => {
      if (p.new.id === currentUser.id) { loadProfile().then(() => { updateHeader(); if (document.getElementById('section-tokens')?.classList.contains('active')) loadTransactions?.(); }); }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'recharge_requests' }, p => {
      if (p.new.user_id === currentUser.id) {
        showToast(p.new.status === 'approved' ? '✅ Tu recarga fue aprobada' : p.new.status === 'rejected' ? '❌ Recarga rechazada: ' + (p.new.note || '') : '');
        if (document.getElementById('section-tokens')?.classList.contains('active')) loadTransactions?.();
        updateHeader();
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
      if (typeof loadAgenda === 'function' && document.getElementById('section-agenda')?.classList.contains('active')) loadAgenda();
    })
    // 🔔 TIMBRE GLOBAL: funciona aunque no estés en la sección de trabajadora
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'video_calls' }, async p => {
      if (p.new.worker_id === currentUser.id && p.new.status === 'active') {
        navigator.vibrate?.([300, 120, 300]);
        await loadScript('calls.js');
        if (typeof showIncomingCall === 'function') showIncomingCall(p.new);
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'video_calls' }, async p => {
      if (p.new.status === 'ended' && (p.new.worker_id === currentUser.id || p.new.client_id === currentUser.id)) {
        await loadScript('calls.js');
        if (typeof remoteHungUp === 'function') remoteHungUp(p.new);
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
      if (typeof loadOrders === 'function' && document.getElementById('section-orders')?.classList.contains('active')) loadOrders();
      if (typeof loadDeliveryHub === 'function' && document.getElementById('section-delivery')?.classList.contains('active')) loadDeliveryHub();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'radar_presences' }, () => {
      if (typeof loadRadarUsers === 'function' && document.getElementById('section-radar')?.classList.contains('active')) loadRadarUsers();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'recharge_requests' }, () => {
      if (currentProfile.role === 'admin' && typeof loadRechargeRequests === 'function' && document.getElementById('admin-recharges')?.classList.contains('active')) loadRechargeRequests();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_branding' }, () => loadBranding())
    .subscribe();
}
