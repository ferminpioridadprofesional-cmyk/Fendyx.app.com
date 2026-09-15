'use strict';
/* =====================================================
   FENDYX - PANEL DE ADMINISTRACIÓN COMPLETO
   Resumen, Branding, Usuarios, Tokens, Contenido,
   Retiros, KYC por videollamada y Auditoría anti-estafas
   ===================================================== */
let adminUsersCache = [];
let kycTarget = null;

// ===== Acceso y navegación de pestañas =====
async function loadAdmin() {
  if (currentProfile.role !== 'admin') { showSection('dashboard'); showToast('🚫 Acceso denegado'); return; }
  loadAdminOverview();
}
function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('admin-' + tab).classList.add('active');
  const loaders = {
    overview: loadAdminOverview, users: loadAdminUsers, tokens: loadAdminTransactions,
    content: loadAdminContent, withdrawals: loadAdminWithdrawals, kyc: loadKycList
  };
  loaders[tab]?.();
}

// ===== Resumen (KPIs + actividad) =====
async function loadAdminOverview() {
  const [u, o, c, tx] = await Promise.all([
    db.from('profiles').select('tokens_balance'),
    db.from('orders').select('*', { count: 'exact', head: true }),
    db.from('video_calls').select('*', { count: 'exact', head: true }),
    db.from('token_transactions').select('*, profiles(email)').order('created_at', { ascending: false }).limit(8)
  ]);
  const users = u.data || [];
  document.getElementById('kpiUsers').textContent = users.length;
  document.getElementById('kpiTokens').textContent = users.reduce((s, p) => s + parseFloat(p.tokens_balance || 0), 0).toFixed(0);
  document.getElementById('kpiOrders').textContent = o.count || 0;
  document.getElementById('kpiCalls').textContent = c.count || 0;
  document.getElementById('activityFeed').innerHTML = (tx.data || []).map(x =>
    `<div class="tx-item"><div><b>${x.profiles?.email || '—'}</b><small>${x.description || x.type}</small></div>
     <span class="tx-amount ${x.amount >= 0 ? 'positive' : 'negative'}">${x.amount >= 0 ? '+' : ''}${x.amount}</span></div>`).join('')
    || '<p class="empty-state">Sin actividad reciente</p>';
}

// ===== Branding dinámico =====
async function uploadLogo(e) {
  const file = e.target.files[0];
  if (!file) return;
  const path = 'logo/logo_' + Date.now() + '.' + file.name.split('.').pop();
  const { error } = await db.storage.from('fendyx-assets').upload(path, file);
  if (error) { showToast('❌ ' + error.message); return; }
  const url = db.storage.from('fendyx-assets').getPublicUrl(path).data.publicUrl;
  await db.from('app_branding').update({ logo_url: url, updated_at: new Date().toISOString() }).eq('id', 1);
  await loadBranding();
  showToast('✅ Logo actualizado en toda la plataforma');
}
async function saveAppName() {
  const name = document.getElementById('adminAppName').value.trim() || 'FENDYX';
  await db.from('app_branding').update({ app_name: name, updated_at: new Date().toISOString() }).eq('id', 1);
  await loadBranding();
  showToast('✅ Nombre actualizado: ' + name);
}

// ===== Gestión de usuarios =====
async function loadAdminUsers() {
  const { data } = await db.from('profiles').select('*').order('created_at', { ascending: false });
  adminUsersCache = data || [];
  renderAdminUsers();
}
function renderAdminUsers() {
  const q = (document.getElementById('adminUsersSearch').value || '').toLowerCase();
  const rows = adminUsersCache.filter(u => !q || (u.email || '').toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q));
  document.getElementById('adminUsersTable').innerHTML = rows.map(u =>
    `<tr><td><b>${u.full_name || '—'}</b><br><small class="dim">${u.email}</small></td>
     <td>${ROLE_LABELS[u.role] || u.role}</td><td>◈ ${u.tokens_balance}</td>
     <td>${u.is_banned ? '🚫 Baneado' : u.is_verified ? '✅ Verificado' : '⏳ Pendiente'}</td>
     <td>${!u.is_verified ? `<button class="btn-small success" onclick="verifyUser('${u.id}')">Verificar</button>` : ''}
     ${u.role !== 'admin' ? (u.is_banned
       ? `<button class="btn-small success" onclick="toggleBan('${u.id}',false)">Desbanear</button>`
       : `<button class="btn-small danger" onclick="toggleBan('${u.id}',true)">Banear</button>`) : ''}</td></tr>`).join('');
}
async function verifyUser(id) {
  await db.from('profiles').update({ is_verified: true }).eq('id', id);
  showToast('✅ Usuario verificado'); loadAdminUsers();
}
async function toggleBan(id, ban) {
  if (!confirm(ban ? '¿Banear usuario? Perderá acceso inmediatamente.' : '¿Desbanear usuario?')) return;
  await db.from('profiles').update({ is_banned: ban }).eq('id', id);
  showToast(ban ? '🚫 Usuario baneado' : '✅ Usuario desbaneado'); loadAdminUsers();
}

