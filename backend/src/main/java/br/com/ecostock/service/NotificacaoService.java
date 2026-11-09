package br.com.ecostock.service;

import br.com.ecostock.db.Sql;
import br.com.ecostock.http.Req;

import java.sql.Connection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Notificações: o que o sistema avisou (alertas emitidos, urgência que aumentou,
 * alerta encerrado) e o que a equipe fez com cada alerta (promoção, resultado,
 * perda). Vêm do histórico dos alertas (alerta_evento). Uma notificação é
 * "lida" quando foi criada antes do último "marcar como lidas" do usuário.
 */
public class NotificacaoService {
    /** Tipos de evento que viram notificação (a sugestão já aparece junto do alerta emitido). */
    private static final String TIPOS = "'ALERTA_EMITIDO','ALERTA_ATUALIZADO','ALERTA_ENCERRADO',"
            + "'PROMOCAO_APLICADA','PROMOCAO_RECUSADA','RESULTADO','PERDA_REGISTRADA'";

    private final AlertaService alertas;

    public NotificacaoService(AlertaService alertas) {
        this.alertas = alertas;
    }

    public Object listar(Req req) throws Exception {
        long estab = req.usuario.estabelecimentoId();
        long usuarioId = req.usuario.id();
        int dias = req.queryInt("dias", 90, 1, 365);
        return Sql.tx(c -> {
            alertas.sincronizar(c, estab);
            List<Map<String, Object>> lista = Sql.list(c, """
                    SELECT e.id, e.tipo, e.descricao, e.criado_em,
                           (u.notificacoes_vistas_em IS NOT NULL AND e.criado_em <= u.notificacoes_vistas_em) AS lida,
                           a.id AS alerta_id, a.status AS alerta_status, a.tipo AS urgencia,
                           l.codigo, p.nome AS produto, p.categoria
                    FROM alerta_evento e
                    JOIN alerta a ON a.id = e.alerta_id
                    JOIN lote l ON l.id = a.lote_id
                    JOIN produto p ON p.id = l.produto_id
                    JOIN usuario u ON u.id = ?
                    WHERE p.estabelecimento_id = ?
                      AND e.tipo IN (""" + TIPOS + """
                    )
                      AND e.criado_em >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                    ORDER BY e.criado_em DESC, e.id DESC
                    LIMIT 400
                    """, usuarioId, estab, dias - 1);
            for (var n : lista) n.put("lida", Sql.num(n, "lida") == 1);

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("notificacoes", lista);
            resp.put("naoLidas", contarNaoLidas(c, estab, usuarioId));
            return resp;
        });
    }

    public Object marcarLidas(Req req) throws Exception {
        Sql.with(c -> Sql.update(c, "UPDATE usuario SET notificacoes_vistas_em = NOW() WHERE id = ?", req.usuario.id()));
        return Map.of("message", "Notificações marcadas como lidas.", "naoLidas", 0);
    }

    public int contarNaoLidas(Connection c, long estab, long usuarioId) throws Exception {
        var row = Sql.one(c, """
                SELECT COUNT(*) AS total
                FROM alerta_evento e
                JOIN alerta a ON a.id = e.alerta_id
                JOIN lote l ON l.id = a.lote_id
                JOIN produto p ON p.id = l.produto_id
                JOIN usuario u ON u.id = ?
                WHERE p.estabelecimento_id = ?
                  AND e.tipo IN (""" + TIPOS + """
                )
                  AND (u.notificacoes_vistas_em IS NULL OR e.criado_em > u.notificacoes_vistas_em)
                """, usuarioId, estab);
        return (int) Sql.num(row, "total");
    }
}
