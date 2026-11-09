// ---------------------------------------------------------------------------
// Lotes — entrada de mercadoria com validade, saldo e status de urgência.
// ---------------------------------------------------------------------------

let lotes = [];
let produtos = [];
let filtro = 'todos';
let loteSaldo = null;
let filtros;

const tabela = document.getElementById('tabela');
const pag = App.paginacao();
pag.ligar(tabela, () => render());
const zerados = document.getElementById('mostrarZerados');

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'vencido', label: 'Vencidos' },
  { key: 'hoje', label: 'Vencem hoje' },
  { key: 'urgente', label: '1 a 3 dias' },
  { key: 'proximo', label: '4 a 7 dias' },
  { key: 'ok', label: 'Em dia' }
];

const ORDENS = {
  validade: App.cmpNum('diasRestantes'),
  entrada: (a, b) => String(b.dataEntrada).localeCompare(String(a.dataEntrada)),
  valor: App.cmpNum('valorCusto', true),
  saldo: (a, b) => (a.quantidadeAtual / a.quantidadeRecebida) - (b.quantidadeAtual / b.quantidadeRecebida),
  produto: App.cmpTexto('produto')
};

(async function () {
  await App.init('lotes');
  document.getElementById('novoLote').addEventListener('click', () => abrirNovo());
  zerados.addEventListener('change', carregar);
  filtros = App.bindFilters('filtros', render, () => { filtro = 'todos'; renderFiltros(); });
  ['lProduto', 'lQtd', 'lEntrada', 'lValidade', 'lFabricacao'].forEach(id =>
    document.getElementById(id).addEventListener('input', previa));
  await carregar();

  const produtoUrl = new URLSearchParams(location.search).get('produto');
  if (produtoUrl) abrirNovo(produtoUrl);
})();

async function carregar() {
  try {
    [lotes, produtos] = await Promise.all([
      Api.get('/lotes' + (zerados.checked ? '?todos=1' : '')),
      Api.get('/produtos')
    ]);
    App.fillSelect(document.getElementById('fCategoria'), App.categorias(lotes), 'Todas');
    filtros.marcar();
    renderFiltros();
    render();
  } catch (err) {
    tabela.innerHTML = `<div class="notice">${App.esc(err.message)}</div>`;
  }
}

function chave(l) {
  return Number(l.quantidadeAtual) > 0 ? App.urgency(l.diasRestantes).key : 'zerado';
}

function renderFiltros() {
  const el = document.getElementById('segValidade');
  el.innerHTML = FILTROS.map(f => {
    const n = f.key === 'todos' ? lotes.length : lotes.filter(l => chave(l) === f.key).length;
    return `<button type="button" class="${f.key === filtro ? 'active' : ''}" data-f="${f.key}">${f.label} <span class="seg-count">${n}</span></button>`;
  }).join('');
  el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { filtro = b.dataset.f; renderFiltros(); render(); }));
}

function render() {
  const termo = App.normalizar(document.getElementById('fBusca').value.trim());
  const cat = document.getElementById('fCategoria').value;
  const entrada = document.getElementById('fEntrada').value;
  const alerta = document.getElementById('fAlerta').value;
  const lista = App.ordenar(lotes.filter(l =>
    (filtro === 'todos' || chave(l) === filtro) &&
    (!cat || l.categoria === cat) &&
    App.dentroDe(l.dataEntrada, entrada) &&
    (!alerta || (alerta === 'com') === Boolean(l.alertaAberto)) &&
    (!termo || App.normalizar(l.produto).includes(termo) || App.normalizar(l.codigo).includes(termo))),
    ORDENS, document.getElementById('fOrdem').value);

  App.resultado(filtros.meta, lista.length, lotes.length, lotes.length === 1 ? 'lote' : 'lotes', filtros.ativo() || filtro !== 'todos');

  if (!lotes.length) {
    tabela.innerHTML = App.emptyState('Nenhum lote em estoque',
      'Registre a mercadoria que chegou com a data de validade. O EcoStock passa a acompanhar o vencimento de cada lote.',
      '<button class="btn btn-primary" onclick="abrirNovo()">Cadastrar lote</button>');
    return;
  }
  if (!lista.length) {
    tabela.innerHTML = App.emptyState('Nenhum lote com esses filtros', 'Mude a busca ou clique em “Limpar filtros”.');
    return;
  }

  tabela.innerHTML = `<table class="data">
    <thead><tr>
      <th>Produto</th><th>Lote</th><th>Entrada</th><th>Validade</th>
      <th class="num">Saldo</th><th class="num">Valor de custo</th><th><span class="sr-only">Ações</span></th>
    </tr></thead>
    <tbody>${pag.fatiar(lista).map(linha).join('')}</tbody>
  </table>${pag.html('lotes')}`;
  tabela.querySelectorAll('[data-saldo]').forEach(b => b.addEventListener('click', () => abrirSaldo(lotes.find(l => l.id == b.dataset.saldo))));
}

