'use strict';
let pendingSignup = null;
let pendingRecoverEmail = null;

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
    delivery: [['regLicense','Número de licencia'],['regPlate','Placa'],['regVehicleType','']],
    nightclub: [['regClubName','Nombre del bar/discoteca'],['regClubAddress','Dirección']],
    remote_worker: [['regSpecialty','Especialidad (ej: compañía, conversación, idiomas)'],['regBio','Cuéntanos sobre ti']]
  }[role] || [];
  c.innerHTML = f.map(x => x[0] === 'regVehicleType'
    ? `<div class="input-group"><select id="regVehicle"><option value="moto">🏍️ Moto</option><option value="bicicleta">🚲 Bicicleta</option><option value="carro">🚗 Carro</option></select></div>`
    : x[0] === 'regBio'
    ? `<div class="input-group"><textarea id="regBio" placeholder="${x[1]}" rows="3"></textarea></div>`
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
function isNetworkErr(msg) {
  const m = (msg || '').toLowerCase();
  return m.includes('504') || m.includes('502') || m.includes('timeout') || m.includes('http error') || m.includes('failed to fetch');
}
function friendlyError(msg) {
  const m = (msg || '').toLowerCase();
  if (isNetworkErr(m)) return 'El servidor tardó demasiado. Reintentamos automáticamente; si persiste, espera 1 minuto.';
  if (m.includes('already registered')) return 'Este correo ya tiene cuenta. Inicia sesión.';
  if (m.includes('invalid login')) return 'Correo o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Verifica tu correo con el código de 6 dígitos.';
  if (m.includes('rate limit') || m.includes('once every')) return 'Espera 60 segundos entre envíos de código.';
  if (m.includes('invalid otp') || m.includes('expired') || m.includes('token')) return 'Código incorrecto o expirado. Pide uno nuevo.';
  if (m.includes('password')) return 'Contraseña inválida (mínimo 6 caracteres).';
  if (m.includes('solo mujeres')) return 'Solo mujeres pueden registrarse como trabajadoras remotas.';
  return msg || 'Error inesperado. Intenta de nuevo.';
}
const wait = ms => new Promise(r => setTimeout(r, ms));

async function handleLogin(e) {
  e.preventDefault();
  setBtnLoading('btnLogin', true); showAuthMessage('', '');
  try {
    let res = await db.auth.signInWithPassword({
      email: document.getElementById('loginEmail').value.trim().toLowerCase(),
      password: document.getElementById('loginPassword').value
    });
    if (res.error && isNetworkErr(res.error.message)) { await wait(1500); res = await db.auth.signInWithPassword({
      email: document.getElementById('loginEmail').value.trim().toLowerCase(),
      password: document.getElementById('loginPassword').value }); }
    if (res.error) throw res.error;
    location.replace('app.html');
  } catch (err) {
    showAuthMessage('❌ ' + friendlyError(err.message), 'error');
  } finally { setBtnLoading('btnLogin', false); }
}

async function handleRegister(e) {
  e.preventDefault();
  const age = parseInt(document.getElementById('regAge').value, 10);
  const role = document.getElementById('regRole').value;
  const gender = document.getElementById('regGender').value;
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const password = document.getElementById('regPassword').value;
  
  if (!age || age < 18) { showAuthMessage('Debes ser mayor de 18 años.', 'error'); return; }
  if (!role) { showAuthMessage('Selecciona un tipo de cuenta.', 'error'); return; }
  if (!gender) { showAuthMessage('Selecciona tu género.', 'error'); return; }
  
  // Validación: solo mujeres pueden ser remote_worker
  if (role === 'remote_worker' && gender !== 'female') {
    showAuthMessage('❌ Solo mujeres pueden registrarse como trabajadoras remotas.', 'error');
    return;
  }
  
  setBtnLoading('btnRegister', true); showAuthMessage('', '');
  const meta = {
    full_name: document.getElementById('regName').value.trim(),
    age, role, gender,
    rif: document.getElementById('regRIF')?.value || '',
    business_name: document.getElementById('regBusinessName')?.value || '',
    address: document.getElementById('regAddress')?.value || '',
    license: document.getElementById('regLicense')?.value || '',
    plate: document.getElementById('regPlate')?.value || '',
    vehicle: document.getElementById('regVehicle')?.value || '',
    club_name: document.getElementById('regClubName')?.value || '',
    club_address: document.getElementById('regClubAddress')?.value || '',
    specialty: document.getElementById('regSpecialty')?.value || '',
    bio: document.getElementById('regBio')?.value || '',
    rate: role === 'remote_worker' ? '0.5' : '1'
  };
  
  const payload = { email, password, options: { data: meta, emailRedirectTo: location.origin + '/index.html' } };
  try {
    let res = await db.auth.signUp(payload);
    if (res.error && isNetworkErr(res.error.message)) { await wait(2000); res = await db.auth.signUp(payload); }
    if (res.error) throw res.error;
    localStorage.setItem('fendyx_pending_meta', JSON.stringify(meta));
    if (res.data.session) { location.replace('app.html'); return; }
    pendingSignup = { email, password };
    document.getElementById('verifyEmailLabel').textContent = email;
    document.getElementById('verifyCode').value = '';
    openModal('modal-verify');
    showAuthMessage('📧 Código de 6 dígitos enviado a tu correo.', 'success');
  } catch (err) {
    showAuthMessage('❌ ' + friendlyError(err.message), 'error');
  } finally { setBtnLoading('btnRegister', false); }
}

async function confirmSignupCode() {
  const code = document.getElementById('verifyCode').value.trim();
  if (!pendingSignup) { showToast('Primero crea tu cuenta'); return; }
  if (!/^\d{6}$/.test(code)) { showToast('El código tiene 6 dígitos'); return; }
  const { error } = await db.auth.verifyOTP({ email: pendingSignup.email, token: code, type: 'signup' });
  if (error) { showToast('❌ ' + friendlyError(error.message)); return; }
  closeModal('modal-verify');
  showToast('✅ Correo verificado. ¡Bienvenido a FENDYX!');
  setTimeout(() => location.replace('app.html'), 900);
}
async function resendSignupCode() {
  if (!pendingSignup) return;
  const { error } = await db.auth.resend({ type: 'signup', email: pendingSignup.email });
  showToast(error ? '❌ ' + friendlyError(error.message) : '📧 Código reenviado');
}

function openRecover() {
  document.getElementById('recoverStep1').classList.remove('hidden');
  document.getElementById('recoverStep2').classList.add('hidden');
  document.getElementById('recoverStep3').classList.add('hidden');
  openModal('modal-recover');
}
async function recoverSendCode() {
  const email = document.getElementById('recoverEmail').value.trim().toLowerCase();
  if (!email) { showToast('Escribe tu correo'); return; }
  let res = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
  if (res.error && isNetworkErr(res.error.message)) { await wait(2000); res = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin }); }
  if (res.error) { showToast('❌ ' + friendlyError(res.error.message)); return; }
  pendingRecoverEmail = email;
  document.getElementById('recoverStep1').classList.add('hidden');
  document.getElementById('recoverStep2').classList.remove('hidden');
  document.getElementById('recoverCode').value = '';
  showToast('📧 Código enviado a ' + email);
}
async function recoverVerifyCode() {
  const code = document.getElementById('recoverCode').value.trim();
  if (!/^\d{6}$/.test(code)) { showToast('El código tiene 6 dígitos'); return; }
  const { error } = await db.auth.verifyOTP({ email: pendingRecoverEmail, token: code, type: 'recovery' });
  if (error) { showToast('❌ ' + friendlyError(error.message)); return; }
  document.getElementById('recoverStep2').classList.add('hidden');
  document.getElementById('recoverStep3').classList.remove('hidden');
  showToast('✅ Código correcto. Crea tu nueva contraseña');
}
async function recoverSavePass() {
  const np = document.getElementById('recoverNewPass').value;
  if (np.length < 6) { showToast('Mínimo 6 caracteres'); return; }
  const { error } = await db.auth.updateUser({ password: np });
  if (error) { showToast('❌ ' + friendlyError(error.message)); return; }
  await db.auth.signOut();
  closeModal('modal-recover');
  showAuthMessage('✅ Contraseña cambiada. Ya puedes iniciar sesión.', 'success');
  switchAuthTab('login');
}

if (location.search.includes('banned=1')) {
  document.addEventListener('DOMContentLoaded', () => showAuthMessage('🚫 Cuenta suspendida por el administrador', 'error'));
}
