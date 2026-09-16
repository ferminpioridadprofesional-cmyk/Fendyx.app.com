'use strict';
let adminUsersCache = [], kycTarget = null;

async function loadAdmin() {
  if (currentProfile.role !== 'admin') { showSection('dashboard'); showToast('🚫 Acceso denegado'); return; }
  startSafetyRealtime();
  loadAdminOverview();
}
function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('admin-' + tab)?.classList.add('active');
  const loaders = { overview: loadAdminOverview, users: loadAdminUsers, tokens: loadAdminTransactions, content: loadAdminContent, withdrawals: loadAdminWithdrawals, kyc: loadKycList, workers: loadWorkersAdmin, recharges: loadRechargeRequests, safety: loadSafety };
  loaders[tab]?.();
}
function startSafetyRealtime() {
  if (window._safetyCh) return;
  window._safetyCh = db.channel('fendyx-safety')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'panic_alerts' }, () => { if (document.getElementById('admin-safety')?.classList.contains('active')) loadSafety(); })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, () => { if (document.getElementById('admin-safety')?.classList.contains('active')) loadSafety(); })
    .subscribe();
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
    `<div class="tx-item"><div><b>${x.profiles?.email || '—'}</b><small>${x.description || x.type}</small></div><span class="tx-amount ${x.amount >= 0 ? 'positive' : 'negative'}">${x.amount >= 0 ? '+' : ''}${x.amount}</span></div>`).join('')
    || '<p class="empty-state">Sin actividad</p>';
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

