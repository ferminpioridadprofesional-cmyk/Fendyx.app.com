'use strict';
let adminUsersCache = [], kycTarget = null;

async function loadAdmin() {
  if (currentProfile.role !== 'admin') { showSection('dashboard'); showToast('🚫 Acceso denegado'); return; }
  startSafetyRealtime();
  injectAdminExtras();
  loadAdminOverview();
}
function injectAdminExtras() {
  if (document.getElementById('adminPurgeRow')) return;
  const ov = document.getElementById('admin-overview');
  if (ov) ov.insertAdjacentHTML('beforeend', `
    <div id="adminPurgeRow" class="row-buttons" style="margin-top:16px;flex-wrap:wrap">
      <button class="btn-small danger" onclick="purgeActivity()">🗑 Purgar actividad</button>
      <button class="btn-small danger" onclick="purgeChats()">💬 Borrar TODOS los chats</button>
      <button class="btn-small danger" onclick="purgePanic()">🆘 Borrar pánico</button>
      <button class="btn-small danger" onclick="purgeCalls()">📞 Borrar llamadas</button>
    </div>`);
  if (!document.getElementById('modal-userfile')) {
    const m = document.createElement('div'); m.id = 'modal-userfile'; m.className = 'modal hidden';
    m.innerHTML = `<div class="modal-content wide"><div class="modal-head"><h3 id="ufTitle">Ficha</h3><button class="modal-close" onclick="closeModal('modal-userfile')">✕</button></div><div id="ufBody"></div></div>`;
    document.body.appendChild(m);
  }
}
async function purgeActivity() {
  if (!confirm('Se BORRARÁN actividad y transacciones. Los saldos NO se afectan. ¿Continuar?')) return;
  const { data, error } = await db.rpc('admin_purge_logs');
  if (error) { showToast('❌ ' + error.message); return; }
  showToast('🗑 Actividad purgada: ' + data); loadAdminOverview();
}
async function purgeChats() {
  if (!confirm('Se BORRARÁN TODOS los mensajes de TODOS los usuarios. ¿Continuar?')) return;
  const { data, error } = await db.rpc('admin_purge_chats');
  if (error) { showToast('❌ ' + error.message); return; }
  showToast('💬 Chats eliminados: ' + data);
}
async function purgePanic() {
  if (!confirm('Se BORRARÁ historial de alertas de pánico. ¿Continuar?')) return;
  const { data, error } = await db.rpc('admin_purge_panic');
  if (error) { showToast('❌ ' + error.message); return; }
  showToast('🆘 Pánico borrado: ' + data);
  if (document.getElementById('admin-safety')?.classList.contains('active')) loadSafety();
}
async function purgeCalls() {
  if (!confirm('Se BORRARÁ historial de videollamadas. ¿Continuar?')) return;
  const { data, error } = await db.rpc('admin_purge_calls');
  if (error) { showToast('❌ ' + error.message); return; }
  showToast('📞 Llamadas borradas: ' + data); loadAdminOverview();
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
  await loadBranding(); showToast('✅ Logo actualizado');
}
async function saveAppName() {
  const name = document.getElementById('adminAppName').value.trim() || 'FENDYX';
  await db.from('app_branding').update({ app_name: name, updated_at: new Date().toISOString() }).eq('id', 1);
  await loadBranding(); showToast('✅ Nombre actualizado');
}

