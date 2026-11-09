// ---------------------------------------------------------------------------
// Relatórios — perdas, valor recuperado e desempenho dos alertas no período.
// ---------------------------------------------------------------------------

let dias = 30;

(async function () {
  await App.init('relatorios');
  document.querySelectorAll('#periodo button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#periodo button').forEach(x => x.classList.toggle('active', x === b));
    dias = Number(b.dataset.dias);
    carregar();
  }));
  document.getElementById('exportar').addEventListener('click', exportarCsv);
  const cat = document.getElementById('fCategoria');
  cat.addEventListener('change', () => { cat.closest('.pick').classList.toggle('is-set', !!cat.value); carregar(); });
  try { App.fillSelect(cat, App.categorias(await Api.get('/produtos')), 'Todas'); } catch { /* segue sem categorias */ }
  carregar();
})();

async function carregar() {
  document.getElementById('erro').innerHTML = '';
  try {
    render(await Api.get(`/relatorios?dias=${dias}&categoria=${encodeURIComponent(document.getElementById('fCategoria').value)}`));
  } catch (err) {
    document.getElementById('erro').innerHTML = `<div class="notice">${App.esc(err.message)}</div>`;
  }
}

function render(r) {
  document.getElementById('periodoTexto').textContent =
    `De ${App.date(r.inicio)} a ${App.date(r.fim)}${r.categoria ? ', categoria ' + r.categoria : ''}: quanto foi perdido, quanto foi salvo e como os alertas ajudaram.`;

  document.getElementById('kPerdido').textContent = App.brl(r.perdas.valor);
  document.getElementById('kPerdidoNote').textContent = `${App.num(r.perdas.registros)} registros de descarte`;
  document.getElementById('kRecuperado').textContent = App.brl(r.recuperado.valor);
  document.getElementById('kRecuperadoNote').textContent = `${App.num(r.recuperado.quantidade)} itens vendidos antes de vencer`;
  document.getElementById('kAprov').textContent = `${r.aproveitamento}%`;
  document.getElementById('kAlertas').textContent = App.num(r.alertas.emitidos);
  document.getElementById('kAlertasNote').textContent = `${App.num(r.alertas.resolvidos)} já resolvidos`;

  // Destino dos produtos (vendido / doado / descartado)
  const d = r.destino;
  const tot = Number(d.vendido) + Number(d.doado) + Number(d.descartado);
  document.getElementById('dForaLixo').textContent = tot ? `${d.foraDoLixo}%` : '—';
  document.getElementById('dVendido').textContent = App.num(d.vendido);
  document.getElementById('dDoado').textContent = App.num(d.doado);
  document.getElementById('dDescartado').textContent = App.num(d.descartado);
  document.getElementById('dDoadoNota').textContent = Number(r.doacoes.registros)
    ? `${r.doacoes.registros} ${Number(r.doacoes.registros) === 1 ? 'doação' : 'doações'}, ${App.brl(r.doacoes.valor)} em produtos` : '';
  document.getElementById('dBar').innerHTML = tot ? [['vendido', 'var(--leaf)'], ['doado', 'var(--mango)'], ['descartado', 'var(--beet)']]
    .filter(([k]) => Number(d[k]) > 0)
    .map(([k, c]) => `<span style="flex:${Number(d[k])}; --c:${c}"></span>`).join('') : '';

  App.barChart(document.getElementById('barChart'), r.serie);
  App.motivosChart(document.getElementById('mix'), document.getElementById('motivos'), r.motivos);

  // Funil: emitidos → com promoção → com venda → resolvidos
  const a = r.alertas;
  const base = Math.max(1, Number(a.emitidos));
  const etapas = [
    ['Alertas emitidos', a.emitidos, 'var(--mango)'],
    ['Promoção aplicada', a.comPromocao, 'var(--leaf)'],
    ['Produto vendido depois do alerta', a.comVenda, 'var(--spruce)'],
    ['Alertas resolvidos', a.resolvidos, 'var(--slate)']
  ];
  document.getElementById('funil').innerHTML = Number(a.emitidos) === 0
    ? '<p class="panel-sub">Nenhum alerta emitido no período.</p>'
    : etapas.map(([rotulo, n, cor]) => `
      <div class="funnel-row" style="--c:${cor}">
        <span>${rotulo}</span><b>${App.num(n)}</b>
        <span class="fbar"><i style="width:${Math.round(Number(n) / base * 100)}%"></i></span>
      </div>`).join('');

  document.getElementById('porProduto').innerHTML = r.porProduto.length
    ? `<div class="table-card"><table class="data">
        <thead><tr><th>Produto</th><th class="num">Quantidade</th><th class="num">Valor</th></tr></thead>
        <tbody>${r.porProduto.map(p => `<tr>
          <td>${App.produtoCell(p.produto, App.esc(p.categoria || 'Sem categoria'), p.categoria)}</td>
          <td class="num">${App.qtd(p.quantidade, p.unidade)}</td>
          <td class="num">${App.brl(p.valor)}</td></tr>`).join('')}</tbody>
      </table></div>`
    : '<p class="panel-sub">Nenhuma perda registrada no período.</p>';
}

async function exportarCsv() {
  try {
    const cat = document.getElementById('fCategoria').value;
    const { perdas: todas } = await Api.get(`/perdas?dias=${dias}`);
    const perdas = cat ? todas.filter(p => p.categoria === cat) : todas;
    const linhas = [['Data', 'Produto', 'Lote', 'Quantidade', 'Unidade', 'Motivo', 'Valor perdido (R$)', 'Origem']];
    perdas.forEach(p => linhas.push([
      App.dateTime(p.dataPerda), p.produto, p.codigo || '', String(p.quantidade).replace('.', ','), p.unidade,
      p.motivo, Number(p.valorEstimado).toFixed(2).replace('.', ','), p.alertaId ? 'Alerta de validade' : 'Registro manual'
    ]));
    const csv = linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ecostock-perdas-${dias}-dias.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    App.toast(`${perdas.length} perdas exportadas.`);
  } catch (err) {
    App.toast(err.message);
  }
}
