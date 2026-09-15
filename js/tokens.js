'use strict';
async function loadTransactions() {
  document.getElementById('tokenBalance').textContent = parseFloat(currentProfile.tokens_balance || 0).toFixed(2);
  document.getElementById('tokenUSD').textContent = parseFloat(currentProfile.tokens_balance || 0).toFixed(2);
  const { data } = await db.from('token_transactions').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(30);
  const icons = { recharge: '💳', consumption: '🛍️', transfer: '⇄', welcome: '🎁', refund: '↩️' };
  document.getElementById('transactionsList').innerHTML = (data || []).map(t =>
    `<div class="tx-item"><div><b>${icons[t.type] || '◈'} ${t.description || t.type}</b><small>${new Date(t.created_at).toLocaleString('es')}</small></div>
     <span class="tx-amount ${t.amount >= 0 ? 'positive' : 'negative'}">${t.amount >= 0 ? '+' : ''}${t.amount}</span></div>`).join('')
    || '<p class="empty-state">Sin movimientos aún</p>';
}
function processRecharge(amount) {
  amount = parseFloat(amount);
  if (!amount || amount <= 0) { showToast('Cantidad inválida'); return; }
  closeModal('modal-recharge'); showToast('💳 Procesando pago seguro…');
  setTimeout(async () => { await addTokens(amount, 'Recarga de tokens'); loadTransactions(); showToast('✅ +' + amount + ' tokens acreditados'); }, 1200);
}
async function transferTokens() {
  const email = document.getElementById('transferEmail').value.trim().toLowerCase();
  const amount = parseFloat(document.getElementById('transferAmount').value);
  if (!email || !amount || amount <= 0) { showToast('Datos inválidos'); return; }
  const { data: dest } = await db.from('profiles').select('*').eq('email', email).single();
  if (!dest) { showToast('❌ Usuario no encontrado'); return; }
  if (dest.id === currentUser.id) { showToast('No puedes transferirte a ti mismo'); return; }
  if (parseFloat(currentProfile.tokens_balance) < amount) { showToast('❌ Saldo insuficiente'); return; }
  await db.from('profiles').update({ tokens_balance: parseFloat(currentProfile.tokens_balance) - amount }).eq('id', currentUser.id);
  await db.from('profiles').update({ tokens_balance: parseFloat(dest.tokens_balance) + amount }).eq('id', dest.id);
  await db.from('token_transactions').insert([{ user_id: currentUser.id, amount: -amount, type: 'transfer', description: 'Enviado a ' + email }, { user_id: dest.id, amount, type: 'transfer', description: 'Recibido de ' + currentProfile.email }]);
  await loadProfile(); updateHeader(); loadTransactions();
  document.getElementById('transferEmail').value = ''; document.getElementById('transferAmount').value = '';
  showToast('✅ Transferencia completada');
}
