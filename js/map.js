'use strict';
let map = null, mapMarkers = [], watchId = null, sharing = false, proxInterval = null;
const notifiedProx = new Set();
if (typeof window.openProfile !== 'function') {
  window.openProfile = async id => { await loadScript('profile.js'); viewUserProfile(id); };
  window.chatWith = async id => { await loadScript('chat.js'); startChatWith(id); };
}
function initMap() {
  if (map || typeof L === 'undefined') return;
  map = L.map('mapBox', { zoomControl: true }).setView([10.4806, -66.9036], 12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap © CARTO' }).addTo(map);
  setTimeout(() => map.invalidateSize(), 250);
}
function autoLocate() { if (!sharing) toggleShareLocation(); }
function toggleShareLocation() {
  if (sharing) {
    sharing = false;
    if (watchId) navigator.geolocation.clearWatch(watchId);
    if (proxInterval) clearInterval(proxInterval);
    db.from('user_locations').update({ is_sharing: false }).eq('user_id', currentUser.id);
    document.getElementById('btnShareLocation').textContent = '📡 Compartir ubicación';
    showToast('📴 Dejaste de compartir ubicación'); return;
  }
  if (!navigator.geolocation) { showToast('❌ GPS no disponible'); return; }
  watchId = navigator.geolocation.watchPosition(async p => {
    sharing = true;
    myLocation = { lat: p.coords.latitude, lng: p.coords.longitude };
    await db.from('user_locations').upsert({ user_id: currentUser.id, latitude: myLocation.lat, longitude: myLocation.lng, is_sharing: true }, { onConflict: 'user_id' });
    document.getElementById('btnShareLocation').textContent = '🔴 EN VIVO (tocar para parar)';
    if (map) map.setView([myLocation.lat, myLocation.lng], 14);
    loadMapUsers();
    if (!proxInterval) proxInterval = setInterval(loadMapUsers, 15000);
  }, () => showToast('❌ Permiso de ubicación denegado'), { enableHighAccuracy: true });
  showToast('📡 Ubicándote…');
}
async function loadMapUsers() {
  if (!map) return;
  const { data } = await db.from('user_locations').select('*, profiles(id, full_name, role, rating)').eq('is_sharing', true);
  mapMarkers.forEach(m => map.removeMarker(m)); mapMarkers = [];
  const rows = (data || []).filter(r => r.profiles && r.user_id !== currentUser.id);
  let vis = myLocation
    ? rows.map(r => ({ ...r, dist: haversine(myLocation.lat, myLocation.lng, r.latitude, r.longitude) })).filter(r => r.dist <= 100000).sort((a, b) => a.dist - b.dist)
    : rows.map(r => ({ ...r, dist: null }));
  vis.forEach(r => { if (r.dist !== null && r.dist <= 20 && !notifiedProx.has(r.user_id)) fireProximity(r); });
  document.getElementById('nearbyList').innerHTML = vis.length ? vis.map(r => {
    const tag = r.dist === null ? '' : r.dist <= 20 ? '🔥 SUPER CERCA' : r.dist <= 15000 ? '📍 CERCA' : '🌎 REGIÓN';
    return `<span class="chip ${r.dist !== null && r.dist <= 15000 ? 'active' : ''}" onclick="openProfile('${r.profiles.id}')">${tag} ${r.profiles.full_name}${r.dist !== null ? ' · ' + fmtDist(r.dist) : ''}</span>`;
  }).join('') : '<p class="empty-state">Nadie en tu región (100 km) por ahora</p>';
  vis.forEach(r => {
    const c = r.dist !== null && r.dist <= 20 ? '#ff2d95' : r.dist !== null && r.dist <= 15000 ? '#00ff9d' : '#00d9ff';
    mapMarkers.push(L.circleMarker([r.latitude, r.longitude], { radius: r.dist <= 20 ? 12 : 9, color: c, fillColor: c, fillOpacity: .55 }).addTo(map)
      .bindPopup(`<div class="map-pop"><b>${r.profiles.full_name}</b><br>${ROLE_LABELS[r.profiles.role] || ''} · ${stars(r.profiles.rating || 5)}<br>${r.dist !== null ? fmtDist(r.dist) + ' de ti' : ''}<div class="pop-btns"><button class="btn-small" onclick="openProfile('${r.profiles.id}')">Ver perfil</button><button class="btn-small success" onclick="chatWith('${r.profiles.id}')">Mensaje</button></div></div>`));
  });
  if (myLocation) {
    if (!map._self) map._self = L.circleMarker([myLocation.lat, myLocation.lng], { radius: 8, color: '#fff', fillColor: '#a855f7', fillOpacity: .9 }).addTo(map).bindPopup('📍 Tú');
    else map._self.setLatLng([myLocation.lat, myLocation.lng]);
  }
}
function fireProximity(r) {
  notifiedProx.add(r.user_id);
  navigator.vibrate?.([250, 120, 250]);
  const b = document.getElementById('proximityBanner');
  document.getElementById('proximityText').textContent = `¡SUPER CERCA! ${r.profiles.full_name} está a ${Math.round(r.dist)} m. Toca para ver su perfil`;
  b.classList.remove('hidden');
  b.onclick = () => { b.classList.add('hidden'); openProfile(r.profiles.id); };
  setTimeout(() => b.classList.add('hidden'), 8000);
  showToast('🔥 ' + r.profiles.full_name + ' está a ' + Math.round(r.dist) + ' m');
}
