// ---------------------------------------------------------------------------
// MockAPI — um "back-end de bolso" que roda 100% no navegador (localStorage).
//
// Ele existe só para o site continuar funcionando quando o back-end real
// (pasta /backend, Node + Express) não está rodando. A camada Api (api.js)
// tenta falar com http://localhost:3000 primeiro; se não conseguir, usa
// este arquivo como substituto automático — sem o usuário perceber.
//
// IMPORTANTE: aqui a senha é guardada em texto simples no localStorage do
// próprio navegador. Isso é aceitável apenas porque é um modo de demonstração
// local. Quando o back-end real estiver rodando, ele usa bcrypt + JWT de
// verdade (veja backend/server.js) e este arquivo deixa de ser usado.
// ---------------------------------------------------------------------------

const MOCK_SIGNUPS_KEY = 'ecostock_mock_signups';
const MOCK_DEMOS_KEY = 'ecostock_mock_demos';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function mockReadSignups() {
  try { return JSON.parse(localStorage.getItem(MOCK_SIGNUPS_KEY)) || []; }
  catch { return []; }
}
function mockWriteSignups(list) {
  localStorage.setItem(MOCK_SIGNUPS_KEY, JSON.stringify(list));
}
function mockReadDemos() {
  try { return JSON.parse(localStorage.getItem(MOCK_DEMOS_KEY)) || []; }
  catch { return []; }
}
function mockWriteDemos(list) {
  localStorage.setItem(MOCK_DEMOS_KEY, JSON.stringify(list));
}

const mockIsValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
const mockGenId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function mockB64Encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function mockB64Decode(str) {
  return decodeURIComponent(escape(atob(str)));
}

function mockIssueToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    loja: user.loja,
    plano: user.plano,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 dias
  };
  return 'mock.' + mockB64Encode(JSON.stringify(payload));
}

function mockVerifyToken(token) {
  if (!token || !token.startsWith('mock.')) return null;
  try {
    const payload = JSON.parse(mockB64Decode(token.slice(5)));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function mockPublicUser(user) {
  return { id: user.id, loja: user.loja, email: user.email, plano: user.plano };
}

const MockAPI = {
  async signup({ loja, email, senha, plano }) {
    if (!loja || !loja.trim()) throw new ApiError('Informe o nome da loja.', 400);
    if (!email || !mockIsValidEmail(email)) throw new ApiError('Informe um e-mail válido.', 400);
    if (!senha || senha.length < 6) throw new ApiError('A senha precisa ter pelo menos 6 caracteres.', 400);

    const planosValidos = ['Essencial', 'Profissional', 'Rede'];
    const planoFinal = planosValidos.includes(plano) ? plano : 'Profissional';

    const signups = mockReadSignups();
    if (signups.some(s => s.email.toLowerCase() === email.toLowerCase())) {
      throw new ApiError('Já existe uma conta com este e-mail. Faça login.', 409);
    }

    const novoRegistro = {
      id: mockGenId(),
      loja: loja.trim(),
      email: email.trim().toLowerCase(),
      senha, // modo local apenas — veja aviso no topo do arquivo
      plano: planoFinal,
      criadoEm: new Date().toISOString()
    };

    signups.push(novoRegistro);
    mockWriteSignups(signups);

    return {
      message: 'Conta criada com sucesso (modo local).',
      token: mockIssueToken(novoRegistro),
      user: mockPublicUser(novoRegistro)
    };
  },

  async login({ email, senha }) {
    if (!email || !senha) throw new ApiError('Informe e-mail e senha.', 400);

    const signups = mockReadSignups();
    const conta = signups.find(s => s.email.toLowerCase() === (email || '').trim().toLowerCase());

    if (!conta || conta.senha !== senha) {
      throw new ApiError('E-mail ou senha incorretos.', 401);
    }

    return {
      message: 'Login efetuado com sucesso (modo local).',
      token: mockIssueToken(conta),
      user: mockPublicUser(conta)
    };
  },

  async demo({ nome, telefone, negocio }) {
    if (!nome || !nome.trim()) throw new ApiError('Informe o seu nome.', 400);
    if (!telefone || telefone.trim().length < 8) throw new ApiError('Informe um número de WhatsApp válido.', 400);

    const negociosValidos = ['Padaria', 'Mercado', 'Açougue', 'Hortifrúti', 'Outro'];
    const negocioFinal = negociosValidos.includes(negocio) ? negocio : 'Outro';

    const demos = mockReadDemos();
    const novoRegistro = {
      id: mockGenId(),
      nome: nome.trim(),
      telefone: telefone.trim(),
      negocio: negocioFinal,
      criadoEm: new Date().toISOString()
    };
    demos.push(novoRegistro);
    mockWriteDemos(demos);

    return { message: 'Demonstração agendada com sucesso (modo local).', demoRequest: novoRegistro };
  },

  async dashboardSummary(token) {
    const payload = mockVerifyToken(token);
    if (!payload) throw new ApiError('Sessão expirada. Faça login novamente.', 401);

    // Dados de exemplo — no back-end real isso viria de um banco de verdade.
    return {
      loja: payload.loja,
      produtosCadastrados: 248,
      proximosVencimento: 16,
      vencendoHoje: 3,
      vencidos: 2,
      valorEmRisco: 487.50,
      economiaNoMes: 1240.00,
      produtosSalvos: 63,
      resumoMes: [
        { mes: '01/08', perdas: 210, recuperado: 90 },
        { mes: '08/08', perdas: 140, recuperado: 260 },
        { mes: '15/08', perdas: 260, recuperado: 120 },
        { mes: '22/08', perdas: 90, recuperado: 310 },
        { mes: '29/08', perdas: 180, recuperado: 200 }
      ],
      motivosPerdas: [
        { motivo: 'Vencido', percentual: 45 },
        { motivo: 'Danificado', percentual: 30 },
        { motivo: 'Excesso de estoque', percentual: 15 },
        { motivo: 'Armazenamento', percentual: 10 }
      ]
    };
  }
};
