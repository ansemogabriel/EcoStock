// ---------------------------------------------------------------------------
// Auth — gerencia a sessão do usuário no navegador (token + dados básicos).
// As chamadas de rede em si (com fallback automático para o modo local)
// ficam em api.js / mock-api.js.
// ---------------------------------------------------------------------------

const AUTH_TOKEN_KEY = 'ecostock_token';
const AUTH_USER_KEY = 'ecostock_user';

const Auth = {
  getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },
  getUser() {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setSession(token, user) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  },
  isLoggedIn() {
    return !!this.getToken();
  },
  // Redireciona para o login se não houver sessão válida. Use no topo de páginas protegidas.
  requireLogin() {
    if (!this.isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },
  logout() {
    this.clearSession();
    window.location.href = 'login.html';
  }
};
