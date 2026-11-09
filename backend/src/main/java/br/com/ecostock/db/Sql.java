package br.com.ecostock.db;

import br.com.ecostock.Database;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Utilitário de acesso ao banco: executa SQL com parâmetros e devolve as linhas
 * como mapas (chaves em camelCase), prontos para virar JSON.
 */
public final class Sql {
    private Sql() {}

    public interface Work<T> {
        T run(Connection connection) throws Exception;
    }

    /** Executa um bloco dentro de uma transação (commit no fim, rollback em erro). */
    public static <T> T tx(Work<T> work) throws Exception {
        try (Connection connection = Database.connect()) {
            connection.setAutoCommit(false);
            try {
                T result = work.run(connection);
                connection.commit();
                return result;
            } catch (Exception e) {
                connection.rollback();
                throw e;
            }
        }
    }

    /** Abre uma conexão, executa o bloco e fecha. */
    public static <T> T with(Work<T> work) throws Exception {
        try (Connection connection = Database.connect()) {
            return work.run(connection);
        }
    }

    public static List<Map<String, Object>> list(Connection c, String sql, Object... params) throws SQLException {
        try (PreparedStatement st = prepare(c, sql, params, false); ResultSet rs = st.executeQuery()) {
            List<Map<String, Object>> rows = new ArrayList<>();
            ResultSetMetaData md = rs.getMetaData();
            while (rs.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                for (int i = 1; i <= md.getColumnCount(); i++) {
                    row.put(camel(md.getColumnLabel(i)), convert(rs.getObject(i)));
                }
                rows.add(row);
            }
            return rows;
        }
    }

    public static Map<String, Object> one(Connection c, String sql, Object... params) throws SQLException {
        List<Map<String, Object>> rows = list(c, sql, params);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public static int update(Connection c, String sql, Object... params) throws SQLException {
        try (PreparedStatement st = prepare(c, sql, params, false)) {
            return st.executeUpdate();
        }
    }

    /** Executa um INSERT e devolve o id gerado. */
    public static long insert(Connection c, String sql, Object... params) throws SQLException {
        try (PreparedStatement st = prepare(c, sql, params, true)) {
            st.executeUpdate();
            try (ResultSet keys = st.getGeneratedKeys()) {
                if (!keys.next()) throw new SQLException("Não foi possível obter o id gerado.");
                return keys.getLong(1);
            }
        }
    }

    // ---------- Leitura de valores de uma linha ----------
    public static BigDecimal dec(Map<String, Object> row, String key) {
        Object v = row == null ? null : row.get(key);
        if (v == null) return BigDecimal.ZERO;
        if (v instanceof BigDecimal b) return b;
        if (v instanceof Number n) return new BigDecimal(n.toString());
        return new BigDecimal(v.toString());
    }

    public static long num(Map<String, Object> row, String key) {
        return dec(row, key).longValue();
    }

    public static String str(Map<String, Object> row, String key) {
        Object v = row == null ? null : row.get(key);
        return v == null ? null : v.toString();
    }

    // ---------- Internos ----------
    private static PreparedStatement prepare(Connection c, String sql, Object[] params, boolean keys) throws SQLException {
        PreparedStatement st = keys
                ? c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)
                : c.prepareStatement(sql);
        for (int i = 0; i < params.length; i++) {
            Object p = params[i];
            if (p instanceof LocalDate d) st.setDate(i + 1, java.sql.Date.valueOf(d));
            else if (p instanceof LocalDateTime dt) st.setTimestamp(i + 1, java.sql.Timestamp.valueOf(dt));
            else st.setObject(i + 1, p);
        }
        return st;
    }

    private static Object convert(Object v) {
        if (v instanceof java.sql.Date d) return d.toLocalDate().toString();
        if (v instanceof java.sql.Timestamp t) return t.toLocalDateTime().withNano(0).toString();
        if (v instanceof LocalDateTime dt) return dt.withNano(0).toString();
        if (v instanceof LocalDate d) return d.toString();
        if (v instanceof BigDecimal b) return b.stripTrailingZeros().scale() < 0 ? b.setScale(0) : b.stripTrailingZeros();
        if (v instanceof java.math.BigInteger bi) return bi.longValue();
        return v;
    }

    private static String camel(String label) {
        StringBuilder out = new StringBuilder();
        boolean upper = false;
        for (char ch : label.toCharArray()) {
            if (ch == '_') { upper = true; continue; }
            out.append(upper ? Character.toUpperCase(ch) : ch);
            upper = false;
        }
        return out.toString();
    }
}
