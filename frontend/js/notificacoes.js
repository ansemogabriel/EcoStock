// ---------------------------------------------------------------------------
// Notificações — avisos do sistema e ações da equipe sobre os alertas,
// agrupados por dia, com controle de lidas / não lidas.
// ---------------------------------------------------------------------------

let notificacoes = [];
let leitura = 'nao';
let filtros;
const listaEl = document.getElementById('lista');
const pag = App.paginacao();
pag.ligar(listaEl, () => render());

const SVG = {
  sino: '<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.7 21a2 2 0 01-3.4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  subir: '<path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  etiqueta: '<path d="M20 12.5l-7.5 7.5a2 2 0 01-2.8 0L4 14.3V4h10.3l5.7 5.7a2 2 0 010 2.8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/>',
  sem: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/><path d="M8 12h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  check: '<path d="M5 12l5 5 9-10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  lixo: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  fim: '<rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M9 12h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
};

// tipo do evento → título, ícone, tom e se é aviso do sistema ou ação da equipe
const TIPOS = {
  ALERTA_EMITIDO: { titulo: 'Alerta de validade', icone: 'sino', tom: 'mango', origem: 'sistema' },
  ALERTA_ATUALIZADO: { titulo: 'A urgência aumentou', icone: 'subir', tom: 'beet', origem: 'sistema' },
  ALERTA_ENCERRADO: { titulo: 'Alerta encerrado', icone: 'fim', tom: 'slate', origem: 'sistema' },
  PROMOCAO_APLICADA: { titulo: 'Promoção aplicada', icone: 'etiqueta', tom: 'leaf', origem: 'equipe' },
  PROMOCAO_RECUSADA: { titulo: 'Promoção não aplicada', icone: 'sem', tom: 'slate', origem: 'equipe' },
  RESULTADO: { titulo: 'Resultado registrado', icone: 'check', tom: 'spruce', origem: 'equipe' },
  PERDA_REGISTRADA: { titulo: 'Perda registrada', icone: 'lixo', tom: 'beet', origem: 'equipe' }
};

(async function () {
  await App.init('notificacoes');
  filtros = App.bindFilters('filtros', render);
  document.querySelectorAll('#segLeitura button').forEach(b => b.addEventListener('click', () => { setLeitura(b.dataset.l); render(); }));
  document.getElementById('marcarLidas').addEventListener('click', marcarLidas);
  await carregar();
})();

function setLeitura(valor) {
  leitura = valor;
  document.querySelectorAll('#segLeitura button').forEach(b => b.classList.toggle('active', b.dataset.l === valor));
}

async function carregar() {
  try {
    const data = await Api.get('/notificacoes?dias=90');
    notificacoes = data.notificacoes;
    const naoLidas = notificacoes.filter(n => !n.lida).length;
    document.getElementById('cNao').textContent = naoLidas;
    document.getElementById('cTodas').textContent = notificacoes.length;
    document.getElementById('marcarLidas').disabled = data.naoLidas === 0;
    App.setNotifBadge(data.naoLidas);
    App.fillSelect(document.getElementById('fCategoria'), App.categorias(notificacoes), 'Todas');
    filtros.marcar();
    // Sem nada novo: mostra tudo em vez de uma lista vazia
    if (naoLidas === 0 && leitura === 'nao') setLeitura('todas');
    render();
  } catch (err) {
    listaEl.innerHTML = `<div class="notice">${App.esc(err.message)}</div>`;
  }
}

function render() {
  const termo = App.normalizar(document.getElementById('fBusca').value.trim());
  const tipo = document.getElementById('fTipo').value;
  const periodo = document.getElementById('fPeriodo').value;
  const cat = document.getElementById('fCategoria').value;

  const lista = notificacoes.filter(n => {
    const t = TIPOS[n.tipo] || {};
    return (leitura === 'todas' || !n.lida) &&
      (!tipo || n.tipo === tipo || t.origem === tipo) &&
      App.dentroDe(n.criadoEm, periodo) &&
      (!cat || n.categoria === cat) &&
      (!termo || App.normalizar(`${n.produto} ${n.codigo} ${n.descricao}`).includes(termo));
  });
  const base = leitura === 'todas' ? notificacoes.length : notificacoes.filter(n => !n.lida).length;
  App.resultado(filtros.meta, lista.length, base, base === 1 ? 'notificação' : 'notificações', filtros.ativo());

  if (!notificacoes.length) {
    listaEl.innerHTML = App.emptyState('Nenhuma notificação ainda',
      'Quando um lote entrar na faixa de vencimento, o aviso aparece aqui e em Vencimentos.');
    return;
  }
  if (!lista.length) {
    listaEl.innerHTML = leitura === 'nao' && !filtros.ativo()
      ? App.emptyState('Tudo lido', 'Não há notificações novas. Veja a aba “Todas” para o histórico completo.')
      : App.emptyState('Nenhuma notificação com esses filtros', 'Mude a busca ou clique em “Limpar filtros”.');
    return;
  }

  // Agrupa por dia (Hoje, Ontem, data)
  const grupos = [];
  pag.fatiar(lista).forEach(n => {
    const dia = n.criadoEm.slice(0, 10);
    let g = grupos[grupos.length - 1];
    if (!g || g.dia !== dia) { g = { dia, itens: [] }; grupos.push(g); }
    g.itens.push(n);
  });
  listaEl.innerHTML = grupos.map(g => `
    <section class="notif-day">
      <h2>${rotuloDia(g.dia)} <span>${lista.filter(n => n.criadoEm.startsWith(g.dia)).length}</span></h2>
      <ul class="notif-list">${g.itens.map(item).join('')}</ul>
    </section>`).join('') + pag.html('notificações');
}

function rotuloDia(iso) {
  const diff = App.daysBetween(iso, App.todayIso());
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  const d = new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function item(n) {
  const t = TIPOS[n.tipo] || { titulo: n.tipo, icone: 'sino', tom: 'slate', origem: 'sistema' };
  const aberto = n.alertaStatus === 'ABERTO';
  const link = aberto ? `vencimentos.html#alerta-${n.alertaId}` : 'vencimentos.html#historico';
  return `<li class="notif${n.lida ? '' : ' is-new'}">
    <span class="notif-icon tone-${t.tom}" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none">${SVG[t.icone]}</svg></span>
    <div class="notif-body">
      <div class="notif-title">
        <b>${t.titulo}</b>
        <span class="notif-prod">${App.esc(n.produto)}, lote ${App.esc(n.codigo || '—')}</span>
        ${t.origem === 'equipe' ? '<span class="chip">Ação da equipe</span>' : ''}
      </div>
      <p>${App.esc(n.descricao)}</p>
    </div>
    <div class="notif-side">
      <time datetime="${n.criadoEm}">${n.criadoEm.slice(11, 16)}</time>
      <a class="btn-mini${aberto ? ' solid' : ''}" href="${link}">${aberto ? 'Abrir alerta' : 'Ver histórico'}</a>
    </div>
    ${n.lida ? '' : '<span class="sr-only">Não lida</span>'}
  </li>`;
}

async function marcarLidas() {
  const btn = document.getElementById('marcarLidas');
  try {
    await App.busy(btn, 'Marcando...', () => Api.post('/notificacoes/lidas'));
    App.toast('Todas as notificações foram marcadas como lidas.');
    setLeitura('todas');
    await carregar();
  } catch (err) {
    App.toast(err.message);
  }
}
