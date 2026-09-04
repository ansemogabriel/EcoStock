// EcoStock — Backend
// API em Node.js + Express: cadastro/login com senha (bcrypt + JWT) e
// endpoints que alimentam a landing page e a área logada (dashboard).
//
// Como rodar:
//   cd backend
//   npm install
//   npm start
// O servidor sobe em http://localhost:3000

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Em produção, defina JWT_SECRET como variável de ambiente real.
const JWT_SECRET = process.env.JWT_SECRET || 'ecostock_dev_secret_change_me';
const JWT_EXPIRES_IN = '7d';

// Onde os dados ficam salvos (arquivos JSON simples, sem banco de dados)
const DATA_DIR = path.join(__dirname, 'data');
const SIGNUPS_FILE = path.join(DATA_DIR, 'signups.json');
const DEMOS_FILE = path.join(DATA_DIR, 'demo-requests.json');

// ---------- Setup ----------
app.use(cors());              // permite o front (rodando em outra porta/origem) chamar a API
app.use(express.json());      // parseia o corpo das requisições como JSON

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(SIGNUPS_FILE)) fs.writeFileSync(SIGNUPS_FILE, '[]');
  if (!fs.existsSync(DEMOS_FILE)) fs.writeFileSync(DEMOS_FILE, '[]');
}
ensureDataFiles();

function readJson(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const isValidEmail = (email) => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, loja: user.loja, plano: user.plano },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function publicUser(user) {
  return { id: user.id, loja: user.loja, email: user.email, plano: user.plano };
}

// Middleware que protege rotas: exige "Authorization: Bearer <token>"
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
}

// ---------- Rotas públicas ----------

// Healthcheck simples
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ecostock-api', time: new Date().toISOString() });
});

// POST /api/signup — cria a conta e já retorna um token (login automático)
app.post('/api/signup', (req, res) => {
  const { loja, email, senha, plano } = req.body || {};

  if (typeof loja !== 'string' || !loja.trim()) {
    return res.status(400).json({ error: 'Informe o nome da loja.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Informe um e-mail válido.' });
  }
  if (typeof senha !== 'string' || senha.length < 6) {
    return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });
  }

  const planosValidos = ['Essencial', 'Profissional', 'Rede'];
  const planoFinal = planosValidos.includes(plano) ? plano : 'Profissional';

  const signups = readJson(SIGNUPS_FILE);

  const jaExiste = signups.some(s => s.email.toLowerCase() === email.toLowerCase());
  if (jaExiste) {
    return res.status(409).json({ error: 'Já existe uma conta com este e-mail. Faça login.' });
  }

  const novoRegistro = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    loja: loja.trim(),
    email: email.trim().toLowerCase(),
    senhaHash: bcrypt.hashSync(senha, 10),
    plano: planoFinal,
    criadoEm: new Date().toISOString()
  };

  signups.push(novoRegistro);
  writeJson(SIGNUPS_FILE, signups);

  // Em produção: aqui entraria o envio de e-mail de boas-vindas,
  // criação do tenant, disparo de evento de analytics, etc.
  const token = issueToken(novoRegistro);
  return res.status(201).json({
    message: 'Conta criada com sucesso.',
    token,
    user: publicUser(novoRegistro)
  });
});

// POST /api/login — autentica com e-mail + senha
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body || {};

  if (typeof email !== 'string' || typeof senha !== 'string' || !email.trim() || !senha) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  const signups = readJson(SIGNUPS_FILE);
  const conta = signups.find(s => s.email.toLowerCase() === email.trim().toLowerCase());

  if (!conta || !bcrypt.compareSync(senha, conta.senhaHash)) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  const token = issueToken(conta);
  return res.json({
    message: 'Login efetuado com sucesso.',
    token,
    user: publicUser(conta)
  });
});

// POST /api/demo — agendamento de demonstração (não exige login)
app.post('/api/demo', (req, res) => {
  const { nome, telefone, negocio } = req.body || {};

  if (typeof nome !== 'string' || !nome.trim()) {
    return res.status(400).json({ error: 'Informe o seu nome.' });
  }
  if (typeof telefone !== 'string' || telefone.trim().length < 8) {
    return res.status(400).json({ error: 'Informe um número de WhatsApp válido.' });
  }

  const negociosValidos = ['Padaria', 'Mercado', 'Açougue', 'Hortifrúti', 'Outro'];
  const negocioFinal = negociosValidos.includes(negocio) ? negocio : 'Outro';

  const demos = readJson(DEMOS_FILE);

  const novoRegistro = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    nome: nome.trim(),
    telefone: telefone.trim(),
    negocio: negocioFinal,
    criadoEm: new Date().toISOString()
  };

  demos.push(novoRegistro);
  writeJson(DEMOS_FILE, demos);

  return res.status(201).json({
    message: 'Demonstração agendada com sucesso.',
    demoRequest: novoRegistro
  });
});

// ---------- Rotas protegidas (exigem login) ----------

// GET /api/me — dados do usuário autenticado
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: { loja: req.user.loja, email: req.user.email, plano: req.user.plano } });
});

// GET /api/dashboard/summary — dados que alimentam a tela de dashboard
app.get('/api/dashboard/summary', requireAuth, (req, res) => {
  // Dados de exemplo (mock). Em produção, viriam de um banco de dados
  // filtrado pela loja do usuário autenticado (req.user.sub).
  res.json({
    loja: req.user.loja,
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
  });
});

// ---------- Rotas administrativas simples ----------

// GET /api/signups — lista os cadastros recebidos (sem expor a senha)
app.get('/api/signups', (req, res) => {
  const signups = readJson(SIGNUPS_FILE).map(publicUser);
  res.json(signups);
});

// GET /api/demo-requests — lista os pedidos de demo
app.get('/api/demo-requests', (req, res) => {
  res.json(readJson(DEMOS_FILE));
});

// 404 para qualquer outra rota de API
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

app.listen(PORT, () => {
  console.log(`EcoStock API rodando em http://localhost:${PORT}`);
});