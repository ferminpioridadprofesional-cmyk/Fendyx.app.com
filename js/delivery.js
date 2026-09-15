'use strict';
const rejectedOffers = new Set();
async function loadDeliveryHub() {
  if (currentProfile.role !== 'delivery') return;
  const p = currentProfile, rd = roleDetails || {};
  const pct = p.total_deliveries > 0 ? Math.round((p.completed_deliveries / p.total_deliveries) * 100) : 100;
  const veh = { moto: '🏍️ Moto', bicicleta: '🚲 Bicicleta', carro: '🚗 Carro' }[rd.vehicle_type] || '🛵 Vehículo';
  document.getElementById('driverCard').innerHTML = `
    ${p.avatar_url ? `<img src="${p.avatar_url}">` : `<div class="drv-letter">${(p.full_name || 'D').charAt(0).toUpperCase()}</div>`}
    <div class="drv-info"><b>${p.full_name}</b> ${p.is_verified ? '✅' : '<span class="kyc-pending">KYC pendiente</span>'}
    <div class="rep-stars" style="font-size:1rem">${stars(p.rating)} ${parseFloat(p.rating || 5).toFixed(1)}</div>
    <div class="drv-meta">${p.completed_deliveries || 0} entregas · ${pct}% completadas</div>
    <div class="drv-meta">${veh} · ${rd.vehicle_plate || 'sin placa'}</div></div>`;
  const avail = !!p.driver_available;
  document.getElementById('availCard').classList.toggle('on', avail);
  document.getElementById('availText').textContent = avail ? '🟢 ESTÁS DISPONIBLE' : '🔴 NO DISPONIBLE';
  document.getElementById('btnToggleAvail').textContent = avail ? 'Desconectarme' : 'Conectarme';
  await loadOffers(); await loadActiveDelivery(); await loadEarnings(); await loadReputation();
}
async function toggleAvailability() {
  const now = !currentProfile.driver_available;
  await db.from('profiles').update({ driver_available: now }).eq('id', currentUser.id);
  currentProfile.driver_available = now;
  showToast(now ? '🟢 Conectado: recibirás ofertas' : '🔴 Desconectado');
  loadDeliveryHub();
}
async function loadOffers() {
  const { data } = await db.from('orders').select('*, restaurants(name, address, latitude, longitude), order_items(*)').eq('status', 'ready').is('driver_id', null).order('created_at', { ascending: false });
  const offers = (data || []).filter(o => !rejectedOffers.has(o.id));
  document.getElementById('offersCount').textContent = offers.length + ' entregas cerca de ti';
  document.getElementById('offersList').innerHTML = offers.map(o => {
    const dist = (myLocation && o.restaurants?.latitude) ? haversine(myLocation.lat, myLocation.lng, o.restaurants.latitude, o.restaurants.longitude) : null;
    const gain = (parseFloat(o.total) * 0.85).toFixed(2);
    const eta = dist !== null ? Math.round((dist / 1000 / 20) * 60 + 12) : null;
    const zone = (o.restaurants?.address || '').split(',')[0] + ' ···';
    return `<div class="offer-card"><div class="offer-head"><b>🎁 ${o.restaurants?.name || 'Restaurante'}</b><span class="offer-gain">◈ ${gain}</span></div>
      <div class="offer-data">Recoger: <span class="locked-addr">${zone}</span><br>📏 ${dist !== null ? fmtDist(dist) : '—'} · ⏱️ ${eta !== null ? eta + ' min aprox' : '—'} · 🧾 ${(o.order_items || []).length} art.</div>
      <div class="offer-actions"><button class="btn-small success" onclick="acceptOffer('${o.id}')">✅ ACEPTAR</button><button class="btn-small danger" onclick="rejectOffer('${o.id}')">❌ RECHAZAR</button></div></div>`;
  }).join('') || '<p class="empty-state">Sin ofertas nuevas por ahora</p>';
}
function rejectOffer(id) { rejectedOffers.add(id); loadOffers(); }
async function acceptOffer(id) {
  await db.from('orders').update({ driver_id: currentUser.id, status: 'delivering' }).eq('id', id);
  await db.from('profiles').update({ total_deliveries: (currentProfile.total_deliveries || 0) + 1 }).eq('id', currentUser.id);
  currentProfile.total_deliveries = (currentProfile.total_deliveries || 0) + 1;
  showToast('✅ Aceptada. Dirección desbloqueada.'); loadDeliveryHub();
}
async function loadActiveDelivery() {
  const { data: o } = await db.from('orders').select('*, restaurants(name, latitude, longitude), profiles(full_name)').eq('driver_id', currentUser.id).eq('status', 'delivering').single();
  const card = document.getElementById('activeDeliveryCard');
  if (!o) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden'); window._activeOrder = o;
  const pk = !!o.pickup_confirmed;
  const pick = `https://www.google.com/maps/dir/?api=1&destination=${o.restaurants?.latitude || ''},${o.restaurants?.longitude || ''}`;
  const dest = `https://www.google.com/maps/dir/?api=1&destination=${o.customer_lat || ''},${o.customer_lng || ''}`;
  document.getElementById('deliverySteps').innerHTML = `
    <div class="step ${pk ? 'done' : 'current'}">1️⃣ Ir al negocio: <b>${o.restaurants?.name}</b><a class="btn-small step-btn" target="_blank" href="${pick}">🗺️ Navegar</a></div>
    <div class="step ${pk ? 'done' : ''}">2️⃣ Recoger el pedido embalado</div>
    <div class="step ${pk ? 'done' : 'current'}">3️⃣ Confirmar recogida${!pk ? `<button class="btn-small success step-btn" onclick="confirmPickup('${o.id}')">Confirmar</button>` : ''}</div>
    <div class="step ${pk ? 'current' : ''}">4️⃣ Ir al destino: <b>${o.delivery_address}</b><a class="btn-small step-btn" target="_blank" href="${dest}">🗺️ Navegar</a></div>
    <div class="step">5️⃣ Pide el 🔐 código al cliente y toma foto</div>
    <div class="step">6️⃣ Confirma abajo con el código</div>`;
}
async function confirmPickup(id) { await db.from('orders').update({ pickup_confirmed: true }).eq('id', id); showToast('📦 Recogida confirmada'); loadActiveDelivery(); }
async function confirmDelivery() {
  const o = window._activeOrder;
  if (!o) { showToast('No tienes entrega activa'); return; }
  const code = document.getElementById('codeInput').value.trim();
  if (code !== o.delivery_code) { showToast('❌ Código incorrecto. Pídeselo al cliente.'); navigator.vibrate?.(300); return; }
  let proof = null;
  const f = document.getElementById('proofPhoto').files[0];
  if (f) { const path = 'proofs/' + o.id + '_' + Date.now() + '.jpg'; const { error } = await db.storage.from('fendyx-assets').upload(path, f); if (!error) proof = db.storage.from('fendyx-assets').getPublicUrl(path).data.publicUrl; }
  const pos = await getPos();
  const earn = parseFloat((parseFloat(o.total) * 0.85).toFixed(2));
  await db.from('orders').update({ status: 'delivered', delivered_at: new Date().toISOString(), proof_photo_url: proof, delivery_lat: pos?.lat || null, delivery_lng: pos?.lng || null, driver_earning: earn }).eq('id', o.id);
  await db.from('profiles').update({ completed_deliveries: (currentProfile.completed_deliveries || 0) + 1 }).eq('id', currentUser.id);
  currentProfile.completed_deliveries = (currentProfile.completed_deliveries || 0) + 1;
  await addTokens(earn, 'Ganancia entrega #' + o.id.slice(0, 4));
  document.getElementById('codeInput').value = '';
  showToast('✅ Entrega confirmada. Ganaste ◈ ' + earn.toFixed(2));
  loadDeliveryHub();
}
async function loadEarnings() {
  const { data } = await db.from('orders').select('driver_earning, tip, delivered_at').eq('driver_id', currentUser.id).eq('status', 'delivered');
  const rows = data || [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const week = new Date(Date.now() - 7 * 86400000);
  const sum = (a, f) => a.reduce((s, x) => s + parseFloat(f(x) || 0), 0);
  const tRows = rows.filter(r => new Date(r.delivered_at) >= today);
  document.getElementById('earnToday').textContent = sum(tRows, r => r.driver_earning).toFixed(2);
  document.getElementById('earnCount').textContent = tRows.length;
  document.getElementById('earnTips').textContent = sum(rows, r => r.tip).toFixed(2);
  document.getElementById('earnWeek').textContent = sum(rows.filter(r => new Date(r.delivered_at) >= week), r => r.driver_earning).toFixed(2);
  document.getElementById('earnBalance').textContent = parseFloat(currentProfile.tokens_balance || 0).toFixed(2);
  const { data: w } = await db.from('withdrawals').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  document.getElementById('withdrawalsList').innerHTML = (w || []).map(x =>
    `<div class="row-item"><div class="row-main"><b>◈ ${x.amount}</b><small>${x.method} · ${new Date(x.created_at).toLocaleDateString()}</small></div><span class="order-status ${x.status === 'pending' ? 'st-pending' : 'st-delivered'}">${x.status === 'pending' ? 'Pendiente' : 'Aprobado'}</span></div>`).join('')
    || '<p class="empty-state">Sin retiros solicitados</p>';
}
async function requestWithdrawal() {
  const amount = parseFloat(document.getElementById('withdrawAmount').value);
  if (!amount || amount <= 0) { showToast('Monto inválido'); return; }
  if (amount > parseFloat(currentProfile.tokens_balance)) { showToast('❌ Saldo insuficiente'); return; }
  await db.from('withdrawals').insert({ user_id: currentUser.id, amount, method: document.getElementById('withdrawMethod').value });
  await deductTokens(amount, 'Solicitud de retiro');
  document.getElementById('withdrawAmount').value = '';
  showToast('🏦 Retiro solicitado. El admin lo procesará.'); loadEarnings();
}
async function loadReputation() {
  const p = currentProfile;
  document.getElementById('repStars').textContent = stars(p.rating) + ' ' + parseFloat(p.rating || 5).toFixed(1);
  document.getElementById('repLevel').textContent = driverLevel(p.completed_deliveries || 0);
  const { data } = await db.from('ratings').select('*').eq('ratee_id', currentUser.id);
  const cats = {};
  (data || []).forEach(r => { (cats[r.category] = cats[r.category] || []).push(r.score); });
  document.getElementById('repBreakdown').innerHTML = Object.entries(cats).map(([c, a]) =>
    `<span class="chip">${c}: ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)} ⭐</span>`).join('') || '<span class="chip">Aún sin calificaciones</span>';
}