async function loadAdminUsers() {
  const { data } = await db.from('profiles').select('*').order('created_at', { ascending: false });
  adminUsersCache = data || [];
  renderAdminUsers();
}
function renderAdminUsers() {
  const q = (document.getElementById('adminUsersSearch').value || '').toLowerCase();
  const rows = adminUsersCache.filter(u => !q || (u.email || '').toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q) || (u.model_name || '').toLowerCase().includes(q));
  document.getElementById('adminUsersTable').innerHTML = rows.map(u => {
    const displayName = u.model_name ? `${u.model_name} <small class="dim">(${u.full_name || '—'})</small>` : (u.full_name || '—');
    return `<tr><td><b>${displayName}</b><br><small class="dim">${u.email}</small></td>
     <td><select class="btn-small" onchange="changeUserRole('${u.id}', this.value)" ${u.role === 'admin' ? 'disabled' : ''}>
        ${Object.entries(ROLE_LABELS).map(([k, v]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
     <td>${u.unlimited_tokens ? '∞' : parseFloat(u.tokens_balance || 0).toFixed(2)}${u.tokens_locked ? ' 🔒' : ''}${parseFloat(u.tokens_retained || 0) > 0 ? ' ⏸' + u.tokens_retained : ''}</td>
     <td>${u.is_banned ? '🚫 ' + (u.ban_reason || 'Baneado') : u.is_verified ? '✅' : '⏳'}</td>
     <td>
       <button class="btn-small" onclick="openUserFile('${u.id}')">👁 Ficha</button>
       <button class="btn-small" onclick="changeUserPass('${u.email}')">🔑</button>
       ${u.role !== 'admin' ? `<button class="btn-small danger" onclick="deleteUserFully('${u.id}','${(u.email || '').replace(/'/g, '')}')">🗑</button>` : ''}
       ${u.role !== 'admin' ? (u.is_banned ? `<button class="btn-small success" onclick="toggleBan('${u.id}',false)">Desbanear</button>` : `<button class="btn-small danger" onclick="toggleBan('${u.id}',true)">Banear</button>`) : ''}
     </td></tr>`;
  }).join('');
}
async function deleteUserFully(id, email) {
  if (!confirm('ELIMINAR POR COMPLETO a ' + email + ' de la BD. ¿Continuar?')) return;
  const { data, error } = await db.rpc('admin_delete_user', { p_uid: id });
  if (error || (data && data.startsWith('ERROR'))) { showToast('❌ ' + (data || error.message)); return; }
  showToast('🗑 Usuario eliminado'); loadAdminUsers(); loadAdminOverview();
}

