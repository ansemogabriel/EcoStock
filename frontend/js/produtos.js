// ---------------------------------------------------------------------------
// Produtos — catálogo: listar (com filtros), cadastrar, editar e remover.
// ---------------------------------------------------------------------------

let produtos = [];
let situacao = 'todos';
let editando = null;
let filtros;

const tabela = document.getElementById('tabela');
const pag = App.paginacao();
pag.ligar(tabela, () => render());

const SITUACOES = [
  { key: 'todos', label: 'Todos' },
  { key: 'atencao', label: 'Vencem em até 7 dias' },
  { key: 'emdia', label: 'Estoque em dia' },
  { key: 'sem', label: 'Sem estoque' }
];

function situacaoDe(p) {
  if (Number(p.lotesAtivos) === 0) return 'sem';
  return Number(p.diasProxima) <= 7 ? 'atencao' : 'emdia';
}

const ORDENS = {
  nome: App.cmpTexto('nome'),
  validade: App.cmpNum('diasProxima'),
  estoque: App.cmpNum('estoque', true),
  margem: (a, b) => margemDe(b) - margemDe(a),
  preco: App.cmpNum('precoVenda', true)
};

function margemDe(p) {
  const venda = Number(p.precoVenda), custo = Number(p.custoUnitario);
  return venda > 0 ? Math.round((venda - custo) / venda * 100) : 0;
}

(async function () {
  await App.init('produtos');
  document.getElementById('novoProduto').addEventListener('click', () => abrir(null));
  ['pCusto', 'pVenda'].forEach(id => document.getElementById(id).addEventListener('input', margem));
  filtros = App.bindFilters('filtros', render, () => { situacao = 'todos'; renderSituacoes(); });
  await carregar();
  if (new URLSearchParams(location.search).get('novo') === '1') abrir(null);
})();

async function carregar() {
  try {
    produtos = await Api.get('/produtos');
    App.fillSelect(document.getElementById('fCategoria'), App.categorias(produtos), 'Todas');
    App.fillSelect(document.getElementById('fUnidade'), [...new Set(produtos.map(p => p.unidade))].sort(), 'Todas');
    document.getElementById('listaCategorias').innerHTML = App.categorias(produtos).map(c => `<option value="${App.esc(c)}">`).join('');
    filtros.marcar();
    renderSituacoes();
    render();
  } catch (err) {
    tabela.innerHTML = `<div class="notice">${App.esc(err.message)}</div>`;
  }
}

function renderSituacoes() {
  const el = document.getElementById('situacoes');
  el.innerHTML = SITUACOES.map(s => {
    const n = s.key === 'todos' ? produtos.length : produtos.filter(p => situacaoDe(p) === s.key).length;
    return `<button type="button" class="${s.key === situacao ? 'active' : ''}" data-s="${s.key}">${s.label} <span class="seg-count">${n}</span></button>`;
  }).join('');
  el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { situacao = b.dataset.s; renderSituacoes(); render(); }));
}

function render() {
  const termo = App.normalizar(document.getElementById('fBusca').value.trim());
  const cat = document.getElementById('fCategoria').value;
  const un = document.getElementById('fUnidade').value;
  const lista = App.ordenar(produtos.filter(p =>
    (situacao === 'todos' || situacaoDe(p) === situacao) &&
    (!cat || p.categoria === cat) &&
    (!un || p.unidade === un) &&
    (!termo || App.normalizar(p.nome).includes(termo))), ORDENS, document.getElementById('fOrdem').value);

  App.resultado(filtros.meta, lista.length, produtos.length, produtos.length === 1 ? 'produto' : 'produtos',
    filtros.ativo() || situacao !== 'todos');

  if (!produtos.length) {
    tabela.innerHTML = App.emptyState('Nenhum produto cadastrado',
      'Cadastre os produtos perecíveis da loja. Depois, registre os lotes com a data de validade.',
      '<button class="btn btn-primary" onclick="abrir(null)">Cadastrar produto</button>');
    return;
  }
  if (!lista.length) {
    tabela.innerHTML = App.emptyState('Nenhum produto com esses filtros', 'Mude a busca ou clique em “Limpar filtros”.');
    return;
  }

  tabela.innerHTML = `<table class="data">
    <thead><tr>
      <th>Produto</th><th class="num">Custo</th><th class="num">Venda</th><th class="num">Margem</th>
      <th class="num">Estoque</th><th>Próxima validade</th><th><span class="sr-only">Ações</span></th>
    </tr></thead>
    <tbody>${pag.fatiar(lista).map(linha).join('')}</tbody>
  </table>${pag.html(lista.length === 1 ? 'produto' : 'produtos')}`;
  tabela.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => abrir(produtos.find(p => p.id == b.dataset.edit))));
  tabela.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => remover(produtos.find(p => p.id == b.dataset.del), b)));
}

