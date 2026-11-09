// ---------------------------------------------------------------------------
// Vencimentos — alertas de validade.
// Fluxo de cada alerta: 1) emitido pelo sistema  2) decisão sobre a promoção
// 3) resultado (vendido / descartado). O histórico guarda cada passo.
// ---------------------------------------------------------------------------

const view = document.getElementById('view');
const pag = App.paginacao();
pag.ligar(view, () => (modo === 'abertos' ? renderAbertos() : renderHistorico()));
let alertas = [];
let atual = null;          // alerta aberto na janela de resultado
let modo = 'abertos';
let fAbertos, fHistorico;

const ORDENS_ABERTOS = {
  urgencia: App.cmpNum('diasRestantes'),
  risco: App.cmpNum('valorRisco', true),
  produto: App.cmpTexto('produto')
};
const ORDENS_HISTORICO = {
  recentes: (a, b) => String(b.resolvidoEm).localeCompare(String(a.resolvidoEm)),
  recuperado: App.cmpNum('valorRecuperado', true),
  perda: App.cmpNum('valorPerdido', true)
};

function decisaoDe(a) {
  if (a.diasRestantes < 0 && a.status === 'ABERTO') return 'descarte';
  if (!a.promocaoId) return 'descarte';
  if (a.promocaoStatus === 'PENDENTE') return 'pendente';
  return a.promocaoStatus === 'ACEITA' ? 'aplicada' : 'recusada';
}

const GRUPOS = [
  { key: 'vencido', titulo: 'Vencidos', texto: 'Retire da venda e registre o descarte.' },
  { key: 'hoje', titulo: 'Vencem hoje', texto: 'Última chance de venda.' },
  { key: 'urgente', titulo: 'Vencem em 1 a 3 dias', texto: 'Promoção e destaque na prateleira.' },
  { key: 'proximo', titulo: 'Vencem em 4 a 7 dias', texto: 'Promoção leve para acelerar a saída.' }
];

const EVENTOS = {
  ALERTA_EMITIDO: ['Alerta emitido', 't-emitido'],
  ALERTA_ATUALIZADO: ['Urgência atualizada', 't-emitido'],
  PROMOCAO_SUGERIDA: ['Sugestão do sistema', 't-sugestao'],
  ACAO_SUGERIDA: ['Sugestão do sistema', 't-sugestao'],
  PROMOCAO_APLICADA: ['Promoção aplicada', 't-aplicada'],
  PROMOCAO_RECUSADA: ['Promoção não aplicada', 't-recusada'],
  PERDA_REGISTRADA: ['Perda registrada', 't-perda'],
  RESULTADO: ['Resultado', 't-resultado'],
  OBSERVACAO: ['Observação da equipe', 't-obs'],
  ALERTA_ENCERRADO: ['Alerta encerrado', 't-resultado']
};

const BELL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.7 21a2 2 0 01-3.4 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

(async function () {
  const me = await App.init('vencimentos');
  document.getElementById('countAbertos').textContent = me.alertasAbertos || 0;

  fAbertos = App.bindFilters('filtrosAbertos', renderAbertos);
  fHistorico = App.bindFilters('filtrosHistorico', renderHistorico);
  document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('[data-view]').forEach(b => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-selected', String(b === btn));
    });
    modo = btn.dataset.view;
    document.getElementById('filtrosAbertos').hidden = modo !== 'abertos';
    document.getElementById('filtrosHistorico').hidden = modo !== 'historico';
    carregar();
  }));

  if (location.hash === '#historico') document.querySelector('[data-view="historico"]').click();
  else carregar();
})();

async function carregar() {
  view.innerHTML = '<div class="state">Carregando alertas...</div>';
  try {
    const data = await Api.get(modo === 'historico' ? '/alertas?status=historico' : '/alertas');
    alertas = data.alertas;
    if (modo === 'abertos') {
      document.getElementById('countAbertos').textContent = alertas.length;
      App.setBadge(alertas.length);
      App.fillSelect(document.getElementById('aCategoria'), App.categorias(alertas), 'Todas');
      fAbertos.marcar();
      renderAbertos();
    } else {
      App.fillSelect(document.getElementById('hCategoria'), App.categorias(alertas), 'Todas');
      fHistorico.marcar();
      renderHistorico();
    }
  } catch (err) {
    view.innerHTML = `<div class="notice">${App.esc(err.message)}</div>`;
  }
}