async function openUserFile(id) {
  const u = adminUsersCache.find(x => x.id === id); if (!u) return;
  const [rd, orders, txs, reps, panics] = await Promise.all([
    db.from('role_details').select('*').eq('user_id', id).single(),
    db.from('orders').select('*', { count: 'exact', head: true }).eq('customer_id', id),
    db.from('token_transactions').select('*', { count: 'exact', head: true }).eq('user_id', id),
    db.from('reports').select('*', { count: 'exact', head: true }).eq('target_user_id', id),
    db.from('panic_alerts').select('*', { count: 'exact', head: true }).eq('user_id', id)
  ]);
  const d = rd.data || {};
  const lvNum = Math.min(5, Math.max(1, parseInt(d.worker_level) || 1));
  document.getElementById('ufTitle').textContent = '👁 Ficha: ' + (u.model_name || u.full_name || u.email);
  document.getElementById('ufBody').innerHTML = `
    <div class="dim" style="text-align:left">
      <b>Email:</b> ${u.email}<br>
      <b>Nombre real (cédula):</b> ${u.full_name || '—'}<br>
      <b>Nombre artístico:</b> ${u.model_name || '—'}<br>
      <b>Género:</b> ${u.gender || '—'} · <b>Edad:</b> ${u.age || '—'}<br>
      <b>WhatsApp:</b> ${u.whatsapp ? `<a target="_blank" href="https://wa.me/${(u.whatsapp || '').replace(/[^0-9]/g, '')}">${u.whatsapp}</a>` : '—'}<br>
      <b>Rol:</b> ${ROLE_LABELS[u.role]} · <b>KYC:</b> ${u.kyc_status} · <b>Verificado:</b> ${u.is_verified ? 'Sí' : 'No'}<br>
      ${u.role === 'remote_worker' ? `<b>Nivel:</b> ${levelBadge(lvNum)} · <b>Tarifa:</b> ◈ ${d.rate_per_minute || levelInfo(lvNum).rate}/min<br>` : ''}
      <b>Ocupación:</b> ${u.occupation || '—'} · <b>Zodiaco:</b> ${u.zodiac || '—'}<br>
      <b>Especialidad:</b> ${d.specialty || '—'}<br>
      <b>Intereses:</b> ${(u.interests || []).join(', ') || '—'}<br>
      <b>Preferencias:</b> ${(u.preferences || []).join(', ') || '—'}<br>
      <b>Bio:</b> ${u.bio || d.bio || '—'}<br>
      <b>Pedidos:</b> ${orders.count || 0} · <b>Transacciones:</b> ${txs.count || 0} · <b>Reportes:</b> ${reps.count || 0} · <b>Pánicos:</b> ${panics.count || 0}<br>
      ${u.id_card_url ? `<img class="kyc-img" src="${u.id_card_url}" onclick="window.open('${u.id_card_url}')">` : ''}
      ${u.face_photo_url ? `<img class="kyc-img" src="${u.face_photo_url}" onclick="window.open('${u.face_photo_url}')">` : ''}
      ${(u.gallery_urls || []).map(g => `<img class="kyc-img" src="${g}" onclick="window.open('${g}')">`).join('')}
    </div>
    ${u.role === 'remote_worker' ? `
    <h4 class="sub-title">🎭 Nombre artístico</h4>
    <div class="owner-form"><input type="text" id="ufModelName" placeholder="Nombre artístico" value="${u.model_name || ''}">
    <button class="btn-primary" onclick="saveModelName('${u.id}')">💾 Guardar nombre artístico</button></div>` : ''}
    <h4 class="sub-title">◈ Control de tokens</h4>
    <div class="owner-form" style="text-align:left">
      <div class="dim">Saldo: <b>${parseFloat(u.tokens_balance || 0).toFixed(2)}</b> · Bloqueado: <b>${u.tokens_locked ? 'SÍ 🔒' : 'No'}</b> · Retención: <b>${parseFloat(u.tokens_retained || 0).toFixed(2)}</b></div>
      <input type="number" id="ufBalance" step="0.01" placeholder="Nuevo saldo absoluto" value="${parseFloat(u.tokens_balance || 0).toFixed(2)}">
      <div class="row-buttons"><button class="btn-small success" onclick="ufAdj(1)">+ Sumar</button><button class="btn-small danger" onclick="ufAdj(-1)">− Restar</button></div>
      <input type="number" id="ufAdjAmt" step="0.01" placeholder="Monto a sumar/restar">
      <input type="number" id="ufRetained" step="0.01" placeholder="Retención (congelados)" value="${parseFloat(u.tokens_retained || 0).toFixed(2)}">
      <label class="check-line"><input type="checkbox" id="ufLocked" ${u.tokens_locked ? 'checked' : ''}> 🔒 Bloquear TODOS sus tokens</label>
      <input type="text" id="ufReason" placeholder="Razón del ajuste (auditoría)">
      <button class="btn-primary" onclick="saveUserTokens('${u.id}')">💾 Guardar tokens</button>
    </div>`;
  openModal('modal-userfile');
}
function ufAdj(sign) {
  const bal = document.getElementById('ufBalance');
  const amt = parseFloat(document.getElementById('ufAdjAmt').value) || 0;
  bal.value = (parseFloat(bal.value) + sign * amt).toFixed(2);
}
async function saveUserTokens(uid) {
  const balance = parseFloat(document.getElementById('ufBalance').value) || 0;
  const retained = parseFloat(document.getElementById('ufRetained').value) || 0;
  const locked = document.getElementById('ufLocked').checked;
  const reason = document.getElementById('ufReason').value || 'Ajuste manual';
  const { data, error } = await db.rpc('admin_set_tokens', { p_uid: uid, p_balance: balance, p_locked: locked, p_retained: retained, p_reason: reason });
  if (error || (data && data.startsWith('ERROR'))) { showToast('❌ ' + (data || error.message)); return; }
  showToast('✅ Tokens actualizados'); closeModal('modal-userfile'); loadAdminUsers();
}
async function saveModelName(uid) {
  const name = document.getElementById('ufModelName').value.trim();
  if (!name) { showToast('Escribe el nombre artístico'); return; }
  await db.from('profiles').update({ model_name: name }).eq('id', uid);
  showToast('✅ Nombre artístico guardado');
  const u = adminUsersCache.find(x => x.id === uid); if (u) u.model_name = name;
  closeModal('modal-userfile'); loadAdminUsers();
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
  await db.rpc('log_admin_action', { p_action: 'role_change', p_target: u.email, p_detail: u.role + '→' + newRole });
  showToast('✅ Rol cambiado'); loadAdminUsers();
}
async function changeUserPass(email) {
  const np = prompt('Nueva contraseña para ' + email + ' (mín 6):');
  if (np === null) return;
  if (np.length < 6) { showToast('❌ Mín 6'); return; }
  const np2 = prompt('Confirma:');
  if (np !== np2) { showToast('❌ No coinciden'); return; }
  const { data, error } = await db.rpc('admin_reset_password', { p_email: email, p_new: np });
  if (error || (data && data.startsWith('ERROR'))) { showToast('❌ ' + (data || error.message)); return; }
  showToast('✅ Contraseña cambiada');
}
async function toggleBan(id, ban) {
  let reason = null;
  if (ban) { reason = prompt('Razón del baneo (obligatoria):'); if (!reason || !reason.trim()) { showToast('Razón obligatoria'); return; } }
  await db.from('profiles').update({ is_banned: ban, ban_reason: ban ? reason.trim() : null }).eq('id', id);
  const u = adminUsersCache.find(x => x.id === id);
  await db.rpc('log_admin_action', { p_action: ban ? 'ban' : 'unban', p_target: u?.email || id, p_detail: ban ? reason.trim() : 'Rehabilitado' });
  showToast(ban ? '🚫 Baneado' : '✅ Desbaneado'); loadAdminUsers();
}

