'use strict';
async function loadTransactions() {
  fixRechargeOptions();
  injectInviteCard();
  document.getElementById('tokenBalance').textContent = currentProfile.role === 'admin' ? '∞' : parseFloat(currentProfile.tokens_balance || 0).toFixed(2);
  document.getElementById('tokenUSD').textContent = currentProfile.role === 'admin' ? '∞' : parseFloat(currentProfile.tokens_balance || 0).toFixed(2);
  const { data } = await db.from('token_transactions').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(30);
  const icons = { recharge: '💳', consumption: '🛍️', transfer: '⇄', welcome: '🎁', refund: '↩️' };
  document.getElementById('transactionsList').innerHTML = (data || []).map(t =>
    `<div class="tx-item"><div><b>${icons[t.type] || '◈'} ${t.description || t.type}</b><small>${new Date(t.created_at).toLocaleString('es')}</small></div>
     <span class="tx-amount ${t.amount >= 0 ? 'positive' : 'negative'}">${t.amount >= 0 ? '+' : ''}${t.amount}</span></div>`).join('')
    || '<p class="empty-state">Sin movimientos aún</p>';
}
function fixRechargeOptions() {
  const box = document.querySelector('#modal-recharge .recharge-options');
  if (!box || box.dataset.fixed) return;
  box.dataset.fixed = '1';
  box.innerHTML = `
    <button onclick="processRecharge(3)">3<br><small>$3 · ACTIVA CUENTA</small></button>
    <button onclick="processRecharge(10)">10<br><small>$10</small></button>
    <button onclick="processRecharge(25)">25<br><small>$25</small></button>
    <button onclick="processRecharge(50)">50<br><small>$50</small></button>`;
}
function injectInviteCard() {
  if (document.getElementById('inviteCard')) return;
  const link = location.origin + '/index.html?ref=' + currentUser.id;
  document.getElementById('transferBox').insertAdjacentHTML('afterend',
    `<div class="owner-panel" id="inviteCard"><h3>🎁 Invita y gana $1</h3>
     <p class="dim" style="font-size:.9rem">Cuando tu invitado active su cuenta con su primera recarga de $3, tú recibes <b>$1</b> automático.</p>
     <div class="row-item"><div class="row-main"><small>${link}</small></div>
     <button class="btn-small success" onclick="navigator.clipboard.writeText('${link}');showToast('🔗 Enlace copiado')">Copiar</button></div></div>`);
}
function processRecharge(amount) {
  amount = parseFloat(amount);
  if (!amount || amount <= 0) { showToast('Cantidad inválida'); return; }
  if (amount < 3) { showToast('⚠️ La recarga mínima es de $3'); return; }
  closeModal('modal-recharge'); showToast('💳 Procesando pago seguro…');
  setTimeout(async () => {
    await addTokens(amount, 'Recarga de tokens', 'recharge');
    let extraMsg = '✅ +' + amount + ' tokens acreditados';
    if (!currentProfile.is_active) {
      await db.from('profiles').update({ is_active: true }).eq('id', currentUser.id);
      currentProfile.is_active = true;
      extraMsg = '🎉 Cuenta ACTIVADA. Todo desbloqueado.';
      if (currentProfile.referred_by && !currentProfile.referral_rewarded && currentProfile.referred_by !== currentUser.id) {
        const { data: ref } = await db.from('profiles').select('tokens_balance').eq('id', currentProfile.referred_by).single();
        if (ref) {
          await db.from('profiles').update({ tokens_balance: parseFloat(ref.tokens_balance || 0) + 1 }).eq('id', currentProfile.referred_by);
          await db.from('token_transactions').insert([
            { user_id: currentProfile.referred_by, amount: 1, type: 'transfer', description: 'Bono por referido activado' },
            { user_id: currentUser.id, amount: 0, type: 'transfer', description: 'Tu invitador recibió $1 por tu activación' }
          ]);
        }
        await db.from('profiles').update({ referral_rewarded: true }).eq('id', currentUser.id);
        currentProfile.referral_rewarded = true;
      }
      loadModules();
    }
    updateHeader(); loadTransactions(); showToast(extraMsg);
  }, 1200);
}
async function transferTokens() {
  if (!requireActive()) return;
  const email = document.getElementById('transferEmail').value.trim().toLowerCase();
  const amount = parseFloat(document.getElementById('transferAmount').value);
  if (!email || !amount || amount <= 0) { showToast('Datos inválidos'); return; }
  const { data: dest } = await db.from('profiles').select('*').eq('email', email).single();
  if (!dest) { showToast('❌ Usuario no encontrado'); return; }
  if (dest.id === currentUser.id) { showToast('No puedes transferirte a ti mismo'); return; }
  if (parseFloat(currentProfile.tokens_balance) < amount) { showToast('❌ Saldo insuficiente'); return; }
  await db.from('profiles').update({ tokens_balance: parseFloat(currentProfile.tokens_balance) - amount }).eq('id', currentUser.id);
  await db.from('profiles').update({ tokens_balance: parseFloat(dest.tokens_balance || 0) + amount }).eq('id', dest.id);
  await db.from('token_transactions').insert([{ user_id: currentUser.id, amount: -amount, type: 'transfer', description: 'Enviado a ' + email }, { user_id: dest.id, amount, type: 'transfer', description: 'Recibido de ' + currentProfile.email }]);
  await loadProfile(); updateHeader(); loadTransactions();
  document.getElementById('transferEmail').value = ''; document.getElementById('transferAmount').value = '';
  showToast('✅ Transferencia completada');
}
