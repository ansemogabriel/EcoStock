package br.com.ecostock.db;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Statement;

/**
 * Cria/atualiza a estrutura do banco ao iniciar o servidor.
 * Lê database/schema.sql (idempotente) e adiciona colunas novas em bancos
 * criados por versões anteriores do projeto, sem apagar dados.
 */
public final class Migracao {
    private Migracao() {}

    public static void executar() throws Exception {
        Path schema = localizarSchema();
        String conteudo = Files.readString(schema, StandardCharsets.UTF_8);

        Sql.with(c -> {
            try (Statement st = c.createStatement()) {
                for (String comando : comandos(conteudo)) {
                    String upper = comando.toUpperCase();
                    if (upper.startsWith("CREATE DATABASE") || upper.startsWith("USE ")) continue;
                    st.execute(comando);
                }
            }
            // Bancos criados antes desta versão: adiciona as colunas que faltam
            garantirColuna(c, "estabelecimento", "plano", "VARCHAR(30) NOT NULL DEFAULT 'Profissional'");
            garantirColuna(c, "usuario", "senha_hash", "VARCHAR(200) NULL");
            garantirColuna(c, "promocao", "alerta_id", "INT UNSIGNED NULL");
            garantirColuna(c, "perda", "alerta_id", "INT UNSIGNED NULL");
            garantirColuna(c, "usuario", "notificacoes_vistas_em", "DATETIME NULL");
            garantirColuna(c, "lote", "data_fabricacao", "DATE NULL");
            garantirColuna(c, "alerta", "observacao", "VARCHAR(300) NULL");
            return null;
        });
        System.out.println("Banco de dados pronto (" + schema.normalize() + ").");
    }

    private static Path localizarSchema() {
        String env = System.getenv("ECOSTOCK_SCHEMA");
        Path[] candidatos = {
                env == null ? null : Path.of(env),
                Path.of("../database/schema.sql"),
                Path.of("database/schema.sql")
        };
        for (Path p : candidatos) {
            if (p != null && Files.exists(p)) return p;
        }
        throw new IllegalStateException("Arquivo database/schema.sql não encontrado. Rode o back-end de dentro da pasta backend.");
    }

    private static String[] comandos(String sql) {
        StringBuilder limpo = new StringBuilder();
        for (String linha : sql.split("\n")) {
            if (linha.trim().startsWith("--")) continue;
            limpo.append(linha).append('\n');
        }
        return java.util.Arrays.stream(limpo.toString().split(";"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);
    }

    private static void garantirColuna(Connection c, String tabela, String coluna, String definicao) throws Exception {
        var existe = Sql.one(c, """
                SELECT 1 FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
                """, tabela, coluna);
        if (existe == null) {
            Sql.update(c, "ALTER TABLE " + tabela + " ADD COLUMN " + coluna + " " + definicao);
            System.out.println("Coluna adicionada: " + tabela + "." + coluna);
        }
    }
}
