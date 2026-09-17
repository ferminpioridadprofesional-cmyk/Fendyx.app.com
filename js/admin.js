'use strict';
let adminUsersCache = [], kycTarget = null;
const LEVELS = [
  { level: 1, ico: '🥉', name: 'Bronce', rate: 0.2 }, { level: 2, ico: '🥈', name: 'Plata', rate: 0.7 },
  { level: 3, ico: '🥇', name: 'Oro', rate: 1.2 }, { level: 4, ico: '💠', name: 'Platino', rate: 2.0 },
  { level: 5, ico: '💎', name: 'Diamante', rate: 3.0 }
];
async function loadAdmin() { if (currentProfile.role !== 'admin') { showSection('dashboard'); showToast('🚫 Acceso denegado'); return; } startSafetyRealtime(); injectAdminExtras(); loadAdminOverview(); }
function injectAdminExtras() {
  if (document.getElementById('adminPurgeRow')) return;
  const ov = document.getElementById('admin-overview');
  if (ov) ov.insertAdjacentHTML('beforeend', `<div id="adminPurgeRow" class="row-buttons" style="margin-top:16px;flex-wrap:wrap">
      <button class="btn-small danger" onclick="purgeActivity()">🗑 Purgar actividad</button>
      <button class="btn-small danger" onclick="purgeChats()">💬 Borrar TODOS los chats</button>
      <button class="btn-small danger" onclick="purgePanic()">🆘 Borrar pánico</button>
      <button class="btn-small danger" onclick="purgeCalls()">📞 Borrar llamadas</button></div>`);
  if (!document.getElementById('modal-userfile')) { const m = document.createElement('div'); m.id = 'modal-userfile'; m.className = 'modal hidden'; m.innerHTML = `<div class="modal-content wide"><div class="modal-head"><h3 id="ufTitle">Ficha</h3><button class="modal-close" onclick="closeModal('modal-userfile')">✕</button></div><div id="ufBody"></div></div>`; document.body.appendChild(m); }
  const tabs = document.querySelector('.admin-tabs');
  if (tabs && !tabs.querySelector('[data-rates-tab]')) { tabs.insertAdjacentHTML('beforeend', `<button class="admin-tab" data-rates-tab onclick="switchAdminTab('rates',this)">💰 Tarifas</button>`); const pr = document.createElement('div'); pr.id = 'admin-rates'; pr.className = 'admin-panel'; pr.innerHTML = `<p class="dim">Ganancia NETA de la modelo por minuto en cada nivel. El cliente paga automáticamente el DOBLE.</p><div id="levelsRateList" class="list-compact"></div>`; document.getElementById('section-admin').appendChild(pr); }
  if (tabs && !tabs.querySelector('[data-workers-tab]')) { tabs.insertAdjacentHTML('beforeend', `<button class="admin-tab" data-workers-tab onclick="switchAdminTab('workers',this)">💃 Trabajadoras</button>`); const p1 = document.createElement('div'); p1.id = 'admin-workers'; p1.className = 'admin-panel'; p1.innerHTML = `<p class="dim">Asigna nivel y tarifa individual.</p><div id="adminWorkersList" class="list-compact"></div>`; document.getElementById('section-admin').appendChild(p1); }
  if (tabs && !tabs.querySelector('[data-recharges-tab]')) { tabs.insertAdjacentHTML('beforeend', `<button class="admin-tab" data-recharges-tab onclick="switchAdminTab('recharges',this)">💳 Recargas</button>`); const p2 = document.createElement('div'); p2.id = 'admin-recharges'; p2.className = 'admin-panel'; p2.innerHTML = `<div id="rechargeRequestsList" class="list-compact"></div>`; document.getElementById('section-admin').appendChild(p2); }
  if (tabs && !tabs.querySelector('[data-safety-tab]')) { tabs.insertAdjacentHTML('beforeend', `<button class="admin-tab" data-safety-tab onclick="switchAdminTab('safety',this)">🚨 Seguridad</button>`); const p3 = document.createElement('div'); p3.id = 'admin-safety'; p3.className = 'admin-panel'; p3.innerHTML = `<h3 class="sub-title">🆘 Pánico</h3><div id="panicList" class="list-compact"></div><h3 class="sub-title">🚩 Reportes</h3><div id="reportsList" class="list-compact"></div>`; document.getElementById('section-admin').appendChild(p3); }
  if (tabs && !tabs.querySelector('[data-modules-tab]')) { tabs.insertAdjacentHTML('beforeend', `<button class="admin-tab" data-modules-tab onclick="switchAdminTab('modules',this)">🧩 Apartados</button>`); const p4 = document.createElement('div'); p4.id = 'admin-modules'; p4.className = 'admin-panel'; p4.innerHTML = `<p class="dim">Activa, marca "próximamente" u oculta cada apartado.</p><div id="modulesConfigList" class="list-compact"></div>`; document.getElementById('section-admin').appendChild(p4); }
  if (tabs && !tabs.querySelector('[data-supervision-tab]')) { tabs.insertAdjacentHTML('beforeend', `<button class="admin-tab" data-supervision-tab onclick="switchAdminTab('supervision',this)">👁 Supervisión</button>`); const p5 = document.createElement('div'); p5.id = 'admin-supervision'; p5.className = 'admin-panel'; p5.innerHTML = `<p class="dim">Llamadas en vivo. Mosaico invisible.</p><div id="liveCallsList" class="list-compact"></div>`; document.getElementById('section-admin').appendChild(p5); }
}
async function purgeActivity() { if (!confirm('¿Borrar actividad y transacciones? Los saldos NO se afectan.')) return; const { data, error } = await db.rpc('admin_purge_logs'); if (error) return showToast('❌ ' + error.message); showToast('🗑 Purgado: ' + data); loadAdminOverview(); }
async function purgeChats() { if (!confirm('¿Borrar TODOS los chats?')) return; const { data, error } = await db.rpc('admin_purge_chats'); if (error) return showToast('❌ ' + error.message); showToast('💬 Eliminados: ' + data); }
async function purgePanic() { if (!confirm('¿Borrar historial de pánico?')) return; const { data, error } = await db.rpc('admin_purge_panic'); if (error) return showToast('❌ ' + error.message); showToast('🆘 Borrado: ' + data); if (document.getElementById('admin-safety')?.classList.contains('active')) loadSafety(); }
async function purgeCalls() { if (!confirm('¿Borrar historial de llamadas?')) return; const { data, error } = await db.rpc('admin_purge_calls'); if (error) return showToast('❌ ' + error.message); showToast('📞 Borrado: ' + data); loadAdminOverview(); }
function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active')); btn.classList.add('active');
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('admin-' + tab)?.classList.add('active');
  const loaders = { overview: loadAdminOverview, users: loadAdminUsers, tokens: loadAdminTransactions, content: loadAdminContent, withdrawals: loadAdminWithdrawals, kyc: loadKycList, workers: loadWorkersAdmin, recharges: loadRechargeRequests, safety: loadSafety, modules: loadApartados, supervision: loadSupervision, rates: loadLevelsAdmin };
  loaders[tab]?.();
}
function startSafetyRealtime() { if (window._safetyCh) return; window._safetyCh = db.channel('fendyx-safety').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'panic_alerts' }, () => { if (document.getElementById('admin-safety')?.classList.contains('active')) loadSafety(); }).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, () => { if (document.getElementById('admin-safety')?.classList.contains('active')) loadSafety(); }).subscribe(); }
async function loadAdminOverview() {
  const [u, o, c, tx] = await Promise.all([db.from('profiles').select('tokens_balance'), db.from('orders').select('*', { count: 'exact', head: true }), db.from('video_calls').select('*', { count: 'exact', head: true }), db.from('token_transactions').select('*, profiles(email)').order('created_at', { ascending: false }).limit(8)]);
  const users = u.data || [];
  document.getElementById('kpiUsers').textContent = users.length;
  document.getElementById('kpiTokens').textContent = users.reduce((s, p) => s + parseFloat(p.tokens_balance || 0), 0).toFixed(0);
  document.getElementById('kpiOrders').textContent = o.count || 0;
  document.getElementById('kpiCalls').textContent = c.count || 0;
  document.getElementById('activityFeed').innerHTML = (tx.data || []).map(x => `<div class="tx-item"><div><b>${x.profiles?.email || '—'}</b><small>${x.description || x.type}</small></div><span class="tx-amount ${x.amount >= 0 ? 'positive' : 'negative'}">${x.amount >= 0 ? '+' : ''}${x.amount}</span></div>`).join('') || '<p class="empty-state">Sin actividad</p>';
}
async function uploadLogo(e) { const f = e.target.files[0]; if (!f) return; const p = 'logo/logo_' + Date.now() + '.' + f.name.split('.').pop(); const { error } = await db.storage.from('fendyx-assets').upload(p, f); if (error) return showToast('❌ ' + error.message); await db.from('app_branding').update({ logo_url: db.storage.from('fendyx-assets').getPublicUrl(p).data.publicUrl, updated_at: new Date().toISOString() }).eq('id', 1); await loadBranding(); showToast('✅ Logo actualizado'); }
async function saveAppName() { const n = document.getElementById('adminAppName').value.trim() || 'FENDYX'; await db.from('app_branding').update({ app_name: n, updated_at: new Date().toISOString() }).eq('id', 1); await loadBranding(); showToast('✅ Nombre actualizado'); }

