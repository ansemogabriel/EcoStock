package br.com.ecostock.service;

import br.com.ecostock.db.Sql;
import br.com.ecostock.http.ApiException;
import br.com.ecostock.http.Req;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Connection;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Conta de demonstração (demo@ecostock.local / EcoStockDemo2026!).
 * Cria uma loja com produtos, lotes em várias faixas de validade e um histórico
 * das últimas semanas, sempre com datas relativas ao dia de hoje.
 */
public class DemoService {
    public static final String SENHA_DEMO = "EcoStockDemo2026!";
    private static final String LOJA_DEMO = "Mercadinho Demonstração";
    /** Observações de exemplo da equipe em alguns alertas do histórico (por código do lote). */
    private static final Map<String, String> OBSERVACOES = Map.of(
            "IOG-1980", "Iogurtes colocados na geladeira da frente com etiqueta amarela de desconto.",
            "LEI-5402", "Cliente fiel levou 6 unidades depois de ver a promoção no caixa.",
            "BOL-0098", "Equipe preferiu não dar desconto no bolo; sobrou no fim do dia e foi descartado.",
            "FRA-1999", "Promoção anunciada no grupo de WhatsApp dos clientes do bairro.");

    /** Cria a conta demo na primeira execução. */
    public void garantirContaDemo() throws Exception {
        boolean existe = Sql.with(c -> Sql.one(c, "SELECT id FROM usuario WHERE email = ?", AuthService.EMAIL_DEMO) != null);
        if (existe) return;
        Sql.tx(c -> {
            long estab = Sql.insert(c, "INSERT INTO estabelecimento (nome, plano) VALUES (?, 'Profissional')", LOJA_DEMO);
            Sql.insert(c, "INSERT INTO usuario (estabelecimento_id, nome, email, senha_hash) VALUES (?, ?, ?, ?)",
                    estab, "Equipe Mercadinho", AuthService.EMAIL_DEMO, AuthService.hash(SENHA_DEMO));
            popular(c, estab);
            return null;
        });
        System.out.println("Conta de demonstração criada: " + AuthService.EMAIL_DEMO + " / " + SENHA_DEMO);
    }

    /** Apaga os dados da loja demo e recria tudo (útil antes de gravar uma demonstração). */
    public Object restaurar(Req req) throws Exception {
        if (!AuthService.EMAIL_DEMO.equalsIgnoreCase(req.usuario.email())) {
            throw new ApiException(403, "Só a conta de demonstração pode ser restaurada.");
        }
        long estab = req.usuario.estabelecimentoId();
        Sql.tx(c -> {
            String lotes = "SELECT l.id FROM lote l JOIN produto p ON p.id = l.produto_id WHERE p.estabelecimento_id = " + estab;
            Sql.update(c, "DELETE FROM venda_recuperada WHERE lote_id IN (" + lotes + ")");
            Sql.update(c, "DELETE FROM doacao WHERE lote_id IN (" + lotes + ")");
            Sql.update(c, "DELETE FROM perda WHERE lote_id IN (" + lotes + ")");
            Sql.update(c, "DELETE FROM promocao WHERE lote_id IN (" + lotes + ")");
            Sql.update(c, "DELETE FROM alerta_evento WHERE alerta_id IN (SELECT a.id FROM alerta a WHERE a.lote_id IN (" + lotes + "))");
            Sql.update(c, "DELETE FROM alerta WHERE lote_id IN (" + lotes + ")");
            Sql.update(c, "DELETE FROM lote WHERE produto_id IN (SELECT id FROM produto WHERE estabelecimento_id = ?)", estab);
            Sql.update(c, "DELETE FROM produto WHERE estabelecimento_id = ?", estab);
            popular(c, estab);
            return null;
        });
        return Map.of("message", "Dados de demonstração restaurados.");
    }

