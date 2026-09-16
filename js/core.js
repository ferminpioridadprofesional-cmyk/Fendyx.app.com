'use strict';
let currentUser = null, currentProfile = null, roleDetails = null, myLocation = null;
let cart = { restId: null, items: [] };
let liveChannel = null;
const loadedScripts = {};
const LEVEL_RATES = { 1: 0.2, 2: 0.9, 3: 1.6, 4: 2.3, 5: 3.0 };

document.addEventListener('DOMContentLoaded', async () => {
  await loadBranding();
  const isApp = !!document.getElementById('section-dashboard');
  const { data: { session } } = await db.auth.getSession();
  if (isApp) {
    if (!session) { location.replace('index.html'); return; }
    currentUser = session.user;
    await enterApp();
  } else if (session) { location.replace('app.html'); }
});

async function enterApp() {
  try {
    await loadProfile();
    if (!currentProfile) await repairProfile();
    if (!currentProfile) { await db.auth.signOut(); location.replace('index.html'); return; }
    if (currentProfile.is_banned) {
      localStorage.setItem('fendyx_ban_reason', currentProfile.ban_reason || 'Incumplimiento de normas');
      await db.auth.signOut();
      location.replace('index.html?banned=1');
      return;
    }
    localStorage.removeItem('fendyx_ban_reason');
    await ensureRoleDetails();
    updateHeader(); loadModules(); showSection('dashboard'); startRealtime();
  } catch (e) { console.error(e); showToast('⚠️ Error de carga: ' + e.message); }
}

