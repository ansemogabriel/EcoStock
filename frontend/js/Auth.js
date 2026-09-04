// ---------- Config ----------
const API_BASE_URL = 'http://localhost:3000/api';

const AUTH_TOKEN_KEY = 'ecostock_token';
const AUTH_USER_KEY = 'ecostock_user';

const Auth = {
  getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },
  getUser() {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      this.clearSession();
      return null;
    }
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
  },
  // fetch com o header de autenticação já preenchido. Redireciona ao login em caso de 401.
  async authFetch(path, options = {}) {
    const token = this.getToken();
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      options.headers || {},
      token ? { Authorization: `Bearer ${token}` } : {}
    );

    const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

    if (res.status === 401) {
      this.clearSession();
      window.location.href = 'login.html';
      return null;
    }
    return res;
  }
};