async function loadSafety() {
  const { data: panics } = await db.from('panic_alerts').select('*, profiles(email, full_name)').order('created_at', { ascending: false }).limit(20);
  document.getElementById('panicList').innerHTML = (panics || []).map(p =>
    `<div class="row-item"><div class="row-main"><b>🆘 ${p.profiles?.full_name || '—'}</b><small>${p.profiles?.email} · ${new Date(p.created_at).toLocaleString('es')}</small>
     ${p.latitude ? `<a class="btn-small" target="_blank" href="https://www.google.com/maps?q=${p.latitude},${p.longitude}">🗺️ Ubicación</a>` : ''}</div>
     <div class="row-actions">${p.status === 'active' ? `<button class="btn-small success" onclick="resolvePanic('${p.id}')">✅</button>` : '<span class="order-status st-delivered">Resuelta</span>'}<button class="btn-small danger" onclick="toggleBan('${p.user_id}',true)">🚫</button></div></div>`).join('')
    || '<p class="empty-state">Sin alertas 🎉</p>';
  const { data: reps } = await db.from('reports').select('*, messages(content), target:profiles!reports_target_user_id_fkey(email), reporter:profiles!reports_reporter_id_fkey(email)').order('created_at', { ascending: false }).limit(30);
  document.getElementById('reportsList').innerHTML = (reps || []).map(r =>
    `<div class="row-item"><div class="row-main"><b>${r.auto_flag ? '🤖 Auto' : '🚩 Manual'}</b><small>Objetivo: ${r.target?.email || '—'} · ${new Date(r.created_at).toLocaleString('es')}</small><div class="dim">${r.detail || ''}</div>${r.messages?.content ? `<div class="dim">💬 "…${r.messages.content}…"</div>` : ''}</div>
     <div class="row-actions">${r.status === 'open' ? `<button class="btn-small" onclick="closeReport('${r.id}')">Descartar</button>` : '<span class="order-status st-delivered">Cerrado</span>'}${r.target_user_id ? `<button class="btn-small danger" onclick="toggleBan('${r.target_user_id}',true)">🚫</button>` : ''}</div></div>`).join('')
    || '<p class="empty-state">Sin reportes 🎉</p>';
}
async function resolvePanic(id) { await db.from('panic_alerts').update({ status: 'resolved' }).eq('id', id); showToast('✅ Resuelta'); loadSafety(); }
async function closeReport(id) { await db.from('reports').update({ status: 'closed' }).eq('id', id); showToast('Descartado'); loadSafety(); }

