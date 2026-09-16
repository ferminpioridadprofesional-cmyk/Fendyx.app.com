'use strict';

async function loadTransactions() {
  const bal = currentProfile.unlimited_tokens ? '∞' : parseFloat(currentProfile.tokens_balance || 0).toFixed(2);
  document.getElementById('tokenBalance').textContent = bal;
  document.getElementById('tokenUSD').textContent = currentProfile.unlimited_tokens ? '∞' : parseFloat(currentProfile.tokens_balance || 0).toFixed(2);

  const refBox = document.getElementById('referralBox');
  if (refBox) refBox.remove();
  const ref = document.createElement('div');
  ref.id = 'referralBox'; ref.className = 'owner-panel';
  ref.innerHTML = `<h3>🎁 Invita y gana</h3>
    <p class="dim">Comparte tu código. Cuando tu invitado <b>active su cuenta</b> (recarga verificada de $3), tú recibes <b>1 token</b>.</p>
    <div class="row-item"><div class="row-main"><b class="ref-code">${currentProfile.referral_code || '—'}</b><small>Activación: recarga mínima verificada de 3 tokens</small></div>
    <button class="btn-small success" onclick="copyRefCode()">📋 Copiar</button></div>`;
  document.getElementById('transactionsList').before(ref);

  await loadMyRecharges();

  const { data } = await db.from('token_transactions').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(30);
  const icons = { recharge: '💳', consumption: '🛍️', transfer: '⇄', welcome: '🎁', refund: '↩️', referral: '🎁' };
  document.getElementById('transactionsList').innerHTML = (data || []).map(t =>
    `<div class="tx-item"><div><b>${icons[t.type] || '◈'} ${t.description || t.type}</b><small>${new Date(t.created_at).toLocaleString('es')}</small></div>
     <span class="tx-amount ${t.amount >= 0 ? 'positive' : 'negative'}">${t.amount >= 0 ? '+' : ''}${t.amount}</span></div>`).join('')
    || '<p class="empty-state">Sin movimientos aún</p>';
}

async function loadMyRecharges() {
  const box = document.getElementById('myRechargeList');
  if (!box) return;
  const { data } = await db.from('recharge_requests').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(10);
  box.innerHTML = (data || []).map(r =>
    `<div class="tx-item"><div><b>◈ ${r.amount}</b> · ${r.method}<small>Ref: ${r.reference || '—'} · ${new Date(r.created_at).toLocaleString('es')}${r.note ? ' · Nota: ' + r.note : ''}</small></div>
     <span class="order-status ${r.status === 'approved' ? 'st-delivered' : r.status === 'rejected' ? 'st-cancelled' : 'st-pending'}">${r.status === 'approved' ? 'Aprobada' : r.status === 'rejected' ? 'Rechazada' : 'Pendiente'}</span></div>`).join('')
    || '<p class="empty-state">Sin solicitudes aún</p>';
}

async function submitRechargeRequest() {
  const amount = parseFloat(document.getElementById('reqAmount').value);
  if (!amount || amount < 3) { showToast('⚠️ Recarga mínima: 3 tokens ($3)'); return; }
  const method = document.getElementById('reqMethod').value;
  const reference = document.getElementById('reqRef').value.trim();
  if (!reference) { showToast('⚠️ Escribe el número de referencia o hash del pago'); return; }
  const file = document.getElementById('reqProof').files[0];
  let proofUrl = null;
  if (file) {
    const p = 'recharges/' + currentUser.id + '_' + Date.now() + '.jpg';
    const r = await db.storage.from('fendyx-assets').upload(p, file);
    if (!r.error) proofUrl = db.storage.from('fendyx-assets').getPublicUrl(p).data.publicUrl;
  }
  await db.from('recharge_requests').insert({ user_id: currentUser.id, amount, method, reference, proof_url: proofUrl });
  showToast('📨 Solicitud enviada. Será verificada por el admin (o el bot Binance).');
  document.getElementById('reqAmount').value = '';
  document.getElementById('reqRef').value = '';
  await loadMyRecharges();
}

function copyRefCode() {
  navigator.clipboard?.writeText(currentProfile.referral_code || '');
  showToast('📋 Código copiado: ' + currentProfile.referral_code);
}

async function transferTokens() {
  const email = document.getElementById('transferEmail').value.trim().toLowerCase();
  const amount = parseFloat(document.getElementById('transferAmount').value);
  if (!email || !amount || amount <= 0) { showToast('Datos inválidos'); return; }
  if (!requireActive()) return;
  const { data: dest } = await db.from('profiles').select('*').eq('email', email).single();
  if (!dest) { showToast('❌ Usuario no encontrado'); return; }
  if (dest.id === currentUser.id) { showToast('No puedes transferirte a ti mismo'); return; }
  const { data: ok, error } = await db.rpc('transfer_tokens', { p_from: currentUser.id, p_to: dest.id, p_amount: amount, p_desc: 'Transferencia a ' + email });
  if (error || !ok) { showToast('❌ Saldo insuficiente o usuario inválido'); return; }
  await loadProfile(); updateHeader(); loadTransactions();
  document.getElementById('transferEmail').value = '';
  document.getElementById('transferAmount').value = '';
  showToast('✅ Transferencia completada');
}
