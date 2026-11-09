// ---------------------------------------------------------------------------
// App — estrutura comum das telas internas: menu lateral, perfil, toast,
// formatação em português, janelas (dialog) e gráficos.
// Uso em cada página:  const me = await App.init('produtos');
// ---------------------------------------------------------------------------

const ICONS = {
  dashboard: '<rect x="3.5" y="3.5" width="7" height="9" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="3.5" y="15.5" width="7" height="5" rx="1.5" stroke="currentColor" stroke-width="1.6"/>',
  produtos: '<path d="M4 8l8-4 8 4v8l-8 4-8-4V8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 8l8 4 8-4M12 12v8" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  lotes: '<path d="M3 20h18M5 20V9h14v11M3 9l9-5 9 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 20v-6h6v6" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  vencimentos: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  promocoes: '<path d="M20 12.5l-7.5 7.5a2 2 0 01-2.8 0L4 14.3V4h10.3l5.7 5.7a2 2 0 010 2.8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/>',
  perdas: '<path d="M3 4v16h18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M7 8l4 4 3-2 5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  relatorios: '<path d="M6 3.5h8l4 4V20a.5.5 0 01-.5.5h-11A.5.5 0 016 20V3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 12h6M9 16h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  validacao: '<path d="M9 4h6a1 1 0 011 1v1H8V5a1 1 0 011-1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 5H6a1 1 0 00-1 1v14a1 1 0 001 1h12a1 1 0 001-1V6a1 1 0 00-1-1h-2" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 13l2 2 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  notificacoes: '<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.7 21a2 2 0 01-3.4 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  configuracoes: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="16" cy="7" r="2" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="17" r="2" stroke="currentColor" stroke-width="1.6"/>'
};

const NAV = [
  { id: 'dashboard', href: 'dashboard.html', label: 'Dashboard' },
  { id: 'produtos', href: 'produtos.html', label: 'Produtos' },
  { id: 'lotes', href: 'lotes.html', label: 'Lotes / Estoque' },
  { id: 'vencimentos', href: 'vencimentos.html', label: 'Vencimentos', badge: true },
  { id: 'promocoes', href: 'promocoes.html', label: 'Promoções' },
  { id: 'perdas', href: 'perdas.html', label: 'Perdas' },
  { id: 'relatorios', href: 'relatorios.html', label: 'Relatórios' },
  { id: 'validacao', href: 'validacao.html', label: 'Validação' },
  { sep: true },
  { id: 'notificacoes', href: 'notificacoes.html', label: 'Notificações', badgeId: 'sideNotifBadge' },
  { id: 'configuracoes', href: 'configuracoes.html', label: 'Configurações' }
];

const LOGO_SVG = `<svg class="logo-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
  <rect width="32" height="32" rx="8" fill="#164B40"/>
  <path d="M7 25C7 13.5 13.5 7 25 7C25 18.5 18.5 25 7 25Z" stroke="#CDEBD8" stroke-width="2" stroke-linejoin="round"/>
  <path d="M7 25L16 16V10.5" stroke="#F2B744" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="16" cy="16" r="1.8" fill="#F2B744"/></svg>`;

