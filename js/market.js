'use strict';
async function loadMarketplace() {
  const { data } = await db.from('marketplace_items').select('*, profiles(id, full_name)').eq('is_active', true).order('created_at', { ascending: false });
  document.getElementById('marketplaceGrid').innerHTML = (data || []).map(i =>
    `<div class="card-item">${i.image_url ? `<img src="${i.image_url}" alt="">` : ''}
     <div class="card-title">${i.title}</div><div class="card-desc">${i.description || ''}</div>
     <div class="card-meta">Vende: ${i.profiles?.full_name || '—'}</div><div class="price-tag">◈ ${i.price}</div><br>
     ${i.seller_id !== currentUser.id ? `<button class="btn-small success" onclick="buyItem('${i.id}',${i.price},'${i.seller_id}')">Comprar</button><button class="btn-small" onclick="chatWith('${i.seller_id}')">💬</button><button class="btn-small" onclick="openProfile('${i.seller_id}')">👤</button>` : ''}</div>`).join('')
    || '<p class="empty-state">Marketplace vacío</p>';
  const { data: mine } = await db.from('marketplace_items').select('*').eq('seller_id', currentUser.id);
  document.getElementById('myListings').innerHTML = (mine || []).map(i =>
    `<div class="row-item"><div class="row-main"><b>${i.title}</b><small>◈ ${i.price} · ${i.is_active ? 'Activo' : 'Inactivo'}</small></div>
     <div class="row-actions"><button class="btn-small warn" onclick="toggleListing('${i.id}',${!i.is_active})">${i.is_active ? 'Pausar' : 'Activar'}</button><button class="btn-small danger" onclick="deleteListing('${i.id}')">🗑</button></div></div>`).join('')
    || '<p class="empty-state">Sin publicaciones</p>';
}
async function publishItem(e) {
  e.preventDefault();
  let imgUrl = null;
  const file = document.getElementById('itemImage').files[0];
  if (file) { const path = 'market/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.]/g, '_'); const r = await db.storage.from('fendyx-assets').upload(path, file); if (!r.error) imgUrl = db.storage.from('fendyx-assets').getPublicUrl(path).data.publicUrl; }
  await db.from('marketplace_items').insert({ seller_id: currentUser.id, title: document.getElementById('itemTitle').value, description: document.getElementById('itemDesc').value, price: parseFloat(document.getElementById('itemPrice').value), image_url: imgUrl });
  showToast('✅ Publicado'); e.target.reset(); document.getElementById('sellForm').classList.add('hidden'); loadMarketplace();
}
async function toggleListing(id, a) { await db.from('marketplace_items').update({ is_active: a }).eq('id', id); loadMarketplace(); }
async function deleteListing(id) { if (!confirm('¿Eliminar?')) return; await db.from('marketplace_items').delete().eq('id', id); loadMarketplace(); }
async function buyItem(id, price, sellerId) {
  if (!requireActive()) return;
  if (!confirm('¿Comprar por ◈ ' + price + '?')) return;
  const { data: ok, error } = await db.rpc('transfer_tokens', { p_from: currentUser.id, p_to: sellerId, p_amount: price, p_desc: 'Compra marketplace' });
  if (error || !ok) { showToast('❌ Saldo insuficiente'); return; }
  await db.from('marketplace_items').update({ is_active: false }).eq('id', id);
  await loadProfile(); updateHeader(); loadMarketplace();
  showToast('✅ ¡Compra exitosa! El vendedor ya recibió el pago.');
}
