package br.com.ecostock;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public final class Database {
    private Database() {}

    // Registra o driver explicitamente: no `mvn exec:java` o carregamento
    // automático (ServiceLoader) não enxerga o driver e a conexão falha.
    static {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("Driver do MySQL não encontrado no classpath.", e);
        }
    }

    public static Connection connect() throws SQLException {
        // createDatabaseIfNotExist: o banco "ecostock" é criado sozinho na primeira execução.
        String url = System.getenv().getOrDefault(
                "DB_URL",
                "jdbc:mysql://localhost:3306/ecostock?serverTimezone=America/Sao_Paulo"
                        + "&createDatabaseIfNotExist=true&allowPublicKeyRetrieval=true&useSSL=false"
        );
        String user = System.getenv().getOrDefault("DB_USER", "root");
        String password = System.getenv().getOrDefault("DB_PASSWORD", "");

        return DriverManager.getConnection(url, user, password);
    }
}
