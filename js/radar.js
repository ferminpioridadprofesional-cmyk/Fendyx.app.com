'use strict';
let currentClubId = null, radarInterval = null, clubLat = null, clubLng = null;
if (typeof window.openProfile !== 'function') {
  window.openProfile = async id => { await loadScript('profile.js'); viewUserProfile(id); };
  window.chatWith = async id => { await loadScript('chat.js'); startChatWith(id); };
}
async function loadRadar() {
  document.getElementById('nightclubOwnerPanel').classList.toggle('hidden', currentProfile.role !== 'nightclub');
  const { data: clubs } = await db.from('nightclubs').select('*').eq('is_active', true);
  const txt = document.getElementById('radarStatusText');
  if (!clubs || !clubs.length) { txt.textContent = 'Aún no hay discotecas registradas'; currentClubId = null; document.getElementById('radarUsers').innerHTML = ''; document.getElementById('clubOccupancy').classList.add('hidden'); return; }
  if (!navigator.geolocation) { txt.textContent = '⚠️ GPS no disponible'; return; }
  navigator.geolocation.getCurrentPosition(async p => {
    myLocation = { lat: p.coords.latitude, lng: p.coords.longitude };
    const ranked = clubs.map(c => ({ c, d: haversine(myLocation.lat, myLocation.lng, c.latitude, c.longitude) })).sort((a, b) => a.d - b.d);
    const inside = ranked.find(x => x.d <= (x.c.geofence_radius || 20));
    if (inside) {
      currentClubId = inside.c.id;
      txt.innerHTML = `🎯 Dentro de <b>${inside.c.name}</b> (${Math.round(inside.d)} m)`;
      await db.from('radar_presences').upsert({ user_id: currentUser.id, nightclub_id: currentClubId, status: document.getElementById('radarStatusSelect').value }, { onConflict: 'user_id,nightclub_id' });
      const { count } = await db.from('radar_presences').select('*', { count: 'exact', head: true }).eq('nightclub_id', currentClubId);
      const cap = inside.c.capacity || 200;
      document.getElementById('clubOccupancy').classList.remove('hidden');
      document.getElementById('occupancyLabel').textContent = `🔥 Aforo en vivo: ${count}/${cap} personas dentro`;
      document.getElementById('occupancyBar').style.width = Math.min(100, (count / cap) * 100) + '%';
      loadRadarUsers();
      if (!radarInterval) radarInterval = setInterval(loadRadar, 30000);
    } else {
      currentClubId = null;
      txt.textContent = `😴 Fuera de geocerca. Más cercana: ${ranked[0].c.name} a ${fmtDist(ranked[0].d)}`;
      document.getElementById('clubOccupancy').classList.add('hidden');
      await db.from('radar_presences').delete().eq('user_id', currentUser.id);
      document.getElementById('radarUsers').innerHTML = '<p class="empty-state">Entra a una discoteca para aparecer en el radar</p>';
    }
  }, () => { txt.textContent = '⚠️ Activa el GPS para el Radar'; });
}
async function loadRadarUsers() {
  const { data } = await db.from('radar_presences').select('*, profiles(id, full_name, rating)').eq('nightclub_id', currentClubId);
  document.getElementById('radarUsers').innerHTML = (data || []).map(p =>
    `<div class="radar-user-card" onclick="openProfile('${p.profiles.id}')">
      <div class="conv-avatar" style="margin:0 auto">${(p.profiles.full_name || 'U').charAt(0).toUpperCase()}</div>
      <h4>${p.profiles.full_name}</h4>
      <p><span class="status-dot status-${p.status}"></span>${STATUS_LABELS[p.status] || p.status}</p>
      <p>${stars(p.profiles.rating || 5)}</p></div>`).join('') || '<p class="empty-state">Eres el primero en el radar 🎉</p>';
}
async function updateRadarStatus() {
  if (!currentClubId) { showToast('Primero entra a la geocerca de una discoteca'); return; }
  await db.from('radar_presences').update({ status: document.getElementById('radarStatusSelect').value }).eq('user_id', currentUser.id).eq('nightclub_id', currentClubId);
  showToast('✅ Estado: ' + STATUS_LABELS[document.getElementById('radarStatusSelect').value]);
  loadRadarUsers();
}
function setClubLocation() {
  navigator.geolocation.getCurrentPosition(p => {
    clubLat = p.coords.latitude; clubLng = p.coords.longitude;
    document.getElementById('clubCoords').textContent = `📍 ${clubLat.toFixed(6)}, ${clubLng.toFixed(6)}`;
  }, () => showToast('❌ Permiso de GPS denegado'));
}
async function saveNightclub(e) {
  e.preventDefault();
  if (clubLat === null) { showToast('Pulsa "Usar mi ubicación" primero'); return; }
  await db.from('nightclubs').upsert({
    owner_id: currentUser.id, name: document.getElementById('clubName').value,
    address: document.getElementById('clubAddress').value, latitude: clubLat, longitude: clubLng,
    geofence_radius: parseInt(document.getElementById('clubRadius').value) || 300,
    capacity: parseInt(document.getElementById('clubCapacity').value) || 200
  }, { onConflict: 'owner_id' });
  showToast('✅ Discoteca registrada con geocerca y aforo');
  loadRadar();
}
async function loadEvents() {
  document.getElementById('eventOwnerPanel').classList.toggle('hidden', currentProfile.role !== 'nightclub');
  const { data } = await db.from('events').select('*, nightclubs(name)').order('event_date', { ascending: true });
  const ids = (data || []).map(e => e.id);
  const { data: rsvps } = ids.length ? await db.from('event_rsvps').select('event_id, user_id').in('event_id', ids) : { data: [] };
  const count = {}, mine = new Set();
  (rsvps || []).forEach(r => { count[r.event_id] = (count[r.event_id] || 0) + 1; if (r.user_id === currentUser.id) mine.add(r.event_id); });
  document.getElementById('eventsList').innerHTML = (data || []).map(e =>
    `<div class="card-item"><div class="card-title">${e.title}</div>
     <div class="event-date">🗓️ ${new Date(e.event_date).toLocaleString('es')}</div>
     <div class="card-desc">${e.description || ''}</div>
     <div class="card-meta">🎵 ${e.nightclubs?.name || ''} · 👥 ${count[e.id] || 0} asistirán</div>
     <div class="price-tag">${parseFloat(e.price_tokens) > 0 ? '◈ ' + e.price_tokens : 'GRATIS'}</div><br>
     ${mine.has(e.id) ? '<span class="status-pill open">✅ ASISTIRÁS</span>' : `<button class="btn-small success" onclick="rsvpEvent('${e.id}',${e.price_tokens})">🎟️ Asistiré</button>`}
    </div>`).join('') || '<p class="empty-state">No hay eventos publicados</p>';
}
async function createEvent(e) {
  e.preventDefault();
  const { data: club } = await db.from('nightclubs').select('id').eq('owner_id', currentUser.id).single();
  if (!club) { showToast('Primero registra tu discoteca en el Radar'); return; }
  await db.from('events').insert({
    nightclub_id: club.id, title: document.getElementById('eventTitle').value,
    description: document.getElementById('eventDesc').value,
    event_date: new Date(document.getElementById('eventDate').value).toISOString(),
    price_tokens: parseFloat(document.getElementById('eventPrice').value) || 0
  });
  showToast('🎪 Evento publicado'); e.target.reset(); loadEvents();
}
async function rsvpEvent(id, price) {
  price = parseFloat(price) || 0;
  if (price > 0 && parseFloat(currentProfile.tokens_balance) < price) { showToast('❌ Saldo insuficiente para la entrada'); return; }
  if (price > 0) await deductTokens(price, 'Entrada a evento');
  await db.from('event_rsvps').insert({ event_id: id, user_id: currentUser.id });
  showToast('🎟️ ¡Nos vemos en el evento!'); loadEvents();
}