// ===== Ajuste manual de tokens =====
async function adminAdjustTokens() {
  const email = document.getElementById('adminTokenEmail').value.trim().toLowerCase();
  const amount = parseFloat(document.getElementById('adminTokenAmount').value);
  if (!email || !amount) { showToast('Completa email y cantidad'); return; }
  const { data: u } = await db.from('profiles').select('*').eq('email', email).single();
  if (!u) { showToast('❌ Usuario no encontrado'); return; }
  await db.from('profiles').update({ tokens_balance: parseFloat(u.tokens_balance || 0) + amount }).eq('id', u.id);
  await db.from('token_transactions').insert({ user_id: u.id, amount, type: amount >= 0 ? 'recharge' : 'consumption', description: 'Ajuste del administrador' });
  showToast('✅ Ajuste aplicado a ' + email);
  loadAdminTransactions(); loadAdminOverview();
}
async function loadAdminTransactions() {
  const { data } = await db.from('token_transactions').select('*, profiles(email)').order('created_at', { ascending: false }).limit(50);
  document.getElementById('adminTransactions').innerHTML = (data || []).map(t =>
    `<div class="tx-item"><div><b>${t.profiles?.email || '—'}</b><small>${t.description || t.type} · ${new Date(t.created_at).toLocaleDateString()}</small></div>
     <span class="tx-amount ${t.amount >= 0 ? 'positive' : 'negative'}">${t.amount >= 0 ? '+' : ''}${t.amount}</span></div>`).join('')
    || '<p class="empty-state">Sin transacciones</p>';
}

// ===== Moderación de contenido =====
async function loadAdminContent() {
  const [r, n, m] = await Promise.all([
    db.from('restaurants').select('id, name'),
    db.from('nightclubs').select('id, name'),
    db.from('marketplace_items').select('id, title')
  ]);
  document.getElementById('adminRestaurants').innerHTML = (r.data || []).map(x =>
    `<div class="row-item"><div class="row-main"><b>${x.name}</b></div><button class="btn-small danger" onclick="deleteContent('restaurants','${x.id}')">🗑</button></div>`).join('')
    || '<p class="empty-state">Vacío</p>';
  document.getElementById('adminNightclubs').innerHTML = (n.data || []).map(x =>
    `<div class="row-item"><div class="row-main"><b>${x.name}</b></div><button class="btn-small danger" onclick="deleteContent('nightclubs','${x.id}')">🗑</button></div>`).join('')
    || '<p class="empty-state">Vacío</p>';
  document.getElementById('adminMarket').innerHTML = (m.data || []).map(x =>
    `<div class="row-item"><div class="row-main"><b>${x.title}</b></div><button class="btn-small danger" onclick="deleteContent('marketplace_items','${x.id}')">🗑</button></div>`).join('')
    || '<p class="empty-state">Vacío</p>';
}
async function deleteContent(table, id) {
  if (!confirm('¿Eliminar definitivamente? Esta acción no se puede deshacer.')) return;
  await db.from(table).delete().eq('id', id);
  showToast('🗑 Contenido eliminado'); loadAdminContent();
}