// ===== TARIFAS POR NIVEL (estandarizar ganancia) =====
async function loadLevelsAdmin() {
  let rates = {};
  try { const { data } = await db.from('worker_levels').select('*'); (data || []).forEach(r => rates[r.level] = parseFloat(r.rate)); } catch (e) {}
  document.getElementById('levelsRateList').innerHTML = LEVELS.map(l => {
    const cur = rates[l.level] != null ? rates[l.level] : l.rate;
    return `<div class="row-item"><div class="row-main"><b>${l.ico} ${l.name}</b><small>Modelo gana ◈ ${cur}/min · Cliente paga ◈ ${(cur * 2).toFixed(2)}/min</small></div>
      <div class="row-actions"><input type="number" step="0.1" min="0.1" max="50" value="${cur}" style="width:90px" class="btn-small" id="lvlrate_${l.level}">
      <button class="btn-small success" onclick="saveLevelRate(${l.level})">💾</button></div></div>`;
  }).join('');
}
async function saveLevelRate(level) {
  const rate = parseFloat(document.getElementById('lvlrate_' + level).value);
  if (isNaN(rate) || rate < 0.1 || rate > 50) return showToast('Rango 0.1 a 50');
  const { data, error } = await db.rpc('admin_set_level_rate', { p_level: level, p_rate: rate });
  if (error || (data && data.startsWith('ERROR'))) return showToast('❌ ' + (data || error.message));
  showToast('✅ Nivel actualizado: modelo ◈' + rate + ' / cliente ◈' + (rate * 2).toFixed(2));
  loadLevelsAdmin(); loadWorkersAdmin();
}

