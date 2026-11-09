package br.com.ecostock.http;

/** Erro com status HTTP e mensagem pensada para aparecer na tela. */
public class ApiException extends RuntimeException {
    public final int status;

    public ApiException(int status, String message) {
        super(message);
        this.status = status;
    }

    public static ApiException badRequest(String msg) { return new ApiException(400, msg); }
    public static ApiException notFound(String msg) { return new ApiException(404, msg); }
}