// ================= ALERTAS ABERTOS =================
function filtrarAbertos() {
  const termo = App.normalizar(document.getElementById('aBusca').value.trim());
  const urg = document.getElementById('aUrgencia').value;
  const dec = document.getElementById('aDecisao').value;
  const cat = document.getElementById('aCategoria').value;
  return App.ordenar(alertas.filter(a =>
    (!urg || App.urgency(a.diasRestantes).key === urg) &&
    (!dec || decisaoDe(a) === dec) &&
    (!cat || a.categoria === cat) &&
    (!termo || App.normalizar(a.produto).includes(termo) || App.normalizar(a.codigo).includes(termo))),
    ORDENS_ABERTOS, document.getElementById('aOrdem').value);
}

function renderAbertos() {
  const lista = filtrarAbertos();
  App.resultado(fAbertos.meta, lista.length, alertas.length, alertas.length === 1 ? 'alerta' : 'alertas', fAbertos.ativo());
  if (!alertas.length) {
    view.innerHTML = App.emptyState('Nenhum lote precisa de ação agora',
      'Quando um lote estiver a 7 dias ou menos do vencimento, o alerta aparece aqui com a sugestão de desconto.',
      '<a class="btn btn-primary" href="lotes.html">Cadastrar lote</a>');
    return;
  }
  if (!lista.length) {
    view.innerHTML = App.emptyState('Nenhum alerta com esses filtros', 'Mude a busca ou clique em “Limpar filtros”.');
    return;
  }
  const ordem = document.getElementById('aOrdem').value;
  const alvoHash = location.hash.match(/^#alerta-(\d+)$/);
  if (alvoHash && !pag.jaFoiAoAlvo) { pag.irPara(lista, alvoHash[1]); pag.jaFoiAoAlvo = true; }
  const pagina = pag.fatiar(lista);
  view.innerHTML = (ordem !== 'urgencia'
    ? `<div class="alert-list">${pagina.map(cardAlerta).join('')}</div>`
    : GRUPOS.map(g => {
    const doGrupo = pagina.filter(a => App.urgency(a.diasRestantes).key === g.key);
    if (!doGrupo.length) return '';
    const total = lista.filter(a => App.urgency(a.diasRestantes).key === g.key).length;
    return `<section class="alert-group">
      <div class="group-head"><h2>${g.titulo} (${total})</h2><p>${g.texto}</p></div>
      <div class="alert-list">${doGrupo.map(cardAlerta).join('')}</div>
    </section>`;
  }).join('')) + pag.html('alertas');

  view.querySelectorAll('[data-acao]').forEach(btn => btn.addEventListener('click', onAcao));

  // Link direto para um alerta (ex.: vindo de Promoções ou Lotes)
  const alvo = location.hash.match(/^#alerta-(\d+)$/);
  if (alvo) {
    const card = document.getElementById(`alerta-${alvo[1]}`);
    if (card) { card.classList.add('is-target'); card.scrollIntoView({ block: 'center' }); }
  }
}

function cardAlerta(a) {
  const u = App.urgency(a.diasRestantes);
  const dias = a.diasRestantes;
  const tileNum = dias < 0 ? -dias : dias;
  const tileTxt = dias < 0 ? (tileNum === 1 ? 'dia atrás' : 'dias atrás') : dias === 0 ? 'hoje' : (dias === 1 ? 'dia' : 'dias');

  return `<article class="alert-card" id="alerta-${a.id}">
    <div class="alert-main">
      <div class="days-tile ${u.key}" aria-label="${u.label}"><b>${dias === 0 ? '0' : tileNum}</b><span>${tileTxt}</span></div>
      <div class="alert-body">
        <h3>${App.esc(a.produto)}</h3>
        <div class="alert-meta">
          <span>${App.esc(a.categoria || 'Sem categoria')}</span>
          <span>Lote ${App.esc(a.codigo || '—')}</span>
          <span>${App.qtd(a.quantidadeAtual, a.unidade)} em estoque</span>
          <span>Validade ${App.date(a.dataValidade)}</span>
        </div>
        <div class="system-msg">${BELL}<div><small>Mensagem do sistema, ${App.dateTime(a.criadoEm)}</small>${App.esc(a.mensagem)}</div></div>
      </div>
      ${blocoAcao(a)}
    </div>
    ${trilha(a)}
  </article>`;
}

function blocoAcao(a) {
  const vencido = a.diasRestantes < 0;
  if (vencido || !a.promocaoId) {
    return `<div class="alert-action">
      <span class="label">Sugestão do EcoStock</span>
      <span class="price"><b>Retirar da venda</b></span>
      <span class="label">Produto vencido não pode ser vendido. Registre o descarte para baixar o estoque.</span>
      <button class="btn btn-danger btn-sm" data-acao="resultado" data-id="${a.id}">Registrar descarte</button>
    </div>`;
  }
  if (a.promocaoStatus === 'PENDENTE') {
    return `<div class="alert-action">
      <span class="label">Sugestão do EcoStock: ${App.num(a.desconto)}% de desconto</span>
      <span class="price">de <s>${App.brl(a.precoVenda)}</s> por <b id="preco-${a.id}">${App.brl(a.precoPromocional)}</b> /${App.esc(a.unidade)}</span>
      <div class="row">
        <label class="input-suffix pct-input" title="Ajuste o desconto se quiser">
          <input class="input" type="number" min="1" max="90" step="1" value="${App.num(a.desconto, 0)}" id="pct-${a.id}" aria-label="Desconto em porcentagem" data-preco="${a.precoVenda}" data-alvo="preco-${a.id}">
          <span>%</span>
        </label>
        <button class="btn btn-primary btn-sm" data-acao="aplicar" data-id="${a.id}">Aplicar promoção</button>
      </div>
      <button class="btn-mini" data-acao="recusar" data-id="${a.id}">Não aplicar</button>
    </div>`;
  }
  const aceita = a.promocaoStatus === 'ACEITA';
  return `<div class="alert-action">
    <span class="label">${aceita ? `Promoção de ${App.num(a.desconto)}% aplicada` : 'Sem promoção, preço normal'}</span>
    <span class="price"><b>${App.brl(aceita ? a.precoPromocional : a.precoVenda)}</b> /${App.esc(a.unidade)}</span>
    <span class="label">Quando o lote sair da prateleira, informe quanto foi vendido e quanto foi descartado.</span>
    <button class="btn btn-primary btn-sm" data-acao="resultado" data-id="${a.id}">Registrar resultado</button>
  </div>`;
}

function trilha(a) {
  const vencido = a.diasRestantes < 0 || !a.promocaoId;
  let decisao;
  if (vencido) decisao = { cls: 'done', txt: 'Retirar da venda' };
  else if (a.promocaoStatus === 'PENDENTE') decisao = { cls: 'current', txt: 'Aguardando sua decisão' };
  else if (a.promocaoStatus === 'ACEITA') decisao = { cls: 'done', txt: `Promoção de ${App.num(a.desconto)}% aplicada` };
  else decisao = { cls: 'done', txt: 'Promoção não aplicada' };
  const resultadoAtual = decisao.cls === 'done';

  return `<ol class="flow" aria-label="Andamento do alerta">
    <li class="done"><b>Alerta emitido</b>${App.dateTime(a.criadoEm)}</li>
    <li class="${decisao.cls}"><b>Decisão</b>${decisao.txt}</li>
    <li class="${resultadoAtual ? 'current' : ''}"><b>Resultado</b>${resultadoAtual ? 'Informe vendido e descartado' : 'Depois da decisão'}</li>
  </ol>`;
}

// Atualiza o preço promocional enquanto o desconto é ajustado
view.addEventListener('input', e => {
  const input = e.target;
  if (!input.dataset.alvo) return;
  const pct = Math.min(90, Math.max(0, Number(input.value) || 0));
  const preco = Number(input.dataset.preco) * (1 - pct / 100);
  document.getElementById(input.dataset.alvo).textContent = App.brl(preco);
});

async function onAcao(e) {
  const btn = e.currentTarget;
  const id = Number(btn.dataset.id);
  const a = alertas.find(x => x.id === id);
  if (btn.dataset.acao === 'resultado') return abrirResultado(a);

  const aplicar = btn.dataset.acao === 'aplicar';
  const desconto = aplicar ? Number(document.getElementById(`pct-${id}`).value) : undefined;
  try {
    const r = await App.busy(btn, 'Salvando...', () => Api.post(`/alertas/${id}/decisao`, { aplicar, desconto }));
    App.toast(aplicar ? `Promoção de ${desconto}% aplicada em ${a.produto}.` : r.message);
    await carregar();
  } catch (err) {
    App.toast(err.message);
  }
}

// ================= RESULTADO =================
const resVendido = document.getElementById('resVendido');
const resDescartado = document.getElementById('resDescartado');
const resDoado = document.getElementById('resDoado');

function abrirResultado(a) {
  atual = a;
  const vencido = a.diasRestantes < 0;
  const comPromo = a.promocaoStatus === 'ACEITA';
  const preco = comPromo ? a.precoPromocional : a.precoVenda;

  document.getElementById('resultadoTitle').textContent = vencido ? 'Registrar descarte' : 'Registrar resultado';
  document.getElementById('resultadoSub').textContent = `${a.produto}, lote ${a.codigo || '—'}`;
  document.getElementById('resultadoInfo').innerHTML =
    `${App.urgencyChip(a.diasRestantes)} Saldo do lote: <b>${App.qtd(a.quantidadeAtual, a.unidade)}</b>. ` +
    (vencido ? 'Produto vencido: só é possível registrar descarte.'
      : `Preço de venda ${comPromo ? 'com promoção' : 'normal'}: <b>${App.brl(preco)}</b>/${App.esc(a.unidade)}.`);
  document.querySelectorAll('.res-unit').forEach(s => { s.textContent = a.unidade; });
  resVendido.value = '';
  resDescartado.value = vencido ? String(Number(a.quantidadeAtual)) : '';
  resVendido.disabled = vencido;
  resDoado.value = '';
  resDoado.disabled = vencido;
  document.getElementById('resInstituicao').value = '';
  document.getElementById('resObs').value = '';
  document.getElementById('resVendidoHint').textContent = vencido ? 'Produto vencido não pode ser vendido nem doado: informe só o descarte.' : '';
  document.getElementById('resMotivo').value = 'Vencido';
  resumo();
  App.openDialog('resultadoDialog');
}

function resumo() {
  if (!atual) return;
  const v = Number(resVendido.value) || 0;
  const d = Number(resDescartado.value) || 0;
  const o = Number(resDoado.value) || 0;
  const preco = atual.promocaoStatus === 'ACEITA' ? atual.precoPromocional : atual.precoVenda;
  const resto = Number(atual.quantidadeAtual) - v - d - o;
  const partes = [];
  if (v > 0) partes.push(`${App.brl(v * preco)} recuperados com a venda`);
  if (o > 0) partes.push(`${App.qtd(o, atual.unidade)} doados em vez de ir para o lixo`);
  if (d > 0) partes.push(`${App.brl(d * atual.custoUnitario)} de perda no descarte`);
  if (resto > 0 && (v > 0 || d > 0 || o > 0)) partes.push(`restam ${App.qtd(resto, atual.unidade)} no lote`);
  if (resto < 0) partes.push(`a soma passa do saldo em ${App.qtd(-resto, atual.unidade)}`);
  document.getElementById('instituicaoField').style.display = o > 0 ? '' : 'none';
  document.getElementById('resResumo').textContent = partes.length ? partes.join(', ') + '.' : '';
  document.getElementById('motivoField').style.display = d > 0 ? '' : 'none';
}
resVendido.addEventListener('input', resumo);
resDescartado.addEventListener('input', resumo);
resDoado.addEventListener('input', resumo);

document.getElementById('resultadoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    vendido: resVendido.value || 0,
    descartado: resDescartado.value || 0,
    doado: resDoado.value || 0,
    instituicao: document.getElementById('resInstituicao').value,
    observacao: document.getElementById('resObs').value,
    motivo: document.getElementById('resMotivo').value
  };
  try {
    const r = await App.busy(document.getElementById('resSubmit'), 'Salvando...', () =>
      Api.post(`/alertas/${atual.id}/resultado`, body));
    App.closeDialog('resultadoDialog');
    const partes = [];
    if (Number(r.valorRecuperado) > 0) partes.push(`${App.brl(r.valorRecuperado)} recuperados`);
    if (Number(body.doado) > 0) partes.push(`${App.qtd(body.doado, atual.unidade)} doados`);
    if (Number(r.valorPerdido) > 0) partes.push(`${App.brl(r.valorPerdido)} de perda`);
    App.toast(`Resultado registrado${partes.length ? ': ' + partes.join(', ') : ''}. O alerta foi para o histórico.`);
    await carregar();
  } catch (err) {
    App.dialogError('resultadoDialog', err.message);
  }
});