    // ---------------------------------------------------------------------
    private void popular(Connection c, long estab) throws Exception {
        Map<String, Long> p = new HashMap<>();
        Object[][] produtos = {
                {"Pão Francês", "Padaria", "kg", "9.50", "16.90"},
                {"Iogurte Natural 170g", "Laticínios", "un", "2.10", "3.99"},
                {"Leite Integral 1L", "Laticínios", "un", "4.10", "5.49"},
                {"Queijo Mussarela", "Frios", "kg", "32.00", "46.90"},
                {"Presunto Cozido", "Frios", "kg", "28.00", "42.90"},
                {"Requeijão Cremoso 200g", "Laticínios", "un", "5.20", "8.49"},
                {"Banana Prata", "Hortifrúti", "kg", "3.20", "6.49"},
                {"Tomate Italiano", "Hortifrúti", "kg", "4.10", "7.99"},
                {"Alface Crespa", "Hortifrúti", "un", "1.40", "3.49"},
                {"Pão de Forma 500g", "Padaria", "un", "5.80", "9.99"},
                {"Bolo de Cenoura", "Padaria", "un", "9.00", "18.90"},
                {"Frango Resfriado", "Carnes", "kg", "11.50", "17.90"},
                {"Suco de Laranja 1L", "Bebidas", "un", "6.20", "8.90"},
                {"Manteiga 200g", "Laticínios", "un", "7.40", "11.90"},
                {"Ovos Brancos (dúzia)", "Mercearia", "un", "8.20", "12.90"},
        };
        for (Object[] r : produtos) {
            long id = Sql.insert(c, """
                    INSERT INTO produto (estabelecimento_id, nome, categoria, unidade, custo_unitario, preco_venda)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, estab, r[0], r[1], r[2], new BigDecimal((String) r[3]), new BigDecimal((String) r[4]));
            p.put((String) r[0], id);
        }

        LocalDate hoje = LocalDate.now();
        // Lotes atuais: {produto, código, recebido, atual, dias desde a entrada, dias até a validade}
        Object[][] lotes = {
                {"Presunto Cozido", "PRE-0412", "5", "1.8", 9, -1},
                {"Pão Francês", "PAO-0901", "12", "4.5", 0, 0},
                {"Alface Crespa", "ALF-1107", "20", "6", 3, 0},
                {"Iogurte Natural 170g", "IOG-2210", "40", "18", 12, 1},
                {"Queijo Mussarela", "QJM-3318", "6", "2.4", 10, 2},
                {"Bolo de Cenoura", "BOL-0102", "6", "3", 1, 2},
                {"Banana Prata", "BAN-0815", "30", "12", 4, 3},
                {"Tomate Italiano", "TOM-1120", "25", "9", 5, 4},
                {"Leite Integral 1L", "LEI-5521", "60", "24", 20, 5},
                {"Requeijão Cremoso 200g", "REQ-7781", "24", "10", 25, 6},
                {"Pão de Forma 500g", "PFO-3390", "20", "8", 2, 9},
                {"Frango Resfriado", "FRA-2041", "15", "7", 1, 12},
                {"Iogurte Natural 170g", "IOG-2299", "40", "40", 2, 16},
                {"Ovos Brancos (dúzia)", "OVO-1180", "30", "22", 4, 18},
                {"Suco de Laranja 1L", "SUC-4410", "30", "14", 10, 20},
                {"Leite Integral 1L", "LEI-5590", "60", "60", 1, 25},
                {"Manteiga 200g", "MAN-0077", "24", "15", 15, 45},
        };
        for (Object[] l : lotes) {
            Sql.insert(c, """
                    INSERT INTO lote (produto_id, codigo, quantidade_recebida, quantidade_atual, data_entrada, data_validade, data_fabricacao)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, p.get((String) l[0]), l[1], new BigDecimal((String) l[2]), new BigDecimal((String) l[3]),
                    hoje.minusDays((Integer) l[4]), hoje.plusDays((Integer) l[5]),
                    hoje.minusDays((Integer) l[4] + 1 + ((String) l[1]).length() % 3));
        }

        // Histórico: alertas já resolvidos nas últimas semanas
        // {produto, código, recebido, dias atrás do alerta, dias até vencer no alerta, desconto (0 = recusada), vendido, descartado, motivo}
        Object[][] casos = {
                {"Iogurte Natural 170g", "IOG-1980", "40", 32, 2, 30, "14", "2", "Vencido"},
                {"Pão Francês", "PAO-0811", "10", 30, 0, 50, "3", "1", "Vencido"},
                {"Leite Integral 1L", "LEI-5402", "60", 27, 5, 15, "20", "0", null},
                {"Banana Prata", "BAN-0790", "30", 24, 2, 30, "8", "3", "Danificado"},
                {"Queijo Mussarela", "QJM-3201", "6", 20, 3, 30, "1.5", "0.4", "Vencido"},
                {"Bolo de Cenoura", "BOL-0098", "6", 17, 1, 0, "0", "2", "Vencido"},
                {"Tomate Italiano", "TOM-1090", "25", 13, 2, 30, "6", "2", "Danificado"},
                {"Requeijão Cremoso 200g", "REQ-7650", "24", 10, 4, 15, "9", "0", null},
                {"Alface Crespa", "ALF-1031", "20", 6, 0, 50, "7", "3", "Armazenamento inadequado"},
                {"Frango Resfriado", "FRA-1999", "15", 4, 1, 30, "4", "0", null},
                {"Presunto Cozido", "PRE-0390", "5", 2, 2, 30, "1.2", "0.3", "Vencido"},
        };
        for (Object[] k : casos) historico(c, p, k);

        // Casos com doação (destino sustentável) e observação da equipe
        historicoComDoacao(c, p, "Pão de Forma 500g", "PFO-3305", "20", 9, 1, 30, "6", "4",
                "Promoção na ponta de gôndola pela manhã. O que sobrou no fim do dia foi separado para doação.");
        historicoComDoacao(c, p, "Banana Prata", "BAN-0802", "30", 5, 2, 30, "9", "5",
                "Bananas maduras com desconto no caixa; as mais maduras foram doadas antes de estragar.");

        // Perdas registradas fora de alertas
        perdaAvulsa(c, p.get("Pão de Forma 500g"), "PFO-3201", "20", 21, "2", "Excesso de estoque");
        perdaAvulsa(c, p.get("Suco de Laranja 1L"), "SUC-4302", "30", 15, "3", "Excesso de estoque");
        perdaAvulsa(c, p.get("Ovos Brancos (dúzia)"), "OVO-1102", "30", 8, "1", "Danificado");
    }

