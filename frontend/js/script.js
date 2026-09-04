// ---------- Mobile menu ----------
const menuToggle = document.getElementById('menuToggle');
const menuClose = document.getElementById('menuClose');
const mobilePanel = document.getElementById('mobilePanel');
menuToggle.addEventListener('click', () => mobilePanel.classList.add('open'));
menuClose.addEventListener('click', () => mobilePanel.classList.remove('open'));
mobilePanel.querySelectorAll('.mp-link').forEach(a => a.addEventListener('click', () => mobilePanel.classList.remove('open')));

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

// ---------- Signup modal ----------
const signupOverlay = document.getElementById('signupOverlay');
const signupForm = document.getElementById('signupForm');
const signupSuccess = document.getElementById('signupSuccess');
const planSelect = document.getElementById('plano');
const realSignupForm = document.getElementById('realSignupForm');
const signupSubmitBtn = realSignupForm.querySelector('button[type="submit"]');

function openSignup(planName){
  signupForm.style.display = 'block';
  signupSuccess.classList.remove('show');
  realSignupForm.reset();
  if(planName){ planSelect.value = planName; }
  signupOverlay.classList.add('open');
}
function closeSignup(){ signupOverlay.classList.remove('open'); }

['navCtaBtn','mobileCtaBtn','heroCtaBtn','finalCtaBtn'].forEach(id=>{
  const el = document.getElementById(id);
  if(el) el.addEventListener('click', () => { mobilePanel.classList.remove('open'); openSignup(); });
});
document.querySelectorAll('.plan-btn').forEach(btn=>{
  btn.addEventListener('click', () => {
    const plan = btn.getAttribute('data-plan');
    if(plan === 'Rede'){ openDemo(); } else { openSignup(plan); }
  });
});
document.getElementById('signupClose').addEventListener('click', closeSignup);
signupOverlay.addEventListener('click', (e) => { if(e.target === signupOverlay) closeSignup(); });

const signupError = document.getElementById('signupError');

function checkApiLoaded(errorTarget) {
  if (typeof Api === 'undefined') {
    errorTarget.textContent = 'Erro ao carregar arquivos do sistema (js/api.js). Confira se a pasta "js" está completa, ao lado do index.html.';
    errorTarget.classList.add('show');
    return false;
  }
  return true;
}

realSignupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  signupError.classList.remove('show');
  if (!checkApiLoaded(signupError)) return;

  const senha = document.getElementById('senha').value;
  const senhaConfirma = document.getElementById('senhaConfirma').value;

  if (senha !== senhaConfirma) {
    signupError.textContent = 'As senhas não conferem.';
    signupError.classList.add('show');
    return;
  }

  const payload = {
    loja: document.getElementById('loja').value.trim(),
    email: document.getElementById('email').value.trim(),
    senha,
    plano: document.getElementById('plano').value
  };

  signupSubmitBtn.disabled = true;
  const originalLabel = signupSubmitBtn.textContent;
  signupSubmitBtn.textContent = 'Enviando...';

  try {
    const data = await Api.signup(payload);

    // Cadastro cria a conta e já autentica o usuário (login automático)
    localStorage.setItem('ecostock_token', data.token);
    localStorage.setItem('ecostock_user', JSON.stringify(data.user));

    signupForm.style.display = 'none';
    signupSuccess.classList.add('show');

    if (data._mock) {
      showToast('Back-end offline: conta salva neste navegador (modo local).');
    }
  } catch (err) {
    signupError.textContent = err.message || 'Erro ao conectar com o servidor. Tente novamente.';
    signupError.classList.add('show');
  } finally {
    signupSubmitBtn.disabled = false;
    signupSubmitBtn.textContent = originalLabel;
  }
});

document.getElementById('signupDone').addEventListener('click', () => {
  window.location.href = 'dashboard.html';
});

// ---------- Demo modal ----------
const demoOverlay = document.getElementById('demoOverlay');
const demoForm = document.getElementById('demoForm');
const demoSubmitBtn = demoForm.querySelector('button[type="submit"]');

function openDemo(){ demoOverlay.classList.add('open'); }
function closeDemo(){ demoOverlay.classList.remove('open'); }
['heroDemoBtn','finalDemoBtn'].forEach(id=>{
  const el = document.getElementById(id);
  if(el) el.addEventListener('click', openDemo);
});
document.getElementById('demoClose').addEventListener('click', closeDemo);
demoOverlay.addEventListener('click', (e) => { if(e.target === demoOverlay) closeDemo(); });

demoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (typeof Api === 'undefined') {
    showToast('Erro ao carregar arquivos do sistema (js/api.js). Confira se a pasta "js" está completa.');
    return;
  }

  const payload = {
    nome: document.getElementById('dnome').value.trim(),
    telefone: document.getElementById('dtel').value.trim(),
    negocio: document.getElementById('dneg').value
  };

  demoSubmitBtn.disabled = true;
  const originalLabel = demoSubmitBtn.textContent;
  demoSubmitBtn.textContent = 'Enviando...';

  try {
    await Api.demo(payload);

    closeDemo();
    showToast('Demonstração agendada — nosso time vai te chamar em breve.');
    demoForm.reset();
  } catch (err) {
    showToast(err.message || 'Erro ao conectar com o servidor. Tente novamente.');
  } finally {
    demoSubmitBtn.disabled = false;
    demoSubmitBtn.textContent = originalLabel;
  }
});

// ---------- Footer placeholder links ----------
document.querySelectorAll('.footLink').forEach(a=>{
  a.addEventListener('click', (e) => { e.preventDefault(); showToast('Página em construção.'); });
});

// ---------- Tabs ----------
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`.tab-panel[data-panel="${btn.dataset.tab}"]`).classList.add('active');
  });
});

// ---------- FAQ accordion ----------
document.querySelectorAll('.faq-item').forEach(item => {
  const q = item.querySelector('.faq-q');
  const a = item.querySelector('.faq-a');
  if(item.classList.contains('open')){ a.style.maxHeight = a.scrollHeight + 'px'; }
  q.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(other => {
      other.classList.remove('open');
      other.querySelector('.faq-a').style.maxHeight = null;
    });
    if(!isOpen){
      item.classList.add('open');
      a.style.maxHeight = a.scrollHeight + 'px';
    }
  });
});

// ---------- Pricing toggle ----------
const toggleMonthly = document.getElementById('toggleMonthly');
const toggleYearly = document.getElementById('toggleYearly');
const priceVals = document.querySelectorAll('.price-val');
toggleMonthly.addEventListener('click', () => {
  toggleMonthly.classList.add('active'); toggleYearly.classList.remove('active');
  priceVals.forEach(v => v.textContent = 'R$ ' + v.dataset.m);
});
toggleYearly.addEventListener('click', () => {
  toggleYearly.classList.add('active'); toggleMonthly.classList.remove('active');
  priceVals.forEach(v => v.textContent = 'R$ ' + v.dataset.y);
});

// ---------- Close mobile menu on resize to desktop ----------
window.addEventListener('resize', () => { if(window.innerWidth > 720) mobilePanel.classList.remove('open'); });

// ---------- Abre o cadastro automaticamente se a URL vier com #cadastro ----------
// (usado pelo link "Cadastre-se" da tela de login)
if (window.location.hash === '#cadastro') {
  openSignup();
  history.replaceState(null, '', window.location.pathname + window.location.search);
}
