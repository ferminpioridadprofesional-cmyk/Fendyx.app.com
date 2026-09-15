'use strict';
async function loadRestaurants() {
  const isOwner = currentProfile.role === 'restaurant';
  document.getElementById('restaurantOwnerPanel').classList.toggle('hidden', !isOwner);
  if (isOwner) loadOwnerRestaurant();
  const { data } = await db.from('restaurants').select('*').order('created_at', { ascending: false });
  document.getElementById('restaurantsList').innerHTML = (data || []).map(r =>
    `<div class="card-item"><div class="card-title">${r.name}</div>
     <div class="card-desc">${r.description || 'Sin descripción'}</div>
     <div class="card-meta">📍 ${r.address || '—'} · 🪑 ${r.tables_count || 5} mesas</div>
     <span class="status-pill ${r.is_open ? 'open' : 'closed'}">${r.is_open ? 'ABIERTO' : 'CERRADO'}</span><br>
     <button class="btn-small" onclick="viewMenu('${r.id}')">🍽️ Pedir</button>
     <button class="btn-small success" onclick="openReserve('${r.id}')">📅 Reservar mesa</button>
    </div>`).join('') || '<p class="empty-state">Aún no hay restaurantes registrados</p>';
}
async function loadOwnerRestaurant() {
  const { data } = await db.from('restaurants').select('*').eq('owner_id', currentUser.id).single();
  if (data) {
    document.getElementById('restName').value = data.name || '';
    document.getElementById('restAddress').value = data.address || '';
    document.getElementById('restDesc').value = data.description || '';
    document.getElementById('restTables').value = data.tables_count || 5;
    document.getElementById('restOpen').checked = !!data.is_open;
  }
  loadMyMenu();
}
async function saveRestaurant(e) {
  e.preventDefault();
  const pos = await getPos();
  await db.from('restaurants').upsert({
    owner_id: currentUser.id, name: document.getElementById('restName').value,
    address: document.getElementById('restAddress').value, description: document.getElementById('restDesc').value,
    tables_count: parseInt(document.getElementById('restTables').value) || 5,
    is_open: document.getElementById('restOpen').checked,
    latitude: pos?.lat || null, longitude: pos?.lng || null
  }, { onConflict: 'owner_id' });
  showToast('✅ Restaurante guardado'); loadRestaurants();
}
async function loadMyMenu() {
  const { data: rest } = await db.from('restaurants').select('id').eq('owner_id', currentUser.id).single();
  if (!rest) return;
  const { data } = await db.from('menu_items').select('*').eq('restaurant_id', rest.id);
  document.getElementById('myMenuList').innerHTML = (data || []).map(i =>
    `<div class="row-item"><div class="row-main"><b>${i.name}</b><small>◈ ${i.price} · ${i.is_available ? 'Disponible' : 'Agotado'}</small></div>
     <div class="row-actions"><button class="btn-small warn" onclick="toggleMenuItem('${i.id}',${!i.is_available})">${i.is_available ? 'Agotar' : 'Activar'}</button>
     <button class="btn-small danger" onclick="deleteMenuItem('${i.id}')">🗑</button></div></div>`).join('') || '<p class="empty-state">Sin platos aún</p>';
}
async function addMenuItem(e) {
  e.preventDefault();
  const { data: rest } = await db.from('restaurants').select('id').eq('owner_id', currentUser.id).single();
  if (!rest) { showToast('Primero guarda tu restaurante'); return; }
  await db.from('menu_items').insert({ restaurant_id: rest.id, name: document.getElementById('menuItemName').value, price: parseFloat(document.getElementById('menuItemPrice').value), description: document.getElementById('menuItemDesc').value });
  showToast('✅ Plato agregado'); e.target.reset(); loadMyMenu();
}
async function toggleMenuItem(id, a) { await db.from('menu_items').update({ is_available: a }).eq('id', id); loadMyMenu(); }
async function deleteMenuItem(id) { if (!confirm('¿Eliminar plato?')) return; await db.from('menu_items').delete().eq('id', id); loadMyMenu(); }
async function viewMenu(restId) {
  window._lastMenuRest = restId;
  const { data: rest } = await db.from('restaurants').select('*').eq('id', restId).single();
  const { data } = await db.from('menu_items').select('*').eq('restaurant_id', restId).eq('is_available', true);
  document.getElementById('restModalTitle').textContent = '🍽️ ' + rest.name;
  document.getElementById('restModalMenu').innerHTML = (data || []).map(i =>
    `<div class="row-item"><div class="row-main"><b>${i.name}</b><small>${i.description || ''}</small></div>
     <div class="row-actions"><span class="price-tag">◈ ${i.price}</span>
     ${rest.is_open ? `<button class="btn-small success" onclick="addToCart('${i.id}','${i.name.replace(/'/g, '')}',${i.price})">+ Agregar</button>` : ''}</div></div>`).join('')
    || `<p class="empty-state">${rest.is_open ? 'Menú vacío' : '🔒 Cerrado ahora'}</p>`;
  openModal('modal-restaurant');
}
function addToCart(id, name, price) {
  if (cart.restId && cart.restId !== window._lastMenuRest) cart = { restId: null, items: [] };
  cart.restId = window._lastMenuRest;
  const ex = cart.items.find(i => i.id === id);
  if (ex) ex.qty++; else cart.items.push({ id, name, price, qty: 1 });
  updateCartFab(); showToast('🛒 ' + name + ' agregado');
}
function updateCartFab() {
  const n = cart.items.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cartFab').classList.toggle('hidden', n === 0);
  document.getElementById('cartCount').textContent = n;
}
function changeQty(id, d) {
  const it = cart.items.find(i => i.id === id); if (!it) return;
  it.qty += d; if (it.qty <= 0) cart.items = cart.items.filter(i => i.id !== id);
  updateCartFab(); openCart();
}
function openCart() {
  if (!cart.items.length) { closeModal('modal-cart'); updateCartFab(); return; }
  document.getElementById('cartItems').innerHTML = cart.items.map(i =>
    `<div class="row-item"><div class="row-main"><b>${i.name}</b><small>◈ ${i.price} c/u</small></div>
     <div class="row-actions"><button class="btn-small" onclick="changeQty('${i.id}',-1)">−</button><span style="padding:0 8px;font-weight:800">${i.qty}</span><button class="btn-small" onclick="changeQty('${i.id}',1)">+</button></div></div>`).join('');
  document.getElementById('cartTotal').textContent = cartTotal().toFixed(2);
  openModal('modal-cart');
}
function cartTotal() { return cart.items.reduce((s, i) => s + i.price * i.qty, 0); }
async function checkout() {
  const address = document.getElementById('cartAddress').value.trim();
  if (!address) { showToast('Escribe la dirección de entrega'); return; }
  const total = cartTotal();
  if (parseFloat(currentProfile.tokens_balance) < total) { showToast('❌ Saldo insuficiente'); return; }
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const pos = await getPos();
  const { data: order } = await db.from('orders').insert({
    customer_id: currentUser.id, restaurant_id: cart.restId, status: 'pending', total,
    delivery_address: address, delivery_code: code, customer_lat: pos?.lat || null, customer_lng: pos?.lng || null
  }).select().single();
  await db.from('order_items').insert(cart.items.map(i => ({ order_id: order.id, item_name: i.name, quantity: i.qty, unit_price: i.price })));
  await deductTokens(total, 'Pedido en restaurante');
  cart = { restId: null, items: [] }; updateCartFab();
  closeModal('modal-cart'); closeModal('modal-restaurant');
  showToast('✅ Pedido creado. Tu código de entrega: 🔐 ' + code);
  showSection('orders');
}
function openReserve(restId) { window._resRest = restId; openModal('modal-reserve'); }
async function confirmReserve() {
  const d = document.getElementById('resDate').value, t = document.getElementById('resTime').value;
  if (!d || !t) { showToast('Elige fecha y hora'); return; }
  await db.from('reservations').insert({ restaurant_id: window._resRest, user_id: currentUser.id, res_date: d, res_time: t, people: parseInt(document.getElementById('resPeople').value) || 2 });
  closeModal('modal-reserve'); showToast('📅 Reserva enviada. El restaurante la confirmará.');
  loadReservations();
}
async function loadReservations() {
  const isOwner = currentProfile.role === 'restaurant';
  document.getElementById('ownerResWrap').classList.toggle('hidden', !isOwner);
  const { data: mine } = await db.from('reservations').select('*, restaurants(name)').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  document.getElementById('myResList').innerHTML = (mine || []).map(r =>
    `<div class="row-item"><div class="row-main"><b>${r.restaurants?.name}</b><small>🗓️ ${r.res_date} · ${r.res_time} · ${r.people} personas${r.table_number ? ' · Mesa ' + r.table_number : ''}</small></div>
     <div class="row-actions"><span class="order-status ${r.status === 'confirmed' ? 'st-delivered' : r.status === 'cancelled' ? 'st-cancelled' : 'st-pending'}">${r.status === 'confirmed' ? 'Confirmada' : r.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}</span>
     ${r.status === 'pending' ? `<button class="btn-small danger" onclick="cancelRes('${r.id}')">Cancelar</button>` : ''}</div></div>`).join('')
    || '<p class="empty-state">Sin reservas aún</p>';
  if (isOwner) {
    const { data: rest } = await db.from('restaurants').select('id').eq('owner_id', currentUser.id).single();
    if (rest) {
      const { data: inc } = await db.from('reservations').select('*, profiles(full_name)').eq('restaurant_id', rest.id).neq('status', 'cancelled').order('created_at', { ascending: false });
      document.getElementById('ownerResList').innerHTML = (inc || []).map(r =>
        `<div class="row-item"><div class="row-main"><b>${r.profiles?.full_name}</b><small>🗓️ ${r.res_date} · ${r.res_time} · ${r.people} pax</small></div>
         <div class="row-actions">${r.status === 'pending' ? `<button class="btn-small success" onclick="confirmRes('${r.id}')">✅ Confirmar</button><button class="btn-small danger" onclick="cancelRes('${r.id}')">✕</button>` : '<span class="order-status st-delivered">Confirmada</span>'}</div></div>`).join('')
        || '<p class="empty-state">Sin reservas recibidas</p>';
    }
  }
}
async function confirmRes(id) {
  const { data: rest } = await db.from('restaurants').select('tables_count').eq('owner_id', currentUser.id).single();
  const table = Math.floor(1 + Math.random() * (rest?.tables_count || 5));
  await db.from('reservations').update({ status: 'confirmed', table_number: table }).eq('id', id);
  showToast('✅ Reserva confirmada (mesa ' + table + ')'); loadReservations();
}
async function cancelRes(id) { await db.from('reservations').update({ status: 'cancelled' }).eq('id', id); showToast('Reserva cancelada'); loadReservations(); }