// ================= HISTÓRICO =================
function renderHistorico() {
  const termo = App.normalizar(document.getElementById('hBusca').value.trim());
  const periodo = document.getElementById('hPeriodo').value;
  const res = document.getElementById('hResultado').value;
  const dec = document.getElementById('hDecisao').value;
  const cat = document.getElementById('hCategoria').value;
  const vendeu = a => Number(a.vendido) > 0, descartou = a => Number(a.descartado) > 0;
  const lista = App.ordenar(alertas.filter(a =>
    App.dentroDe(a.resolvidoEm, periodo) &&
    (!res || (res === 'venda' && vendeu(a)) || (res === 'descarte' && descartou(a)) ||
      (res === 'soVenda' && vendeu(a) && !descartou(a)) || (res === 'soDescarte' && descartou(a) && !vendeu(a))) &&
    (!dec || decisaoDe(a) === dec) &&
    (!cat || a.categoria === cat) &&
    (!termo || App.normalizar(a.produto).includes(termo) || App.normalizar(a.codigo).includes(termo))),
    ORDENS_HISTORICO, document.getElementById('hOrdem').value);
  App.resultado(fHistorico.meta, lista.length, alertas.length, alertas.length === 1 ? 'alerta resolvido' : 'alertas resolvidos', fHistorico.ativo());

  if (!alertas.length) {
    view.innerHTML = App.emptyState('Nenhum alerta resolvido ainda',
      'Depois que você registrar o resultado de um alerta, ele aparece aqui com tudo o que aconteceu.');
    return;
  }
  if (!lista.length) {
    view.innerHTML = App.emptyState('Nenhum alerta com esses filtros', 'Mude a busca ou clique em “Limpar filtros”.');
    return;
  }
  view.innerHTML = `<div class="alert-list">${pag.fatiar(lista).map(cardHistorico).join('')}</div>${pag.html('alertas resolvidos')}`;
}

