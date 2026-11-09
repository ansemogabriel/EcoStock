package br.com.ecostock.service;

import br.com.ecostock.db.Sql;
import br.com.ecostock.http.Req;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Connection;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Números do dashboard, relatórios e lista de promoções. */
public class PainelService {
    /** Filtro opcional de categoria (vazio = todas). Usa dois parâmetros: cat, cat. */
    private static final String CAT = " AND (? = '' OR p.categoria = ?)";
    private static final DateTimeFormatter DIA_MES = DateTimeFormatter.ofPattern("dd/MM");
    private final AlertaService alertas;

    public PainelService(AlertaService alertas) {
        this.alertas = alertas;
    }

    // ================= DASHBOARD =================
    public Object dashboard(Req req) throws Exception {
        long estab = req.usuario.estabelecimentoId();
        return Sql.tx(c -> {
            alertas.sincronizar(c, estab);

            var lotes = Sql.one(c, """
                    SELECT COALESCE(SUM(d < 0), 0) AS vencidos,
                           COALESCE(SUM(d = 0), 0) AS hoje,
                           COALESCE(SUM(d BETWEEN 1 AND ?), 0) AS proximos,
                           COALESCE(SUM(d > ?), 0) AS em_dia,
                           COUNT(*) AS lotes,
                           COALESCE(SUM(CASE WHEN d BETWEEN 0 AND ? THEN qtd * custo ELSE 0 END), 0) AS valor_risco
                    FROM (SELECT DATEDIFF(l.data_validade, CURDATE()) AS d, l.quantidade_atual AS qtd, p.custo_unitario AS custo
                          FROM lote l JOIN produto p ON p.id = l.produto_id
                          WHERE p.estabelecimento_id = ? AND l.quantidade_atual > 0) x
                    """, AlertaService.DIAS_ALERTA, AlertaService.DIAS_ALERTA, AlertaService.DIAS_ALERTA, estab);
            var produtos = Sql.one(c, "SELECT COUNT(*) AS total FROM produto WHERE estabelecimento_id = ? AND ativo = TRUE", estab);

            LocalDate inicioMes = LocalDate.now().withDayOfMonth(1);
            var recuperadoMes = Sql.one(c, """
                    SELECT COALESCE(SUM(v.valor), 0) AS valor, COALESCE(SUM(v.quantidade), 0) AS qtd
                    FROM venda_recuperada v JOIN lote l ON l.id = v.lote_id JOIN produto p ON p.id = l.produto_id
                    WHERE p.estabelecimento_id = ? AND v.criado_em >= ?
                    """, estab, inicioMes);

            var doadoMes = Sql.one(c, """
                    SELECT COALESCE(SUM(d.quantidade), 0) AS qtd
                    FROM doacao d JOIN lote l ON l.id = d.lote_id JOIN produto p ON p.id = l.produto_id
                    WHERE p.estabelecimento_id = ? AND d.criado_em >= ?
                    """, estab, inicioMes);

            Map<String, Object> r = new LinkedHashMap<>();
            r.put("loja", req.usuario.loja());
            r.put("produtosCadastrados", Sql.num(produtos, "total"));
            r.put("lotesAtivos", Sql.num(lotes, "lotes"));
            r.put("vencidos", Sql.num(lotes, "vencidos"));
            r.put("vencendoHoje", Sql.num(lotes, "hoje"));
            r.put("proximosVencimento", Sql.num(lotes, "proximos"));
            r.put("emDia", Sql.num(lotes, "emDia"));
            r.put("valorEmRisco", Sql.dec(lotes, "valorRisco").setScale(2, RoundingMode.HALF_UP));
            r.put("economiaNoMes", Sql.dec(recuperadoMes, "valor").setScale(2, RoundingMode.HALF_UP));
            r.put("produtosSalvos", Sql.dec(recuperadoMes, "qtd").add(Sql.dec(doadoMes, "qtd")).setScale(0, RoundingMode.HALF_UP));
            r.put("alertasAbertos", alertas.contarAbertos(c, estab));
            r.put("resumoMes", serieSemanal(c, estab, 5, ""));
            r.put("motivosPerdas", motivos(c, estab, 30, ""));
            return r;
        });
    }

