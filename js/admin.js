'use strict';
let adminUsersCache = [];
let kycTarget = null;

async function loadAdmin() {
  if (currentProfile.role !== 'admin') { showSection('dashboard'); showToast('🚫 Acceso denegado'); return; }
  injectWorkersTab();
  loadAdminOverview();
}
function injectWorkersTab() {
  if (document.getElementById('tabWorkersBtn')) return;
  document.querySelector('#section-admin .admin-tabs').insertAdjacentHTML('beforeend',
    `<button class="admin-tab" id="tabWorkersBtn" onclick="switchAdminTab('workers',this)">👩 Trabajadoras</button>`);
  document.getElementById('section-admin').insertAdjacentHTML('beforeend',
    `<div id="admin-workers" class="admin-panel"><div id="adminWorkersList" class="list-compact"></div></div>`);
}
function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('admin-' + tab).classList.add('active');
  const loaders = {
    overview: loadAdminOverview, users: loadAdminUsers, tokens: loadAdminTransactions,
    content: loadAdminContent, withdrawals: loadAdminWithdrawals, kyc: loadKycList, workers: loadAdminWorkers
  };
  loaders[tab]?.();
}

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

async function uploadLogo(e) {
  const file = e.target.files[0]; if (!file) return;
  const path = 'logo/logo_' + Date.now() + '.' + file.name.split('.').pop();
  const { error } = await db.storage.from('fendyx-assets').upload(path, file);
  if (error) { showToast('❌ ' + error.message); return; }
  await db.from('app_branding').update({ logo_url: db.storage.from('fendyx-assets').getPublicUrl(path).data.publicUrl, updated_at: new Date().toISOString() }).eq('id', 1);
  await loadBranding(); showToast('✅ Logo actualizado en toda la plataforma');
}
async function saveAppName() {
  const name = document.getElementById('adminAppName').value.trim() || 'FENDYX';
  await db.from('app_branding').update({ app_name: name, updated_at: new Date().toISOString() }).eq('id', 1);
  await loadBranding(); showToast('✅ Nombre actualizado: ' + name);
}

async function loadAdminUsers() {
  const { data } = await db.from('profiles').select('*').order('created_at', { ascending: false });
  adminUsersCache = data || []; renderAdminUsers();
}
function renderAdminUsers() {
  const q = (document.getElementById('adminUsersSearch').value || '').toLowerCase();
  const rows = adminUsersCache.filter(u => !q || (u.email || '').toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q));
  document.getElementById('adminUsersTable').innerHTML = rows.map(u =>
    `<tr><td><b>${u.full_name || '—'}</b><br><small class="dim">${u.email}</small></td>
     <td>${ROLE_LABELS[u.role] || u.role}</td><td>${u.role === 'admin' ? '∞' : '◈ ' + u.tokens_balance}</td>
     <td>${u.is_banned ? '🚫 ' + (u.ban_reason || 'Baneado') : u.is_verified ? '✅ Verificado' : '⏳ Pendiente'}</td>
     <td>${!u.is_verified ? `<button class="btn-small success" onclick="verifyUser('${u.id}')">Verificar</button>` : ''}
     ${u.role !== 'admin' ? (u.is_banned
       ? `<button class="btn-small success" onclick="toggleBan('${u.id}',false)">Desbanear</button>`
       : `<button class="btn-small danger" onclick="toggleBan('${u.id}',true)">Banear</button>`) : ''}</td></tr>`).join('');
}
async function verifyUser(id) { await db.from('profiles').update({ is_verified: true }).eq('id', id); showToast('✅ Verificado'); loadAdminUsers(); }
async function toggleBan(id, ban) {
  if (ban) {
    const reason = prompt('Motivo del baneo (el usuario lo verá al intentar entrar):');
    if (reason === null || !reason.trim()) { showToast('Debes escribir un motivo'); return; }
    await db.from('profiles').update({ is_banned: true, ban_reason: reason.trim(), is_online: false }).eq('id', id);
    showToast('🚫 Usuario baneado con motivo registrado');
  } else {
    await db.from('profiles').update({ is_banned: false, ban_reason: null }).eq('id', id);
    showToast('✅ Usuario desbaneado');
  }
  loadAdminUsers(); loadAdminWorkers();
}