// ===== Aprobación de retiros =====
async function loadAdminWithdrawals() {
  const { data } = await db.from('withdrawals').select('*, profiles(email, full_name)').order('created_at', { ascending: false });
  document.getElementById('withdrawalsAdmin').innerHTML = (data || []).map(w =>
    `<div class="row-item"><div class="row-main"><b>${w.profiles?.full_name || '—'} · ◈ ${w.amount}</b>
     <small>${w.profiles?.email} · ${w.method} · ${new Date(w.created_at).toLocaleDateString()}</small></div>
     <div class="row-actions">${w.status === 'pending'
       ? `<button class="btn-small success" onclick="resolveWithdrawal('${w.id}','approved')">✅ Aprobar</button>
          <button class="btn-small danger" onclick="resolveWithdrawal('${w.id}','rejected')">↩️ Rechazar</button>`
       : `<span class="order-status ${w.status === 'approved' ? 'st-delivered' : 'st-cancelled'}">${w.status === 'approved' ? 'Aprobado' : 'Rechazado'}</span>`}</div></div>`).join('')
    || '<p class="empty-state">Sin solicitudes de retiro</p>';
}
async function resolveWithdrawal(id, status) {
  const { data: w } = await db.from('withdrawals').select('*').eq('id', id).single();
  if (!w || w.status !== 'pending') return;
  if (status === 'rejected') {
    const { data: u } = await db.from('profiles').select('tokens_balance').eq('id', w.user_id).single();
    await db.from('profiles').update({ tokens_balance: parseFloat(u.tokens_balance || 0) + parseFloat(w.amount) }).eq('id', w.user_id);
    await db.from('token_transactions').insert({ user_id: w.user_id, amount: parseFloat(w.amount), type: 'refund', description: 'Retiro rechazado - reembolso automático' });
  }
  await db.from('withdrawals').update({ status }).eq('id', id);
  showToast(status === 'approved' ? '✅ Retiro aprobado' : '↩️ Retiro rechazado y reembolsado');
  loadAdminWithdrawals(); loadAdminOverview();
}

// ===== KYC por videollamada (Jitsi) =====
async function loadKycList() {
  const { data } = await db.from('profiles').select('*').eq('is_verified', false).eq('is_banned', false).order('created_at', { ascending: false });
  document.getElementById('kycList').innerHTML = (data || []).map(u =>
    `<div class="row-item"><div class="row-main"><b>${u.full_name || '—'}</b><small>${u.email} · ${ROLE_LABELS[u.role] || u.role}</small></div>
     <button class="btn-small success" onclick="startKyc('${u.id}','${(u.full_name || 'Usuario').replace(/'/g, '')}')">🎥 Iniciar KYC</button></div>`).join('')
    || '<p class="empty-state">Nadie pendiente de verificación 🎉</p>';
}
function setKycApi(api) {
  window._kycAdmin = api;
  if (typeof kycApi !== 'undefined') kycApi = api;
}
function disposeKycApis() {
  try { if (window._kycAdmin) { window._kycAdmin.dispose(); window._kycAdmin = null; } } catch (e) { console.warn(e); }
  try { if (typeof kycApi !== 'undefined' && kycApi) { kycApi.dispose(); kycApi = null; } } catch (e) { console.warn(e); }
}
function startKyc(userId, name) {
  kycTarget = userId;
  disposeKycApis();
  document.getElementById('kycTitle').textContent = '🎥 KYC: ' + name;
  document.getElementById('kycVerifyBtn').classList.remove('hidden');
  openModal('modal-kyc');
  setKycApi(new JitsiMeetExternalAPI('meet.jit.si', {
    roomName: 'FENDYX_KYC_' + userId.slice(0, 8),
    width: '100%', height: '100%',
    parentNode: document.getElementById('kycContainer'),
    userInfo: { displayName: 'Admin FENDYX' }
  }));
  showToast('🎥 Sala KYC abierta. El usuario entra desde Perfil Pro → Unirse a KYC.');
}
async function kycMarkVerified() {
  if (!kycTarget) { showToast('No hay usuario seleccionado'); return; }
  await db.from('profiles').update({ is_verified: true }).eq('id', kycTarget);
  showToast('✅ Usuario verificado permanentemente');
  kycTarget = null;
  closeKyc();
  loadKycList();
}
function closeKyc() {
  disposeKycApis();
  closeModal('modal-kyc');
}

// ===== Auditoría anti-estafas (buscador en todos los chats) =====
async function runAudit() {
  const q = document.getElementById('auditSearch').value.trim();
  const box = document.getElementById('auditResults');
  if (q.length < 3) { box.innerHTML = '<p class="empty-state">Escribe al menos 3 caracteres para auditar</p>'; return; }
  const { data } = await db.from('messages')
    .select('*, profiles!messages_sender_id_fkey(email, full_name), conversations(user_a, user_b)')
    .ilike('content', '%' + q + '%')
    .order('created_at', { ascending: false })
    .limit(50);
  box.innerHTML = (data || []).map(m =>
    `<div class="row-item audit-row"><div class="row-main"><b>${m.profiles?.email || '—'}</b>
     <small>${new Date(m.created_at).toLocaleString('es')}</small>
     <div>…${m.content}…</div></div>
     <button class="btn-small danger" onclick="toggleBan('${m.sender_id}',true)">🚫 Banear remitente</button></div>`).join('')
    || '<p class="empty-state">Sin coincidencias para "' + q + '"</p>';
}
