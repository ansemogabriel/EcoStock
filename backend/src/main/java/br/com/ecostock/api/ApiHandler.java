package br.com.ecostock.api;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;

import com.google.gson.Gson;
import com.google.gson.JsonParseException;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import br.com.ecostock.Database;
import br.com.ecostock.model.LoteResumo;
import br.com.ecostock.service.LoteService;
import br.com.ecostock.service.PerdaService;

public class ApiHandler implements HttpHandler {
    private final Gson gson = new Gson();
    private final LoteService loteService;
    private final PerdaService perdaService;

    public ApiHandler(LoteService loteService, PerdaService perdaService) {
        this.loteService = loteService;
        this.perdaService = perdaService;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        configurarCors(exchange);
        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            exchange.close();
            return;
        }

        try {
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();

            if ("/api/health".equals(path) && "GET".equalsIgnoreCase(method)) {
                try (Connection connection = Database.connect();
                    var statement = connection.createStatement();
                    var result = statement.executeQuery("SELECT 1")) {
                    result.next();
                }
                responder(exchange, 200, Map.of("status", "ok", "banco", "conectado"));
            } else if ("/api/lotes/proximos".equals(path) && "GET".equalsIgnoreCase(method)) {
                int dias = lerDias(exchange.getRequestURI().getRawQuery());
                List<LoteResumo> lotes = loteService.buscarProximos(dias);
                responder(exchange, 200, lotes);
            } else if ("/api/perdas".equals(path) && "POST".equalsIgnoreCase(method)) {
                PerdaService.RegistroPerda pedido = gson.fromJson(
                        new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8),
                        PerdaService.RegistroPerda.class
                );
                if (pedido == null) throw new IllegalArgumentException("Envie os dados da perda em JSON.");
                PerdaService.ResultadoPerda resultado = perdaService.registrar(pedido);
                responder(exchange, 201, resultado);
            } else {
                responder(exchange, 404, Map.of("erro", "Rota não encontrada."));
            }
        } catch (IllegalArgumentException | JsonParseException e) {
            responder(exchange, 400, Map.of("erro", mensagem(e)));
        } catch (SQLException e) {
            responder(exchange, 500, Map.of("erro", "Não foi possível acessar o banco de dados."));
        } catch (Exception e) {
            responder(exchange, 500, Map.of("erro", "Ocorreu um erro ao processar a solicitação."));
        }
    }

    private int lerDias(String query) {
        int dias = loteService.getDiasAlerta();
        if (query == null || query.isBlank()) return dias;

        for (String parametro : query.split("&")) {
            String[] partes = parametro.split("=", 2);
            if (partes.length == 2 && "dias".equals(partes[0])) {
                try {
                    dias = Integer.parseInt(partes[1]);
                } catch (NumberFormatException e) {
                    throw new IllegalArgumentException("O parâmetro dias deve ser um número inteiro.");
                }
            }
        }

        if (dias < 0 || dias > 365) {
            throw new IllegalArgumentException("O parâmetro dias deve estar entre 0 e 365.");
        }
        return dias;
    }

    private void configurarCors(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
    }

    private void responder(HttpExchange exchange, int status, Object body) throws IOException {
        byte[] resposta = gson.toJson(body).getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, resposta.length);
        try (var output = exchange.getResponseBody()) {
            output.write(resposta);
        }
    }

    private String mensagem(Exception e) {
        return e.getMessage() == null ? "Dados inválidos." : e.getMessage();
    }
}