    private void historico(Connection c, Map<String, Long> p, Object[] k) throws Exception {
        long produtoId = p.get((String) k[0]);
        var prod = Sql.one(c, "SELECT nome, unidade, custo_unitario, preco_venda FROM produto WHERE id = ?", produtoId);
        String unidade = Sql.str(prod, "unidade");
        BigDecimal recebido = new BigDecimal((String) k[2]);
        int diasAtras = (Integer) k[3];
        long diasNoAlerta = (Integer) k[4];
        int desconto = (Integer) k[5];
        BigDecimal vendido = new BigDecimal((String) k[6]);
        BigDecimal descartado = new BigDecimal((String) k[7]);
        String motivo = (String) k[8];

        LocalDateTime emitido = LocalDate.now().minusDays(diasAtras).atTime(7, 40);
        LocalDateTime decidido = emitido.plusHours(1).plusMinutes(20);
        LocalDateTime resultado = emitido.plusDays(Math.max(1, diasNoAlerta)).withHour(19).withMinute(10);
        if (resultado.isAfter(LocalDateTime.now())) resultado = LocalDateTime.now().minusHours(2);
        LocalDate validade = emitido.toLocalDate().plusDays(diasNoAlerta);

        long loteId = Sql.insert(c, """
                INSERT INTO lote (produto_id, codigo, quantidade_recebida, quantidade_atual, data_entrada, data_validade)
                VALUES (?, ?, ?, 0, ?, ?)
                """, produtoId, k[1], recebido, validade.minusDays(10), validade);

        BigDecimal saldoNoAlerta = vendido.add(descartado).add(recebido.multiply(BigDecimal.valueOf(0.1)).setScale(0, RoundingMode.HALF_UP));
        String tipo = AlertaService.tipo(diasNoAlerta);
        String msg = AlertaService.mensagem(Sql.str(prod, "nome"), (String) k[1], diasNoAlerta, saldoNoAlerta, unidade,
                Sql.dec(prod, "custoUnitario"));
        long alertaId = Sql.insert(c, "INSERT INTO alerta (lote_id, tipo, mensagem, status, criado_em, resolvido_em) VALUES (?, ?, ?, 'RESOLVIDO', ?, ?)",
                loteId, tipo, msg, emitido, resultado);
        ev(c, alertaId, "ALERTA_EMITIDO", msg, emitido);

        int sugerido = AlertaService.descontoSugerido(diasNoAlerta);
        ev(c, alertaId, "PROMOCAO_SUGERIDA", "Sugestão do EcoStock: " + sugerido + "% de desconto para vender antes do vencimento.", emitido);
        BigDecimal preco = Sql.dec(prod, "precoVenda");
        Long promoId;
        BigDecimal precoFinal = preco;
        if (desconto > 0) {
            promoId = Sql.insert(c, "INSERT INTO promocao (lote_id, alerta_id, desconto_sugerido, status, criada_em, decidida_em) VALUES (?, ?, ?, 'ACEITA', ?, ?)",
                    loteId, alertaId, desconto, emitido, decidido);
            precoFinal = AlertaService.precoComDesconto(preco, BigDecimal.valueOf(desconto));
            ev(c, alertaId, "PROMOCAO_APLICADA", "Promoção de " + desconto + "% aplicada: de " + Fmt.brl(preco) + " por "
                    + Fmt.brl(precoFinal) + " (" + unidade + ").", decidido);
        } else {
            promoId = Sql.insert(c, "INSERT INTO promocao (lote_id, alerta_id, desconto_sugerido, status, criada_em, decidida_em) VALUES (?, ?, ?, 'RECUSADA', ?, ?)",
                    loteId, alertaId, sugerido, emitido, decidido);
            ev(c, alertaId, "PROMOCAO_RECUSADA", "Promoção não aplicada. O produto segue com o preço normal de " + Fmt.brl(preco) + ".", decidido);
        }

        StringBuilder texto = new StringBuilder();
        if (vendido.signum() > 0) {
            BigDecimal valor = vendido.multiply(precoFinal).setScale(2, RoundingMode.HALF_UP);
            Sql.insert(c, "INSERT INTO venda_recuperada (lote_id, alerta_id, promocao_id, quantidade, valor, criado_em) VALUES (?, ?, ?, ?, ?, ?)",
                    loteId, alertaId, desconto > 0 ? promoId : null, vendido, valor, resultado);
            texto.append("Vendido: ").append(Fmt.qtd(vendido, unidade)).append(desconto > 0 ? " com desconto" : "")
                    .append(" (").append(Fmt.brl(valor)).append(" recuperados). ");
        }
        if (descartado.signum() > 0) {
            BigDecimal valor = descartado.multiply(Sql.dec(prod, "custoUnitario")).setScale(2, RoundingMode.HALF_UP);
            Sql.insert(c, "INSERT INTO perda (lote_id, alerta_id, quantidade, motivo, data_perda, valor_estimado) VALUES (?, ?, ?, ?, ?, ?)",
                    loteId, alertaId, descartado, motivo, resultado, valor);
            texto.append("Descartado: ").append(Fmt.qtd(descartado, unidade)).append(", motivo ").append(motivo.toLowerCase())
                    .append(" (").append(Fmt.brl(valor)).append(" de perda). ");
        }
        ev(c, alertaId, "RESULTADO", texto.toString().trim(), resultado);
        String obs = OBSERVACOES.get((String) k[1]);
        if (obs != null) {
            Sql.update(c, "UPDATE alerta SET observacao = ? WHERE id = ?", obs, alertaId);
            ev(c, alertaId, "OBSERVACAO", obs, resultado);
        }
    }

