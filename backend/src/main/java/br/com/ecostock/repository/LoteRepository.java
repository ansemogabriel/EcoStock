package br.com.ecostock.repository;

import br.com.ecostock.Database;
import br.com.ecostock.model.LoteResumo;

import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class LoteRepository {
    public List<LoteResumo> buscarProximosDoVencimento(int dias) throws SQLException {
        String sql = """
                SELECT l.id, p.nome AS produto, l.codigo, l.quantidade_atual,
                       l.data_validade, DATEDIFF(l.data_validade, CURDATE()) AS dias_restantes
                FROM lote l
                JOIN produto p ON p.id = l.produto_id
                WHERE l.quantidade_atual > 0 AND l.data_validade <= ?
                ORDER BY l.data_validade ASC, p.nome ASC
                """;

        LocalDate limite = LocalDate.now().plusDays(dias);
        List<LoteResumo> lotes = new ArrayList<>();

        try (Connection connection = Database.connect();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setDate(1, Date.valueOf(limite));

            try (ResultSet result = statement.executeQuery()) {
                while (result.next()) {
                    LoteResumo lote = new LoteResumo();
                    lote.id = result.getInt("id");
                    lote.produto = result.getString("produto");
                    lote.codigo = result.getString("codigo");
                    lote.quantidadeAtual = result.getBigDecimal("quantidade_atual");
                    lote.dataValidade = result.getDate("data_validade").toLocalDate().toString();
                    lote.diasRestantes = result.getLong("dias_restantes");
                    lotes.add(lote);
                }
            }
        }

        return lotes;
    }
}