    /** Perdas x recuperado em blocos de 7 dias, terminando hoje. */
    private List<Map<String, Object>> serieSemanal(Connection c, long estab, int semanas, String cat) throws Exception {
        LocalDate hoje = LocalDate.now();
        LocalDate inicio = hoje.minusDays(7L * semanas - 1);
        var perdas = Sql.list(c, """
                SELECT DATE(pe.data_perda) AS dia, SUM(pe.valor_estimado) AS valor
                FROM perda pe JOIN lote l ON l.id = pe.lote_id JOIN produto p ON p.id = l.produto_id
                WHERE p.estabelecimento_id = ? AND pe.data_perda >= ?""" + CAT + """
                GROUP BY DATE(pe.data_perda)
                """, estab, inicio, cat, cat);
        var vendas = Sql.list(c, """
                SELECT DATE(v.criado_em) AS dia, SUM(v.valor) AS valor
                FROM venda_recuperada v JOIN lote l ON l.id = v.lote_id JOIN produto p ON p.id = l.produto_id
                WHERE p.estabelecimento_id = ? AND v.criado_em >= ?""" + CAT + """
                GROUP BY DATE(v.criado_em)
                """, estab, inicio, cat, cat);

        List<Map<String, Object>> serie = new ArrayList<>();
        for (int i = 0; i < semanas; i++) {
            LocalDate de = inicio.plusDays(7L * i);
            LocalDate ate = de.plusDays(6);
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("mes", de.format(DIA_MES));
            s.put("ate", ate.format(DIA_MES));
            s.put("perdas", somaEntre(perdas, de, ate));
            s.put("recuperado", somaEntre(vendas, de, ate));
            serie.add(s);
        }
        return serie;
    }

    private static BigDecimal somaEntre(List<Map<String, Object>> linhas, LocalDate de, LocalDate ate) {
        BigDecimal total = BigDecimal.ZERO;
        for (var l : linhas) {
            LocalDate d = LocalDate.parse(Sql.str(l, "dia"));
            if (!d.isBefore(de) && !d.isAfter(ate)) total = total.add(Sql.dec(l, "valor"));
        }
        return total.setScale(2, RoundingMode.HALF_UP);
    }

    /** Participação de cada motivo no valor perdido (percentuais somam 100). */
    private List<Map<String, Object>> motivos(Connection c, long estab, int dias, String cat) throws Exception {
        var linhas = Sql.list(c, """
                SELECT pe.motivo, SUM(pe.valor_estimado) AS valor, SUM(pe.quantidade) AS quantidade, COUNT(*) AS registros
                FROM perda pe JOIN lote l ON l.id = pe.lote_id JOIN produto p ON p.id = l.produto_id
                WHERE p.estabelecimento_id = ? AND pe.data_perda >= DATE_SUB(CURDATE(), INTERVAL ? DAY)""" + CAT + """
                GROUP BY pe.motivo ORDER BY valor DESC
                """, estab, dias - 1, cat, cat);
        BigDecimal total = linhas.stream().map(l -> Sql.dec(l, "valor")).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<Map<String, Object>> out = new ArrayList<>();
        int acumulado = 0;
        for (int i = 0; i < linhas.size(); i++) {
            var l = linhas.get(i);
            int pct = total.signum() == 0 ? 0 : (i == linhas.size() - 1 ? 100 - acumulado
                    : Sql.dec(l, "valor").multiply(BigDecimal.valueOf(100)).divide(total, 0, RoundingMode.HALF_UP).intValue());
            acumulado += pct;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("motivo", Sql.str(l, "motivo"));
            m.put("percentual", Math.max(pct, 0));
            m.put("valor", Sql.dec(l, "valor").setScale(2, RoundingMode.HALF_UP));
            m.put("quantidade", l.get("quantidade"));
            m.put("registros", l.get("registros"));
            out.add(m);
        }
        return out;
    }