function cardHistorico(a) {
  const chips = [];
  if (Number(a.vendido) > 0) chips.push(`<span class="chip ok">${App.qtd(a.vendido, a.unidade)} vendidos, ${App.brl(a.valorRecuperado)}</span>`);
  if (Number(a.doado) > 0) chips.push(`<span class="chip proximo">${App.qtd(a.doado, a.unidade)} doados</span>`);
  if (Number(a.descartado) > 0) chips.push(`<span class="chip vencido">${App.qtd(a.descartado, a.unidade)} descartados, ${App.brl(a.valorPerdido)}</span>`);
  if (!chips.length) chips.push('<span class="chip">Encerrado sem movimentação</span>');

  return `<article class="history-card">
    <div class="history-head">
      <div class="prod">${App.thumb(a.produto, a.categoria)}<div>
        <h3>${App.esc(a.produto)}</h3>
        <div class="alert-meta">
          <span>Lote ${App.esc(a.codigo || '—')}</span>
          <span>Validade ${App.date(a.dataValidade)}</span>
          <span>Resolvido em ${App.dateTime(a.resolvidoEm)}</span>
        </div>
      </div></div>
      <div class="history-result">${chips.join('')}</div>
    </div>
    ${a.observacao ? `<blockquote class="obs-note"><small>Observação da equipe</small>${App.esc(a.observacao)}</blockquote>` : ''}
    <ol class="timeline">
      ${a.eventos.filter(ev => ev.tipo !== 'OBSERVACAO').map(ev => {
        const [rotulo, cls] = EVENTOS[ev.tipo] || [ev.tipo, ''];
        return `<li class="${cls}"><time>${App.dateTime(ev.criadoEm)}</time><div class="ev"><b>${rotulo}</b><span>${App.esc(ev.descricao)}</span></div></li>`;
      }).join('')}
    </ol>
  </article>`;
}
