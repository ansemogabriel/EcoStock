package br.com.ecostock.service;

import br.com.ecostock.model.LoteResumo;
import br.com.ecostock.repository.LoteRepository;

import java.sql.SQLException;
import java.util.List;

public class LoteService {
    private final LoteRepository repository;
    private final int diasUrgencia;
    private final int diasAlerta;

    public LoteService(LoteRepository repository) {
        this.repository = repository;
        this.diasUrgencia = lerNumero("ECOSTOCK_DIAS_URGENTE", 3);
        this.diasAlerta = lerNumero("ECOSTOCK_DIAS_ALERTA", 7);
    }

    public List<LoteResumo> buscarProximos(int dias) throws SQLException {
        List<LoteResumo> lotes = repository.buscarProximosDoVencimento(dias);
        for (LoteResumo lote : lotes) {
            lote.situacao = classificar(lote.diasRestantes);
        }
        return lotes;
    }

    public int getDiasAlerta() {
        return diasAlerta;
    }

    private String classificar(long diasRestantes) {
        if (diasRestantes < 0) return "VENCIDO";
        if (diasRestantes == 0) return "VENCE_HOJE";
        if (diasRestantes <= diasUrgencia) return "URGENTE";
        if (diasRestantes <= diasAlerta) return "PROXIMO_DO_VENCIMENTO";
        return "EM_DIA";
    }

    private int lerNumero(String nome, int padrao) {
        try {
            return Integer.parseInt(System.getenv().getOrDefault(nome, String.valueOf(padrao)));
        } catch (NumberFormatException e) {
            return padrao;
        }
    }
}
