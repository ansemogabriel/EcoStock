// ---------------------------------------------------------------------------
// Relatório de validação — evidência do uso real do sistema num período.
// Para cada alerta: 1) mensagem emitida  2) decisão do comerciante
// 3) reação / ação da equipe  4) resultado. Pronto para imprimir ou gerar PDF.
// ---------------------------------------------------------------------------

let dados = null;
let filtros;
const el = document.getElementById('relatorio');
const fDe = document.getElementById('fDe');
const fAte = document.getElementById('fAte');

(async function () {
  await App.init('validacao');
  fAte.value = App.todayIso();
  fDe.value = App.todayIso(-6);
  fAte.max = App.todayIso();

  document.querySelectorAll('#atalhos button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#atalhos button').forEach(x => x.classList.toggle('active', x === b));
    fAte.value = App.todayIso();
    fDe.value = App.todayIso(-Number(b.dataset.d));
    carregar();
  }));
  [fDe, fAte].forEach(i => i.addEventListener('change', () => {
    document.querySelectorAll('#atalhos button').forEach(x => x.classList.remove('active'));
    carregar();
  }));
  filtros = App.bindFilters('filtros', render);
  document.getElementById('imprimir').addEventListener('click', () => window.print());
  carregar();
})();

async function carregar() {
  if (!fDe.value || !fAte.value) return;
  el.innerHTML = '<div class="state">Carregando relatório...</div>';
  try {
    dados = await Api.get(`/validacao?de=${fDe.value}&ate=${fAte.value}`);
    App.fillSelect(document.getElementById('fCategoria'), App.categorias(dados.alertas), 'Todas');
    filtros.marcar();
    render();
  } catch (err) {
    el.innerHTML = `<div class="notice">${App.esc(err.message)}</div>`;
  }
}

function filtrar() {
  const termo = App.normalizar(document.getElementById('fBusca').value.trim());
  const sit = document.getElementById('fSituacao').value;
  const cat = document.getElementById('fCategoria').value;
  return dados.alertas.filter(a =>
    (!sit || (sit === 'resolvido' && a.status === 'RESOLVIDO') || (sit === 'andamento' && a.status === 'ABERTO') ||
      (sit === 'observacao' && a.observacao)) &&
    (!cat || a.categoria === cat) &&
    (!termo || App.normalizar(a.produto).includes(termo) || App.normalizar(a.codigo).includes(termo)));
}

function soma(lista, campo) { return lista.reduce((s, a) => s + Number(a[campo] || 0), 0); }

function render() {
  const lista = filtrar();
  App.resultado(filtros.meta, lista.length, dados.alertas.length, dados.alertas.length === 1 ? 'alerta' : 'alertas', filtros.ativo());

  const periodo = dados.de === dados.ate ? App.date(dados.de) : `${App.date(dados.de)} a ${App.date(dados.ate)}`;
  const resolvidos = lista.filter(a => a.status === 'RESOLVIDO');
  const decididos = lista.filter(a => a.promocaoStatus === 'ACEITA' || a.promocaoStatus === 'RECUSADA' || !a.promocaoStatus);
  const aplicadas = lista.filter(a => a.promocaoStatus === 'ACEITA');
  const vend = soma(lista, 'vendido'), doa = soma(lista, 'doado'), desc = soma(lista, 'descartado');
  const foraDoLixo = vend + doa + desc > 0 ? Math.round((vend + doa) / (vend + doa + desc) * 100) : null;

  const cabecalho = `
    <header class="dossie-head">
      <div class="dossie-brand">
        <svg class="logo-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0E3A31"/><path d="M7 25C7 13.5 13.5 7 25 7C25 18.5 18.5 25 7 25Z" stroke="#CDEBD8" stroke-width="2" stroke-linejoin="round"/><path d="M7 25L16 16V10.5" stroke="#F2B744" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="16" r="1.8" fill="#F2B744"/></svg>
        <div><b>EcoStock</b><span>Relatório de validação</span></div>
      </div>
      <dl class="dossie-meta">
        <div><dt>Estabelecimento</dt><dd>${App.esc(dados.loja)}</dd></div>
        <div><dt>Período</dt><dd>${periodo}</dd></div>
        <div><dt>Responsável</dt><dd>${App.esc(dados.responsavel || '—')}</dd></div>
        <div><dt>Gerado em</dt><dd>${App.dateTime(dados.geradoEm)}</dd></div>
      </dl>
    </header>`;

  if (!lista.length) {
    el.innerHTML = `<div class="dossie">${cabecalho}${App.emptyState(dados.alertas.length ? 'Nenhum alerta com esses filtros' : 'Nenhum alerta neste período',
      dados.alertas.length ? 'Mude a busca ou clique em “Limpar filtros”.'
        : 'Escolha outro período. Os alertas aparecem aqui assim que o sistema avisa sobre um lote perto do vencimento.')}</div>`;
    return;
  }

  el.innerHTML = `<div class="dossie">
    ${cabecalho}

    <section class="dossie-sec">
      <h2>Resumo do período</h2>
      <div class="dossie-stats">
        <div><b>${lista.length}</b><span>alertas emitidos pelo sistema</span></div>
        <div><b>${decididos.length}</b><span>com decisão registrada${aplicadas.length ? `, ${aplicadas.length} com promoção aplicada` : ''}</span></div>
        <div><b>${resolvidos.length}</b><span>com resultado registrado</span></div>
        <div><b>${App.brl(soma(lista, 'valorRecuperado'))}</b><span>vendidos depois do alerta (${App.num(vend)} itens)</span></div>
        <div><b>${App.num(doa)}</b><span>itens doados${soma(lista, 'valorDoado') ? `, ${App.brl(soma(lista, 'valorDoado'))} em produtos` : ''}</span></div>
        <div><b>${foraDoLixo === null ? '—' : foraDoLixo + '%'}</b><span>do que saiu do estoque não foi para o lixo (${App.num(desc)} itens descartados)</span></div>
      </div>
    </section>

    <section class="dossie-sec">
      <h2>Como o sistema foi usado</h2>
      <ol class="dossie-steps">
        <li>Os lotes foram cadastrados com quantidade, data de entrada, fabricação e validade.</li>
        <li>Quando um lote chegou a 7 dias ou menos do vencimento, o EcoStock emitiu o alerta com a mensagem e a sugestão de desconto.</li>
        <li>O comerciante decidiu se aplicava a promoção e a equipe registrou o que fez na loja.</li>
        <li>No fim, foi informado quanto foi vendido, doado ou descartado. Cada passo ficou gravado com data e hora.</li>
      </ol>
    </section>

    <section class="dossie-sec">
      <h2>Casos registrados (${lista.length})</h2>
      <div class="cases">${lista.map(caso).join('')}</div>
    </section>

    <footer class="dossie-foot">Relatório gerado pelo EcoStock a partir dos registros do sistema. Os valores de perda usam o preço de custo; os valores vendidos usam o preço praticado (com desconto, quando aplicado).</footer>
  </div>`;
}

