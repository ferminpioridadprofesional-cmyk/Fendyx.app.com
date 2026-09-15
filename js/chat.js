'use strict';
let currentConvId = null, convCache = [];
async function loadConversations() {
  const { data } = await db.from('conversations').select('*').or(`user_a.eq.${currentUser.id},user_b.eq.${currentUser.id}`);
  convCache = data || [];
  if (!convCache.length) { document.getElementById('chatList').innerHTML = '<p class="empty-state">Inicia un chat desde el Mapa, Radar o Marketplace</p>'; return; }
  const others = convCache.map(c => c.user_a === currentUser.id ? c.user_b : c.user_a);
  const { data: profs } = await db.from('profiles').select('id, full_name').in('id', others);
  const pm = {}; (profs || []).forEach(p => pm[p.id] = p.full_name);
  const { data: msgs } = await db.from('messages').select('*').in('conversation_id', convCache.map(c => c.id)).order('created_at', { ascending: false }).limit(300);
  const last = {}, unread = {};
  (msgs || []).forEach(m => { if (!last[m.conversation_id]) last[m.conversation_id] = m.content; if (m.sender_id !== currentUser.id && !m.is_read) unread[m.conversation_id] = (unread[m.conversation_id] || 0) + 1; });
  document.getElementById('chatList').innerHTML = convCache.map(c => {
    const other = c.user_a === currentUser.id ? c.user_b : c.user_a;
    return `<div class="conv-item ${c.id === currentConvId ? 'active' : ''}" onclick="openConversation('${c.id}')">
      <div class="conv-avatar">${(pm[other] || 'U').charAt(0).toUpperCase()}</div>
      <div class="conv-info"><div class="conv-name">${pm[other] || 'Usuario'}</div><div class="conv-last">${last[c.id] || 'Sin mensajes'}</div></div>
      ${unread[c.id] ? `<span class="unread-badge">${unread[c.id]}</span>` : ''}</div>`;
  }).join('');
}
async function openConversation(id) {
  currentConvId = id;
  const conv = convCache.find(c => c.id === id);
  const other = conv.user_a === currentUser.id ? conv.user_b : conv.user_a;
  const { data: p } = await db.from('profiles').select('full_name').eq('id', other).single();
  document.getElementById('chatTitle').textContent = '💬 ' + (p?.full_name || 'Chat');
  const { data: msgs } = await db.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true });
  renderMessages(msgs || []);
  await db.from('messages').update({ is_read: true }).eq('conversation_id', id).neq('sender_id', currentUser.id);
  loadConversations();
}
function renderMessages(msgs) {
  document.getElementById('chatMessages').innerHTML = msgs.map(m =>
    `<div class="message ${m.sender_id === currentUser.id ? 'sent' : 'received'}">${m.content}<small>${new Date(m.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</small></div>`).join('')
    || '<p class="empty-state">💬 Escribe el primer mensaje</p>';
  const b = document.getElementById('chatMessages'); b.scrollTop = b.scrollHeight;
}
async function sendMessage() {
  const inp = document.getElementById('messageInput');
  const text = inp.value.trim();
  if (!text || !currentConvId) return;
  inp.value = '';
  await db.from('messages').insert({ conversation_id: currentConvId, sender_id: currentUser.id, content: text });
  const { data: msgs } = await db.from('messages').select('*').eq('conversation_id', currentConvId).order('created_at', { ascending: true });
  renderMessages(msgs || []);
}
async function startChatWith(userId) {
  if (userId === currentUser.id) { showToast('No puedes escribirte a ti mismo 😅'); return; }
  closeModal('modal-userprofile');
  let conv = convCache.find(c => (c.user_a === currentUser.id && c.user_b === userId) || (c.user_b === currentUser.id && c.user_a === userId));
  if (!conv) { const { data } = await db.from('conversations').insert({ user_a: currentUser.id, user_b: userId }).select().single(); conv = data; }
  showSection('chat'); await loadConversations(); openConversation(conv.id);
}
function onMessageRealtime(m) {
  if (!document.getElementById('section-chat')?.classList.contains('active')) return;
  if (m.conversation_id === currentConvId) {
    const box = document.getElementById('chatMessages');
    box.insertAdjacentHTML('beforeend', `<div class="message received">${m.content}<small>ahora</small></div>`);
    box.scrollTop = box.scrollHeight;
    db.from('messages').update({ is_read: true }).eq('id', m.id);
  }
  loadConversations();
}
