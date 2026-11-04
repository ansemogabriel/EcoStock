// Bloqueia o acesso caso não haja sessão válida
if (!Auth.requireLogin()) {
  throw new Error('Redirecionando para login...');
}

// Verificação de integridade: garante que api.js foi carregado antes de usá-lo
if (typeof Api === 'undefined') {
  document.getElementById('dashLoading').hidden = true;
  const errEl = document.getElementById('dashError');
  errEl.hidden = false;
  errEl.textContent = 'Erro ao carregar arquivos do sistema (js/api.js). Confira se a pasta "js" está completa, ao lado deste arquivo.';
  throw new Error('Api indisponível');
}

// ---------- Toast ----------
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');
let toastTimer;
function showToast(msg) {
  toastMsg.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ---------- Cabeçalho: saudação + data ----------
const user = Auth.getUser();
const hora = new Date().getHours();
const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
document.getElementById('greeting').textContent = user && user.loja ? `${saudacao}, ${user.loja}` : saudacao;

const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
document.getElementById('todayDate').textContent = hoje.charAt(0).toUpperCase() + hoje.slice(1);

// ---------- Sidebar: perfil + itens ainda não implementados ----------
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

if (sessionStorage.getItem('ecostock_mock_notice')) {
  sessionStorage.removeItem('ecostock_mock_notice');
  setTimeout(() => showToast('Back-end offline: usando dados salvos neste navegador.'), 400);
}

let proximosVencimento = null;
document.getElementById('bellBtn').addEventListener('click', () => {
  showToast(proximosVencimento === null
    ? 'Carregando seus alertas...'
    : `Você tem ${proximosVencimento} produtos próximos do vencimento.`);
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  Auth.logout();
});

// ---------- Formatação ----------
const brl = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCurto = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num = (value) => value.toLocaleString('pt-BR');
const plural = (n, um, varios) => `${num(n)} ${n === 1 ? um : varios}`;

// Cores dos motivos de perda (na ordem em que vêm da API)
const CORES_MOTIVOS = ['var(--beet)', 'var(--mango)', 'var(--leaf)', 'var(--slate)'];

// ---------- Carrega os dados do painel ----------
async function loadDashboard() {
  const loadingEl = document.getElementById('dashLoading');
  const errorEl = document.getElementById('dashError');
  const contentEl = document.getElementById('dashContent');

  try {
    const data = await Api.dashboardSummary(Auth.getToken());
    renderDashboard(data);
    loadingEl.hidden = true;
    contentEl.hidden = false;
  } catch (err) {
    if (err.status === 401) {
      Auth.logout();
      return;
    }
    loadingEl.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent = err.message || 'Não foi possível carregar os dados. Atualize a página para tentar de novo.';
  }
}

function renderDashboard(data) {
  proximosVencimento = data.proximosVencimento;

  // ---- Linha da validade ----
  const atencao = data.vencidos + data.vencendoHoje + data.proximosVencimento;
  const emDia = Math.max(data.produtosCadastrados - atencao, 0);

  document.getElementById('kpiAtencao').textContent = num(atencao);
  document.getElementById('pulseTitle').textContent = atencao === 1 ? 'produto pede atenção' : 'produtos pedem atenção';
  document.getElementById('pulseSub').textContent =
    `${plural(data.vencidos, 'vencido', 'vencidos')}, ` +
    `${plural(data.vencendoHoje, 'vence hoje', 'vencem hoje')} e ` +
    `${plural(data.proximosVencimento, 'vence nos próximos dias', 'vencem nos próximos dias')}.`;

  document.getElementById('kpiVencidos').textContent = num(data.vencidos);
  document.getElementById('kpiHoje').textContent = num(data.vencendoHoje);
  document.getElementById('kpiProximos').textContent = num(data.proximosVencimento);
  document.getElementById('kpiEmDia').textContent = num(emDia);
  document.getElementById('kpiProdutos').textContent = num(data.produtosCadastrados);
  document.getElementById('sideVencBadge').textContent = num(data.proximosVencimento);

  // ---- Faixa financeira ----
  document.getElementById('kpiValorRisco').textContent = brl(data.valorEmRisco);
  document.getElementById('kpiEconomia').textContent = brl(data.economiaNoMes);
  document.getElementById('kpiSalvos').textContent = num(data.produtosSalvos);
  if (data.valorEmRisco > 0) {
    const razao = (data.economiaNoMes / data.valorEmRisco).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    document.getElementById('kpiEconomiaNote').textContent = `${razao}× o valor em risco`;
  }

  renderBarChart(data.resumoMes);
  renderMotivos(data.motivosPerdas);
}

// ---- Barras agrupadas: perdas x recuperado por semana ----
function renderBarChart(semanas) {
  const totalPerdas = semanas.reduce((s, m) => s + m.perdas, 0);
  const totalRecuperado = semanas.reduce((s, m) => s + m.recuperado, 0);
  document.getElementById('totalPerdas').textContent = brlCurto(totalPerdas);
  document.getElementById('totalRecuperado').textContent = brlCurto(totalRecuperado);

  // Escala com divisões redondas (ex.: 0, 100, 200, 300, 400)
  const maior = Math.max(1, ...semanas.flatMap(m => [m.perdas, m.recuperado]));
  const magnitude = Math.pow(10, Math.floor(Math.log10(maior)));
  const passo = [1, 2, 2.5, 5, 10].map(f => f * magnitude).find(p => maior / p <= 4);
  const topo = Math.ceil(maior / passo) * passo;
  const linhas = [];
  for (let v = 0; v <= topo; v += passo) linhas.push(v);

  const pct = (v) => (v / topo * 100).toFixed(1);

  const chart = document.getElementById('barChart');
  chart.setAttribute('aria-label',
    'Perdas e recuperado por semana: ' +
    semanas.map(m => `${m.mes}, perdas ${brlCurto(m.perdas)} e recuperado ${brlCurto(m.recuperado)}`).join('; '));

  chart.innerHTML = `
    <div class="chart-grid" aria-hidden="true">
      ${linhas.map(v => `
        <div class="gridline${v === 0 ? ' base' : ''}" style="bottom:${pct(v)}%"><span>${num(v)}</span></div>
      `).join('')}
    </div>
    <div class="chart-groups" aria-hidden="true">
      ${semanas.map(m => `
        <div class="group">
          <div class="group-bars">
            <div class="bar loss" style="height:${pct(m.perdas)}%"><span class="tip">${brlCurto(m.perdas)}</span></div>
            <div class="bar recovered" style="height:${pct(m.recuperado)}%"><span class="tip">${brlCurto(m.recuperado)}</span></div>
          </div>
          <span class="group-label">${m.mes}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ---- Motivos de perda: barra de proporção + ranking ----
function renderMotivos(motivos) {
  const ordenados = motivos
    .map((m, i) => ({ ...m, cor: CORES_MOTIVOS[i % CORES_MOTIVOS.length] }))
    .sort((a, b) => b.percentual - a.percentual);

  document.getElementById('donutChart').innerHTML = ordenados
    .map(m => `<span style="--c:${m.cor}; flex:${m.percentual}"></span>`)
    .join('');

  document.getElementById('donutLegend').innerHTML = ordenados.map(m => `
    <li class="reason" style="--c:${m.cor}">
      <span class="reason-name"><i></i>${m.motivo}</span>
      <span class="reason-pct">${m.percentual}%</span>
      <span class="reason-bar"><span style="width:${m.percentual}%"></span></span>
    </li>
  `).join('');
}

loadDashboard();
