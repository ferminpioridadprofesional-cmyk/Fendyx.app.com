'use strict';
async function loadOrders() {
  const { data: mine } = await db.from('orders').select('*, restaurants(name), order_items(*)').eq('customer_id', currentUser.id).order('created_at', { ascending: false });
  document.getElementById('ordersList').innerHTML = (mine || []).map(o =>
    `<div class="row-item"><div class="row-main"><b>${o.restaurants?.name || 'Restaurante'}</b>
     <small>${(o.order_items || []).map(i => i.quantity + 'x ' + i.item_name).join(', ')}</small>
     <small>📍 ${o.delivery_address} · ◈ ${o.total}</small>
     ${['ready', 'delivering'].includes(o.status) ? `<small style="color:var(--warning)">🔐 Tu código: <b>${o.delivery_code}</b></small>` : ''}
     ${o.status === 'delivered' && !o.rated && o.driver_id ? `<button class="btn-small warn" onclick="openRateModal('${o.id}','${o.driver_id}')">⭐ Calificar delivery</button>` : ''}</div>
     <span class="order-status st-${o.status}">${ORDER_LABELS[o.status]}</span></div>`).join('')
    || '<p class="empty-state">Aún no has pedido nada</p>';
  const isOwner = currentProfile.role === 'restaurant';
  document.getElementById('ownerOrdersWrap').classList.toggle('hidden', !isOwner);
  if (isOwner) {
    const { data: rest } = await db.from('restaurants').select('id').eq('owner_id', currentUser.id).single();
    if (rest) {
      const { data: inc } = await db.from('orders').select('*, profiles(full_name), order_items(*)').eq('restaurant_id', rest.id).neq('status', 'delivered').order('created_at', { ascending: false });
      document.getElementById('ownerOrdersList').innerHTML = (inc || []).map(o => {
        let b = '';
        if (o.status === 'pending') b = `<button class="btn-small" onclick="advanceOrder('${o.id}','preparing')">👨🍳 Preparar</button>`;
        if (o.status === 'preparing') b = `<button class="btn-small success" onclick="advanceOrder('${o.id}','ready')">✅ Listo</button>`;
        if (o.status === 'ready') b = '<small>Esperando domiciliario…</small>';
        if (o.status === 'delivering') b = '<small>🛵 En camino</small>';
        return `<div class="row-item"><div class="row-main"><b>${o.profiles?.full_name || 'Cliente'}</b><small>${(o.order_items || []).map(i => i.quantity + 'x ' + i.item_name).join(', ')}</small><small>📍 ${o.delivery_address} · ◈ ${o.total}</small></div><div class="row-actions"><span class="order-status st-${o.status}">${ORDER_LABELS[o.status]}</span>${b}</div></div>`;
      }).join('') || '<p class="empty-state">Sin pedidos activos</p>';
    }
  }
  const isDriver = currentProfile.role === 'delivery';
  document.getElementById('driverOrdersWrap').classList.toggle('hidden', !isDriver);
  if (isDriver) {
    const { data: act } = await db.from('orders').select('*, restaurants(name)').eq('driver_id', currentUser.id).eq('status', 'delivering');
    document.getElementById('driverOrdersList').innerHTML = (act || []).map(o =>
      `<div class="row-item"><div class="row-main"><b>${o.restaurants?.name}</b><small>📍 ${o.delivery_address}</small></div><button class="btn-small success" onclick="showSection('delivery')">Ir a mi entrega</button></div>`).join('')
      || '<p class="empty-state">Sin entregas activas</p>';
  }
}
async function advanceOrder(id, status) { await db.from('orders').update({ status }).eq('id', id); showToast('✅ ' + ORDER_LABELS[status]); loadOrders(); }
function openRateModal(orderId, driverId) {
  let m = document.getElementById('modal-rate');
  if (!m) {
    m = document.createElement('div'); m.id = 'modal-rate'; m.className = 'modal hidden';
    m.innerHTML = `<div class="modal-content"><div class="modal-head"><h3>⭐ Calificar entrega</h3><button class="modal-close" onclick="closeModal('modal-rate')">✕</button></div>
      <div id="rateStars" style="font-size:2rem;text-align:center;margin:10px 0">${[1,2,3,4,5].map(n => `<span onclick="setRate(${n})" style="cursor:pointer;color:#ffc93c">★</span>`).join('')}</div>
      <select id="rateCategory" class="input-full"><option value="puntualidad">⏱️ Puntualidad</option><option value="trato">😊 Trato</option><option value="cuidado">📦 Cuidado del pedido</option><option value="entrega">✅ Entrega correcta</option></select>
      <input type="number" id="rateTip" class="input-full" placeholder="Propina opcional (tokens)" min="0" step="0.5">
      <input type="text" id="rateComment" class="input-full" placeholder="Comentario (opcional)">
      <button class="btn-primary" onclick="submitRate()">Enviar</button></div>`;
    document.body.appendChild(m);
  }
  window._rateTarget = { orderId, driverId, score: 5 };
  m.classList.remove('hidden');
}
function setRate(n) { window._rateTarget.score = n; document.querySelectorAll('#rateStars span').forEach((s, i) => s.style.opacity = i < n ? 1 : .25); }
async function submitRate() {
  const t = window._rateTarget;
  const tip = parseFloat(document.getElementById('rateTip').value) || 0;
  if (tip > parseFloat(currentProfile.tokens_balance)) { showToast('❌ Saldo insuficiente para la propina'); return; }
  await db.from('ratings').insert({ order_id: t.orderId, rater_id: currentUser.id, ratee_id: t.driverId, score: t.score, category: document.getElementById('rateCategory').value, comment: document.getElementById('rateComment').value });
  const { data: all } = await db.from('ratings').select('score').eq('ratee_id', t.driverId);
  const avg = (all || []).reduce((s, r) => s + r.score, 0) / ((all || []).length || 1);
  await db.from('profiles').update({ rating: avg.toFixed(2) }).eq('id', t.driverId);
  if (tip > 0) {
    const { data: drv } = await db.from('profiles').select('tokens_balance').eq('id', t.driverId).single();
    await db.from('profiles').update({ tokens_balance: parseFloat(currentProfile.tokens_balance) - tip }).eq('id', currentUser.id);
    await db.from('profiles').update({ tokens_balance: parseFloat(drv.tokens_balance) + tip }).eq('id', t.driverId);
    await db.from('token_transactions').insert([{ user_id: currentUser.id, amount: -tip, type: 'consumption', description: 'Propina a domiciliario' }, { user_id: t.driverId, amount: tip, type: 'transfer', description: 'Propina recibida' }]);
    currentProfile.tokens_balance = parseFloat(currentProfile.tokens_balance) - tip; updateHeader();
  }
  await db.from('orders').update({ rated: true, tip }).eq('id', t.orderId);
  closeModal('modal-rate'); showToast('⭐ ¡Gracias por calificar!'); loadOrders();
}
