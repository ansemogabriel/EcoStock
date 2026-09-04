// Bloqueia o acesso caso não haja sessão válida
if (!Auth.requireLogin()) {
  throw new Error('Redirecionando para login...');
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

// ---------- Sidebar: perfil + itens ainda não implementados ----------
const user = Auth.getUser();
if (user) {
  document.getElementById('sideName').textContent = user.loja || 'Minha loja';
  document.getElementById('sideStore').textContent = user.plano ? `Plano ${user.plano}` : user.email;
  const initials = (user.loja || user.email || '?').trim().slice(0, 2).toUpperCase();
  document.getElementById('sideAvatar').textContent = initials;
}

document.querySelectorAll('.soon-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    showToast('Essa tela ainda está em construção.');
  });
});

document.getElementById('bellBtn').addEventListener('click', () => {
  showToast('Você tem 16 produtos próximos do vencimento.');
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  Auth.logout();
});

// ---------- Formatação ----------
const brl = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ---------- Carrega os dados do painel ----------
async function loadDashboard() {
  const loadingEl = document.getElementById('dashLoading');
  const errorEl = document.getElementById('dashError');
  const contentEl = document.getElementById('dashContent');

  try {
    const res = await Auth.authFetch('/dashboard/summary');
    if (!res) return; // authFetch já redirecionou para login (401)

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Não foi possível carregar o painel.');
    }

    renderDashboard(data);
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
  } catch (err) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.textContent = err.message || 'Erro ao carregar os dados. Tente atualizar a página.';
  }
}

function renderDashboard(data) {
  document.getElementById('kpiProdutos').textContent = data.produtosCadastrados;
  document.getElementById('kpiProximos').textContent = data.proximosVencimento;
  document.getElementById('kpiHoje').textContent = data.vencendoHoje;
  document.getElementById('kpiVencidos').textContent = data.vencidos;
  document.getElementById('kpiValorRisco').textContent = brl(data.valorEmRisco);
  document.getElementById('kpiEconomia').textContent = brl(data.economiaNoMes);
  document.getElementById('kpiSalvos').textContent = data.produtosSalvos;
  document.getElementById('sideVencBadge').textContent = data.proximosVencimento;

  // ---- Gráfico de barras (perdas x recuperado) ----
  const barChart = document.getElementById('barChart');
  const resumoMes = Array.isArray(data.resumoMes) ? data.resumoMes : [];
  const maxVal = Math.max(1, ...resumoMes.flatMap(m => [Number(m.perdas) || 0, Number(m.recuperado) || 0]));
  barChart.innerHTML = resumoMes.map(m => `
    <div class="bar-col">
      <div class="bar-stack">
        <div class="bar recovered" style="height:${((Number(m.recuperado) || 0) / maxVal * 100).toFixed(0)}%"></div>
        <div class="bar loss" style="height:${((Number(m.perdas) || 0) / maxVal * 100).toFixed(0)}%"></div>
      </div>
      <span>${m.mes}</span>
    </div>
  `).join('');

  // ---- Donut de motivos de perda ----
  const cores = ['var(--terracotta)', 'var(--amber)', 'var(--green-500)', 'var(--green-800)'];
  let acc = 0;
  const motivosPerdas = Array.isArray(data.motivosPerdas) ? data.motivosPerdas : [];
  const gradientParts = motivosPerdas.map((m, i) => {
    const start = acc;
    acc += m.percentual;
    return `${cores[i % cores.length]} ${start}% ${acc}%`;
  });
  document.getElementById('donutChart').style.background = gradientParts.length
    ? `conic-gradient(${gradientParts.join(', ')})`
    : 'var(--line)';
  document.getElementById('donutChart').style.setProperty('--donut-hole', '#fff');
  document.getElementById('donutChart').style.boxShadow = 'inset 0 0 0 22px var(--paper)';

  document.getElementById('donutLegend').innerHTML = motivosPerdas.map((m, i) => `
    <div class="row">
      <span class="left"><span class="legend-dot" style="background:${cores[i % cores.length]};width:9px;height:9px;border-radius:3px;"></span>${m.motivo}</span>
      <b>${m.percentual}%</b>
    </div>
  `).join('');
}

loadDashboard();