const App = {
  me: null,

  // ---------- Inicialização da página ----------
  async init(pageId) {
    if (!Auth.requireLogin()) throw new Error('Redirecionando para login...');
    this.renderSidebar(pageId);
    this.fillProfile(Auth.getUser());
    try {
      const me = await Api.get('/me');
      this.me = me;
      localStorage.setItem('ecostock_user', JSON.stringify(me));
      this.fillProfile(me);
      this.setBadge(me.alertasAbertos);
      this.setNotifBadge(me.notificacoesNaoLidas);
      return me;
    } catch (err) {
      this.toast(err.message);
      return Auth.getUser() || {};
    }
  },

  renderSidebar(pageId) {
    const el = document.getElementById('sidebar');
    if (!el) return;
    // Preferência de sidebar recolhida (salva no navegador)
    let recolhida = false;
    try { recolhida = localStorage.getItem('ecostock_sidebar') === 'recolhida'; } catch { /* sem storage */ }
    document.body.classList.toggle('side-collapsed', recolhida);

    const links = NAV.map(item => {
      if (item.sep) return '<div class="nav-sep" role="separator"></div>';
      const active = item.id === pageId;
      return `<a href="${item.href}" class="nav-link${active ? ' active' : ''}"${active ? ' aria-current="page"' : ''} title="${item.label}">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${ICONS[item.id]}</svg>
        <span class="nav-label">${item.label}</span>
        ${item.badge ? '<span class="nav-badge" id="sideVencBadge" hidden></span>' : ''}
        ${item.badgeId ? `<span class="nav-badge is-notif" id="${item.badgeId}" hidden></span>` : ''}
      </a>`;
    }).join('');

    el.innerHTML = `
      <div class="side-head">
        <a href="dashboard.html" class="logo" aria-label="EcoStock — Dashboard">${LOGO_SVG}<span class="logo-text">EcoStock<small>Controle de validade</small></span></a>
        <button type="button" class="side-toggle" id="sideToggle" aria-label="${recolhida ? 'Expandir menu' : 'Recolher menu'}" title="${recolhida ? 'Expandir menu' : 'Recolher menu'}" aria-expanded="${!recolhida}">
          <svg class="icon-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5v14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path class="seta" d="M17 7l-5 5 5 5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <svg class="icon-menu" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </div>
      <nav class="nav" aria-label="Menu principal">${links}</nav>
      <div class="profile">
        <div class="avatar" id="sideAvatar">?</div>
        <div class="who"><b id="sideName">Carregando...</b><span id="sideStore">&nbsp;</span></div>
        <button class="icon-btn" id="logoutBtn" aria-label="Sair" title="Sair">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>`;
    document.getElementById('logoutBtn').addEventListener('click', () => this.sair());

    const toggle = document.getElementById('sideToggle');
    toggle.addEventListener('click', () => {
      // No celular o botão abre/fecha o menu; no computador, recolhe a sidebar
      if (window.matchMedia('(max-width: 980px)').matches) {
        const aberto = el.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(aberto));
        return;
      }
      const agora = document.body.classList.toggle('side-collapsed');
      toggle.setAttribute('aria-label', agora ? 'Expandir menu' : 'Recolher menu');
      toggle.title = agora ? 'Expandir menu' : 'Recolher menu';
      toggle.setAttribute('aria-expanded', String(!agora));
      try { localStorage.setItem('ecostock_sidebar', agora ? 'recolhida' : 'aberta'); } catch { /* sem storage */ }
    });
  },

  fillProfile(user) {
    if (!user) return;
    const name = document.getElementById('sideName');
    if (!name) return;
    name.textContent = user.loja || 'Minha loja';
    document.getElementById('sideStore').textContent = user.plano ? `Plano ${user.plano}` : (user.email || '');
    document.getElementById('sideAvatar').textContent = (user.loja || user.email || '?').trim().slice(0, 2).toUpperCase();
  },

  setBadge(count) {
    const b = document.getElementById('sideVencBadge');
    if (!b) return;
    b.hidden = !count;
    b.textContent = count;
  },

  setNotifBadge(count) {
    const b = document.getElementById('sideNotifBadge');
    if (b) { b.hidden = !count; b.textContent = count > 99 ? '99+' : count; }
    const dot = document.getElementById('bellDot');
    if (dot) dot.hidden = !count;
  },

  async refreshBadge() {
    try {
      const me = await Api.get('/me');
      this.setBadge(me.alertasAbertos);
      this.setNotifBadge(me.notificacoesNaoLidas);
    } catch { /* ignora */ }
  },

  // ---------- Toast ----------
  toast(msg) {
    const toast = document.getElementById('toast');
    const text = document.getElementById('toastMsg');
    if (!toast || !text) return;
    text.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
  },

  // ---------- Confirmação ----------
  // Abre uma janela de confirmação no visual do sistema. Resolve true/false.
  confirmar({ titulo, texto, confirmar = 'Confirmar', cancelar = 'Cancelar', perigo = false }) {
    let d = document.getElementById('confirmDialog');
    if (!d) {
      d = document.createElement('dialog');
      d.id = 'confirmDialog';
      d.className = 'sheet confirm-sheet';
      d.setAttribute('aria-labelledby', 'confirmTitle');
      d.setAttribute('aria-describedby', 'confirmText');
      d.innerHTML = `
        <div class="confirm-body">
          <span class="confirm-icon" aria-hidden="true"></span>
          <h2 id="confirmTitle"></h2>
          <p id="confirmText"></p>
        </div>
        <div class="sheet-foot confirm-foot">
          <button type="button" class="btn btn-quiet" data-resp="nao"></button>
          <button type="button" class="btn" data-resp="sim"></button>
        </div>`;
      document.body.appendChild(d);
    }
    d.querySelector('#confirmTitle').textContent = titulo;
    d.querySelector('#confirmText').textContent = texto;
    d.querySelector('.confirm-icon').innerHTML = perigo
      ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 8v5M12 16.5v.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M10.3 3.9L2.6 17.3A2 2 0 004.3 20h15.4a2 2 0 001.7-2.7L13.7 3.9a2 2 0 00-3.4 0Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
      : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    d.classList.toggle('is-danger', perigo);
    const nao = d.querySelector('[data-resp="nao"]');
    const sim = d.querySelector('[data-resp="sim"]');
    nao.textContent = cancelar;
    sim.textContent = confirmar;
    sim.className = `btn ${perigo ? 'btn-danger' : 'btn-primary'}`;

    return new Promise(resolve => {
      const fechar = (valor) => {
        nao.onclick = sim.onclick = null;
        d.removeEventListener('cancel', aoCancelar);
        d.removeEventListener('click', aoClicarFora);
        d.close();
        resolve(valor);
      };
      const aoCancelar = (e) => { e.preventDefault(); fechar(false); };      // tecla Esc
      const aoClicarFora = (e) => { if (e.target === d) fechar(false); };     // clique no fundo
      nao.onclick = () => fechar(false);
      sim.onclick = () => fechar(true);
      d.addEventListener('cancel', aoCancelar);
      d.addEventListener('click', aoClicarFora);
      d.showModal();
      nao.focus();   // o foco começa em "Cancelar", para não sair sem querer
    });
  },

  async sair() {
    const ok = await this.confirmar({
      titulo: 'Sair do EcoStock?',
      texto: 'Você vai precisar entrar de novo com seu e-mail e senha para acessar o painel.',
      confirmar: 'Sair',
      cancelar: 'Continuar no sistema'
    });
    if (ok) Auth.logout();
  },

  // ---------- Janelas (dialog) ----------
  openDialog(id) {
    const d = document.getElementById(id);
    const err = d.querySelector('.form-error');
    if (err) err.classList.remove('show');
    d.showModal();
    const first = d.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
    if (first) setTimeout(() => first.focus(), 30);
  },
  closeDialog(id) { document.getElementById(id).close(); },
  dialogError(id, msg) {
    const err = document.querySelector(`#${id} .form-error`);
    err.textContent = msg;
    err.classList.add('show');
  },
  // Liga botões [data-close] de todas as janelas
  bindDialogs() {
    document.querySelectorAll('dialog.sheet [data-close]').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('dialog').close());
    });
  },
  // Desabilita o botão de envio enquanto a requisição acontece
  async busy(button, label, fn) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = label;
    try { return await fn(); }
    finally { button.disabled = false; button.textContent = original; }
  },

  // ---------- Formatação ----------
  num(v, max = 3) { return Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: max }); },
  brl(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); },
  brl0(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }); },
  qtd(v, unidade) { return `${this.num(v)} ${unidade || 'un'}`; },
  date(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  },
  shortDate(iso) {
    if (!iso) return '—';
    const [, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}`;
  },
  dateTime(iso) {
    if (!iso) return '—';
    const [date, time = ''] = iso.split('T');
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y} às ${time.slice(0, 5)}`;
  },
  todayIso(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },
  daysBetween(fromIso, toIso) {
    const a = new Date(fromIso + 'T00:00:00');
    const b = new Date(toIso + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  },

  // Classificação de urgência (mesma regra do back-end)
  urgency(dias) {
    if (dias === null || dias === undefined) return { key: '', label: 'Sem estoque', short: '—' };
    if (dias < 0) return { key: 'vencido', label: dias === -1 ? 'Venceu há 1 dia' : `Venceu há ${-dias} dias`, short: 'Vencido' };
    if (dias === 0) return { key: 'hoje', label: 'Vence hoje', short: 'Hoje' };
    if (dias <= 3) return { key: 'urgente', label: dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`, short: '1 a 3 dias' };
    if (dias <= 7) return { key: 'proximo', label: `Vence em ${dias} dias`, short: '4 a 7 dias' };
    return { key: 'ok', label: `Vence em ${dias} dias`, short: 'Em dia' };
  },
  urgencyChip(dias) {
    const u = this.urgency(dias);
    return `<span class="chip ${u.key}">${u.label}</span>`;
  },
  descontoSugerido(dias) {
    if (dias < 0) return 0;
    if (dias === 0) return 50;
    if (dias <= 3) return 30;
    if (dias <= 7) return 15;
    return 0;
  },

  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  },

  // ---------- Filtros e listagens ----------
  // Categorias únicas, em ordem alfabética
  categorias(lista) {
    return [...new Set(lista.map(x => x.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  },
  // Preenche um <select> mantendo o valor escolhido quando possível
  fillSelect(sel, opcoes, rotuloTodos) {
    const atual = sel.value;
    sel.innerHTML = (rotuloTodos ? `<option value="">${rotuloTodos}</option>` : '') +
      opcoes.map(o => typeof o === 'string'
        ? `<option value="${this.esc(o)}">${this.esc(o)}</option>`
        : `<option value="${this.esc(o.value)}">${this.esc(o.label)}</option>`).join('');
    if ([...sel.options].some(o => o.value === atual)) sel.value = atual;
  },
  // "Mostrando X de Y itens" + botão limpar
  resultado(el, mostrados, total, nome, filtrando) {
    el.innerHTML = `<span>${filtrando ? `Mostrando <b>${mostrados}</b> de ${total}` : `<b>${total}</b>`} ${nome}</span>` +
      (filtrando ? '<button type="button" class="clear-btn" data-limpar>Limpar filtros</button>' : '');
  },
  normalizar(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  },
  // Liga uma barra de filtros: qualquer mudança chama onChange;
  // "Limpar filtros" volta tudo ao padrão (selects com data-keep não contam como filtro).
  bindFilters(id, onChange, onClear) {
    const box = document.getElementById(id);
    const marcar = () => box.querySelectorAll('.pick select').forEach(sel => {
      sel.closest('.pick').classList.toggle('is-set', !sel.dataset.keep && sel.selectedIndex > 0);
    });
    let timer;
    box.addEventListener('input', e => {
      marcar();
      clearTimeout(timer);
      timer = setTimeout(onChange, e.target.type === 'search' ? 120 : 0);
    });
    box.addEventListener('click', e => {
      if (!e.target.closest('[data-limpar]')) return;
      box.querySelectorAll('select').forEach(sel => { sel.selectedIndex = 0; });
      box.querySelectorAll('input[type=search]').forEach(i => { i.value = ''; });
      if (onClear) onClear();
      marcar();
      onChange();
    });
    marcar();
    return {
      marcar,
      // Há algum filtro ativo nesta barra?
      ativo: () => [...box.querySelectorAll('input[type=search]')].some(i => i.value.trim()) ||
        [...box.querySelectorAll('.pick select')].some(sel => !sel.dataset.keep && sel.selectedIndex > 0),
      meta: box.querySelector('.filter-meta')
    };
  },
  // ---------- Paginação ----------
  // Uso: const pag = App.paginacao(); pag.ligar(container, render);
  //      no render: pag.fatiar(lista) → itens da página; pag.html('lotes') → rodapé.
  // Mudou o resultado dos filtros/ordenação? Volta sozinho para a página 1.
  paginacao() {
    let porPagina = 10;
    try { porPagina = Number(localStorage.getItem('ecostock_por_pagina')) || 10; } catch { /* sem storage */ }
    const app = this;
    return {
      pagina: 1, porPagina, total: 0, paginas: 1, assinatura: null,
      fatiar(lista) {
        const sig = lista.map(x => x.id).join(',');
        if (sig !== this.assinatura) { this.pagina = 1; this.assinatura = sig; }
        this.total = lista.length;
        this.paginas = Math.max(1, Math.ceil(lista.length / this.porPagina));
        this.pagina = Math.min(this.pagina, this.paginas);
        return lista.slice((this.pagina - 1) * this.porPagina, this.pagina * this.porPagina);
      },
      // Abre a página onde está o item (usado em links diretos, ex.: #alerta-12)
      irPara(lista, id) {
        const i = lista.findIndex(x => String(x.id) === String(id));
        if (i < 0) return;
        this.assinatura = lista.map(x => x.id).join(',');
        this.pagina = Math.floor(i / this.porPagina) + 1;
      },
      html(nome = 'itens') {
        if (this.total <= 10) return '';
        const ini = (this.pagina - 1) * this.porPagina + 1;
        const fim = Math.min(this.pagina * this.porPagina, this.total);
        // Números: primeira, última e vizinhas da atual, com "…" nos saltos
        const nums = [];
        for (let i = 1; i <= this.paginas; i++) {
          if (i === 1 || i === this.paginas || Math.abs(i - this.pagina) <= 1) nums.push(i);
          else if (nums[nums.length - 1] !== '…') nums.push('…');
        }
        const chev = d => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="${d}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        return `<div class="pager">
          <div class="pager-info">Mostrando <b>${ini}–${fim}</b> de ${app.num(this.total)} ${nome}</div>
          <label class="pager-size">Por página
            <select data-pp aria-label="Itens por página">
              ${[10, 20, 30].map(n => `<option value="${n}"${n === this.porPagina ? ' selected' : ''}>${n}</option>`).join('')}
            </select>
          </label>
          <nav class="pager-nav" aria-label="Páginas">
            <button type="button" data-pg="${this.pagina - 1}" ${this.pagina === 1 ? 'disabled' : ''}>${chev('M15 6l-6 6 6 6')}<span>Anterior</span></button>
            ${nums.map(n => n === '…' ? '<span class="pager-gap">…</span>'
              : `<button type="button" class="pg-num${n === this.pagina ? ' active' : ''}" data-pg="${n}"${n === this.pagina ? ' aria-current="page"' : ''} aria-label="Página ${n}">${n}</button>`).join('')}
            <button type="button" data-pg="${this.pagina + 1}" ${this.pagina === this.paginas ? 'disabled' : ''}><span>Próxima</span>${chev('M9 6l6 6-6 6')}</button>
          </nav>
        </div>`;
      },
      ligar(container, rerender) {
        container.addEventListener('click', e => {
          const b = e.target.closest('[data-pg]');
          if (!b || b.disabled) return;
          this.pagina = Number(b.dataset.pg);
          rerender();
          const topo = container.getBoundingClientRect().top;
          if (topo < 0) container.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
        container.addEventListener('change', e => {
          if (!e.target.matches('[data-pp]')) return;
          this.porPagina = Number(e.target.value);
          this.pagina = 1;
          try { localStorage.setItem('ecostock_por_pagina', this.porPagina); } catch { /* sem storage */ }
          rerender();
        });
      }
    };
  },

  // Ordena uma cópia da lista com uma função de comparação nomeada
  ordenar(lista, ordens, chave) {
    const fn = ordens[chave] || Object.values(ordens)[0];
    return [...lista].sort(fn);
  },
  cmpTexto(campo) { return (a, b) => String(a[campo] || '').localeCompare(String(b[campo] || ''), 'pt-BR'); },
  cmpNum(campo, desc = false) {
    const v = x => (x[campo] === null || x[campo] === undefined) ? (desc ? -Infinity : Infinity) : Number(x[campo]);
    return (a, b) => desc ? v(b) - v(a) : v(a) - v(b);
  },
  dentroDe(iso, dias) {
    if (!dias || !iso) return true;
    return this.daysBetween(iso.slice(0, 10), this.todayIso()) < Number(dias);
  },

  // Miniatura com as iniciais, colorida pela categoria
  TONS: {
    'padaria': ['#F6EAD3', '#7A5200'], 'laticinios': ['#E4EDF4', '#35556F'], 'frios': ['#F6E3E7', '#A8324A'],
    'hortifruti': ['#DCEFE6', '#0F6E5A'], 'carnes': ['#F9E3DA', '#9E3F18'], 'bebidas': ['#FBEFD3', '#8A5A00'],
    'mercearia': ['#E9EEE8', '#4E6159'], 'salgados': ['#F7E8D9', '#8A4B12']
  },
  thumb(nome, categoria) {
    const chave = this.normalizar(categoria);
    let tom = this.TONS[chave];
    if (!tom) {
      const extras = [['#E8EEE3', '#4A6131'], ['#EAE7F1', '#4D4675'], ['#E2EFEF', '#24605F'], ['#F3E9E0', '#7A4E2A']];
      let h = 0;
      for (const ch of chave || '?') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      tom = extras[h % extras.length];
    }
    const iniciais = String(nome || '?').split(/\s+/).filter(w => w.length > 2 && !/^[\d(]/.test(w)).slice(0, 2)
      .map(w => w[0]).join('').toUpperCase() || '?';
    return `<span class="thumb" style="--tb:${tom[0]};--tf:${tom[1]}" aria-hidden="true">${this.esc(iniciais)}</span>`;
  },
  // Célula de produto: miniatura + nome + texto de apoio
  produtoCell(nome, sub, categoria) {
    return `<div class="prod">${this.thumb(nome, categoria)}<div><span class="strong">${this.esc(nome)}</span><span class="sub">${sub}</span></div></div>`;
  },

  // ---------- Estados ----------
  emptyState(title, text, actionHtml = '') {
    return `<div class="empty"><h3>${title}</h3><p>${text}</p>${actionHtml}</div>`;
  },

  // ---------- Gráficos ----------
  // Barras agrupadas: perdas x recuperado por semana
  barChart(el, semanas) {
    const maior = Math.max(1, ...semanas.flatMap(m => [Number(m.perdas), Number(m.recuperado)]));
    const magnitude = Math.pow(10, Math.floor(Math.log10(maior)));
    const passo = [1, 2, 2.5, 5, 10].map(f => f * magnitude).find(p => maior / p <= 4);
    const topo = Math.ceil(maior / passo) * passo;
    const linhas = [];
    for (let v = 0; v <= topo; v += passo) linhas.push(v);
    const pct = v => (Number(v) / topo * 100).toFixed(1);

    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'Perdas e recuperado por semana: ' + semanas.map(m =>
      `semana de ${m.mes}, perdas ${this.brl0(m.perdas)} e recuperado ${this.brl0(m.recuperado)}`).join('; '));
    el.innerHTML = `
      <div class="chart-grid" aria-hidden="true">
        ${linhas.map(v => `<div class="gridline${v === 0 ? ' base' : ''}" style="bottom:${pct(v)}%"><span>${this.num(v, 0)}</span></div>`).join('')}
      </div>
      <div class="chart-groups" aria-hidden="true">
        ${semanas.map(m => `
          <div class="group">
            <div class="group-bars">
              <div class="bar loss" style="height:${pct(m.perdas)}%"><span class="tip">${this.brl0(m.perdas)}</span></div>
              <div class="bar recovered" style="height:${pct(m.recuperado)}%"><span class="tip">${this.brl0(m.recuperado)}</span></div>
            </div>
            <span class="group-label">${m.mes}</span>
          </div>`).join('')}
      </div>`;
  },

  CORES_MOTIVOS: {
    'Vencido': 'var(--beet)',
    'Danificado': 'var(--mango)',
    'Excesso de estoque': 'var(--leaf)',
    'Armazenamento inadequado': 'var(--slate)',
    'Outro': 'var(--line-strong)'
  },
  corMotivo(m, i) {
    return this.CORES_MOTIVOS[m] || ['var(--beet)', 'var(--mango)', 'var(--leaf)', 'var(--slate)'][i % 4];
  },

  // Barra de proporção + ranking dos motivos de perda
  motivosChart(mixEl, listEl, motivos) {
    if (!motivos.length) {
      mixEl.innerHTML = '';
      listEl.innerHTML = '<li class="panel-sub">Nenhuma perda registrada no período.</li>';
      return;
    }
    mixEl.innerHTML = motivos.map((m, i) =>
      `<span style="--c:${this.corMotivo(m.motivo, i)}; flex:${Math.max(m.percentual, 1)}"></span>`).join('');
    listEl.innerHTML = motivos.map((m, i) => `
      <li class="reason" style="--c:${this.corMotivo(m.motivo, i)}">
        <span class="reason-name"><i></i>${this.esc(m.motivo)}</span>
        <span class="reason-pct">${m.percentual}%</span>
        <span class="reason-bar"><span style="width:${m.percentual}%"></span></span>
      </li>`).join('');
  }
};

document.addEventListener('DOMContentLoaded', () => App.bindDialogs());
