package br.com.ecostock.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.util.Locale;

/** Formatação em português usada nas mensagens geradas pelo sistema. */
public final class Fmt {
    private static final Locale BR = Locale.forLanguageTag("pt-BR");

    private Fmt() {}

    public static String brl(BigDecimal valor) {
        NumberFormat f = NumberFormat.getCurrencyInstance(BR);
        return f.format(valor.setScale(2, RoundingMode.HALF_UP)).replace(' ', ' ');
    }

    public static String qtd(BigDecimal quantidade, String unidade) {
        NumberFormat f = NumberFormat.getNumberInstance(BR);
        f.setMaximumFractionDigits(3);
        return f.format(quantidade) + " " + (unidade == null ? "un" : unidade);
    }

    public static String pct(BigDecimal valor) {
        return valor.stripTrailingZeros().toPlainString().replace('.', ',') + "%";
    }

    public static String dias(long dias) {
        if (dias == 0) return "hoje";
        if (dias == 1) return "em 1 dia";
        if (dias == -1) return "há 1 dia";
        return dias > 0 ? "em " + dias + " dias" : "há " + (-dias) + " dias";
    }
}
