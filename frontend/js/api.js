// ---------------------------------------------------------------------------
// Api — ponto único de acesso ao back-end Java (MySQL).
//
// Quando a página é aberta pelo próprio back-end (http://localhost:8080),
// as chamadas vão para /api no mesmo endereço. Se a página for aberta de
// outro lugar (outra porta ou direto do arquivo), usa http://localhost:8080.
// ---------------------------------------------------------------------------

const API_BASE_URL = (location.protocol.startsWith('http') && location.port === '8080')
  ? '/api'
  : 'http://localhost:8080/api';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const Api = {
  async request(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('ecostock_token');
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(API_BASE_URL + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (e) {
      throw new ApiError(
        'Não foi possível conectar ao servidor do EcoStock. Confira se o back-end está rodando ' +
        '(na pasta backend: mvn compile exec:java).', 0);
    }

    let data = {};
    try { data = await res.json(); } catch { /* resposta sem corpo JSON */ }

    if (!res.ok) {
      const message = data.erro || data.error || 'Erro ao comunicar com o servidor.';
      // Sessão expirada em uma tela interna: volta para o login
      if (res.status === 401 && token && path !== '/login' && path !== '/logout') {
        localStorage.removeItem('ecostock_token');
        localStorage.removeItem('ecostock_user');
        window.location.href = 'login.html';
      }
      throw new ApiError(message, res.status);
    }
    return data;
  },

  get(path) { return this.request(path); },
  post(path, body) { return this.request(path, { method: 'POST', body: body || {} }); },
  put(path, body) { return this.request(path, { method: 'PUT', body: body || {} }); },
  del(path) { return this.request(path, { method: 'DELETE' }); },

  // Atalhos usados pela landing page, login e dashboard
  signup(payload) { return this.post('/signup', payload); },
  login(payload) { return this.post('/login', payload); },
  demo(payload) { return this.post('/demo', payload); },
  dashboardSummary() { return this.get('/dashboard/summary'); }
};
