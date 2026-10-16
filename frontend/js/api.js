// ---------------------------------------------------------------------------
// Api — ponto único de acesso aos dados de cadastro/login/demo/dashboard.
//
// Tenta falar com o back-end real (Node + Express, /backend/server.js) em
// http://localhost:3000. Se o servidor não estiver rodando — que é a causa
// do erro "Failed to fetch" — cai automaticamente no MockAPI (mock-api.js),
// que simula as mesmas respostas usando localStorage. Assim o site nunca
// trava por causa do back-end estar offline.
// ---------------------------------------------------------------------------

const API_BASE_URL = 'http://localhost:3000/api';
const API_TIMEOUT_MS = 4000;

// Faz a chamada real. Retorna os dados em caso de sucesso, lança ApiError em
// caso de erro de negócio (400/401/409...), ou retorna `null` quando o
// servidor está simplesmente inacessível (para o chamador usar o mock).
async function realRequest(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });

    let data = {};
    try { data = await res.json(); } catch { /* resposta sem corpo JSON */ }

    if (!res.ok) {
      throw new ApiError(data.error || 'Erro ao comunicar com o servidor.', res.status);
    }
    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err; // erro de negócio do back-end real: repassa
    // Qualquer outra falha aqui é "servidor inacessível": rede, CORS, timeout, DNS etc.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const Api = {
  async signup(payload) {
    const result = await realRequest('/signup', { method: 'POST', body: JSON.stringify(payload) });
    if (result !== null) return result;
    const mockResult = await MockAPI.signup(payload);
    return { ...mockResult, _mock: true };
  },

  async login(payload) {
    const result = await realRequest('/login', { method: 'POST', body: JSON.stringify(payload) });
    if (result !== null) return result;
    const mockResult = await MockAPI.login(payload);
    return { ...mockResult, _mock: true };
  },

  async demo(payload) {
    const result = await realRequest('/demo', { method: 'POST', body: JSON.stringify(payload) });
    if (result !== null) return result;
    return MockAPI.demo(payload);
  },

  async dashboardSummary(token) {
    const result = await realRequest('/dashboard/summary', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (result !== null) return result;
    return MockAPI.dashboardSummary(token);
  }
};
