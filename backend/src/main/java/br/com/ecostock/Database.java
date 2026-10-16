package br.com.ecostock;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public final class Database {
    private Database() {}

    public static Connection connect() throws SQLException {
        String url = System.getenv().getOrDefault(
                "DB_URL",
                "jdbc:mysql://localhost:3306/ecostock?serverTimezone=America/Sao_Paulo"
        );
        String user = System.getenv().getOrDefault("DB_USER", "root");
        String password = System.getenv().getOrDefault("DB_PASSWORD", "");

        return DriverManager.getConnection(url, user, password);
    }
}
