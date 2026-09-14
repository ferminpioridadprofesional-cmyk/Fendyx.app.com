'use strict';
function switchAuthTab(tab) {
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
  document.getElementById('form-login').classList.toggle('active', tab === 'login');
  document.getElementById('form-register').classList.toggle('active', tab === 'register');
  showAuthMessage('', '');
}
function togglePassword(id, btn) {
  const i = document.getElementById(id);
  i.type = i.type === 'password' ? 'text' : 'password';
  btn.textContent = i.type === 'password' ? '👁' : '🙈';
}
function showRoleFields() {
  const role = document.getElementById('regRole').value, c = document.getElementById('roleFields');
  const f = {
    restaurant: [['regRIF','RIF del negocio'],['regBusinessName','Nombre del local'],['regAddress','Dirección']],
    delivery: [['regLicense','Número de licencia'],['regPlate','Placa'],['regVehicleType','moto|bicicleta|carro']],
    nightclub: [['regClubName','Nombre del bar/discoteca'],['regClubAddress','Dirección']],
    remote_worker: [['regSpecialty','Especialidad'],['regRate','Tarifa por minuto']]
  }[role] || [];
  c.innerHTML = f.map(x => x[0] === 'regVehicleType'
    ? `<div class="input-group"><select id="regVehicle"><option value="moto">🏍️ Moto</option><option value="bicicleta">🚲 Bicicleta</option><option value="carro">🚗 Carro</option></select></div>`
    : `<div class="input-group"><input type="text" id="${x[0]}" placeholder="${x[1]}"></div>`).join('');
}
function showAuthMessage(msg, type) {
  const el = document.getElementById('authMessage');
  el.textContent = msg; el.className = 'auth-message' + (type ? ' ' + type : '');
}
function setBtnLoading(id, on) {
  const b = document.getElementById(id);
  if (b) { b.disabled = on; b.textContent = on ? 'Procesando…' : (id === 'btnLogin' ? 'Entrar' : 'Crear Cuenta'); }
}
function friendlyError(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('already registered')) return 'Este correo ya tiene cuenta. Inicia sesión.';
  if (m.includes('invalid login')) return 'Correo o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de entrar.';
  if (m.includes('rate limit')) return 'Muchos intentos. Espera 1 minuto.';
  if (m.includes('password')) return 'Contraseña inválida (mínimo 6 caracteres).';
  return msg || 'Error inesperado. Intenta de nuevo.';
}

async function handleLogin(e) {
  e.preventDefault();
  setBtnLoading('btnLogin', true); showAuthMessage('', '');
  try {
    const { data, error } = await db.auth.signInWithPassword({
      email: document.getElementById('loginEmail').value.trim().toLowerCase(),
      password: document.getElementById('loginPassword').value
    });
    if (error) throw error;
    if (!data.user) throw new Error('Sin usuario');
    location.replace('app.html');
  } catch (err) {
    showAuthMessage('❌ ' + friendlyError(err.message), 'error');
  } finally { setBtnLoading('btnLogin', false); }
}

async function handleRegister(e) {
  e.preventDefault();
  const age = parseInt(document.getElementById('regAge').value, 10);
  const role = document.getElementById('regRole').value;
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  if (!age || age < 18) { showAuthMessage('Debes ser mayor de 18 años.', 'error'); return; }
  if (!role) { showAuthMessage('Selecciona un tipo de cuenta.', 'error'); return; }
  setBtnLoading('btnRegister', true); showAuthMessage('', '');
  const meta = {
    full_name: document.getElementById('regName').value.trim(), age, role,
    rif: document.getElementById('regRIF')?.value || '',
    business_name: document.getElementById('regBusinessName')?.value || '',
    address: document.getElementById('regAddress')?.value || '',
    license: document.getElementById('regLicense')?.value || '',
    plate: document.getElementById('regPlate')?.value || '',
    vehicle: document.getElementById('regVehicle')?.value || '',
    club_name: document.getElementById('regClubName')?.value || '',
    club_address: document.getElementById('regClubAddress')?.value || '',
    specialty: document.getElementById('regSpecialty')?.value || '',
    rate: document.getElementById('regRate')?.value || ''
  };
  try {
    const { data, error } = await db.auth.signUp({
      email, password: document.getElementById('regPassword').value,
      options: { data: meta, emailRedirectTo: location.origin + '/index.html' }
    });
    if (error) throw error;
    localStorage.setItem('fendyx_pending_meta', JSON.stringify(meta));
    if (data.session) { location.replace('app.html'); }
    else {
      showAuthMessage('✅ Cuenta creada. Revisa tu correo y luego inicia sesión.', 'success');
      document.getElementById('form-register').reset();
      document.getElementById('roleFields').innerHTML = '';
      setTimeout(() => switchAuthTab('login'), 1800);
    }
  } catch (err) {
    showAuthMessage('❌ ' + friendlyError(err.message), 'error');
  } finally { setBtnLoading('btnRegister', false); }
}

async function resetPassword() {
  const email = prompt('Ingresa tu correo:');
  if (!email) return;
  try {
    const { error } = await db.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: location.origin });
    showToast(error ? '❌ ' + friendlyError(error.message) : '📧 Correo enviado');
  } catch { showToast('❌ No se pudo enviar'); }
}

// Aviso de cuenta baneada al volver al login
if (location.search.includes('banned=1')) {
  document.addEventListener('DOMContentLoaded', () => showAuthMessage('🚫 Cuenta suspendida por el administrador', 'error'));
}
