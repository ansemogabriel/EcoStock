package br.com.ecostock.service;

import br.com.ecostock.db.Sql;
import br.com.ecostock.http.ApiException;
import br.com.ecostock.http.Req;

import java.math.BigDecimal;
import java.sql.Connection;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Catálogo de produtos e lotes (entrada de mercadoria com validade). */
public class EstoqueService {
    private static final List<String> UNIDADES = List.of("un", "kg", "g", "L", "ml", "cx", "pct", "dz");

    // ================= PRODUTOS =================
    public Object listarProdutos(Req req) throws Exception {
        long estab = req.usuario.estabelecimentoId();
        return Sql.with(c -> Sql.list(c, """
                SELECT p.id, p.nome, p.categoria, p.unidade, p.preco_venda, p.custo_unitario, p.ativo,
                       COALESCE(SUM(CASE WHEN l.quantidade_atual > 0 THEN l.quantidade_atual END), 0) AS estoque,
                       COUNT(CASE WHEN l.quantidade_atual > 0 THEN 1 END) AS lotes_ativos,
                       MIN(CASE WHEN l.quantidade_atual > 0 THEN l.data_validade END) AS proxima_validade,
                       MIN(CASE WHEN l.quantidade_atual > 0 THEN DATEDIFF(l.data_validade, CURDATE()) END) AS dias_proxima
                FROM produto p
                LEFT JOIN lote l ON l.produto_id = p.id
                WHERE p.estabelecimento_id = ? AND p.ativo = TRUE
                GROUP BY p.id
                ORDER BY p.nome
                """, estab));
    }

    public Object criarProduto(Req req) throws Exception {
        Map<String, Object> dados = lerProduto(req);
        long estab = req.usuario.estabelecimentoId();
        long id = Sql.with(c -> {
            duplicado(c, estab, (String) dados.get("nome"), 0);
            return Sql.insert(c, """
                    INSERT INTO produto (estabelecimento_id, nome, categoria, unidade, preco_venda, custo_unitario)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, estab, dados.get("nome"), dados.get("categoria"), dados.get("unidade"),
                    dados.get("precoVenda"), dados.get("custoUnitario"));
        });
        req.status = 201;
        return Map.of("id", id, "message", "Produto cadastrado.");
    }

    public Object atualizarProduto(Req req) throws Exception {
        long id = req.id(1);
        Map<String, Object> dados = lerProduto(req);
        long estab = req.usuario.estabelecimentoId();
        Sql.with(c -> {
            produtoDaLoja(c, id, estab);
            duplicado(c, estab, (String) dados.get("nome"), id);
            return Sql.update(c, """
                    UPDATE produto SET nome = ?, categoria = ?, unidade = ?, preco_venda = ?, custo_unitario = ?
                    WHERE id = ?
                    """, dados.get("nome"), dados.get("categoria"), dados.get("unidade"),
                    dados.get("precoVenda"), dados.get("custoUnitario"), id);
        });
        return Map.of("id", id, "message", "Produto atualizado.");
    }

    public Object removerProduto(Req req) throws Exception {
        long id = req.id(1);
        long estab = req.usuario.estabelecimentoId();
        Sql.with(c -> {
            produtoDaLoja(c, id, estab);
            var estoque = Sql.one(c, "SELECT COALESCE(SUM(quantidade_atual),0) AS total FROM lote WHERE produto_id = ?", id);
            if (Sql.dec(estoque, "total").signum() > 0) {
                throw ApiException.badRequest("Este produto ainda tem estoque. Zere ou registre a perda dos lotes antes de remover.");
            }
            // Mantém o histórico (lotes, perdas): apenas desativa o produto
            return Sql.update(c, "UPDATE produto SET ativo = FALSE WHERE id = ?", id);
        });
        return Map.of("message", "Produto removido do catálogo.");
    }

    private Map<String, Object> lerProduto(Req req) {
        String nome = req.strObrigatorio("nome", "nome do produto");
        String categoria = req.str("categoria");
        String unidade = req.str("unidade");
        if (unidade == null || !UNIDADES.contains(unidade)) unidade = "un";
        BigDecimal custo = req.decObrigatorio("custoUnitario", "preço de custo");
        BigDecimal venda = req.decObrigatorio("precoVenda", "preço de venda");
        if (custo.signum() < 0 || venda.signum() < 0) throw ApiException.badRequest("Os preços não podem ser negativos.");
        if (nome.length() > 120) throw ApiException.badRequest("O nome pode ter no máximo 120 caracteres.");
        return Map.of("nome", nome, "categoria", categoria == null ? "" : categoria, "unidade", unidade,
                "custoUnitario", custo, "precoVenda", venda);
    }

    private void duplicado(Connection c, long estab, String nome, long ignorarId) throws Exception {
        var row = Sql.one(c, "SELECT id FROM produto WHERE estabelecimento_id = ? AND ativo = TRUE AND LOWER(nome) = LOWER(?) AND id <> ?",
                estab, nome, ignorarId);
        if (row != null) throw new ApiException(409, "Já existe um produto com o nome \"" + nome + "\".");
    }

    static Map<String, Object> produtoDaLoja(Connection c, long id, long estab) throws Exception {
        var row = Sql.one(c, "SELECT * FROM produto WHERE id = ? AND estabelecimento_id = ? AND ativo = TRUE", id, estab);
        if (row == null) throw ApiException.notFound("Produto não encontrado.");
        return row;
    }

    // ================= LOTES =================
    public Object listarLotes(Req req) throws Exception {
        long estab = req.usuario.estabelecimentoId();
        boolean todos = "1".equals(req.query.get("todos"));
        return Sql.with(c -> Sql.list(c, """
                SELECT l.id, l.codigo, l.quantidade_recebida, l.quantidade_atual, l.data_entrada, l.data_validade, l.data_fabricacao,
                       DATEDIFF(l.data_validade, CURDATE()) AS dias_restantes,
                       p.id AS produto_id, p.nome AS produto, p.categoria, p.unidade, p.custo_unitario, p.preco_venda,
                       ROUND(l.quantidade_atual * p.custo_unitario, 2) AS valor_custo,
                       (SELECT a.id FROM alerta a WHERE a.lote_id = l.id AND a.status = 'ABERTO' LIMIT 1) AS alerta_aberto
                FROM lote l
                JOIN produto p ON p.id = l.produto_id
                WHERE p.estabelecimento_id = ? AND (? OR l.quantidade_atual > 0)
                ORDER BY (l.quantidade_atual > 0) DESC, l.data_validade ASC, p.nome
                """, estab, todos));
    }

    public Object criarLote(Req req) throws Exception {
        long estab = req.usuario.estabelecimentoId();
        long produtoId = req.longObrigatorio("produtoId", "produto");
        String codigo = req.str("codigo");
        BigDecimal quantidade = req.decObrigatorio("quantidade", "quantidade");
        LocalDate entrada = req.data("dataEntrada", "entrada");
        LocalDate validade = req.data("dataValidade", "validade");
        LocalDate fabricacao = req.dataOpcional("dataFabricacao", "fabricação");

        if (quantidade.signum() <= 0) throw ApiException.badRequest("A quantidade precisa ser maior que zero.");
        if (validade.isBefore(entrada)) throw ApiException.badRequest("A validade não pode ser anterior à data de entrada.");
        if (entrada.isAfter(LocalDate.now())) throw ApiException.badRequest("A data de entrada não pode estar no futuro.");
        if (fabricacao != null && fabricacao.isAfter(entrada)) {
            throw ApiException.badRequest("A data de fabricação não pode ser depois da data de entrada.");
        }
        if (fabricacao != null && !fabricacao.isBefore(validade)) {
            throw ApiException.badRequest("A data de fabricação precisa ser anterior à validade.");
        }

        long id = Sql.with(c -> {
            produtoDaLoja(c, produtoId, estab);
            String cod = codigo != null ? codigo : "L" + LocalDate.now().toString().replace("-", "") + "-" + (System.currentTimeMillis() % 10000);
            if (Sql.one(c, "SELECT id FROM lote WHERE produto_id = ? AND codigo = ?", produtoId, cod) != null) {
                throw new ApiException(409, "Já existe um lote com o código " + cod + " para este produto.");
            }
            return Sql.insert(c, """
                    INSERT INTO lote (produto_id, codigo, quantidade_recebida, quantidade_atual, data_validade, data_entrada, data_fabricacao)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, produtoId, cod, quantidade, quantidade, validade, entrada, fabricacao);
        });
        req.status = 201;
        return Map.of("id", id, "message", "Lote cadastrado.");
    }

