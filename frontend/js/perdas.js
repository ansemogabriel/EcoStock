// ---------------------------------------------------------------------------
// Perdas — registro de descarte (baixa no lote) e lista por período.
// ---------------------------------------------------------------------------

let dias = 30;
let lotes = [];
let perdas = [];
let filtros;
const ORDENS = {
  recentes: (a, b) => String(b.dataPerda).localeCompare(String(a.dataPerda)),
  valor: App.cmpNum('valorEstimado', true),
  quantidade: App.cmpNum('quantidade', true),
  produto: App.cmpTexto('produto')
};
const tabela = document.getElementById('tabela');
const pag = App.paginacao();
pag.ligar(tabela, () => render());

(async function () {
  await App.init('perdas');
  document.querySelectorAll('#periodo button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#periodo button').forEach(x => x.classList.toggle('active', x === b));
    dias = Number(b.dataset.dias);
    carregar();
  }));
  document.getElementById('novaPerda').addEventListener('click', () => abrir());
  filtros = App.bindFilters('filtros', render);
  ['peLote', 'peQtd', 'peMotivo'].forEach(id => document.getElementById(id).addEventListener('input', previa));
  await carregar();

  const loteUrl = new URLSearchParams(location.search).get('lote');
  if (loteUrl) abrir(loteUrl);
})();

async function carregar() {
  try {
    const data = await Api.get(`/perdas?dias=${dias}`);
    perdas = data.perdas;
    App.fillSelect(document.getElementById('fMotivo'), data.motivos, 'Todos');
    App.fillSelect(document.getElementById('fCategoria'), App.categorias(perdas), 'Todas');
    filtros.marcar();
    render();
  } catch (err) {
    tabela.innerHTML = `<div class="notice">${App.esc(err.message)}</div>`;
  }
}

function render() {
  const termo = App.normalizar(document.getElementById('fBusca').value.trim());
  const motivo = document.getElementById('fMotivo').value;
  const origem = document.getElementById('fOrigem').value;
  const cat = document.getElementById('fCategoria').value;
  const lista = App.ordenar(perdas.filter(p =>
    (!motivo || p.motivo === motivo) &&
    (!origem || (origem === 'alerta') === Boolean(p.alertaId)) &&
    (!cat || p.categoria === cat) &&
    (!termo || App.normalizar(p.produto).includes(termo) || App.normalizar(p.codigo).includes(termo))),
    ORDENS, document.getElementById('fOrdem').value);
  App.resultado(filtros.meta, lista.length, perdas.length, perdas.length === 1 ? 'registro' : 'registros', filtros.ativo());
  desenhar(lista, perdas.length);
}

function desenhar(perdas, totalSemFiltro) {
  const total = perdas.reduce((s, p) => s + Number(p.valorEstimado), 0);
  document.getElementById('kValor').textContent = App.brl(total);
  document.getElementById('kRegistros').textContent = App.num(perdas.length);
  document.getElementById('kRegistrosNote').textContent = dias === 365 ? 'Nos últimos 12 meses' : `Nos últimos ${dias} dias`;

  const porMotivo = {};
  perdas.forEach(p => { porMotivo[p.motivo] = (porMotivo[p.motivo] || 0) + Number(p.valorEstimado); });
  const top = Object.entries(porMotivo).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('kMotivo').textContent = top ? top[0] : '—';
  document.getElementById('kMotivoNote').textContent = top && total ? `${Math.round(top[1] / total * 100)}% do valor perdido` : 'Sem perdas no período';

  if (!perdas.length && totalSemFiltro) {
    tabela.innerHTML = App.emptyState('Nenhuma perda com esses filtros', 'Mude a busca ou clique em “Limpar filtros”.');
    return;
  }
  if (!perdas.length) {
    tabela.innerHTML = App.emptyState('Nenhuma perda no período',
      'Quando algo for descartado, registre aqui ou pelo alerta em Vencimentos. Assim o relatório mostra para onde vai o desperdício.');
    return;
  }
  tabela.innerHTML = `<table class="data">
    <thead><tr><th>Data</th><th>Produto</th><th class="num">Quantidade</th><th>Motivo</th><th class="num">Valor perdido</th><th>Origem</th></tr></thead>
    <tbody>${pag.fatiar(perdas).map(p => `<tr>
      <td>${App.dateTime(p.dataPerda)}</td>
      <td>${App.produtoCell(p.produto, 'Lote ' + App.esc(p.codigo || '—'), p.categoria)}</td>
      <td class="num">${App.qtd(p.quantidade, p.unidade)}</td>
      <td><span class="chip" style="background:var(--surface-2)"><i style="width:8px;height:8px;border-radius:2px;background:${App.corMotivo(p.motivo, 0)}"></i>${App.esc(p.motivo)}</span></td>
      <td class="num money-neg">${App.brl(p.valorEstimado)}</td>
      <td>${p.alertaId ? `<a class="link" href="vencimentos.html#historico">Alerta de validade</a>` : 'Registro manual'}${p.usuario ? `<span class="sub">${App.esc(p.usuario)}</span>` : ''}</td>
    </tr>`).join('')}</tbody>
  </table>${pag.html('registros')}`;
}

async function abrir(loteId) {
  try {
    lotes = await Api.get('/lotes');
  } catch (err) {
    App.toast(err.message);
    return;
  }
  if (!lotes.length) {
    App.toast('Não há lotes com estoque para registrar perda.');
    return;
  }
  const sel = document.getElementById('peLote');
  sel.innerHTML = '<option value="">Selecione o lote</option>' + lotes.map(l =>
    `<option value="${l.id}">${App.esc(l.produto)}, lote ${App.esc(l.codigo || '—')} (${App.qtd(l.quantidadeAtual, l.unidade)}, ${App.urgency(l.diasRestantes).label.toLowerCase()})</option>`).join('');
  sel.value = loteId || '';
  document.getElementById('peQtd').value = '';
  const lote = lotes.find(l => l.id == loteId);
  document.getElementById('peMotivo').value = lote && lote.diasRestantes < 0 ? 'Vencido' : 'Danificado';
  previa();
  App.openDialog('perdaDialog');
}

function previa() {
  const l = lotes.find(x => x.id == document.getElementById('peLote').value);
  const box = document.getElementById('pePreview');
  document.getElementById('peUn').textContent = l ? l.unidade : 'un';
  if (!l) { box.hidden = true; return; }
  const q = Number(document.getElementById('peQtd').value) || 0;
  box.hidden = false;
  box.innerHTML = `${App.urgencyChip(l.diasRestantes)} Saldo atual: <b>${App.qtd(l.quantidadeAtual, l.unidade)}</b>.` +
    (q > 0 ? ` Valor de custo perdido: <b>${App.brl(q * l.custoUnitario)}</b>. Saldo depois do registro: <b>${App.qtd(Math.max(0, l.quantidadeAtual - q), l.unidade)}</b>.` : '');
}

document.getElementById('perdaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    loteId: document.getElementById('peLote').value,
    quantidade: document.getElementById('peQtd').value,
    motivo: document.getElementById('peMotivo').value
  };
  try {
    const r = await App.busy(document.getElementById('peSubmit'), 'Salvando...', () => Api.post('/perdas', body));
    App.closeDialog('perdaDialog');
    App.toast(`Perda registrada: ${App.brl(r.valorEstimado)}.`);
    history.replaceState(null, '', 'perdas.html');
    await carregar();
    App.refreshBadge();
  } catch (err) {
    App.dialogError('perdaDialog', err.message);
  }
});