    // ================= RELATÓRIOS =================
    public Object relatorio(Req req) throws Exception {
        long estab = req.usuario.estabelecimentoId();
        int dias = req.queryInt("dias", 30, 7, 365);
        String cat = req.query.getOrDefault("categoria", "").trim();
        LocalDate inicio = LocalDate.now().minusDays(dias - 1L);
        return Sql.tx(c -> {
            alertas.sincronizar(c, estab);
            var perdas = Sql.one(c, """
                    SELECT COUNT(*) AS registros, COALESCE(SUM(pe.quantidade), 0) AS quantidade, COALESCE(SUM(pe.valor_estimado), 0) AS valor
                    FROM perda pe JOIN lote l ON l.id = pe.lote_id JOIN produto p ON p.id = l.produto_id
                    WHERE p.estabelecimento_id = ? AND pe.data_perda >= ?""" + CAT + """
                    """, estab, inicio, cat, cat);
            var recuperado = Sql.one(c, """
                    SELECT COUNT(*) AS registros, COALESCE(SUM(v.quantidade), 0) AS quantidade, COALESCE(SUM(v.valor), 0) AS valor
                    FROM venda_recuperada v JOIN lote l ON l.id = v.lote_id JOIN produto p ON p.id = l.produto_id
                    WHERE p.estabelecimento_id = ? AND v.criado_em >= ?""" + CAT + """
                    """, estab, inicio, cat, cat);
            var funil = Sql.one(c, """
                    SELECT COUNT(*) AS emitidos,
                           COALESCE(SUM(pr.status = 'ACEITA'), 0) AS com_promocao,
                           COALESCE(SUM(pr.status = 'RECUSADA'), 0) AS sem_promocao,
                           COALESCE(SUM(a.status = 'RESOLVIDO'), 0) AS resolvidos,
                           COALESCE(SUM(EXISTS (SELECT 1 FROM venda_recuperada v WHERE v.alerta_id = a.id)), 0) AS com_venda
                    FROM alerta a
                    JOIN lote l ON l.id = a.lote_id JOIN produto p ON p.id = l.produto_id
                    LEFT JOIN promocao pr ON pr.alerta_id = a.id
                    WHERE p.estabelecimento_id = ? AND a.criado_em >= ?""" + CAT + """
                    """, estab, inicio, cat, cat);
            var porProduto = Sql.list(c, """
                    SELECT p.nome AS produto, p.categoria, p.unidade, SUM(pe.quantidade) AS quantidade, SUM(pe.valor_estimado) AS valor
                    FROM perda pe JOIN lote l ON l.id = pe.lote_id JOIN produto p ON p.id = l.produto_id
                    WHERE p.estabelecimento_id = ? AND pe.data_perda >= ?""" + CAT + """
                    GROUP BY p.id ORDER BY valor DESC LIMIT 6
                    """, estab, inicio, cat, cat);

            var doacoes = Sql.one(c, """
                    SELECT COUNT(*) AS registros, COALESCE(SUM(d.quantidade), 0) AS quantidade, COALESCE(SUM(d.valor_custo), 0) AS valor
                    FROM doacao d JOIN lote l ON l.id = d.lote_id JOIN produto p ON p.id = l.produto_id
                    WHERE p.estabelecimento_id = ? AND d.criado_em >= ?""" + CAT + """
                    """, estab, inicio, cat, cat);

            // Destino de tudo o que saiu do estoque por causa da validade (vendido, doado, descartado)
            BigDecimal qVend = Sql.dec(recuperado, "quantidade");
            BigDecimal qDoa = Sql.dec(doacoes, "quantidade");
            BigDecimal qDesc = Sql.dec(perdas, "quantidade");
            BigDecimal qTotal = qVend.add(qDoa).add(qDesc);
            int foraDoLixo = qTotal.signum() == 0 ? 0
                    : qVend.add(qDoa).multiply(BigDecimal.valueOf(100)).divide(qTotal, 0, RoundingMode.HALF_UP).intValue();
            Map<String, Object> destino = new LinkedHashMap<>();
            destino.put("vendido", qVend);
            destino.put("doado", qDoa);
            destino.put("descartado", qDesc);
            destino.put("foraDoLixo", foraDoLixo);

            BigDecimal vPerdido = Sql.dec(perdas, "valor");
            BigDecimal vRecuperado = Sql.dec(recuperado, "valor");
            BigDecimal base = vPerdido.add(vRecuperado);
            int aproveitamento = base.signum() == 0 ? 0
                    : vRecuperado.multiply(BigDecimal.valueOf(100)).divide(base, 0, RoundingMode.HALF_UP).intValue();

            Map<String, Object> r = new LinkedHashMap<>();
            r.put("dias", dias);
            r.put("inicio", inicio.toString());
            r.put("fim", LocalDate.now().toString());
            r.put("perdas", perdas);
            r.put("recuperado", recuperado);
            r.put("aproveitamento", aproveitamento);
            r.put("doacoes", doacoes);
            r.put("destino", destino);
            r.put("alertas", funil);
            r.put("motivos", motivos(c, estab, dias, cat));
            r.put("categoria", cat);
            r.put("porProduto", porProduto);
            r.put("serie", serieSemanal(c, estab, Math.max(2, Math.min(13, (int) Math.ceil(dias / 7.0))), cat));
            return r;
        });
    }

    // ================= PROMOÇÕES =================
    public Object promocoes(Req req) throws Exception {
        long estab = req.usuario.estabelecimentoId();
        return Sql.tx(c -> {
            alertas.sincronizar(c, estab);
            var lista = Sql.list(c, """
                    SELECT pr.id, pr.status, pr.desconto_sugerido AS desconto, pr.criada_em, pr.decidida_em,
                           a.id AS alerta_id, a.status AS alerta_status, a.resolvido_em,
                           l.id AS lote_id, l.codigo, l.quantidade_atual, l.data_validade,
                           DATEDIFF(l.data_validade, CURDATE()) AS dias_restantes,
                           p.nome AS produto, p.categoria, p.unidade, p.preco_venda,
                           COALESCE((SELECT SUM(v.quantidade) FROM venda_recuperada v WHERE v.promocao_id = pr.id), 0) AS vendido,
                           COALESCE((SELECT SUM(v.valor) FROM venda_recuperada v WHERE v.promocao_id = pr.id), 0) AS valor_vendido
                    FROM promocao pr
                    JOIN lote l ON l.id = pr.lote_id
                    JOIN produto p ON p.id = l.produto_id
                    LEFT JOIN alerta a ON a.id = pr.alerta_id
                    WHERE p.estabelecimento_id = ?
                    ORDER BY pr.criada_em DESC, pr.id DESC
                    LIMIT 300
                    """, estab);
            for (var p : lista) {
                p.put("precoPromocional", AlertaService.precoComDesconto(Sql.dec(p, "precoVenda"), Sql.dec(p, "desconto")));
            }
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("promocoes", lista);
            resp.put("regras", AlertaService.regras());
            return resp;
        });
    }
}