    private void historicoComDoacao(Connection c, Map<String, Long> p, String produto, String codigo, String recebido,
                                    int diasAtras, int diasNoAlerta, int desconto, String vendido, String doado,
                                    String observacao) throws Exception {
        historico(c, p, new Object[]{produto, codigo, recebido, diasAtras, diasNoAlerta, desconto, vendido, "0", null});
        var a = Sql.one(c, """
                SELECT a.id, a.resolvido_em, l.id AS lote_id, pr.custo_unitario, pr.unidade
                FROM alerta a JOIN lote l ON l.id = a.lote_id JOIN produto pr ON pr.id = l.produto_id
                WHERE l.codigo = ? AND pr.id = ?
                """, codigo, p.get(produto));
        long alertaId = Sql.num(a, "id");
        LocalDateTime quando = LocalDateTime.parse(Sql.str(a, "resolvidoEm"));
        BigDecimal q = new BigDecimal(doado);
        BigDecimal valor = q.multiply(Sql.dec(a, "custoUnitario")).setScale(2, RoundingMode.HALF_UP);
        String instituicao = "Instituição parceira (exemplo)";
        Sql.insert(c, "INSERT INTO doacao (lote_id, alerta_id, quantidade, instituicao, valor_custo, criado_em) VALUES (?, ?, ?, ?, ?, ?)",
                Sql.num(a, "loteId"), alertaId, q, instituicao, valor, quando);
        // Completa o texto do resultado e registra a observação
        Sql.update(c, "UPDATE alerta_evento SET descricao = CONCAT(descricao, ?) WHERE alerta_id = ? AND tipo = 'RESULTADO'",
                " Doado: " + Fmt.qtd(q, Sql.str(a, "unidade")) + " para " + instituicao + " (" + Fmt.brl(valor)
                        + " em produtos que não foram para o lixo).", alertaId);
        Sql.update(c, "UPDATE alerta SET observacao = ? WHERE id = ?", observacao, alertaId);
        ev(c, alertaId, "OBSERVACAO", observacao, quando);
    }

