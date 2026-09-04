const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.post('/api/signup', (request, response) => {
  const { loja, email, plano } = request.body;

  if (!loja || !email || !plano) {
    return response.status(400).json({ error: 'loja, email e plano sao obrigatorios' });
  }

  return response.status(201).json({ message: 'Cadastro recebido', loja, email, plano });
});

app.post('/api/demo', (request, response) => {
  const { nome, telefone, negocio } = request.body;

  if (!nome || !telefone || !negocio) {
    return response.status(400).json({ error: 'nome, telefone e negocio sao obrigatorios' });
  }

  return response.status(201).json({ message: 'Pedido de demonstracao recebido', nome, telefone, negocio });
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Rota nao encontrada' });
});

app.listen(port, () => {
  console.log(`EcoStock API running on port ${port}`);
});