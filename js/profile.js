'use strict';
let viewedUserId = null, kycApi = null;
async function loadProfileSection() {
  const p = currentProfile;
  document.getElementById('profileName').textContent = p.full_name || 'Usuario';
  document.getElementById('profileEmail').textContent = p.email;
  document.getElementById('profileRole').textContent = ROLE_LABELS[p.role] || p.role;
  document.getElementById('statTokens').textContent = parseFloat(p.tokens_balance || 0).toFixed(2);
  document.getElementById('statVerified').textContent = p.is_verified ? 'Sí ✅' : 'No';
  document.getElementById('statStatus').textContent = STATUS_LABELS[roleDetails?.relationship_status] || '—';
  document.getElementById('profileAvatar').textContent = (p.full_name || 'U').charAt(0).toUpperCase();
  const img = document.getElementById('profileAvatarImg');
  if (p.avatar_url) { img.src = p.avatar_url; img.style.display = 'block'; document.getElementById('profileAvatar').style.display = 'none'; }
}
function fillProfilePro() {
  document.getElementById('proName').value = currentProfile.full_name || '';
  document.getElementById('proBio').value = currentProfile.bio || '';
  document.getElementById('proInterests').value = (currentProfile.interests || []).join(', ');
}
async function saveProfilePro(e) {
  e.preventDefault();
  const up = {
    full_name: document.getElementById('proName').value || currentProfile.full_name,
    bio: document.getElementById('proBio').value,
    interests: document.getElementById('proInterests').value.split(',').map(s => s.trim()).filter(Boolean)
  };
  const av = document.getElementById('proAvatar').files[0];
  if (av) { const p = 'avatars/' + currentUser.id + '_' + Date.now() + '.png'; const { error } = await db.storage.from('fendyx-assets').upload(p, av); if (!error) up.avatar_url = db.storage.from('fendyx-assets').getPublicUrl(p).data.publicUrl; }
  const gal = Array.from(document.getElementById('proGallery').files || []);
  if (gal.length) {
    const urls = [];
    for (const f of gal) { const p = 'gallery/' + currentUser.id + '_' + Date.now() + '_' + f.name.replace(/[^a-zA-Z0-9.]/g, '_'); const { error } = await db.storage.from('fendyx-assets').upload(p, f); if (!error) urls.push(db.storage.from('fendyx-assets').getPublicUrl(p).data.publicUrl); }
    up.gallery_urls = [...(currentProfile.gallery_urls || []), ...urls];
  }
  await db.from('profiles').update(up).eq('id', currentUser.id);
  await loadProfile(); updateHeader(); loadProfileSection();
  showToast('✅ Perfil Pro actualizado');
}
async function viewUserProfile(userId) {
  const { data } = await db.from('profiles').select('*, role_details(*)').eq('id', userId).single();
  if (!data) return;
  viewedUserId = userId;
  document.getElementById('upName').textContent = data.full_name || 'Usuario';
  const img = document.getElementById('upAvatar'), let_ = document.getElementById('upAvatarLetter');
  if (data.avatar_url) { img.src = data.avatar_url; img.classList.remove('hidden'); let_.classList.add('hidden'); }
  else { img.classList.add('hidden'); let_.classList.remove('hidden'); let_.textContent = (data.full_name || 'U').charAt(0).toUpperCase(); }
  document.getElementById('upRole').textContent = ROLE_LABELS[data.role] || data.role;
  document.getElementById('upVerified').textContent = data.is_verified ? ' ✅ Verificado' : '';
  document.getElementById('upRating').textContent = stars(data.rating || 5) + ' ' + parseFloat(data.rating || 5).toFixed(1);
  document.getElementById('upBio').textContent = data.bio || data.role_details?.[0]?.bio || 'Sin descripción aún.';
  document.getElementById('upInterests').innerHTML = (data.interests || []).map(i => `<span class="chip">🎯 ${i}</span>`).join('') || '<p class="dim">Sin intereses publicados</p>';
  document.getElementById('upGallery').innerHTML = (data.gallery_urls || []).map(u => `<img src="${u}" onclick="window.open('${u}')">`).join('') || '<p class="dim">Galería vacía</p>';
  openModal('modal-userprofile');
}
async function messageFromProfile() { if (viewedUserId) { await loadScript('chat.js'); startChatWith(viewedUserId); } }
function joinKycRoom() {
  const room = 'FENDYX_KYC_' + currentUser.id.slice(0, 8);
  document.getElementById('kycTitle').textContent = '🎥 Verificación KYC en curso';
  document.getElementById('kycVerifyBtn').classList.add('hidden');
  openModal('modal-kyc');
  kycApi = new JitsiMeetExternalAPI('meet.jit.si', { roomName: room, width: '100%', height: '100%', parentNode: document.getElementById('kycContainer'), userInfo: { displayName: currentProfile.full_name } });
  showToast('🎥 Conectado a la sala KYC. El admin se unirá.');
}
function closeKyc() { if (kycApi) { kycApi.dispose(); kycApi = null; } closeModal('modal-kyc'); }