function linha(l) {
  const atual = Number(l.quantidadeAtual), recebida = Number(l.quantidadeRecebida);
  const pct = recebida > 0 ? Math.round(atual / recebida * 100) : 0;
  const temEstoque = atual > 0;
  const u = App.urgency(l.diasRestantes);
  const acoes = temEstoque ? `
      ${l.alertaAberto ? `<a class="btn-mini solid" href="vencimentos.html#alerta-${l.alertaAberto}">Alerta</a>` : ''}
      <button class="btn-mini" data-saldo="${l.id}" title="Atualizar saldo">Saldo</button>
      <a class="btn-mini danger" href="perdas.html?lote=${l.id}" title="Registrar perda">Perda</a>` : '';
  return `<tr class="${temEstoque ? '' : 'is-muted'}">
    <td>${App.produtoCell(l.produto, App.esc(l.categoria || 'Sem categoria'), l.categoria)}</td>
    <td class="nowrap">${App.esc(l.codigo || '—')}</td>
    <td class="nowrap">${App.date(l.dataEntrada)}<span class="sub">${l.dataFabricacao ? 'Fabricado em ' + App.shortDate(l.dataFabricacao) : 'Fabricação não informada'}</span></td>
    <td class="nowrap">${temEstoque ? App.urgencyChip(l.diasRestantes) : '<span class="chip">Sem estoque</span>'}<span class="sub">${App.date(l.dataValidade)}</span></td>
    <td class="num"><div class="stock"><span>${App.qtd(atual, l.unidade)} <span class="muted">de ${App.num(recebida)}</span></span><span class="stock-bar"><i class="${u.key}" style="width:${pct}%"></i></span></div></td>
    <td class="num">${App.brl(l.valorCusto)}</td>
    <td><div class="row-actions">${acoes}</div></td>
  </tr>`;
}

// ---------- Novo lote ----------
function abrirNovo(produtoId) {
  const sel = document.getElementById('lProduto');
  if (!produtos.length) {
    App.toast('Cadastre um produto antes de registrar lotes.');
    location.href = 'produtos.html?novo=1';
    return;
  }
  sel.innerHTML = '<option value="">Selecione o produto</option>' + produtos.map(p =>
    `<option value="${p.id}" data-un="${App.esc(p.unidade)}" data-custo="${p.custoUnitario}">${App.esc(p.nome)}</option>`).join('');
  sel.value = produtoId || '';
  document.getElementById('lCodigo').value = '';
  document.getElementById('lQtd').value = '';
  document.getElementById('lEntrada').value = App.todayIso();
  document.getElementById('lEntrada').max = App.todayIso();
  document.getElementById('lValidade').value = '';
  document.getElementById('lFabricacao').value = '';
  document.getElementById('lFabricacao').max = App.todayIso();
  previa();
  App.openDialog('loteDialog');
}

function previa() {
  const sel = document.getElementById('lProduto');
  const opt = sel.selectedOptions[0];
  const un = opt && opt.dataset.un ? opt.dataset.un : 'un';
  document.getElementById('lUnidade').textContent = un;
  const validade = document.getElementById('lValidade').value;
  const qtd = Number(document.getElementById('lQtd').value) || 0;
  const box = document.getElementById('lPreview');
  if (!validade) { box.hidden = true; return; }
  const dias = App.daysBetween(App.todayIso(), validade);
  const desc = App.descontoSugerido(dias);
  let texto = '';
  if (dias < 0) texto = 'Este lote já está vencido. Ao salvar, o EcoStock emite um alerta para retirar da venda e registrar o descarte.';
  else if (dias <= 7) texto = `Ao salvar, o EcoStock emite um alerta com sugestão de <b>${desc}% de desconto</b>.`;
  else texto = `O alerta será emitido automaticamente quando faltarem 7 dias para o vencimento (${App.date(App.todayIso(dias - 7))}).`;
  const fab = document.getElementById('lFabricacao').value;
  if (fab) {
    const vida = App.daysBetween(fab, validade);
    if (vida > 0) texto += ` Vida útil de ${vida} ${vida === 1 ? 'dia' : 'dias'} desde a fabricação.`;
  }
  const custo = opt && opt.dataset.custo ? Number(opt.dataset.custo) : 0;
  box.innerHTML = `${App.urgencyChip(dias)} ${texto}${qtd && custo ? ` Valor de custo do lote: <b>${App.brl(qtd * custo)}</b>.` : ''}`;
  box.hidden = false;
}

document.getElementById('loteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    produtoId: document.getElementById('lProduto').value,
    codigo: document.getElementById('lCodigo').value,
    quantidade: document.getElementById('lQtd').value,
    dataEntrada: document.getElementById('lEntrada').value,
    dataValidade: document.getElementById('lValidade').value,
    dataFabricacao: document.getElementById('lFabricacao').value
  };
  try {
    await App.busy(document.getElementById('lSubmit'), 'Salvando...', () => Api.post('/lotes', body));
    App.closeDialog('loteDialog');
    const dias = App.daysBetween(App.todayIso(), body.dataValidade);
    App.toast(dias <= 7 ? 'Lote cadastrado. O alerta de vencimento já está em Vencimentos.' : 'Lote cadastrado.');
    history.replaceState(null, '', 'lotes.html');
    await carregar();
    App.refreshBadge();
  } catch (err) {
    App.dialogError('loteDialog', err.message);
  }
});

// ---------- Atualizar saldo ----------
function abrirSaldo(l) {
  loteSaldo = l;
  document.getElementById('saldoSub').textContent = `${l.produto}, lote ${l.codigo || '—'}. Recebido: ${App.qtd(l.quantidadeRecebida, l.unidade)}.`;
  document.getElementById('sQtd').value = Number(l.quantidadeAtual);
  document.getElementById('sQtd').max = Number(l.quantidadeRecebida);
  document.getElementById('sUnidade').textContent = l.unidade;
  App.openDialog('saldoDialog');
}

document.getElementById('saldoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await App.busy(document.getElementById('sSubmit'), 'Salvando...', () =>
      Api.put(`/lotes/${loteSaldo.id}/saldo`, { quantidadeAtual: document.getElementById('sQtd').value }));
    App.closeDialog('saldoDialog');
    App.toast('Saldo do lote atualizado.');
    await carregar();
    App.refreshBadge();
  } catch (err) {
    App.dialogError('saldoDialog', err.message);
  }
});
