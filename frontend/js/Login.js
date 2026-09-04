// Se já estiver logado, pula direto pro painel
if (Auth.isLoggedIn()) {
  window.location.href = 'dashboard.html';
}

// ---------- Toast helper ----------
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');
let toastTimer;
function showToast(msg){
  toastMsg.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ---------- Password visibility toggle ----------
const loginSenha = document.getElementById('loginSenha');
const pwToggle = document.getElementById('pwToggle');
const pwIcon = document.getElementById('pwIcon');
const eyeOpen = '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/>';
const eyeClosed = '<path d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.4 5.3A10.4 10.4 0 0112 5c6 0 10 7 10 7a17.6 17.6 0 01-3.2 3.9M6.5 6.7C4 8.4 2 12 2 12s4 7 10 7c1.3 0 2.5-.2 3.6-.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';

pwToggle.addEventListener('click', () => {
  const isPassword = loginSenha.type === 'password';
  loginSenha.type = isPassword ? 'text' : 'password';
  pwIcon.innerHTML = isPassword ? eyeClosed : eyeOpen;
  pwToggle.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
});

// ---------- Forgot password (placeholder funcional) ----------
document.getElementById('forgotLink').addEventListener('click', (e) => {
  e.preventDefault();
  showToast('Envie um e-mail para suporte@ecostock.app para redefinir sua senha.');
});

// ---------- Login submit ----------
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.remove('show');

  const payload = {
    email: document.getElementById('loginEmail').value.trim(),
    senha: loginSenha.value
  };

  loginSubmitBtn.disabled = true;
  const originalLabel = loginSubmitBtn.textContent;
  loginSubmitBtn.textContent = 'Entrando...';

  try {
    const res = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Não foi possível entrar.');
    }

    Auth.setSession(data.token, data.user);
    window.location.href = 'dashboard.html';
  } catch (err) {
    loginError.textContent = err.message || 'Erro ao conectar com o servidor. Tente novamente.';
    loginError.classList.add('show');
  } finally {
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = originalLabel;
  }
});