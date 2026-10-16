package br.com.ecostock.service;

import br.com.ecostock.Database;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class PerdaService {
    public ResultadoPerda registrar(RegistroPerda pedido) throws SQLException {
        if (pedido.loteId <= 0) throw new IllegalArgumentException("Informe um lote válido.");
        if (pedido.quantidade == null || pedido.quantidade.signum() <= 0) {
            throw new IllegalArgumentException("A quantidade da perda deve ser maior que zero.");
        }
        if (pedido.motivo == null || pedido.motivo.isBlank()) {
            throw new IllegalArgumentException("Informe o motivo da perda.");
        }

        String buscarLote = """
                SELECT l.quantidade_atual, p.custo_unitario
                FROM lote l
                JOIN produto p ON p.id = l.produto_id
                WHERE l.id = ?
                FOR UPDATE
                """;
        String inserirPerda = """
                INSERT INTO perda (lote_id, usuario_id, quantidade, motivo, data_perda, valor_estimado)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
                """;
        String atualizarLote = "UPDATE lote SET quantidade_atual = quantidade_atual - ? WHERE id = ?";

        try (Connection connection = Database.connect()) {
            connection.setAutoCommit(false);
            try {
                BigDecimal quantidadeAtual;
                BigDecimal custoUnitario;
                try (PreparedStatement statement = connection.prepareStatement(buscarLote)) {
                    statement.setInt(1, pedido.loteId);
                    try (ResultSet result = statement.executeQuery()) {
                        if (!result.next()) throw new IllegalArgumentException("O lote informado não existe.");
                        quantidadeAtual = result.getBigDecimal("quantidade_atual");
                        custoUnitario = result.getBigDecimal("custo_unitario");
                    }
                }

                if (pedido.quantidade.compareTo(quantidadeAtual) > 0) {
                    throw new IllegalArgumentException("A perda não pode ser maior que o saldo atual do lote.");
                }

                BigDecimal valorEstimado = pedido.quantidade.multiply(custoUnitario).setScale(2, RoundingMode.HALF_UP);
                int perdaId;
                try (PreparedStatement statement = connection.prepareStatement(inserirPerda, PreparedStatement.RETURN_GENERATED_KEYS)) {
                    statement.setInt(1, pedido.loteId);
                    if (pedido.usuarioId == null) statement.setNull(2, java.sql.Types.INTEGER);
                    else statement.setInt(2, pedido.usuarioId);
                    statement.setBigDecimal(3, pedido.quantidade);
                    statement.setString(4, pedido.motivo.trim());
                    statement.setBigDecimal(5, valorEstimado);
                    statement.executeUpdate();
                    try (ResultSet keys = statement.getGeneratedKeys()) {
                        if (!keys.next()) throw new SQLException("Não foi possível obter o código da perda.");
                        perdaId = keys.getInt(1);
                    }
                }

                try (PreparedStatement statement = connection.prepareStatement(atualizarLote)) {
                    statement.setBigDecimal(1, pedido.quantidade);
                    statement.setInt(2, pedido.loteId);
                    statement.executeUpdate();
                }

                connection.commit();
                return new ResultadoPerda(perdaId, pedido.loteId,
                        quantidadeAtual.subtract(pedido.quantidade), valorEstimado);
            } catch (Exception e) {
                connection.rollback();
                if (e instanceof SQLException sqlException) throw sqlException;
                if (e instanceof IllegalArgumentException validationError) throw validationError;
                throw new SQLException("Não foi possível registrar a perda.", e);
            }
        }
    }

    public static class RegistroPerda {
        public int loteId;
        public Integer usuarioId;
        public BigDecimal quantidade;
        public String motivo;
    }

    public static class ResultadoPerda {
        public final int id;
        public final int loteId;
        public final BigDecimal saldoAtualizado;
        public final BigDecimal valorEstimado;

        public ResultadoPerda(int id, int loteId, BigDecimal saldoAtualizado, BigDecimal valorEstimado) {
            this.id = id;
            this.loteId = loteId;
            this.saldoAtualizado = saldoAtualizado;
            this.valorEstimado = valorEstimado;
        }
    }
}