// ===== USUARIOS =====
async function loadAdminUsers() {
  if (!document.getElementById('adminPassLog')) {
    document.getElementById('admin-users').insertAdjacentHTML('beforeend',
      '<h3 class="sub-title">🔑 Acciones de contraseñas (auditoría)</h3><div id="adminPassLog" class="list-compact"></div>');
  }
  const { data } = await db.from('profiles').select('*').order('created_at', { ascending: false });
  adminUsersCache = data || [];
  renderAdminUsers();
  loadPassLog();
}
function renderAdminUsers() {
  const q = (document.getElementById('adminUsersSearch').value || '').toLowerCase();
  const rows = adminUsersCache.filter(u => !q || (u.email || '').toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q));
  document.getElementById('adminUsersTable').innerHTML = rows.map(u =>
    `<tr><td><b>${u.full_name || '—'}</b><br><small class="dim">${u.email}</small></td>
     <td><select class="btn-small" onchange="changeUserRole('${u.id}', this.value)" ${u.role === 'admin' ? 'disabled' : ''}>
        ${Object.entries(ROLE_LABELS).map(([k, v]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${v}</option>`).join('')}
     </select></td>
     <td>${u.unlimited_tokens ? '∞' : u.tokens_balance}</td>
     <td>${u.is_banned ? '🚫 ' + (u.ban_reason || 'Baneado') : u.is_verified ? '✅ Verificado' : '⏳ Pendiente'}</td>
     <td>
       <button class="btn-small" onclick="changeUserPass('${u.email}')">🔑 Pass</button>
       <button class="btn-small warn" onclick="tempPass('${u.email}')">🎲</button>
       ${!u.is_verified ? `<button class="btn-small success" onclick="verifyUser('${u.id}')">Verificar</button>` : ''}
       ${u.role !== 'admin' ? (u.is_banned ? `<button class="btn-small success" onclick="toggleBan('${u.id}',false)">Desbanear</button>` : `<button class="btn-small danger" onclick="toggleBan('${u.id}',true)">Banear</button>`) : ''}
     </td></tr>`).join('');
}
async function changeUserRole(id, newRole) {
  const u = adminUsersCache.find(x => x.id === id);
  if (!u || u.role === newRole) return;
  if (u.role === 'admin') { showToast('❌ No puedes cambiar el rol del admin'); loadAdminUsers(); return; }
  if (newRole === 'remote_worker' && u.gender !== 'female') { showToast('❌ Solo mujeres pueden ser trabajadoras remotas'); loadAdminUsers(); return; }
  await db.from('profiles').update({ role: newRole, kyc_status: newRole === 'remote_worker' ? 'pending' : 'none' }).eq('id', id);
  const payload = { user_id: id, role_type: newRole };
  if (newRole === 'remote_worker') Object.assign(payload, { rate_per_minute: 0.2, worker_level: 1 });
  await db.from('role_details').upsert(payload, { onConflict: 'user_id' });
  await db.rpc('log_admin_action', { p_action: 'role_change', p_target: u.email, p_detail: u.role + ' → ' + newRole });
  showToast('✅ Rol cambiado a ' + (ROLE_LABELS[newRole] || newRole));
  loadAdminUsers();
}
async function changeUserPass(email) {
  const np = prompt('Nueva contraseña para ' + email + ' (mínimo 6 caracteres):');
  if (np === null) return;
  if (np.length < 6) { showToast('❌ Mínimo 6 caracteres'); return; }
  const np2 = prompt('Confirma la nueva contraseña:');
  if (np !== np2) { showToast('❌ No coinciden'); return; }
  const { data: res, error } = await db.rpc('admin_reset_password', { p_email: email, p_new: np });
  if (error || (res && res.startsWith('ERROR'))) { showToast('❌ ' + (res || error.message)); return; }
  showToast('✅ Contraseña cambiada'); loadPassLog();
}
async function tempPass(email) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let tmp = '';
  for (let i = 0; i < 8; i++) tmp += chars[Math.floor(Math.random() * chars.length)];
  if (!confirm('Contraseña temporal generada: ' + tmp + '\nSe mostrará UNA sola vez. ¿Aplicar?')) return;
  const { data: res, error } = await db.rpc('admin_reset_password', { p_email: email, p_new: tmp });
  if (error || (res && res.startsWith('ERROR'))) { showToast('❌ ' + (res || error.message)); return; }
  navigator.clipboard?.writeText(tmp);
  prompt('🔑 Contraseña temporal de ' + email + ' (copiada al portapapeles):', tmp);
  showToast('✅ Aplicada y registrada'); loadPassLog();
}
async function loadPassLog() {
  const box = document.getElementById('adminPassLog');
  if (!box) return;
  const { data } = await db.from('admin_actions').select('*').order('created_at', { ascending: false }).limit(10);
  box.innerHTML = (data || []).map(a =>
    `<div class="tx-item"><div><b>${a.action}</b> → ${a.target_email || '—'}<small>${a.detail || ''} · ${new Date(a.created_at).toLocaleString('es')}</small></div></div>`).join('')
    || '<p class="empty-state">Sin acciones registradas</p>';
}
async function verifyUser(id) {
  await db.from('profiles').update({ is_verified: true }).eq('id', id);
  const u = adminUsersCache.find(x => x.id === id);
  await db.rpc('log_admin_action', { p_action: 'verify', p_target: u?.email || id, p_detail: 'Usuario verificado' });
  showToast('✅ Verificado'); loadAdminUsers();
}
async function toggleBan(id, ban) {
  let reason = null;
  if (ban) { reason = prompt('Razón del baneo (obligatoria, la verá la usuaria):'); if (!reason || !reason.trim()) { showToast('La razón es obligatoria'); return; } }
  await db.from('profiles').update({ is_banned: ban, ban_reason: ban ? reason.trim() : null }).eq('id', id);
  const u = adminUsersCache.find(x => x.id === id);
  await db.rpc('log_admin_action', { p_action: ban ? 'ban' : 'unban', p_target: u?.email || id, p_detail: ban ? reason.trim() : 'Rehabilitado' });
  showToast(ban ? '🚫 Baneado con razón' : '✅ Desbaneado'); loadAdminUsers();
}

// ===== 🚨 CENTRO DE SEGURIDAD: PÁNICO + REPORTES =====
async function loadSafety() {
  const { data: panics } = await db.from('panic_alerts').select('*, profiles(email, full_name)').order('created_at', { ascending: false }).limit(20);
  document.getElementById('panicList').innerHTML = (panics || []).map(p =>
    `<div class="row-item"><div class="row-main"><b>🆘 ${p.profiles?.full_name || '—'}</b>
     <small>${p.profiles?.email} · contexto: ${p.context} · ${new Date(p.created_at).toLocaleString('es')}</small>
     ${p.latitude ? `<a class="btn-small" target="_blank" href="https://www.google.com/maps?q=${p.latitude},${p.longitude}">🗺️ Ver ubicación en vivo</a>` : '<small>sin GPS</small>'}</div>
     <div class="row-actions">
       ${p.status === 'active' ? `<button class="btn-small success" onclick="resolvePanic('${p.id}')">✅ Resolver</button>` : '<span class="order-status st-delivered">Resuelta</span>'}
       <button class="btn-small danger" onclick="toggleBan('${p.user_id}',true)">🚫</button>
     </div></div>`).join('')
    || '<p class="empty-state">Sin alertas de pánico 🎉</p>';

  const { data: reps } = await db.from('reports').select('*, messages(content), target:profiles!reports_target_user_id_fkey(email, full_name), reporter:profiles!reports_reporter_id_fkey(email)').order('created_at', { ascending: false }).limit(30);
  document.getElementById('reportsList').innerHTML = (reps || []).map(r =>
    `<div class="row-item"><div class="row-main"><b>${r.auto_flag ? '🤖 Auto-moderación' : '🚩 Reporte manual'}</b>
     <small>Objetivo: ${r.target?.email || '—'} · Denunciante: ${r.reporter?.email || 'sistema'} · ${new Date(r.created_at).toLocaleString('es')}</small>
     <div class="dim">${r.detail || ''}</div>
     ${r.messages?.content ? `<div class="dim">💬 Mensaje: "…${r.messages.content}…"</div>` : ''}</div>
     <div class="row-actions">
       ${r.status === 'open' ? `<button class="btn-small" onclick="closeReport('${r.id}')">Descartar</button>` : '<span class="order-status st-delivered">Cerrado</span>'}
       ${r.target_user_id ? `<button class="btn-small danger" onclick="toggleBan('${r.target_user_id}',true)">🚫 Banear</button>` : ''}
     </div></div>`).join('')
    || '<p class="empty-state">Sin reportes 🎉</p>';
}
async function resolvePanic(id) {
  await db.from('panic_alerts').update({ status: 'resolved' }).eq('id', id);
  await db.rpc('log_admin_action', { p_action: 'panic_resolve', p_target: id, p_detail: 'Alerta atendida' });
  showToast('✅ Alerta marcada como resuelta'); loadSafety();
}
async function closeReport(id) {
  await db.from('reports').update({ status: 'closed' }).eq('id', id);
  showToast('Reporte descartado'); loadSafety();
}

// ===== RECARGAS =====
async function loadRechargeRequests() {
  const { data } = await db.from('recharge_requests').select('*, profiles(email, full_name)').order('created_at', { ascending: false });
  const pend = (data || []).filter(r => r.status === 'pending');
  const rest = (data || []).filter(r => r.status !== 'pending');
  document.getElementById('rechargeRequestsList').innerHTML =
    pend.map(r => `<div class="row-item"><div class="row-main"><b>${r.profiles?.full_name} · ◈ ${r.amount}</b>
      <small>${r.profiles?.email} · ${r.method} · Ref: ${r.reference || '—'}</small>
      ${r.proof_url ? `<img class="kyc-img" src="${r.proof_url}" onclick="window.open('${r.proof_url}')">` : '⚠️ sin captura'}</div>
      <div class="row-actions"><button class="btn-small success" onclick="approveRecharge('${r.id}')">✅ Aprobar</button><button class="btn-small danger" onclick="rejectRecharge('${r.id}')">❌</button></div></div>`).join('')
    + rest.slice(0, 10).map(r => `<div class="row-item"><div class="row-main"><b>${r.profiles?.full_name} · ◈ ${r.amount}</b><small>${new Date(r.created_at).toLocaleString('es')}</small></div>
      <span class="order-status ${r.status === 'approved' ? 'st-delivered' : 'st-cancelled'}">${r.status === 'approved' ? 'Aprobada' : 'Rechazada'}</span></div>`).join('')
    || '<p class="empty-state">Sin solicitudes de recarga</p>';
}
async function approveRecharge(id) {
  const { data: r } = await db.from('recharge_requests').select('*, profiles(email, is_active)').eq('id', id).single();
  if (!r || r.status !== 'pending') return;
  if (!confirm('Confirma que recibiste ◈ ' + r.amount + ' (' + r.method + ', ref ' + (r.reference || '—') + ') de ' + r.profiles?.email + '. ¿Aprobar?')) return;
  await db.rpc('credit_tokens', { p_to: r.user_id, p_amount: parseFloat(r.amount), p_desc: 'Recarga verificada (' + r.method + ')' });
  await db.from('recharge_requests').update({ status: 'approved', verified_by: 'manual' }).eq('id', id);
  if (parseFloat(r.amount) >= 3 && !r.profiles?.is_active) {
    await db.from('profiles').update({ is_active: true }).eq('id', r.user_id);
    await db.rpc('claim_referral_reward', { p_referee: r.user_id });
  }
  await db.rpc('log_admin_action', { p_action: 'recharge_approve', p_target: r.profiles?.email || id, p_detail: '◈ ' + r.amount });
  showToast('✅ Recarga aprobada y acreditada'); loadRechargeRequests(); loadAdminOverview();
}
async function rejectRecharge(id) {
  const note = prompt('Razón del rechazo (la verá el usuario):');
  if (note === null) return;
  const { data: r } = await db.from('recharge_requests').select('*, profiles(email)').eq('id', id).single();
  await db.from('recharge_requests').update({ status: 'rejected', note, verified_by: 'manual' }).eq('id', id);
  await db.rpc('log_admin_action', { p_action: 'recharge_reject', p_target: r?.profiles?.email || id, p_detail: note || 'sin razón' });
  showToast('❌ Solicitud rechazada'); loadRechargeRequests();
}

// ===== TOKENS / CONTENIDO / RETIROS =====
async function adminAdjustTokens() {
  const email = document.getElementById('adminTokenEmail').value.trim().toLowerCase();
  const amount = parseFloat(document.getElementById('adminTokenAmount').value);
  if (!email || !amount) { showToast('Completa email y cantidad'); return; }
  const { data: u } = await db.from('profiles').select('*').eq('email', email).single();
  if (!u) { showToast('❌ No encontrado'); return; }
  await db.from('profiles').update({ tokens_balance: parseFloat(u.tokens_balance || 0) + amount }).eq('id', u.id);
  await db.from('token_transactions').insert({ user_id: u.id, amount, type: amount >= 0 ? 'recharge' : 'consumption', description: 'Ajuste del administrador' });
  await db.rpc('log_admin_action', { p_action: 'tokens_adjust', p_target: email, p_detail: (amount > 0 ? '+' : '') + amount });
  showToast('✅ Ajuste aplicado'); loadAdminTransactions(); loadAdminOverview();
}
async function loadAdminTransactions() {
  const { data } = await db.from('token_transactions').select('*, profiles(email)').order('created_at', { ascending: false }).limit(50);
  document.getElementById('adminTransactions').innerHTML = (data || []).map(t =>
    `<div class="tx-item"><div><b>${t.profiles?.email || '—'}</b><small>${t.description || t.type}</small></div><span class="tx-amount ${t.amount >= 0 ? 'positive' : 'negative'}">${t.amount >= 0 ? '+' : ''}${t.amount}</span></div>`).join('')
    || '<p class="empty-state">Sin transacciones</p>';
}
async function loadAdminContent() {
  const [r, n, m] = await Promise.all([db.from('restaurants').select('id, name'), db.from('nightclubs').select('id, name'), db.from('marketplace_items').select('id, title')]);
  document.getElementById('adminRestaurants').innerHTML = (r.data || []).map(x => `<div class="row-item"><div class="row-main"><b>${x.name}</b></div><button class="btn-small danger" onclick="deleteContent('restaurants','${x.id}')">🗑</button></div>`).join('') || '<p class="empty-state">Vacío</p>';
  document.getElementById('adminNightclubs').innerHTML = (n.data || []).map(x => `<div class="row-item"><div class="row-main"><b>${x.name}</b></div><button class="btn-small danger" onclick="deleteContent('nightclubs','${x.id}')">🗑</button></div>`).join('') || '<p class="empty-state">Vacío</p>';
  document.getElementById('adminMarket').innerHTML = (m.data || []).map(x => `<div class="row-item"><div class="row-main"><b>${x.title}</b></div><button class="btn-small danger" onclick="deleteContent('marketplace_items','${x.id}')">🗑</button></div>`).join('') || '<p class="empty-state">Vacío</p>';
}
async function deleteContent(table, id) {
  if (!confirm('¿Eliminar definitivamente?')) return;
  await db.from(table).delete().eq('id', id);
  await db.rpc('log_admin_action', { p_action: 'delete_content', p_target: table + ':' + id, p_detail: 'Contenido eliminado' });
  showToast('🗑 Eliminado'); loadAdminContent();
}
async function loadAdminWithdrawals() {
  const { data } = await db.from('withdrawals').select('*, profiles(email, full_name)').order('created_at', { ascending: false });
  document.getElementById('withdrawalsAdmin').innerHTML = (data || []).map(w =>
    `<div class="row-item"><div class="row-main"><b>${w.profiles?.full_name} · ◈ ${w.amount}</b><small>${w.profiles?.email} · ${w.method}</small></div>
     <div class="row-actions">${w.status === 'pending' ? `<button class="btn-small success" onclick="resolveWithdrawal('${w.id}','approved')">✅</button><button class="btn-small danger" onclick="resolveWithdrawal('${w.id}','rejected')">↩️</button>` : `<span class="order-status ${w.status === 'approved' ? 'st-delivered' : 'st-cancelled'}">${w.status}</span>`}</div></div>`).join('')
    || '<p class="empty-state">Sin retiros</p>';
}
async function resolveWithdrawal(id, status) {
  const { data: w } = await db.from('withdrawals').select('*, profiles(email)').eq('id', id).single();
  if (!w || w.status !== 'pending') return;
  if (status === 'rejected') await db.rpc('credit_tokens', { p_to: w.user_id, p_amount: parseFloat(w.amount), p_desc: 'Retiro rechazado - reembolso' });
  await db.from('withdrawals').update({ status }).eq('id', id);
  await db.rpc('log_admin_action', { p_action: 'withdrawal_' + status, p_target: w.profiles?.email || id, p_detail: '◈ ' + w.amount });
  showToast(status === 'approved' ? '✅ Retiro aprobado' : '↩️ Rechazado y reembolsado'); loadAdminWithdrawals();
}

// ===== KYC =====
async function loadKycList() {
  const { data } = await db.from('profiles').select('*').eq('role', 'remote_worker').eq('kyc_status', 'pending').order('created_at', { ascending: false });
  document.getElementById('kycList').innerHTML = (data || []).map(u =>
    `<div class="row-item"><div class="row-main"><b>${u.full_name} · ${u.age || '?'} años</b>
     <small>${u.whatsapp || 'sin whatsapp'} · ${u.email}</small>
     <div>${u.id_card_url ? `<img class="kyc-img" src="${u.id_card_url}" onclick="window.open('${u.id_card_url}')">` : '⚠️ sin cédula'}
     ${u.face_photo_url ? `<img class="kyc-img" src="${u.face_photo_url}" onclick="window.open('${u.face_photo_url}')">` : '⚠️ sin rostro'}</div>
     ${u.whatsapp ? `<a class="btn-small" target="_blank" href="https://wa.me/${(u.whatsapp || '').replace(/[^0-9]/g, '')}">💬 WhatsApp</a>` : ''}</div>
     <div class="row-actions"><button class="btn-small success" onclick="approveKyc('${u.id}')">✅ Aprobar</button><button class="btn-small danger" onclick="rejectKyc('${u.id}')">❌</button></div></div>`).join('')
    || '<p class="empty-state">Nadie pendiente de KYC 🎉</p>';
}
async function approveKyc(id) {
  await db.from('profiles').update({ kyc_status: 'approved', is_verified: true, is_active: true }).eq('id', id);
  const u = (await db.from('profiles').select('email').eq('id', id).single()).data;
  await db.rpc('log_admin_action', { p_action: 'kyc_approve', p_target: u?.email || id, p_detail: 'KYC aprobado' });
  showToast('✅ Trabajadora verificada y activada'); loadKycList();
}
async function rejectKyc(id) {
  const note = prompt('Razón del rechazo (la verá la trabajadora):');
  if (!note) return;
  await db.from('profiles').update({ kyc_status: 'rejected', kyc_note: note }).eq('id', id);
  const u = (await db.from('profiles').select('email').eq('id', id).single()).data;
  await db.rpc('log_admin_action', { p_action: 'kyc_reject', p_target: u?.email || id, p_detail: note });
  showToast('❌ Rechazada con nota'); loadKycList();
}
async function loadWorkersAdmin() {
  const { data } = await db.from('profiles').select('*, role_details(*)').eq('role', 'remote_worker').eq('kyc_status', 'approved').order('full_name');
  const lv = await db.from('worker_levels').select('*').order('level');
  document.getElementById('adminWorkersList').innerHTML = (data || []).map(w => {
    const rd = w.role_details?.[0];
    return `<div class="row-item"><div class="row-main"><b>${w.full_name}</b><small>Nivel: ${levelInfo(rd?.worker_level).name} · ◈ ${rd?.rate_per_minute}/min · ⭐ ${w.rating}</small></div>
     <div class="row-actions">
       <select class="btn-small" onchange="setWorkerLevel('${w.id}', this.value)">
         ${(lv.data || []).map(l => `<option value="${l.level}" ${rd?.worker_level === l.level ? 'selected' : ''}>${l.level}. ${l.name} ($${l.rate})</option>`).join('')}
       </select>
       <input type="number" step="0.1" min="0.2" max="3" value="${rd?.rate_per_minute || 0.2}" style="width:80px" class="btn-small" id="rate_${w.id}">
       <button class="btn-small success" onclick="setWorkerRate('${w.id}')">💾</button>
     </div></div>`;
  }).join('') || '<p class="empty-state">Sin trabajadoras verificadas</p>';
}
async function setWorkerLevel(id, level) {
  const { data: l } = await db.from('worker_levels').select('*').eq('level', parseInt(level)).single();
  await db.from('role_details').update({ worker_level: l.level, rate_per_minute: l.rate }).eq('user_id', id);
  const u = (await db.from('profiles').select('email').eq('id', id).single()).data;
  await db.rpc('log_admin_action', { p_action: 'level_change', p_target: u?.email || id, p_detail: 'Nivel ' + l.name });
  showToast('✅ Nivel ' + l.name + ' asignado'); loadWorkersAdmin();
}
async function setWorkerRate(id) {
  const rate = parseFloat(document.getElementById('rate_' + id).value);
  if (isNaN(rate) || rate < 0.2 || rate > 3) { showToast('Tarifa permitida: 0.2 a 3 $/min'); return; }
  await db.from('role_details').update({ rate_per_minute: rate }).eq('user_id', id);
  const u = (await db.from('profiles').select('email').eq('id', id).single()).data;
  await db.rpc('log_admin_action', { p_action: 'rate_change', p_target: u?.email || id, p_detail: '◈ ' + rate + '/min' });
  showToast('✅ Tarifa: ◈ ' + rate + '/min'); loadWorkersAdmin();
}

// ===== KYC VIDEOLLAMADA + AUDITORÍA =====
function startKyc(userId, name) {
  kycTarget = userId;
  disposeKycApis();
  document.getElementById('kycTitle').textContent = '🎥 KYC: ' + name;
  document.getElementById('kycVerifyBtn').classList.remove('hidden');
  openModal('modal-kyc');
  window._kycAdmin = new JitsiMeetExternalAPI('meet.jit.si', { roomName: 'FENDYX_KYC_' + userId.slice(0, 8), width: '100%', height: '100%', parentNode: document.getElementById('kycContainer'), userInfo: { displayName: 'Admin FENDYX' } });
  showToast('🎥 Sala abierta. La usuaria entra desde su Perfil Pro.');
}
function disposeKycApis() { try { if (window._kycAdmin) { window._kycAdmin.dispose(); window._kycAdmin = null; } } catch (e) {} try { if (typeof kycApi !== 'undefined' && kycApi) { kycApi.dispose(); kycApi = null; } } catch (e) {} }
async function kycMarkVerified() {
  if (!kycTarget) return;
  await db.from('profiles').update({ is_verified: true, kyc_status: 'approved', is_active: true }).eq('id', kycTarget);
  showToast('✅ Verificada y activada'); kycTarget = null; closeKyc(); loadKycList();
}
function closeKyc() { disposeKycApis(); closeModal('modal-kyc'); }
async function runAudit() {
  const q = document.getElementById('auditSearch').value.trim();
  const box = document.getElementById('auditResults');
  if (q.length < 3) { box.innerHTML = '<p class="empty-state">Escribe al menos 3 caracteres</p>'; return; }
  const { data } = await db.from('messages').select('*, profiles!messages_sender_id_fkey(email)').ilike('content', '%' + q + '%').order('created_at', { ascending: false }).limit(50);
  box.innerHTML = (data || []).map(m =>
    `<div class="row-item audit-row"><div class="row-main"><b>${m.profiles?.email || '—'}</b><small>${new Date(m.created_at).toLocaleString('es')}</small><div>…${m.content}…</div></div>
     <button class="btn-small danger" onclick="toggleBan('${m.sender_id}',true)">🚫</button></div>`).join('')
    || '<p class="empty-state">Sin coincidencias</p>';
}