    private void perdaAvulsa(Connection c, long produtoId, String codigo, String recebido, int diasAtras, String qtd, String motivo) throws Exception {
        var prod = Sql.one(c, "SELECT custo_unitario FROM produto WHERE id = ?", produtoId);
        LocalDateTime quando = LocalDate.now().minusDays(diasAtras).atTime(18, 30);
        long loteId = Sql.insert(c, """
                INSERT INTO lote (produto_id, codigo, quantidade_recebida, quantidade_atual, data_entrada, data_validade)
                VALUES (?, ?, ?, 0, ?, ?)
                """, produtoId, codigo, new BigDecimal(recebido), quando.toLocalDate().minusDays(12), quando.toLocalDate().plusDays(20));
        BigDecimal q = new BigDecimal(qtd);
        Sql.insert(c, "INSERT INTO perda (lote_id, quantidade, motivo, data_perda, valor_estimado) VALUES (?, ?, ?, ?, ?)",
                loteId, q, motivo, quando, q.multiply(Sql.dec(prod, "custoUnitario")).setScale(2, RoundingMode.HALF_UP));
    }

    private void ev(Connection c, long alertaId, String tipo, String descricao, LocalDateTime quando) throws Exception {
        Sql.insert(c, "INSERT INTO alerta_evento (alerta_id, tipo, descricao, criado_em) VALUES (?, ?, ?, ?)",
                alertaId, tipo, descricao, quando);
    }
}