function caso(a) {
  const u = App.urgency(Number(a.diasNoAlerta));
  const emitido = (a.eventos || []).find(e => e.tipo === 'ALERTA_EMITIDO');
  const vencido = Number(a.diasNoAlerta) < 0;

  let decisao;
  if (a.promocaoStatus === 'ACEITA') {
    decisao = `<b>Aplicou promoção de ${App.num(a.desconto)}%</b>: de ${App.brl(a.precoVenda)} por ${App.brl(a.precoPromocional)} /${App.esc(a.unidade)}, em ${App.dateTime(a.decididaEm)}.`;
  } else if (a.promocaoStatus === 'RECUSADA') {
    decisao = `<b>Optou por não dar desconto</b> e manteve o preço de ${App.brl(a.precoVenda)}, em ${App.dateTime(a.decididaEm)}.`;
  } else if (a.promocaoStatus === 'PENDENTE') {
    decisao = '<span class="muted">Sugestão ainda sem decisão no período.</span>';
  } else {
    decisao = vencido ? '<b>Retirar da venda</b>: o lote já estava vencido quando o alerta foi emitido.' : '—';
  }

  const res = [];
  if (Number(a.vendido) > 0) res.push(`<span class="chip ok">${App.qtd(a.vendido, a.unidade)} vendidos, ${App.brl(a.valorRecuperado)}</span>`);
  if (Number(a.doado) > 0) res.push(`<span class="chip proximo">${App.qtd(a.doado, a.unidade)} doados${a.instituicao ? ' para ' + App.esc(a.instituicao) : ''}</span>`);
  if (Number(a.descartado) > 0) res.push(`<span class="chip vencido">${App.qtd(a.descartado, a.unidade)} descartados, ${App.brl(a.valorPerdido)}</span>`);
  const resultado = a.status === 'RESOLVIDO'
    ? `${res.length ? `<div class="case-chips">${res.join('')}</div>` : '<span class="muted">Encerrado sem movimentação.</span>'}<small>Registrado em ${App.dateTime(a.resolvidoEm)}</small>`
    : '<span class="muted">Alerta ainda em andamento no fim do período.</span>';

  return `<article class="case">
    <header class="case-head">
      <div class="prod">${App.thumb(a.produto, a.categoria)}<div>
        <h3>${App.esc(a.produto)}</h3>
        <div class="alert-meta">
          <span>Lote ${App.esc(a.codigo || '—')}</span>
          ${a.dataFabricacao ? `<span>Fabricação ${App.date(a.dataFabricacao)}</span>` : ''}
          <span>Entrada ${App.date(a.dataEntrada)}</span>
          <span>Validade ${App.date(a.dataValidade)}</span>
        </div>
      </div></div>
      <span class="chip ${a.status === 'RESOLVIDO' ? 'dark' : 'urgente'}">${a.status === 'RESOLVIDO' ? 'Resolvido' : 'Em andamento'}</span>
    </header>
    <ol class="case-steps">
      <li>
        <span class="step-n">1</span>
        <div><b>Alerta emitido</b> <time>${App.dateTime(a.criadoEm)}</time>
          <p class="case-quote">“${App.esc(emitido ? emitido.descricao : a.mensagem)}”</p>
          <small>Situação no momento do alerta: <span class="chip ${u.key}">${u.label}</span></small>
        </div>
      </li>
      <li><span class="step-n">2</span><div><b>Decisão do comerciante</b><div class="case-p">${decisao}</div></div></li>
      <li><span class="step-n">3</span><div><b>Reação e ação da equipe</b><div class="case-p">${a.observacao ? App.esc(a.observacao) : '<span class="muted">Nenhuma observação registrada.</span>'}</div></div></li>
      <li><span class="step-n">4</span><div><b>Resultado</b><div class="case-p">${resultado}</div></div></li>
    </ol>
  </article>`;
}