async function loadAdminUsers() { const { data } = await db.from('profiles').select('*').order('created_at', { ascending: false }); adminUsersCache = data || []; renderAdminUsers(); }
function renderAdminUsers() {
  const q = (document.getElementById('adminUsersSearch').value || '').toLowerCase();
  const rows = adminUsersCache.filter(u => !q || (u.email || '').toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q) || (u.model_name || '').toLowerCase().includes(q));
  document.getElementById('adminUsersTable').innerHTML = rows.map(u => {
    const dn = u.model_name ? `${u.model_name} <small class="dim">(${u.full_name || '—'})</small>` : (u.full_name || '—');
    return `<tr><td><b>${dn}</b><br><small class="dim">${u.email}</small></td>
     <td><select class="btn-small" onchange="changeUserRole('${u.id}', this.value)" ${u.role === 'admin' ? 'disabled' : ''}>${Object.entries(ROLE_LABELS).map(([k, v]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
     <td>${u.unlimited_tokens ? '∞' : parseFloat(u.tokens_balance || 0).toFixed(2)}${u.tokens_locked ? ' 🔒' : ''}</td>
     <td>${u.is_banned ? '🚫' : u.is_verified ? '✅' : '⏳'} ${u.is_active ? '🟢' : ''}</td>
     <td><button class="btn-small" onclick="openUserFile('${u.id}')">👁</button> <button class="btn-small" onclick="changeUserPass('${u.email}')">🔑</button>
     ${u.role !== 'admin' ? `<button class="btn-small ${u.is_active ? 'warn' : 'success'}" onclick="toggleActive('${u.id}',${!u.is_active})">${u.is_active ? '⛔ Desactivar' : '✅ Activar'}</button>` : ''}
     ${u.role !== 'admin' ? `<button class="btn-small danger" onclick="deleteUserFully('${u.id}','${(u.email || '').replace(/'/g, '')}')">🗑</button>` : ''}
     ${u.role !== 'admin' ? (u.is_banned ? `<button class="btn-small success" onclick="toggleBan('${u.id}',false)">Desbanear</button>` : `<button class="btn-small danger" onclick="toggleBan('${u.id}',true)">Banear</button>`) : ''}</td></tr>`;
  }).join('');
}
async function toggleActive(id, on) {
  const { data, error } = await db.rpc('admin_set_active', { p_uid: id, p_active: on });
  if (error || (data && data.startsWith('ERROR'))) return showToast('❌ ' + (data || error.message));
  showToast(on ? '✅ Cuenta activada' : '⛔ Cuenta desactivada');
  loadAdminUsers();
}
async function deleteUserFully(id, email) { if (!confirm('ELIMINAR POR COMPLETO a ' + email + '?')) return; const { data, error } = await db.rpc('admin_delete_user', { p_uid: id }); if (error || (data && data.startsWith('ERROR'))) return showToast('❌ ' + (data || error.message)); showToast('🗑 Eliminado'); loadAdminUsers(); loadAdminOverview(); }
async function openUserFile(id) {
  const u = adminUsersCache.find(x => x.id === id); if (!u) return;
  const [rd, orders, txs, reps, panics] = await Promise.all([db.from('role_details').select('*').eq('user_id', id).single(), db.from('orders').select('*', { count: 'exact', head: true }).eq('customer_id', id), db.from('token_transactions').select('*', { count: 'exact', head: true }).eq('user_id', id), db.from('reports').select('*', { count: 'exact', head: true }).eq('target_user_id', id), db.from('panic_alerts').select('*', { count: 'exact', head: true }).eq('user_id', id)]);
  const d = rd.data || {}; const lvNum = Math.min(5, Math.max(1, parseInt(d.worker_level) || 1));
  document.getElementById('ufTitle').textContent = '👁 Ficha: ' + (u.model_name || u.full_name || u.email);
  document.getElementById('ufBody').innerHTML = `<div class="dim" style="text-align:left">
    <b>Email:</b> ${u.email}<br><b>Real:</b> ${u.full_name || '—'}<br><b>Artístico:</b> ${u.model_name || '—'}<br>
    <b>Género:</b> ${u.gender || '—'} · <b>Edad:</b> ${u.age || '—'}<br>
    <b>WhatsApp:</b> ${u.whatsapp || '—'}<br><b>Rol:</b> ${ROLE_LABELS[u.role]} · <b>KYC:</b> ${u.kyc_status}<br>
    <b>Estado:</b> ${u.is_active ? '🟢 Activa' : '⛔ Desactivada'} · ${u.is_banned ? '🚫 Baneada' : '✔ Sin baneo'}<br>
    ${u.role === 'remote_worker' ? `<b>Nivel:</b> ${levelBadge(lvNum)} · <b>Gana:</b> ◈ ${d.rate_per_minute || LEVELS[lvNum - 1].rate}/min · <b>Cliente paga:</b> ◈ ${((d.rate_per_minute || LEVELS[lvNum - 1].rate) * 2).toFixed(2)}/min<br>` : ''}
    <b>Pedidos:</b> ${orders.count || 0} · <b>Transacc:</b> ${txs.count || 0} · <b>Reportes:</b> ${reps.count || 0}<br>
    ${u.id_card_url ? `<img class="kyc-img" src="${u.id_card_url}">` : ''}${u.face_photo_url ? `<img class="kyc-img" src="${u.face_photo_url}">` : ''}</div>
    <div class="row-buttons" style="margin-top:10px">
      ${u.role !== 'admin' ? `<button class="btn-small ${u.is_active ? 'warn' : 'success'}" onclick="toggleActive('${u.id}',${!u.is_active});closeModal('modal-userfile')">${u.is_active ? '⛔ Desactivar cuenta' : '✅ Activar cuenta'}</button>` : ''}
    </div>
    ${u.role === 'remote_worker' ? `<h4 class="sub-title">🎭 Nombre artístico</h4><div class="owner-form"><input type="text" id="ufModelName" value="${u.model_name || ''}"><button class="btn-primary" onclick="saveModelName('${u.id}')">💾 Guardar</button></div>` : ''}
    <h4 class="sub-title">◈ Tokens</h4><div class="owner-form" style="text-align:left">
    <div class="dim">Saldo <b>${parseFloat(u.tokens_balance || 0).toFixed(2)}</b> · 🔒 <b>${u.tokens_locked ? 'SÍ' : 'No'}</b> · ⏸ <b>${parseFloat(u.tokens_retained || 0).toFixed(2)}</b></div>
    <input type="number" id="ufBalance" step="0.01" value="${parseFloat(u.tokens_balance || 0).toFixed(2)}">
    <div class="row-buttons"><button class="btn-small success" onclick="ufAdj(1)">+</button><button class="btn-small danger" onclick="ufAdj(-1)">−</button></div>
    <input type="number" id="ufAdjAmt" step="0.01" placeholder="Monto">
    <input type="number" id="ufRetained" step="0.01" value="${parseFloat(u.tokens_retained || 0).toFixed(2)}">
    <label class="check-line"><input type="checkbox" id="ufLocked" ${u.tokens_locked ? 'checked' : ''}> 🔒 Bloquear todos</label>
    <input type="text" id="ufReason" placeholder="Razón">
    <button class="btn-primary" onclick="saveUserTokens('${u.id}')">💾 Guardar tokens</button></div>`;
  openModal('modal-userfile');
}
function ufAdj(s) { const b = document.getElementById('ufBalance'); const a = parseFloat(document.getElementById('ufAdjAmt').value) || 0; b.value = (parseFloat(b.value) + s * a).toFixed(2); }
async function saveUserTokens(uid) { const { data, error } = await db.rpc('admin_set_tokens', { p_uid: uid, p_balance: parseFloat(document.getElementById('ufBalance').value) || 0, p_locked: document.getElementById('ufLocked').checked, p_retained: parseFloat(document.getElementById('ufRetained').value) || 0, p_reason: document.getElementById('ufReason').value || 'Ajuste' }); if (error || (data && data.startsWith('ERROR'))) return showToast('❌ ' + (data || error.message)); showToast('✅ Tokens actualizados'); closeModal('modal-userfile'); loadAdminUsers(); }
async function saveModelName(uid) { const n = document.getElementById('ufModelName').value.trim(); if (!n) return showToast('Escribe el nombre'); await db.from('profiles').update({ model_name: n }).eq('id', uid); showToast('✅ Guardado'); const u = adminUsersCache.find(x => x.id === uid); if (u) u.model_name = n; closeModal('modal-userfile'); loadAdminUsers(); }
async function changeUserRole(id, newRole) { const u = adminUsersCache.find(x => x.id === id); if (!u || u.role === newRole) return; if (u.role === 'admin') return showToast('❌ No puedes cambiar el rol del admin'); if (newRole === 'remote_worker' && u.gender !== 'female') return showToast('❌ Solo mujeres'); await db.from('profiles').update({ role: newRole, kyc_status: newRole === 'remote_worker' ? 'pending' : 'none' }).eq('id', id); const payload = { user_id: id, role_type: newRole }; if (newRole === 'remote_worker') Object.assign(payload, { rate_per_minute: 0.2, worker_level: 1 }); await db.from('role_details').upsert(payload, { onConflict: 'user_id' }); showToast('✅ Rol cambiado'); loadAdminUsers(); }
async function changeUserPass(email) { const np = prompt('Nueva contraseña (mín 6):'); if (np === null) return; if (np.length < 6) return showToast('❌ Mín 6'); const np2 = prompt('Confirma:'); if (np !== np2) return showToast('❌ No coinciden'); const { data, error } = await db.rpc('admin_reset_password', { p_email: email, p_new: np }); if (error || (data && data.startsWith('ERROR'))) return showToast('❌ ' + (data || error.message)); showToast('✅ Contraseña cambiada'); }
async function toggleBan(id, ban) { let r = null; if (ban) { r = prompt('Razón del baneo:'); if (!r || !r.trim()) return showToast('Razón obligatoria'); } await db.from('profiles').update({ is_banned: ban, ban_reason: ban ? r.trim() : null }).eq('id', id); showToast(ban ? '🚫 Baneado' : '✅ Desbaneado'); loadAdminUsers(); }
async function loadSafety() {
  const { data: panics } = await db.from('panic_alerts').select('*, profiles(email, full_name)').order('created_at', { ascending: false }).limit(20);
  document.getElementById('panicList').innerHTML = (panics || []).map(p => `<div class="row-item"><div class="row-main"><b>🆘 ${p.profiles?.full_name || '—'}</b><small>${new Date(p.created_at).toLocaleString('es')}</small>${p.latitude ? `<a class="btn-small" target="_blank" href="https://www.google.com/maps?q=${p.latitude},${p.longitude}">🗺️</a>` : ''}</div><div class="row-actions">${p.status === 'active' ? `<button class="btn-small success" onclick="resolvePanic('${p.id}')">✅</button>` : '<span class="order-status st-delivered">Resuelta</span>'}</div></div>`).join('') || '<p class="empty-state">Sin alertas</p>';
  const { data: reps } = await db.from('reports').select('*, messages(content), target:profiles!reports_target_user_id_fkey(email)').order('created_at', { ascending: false }).limit(30);
  document.getElementById('reportsList').innerHTML = (reps || []).map(r => `<div class="row-item"><div class="row-main"><b>${r.auto_flag ? '🤖' : '🚩'} ${r.target?.email || '—'}</b><div class="dim">${r.detail || ''}</div>${r.messages?.content ? `<div class="dim">💬 …${r.messages.content}…</div>` : ''}</div><div class="row-actions">${r.status === 'open' ? `<button class="btn-small" onclick="closeReport('${r.id}')">Descartar</button>` : ''}${r.target_user_id ? `<button class="btn-small danger" onclick="toggleBan('${r.target_user_id}',true)">🚫</button>` : ''}</div></div>`).join('') || '<p class="empty-state">Sin reportes</p>';
}
async function resolvePanic(id) { await db.from('panic_alerts').update({ status: 'resolved' }).eq('id', id); loadSafety(); }
async function closeReport(id) { await db.from('reports').update({ status: 'closed' }).eq('id', id); loadSafety(); }
async function loadRechargeRequests() {
  const { data } = await db.from('recharge_requests').select('*, profiles(email, full_name)').order('created_at', { ascending: false });
  const pend = (data || []).filter(r => r.status === 'pending'); const rest = (data || []).filter(r => r.status !== 'pending');
  document.getElementById('rechargeRequestsList').innerHTML = pend.map(r => `<div class="row-item"><div class="row-main"><b>${r.profiles?.full_name} · ◈ ${r.amount}</b><small>${r.method} · ${r.reference || ''}</small>${r.proof_url ? `<img class="kyc-img" src="${r.proof_url}">` : ''}</div><div class="row-actions"><button class="btn-small success" onclick="approveRecharge('${r.id}')">✅</button><button class="btn-small danger" onclick="rejectRecharge('${r.id}')">❌</button></div></div>`).join('') + rest.slice(0, 8).map(r => `<div class="row-item"><div class="row-main"><b>${r.profiles?.full_name} · ◈ ${r.amount}</b></div><span class="order-status ${r.status === 'approved' ? 'st-delivered' : 'st-cancelled'}">${r.status}</span></div>`).join('') || '<p class="empty-state">Sin solicitudes</p>';
}
async function approveRecharge(id) { const { data: r } = await db.from('recharge_requests').select('*, profiles(email, is_active)').eq('id', id).single(); if (!r || r.status !== 'pending') return; if (!confirm('¿Recibiste ◈ ' + r.amount + '?')) return; await db.rpc('credit_tokens', { p_to: r.user_id, p_amount: parseFloat(r.amount), p_desc: 'Recarga' }); await db.from('recharge_requests').update({ status: 'approved', verified_by: 'manual' }).eq('id', id); if (parseFloat(r.amount) >= 5 && !r.profiles?.is_active) { await db.from('profiles').update({ is_active: true }).eq('id', r.user_id); await db.rpc('claim_referral_reward', { p_referee: r.user_id }); } showToast('✅ Aprobada'); loadRechargeRequests(); loadAdminOverview(); }
async function rejectRecharge(id) { const n = prompt('Razón:'); if (n === null) return; await db.from('recharge_requests').update({ status: 'rejected', note: n }).eq('id', id); showToast('❌ Rechazada'); loadRechargeRequests(); }
async function adminAdjustTokens() { const email = document.getElementById('adminTokenEmail').value.trim().toLowerCase(); const amount = parseFloat(document.getElementById('adminTokenAmount').value); if (!email || !amount) return showToast('Completa datos'); const { data: u } = await db.from('profiles').select('*').eq('email', email).single(); if (!u) return showToast('❌ No encontrado'); await db.from('profiles').update({ tokens_balance: parseFloat(u.tokens_balance || 0) + amount }).eq('id', u.id); showToast('✅ Ajuste'); loadAdminTransactions(); }
async function loadAdminTransactions() { const { data } = await db.from('token_transactions').select('*, profiles(email)').order('created_at', { ascending: false }).limit(50); document.getElementById('adminTransactions').innerHTML = (data || []).map(t => `<div class="tx-item"><div><b>${t.profiles?.email || '—'}</b><small>${t.description || t.type}</small></div><span class="tx-amount ${t.amount >= 0 ? 'positive' : 'negative'}">${t.amount >= 0 ? '+' : ''}${t.amount}</span></div>`).join('') || '<p class="empty-state">Sin transacciones</p>'; }
async function loadAdminContent() { const [r, n, m] = await Promise.all([db.from('restaurants').select('id, name'), db.from('nightclubs').select('id, name'), db.from('marketplace_items').select('id, title')]); document.getElementById('adminRestaurants').innerHTML = (r.data || []).map(x => `<div class="row-item"><div class="row-main"><b>${x.name}</b></div><button class="btn-small danger" onclick="deleteContent('restaurants','${x.id}')">🗑</button></div>`).join('') || '<p>Vacío</p>'; document.getElementById('adminNightclubs').innerHTML = (n.data || []).map(x => `<div class="row-item"><div class="row-main"><b>${x.name}</b></div><button class="btn-small danger" onclick="deleteContent('nightclubs','${x.id}')">🗑</button></div>`).join('') || '<p>Vacío</p>'; document.getElementById('adminMarket').innerHTML = (m.data || []).map(x => `<div class="row-item"><div class="row-main"><b>${x.title}</b></div><button class="btn-small danger" onclick="deleteContent('marketplace_items','${x.id}')">🗑</button></div>`).join('') || '<p>Vacío</p>'; }
async function deleteContent(t, id) { if (!confirm('¿Eliminar?')) return; await db.from(t).delete().eq('id', id); loadAdminContent(); }
async function loadAdminWithdrawals() { const { data } = await db.from('withdrawals').select('*, profiles(email, full_name)').order('created_at', { ascending: false }); document.getElementById('withdrawalsAdmin').innerHTML = (data || []).map(w => `<div class="row-item"><div class="row-main"><b>${w.profiles?.full_name} · ◈ ${w.amount}</b><small>${w.method}</small></div><div class="row-actions">${w.status === 'pending' ? `<button class="btn-small success" onclick="resolveWithdrawal('${w.id}','approved')">✅</button><button class="btn-small danger" onclick="resolveWithdrawal('${w.id}','rejected')">↩️</button>` : `<span class="order-status ${w.status === 'approved' ? 'st-delivered' : 'st-cancelled'}">${w.status}</span>`}</div></div>`).join('') || '<p>Sin retiros</p>'; }
async function resolveWithdrawal(id, st) { const { data: w } = await db.from('withdrawals').select('*').eq('id', id).single(); if (!w || w.status !== 'pending') return; if (st === 'rejected') await db.rpc('credit_tokens', { p_to: w.user_id, p_amount: parseFloat(w.amount), p_desc: 'Reembolso' }); await db.from('withdrawals').update({ status: st }).eq('id', id); loadAdminWithdrawals(); }
async function loadKycList() {
  const { data } = await db.from('profiles').select('*').eq('kyc_status', 'pending').order('created_at', { ascending: false });
  document.getElementById('kycList').innerHTML = (data || []).map(u => `<div class="row-item"><div class="row-main">
      <b>${u.role === 'remote_worker' ? (u.model_name || u.full_name) : u.full_name}</b>
      <small>${ROLE_LABELS[u.role] || u.role} · ${u.email} · Edad: ${u.age || '?'}</small>
      <div>${u.id_card_url ? `<img class="kyc-img" src="${u.id_card_url}" onclick="window.open('${u.id_card_url}')">` : '⚠️ sin cédula'}${u.face_photo_url ? `<img class="kyc-img" src="${u.face_photo_url}" onclick="window.open('${u.face_photo_url}')">` : '⚠️ sin rostro'}</div></div>
      <div class="row-actions"><button class="btn-small success" onclick="approveKyc('${u.id}')">✅ +18</button><button class="btn-small danger" onclick="rejectKyc('${u.id}')">❌</button></div></div>`).join('') || '<p class="empty-state">Nadie pendiente 🎉</p>';
}
async function approveKyc(id) { const { data: u } = await db.from('profiles').select('role').eq('id', id).single(); const up = { kyc_status: 'approved', is_verified: true }; if (u?.role === 'remote_worker') up.is_active = true; await db.from('profiles').update(up).eq('id', id); showToast('✅ Verificado y habilitado'); loadKycList(); }
async function rejectKyc(id) { const n = prompt('Razón (edad no verificada, foto obstruida, etc.):'); if (!n) return; await db.from('profiles').update({ kyc_status: 'rejected', kyc_note: n }).eq('id', id); showToast('❌ Rechazado'); loadKycList(); }
async function startKyc(userId, name) { kycTarget = userId; await loadScript('calls.js'); document.getElementById('kycTitle').textContent = '🎥 KYC: ' + name; document.getElementById('kycVerifyBtn').classList.remove('hidden'); await startWebCall('FENDYX_KYC_' + userId.slice(0, 8), { rate: 0, rowId: null, asClient: true }); }
async function kycMarkVerified() { if (!kycTarget) return; await db.from('profiles').update({ is_verified: true, kyc_status: 'approved', is_active: true }).eq('id', kycTarget); kycTarget = null; loadKycList(); }
function closeKyc() { if (typeof callRoom !== 'undefined' && callRoom) endWebCall(); else closeModal('modal-kyc'); }
async function loadWorkersAdmin() {
  const { data, error } = await db.rpc('admin_get_workers');
  if (error) { document.getElementById('adminWorkersList').innerHTML = '<p class="empty-state">❌ ' + error.message + '</p>'; return; }
  const list = (typeof data === 'string' ? JSON.parse(data) : data) || [];
  document.getElementById('adminWorkersList').innerHTML = list.map(w => {
    const cur = Math.min(5, Math.max(1, parseInt(w.worker_level) || 1));
    const curRate = parseFloat(w.rate_per_minute) || LEVELS[cur - 1].rate;
    return `<div class="row-item"><div class="row-main"><b>${w.model_name || w.full_name}</b><small>${levelBadge(cur)} · Gana ◈ ${curRate}/min · Cliente ◈ ${(curRate * 2).toFixed(2)}/min · ⭐ ${w.rating || 5}</small></div>
     <div class="row-actions"><select class="btn-small" onchange="setWorkerLevel('${w.id}', this.value)">${LEVELS.map(l => `<option value="${l.level}" ${cur === l.level ? 'selected' : ''}>${l.level}. ${l.ico} ${l.name}</option>`).join('')}</select>
     <input type="number" step="0.1" min="0.1" max="50" value="${curRate}" style="width:80px" class="btn-small" id="rate_${w.id}">
     <button class="btn-small success" onclick="setWorkerRate('${w.id}')">💾</button></div></div>`;
  }).join('') || '<p class="empty-state">Sin trabajadoras aprobadas</p>';
}
async function setWorkerLevel(id, level) { const lv = parseInt(level, 10); const lvl = LEVELS.find(x => x.level === lv); if (!lvl) return showToast('❌ Nivel inválido'); let rate = lvl.rate; try { const { data } = await db.from('worker_levels').select('rate').eq('level', lv).single(); if (data) rate = parseFloat(data.rate); } catch (e) {} const { data, error } = await db.rpc('admin_set_worker_level', { p_uid: id, p_level: lvl.level, p_rate: rate }); if (error) return showToast('❌ ' + error.message); if (!data || !data.startsWith('OK')) return showToast('❌ BD dijo: ' + (data || 'nada')); showToast('✅ ' + lvl.ico + ' ' + lvl.name + ' (gana ◈' + rate + ')'); await loadWorkersAdmin(); }
async function setWorkerRate(id) { const rate = parseFloat(document.getElementById('rate_' + id).value); if (isNaN(rate) || rate < 0.1 || rate > 50) return showToast('Rango 0.1 a 50'); const { data, error } = await db.rpc('admin_set_worker_level', { p_uid: id, p_level: null, p_rate: rate }); if (error) return showToast('❌ ' + error.message); if (!data || !data.startsWith('OK')) return showToast('❌ BD dijo: ' + (data || 'nada')); showToast('✅ Gana ◈ ' + rate + '/min (cliente ◈' + (rate * 2).toFixed(2) + ')'); await loadWorkersAdmin(); }
function loadApartados() {
  const cfg = window._modulesConfig || {};
  document.getElementById('modulesConfigList').innerHTML = MODULE_DEFS.map(d => { const st = cfg[d.id] || 'on'; return `<div class="row-item"><div class="row-main"><b>${MODULE_ICONS[d.id] || ''} ${d.n}</b><small>${st === 'on' ? '🟢 Activo' : st === 'off' ? '🔒 Próximamente' : '🙈 Oculto'}</small></div><select class="btn-small" onchange="saveModuleState('${d.id}', this.value)"><option value="on" ${st === 'on' ? 'selected' : ''}>🟢 Activo</option><option value="off" ${st === 'off' ? 'selected' : ''}>🔒 Próximamente</option><option value="hidden" ${st === 'hidden' ? 'selected' : ''}>🙈 Oculto</option></select></div>`; }).join('');
}
async function saveModuleState(id, state) { const cfg = Object.assign({}, window._modulesConfig || {}); cfg[id] = state; await db.from('app_branding').update({ modules_config: cfg, updated_at: new Date().toISOString() }).eq('id', 1); window._modulesConfig = cfg; showToast('✅ Apartado actualizado para todos'); loadApartados(); loadModules(); }
async function loadSupervision() {
  const { data } = await db.from('video_calls').select('*, c:profiles!video_calls_client_id_fkey(full_name,model_name), w:profiles!video_calls_worker_id_fkey(full_name,model_name)').eq('status', 'active').order('started_at', { ascending: false });
  document.getElementById('liveCallsList').innerHTML = (data || []).map(c => `<div class="row-item"><div class="row-main"><b>📹 ${(c.w?.model_name || c.w?.full_name || 'Modelo')} ↔ ${(c.c?.model_name || c.c?.full_name || 'Cliente')}</b><small>◈ ${c.rate_per_minute}/min modelo · ◈ ${(c.rate_per_minute * 2).toFixed(2)}/min cliente · desde ${new Date(c.started_at).toLocaleTimeString()}</small></div><div class="row-actions"><button class="btn-small success" onclick="watchCall('${c.room_id}')">👁 Ver mosaico</button></div></div>`).join('') || '<p class="empty-state">No hay llamadas en vivo</p>';
}
async function watchCall(roomId) { await loadScript('calls.js'); await startAdminMonitor(roomId); }
async function runAudit() { const q = document.getElementById('auditSearch').value.trim(); const box = document.getElementById('auditResults'); if (q.length < 3) { box.innerHTML = '<p>Mín 3 caracteres</p>'; return; } const { data } = await db.from('messages').select('*, profiles!messages_sender_id_fkey(email)').ilike('content', '%' + q + '%').limit(50); box.innerHTML = (data || []).map(m => `<div class="row-item"><div class="row-main"><b>${m.profiles?.email || '—'}</b><div>…${m.content}…</div></div><button class="btn-small danger" onclick="toggleBan('${m.sender_id}',true)">🚫</button></div>`).join('') || '<p>Sin coincidencias</p>'; }
