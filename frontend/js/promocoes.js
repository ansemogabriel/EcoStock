// ---------------------------------------------------------------------------
// Promoções — sugestões de desconto geradas pelos alertas e seus resultados.
// ---------------------------------------------------------------------------

let promocoes = [];
let filtro = 'pendente';
let filtros;
const ORDENS = {
  recentes: (a, b) => String(b.criadaEm).localeCompare(String(a.criadaEm)),
  validade: App.cmpNum('diasRestantes'),
  desconto: App.cmpNum('desconto', true),
  vendido: App.cmpNum('valorVendido', true)
};
const tabela = document.getElementById('tabela');
const pag = App.paginacao();
pag.ligar(tabela, () => render());

const FILTROS = [
  { key: 'pendente', label: 'Aguardando decisão' },
  { key: 'andamento', label: 'Em andamento' },
  { key: 'encerrada', label: 'Encerradas' },
  { key: 'todas', label: 'Todas' }
];

function situacao(p) {
  if (p.alertaStatus === 'ABERTO' && p.status === 'PENDENTE') return 'pendente';
  if (p.alertaStatus === 'ABERTO' && p.status === 'ACEITA') return 'andamento';
  return 'encerrada';
}

(async function () {
  await App.init('promocoes');
  filtros = App.bindFilters('filtros', render, () => { filtro = 'todas'; renderFiltros(); });
  try {
    const data = await Api.get('/promocoes');
    promocoes = data.promocoes;
    App.fillSelect(document.getElementById('fCategoria'), App.categorias(promocoes), 'Todas');
    resumo();
    renderFiltros();
    render();
    renderRegras(data.regras);
  } catch (err) {
    tabela.innerHTML = `<div class="notice">${App.esc(err.message)}</div>`;
  }
})();

function resumo() {
  const aplicadas = promocoes.filter(p => p.status === 'ACEITA');
  const valor = promocoes.reduce((s, p) => s + Number(p.valorVendido), 0);
  const decididas = promocoes.filter(p => p.status !== 'PENDENTE').length;
  document.getElementById('kPendentes').textContent = promocoes.filter(p => situacao(p) === 'pendente').length;
  document.getElementById('kAplicadas').textContent = aplicadas.length;
  document.getElementById('kAplicadasNote').textContent = decididas
    ? `${Math.round(aplicadas.length / decididas * 100)}% das sugestões decididas foram aplicadas` : 'Nenhuma decisão registrada ainda';
  document.getElementById('kValor').textContent = App.brl(valor);
}

function renderFiltros() {
  const el = document.getElementById('filtrosStatus');
  el.innerHTML = FILTROS.map(f => {
    const n = f.key === 'todas' ? promocoes.length : promocoes.filter(p => situacao(p) === f.key).length;
    return `<button type="button" class="${f.key === filtro ? 'active' : ''}" data-f="${f.key}">${f.label} <span class="seg-count">${n}</span></button>`;
  }).join('');
  el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { filtro = b.dataset.f; renderFiltros(); render(); }));
}

function render() {
  const termo = App.normalizar(document.getElementById('fBusca').value.trim());
  const desc = document.getElementById('fDesconto').value;
  const periodo = document.getElementById('fPeriodo').value;
  const cat = document.getElementById('fCategoria').value;
  const faixa = d => Number(d) <= 15 ? '15' : Number(d) <= 30 ? '30' : '31';
  const lista = App.ordenar(promocoes.filter(p =>
    (filtro === 'todas' || situacao(p) === filtro) &&
    (!desc || faixa(p.desconto) === desc) &&
    App.dentroDe(p.criadaEm, periodo) &&
    (!cat || p.categoria === cat) &&
    (!termo || App.normalizar(p.produto).includes(termo) || App.normalizar(p.codigo).includes(termo))),
    ORDENS, document.getElementById('fOrdem').value);
  App.resultado(filtros.meta, lista.length, promocoes.length, promocoes.length === 1 ? 'promoção' : 'promoções',
    filtros.ativo() || filtro !== 'todas');
  if (!lista.length && filtros.ativo()) {
    tabela.innerHTML = App.emptyState('Nenhuma promoção com esses filtros', 'Mude a busca ou clique em “Limpar filtros”.');
    return;
  }
  if (!lista.length) {
    const textos = {
      pendente: ['Nenhuma sugestão esperando decisão', 'Quando um lote entrar na faixa de vencimento, a sugestão de desconto aparece aqui e em Vencimentos.'],
      andamento: ['Nenhuma promoção em andamento', 'Promoções aplicadas aparecem aqui até você registrar o resultado do lote.'],
      encerrada: ['Nenhuma promoção encerrada', 'Depois de registrar o resultado de um alerta, a promoção aparece aqui com o valor vendido.'],
      todas: ['Nenhuma promoção ainda', 'As sugestões são criadas automaticamente pelos alertas de validade.']
    }[filtro];
    tabela.innerHTML = App.emptyState(textos[0], textos[1]);
    return;
  }
  tabela.innerHTML = `<table class="data">
    <thead><tr><th>Produto</th><th>Validade</th><th class="num">Desconto</th><th class="num">Preço</th><th>Status</th><th class="num">Resultado</th><th><span class="sr-only">Ações</span></th></tr></thead>
    <tbody>${pag.fatiar(lista).map(linha).join('')}</tbody>
  </table>${pag.html('promoções')}`;
}

function linha(p) {
  const s = situacao(p);
  const status = {
    pendente: '<span class="chip urgente">Aguardando decisão</span>',
    andamento: '<span class="chip ok">Promoção ativa</span>',
    encerrada: p.status === 'ACEITA' ? '<span class="chip dark">Encerrada</span>'
      : p.status === 'RECUSADA' ? '<span class="chip">Não aplicada</span>' : '<span class="chip">Encerrada sem decisão</span>'
  }[s];
  const vendido = Number(p.vendido) > 0
    ? `${App.qtd(p.vendido, p.unidade)}<span class="sub">${App.brl(p.valorVendido)}</span>` : '<span class="sub">—</span>';
  const acao = s === 'encerrada'
    ? `<a class="btn-mini" href="vencimentos.html#historico">Ver histórico</a>`
    : `<a class="btn-mini solid" href="vencimentos.html#alerta-${p.alertaId}">${s === 'pendente' ? 'Decidir' : 'Registrar resultado'}</a>`;
  return `<tr>
    <td>${App.produtoCell(p.produto, 'Lote ' + App.esc(p.codigo || '—'), p.categoria)}</td>
    <td>${s === 'encerrada' ? App.date(p.dataValidade) : App.urgencyChip(p.diasRestantes)}</td>
    <td class="num">${App.num(p.desconto)}%</td>
    <td class="num">${App.brl(p.precoPromocional)}<span class="sub">era ${App.brl(p.precoVenda)}</span></td>
    <td>${status}</td>
    <td class="num">${vendido}</td>
    <td><div class="row-actions">${acao}</div></td>
  </tr>`;
}

function renderRegras(regras) {
  const chave = { PROXIMO: 'proximo', URGENTE: 'urgente', VENCE_HOJE: 'hoje', VENCIDO: 'vencido' };
  document.getElementById('regras').innerHTML = `<table class="data">
    <thead><tr><th>Faixa de validade</th><th class="num">Desconto sugerido</th><th>O que fazer</th></tr></thead>
    <tbody>${regras.map(r => `<tr>
      <td><span class="chip ${chave[r.tipo]}">${r.faixa}</span></td>
      <td class="num strong">${r.desconto ? r.desconto + '%' : '—'}</td>
      <td>${r.acao}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}
