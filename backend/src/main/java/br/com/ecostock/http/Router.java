package br.com.ecostock.http;

import br.com.ecostock.service.AuthService;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Roteador simples da API: associa método + caminho a uma função. */
public class Router implements HttpHandler {
    public interface Handler {
        Object handle(Req req) throws Exception;
    }

    private record Route(String method, Pattern pattern, boolean auth, Handler handler) {}

    private final List<Route> routes = new ArrayList<>();
    private final Gson gson = new GsonBuilder().serializeNulls().create();
    private final AuthService auth;

    public Router(AuthService auth) {
        this.auth = auth;
    }

    /** Rota pública (não exige login). */
    public Router open(String method, String path, Handler handler) {
        routes.add(new Route(method, Pattern.compile("^" + path + "$"), false, handler));
        return this;
    }

    /** Rota que exige o token de login no cabeçalho Authorization. */
    public Router secure(String method, String path, Handler handler) {
        routes.add(new Route(method, Pattern.compile("^" + path + "$"), true, handler));
        return this;
    }

    @Override
    public void handle(HttpExchange ex) throws IOException {
        ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        ex.getResponseHeaders().set("Cache-Control", "no-store");

        String method = ex.getRequestMethod().toUpperCase();
        if ("OPTIONS".equals(method)) {
            ex.sendResponseHeaders(204, -1);
            ex.close();
            return;
        }

        String path = ex.getRequestURI().getPath();
        try {
            Route match = null;
            Matcher matcher = null;
            boolean pathExists = false;
            for (Route r : routes) {
                Matcher m = r.pattern.matcher(path);
                if (m.matches()) {
                    pathExists = true;
                    if (r.method.equals(method)) {
                        match = r;
                        matcher = m;
                        break;
                    }
                }
            }
            if (match == null) {
                throw new ApiException(pathExists ? 405 : 404, "Rota não encontrada: " + method + " " + path);
            }

            String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            Req req = new Req(method, matcher, ex.getRequestURI().getRawQuery(), body);

            String header = ex.getRequestHeaders().getFirst("Authorization");
            if (header != null && header.startsWith("Bearer ")) req.token = header.substring(7).trim();
            if (match.auth) {
                req.usuario = auth.autenticar(req.token);
                if (req.usuario == null) {
                    throw new ApiException(401, "Sua sessão expirou. Entre de novo para continuar.");
                }
            }

            Object result = match.handler.handle(req);
            send(ex, req.status, result == null ? Map.of("ok", true) : result);
        } catch (ApiException e) {
            send(ex, e.status, Map.of("erro", e.getMessage(), "error", e.getMessage()));
        } catch (SQLException e) {
            System.err.println("[erro de banco] " + method + " " + path + ": " + e.getMessage());
            String msg = "Não foi possível acessar o banco de dados. Confira se o MySQL está rodando.";
            send(ex, 500, Map.of("erro", msg, "error", msg));
        } catch (Exception e) {
            e.printStackTrace();
            String msg = "Ocorreu um erro ao processar a solicitação.";
            send(ex, 500, Map.of("erro", msg, "error", msg));
        }
    }

    private void send(HttpExchange ex, int status, Object body) throws IOException {
        byte[] bytes = gson.toJson(body).getBytes(StandardCharsets.UTF_8);
        ex.sendResponseHeaders(status, bytes.length);
        try (var out = ex.getResponseBody()) {
            out.write(bytes);
        }
    }
}