async function adminAdjustTokens() {
  const email = document.getElementById('adminTokenEmail').value.trim().toLowerCase();
  const amount = parseFloat(document.getElementById('adminTokenAmount').value);
  if (!email || !amount) { showToast('Completa email y cantidad'); return; }
  const { data: u } = await db.from('profiles').select('*').eq('email', email).single();
  if (!u) { showToast('❌ No encontrado'); return; }
  await db.from('profiles').update({ tokens_balance: parseFloat(u.tokens_balance || 0) + amount }).eq('id', u.id);
  await db.from('token_transactions').insert({ user_id: u.id, amount, type: amount >= 0 ? 'recharge' : 'consumption', description: 'Ajuste del administrador' });
  showToast('✅ Ajuste aplicado'); loadAdminTransactions(); loadAdminOverview();
}
async function loadAdminTransactions() {
  const { data } = await db.from('token_transactions').select('*, profiles(email)').order('created_at', { ascending: false }).limit(50);
  document.getElementById('adminTransactions').innerHTML = (data || []).map(t =>
    `<div class="tx-item"><div><b>${t.profiles?.email || '—'}</b><small>${t.description || t.type}</small></div>
     <span class="tx-amount ${t.amount >= 0 ? 'positive' : 'negative'}">${t.amount >= 0 ? '+' : ''}${t.amount}</span></div>`).join('')
    || '<p class="empty-state">Sin transacciones</p>';
}

async function loadAdminContent() {
  const [r, n, m] = await Promise.all([db.from('restaurants').select('id, name'), db.from('nightclubs').select('id, name'), db.from('marketplace_items').select('id, title')]);
  document.getElementById('adminRestaurants').innerHTML = (r.data || []).map(x => `<div class="row-item"><div class="row-main"><b>${x.name}</b></div><button class="btn-small danger" onclick="deleteContent('restaurants','${x.id}')">🗑</button></div>`).join('') || '<p class="empty-state">Vacío</p>';
  document.getElementById('adminNightclubs').innerHTML = (n.data || []).map(x => `<div class="row-item"><div class="row-main"><b>${x.name}</b></div><button class="btn-small danger" onclick="deleteContent('nightclubs','${x.id}')">🗑</button></div>`).join('') || '<p class="empty-state">Vacío</p>';
  document.getElementById('adminMarket').innerHTML = (m.data || []).map(x => `<div class="row-item"><div class="row-main"><b>${x.title}</b></div><button class="btn-small danger" onclick="deleteContent('marketplace_items','${x.id}')">🗑</button></div>`).join('') || '<p class="empty-state">Vacío</p>';
}
async function deleteContent(table, id) { if (!confirm('¿Eliminar definitivamente?')) return; await db.from(table).delete().eq('id', id); showToast('🗑 Eliminado'); loadAdminContent(); }

// ===== TRABAJADORAS: verificación, niveles, tarifas =====
async function loadAdminWorkers() {
  const { data } = await db.from('profiles').select('*, role_details(*)').eq('role', 'remote_worker').order('created_at', { ascending: false });
  document.getElementById('adminWorkersList').innerHTML = (data || []).map(w => {
    const rd = w.role_details?.[0];
    const st = w.worker_status || 'incomplete';
    const pill = st === 'active' ? 'st-delivered' : st === 'pending' ? 'st-pending' : st === 'rejected' ? 'st-cancelled' : 'st-ready';
    const label = st === 'active' ? 'ACTIVA' : st === 'pending' ? 'POR REVISAR' : st === 'rejected' ? 'RECHAZADA' : 'SIN DOCUMENTOS';
    return `<div class="row-item"><div class="row-main">
      <b>${w.full_name}</b> <span class="order-status ${pill}">${label}</span>
      <small>${w.email} · ${w.age || '?'} años · ${w.gender || '?'}</small>
      <small>📱 ${w.phone_whatsapp || 'sin WhatsApp'} · Nivel ${w.worker_level || 1}/5 · ◈ ${parseFloat(rd?.rate_per_minute || 0.2).toFixed(2)}/min</small>
      ${w.is_banned ? `<small style="color:var(--error)">🚫 BANEADA: ${w.ban_reason || ''}</small>` : ''}
    </div>
    <div class="row-actions">
      ${w.id_card_url ? `<button class="btn-small" onclick="window.open('${w.id_card_url}')">🪪 Cédula</button>` : ''}
      ${w.face_photo_url ? `<button class="btn-small" onclick="window.open('${w.face_photo_url}')">🤳 Rostro</button>` : ''}
      ${w.phone_whatsapp ? `<button class="btn-small" onclick="window.open('https://wa.me/${w.phone_whatsapp}')">📱 WhatsApp</button>` : ''}
      ${st === 'pending' ? `<button class="btn-small success" onclick="setWorkerStatus('${w.id}','active')">✅ Activar</button>
        <button class="btn-small danger" onclick="rejectWorker('${w.id}')">❌ Rechazar</button>` : ''}
      ${st === 'active' ? `<button class="btn-small warn" onclick="setWorkerStatus('${w.id}','rejected')">Suspender</button>` : ''}
      <select class="btn-small" onchange="setWorkerLevel('${w.id}', this.value)">
        ${[1,2,3,4,5].map(n => `<option value="${n}" ${(w.worker_level || 1) === n ? 'selected' : ''}>Nivel ${n}</option>`).join('')}
      </select>
      <button class="btn-small" onclick="setWorkerRate('${w.id}')">💰 Tarifa</button>
      ${w.is_banned ? `<button class="btn-small success" onclick="toggleBan('${w.id}',false)">Desbanear</button>` : `<button class="btn-small danger" onclick="toggleBan('${w.id}',true)">Banear</button>`}
    </div></div>`;
  }).join('') || '<p class="empty-state">No hay trabajadoras registradas</p>';
}
async function setWorkerStatus(id, status) {
  const up = { worker_status: status, is_online: false };
  if (status === 'rejected') {
    const reason = prompt('Motivo del rechazo (la trabajadora lo verá):');
    if (reason === null) return;
    up.ban_reason = reason.trim() || 'Documentos inválidos';
  } else { up.ban_reason = null; }
  await db.from('profiles').update(up).eq('id', id);
  showToast(status === 'active' ? '✅ Trabajadora ACTIVADA' : 'Estado actualizado');
  loadAdminWorkers();
}
async function rejectWorker(id) { await setWorkerStatus(id, 'rejected'); }
async function setWorkerLevel(id, level) {
  level = parseInt(level);
  const rates = { 1: 0.2, 2: 0.9, 3: 1.6, 4: 2.3, 5: 3.0 };
  await db.from('profiles').update({ worker_level: level }).eq('id', id);
  await db.from('role_details').update({ rate_per_minute: rates[level] }).eq('user_id', id);
  showToast('✅ Nivel ' + level + ' aplicado · Tarifa ◈ ' + rates[level].toFixed(2) + '/min');
  loadAdminWorkers();
}
async function setWorkerRate(id) {
  const rate = parseFloat(prompt('Tarifa personalizada por minuto (entre 0.2 y 3):'));
  if (isNaN(rate)) return;
  const clamped = Math.min(3, Math.max(0.2, rate));
  await db.from('role_details').update({ rate_per_minute: clamped }).eq('user_id', id);
  showToast('✅ Tarifa fijada en ◈ ' + clamped.toFixed(2) + '/min');
  loadAdminWorkers();
}

