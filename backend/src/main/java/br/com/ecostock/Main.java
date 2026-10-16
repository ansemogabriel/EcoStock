package br.com.ecostock;

import br.com.ecostock.api.ApiHandler;
import br.com.ecostock.repository.LoteRepository;
import br.com.ecostock.service.LoteService;
import br.com.ecostock.service.PerdaService;
import com.sun.net.httpserver.HttpServer;

import java.net.InetSocketAddress;

public class Main {
    public static void main(String[] args) throws Exception {
        int porta = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        LoteService loteService = new LoteService(new LoteRepository());
        PerdaService perdaService = new PerdaService();

        HttpServer servidor = HttpServer.create(new InetSocketAddress(porta), 0);
        servidor.createContext("/api/", new ApiHandler(loteService, perdaService));
        servidor.start();

        System.out.println("API EcoStock disponível em http://localhost:" + porta + "/api");
    }
}
