package br.com.ecostock.http;

import br.com.ecostock.service.AuthService.Usuario;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.math.BigDecimal;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;

/** Dados de uma requisição já interpretados: parâmetros, corpo JSON e usuário logado. */
public class Req {
    public final String method;
    public final Matcher path;
    public final Map<String, String> query = new HashMap<>();
    public final JsonObject body;
    public Usuario usuario;
    public String token;
    public int status = 200;

    Req(String method, Matcher path, String rawQuery, String rawBody) {
        this.method = method;
        this.path = path;
        if (rawQuery != null) {
            for (String par : rawQuery.split("&")) {
                String[] kv = par.split("=", 2);
                if (kv.length == 2) {
                    query.put(kv[0], URLDecoder.decode(kv[1], StandardCharsets.UTF_8));
                }
            }
        }
        JsonObject parsed = new JsonObject();
        if (rawBody != null && !rawBody.isBlank()) {
            try {
                JsonElement el = JsonParser.parseString(rawBody);
                if (el.isJsonObject()) parsed = el.getAsJsonObject();
            } catch (Exception e) {
                throw ApiException.badRequest("O corpo da requisição não é um JSON válido.");
            }
        }
        this.body = parsed;
    }

    public long id(int group) {
        return Long.parseLong(path.group(group));
    }

    public int queryInt(String name, int padrao, int min, int max) {
        String v = query.get(name);
        if (v == null || v.isBlank()) return padrao;
        try {
            int n = Integer.parseInt(v);
            return Math.max(min, Math.min(max, n));
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("O parâmetro " + name + " deve ser um número.");
        }
    }

    // ---------- Leitura do corpo ----------
    public String str(String name) {
        JsonElement el = body.get(name);
        if (el == null || el.isJsonNull()) return null;
        String s = el.getAsString().trim();
        return s.isEmpty() ? null : s;
    }

    public String strObrigatorio(String name, String rotulo) {
        String s = str(name);
        if (s == null) throw ApiException.badRequest("Preencha o campo " + rotulo + ".");
        return s;
    }

    public BigDecimal dec(String name) {
        JsonElement el = body.get(name);
        if (el == null || el.isJsonNull()) return null;
        String s = el.getAsString().trim().replace(",", ".");
        if (s.isEmpty()) return null;
        try {
            return new BigDecimal(s);
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("O valor de " + name + " precisa ser um número.");
        }
    }

    public BigDecimal decObrigatorio(String name, String rotulo) {
        BigDecimal v = dec(name);
        if (v == null) throw ApiException.badRequest("Preencha o campo " + rotulo + ".");
        return v;
    }

    public long longObrigatorio(String name, String rotulo) {
        BigDecimal v = decObrigatorio(name, rotulo);
        return v.longValue();
    }

    public boolean bool(String name) {
        JsonElement el = body.get(name);
        return el != null && !el.isJsonNull() && el.getAsBoolean();
    }

    /** Data opcional: devolve null se o campo vier vazio. */
    public LocalDate dataOpcional(String name, String rotulo) {
        String s = str(name);
        if (s == null) return null;
        try {
            return LocalDate.parse(s);
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest("A data de " + rotulo + " é inválida.");
        }
    }

    public LocalDate data(String name, String rotulo) {
        String s = strObrigatorio(name, rotulo);
        try {
            return LocalDate.parse(s);
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest("A data de " + rotulo + " é inválida.");
        }
    }
}
