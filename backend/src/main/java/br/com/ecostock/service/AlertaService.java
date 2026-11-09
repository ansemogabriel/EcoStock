package br.com.ecostock.service;

import br.com.ecostock.db.Sql;
import br.com.ecostock.http.ApiException;
import br.com.ecostock.http.Req;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Connection;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Alertas de validade.
 *
 * Fluxo: o sistema EMITE um alerta quando um lote entra numa faixa de urgência,
 * já com uma sugestão de desconto. O comerciante DECIDE (aplicar ou não a
 * promoção) e depois informa o RESULTADO (quanto vendeu e quanto descartou).
 * Cada passo fica gravado em alerta_evento, formando o histórico do alerta.
 */
public class AlertaService {
    /** Lotes que vencem em até este número de dias geram alerta. */
    public static final int DIAS_ALERTA = 7;

    // ---------- Regras ----------
    public static String tipo(long dias) {
        if (dias < 0) return "VENCIDO";
        if (dias == 0) return "VENCE_HOJE";
        if (dias <= 3) return "URGENTE";
        return "PROXIMO";
    }

    /** Desconto sugerido de acordo com os dias restantes até o vencimento. */
    public static int descontoSugerido(long dias) {
        if (dias < 0) return 0;      // vencido: não pode ser vendido
        if (dias == 0) return 50;    // vence hoje
        if (dias <= 3) return 30;    // 1 a 3 dias
        if (dias <= 7) return 15;    // 4 a 7 dias
        return 0;
    }

    public static List<Map<String, Object>> regras() {
        List<Map<String, Object>> r = new ArrayList<>();
        r.add(Map.of("faixa", "4 a 7 dias", "tipo", "PROXIMO", "desconto", 15, "acao", "Promoção leve para acelerar a saída"));
        r.add(Map.of("faixa", "1 a 3 dias", "tipo", "URGENTE", "desconto", 30, "acao", "Promoção e destaque na prateleira"));
        r.add(Map.of("faixa", "Vence hoje", "tipo", "VENCE_HOJE", "desconto", 50, "acao", "Última chance de venda"));
        r.add(Map.of("faixa", "Vencido", "tipo", "VENCIDO", "desconto", 0, "acao", "Retirar da venda e registrar o descarte"));
        return r;
    }

    static String mensagem(String produto, String codigo, long dias, BigDecimal qtd, String unidade, BigDecimal custo) {
        String lote = codigo == null ? "" : " (lote " + codigo + ")";
        String risco = Fmt.brl(qtd.multiply(custo));
        String estoque = Fmt.qtd(qtd, unidade);
        if (dias < 0) {
            return produto + lote + " venceu " + Fmt.dias(dias) + ". " + estoque + " precisam sair da prateleira ("
                    + risco + " de custo).";
        }
        String quando = dias == 0 ? "vence hoje" : "vence " + Fmt.dias(dias);
        return produto + lote + " " + quando + ". " + estoque + " em estoque, " + risco + " em risco.";
    }