async function repairProfile() {
  const { data } = await db.from('profiles').select('*').eq('id', currentUser.id).single();
  if (data) { currentProfile = data; return; }
  const meta = JSON.parse(localStorage.getItem('fendyx_pending_meta') || '{}');
  const { data: created, error } = await db.from('profiles').insert({
    id: currentUser.id, email: currentUser.email,
    full_name: meta.full_name || currentUser.email?.split('@')[0] || 'Usuario',
    role: meta.role || 'user', age: meta.age || null, gender: meta.gender || null, tokens_balance: 0
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
    rate_per_minute: currentProfile.role === 'remote_worker' ? 0.2 : (meta.rate ? parseFloat(meta.rate) : null)
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

function updateHeader() {
  if (!currentProfile) return;
  const t = document.getElementById('userTokens');
  if (t) t.textContent = currentProfile.role === 'admin' ? '∞' : parseFloat(currentProfile.tokens_balance || 0).toFixed(2);
  const av = document.getElementById('userAvatar'); if (av) av.textContent = (currentProfile.full_name || 'U').charAt(0).toUpperCase();
  const w = document.getElementById('welcomeName'); if (w) w.textContent = (currentProfile.full_name || 'Usuario').split(' ')[0];
  const wr = document.getElementById('welcomeRole');
  if (wr) wr.textContent = 'Rol: ' + (ROLE_LABELS[currentProfile.role] || 'Usuario') + (currentProfile.is_active ? '' : ' · ⚠️ Cuenta sin activar');
  document.querySelector('.admin-only')?.classList.toggle('hidden', currentProfile.role !== 'admin');
  document.getElementById('btnJoinKyc')?.classList.toggle('hidden', !!currentProfile.is_verified);
}
function toggleUserMenu() { document.getElementById('userMenu').classList.toggle('hidden'); }
document.addEventListener('click', e => {
  if (!e.target.closest('.user-avatar') && !e.target.closest('.user-menu')) document.getElementById('userMenu')?.classList.add('hidden');
});
async function handleLogout() { await db.auth.signOut(); location.replace('index.html'); }

function loadModules() {
  const isWorker = currentProfile.role === 'remote_worker';
  const mods = [
    { id:'map', icon:'📍', n:'Mapa Social' }, { id:'radar', icon:'🌙', n:'Radar Nocturno' },
    { id:'events', icon:'🎪', n:'Eventos' }, { id:'restaurants', icon:'🍽️', n:'Restaurantes' },
    { id:'reservations', icon:'📅', n:'Reservas' }, { id:'orders', icon:'📦', n:'Pedidos' },
    isWorker ? { id:'remote', icon:'💼', n:'Mi Zona de Trabajo' } : { id:'remote', icon:'📹', n:'Videollamada con Chicas' },
    { id:'agenda', icon:'🗓️', n:'Agenda' }, { id:'marketplace', icon:'🛒', n:'Marketplace' },
    { id:'chat', icon:'💬', n:'Chat' }, { id:'tokens', icon:'◈', n:'Tokens' },
    { id:'profile', icon:'👤', n:'Mi Perfil' }, { id:'profileedit', icon:'✏️', n:'Perfil Pro' }
  ];
  if (isWorker && currentProfile.worker_status !== 'active') mods.unshift({ id:'remote', icon:'🪪', n:'Verificación Obligatoria' });
  if (currentProfile.role === 'delivery') mods.splice(6, 0, { id:'delivery', icon:'🛵', n:'Zona Domiciliario' });
  if (currentProfile.role === 'admin') mods.unshift({ id:'admin', icon:'🛡️', n:'Panel Admin' });
  document.getElementById('modulesGrid').innerHTML = mods.map(m =>
    `<div class="module-card" onclick="showSection('${m.id}')"><span class="icon">${m.icon}</span><h3>${m.n}</h3></div>`).join('');
  const old = document.getElementById('activateBanner'); if (old) old.remove();
  if (!currentProfile.is_active) {
    document.getElementById('modulesGrid').insertAdjacentHTML('beforebegin',
      `<div class="welcome-banner" id="activateBanner" style="border-color:var(--warning)">
        <h2 style="font-size:1.1rem">⚠️ Activa tu cuenta</h2>
        <p>Recarga mínima de <b>$3</b> para desbloquear llamadas, pedidos y compras.</p>
        <button class="btn-primary" style="margin-top:10px" onclick="showSection('tokens')">Activar ahora</button></div>`);
  }
}

const MODULE_FILES = {
  map:'map.js', radar:'radar.js', events:'radar.js', restaurants:'restaurants.js', reservations:'restaurants.js',
  orders:'orders.js', delivery:'delivery.js', remote:'remote.js', agenda:'remote.js',
  marketplace:'market.js', chat:'chat.js', tokens:'tokens.js', profile:'profile.js', profileedit:'profile.js', admin:'admin.js'
};
const LOADERS = {
  map: () => { initMap(); autoLocate(); loadMapUsers(); },
  radar: loadRadar, events: loadEvents, restaurants: loadRestaurants, reservations: loadReservations,
  orders: loadOrders, delivery: loadDeliveryHub, remote: loadWorkers, agenda: loadAgenda,
  marketplace: loadMarketplace, chat: loadConversations, tokens: loadTransactions,
  profile: loadProfileSection, profileedit: fillProfilePro, admin: loadAdmin
};
function loadScript(file) {
  if (loadedScripts[file]) return loadedScripts[file];
  loadedScripts[file] = new Promise(res => {
    const s = document.createElement('script');
    s.src = 'js/' + file; s.onload = res; s.onerror = res;
    document.body.appendChild(s);
  });
  return loadedScripts[file];
}
async function showSection(name) {
  document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-' + name)?.classList.add('active');
  document.getElementById('userMenu')?.classList.add('hidden');
  const navMap = { dashboard:0, map:1, radar:2, chat:3, tokens:4 };
  document.querySelectorAll('.bottom-nav .nav-item').forEach((n, i) => n.classList.toggle('active', i === navMap[name]));
  if (MODULE_FILES[name]) await loadScript(MODULE_FILES[name]);
  if (LOADERS[name]) { try { await LOADERS[name](); } catch (e) { console.error(e); } }
}

function haversine(a, b, c, d) {
  const R = 6371000, t = x => x * Math.PI / 180;
  const dLa = t(c - a), dLo = t(d - b);
  const h = Math.sin(dLa/2)**2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(dLo/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function fmtDist(m) { return m < 1000 ? Math.round(m) + ' m' : (m/1000).toFixed(1) + ' km'; }
function stars(r) { const n = Math.round(parseFloat(r) || 0); return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }
function driverLevel(n) { return n >= 150 ? '💎 Élite' : n >= 50 ? '🥇 Experto' : n >= 10 ? '🥈 Confiable' : '🥉 Nuevo'; }
function getPos() { return new Promise(res => { if (!navigator.geolocation) return res(null);
  navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { timeout: 5000 }); }); }
function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }
function showToast(msg) {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(window._tt); window._tt = setTimeout(() => t.classList.add('hidden'), 2800);
}
function requireActive() {
  if (currentProfile.role === 'admin') return true;
  if (!currentProfile.is_active) { showToast('⚠️ Activa tu cuenta con una recarga mínima de $3'); showSection('tokens'); return false; }
  return true;
}
async function deductTokens(amount, desc) {
  if (currentProfile.role === 'admin') return; // Admin ilimitado
  const nb = parseFloat(currentProfile.tokens_balance) - amount;
  await db.from('profiles').update({ tokens_balance: nb }).eq('id', currentUser.id);
  await db.from('token_transactions').insert({ user_id: currentUser.id, amount: -amount, type: 'consumption', description: desc });
  currentProfile.tokens_balance = nb; updateHeader();
}
async function addTokens(amount, desc, type) {
  const nb = parseFloat(currentProfile.tokens_balance || 0) + amount;
  await db.from('profiles').update({ tokens_balance: nb }).eq('id', currentUser.id);
  await db.from('token_transactions').insert({ user_id: currentUser.id, amount, type: type || 'transfer', description: desc });
  currentProfile.tokens_balance = nb; updateHeader();
}

function startRealtime() {
  if (liveChannel) return;
  liveChannel = db.channel('fendyx-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async p => {
      if (typeof onMessageRealtime === 'function') onMessageRealtime(p.new);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
      if (document.getElementById('section-orders')?.classList.contains('active')) loadOrders?.();
      if (document.getElementById('section-delivery')?.classList.contains('active')) loadDeliveryHub?.();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'radar_presences' }, () => {
      if (document.getElementById('section-radar')?.classList.contains('active')) loadRadarUsers?.();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_branding' }, () => loadBranding())
    .subscribe();
}
