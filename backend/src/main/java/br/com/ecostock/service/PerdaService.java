package br.com.ecostock.service;

import br.com.ecostock.db.Sql;
import br.com.ecostock.http.ApiException;
import br.com.ecostock.http.Req;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Registro de perdas (descarte) com baixa automática no lote. */
public class PerdaService {
    public static final List<String> MOTIVOS = List.of(
            "Vencido", "Danificado", "Excesso de estoque", "Armazenamento inadequado", "Outro");

    public Object listar(Req req) throws Exception {
        long estab = req.usuario.estabelecimentoId();
        int dias = req.queryInt("dias", 30, 1, 3650);
        return Sql.with(c -> {
            List<Map<String, Object>> perdas = Sql.list(c, """
                    SELECT pe.id, pe.quantidade, pe.motivo, pe.data_perda, pe.valor_estimado, pe.alerta_id,
                           l.id AS lote_id, l.codigo, p.nome AS produto, p.categoria, p.unidade,
                           u.nome AS usuario
                    FROM perda pe
                    JOIN lote l ON l.id = pe.lote_id
                    JOIN produto p ON p.id = l.produto_id
                    LEFT JOIN usuario u ON u.id = pe.usuario_id
                    WHERE p.estabelecimento_id = ? AND pe.data_perda >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                    ORDER BY pe.data_perda DESC, pe.id DESC
                    """, estab, dias - 1);
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("perdas", perdas);
            resp.put("motivos", MOTIVOS);
            return resp;
        });
    }

    public Object registrar(Req req) throws Exception {
        long estab = req.usuario.estabelecimentoId();
        long loteId = req.longObrigatorio("loteId", "lote");
        BigDecimal quantidade = req.decObrigatorio("quantidade", "quantidade");
        String motivo = req.strObrigatorio("motivo", "motivo");
        if (quantidade.signum() <= 0) throw ApiException.badRequest("A quantidade da perda deve ser maior que zero.");
        if (motivo.length() > 180) throw ApiException.badRequest("O motivo pode ter no máximo 180 caracteres.");

        Map<String, Object> resp = Sql.tx(c -> {
            var lote = EstoqueService.loteDaLoja(c, loteId, estab);
            BigDecimal saldo = Sql.dec(lote, "quantidadeAtual");
            String unidade = Sql.str(lote, "unidade");
            if (quantidade.compareTo(saldo) > 0) {
                throw ApiException.badRequest("A perda não pode ser maior que o saldo do lote (" + Fmt.qtd(saldo, unidade) + ").");
            }
            BigDecimal valor = quantidade.multiply(Sql.dec(lote, "custoUnitario")).setScale(2, RoundingMode.HALF_UP);

            // Se o lote tem alerta aberto, a perda entra no histórico desse alerta
            var alerta = Sql.one(c, "SELECT id FROM alerta WHERE lote_id = ? AND status = 'ABERTO'", loteId);
            Long alertaId = alerta == null ? null : Sql.num(alerta, "id");

            long id = Sql.insert(c, """
                    INSERT INTO perda (lote_id, usuario_id, alerta_id, quantidade, motivo, valor_estimado)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, loteId, req.usuario.id(), alertaId, quantidade, motivo, valor);
            BigDecimal restante = saldo.subtract(quantidade);
            Sql.update(c, "UPDATE lote SET quantidade_atual = ? WHERE id = ?", restante, loteId);
            if (alertaId != null) {
                AlertaService.evento(c, alertaId, "PERDA_REGISTRADA", "Perda registrada: " + Fmt.qtd(quantidade, unidade)
                        + ", motivo " + motivo.toLowerCase() + " (" + Fmt.brl(valor) + ").");
            }

            Map<String, Object> r = new LinkedHashMap<>();
            r.put("id", id);
            r.put("valorEstimado", valor);
            r.put("saldoAtualizado", restante);
            r.put("message", "Perda registrada.");
            return r;
        });
        req.status = 201;
        return resp;
    }
}