    /** Atualiza o saldo do lote (ex.: vendas normais do dia). */
    public Object atualizarSaldo(Req req) throws Exception {
        long id = req.id(1);
        long estab = req.usuario.estabelecimentoId();
        BigDecimal novo = req.decObrigatorio("quantidadeAtual", "quantidade atual");
        if (novo.signum() < 0) throw ApiException.badRequest("A quantidade não pode ser negativa.");
        Sql.tx(c -> {
            var lote = loteDaLoja(c, id, estab);
            if (novo.compareTo(Sql.dec(lote, "quantidadeRecebida")) > 0) {
                throw ApiException.badRequest("O saldo não pode ser maior que a quantidade recebida ("
                        + Fmt.qtd(Sql.dec(lote, "quantidadeRecebida"), Sql.str(lote, "unidade")) + ").");
            }
            Sql.update(c, "UPDATE lote SET quantidade_atual = ? WHERE id = ?", novo, id);
            return null;
        });
        return Map.of("message", "Saldo do lote atualizado.");
    }

    static Map<String, Object> loteDaLoja(Connection c, long loteId, long estab) throws Exception {
        var row = Sql.one(c, """
                SELECT l.*, DATEDIFF(l.data_validade, CURDATE()) AS dias_restantes,
                       p.nome AS produto, p.unidade, p.custo_unitario, p.preco_venda
                FROM lote l JOIN produto p ON p.id = l.produto_id
                WHERE l.id = ? AND p.estabelecimento_id = ?
                FOR UPDATE
                """, loteId, estab);
        if (row == null) throw ApiException.notFound("Lote não encontrado.");
        return row;
    }
}
