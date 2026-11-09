// ---------------------------------------------------------------------------
// Dashboard — números calculados pelo back-end a partir do banco.
// ---------------------------------------------------------------------------

(async function () {
  const me = await App.init('dashboard');

  // ---------- Cabeçalho: saudação + data ----------
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  document.getElementById('greeting').textContent = me && me.loja ? `${saudacao}, ${me.loja}` : saudacao;
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('todayDate').textContent = hoje.charAt(0).toUpperCase() + hoje.slice(1);

  const loadingEl = document.getElementById('dashLoading');
  const errorEl = document.getElementById('dashError');
  const contentEl = document.getElementById('dashContent');

  try {
    const data = await Api.dashboardSummary();
    render(data);
    loadingEl.hidden = true;
    contentEl.hidden = false;
  } catch (err) {
    loadingEl.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent = err.message || 'Não foi possível carregar os dados. Atualize a página para tentar de novo.';
  }

  function render(d) {
    const plural = (n, um, varios) => `${App.num(n)} ${Number(n) === 1 ? um : varios}`;
    const atencao = d.vencidos + d.vencendoHoje + d.proximosVencimento;

    document.getElementById('kpiAtencao').textContent = App.num(atencao);
    document.getElementById('pulseTitle').textContent = atencao === 1 ? 'lote pede atenção' : 'lotes pedem atenção';
    document.getElementById('pulseSub').textContent = atencao === 0
      ? 'Nenhum lote vence nos próximos 7 dias. Cadastre os lotes que chegarem para continuar acompanhando.'
      : `${plural(d.vencidos, 'vencido', 'vencidos')}, ${plural(d.vencendoHoje, 'vence hoje', 'vencem hoje')} e ` +
        `${plural(d.proximosVencimento, 'vence', 'vencem')} nos próximos 7 dias.`;

    document.getElementById('kpiVencidos').textContent = App.num(d.vencidos);
    document.getElementById('kpiHoje').textContent = App.num(d.vencendoHoje);
    document.getElementById('kpiProximos').textContent = App.num(d.proximosVencimento);
    document.getElementById('kpiEmDia').textContent = App.num(d.emDia);
    document.getElementById('kpiLotes').textContent = App.num(d.lotesAtivos);
    App.setBadge(d.alertasAbertos);

    document.getElementById('kpiValorRisco').textContent = App.brl(d.valorEmRisco);
    document.getElementById('kpiEconomia').textContent = App.brl(d.economiaNoMes);
    document.getElementById('kpiSalvos').textContent = App.num(d.produtosSalvos);
    document.getElementById('kpiProdutos').textContent = App.num(d.produtosCadastrados);
    if (Number(d.valorEmRisco) > 0 && Number(d.economiaNoMes) >= Number(d.valorEmRisco)) {
      const razao = (d.economiaNoMes / d.valorEmRisco).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
      document.getElementById('kpiEconomiaNote').textContent = `${razao}× o valor em risco hoje`;
    }

    const totalPerdas = d.resumoMes.reduce((s, m) => s + Number(m.perdas), 0);
    const totalRecuperado = d.resumoMes.reduce((s, m) => s + Number(m.recuperado), 0);
    document.getElementById('totalPerdas').textContent = App.brl0(totalPerdas);
    document.getElementById('totalRecuperado').textContent = App.brl0(totalRecuperado);
    App.barChart(document.getElementById('barChart'), d.resumoMes);
    App.motivosChart(document.getElementById('donutChart'), document.getElementById('donutLegend'), d.motivosPerdas);
  }
})();