    // ---------- Sincronização: cria/atualiza alertas conforme a validade ----------
    public void sincronizar(Connection c, long estab) throws Exception {
        List<Map<String, Object>> lotes = Sql.list(c, """
                SELECT l.id, l.codigo, l.quantidade_atual, DATEDIFF(l.data_validade, CURDATE()) AS dias,
                       p.nome, p.unidade, p.custo_unitario
                FROM lote l JOIN produto p ON p.id = l.produto_id
                WHERE p.estabelecimento_id = ? AND l.quantidade_atual > 0
                  AND l.data_validade <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
                """, estab, DIAS_ALERTA);

        for (Map<String, Object> l : lotes) {
            long loteId = Sql.num(l, "id");
            long dias = Sql.num(l, "dias");
            String tipo = tipo(dias);
            String msg = mensagem(Sql.str(l, "nome"), Sql.str(l, "codigo"), dias,
                    Sql.dec(l, "quantidadeAtual"), Sql.str(l, "unidade"), Sql.dec(l, "custoUnitario"));
            int desconto = descontoSugerido(dias);

            var aberto = Sql.one(c, "SELECT id, tipo FROM alerta WHERE lote_id = ? AND status = 'ABERTO'", loteId);
            if (aberto != null) {
                if (!tipo.equals(Sql.str(aberto, "tipo"))) {
                    long alertaId = Sql.num(aberto, "id");
                    Sql.update(c, "UPDATE alerta SET tipo = ?, mensagem = ? WHERE id = ?", tipo, msg, alertaId);
                    evento(c, alertaId, "ALERTA_ATUALIZADO", "Urgência atualizada: " + msg);
                    if (desconto > 0) {
                        Sql.update(c, "UPDATE promocao SET desconto_sugerido = ? WHERE alerta_id = ? AND status = 'PENDENTE'",
                                desconto, alertaId);
                    }
                }
                continue;
            }

            // Já houve alerta desta mesma faixa para este lote (resolvido)? Não repete.
            if (Sql.one(c, "SELECT id FROM alerta WHERE lote_id = ? AND tipo = ?", loteId, tipo) != null) continue;

            long alertaId = Sql.insert(c, "INSERT INTO alerta (lote_id, tipo, mensagem) VALUES (?, ?, ?)", loteId, tipo, msg);
            evento(c, alertaId, "ALERTA_EMITIDO", msg);
            if (desconto > 0) {
                Sql.insert(c, "INSERT INTO promocao (lote_id, alerta_id, desconto_sugerido) VALUES (?, ?, ?)",
                        loteId, alertaId, desconto);
                evento(c, alertaId, "PROMOCAO_SUGERIDA", "Sugestão do EcoStock: " + desconto + "% de desconto para vender antes do vencimento.");
            } else {
                evento(c, alertaId, "ACAO_SUGERIDA", "Sugestão do EcoStock: retirar o lote da venda e registrar o descarte.");
            }
        }

        // Lotes que zeraram (vendidos ou descartados por fora do alerta): encerra o alerta
        List<Map<String, Object>> zerados = Sql.list(c, """
                SELECT a.id FROM alerta a
                JOIN lote l ON l.id = a.lote_id JOIN produto p ON p.id = l.produto_id
                WHERE p.estabelecimento_id = ? AND a.status = 'ABERTO' AND l.quantidade_atual <= 0
                """, estab);
        for (Map<String, Object> z : zerados) {
            long alertaId = Sql.num(z, "id");
            Sql.update(c, "UPDATE alerta SET status = 'RESOLVIDO', resolvido_em = NOW() WHERE id = ?", alertaId);
            evento(c, alertaId, "ALERTA_ENCERRADO", "Lote sem estoque. Alerta encerrado automaticamente.");
        }
    }

    public int contarAbertos(Connection c, long estab) throws Exception {
        var row = Sql.one(c, """
                SELECT COUNT(*) AS total FROM alerta a
                JOIN lote l ON l.id = a.lote_id JOIN produto p ON p.id = l.produto_id
                WHERE p.estabelecimento_id = ? AND a.status = 'ABERTO'
                """, estab);
        return (int) Sql.num(row, "total");
    }

    static void evento(Connection c, long alertaId, String tipo, String descricao) throws Exception {
        String texto = descricao.length() > 300 ? descricao.substring(0, 297) + "..." : descricao;
        Sql.insert(c, "INSERT INTO alerta_evento (alerta_id, tipo, descricao) VALUES (?, ?, ?)", alertaId, tipo, texto);
    }