function linha(p) {
  const lotes = Number(p.lotesAtivos);
  const m = margemDe(p);
  return `<tr>
    <td>${App.produtoCell(p.nome, App.esc(p.categoria || 'Sem categoria'), p.categoria)}</td>
    <td class="num">${App.brl(p.custoUnitario)}</td>
    <td class="num strong">${App.brl(p.precoVenda)}</td>
    <td class="num"><span class="${m >= 30 ? 'money-pos' : ''}">${m}%</span></td>
    <td class="num">${lotes ? App.qtd(p.estoque, p.unidade) : '<span class="muted">0 ' + App.esc(p.unidade) + '</span>'}<span class="sub">${lotes === 1 ? '1 lote' : lotes + ' lotes'}</span></td>
    <td>${lotes ? App.urgencyChip(Number(p.diasProxima)) + `<span class="sub">${App.date(p.proximaValidade)}</span>` : '<span class="chip">Sem estoque</span>'}</td>
    <td><div class="row-actions">
      <a class="btn-mini" href="lotes.html?produto=${p.id}">Novo lote</a>
      <button class="btn-mini" data-edit="${p.id}">Editar</button>
      <button class="btn-mini danger" data-del="${p.id}" aria-label="Remover ${App.esc(p.nome)}">Remover</button>
    </div></td>
  </tr>`;
}

function abrir(p) {
  editando = p;
  document.getElementById('produtoTitle').textContent = p ? 'Editar produto' : 'Novo produto';
  document.getElementById('pNome').value = p ? p.nome : '';
  document.getElementById('pCategoria').value = p ? (p.categoria || '') : '';
  document.getElementById('pUnidade').value = p ? p.unidade : 'un';
  document.getElementById('pCusto').value = p ? Number(p.custoUnitario) : '';
  document.getElementById('pVenda').value = p ? Number(p.precoVenda) : '';
  margem();
  App.openDialog('produtoDialog');
}

function margem() {
  const c = Number(document.getElementById('pCusto').value);
  const v = Number(document.getElementById('pVenda').value);
  document.getElementById('pMargem').textContent = v > 0 && c >= 0
    ? `Margem de ${Math.round((v - c) / v * 100)}% (lucro de ${App.brl(v - c)} por unidade de venda).` : '';
}

document.getElementById('produtoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    nome: document.getElementById('pNome').value,
    categoria: document.getElementById('pCategoria').value,
    unidade: document.getElementById('pUnidade').value,
    custoUnitario: document.getElementById('pCusto').value,
    precoVenda: document.getElementById('pVenda').value
  };
  try {
    await App.busy(document.getElementById('pSubmit'), 'Salvando...', () =>
      editando ? Api.put(`/produtos/${editando.id}`, body) : Api.post('/produtos', body));
    App.closeDialog('produtoDialog');
    App.toast(editando ? 'Produto atualizado.' : 'Produto cadastrado.');
    await carregar();
  } catch (err) {
    App.dialogError('produtoDialog', err.message);
  }
});

async function remover(p, btn) {
  const ok = await App.confirmar({
    titulo: `Remover ${p.nome}?`,
    texto: 'O produto sai do catálogo. O histórico de lotes, alertas e perdas continua guardado nos relatórios.',
    confirmar: 'Remover produto', perigo: true
  });
  if (!ok) return;
  try {
    await App.busy(btn, '...', () => Api.del(`/produtos/${p.id}`));
    App.toast('Produto removido do catálogo.');
    await carregar();
  } catch (err) {
    App.toast(err.message);
  }
}
