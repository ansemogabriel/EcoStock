package br.com.ecostock;

import br.com.ecostock.db.Migracao;
import br.com.ecostock.db.Sql;
import br.com.ecostock.http.Router;
import br.com.ecostock.http.StaticHandler;
import br.com.ecostock.service.AlertaService;
import br.com.ecostock.service.AuthService;
import br.com.ecostock.service.DemoService;
import br.com.ecostock.service.EstoqueService;
import br.com.ecostock.service.NotificacaoService;
import br.com.ecostock.service.PainelService;
import br.com.ecostock.service.PerdaService;
import com.sun.net.httpserver.HttpServer;

import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Executors;

public class Main {
    public static void main(String[] args) throws Exception {
        int porta = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));

        // 1. Banco: cria as tabelas que faltam e a conta de demonstração
        Migracao.executar();
        DemoService demo = new DemoService();
        demo.garantirContaDemo();

        // 2. Serviços
        AuthService auth = new AuthService();
        EstoqueService estoque = new EstoqueService();
        AlertaService alertas = new AlertaService();
        PerdaService perdas = new PerdaService();
        PainelService painel = new PainelService(alertas);
        NotificacaoService notificacoes = new NotificacaoService(alertas);

        // 3. Rotas da API
        Router api = new Router(auth)
                .open("GET", "/api/health", r -> {
                    Sql.with(c -> Sql.one(c, "SELECT 1 AS ok"));
                    return Map.of("status", "ok", "banco", "conectado");
                })
                // Conta
                .open("POST", "/api/signup", auth::cadastrar)
                .open("POST", "/api/login", auth::entrar)
                .open("POST", "/api/demo", r -> {
                    String nome = r.strObrigatorio("nome", "nome");
                    String tel = r.strObrigatorio("telefone", "WhatsApp");
                    Sql.with(c -> Sql.insert(c, "INSERT INTO pedido_demonstracao (nome, telefone, negocio) VALUES (?, ?, ?)",
                            nome, tel, r.str("negocio")));
                    r.status = 201;
                    return Map.of("message", "Demonstração agendada.");
                })
                .secure("POST", "/api/logout", auth::sair)
                .secure("GET", "/api/me", r -> {
                    Map<String, Object> m = new LinkedHashMap<>(r.usuario.json());
                    Sql.tx(c -> {
                        long estab = r.usuario.estabelecimentoId();
                        alertas.sincronizar(c, estab);
                        m.put("alertasAbertos", alertas.contarAbertos(c, estab));
                        m.put("notificacoesNaoLidas", notificacoes.contarNaoLidas(c, estab, r.usuario.id()));
                        return null;
                    });
                    m.put("regras", AlertaService.regras());
                    return m;
                })
                .secure("POST", "/api/demo/restaurar", demo::restaurar)
                // Painel
                .secure("GET", "/api/dashboard/summary", painel::dashboard)
                .secure("GET", "/api/relatorios", painel::relatorio)
                .secure("GET", "/api/validacao", alertas::validacao)
                // Produtos
                .secure("GET", "/api/produtos", estoque::listarProdutos)
                .secure("POST", "/api/produtos", estoque::criarProduto)
                .secure("PUT", "/api/produtos/(\\d+)", estoque::atualizarProduto)
                .secure("DELETE", "/api/produtos/(\\d+)", estoque::removerProduto)
                // Lotes
                .secure("GET", "/api/lotes", estoque::listarLotes)
                .secure("POST", "/api/lotes", estoque::criarLote)
                .secure("PUT", "/api/lotes/(\\d+)/saldo", estoque::atualizarSaldo)
                // Alertas de validade (vencimentos)
                .secure("GET", "/api/alertas", alertas::listar)
                .secure("POST", "/api/alertas/(\\d+)/decisao", alertas::decidir)
                .secure("POST", "/api/alertas/(\\d+)/resultado", alertas::registrarResultado)
                // Promoções e perdas
                .secure("GET", "/api/promocoes", painel::promocoes)
                .secure("GET", "/api/perdas", perdas::listar)
                .secure("POST", "/api/perdas", perdas::registrar)
                // Notificações
                .secure("GET", "/api/notificacoes", notificacoes::listar)
                .secure("POST", "/api/notificacoes/lidas", notificacoes::marcarLidas);

        // 4. Servidor: API em /api e o site (pasta frontend) em /
        HttpServer servidor = HttpServer.create(new InetSocketAddress(porta), 0);
        servidor.createContext("/api/", api);
        Path frontend = Path.of(System.getenv().getOrDefault("ECOSTOCK_FRONTEND", "../frontend"));
        if (Files.isDirectory(frontend)) {
            servidor.createContext("/", new StaticHandler(frontend));
        }
        servidor.setExecutor(Executors.newFixedThreadPool(8));
        servidor.start();

        System.out.println();
        System.out.println("EcoStock rodando em http://localhost:" + porta);
        System.out.println("Conta demo: " + AuthService.EMAIL_DEMO + " / " + DemoService.SENHA_DEMO);
    }
}