    // ---------- Listagem ----------
    public Object listar(Req req) throws Exception {
        long estab = req.usuario.estabelecimentoId();
        boolean historico = "historico".equals(req.query.get("status"));
        return Sql.tx(c -> {
            sincronizar(c, estab);
            List<Map<String, Object>> alertas = Sql.list(c, """
                    SELECT a.id, a.tipo, a.mensagem, a.status, a.observacao, a.criado_em, a.resolvido_em,
                           l.id AS lote_id, l.codigo, l.quantidade_atual, l.quantidade_recebida, l.data_validade, l.data_fabricacao,
                           DATEDIFF(l.data_validade, CURDATE()) AS dias_restantes,
                           p.id AS produto_id, p.nome AS produto, p.categoria, p.unidade, p.preco_venda, p.custo_unitario,
                           ROUND(l.quantidade_atual * p.custo_unitario, 2) AS valor_risco,
                           pr.id AS promocao_id, pr.status AS promocao_status, pr.desconto_sugerido AS desconto,
                           COALESCE((SELECT SUM(v.quantidade) FROM venda_recuperada v WHERE v.alerta_id = a.id), 0) AS vendido,
                           COALESCE((SELECT SUM(v.valor) FROM venda_recuperada v WHERE v.alerta_id = a.id), 0) AS valor_recuperado,
                           COALESCE((SELECT SUM(pe.quantidade) FROM perda pe WHERE pe.alerta_id = a.id), 0) AS descartado,
                           COALESCE((SELECT SUM(pe.valor_estimado) FROM perda pe WHERE pe.alerta_id = a.id), 0) AS valor_perdido,
                           COALESCE((SELECT SUM(d.quantidade) FROM doacao d WHERE d.alerta_id = a.id), 0) AS doado,
                           (SELECT d.instituicao FROM doacao d WHERE d.alerta_id = a.id LIMIT 1) AS instituicao
                    FROM alerta a
                    JOIN lote l ON l.id = a.lote_id
                    JOIN produto p ON p.id = l.produto_id
                    LEFT JOIN promocao pr ON pr.alerta_id = a.id
                    WHERE p.estabelecimento_id = ? AND a.status = ?
                    ORDER BY
                      CASE WHEN a.status = 'ABERTO' THEN DATEDIFF(l.data_validade, CURDATE()) END ASC,
                      a.resolvido_em DESC, p.nome
                    LIMIT 200
                    """, estab, historico ? "RESOLVIDO" : "ABERTO");

            for (Map<String, Object> a : alertas) {
                BigDecimal preco = Sql.dec(a, "precoVenda");
                BigDecimal desc = Sql.dec(a, "desconto");
                a.put("precoPromocional", precoComDesconto(preco, desc));
            }
            anexarEventos(c, alertas);

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("alertas", alertas);
            resp.put("regras", regras());
            return resp;
        });
    }

    private void anexarEventos(Connection c, List<Map<String, Object>> alertas) throws Exception {
        if (alertas.isEmpty()) return;
        String ids = alertas.stream().map(a -> String.valueOf(Sql.num(a, "id"))).collect(Collectors.joining(","));
        List<Map<String, Object>> eventos = Sql.list(c,
                "SELECT id, alerta_id, tipo, descricao, criado_em FROM alerta_evento WHERE alerta_id IN (" + ids + ") ORDER BY criado_em, id");
        Map<Long, List<Map<String, Object>>> porAlerta = new LinkedHashMap<>();
        for (Map<String, Object> e : eventos) {
            porAlerta.computeIfAbsent(Sql.num(e, "alertaId"), k -> new ArrayList<>()).add(e);
        }
        for (Map<String, Object> a : alertas) {
            a.put("eventos", porAlerta.getOrDefault(Sql.num(a, "id"), List.of()));
        }
    }