// ===== RETIROS =====
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

// ===== KYC =====
async function loadKycList() {
  const { data } = await db.from('profiles').select('*').eq('is_verified', false).eq('is_banned', false).order('created_at', { ascending: false });
  document.getElementById('kycList').innerHTML = (data || []).map(u =>
    `<div class="row-item"><div class="row-main"><b>${u.full_name || '—'}</b><small>${u.email} · ${ROLE_LABELS[u.role] || u.role}</small></div>
     <button class="btn-small success" onclick="startKyc('${u.id}','${(u.full_name || 'Usuario').replace(/'/g, '')}')">🎥 Iniciar KYC</button></div>`).join('')
    || '<p class="empty-state">Nadie pendiente de verificación 🎉</p>';
}
function setKycApi(api) { window._kycAdmin = api; if (typeof kycApi !== 'undefined') kycApi = api; }
function disposeKycApis() {
  try { if (window._kycAdmin) { window._kycAdmin.dispose(); window._kycAdmin = null; } } catch (e) {}
  try { if (typeof kycApi !== 'undefined' && kycApi) { kycApi.dispose(); kycApi = null; } } catch (e) {}
}
function startKyc(userId, name) {
  kycTarget = userId; disposeKycApis();
  document.getElementById('kycTitle').textContent = '🎥 KYC: ' + name;
  document.getElementById('kycVerifyBtn').classList.remove('hidden');
  openModal('modal-kyc');
  setKycApi(new JitsiMeetExternalAPI('meet.jit.si', { roomName: 'FENDYX_KYC_' + userId.slice(0, 8), width: '100%', height: '100%', parentNode: document.getElementById('kycContainer'), userInfo: { displayName: 'Admin FENDYX' } }));
  showToast('🎥 Sala KYC abierta');
}
async function kycMarkVerified() {
  if (!kycTarget) return;
  await db.from('profiles').update({ is_verified: true }).eq('id', kycTarget);
  showToast('✅ Usuario verificado'); kycTarget = null; closeKyc(); loadKycList();
}
function closeKyc() { disposeKycApis(); closeModal('modal-kyc'); }

// ===== AUDITORÍA =====
async function runAudit() {
  const q = document.getElementById('auditSearch').value.trim();
  const box = document.getElementById('auditResults');
  if (q.length < 3) { box.innerHTML = '<p class="empty-state">Escribe al menos 3 caracteres para auditar</p>'; return; }
  const { data } = await db.from('messages').select('*, profiles!messages_sender_id_fkey(email, full_name)').ilike('content', '%' + q + '%').order('created_at', { ascending: false }).limit(50);
  box.innerHTML = (data || []).map(m =>
    `<div class="row-item audit-row"><div class="row-main"><b>${m.profiles?.email || '—'}</b><small>${new Date(m.created_at).toLocaleString('es')}</small><div>…${m.content}…</div></div>
     <button class="btn-small danger" onclick="toggleBan('${m.sender_id}',true)">🚫 Banear</button></div>`).join('')
    || '<p class="empty-state">Sin coincidencias</p>';
}