async function loadRechargeRequests() {
  const { data } = await db.from('recharge_requests').select('*, profiles(email, full_name)').order('created_at', { ascending: false });
  const pend = (data || []).filter(r => r.status === 'pending');
  const rest = (data || []).filter(r => r.status !== 'pending');
  document.getElementById('rechargeRequestsList').innerHTML =
    pend.map(r => `<div class="row-item"><div class="row-main"><b>${r.profiles?.full_name} · ◈ ${r.amount}</b><small>${r.profiles?.email} · ${r.method} · Ref: ${r.reference || '—'}</small>${r.proof_url ? `<img class="kyc-img" src="${r.proof_url}" onclick="window.open('${r.proof_url}')">` : ''}</div>
      <div class="row-actions"><button class="btn-small success" onclick="approveRecharge('${r.id}')">✅</button><button class="btn-small danger" onclick="rejectRecharge('${r.id}')">❌</button></div></div>`).join('')
    + rest.slice(0, 10).map(r => `<div class="row-item"><div class="row-main"><b>${r.profiles?.full_name} · ◈ ${r.amount}</b></div><span class="order-status ${r.status === 'approved' ? 'st-delivered' : 'st-cancelled'}">${r.status}</span></div>`).join('')
    || '<p class="empty-state">Sin solicitudes</p>';
}
async function approveRecharge(id) {
  const { data: r } = await db.from('recharge_requests').select('*, profiles(email, is_active)').eq('id', id).single();
  if (!r || r.status !== 'pending') return;
  if (!confirm('¿Confirmas que recibiste ◈ ' + r.amount + ' de ' + r.profiles?.email + '?')) return;
  await db.rpc('credit_tokens', { p_to: r.user_id, p_amount: parseFloat(r.amount), p_desc: 'Recarga verificada (' + r.method + ')' });
  await db.from('recharge_requests').update({ status: 'approved', verified_by: 'manual' }).eq('id', id);
  if (parseFloat(r.amount) >= 3 && !r.profiles?.is_active) { await db.from('profiles').update({ is_active: true }).eq('id', r.user_id); await db.rpc('claim_referral_reward', { p_referee: r.user_id }); }
  await db.rpc('log_admin_action', { p_action: 'recharge_approve', p_target: r.profiles?.email || id, p_detail: '◈ ' + r.amount });
  showToast('✅ Aprobada'); loadRechargeRequests(); loadAdminOverview();
}
async function rejectRecharge(id) {
  const note = prompt('Razón del rechazo:'); if (note === null) return;
  const { data: r } = await db.from('recharge_requests').select('*, profiles(email)').eq('id', id).single();
  await db.from('recharge_requests').update({ status: 'rejected', note, verified_by: 'manual' }).eq('id', id);
  await db.rpc('log_admin_action', { p_action: 'recharge_reject', p_target: r?.profiles?.email || id, p_detail: note });
  showToast('❌ Rechazada'); loadRechargeRequests();
}

async function adminAdjustTokens() {
  const email = document.getElementById('adminTokenEmail').value.trim().toLowerCase();
  const amount = parseFloat(document.getElementById('adminTokenAmount').value);
  if (!email || !amount) { showToast('Completa email y cantidad'); return; }
  const { data: u } = await db.from('profiles').select('*').eq('email', email).single();
  if (!u) { showToast('❌ No encontrado'); return; }
  await db.from('profiles').update({ tokens_balance: parseFloat(u.tokens_balance || 0) + amount }).eq('id', u.id);
  await db.from('token_transactions').insert({ user_id: u.id, amount, type: amount >= 0 ? 'recharge' : 'consumption', description: 'Ajuste admin' });
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
async function deleteContent(table, id) { if (!confirm('¿Eliminar?')) return; await db.from(table).delete().eq('id', id); showToast('🗑 Eliminado'); loadAdminContent(); }

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
  showToast(status === 'approved' ? '✅ Aprobado' : '↩️ Rechazado'); loadAdminWithdrawals();
}

async function loadKycList() {
  const { data } = await db.from('profiles').select('*').eq('role', 'remote_worker').eq('kyc_status', 'pending').order('created_at', { ascending: false });
  document.getElementById('kycList').innerHTML = (data || []).map(u =>
    `<div class="row-item"><div class="row-main"><b>${u.model_name || u.full_name || '—'} ${u.age ? '· ' + u.age + ' años' : ''}</b><small>Real: ${u.full_name || '—'} · ${u.email}</small>
     <div>${u.id_card_url ? `<img class="kyc-img" src="${u.id_card_url}" onclick="window.open('${u.id_card_url}')">` : '⚠️ sin cédula'}${u.face_photo_url ? `<img class="kyc-img" src="${u.face_photo_url}" onclick="window.open('${u.face_photo_url}')">` : ''}</div>
     ${u.whatsapp ? `<a class="btn-small" target="_blank" href="https://wa.me/${(u.whatsapp || '').replace(/[^0-9]/g, '')}">💬</a>` : ''}</div>
     <div class="row-actions"><button class="btn-small success" onclick="startKyc('${u.id}','${(u.model_name || u.full_name || '').replace(/'/g, '')}')">🎥</button><button class="btn-small success" onclick="approveKyc('${u.id}')">✅</button><button class="btn-small danger" onclick="rejectKyc('${u.id}')">❌</button></div></div>`).join('')
    || '<p class="empty-state">Nadie pendiente 🎉</p>';
}
async function approveKyc(id) { await db.from('profiles').update({ kyc_status: 'approved', is_verified: true, is_active: true }).eq('id', id); showToast('✅ Verificada'); loadKycList(); }
async function rejectKyc(id) { const note = prompt('Razón:'); if (!note) return; await db.from('profiles').update({ kyc_status: 'rejected', kyc_note: note }).eq('id', id); showToast('❌ Rechazada'); loadKycList(); }
async function startKyc(userId, name) {
  kycTarget = userId; await loadScript('calls.js');
  document.getElementById('kycTitle').textContent = '🎥 KYC: ' + name;
  document.getElementById('kycVerifyBtn').classList.remove('hidden');
  await startWebCall('FENDYX_KYC_' + userId.slice(0, 8), { rate: 0, rowId: null, asClient: true });
}
async function kycMarkVerified() { if (!kycTarget) return; await db.from('profiles').update({ is_verified: true, kyc_status: 'approved', is_active: true }).eq('id', kycTarget); showToast('✅ Verificada'); kycTarget = null; loadKycList(); }
function closeKyc() { if (typeof callRoom !== 'undefined' && callRoom) endWebCall(); else closeModal('modal-kyc'); }