    static BigDecimal precoComDesconto(BigDecimal preco, BigDecimal descontoPct) {
        BigDecimal fator = BigDecimal.ONE.subtract(descontoPct.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP));
        return preco.multiply(fator).setScale(2, RoundingMode.HALF_UP);
    }

    // ---------- Passo 2: decisão sobre a promoção ----------
    public Object decidir(Req req) throws Exception {
        long alertaId = req.id(1);
        long estab = req.usuario.estabelecimentoId();
        boolean aplicar = req.bool("aplicar");
        BigDecimal desconto = req.dec("desconto");

        return Sql.tx(c -> {
            var a = alertaDaLoja(c, alertaId, estab);
            if (!"ABERTO".equals(Sql.str(a, "status"))) throw ApiException.badRequest("Este alerta já foi encerrado.");
            var promo = Sql.one(c, "SELECT * FROM promocao WHERE alerta_id = ?", alertaId);
            if (promo == null) {
                throw ApiException.badRequest("Produto vencido não pode entrar em promoção. Registre o resultado do lote.");
            }
            if (!"PENDENTE".equals(Sql.str(promo, "status"))) throw ApiException.badRequest("A decisão sobre este alerta já foi registrada.");

            BigDecimal preco = Sql.dec(a, "precoVenda");
            if (aplicar) {
                BigDecimal pct = desconto != null ? desconto : Sql.dec(promo, "descontoSugerido");
                if (pct.compareTo(BigDecimal.ONE) < 0 || pct.compareTo(BigDecimal.valueOf(90)) > 0) {
                    throw ApiException.badRequest("O desconto precisa ficar entre 1% e 90%.");
                }
                Sql.update(c, "UPDATE promocao SET status = 'ACEITA', desconto_sugerido = ?, decidida_em = NOW() WHERE id = ?",
                        pct, Sql.num(promo, "id"));
                evento(c, alertaId, "PROMOCAO_APLICADA", "Promoção de " + Fmt.pct(pct) + " aplicada: de "
                        + Fmt.brl(preco) + " por " + Fmt.brl(precoComDesconto(preco, pct)) + " (" + Sql.str(a, "unidade") + ").");
                return Map.of("message", "Promoção aplicada.");
            }
            Sql.update(c, "UPDATE promocao SET status = 'RECUSADA', decidida_em = NOW() WHERE id = ?", Sql.num(promo, "id"));
            evento(c, alertaId, "PROMOCAO_RECUSADA", "Promoção não aplicada. O produto segue com o preço normal de " + Fmt.brl(preco) + ".");
            return Map.of("message", "Decisão registrada: sem promoção.");
        });
    }

    // ---------- Passo 3: resultado (vendido / descartado) ----------
    public Object registrarResultado(Req req) throws Exception {
        long alertaId = req.id(1);
        long estab = req.usuario.estabelecimentoId();
        long usuarioId = req.usuario.id();
        BigDecimal vendido = req.dec("vendido");
        BigDecimal descartado = req.dec("descartado");
        BigDecimal doado = req.dec("doado");
        String motivo = req.str("motivo");
        String instituicao = req.str("instituicao");
        String observacao = req.str("observacao");
        if (vendido == null) vendido = BigDecimal.ZERO;
        if (descartado == null) descartado = BigDecimal.ZERO;
        if (doado == null) doado = BigDecimal.ZERO;
        if (vendido.signum() < 0 || descartado.signum() < 0 || doado.signum() < 0) {
            throw ApiException.badRequest("As quantidades não podem ser negativas.");
        }
        if (vendido.signum() == 0 && descartado.signum() == 0 && doado.signum() == 0) {
            throw ApiException.badRequest("Informe quanto foi vendido, doado ou descartado.");
        }
        if (observacao != null && observacao.length() > 300) throw ApiException.badRequest("A observação pode ter no máximo 300 caracteres.");
        if (instituicao != null && instituicao.length() > 120) throw ApiException.badRequest("O nome da instituição pode ter no máximo 120 caracteres.");
        final BigDecimal qVend = vendido, qDesc = descartado, qDoa = doado;

        return Sql.tx(c -> {
            var a = alertaDaLoja(c, alertaId, estab);
            if (!"ABERTO".equals(Sql.str(a, "status"))) throw ApiException.badRequest("Este alerta já foi encerrado.");
            long loteId = Sql.num(a, "loteId");
            var lote = EstoqueService.loteDaLoja(c, loteId, estab);
            BigDecimal saldo = Sql.dec(lote, "quantidadeAtual");
            String unidade = Sql.str(lote, "unidade");
            BigDecimal soma = qVend.add(qDesc).add(qDoa);
            if (soma.compareTo(saldo) > 0) {
                throw ApiException.badRequest("A soma (" + Fmt.qtd(soma, unidade)
                        + ") é maior que o saldo do lote (" + Fmt.qtd(saldo, unidade) + ").");
            }
            long dias = Sql.num(lote, "diasRestantes");
            if (dias < 0 && qVend.signum() > 0) {
                throw ApiException.badRequest("Produto vencido não pode ser vendido. Informe apenas o descarte.");
            }
            if (dias < 0 && qDoa.signum() > 0) {
                throw ApiException.badRequest("Produto vencido não pode ser doado. Informe apenas o descarte.");
            }

            var promo = Sql.one(c, "SELECT * FROM promocao WHERE alerta_id = ?", alertaId);
            if (promo != null && "PENDENTE".equals(Sql.str(promo, "status")) && qVend.signum() > 0) {
                throw ApiException.badRequest("Antes de informar a venda, registre se a promoção foi aplicada ou não.");
            }
            boolean comPromo = promo != null && "ACEITA".equals(Sql.str(promo, "status"));
            BigDecimal preco = Sql.dec(lote, "precoVenda");
            BigDecimal precoFinal = comPromo ? precoComDesconto(preco, Sql.dec(promo, "descontoSugerido")) : preco;

            List<String> partes = new ArrayList<>();
            BigDecimal recuperado = BigDecimal.ZERO, perdido = BigDecimal.ZERO;
            if (qVend.signum() > 0) {
                recuperado = qVend.multiply(precoFinal).setScale(2, RoundingMode.HALF_UP);
                Sql.insert(c, "INSERT INTO venda_recuperada (lote_id, alerta_id, promocao_id, quantidade, valor) VALUES (?, ?, ?, ?, ?)",
                        loteId, alertaId, comPromo ? Sql.num(promo, "id") : null, qVend, recuperado);
                partes.add("Vendido: " + Fmt.qtd(qVend, unidade) + (comPromo ? " com desconto" : "") + " (" + Fmt.brl(recuperado) + " recuperados)");
            }
            if (qDoa.signum() > 0) {
                BigDecimal custoDoado = qDoa.multiply(Sql.dec(lote, "custoUnitario")).setScale(2, RoundingMode.HALF_UP);
                Sql.insert(c, "INSERT INTO doacao (lote_id, alerta_id, quantidade, instituicao, valor_custo) VALUES (?, ?, ?, ?, ?)",
                        loteId, alertaId, qDoa, instituicao, custoDoado);
                partes.add("Doado: " + Fmt.qtd(qDoa, unidade) + (instituicao == null ? "" : " para " + instituicao)
                        + " (" + Fmt.brl(custoDoado) + " em produtos que não foram para o lixo)");
            }
            if (qDesc.signum() > 0) {
                String m = motivo == null ? (dias < 0 ? "Vencido" : "Outro") : motivo;
                perdido = qDesc.multiply(Sql.dec(lote, "custoUnitario")).setScale(2, RoundingMode.HALF_UP);
                Sql.insert(c, "INSERT INTO perda (lote_id, usuario_id, alerta_id, quantidade, motivo, valor_estimado) VALUES (?, ?, ?, ?, ?, ?)",
                        loteId, usuarioId, alertaId, qDesc, m, perdido);
                partes.add("Descartado: " + Fmt.qtd(qDesc, unidade) + ", motivo " + m.toLowerCase() + " (" + Fmt.brl(perdido) + " de perda)");
            }
            BigDecimal restante = saldo.subtract(soma);
            Sql.update(c, "UPDATE lote SET quantidade_atual = ? WHERE id = ?", restante, loteId);
            if (restante.signum() > 0) partes.add("Restam " + Fmt.qtd(restante, unidade) + " no lote");

            Sql.update(c, "UPDATE alerta SET status = 'RESOLVIDO', resolvido_em = NOW(), observacao = ? WHERE id = ?",
                    observacao, alertaId);
            evento(c, alertaId, "RESULTADO", String.join(". ", partes) + ".");
            if (observacao != null) evento(c, alertaId, "OBSERVACAO", observacao);

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("message", "Resultado registrado.");
            resp.put("valorRecuperado", recuperado);
            resp.put("valorPerdido", perdido);
            resp.put("restante", restante);
            return resp;
        });
    }

    // ---------- Relatório de validação ----------
    /**
     * Todos os alertas emitidos ou resolvidos no período, com a mensagem do sistema,
     * a decisão, o resultado, a observação e a linha do tempo completa.
     */
    public Object validacao(Req req) throws Exception {
        long estab = req.usuario.estabelecimentoId();
        java.time.LocalDate ate = req.query.containsKey("ate") && !req.query.get("ate").isBlank()
                ? java.time.LocalDate.parse(req.query.get("ate")) : java.time.LocalDate.now();
        java.time.LocalDate de = req.query.containsKey("de") && !req.query.get("de").isBlank()
                ? java.time.LocalDate.parse(req.query.get("de")) : ate.minusDays(6);
        if (de.isAfter(ate)) throw ApiException.badRequest("A data inicial precisa ser anterior à data final.");
        if (de.plusDays(366).isBefore(ate)) throw ApiException.badRequest("Escolha um período de até 1 ano.");
        java.time.LocalDate fim = ate.plusDays(1);

        return Sql.tx(c -> {
            sincronizar(c, estab);
            List<Map<String, Object>> lista = Sql.list(c, """
                    SELECT a.id, a.tipo, a.mensagem, a.status, a.observacao, a.criado_em, a.resolvido_em,
                           l.id AS lote_id, l.codigo, l.quantidade_recebida, l.quantidade_atual, l.data_entrada,
                           l.data_validade, l.data_fabricacao,
                           DATEDIFF(l.data_validade, CURDATE()) AS dias_restantes,
                           DATEDIFF(l.data_validade, DATE(a.criado_em)) AS dias_no_alerta,
                           p.nome AS produto, p.categoria, p.unidade, p.preco_venda, p.custo_unitario,
                           pr.status AS promocao_status, pr.desconto_sugerido AS desconto, pr.decidida_em,
                           COALESCE((SELECT SUM(v.quantidade) FROM venda_recuperada v WHERE v.alerta_id = a.id), 0) AS vendido,
                           COALESCE((SELECT SUM(v.valor) FROM venda_recuperada v WHERE v.alerta_id = a.id), 0) AS valor_recuperado,
                           COALESCE((SELECT SUM(d.quantidade) FROM doacao d WHERE d.alerta_id = a.id), 0) AS doado,
                           COALESCE((SELECT SUM(d.valor_custo) FROM doacao d WHERE d.alerta_id = a.id), 0) AS valor_doado,
                           (SELECT d.instituicao FROM doacao d WHERE d.alerta_id = a.id LIMIT 1) AS instituicao,
                           COALESCE((SELECT SUM(pe.quantidade) FROM perda pe WHERE pe.alerta_id = a.id), 0) AS descartado,
                           COALESCE((SELECT SUM(pe.valor_estimado) FROM perda pe WHERE pe.alerta_id = a.id), 0) AS valor_perdido
                    FROM alerta a
                    JOIN lote l ON l.id = a.lote_id
                    JOIN produto p ON p.id = l.produto_id
                    LEFT JOIN promocao pr ON pr.alerta_id = a.id
                    WHERE p.estabelecimento_id = ?
                      AND ((a.criado_em >= ? AND a.criado_em < ?) OR (a.resolvido_em >= ? AND a.resolvido_em < ?))
                    ORDER BY a.criado_em ASC, a.id ASC
                    """, estab, de, fim, de, fim);
            for (Map<String, Object> a : lista) {
                a.put("precoPromocional", precoComDesconto(Sql.dec(a, "precoVenda"), Sql.dec(a, "desconto")));
            }
            anexarEventos(c, lista);

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("loja", req.usuario.loja());
            resp.put("responsavel", req.usuario.nome());
            resp.put("de", de.toString());
            resp.put("ate", ate.toString());
            resp.put("geradoEm", java.time.LocalDateTime.now().withNano(0).toString());
            resp.put("alertas", lista);
            resp.put("regras", regras());
            return resp;
        });
    }

    private Map<String, Object> alertaDaLoja(Connection c, long alertaId, long estab) throws Exception {
        var a = Sql.one(c, """
                SELECT a.*, p.preco_venda, p.unidade FROM alerta a
                JOIN lote l ON l.id = a.lote_id JOIN produto p ON p.id = l.produto_id
                WHERE a.id = ? AND p.estabelecimento_id = ?
                """, alertaId, estab);
        if (a == null) throw ApiException.notFound("Alerta não encontrado.");
        return a;
    }
}
