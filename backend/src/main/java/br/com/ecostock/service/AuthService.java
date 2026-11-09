package br.com.ecostock.service;

import br.com.ecostock.db.Sql;
import br.com.ecostock.http.ApiException;
import br.com.ecostock.http.Req;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Cadastro, login e sessões. Senhas guardadas com PBKDF2 (nunca em texto). */
public class AuthService {
    public static final String EMAIL_DEMO = "demo@ecostock.local";
    private static final List<String> PLANOS = List.of("Essencial", "Profissional", "Rede");
    private static final int ITERACOES = 120_000;
    private static final int DIAS_SESSAO = 7;
    private final SecureRandom random = new SecureRandom();

    /** Usuário autenticado, com a loja a que ele pertence. */
    public record Usuario(long id, long estabelecimentoId, String nome, String email, String loja, String plano) {
        public Map<String, Object> json() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("nome", nome);
            m.put("email", email);
            m.put("loja", loja);
            m.put("plano", plano);
            m.put("demo", EMAIL_DEMO.equalsIgnoreCase(email));
            return m;
        }
    }

    public Object cadastrar(Req req) throws Exception {
        String loja = req.strObrigatorio("loja", "nome da loja");
        String email = req.strObrigatorio("email", "e-mail").toLowerCase();
        String senha = req.strObrigatorio("senha", "senha");
        String plano = req.str("plano");
        if (plano == null || !PLANOS.contains(plano)) plano = "Profissional";

        if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw ApiException.badRequest("Informe um e-mail válido.");
        if (senha.length() < 6) throw ApiException.badRequest("A senha precisa ter pelo menos 6 caracteres.");
        if (loja.length() > 120) throw ApiException.badRequest("O nome da loja pode ter no máximo 120 caracteres.");

        final String planoFinal = plano;
        long usuarioId = Sql.tx(c -> {
            if (Sql.one(c, "SELECT id FROM usuario WHERE email = ?", email) != null) {
                throw new ApiException(409, "Já existe uma conta com este e-mail. Use a tela de login.");
            }
            long estabId = Sql.insert(c, "INSERT INTO estabelecimento (nome, plano) VALUES (?, ?)", loja, planoFinal);
            return Sql.insert(c, "INSERT INTO usuario (estabelecimento_id, nome, email, senha_hash) VALUES (?, ?, ?, ?)",
                    estabId, loja, email, hash(senha));
        });
        req.status = 201;
        return sessaoNova(usuarioId, "Conta criada com sucesso.");
    }

    public Object entrar(Req req) throws Exception {
        String email = req.strObrigatorio("email", "e-mail").toLowerCase();
        String senha = req.strObrigatorio("senha", "senha");

        Map<String, Object> u = Sql.with(c -> Sql.one(c, "SELECT id, senha_hash FROM usuario WHERE email = ?", email));
        if (u == null || Sql.str(u, "senhaHash") == null || !confere(senha, Sql.str(u, "senhaHash"))) {
            throw new ApiException(401, "E-mail ou senha incorretos.");
        }
        return sessaoNova(Sql.num(u, "id"), "Login efetuado com sucesso.");
    }

    public Object sair(Req req) throws Exception {
        if (req.token != null) {
            Sql.with(c -> Sql.update(c, "DELETE FROM sessao WHERE token = ?", req.token));
        }
        return Map.of("ok", true);
    }

    /** Devolve o usuário dono do token, ou null se o token for inválido/expirado. */
    public Usuario autenticar(String token) throws Exception {
        if (token == null || token.length() != 64) return null;
        Map<String, Object> row = Sql.with(c -> Sql.one(c, """
                SELECT u.id, u.estabelecimento_id, u.nome, u.email, e.nome AS loja, e.plano
                FROM sessao s
                JOIN usuario u ON u.id = s.usuario_id
                JOIN estabelecimento e ON e.id = u.estabelecimento_id
                WHERE s.token = ? AND s.expira_em > NOW()
                """, token));
        if (row == null) return null;
        return new Usuario(Sql.num(row, "id"), Sql.num(row, "estabelecimentoId"), Sql.str(row, "nome"),
                Sql.str(row, "email"), Sql.str(row, "loja"), Sql.str(row, "plano"));
    }

    public Map<String, Object> sessaoNova(long usuarioId, String mensagem) throws Exception {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = HexFormat.of().formatHex(bytes);
        Sql.with(c -> Sql.update(c, "INSERT INTO sessao (token, usuario_id, expira_em) VALUES (?, ?, ?)",
                token, usuarioId, LocalDateTime.now().plusDays(DIAS_SESSAO)));
        Usuario u = autenticar(token);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("message", mensagem);
        resp.put("token", token);
        resp.put("user", u.json());
        return resp;
    }

    // ---------- Hash de senha ----------
    public static String hash(String senha) {
        byte[] salt = new byte[16];
        new SecureRandom().nextBytes(salt);
        byte[] h = pbkdf2(senha, salt, ITERACOES);
        Base64.Encoder b64 = Base64.getEncoder();
        return "pbkdf2$" + ITERACOES + "$" + b64.encodeToString(salt) + "$" + b64.encodeToString(h);
    }

    private static boolean confere(String senha, String armazenado) {
        String[] p = armazenado.split("\\$");
        if (p.length != 4) return false;
        byte[] salt = Base64.getDecoder().decode(p[2]);
        byte[] esperado = Base64.getDecoder().decode(p[3]);
        byte[] calculado = pbkdf2(senha, salt, Integer.parseInt(p[1]));
        return MessageDigest.isEqual(esperado, calculado);
    }

    private static byte[] pbkdf2(String senha, byte[] salt, int iteracoes) {
        try {
            PBEKeySpec spec = new PBEKeySpec(senha.toCharArray(), salt, iteracoes, 256);
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao calcular o hash da senha.", e);
        }
    }
}