// TRABAJADORAS: nivel con icono distintivo + actualización en tiempo real (vía core)
async function loadWorkersAdmin() {
  const { data } = await db.from('profiles').select('*, role_details(*)').eq('role', 'remote_worker').eq('kyc_status', 'approved').order('full_name');
  let lv = Object.values(LEVEL_META);
  try { const r = await db.from('worker_levels').select('*').order('level'); if (r.data && r.data.length) lv = r.data; } catch (e) {}
  document.getElementById('adminWorkersList').innerHTML = (data || []).map(w => {
    const rd = w.role_details?.[0];
    const cur = Math.min(5, Math.max(1, parseInt(rd?.worker_level) || 1));
    const curRate = parseFloat(rd?.rate_per_minute) || levelInfo(cur).rate;
    return `<div class="row-item"><div class="row-main"><b>${w.model_name || w.full_name}</b><small>Real: ${w.full_name} · ${levelBadge(cur)} · ◈ ${curRate}/min · ⭐ ${w.rating || 5}</small></div>
     <div class="row-actions">
       <select class="btn-small" onchange="setWorkerLevel('${w.id}', this.value)">
         ${lv.map(l => `<option value="${l.level}" ${cur === l.level ? 'selected' : ''}>${l.level}. ${l.name} ($${l.rate})</option>`).join('')}
       </select>
       <input type="number" step="0.1" min="0.2" max="3" value="${curRate}" style="width:80px" class="btn-small" id="rate_${w.id}">
       <button class="btn-small success" onclick="setWorkerRate('${w.id}')">💾</button>
     </div></div>`;
  }).join('') || '<p class="empty-state">Sin trabajadoras</p>';
}
async function setWorkerLevel(id, level) {
  let lvl = LEVEL_META[parseInt(level)] || LEVEL_META[1];
  try { const r = await db.from('worker_levels').select('*').eq('level', parseInt(level)).single(); if (r.data) lvl = r.data; } catch (e) {}
  await db.from('role_details').update({ worker_level: lvl.level, rate_per_minute: lvl.rate }).eq('user_id', id);
  showToast('✅ ' + lvl.name); loadWorkersAdmin();
}
async function setWorkerRate(id) {
  const rate = parseFloat(document.getElementById('rate_' + id).value);
  if (isNaN(rate) || rate < 0.2 || rate > 3) { showToast('Rango 0.2 a 3'); return; }
  await db.from('role_details').update({ rate_per_minute: rate }).eq('user_id', id);
  showToast('✅ Tarifa: ◈ ' + rate + '/min'); loadWorkersAdmin();
}

async function runAudit() {
  const q = document.getElementById('auditSearch').value.trim();
  const box = document.getElementById('auditResults');
  if (q.length < 3) { box.innerHTML = '<p class="empty-state">Mín 3 caracteres</p>'; return; }
  const { data } = await db.from('messages').select('*, profiles!messages_sender_id_fkey(email)').ilike('content', '%' + q + '%').order('created_at', { ascending: false }).limit(50);
  box.innerHTML = (data || []).map(m => `<div class="row-item"><div class="row-main"><b>${m.profiles?.email || '—'}</b><div>…${m.content}…</div></div><button class="btn-small danger" onclick="toggleBan('${m.sender_id}',true)">🚫</button></div>`).join('') || '<p class="empty-state">Sin coincidencias</p>';
}
