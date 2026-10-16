package br.com.ecostock.model;

import java.math.BigDecimal;

public class LoteResumo {
    public int id;
    public String produto;
    public String codigo;
    public BigDecimal quantidadeAtual;
    public String dataValidade;
    public long diasRestantes;
    public String situacao;
}
