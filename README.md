# EcoStock

**Sistema de controle de validade para pequenos comércios.** O EcoStock acompanha a validade de cada lote, emite alertas antes do vencimento, sugere promoções e registra o que foi vendido, doado ou descartado, para reduzir perdas e o desperdício de alimentos.

Projeto da disciplina **UPX2 – Usina de Projetos Experimentais II** (Desenvolvimento Sustentável), curso de Análise e Desenvolvimento de Sistemas do **Centro Universitário Facens**. Relacionado ao **ODS 12 – Consumo e produção responsáveis**.

---

## O que o sistema faz

| Tela | O que faz |
|---|---|
| **Landing page** | Apresenta o EcoStock, os planos e permite criar uma conta. |
| **Login / cadastro** | Conta por loja, com senha protegida por hash (PBKDF2) e sessão com validade. |
| **Dashboard** | Lotes que pedem atenção (vencidos, vencem hoje, próximos 7 dias), valor em risco, economia do mês e gráficos de perdas. |
| **Produtos** | Catálogo com categoria, unidade, preço de custo e de venda e margem. |
| **Lotes / Estoque** | Entrada de mercadoria com quantidade, data de fabricação, data de entrada e validade. Os dias restantes são calculados automaticamente. |
| **Vencimentos** | Alertas automáticos agrupados por urgência, com a mensagem do sistema e a sugestão de desconto. O comerciante **decide** (aplica ou não a promoção) e registra o **resultado**: quanto foi vendido, doado ou descartado, com uma observação da equipe. A aba **Histórico** mostra a linha do tempo de cada alerta. |
| **Promoções** | Sugestões de desconto, promoções em andamento e encerradas, com o valor vendido. |
| **Perdas** | Registro de descarte com motivo e valor de custo perdido. Cada registro dá baixa no lote. |
| **Relatórios** | Valor perdido x recuperado, aproveitamento, destino dos produtos (vendido, doado, descartado), desempenho dos alertas e perdas por motivo e por produto. Exporta CSV. |
| **Validação** | Relatório para imprimir ou salvar em PDF com cada alerta do período: mensagem emitida, decisão do comerciante, reação da equipe e resultado. É a evidência do uso real do sistema. |
| **Notificações** | Avisos do sistema e ações da equipe, com controle de lidas e não lidas. |
| **Configurações** | Dados da loja, regras de alerta e restauração dos dados de demonstração. |

Todas as listagens têm filtros, ordenação e paginação (10, 20 ou 30 itens por página).

### Regras de alerta e desconto

| Faixa de validade | Desconto sugerido | Ação |
|---|---|---|
| 4 a 7 dias | 15% | Promoção leve para acelerar a saída |
| 1 a 3 dias | 30% | Promoção e destaque na prateleira |
| Vence hoje | 50% | Última chance de venda |
| Vencido | — | Retirar da venda e registrar o descarte |

---

## Tecnologias

- **Back-end:** Java 17+ (servidor HTTP do próprio JDK), Maven, Gson
- **Banco de dados:** MySQL 8+
- **Front-end:** HTML, CSS e JavaScript puros (sem framework), servidos pelo próprio back-end

---

## Como rodar localmente

### Pré-requisitos
- Java 17 ou superior
- Maven
- MySQL rodando em `localhost:3306` (usuário `root`, sem senha, por padrão)

No macOS com Homebrew:
```bash
brew install mysql maven
brew services start mysql
```

### Subir o sistema
```bash
cd backend
mvn compile exec:java
```

Ao iniciar, o back-end:
1. cria o banco `ecostock` e todas as tabelas (a partir de `database/schema.sql`);
2. cria a **conta de demonstração** com produtos, lotes e histórico;
3. serve o site e a API em **http://localhost:8080**.

Abra **http://localhost:8080** no navegador.

### Conta de demonstração
- **E-mail:** `demo@ecostock.local`
- **Senha:** `EcoStockDemo2026!`

Para voltar aos dados iniciais, use **Configurações → Restaurar dados de demonstração**.

### Variáveis de ambiente (opcionais)
| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `8080` | Porta do servidor |
| `DB_URL` | `jdbc:mysql://localhost:3306/ecostock?...` | Conexão com o MySQL |
| `DB_USER` | `root` | Usuário do MySQL |
| `DB_PASSWORD` | *(vazio)* | Senha do MySQL |

Exemplo com senha: `DB_PASSWORD=minhasenha mvn compile exec:java`

---

## Como testar o fluxo principal

1. Entre com a conta demo.
2. **Produtos → Novo produto:** cadastre um produto (ex.: "Coxinha", custo 2,10, venda 6,50).
3. **Lotes → Novo lote:** escolha o produto, informe a quantidade, a fabricação e uma validade daqui a 2 dias. A prévia mostra o alerta que será gerado.
4. **Vencimentos:** o alerta aparece com a mensagem do sistema e a sugestão de 30%.
   - Clique em **Aplicar promoção** (o desconto pode ser ajustado).
   - Clique em **Registrar resultado**: informe vendido, doado e descartado e escreva a observação da equipe.
5. **Vencimentos → Histórico:** veja a linha do tempo completa do alerta.
6. **Validação:** escolha o período e clique em **Imprimir ou salvar PDF**.
7. **Relatórios:** confira o destino dos produtos e o aproveitamento.

---

## Estrutura do projeto

```
EcoStock/
├── backend/                     # API e servidor (Java + Maven)
│   ├── pom.xml
│   └── src/main/java/br/com/ecostock/
│       ├── Main.java            # rotas da API e inicialização
│       ├── Database.java        # conexão com o MySQL
│       ├── db/                  # Sql (acesso a dados) e Migracao (cria/atualiza tabelas)
│       ├── http/                # Router, Req, ApiException, StaticHandler (site)
│       └── service/             # regras de negócio
│           ├── AuthService      # cadastro, login, sessão
│           ├── EstoqueService   # produtos e lotes
│           ├── AlertaService    # alertas, decisão, resultado, validação
│           ├── PerdaService     # perdas
│           ├── PainelService    # dashboard, relatórios, promoções
│           ├── NotificacaoService
│           └── DemoService      # conta e dados de demonstração
├── database/
│   └── schema.sql               # estrutura do banco
└── frontend/                    # telas (HTML, CSS, JS)
    ├── css/                     # base.css (design system), dashboard.css, app.css, site.css, auth.css
    ├── js/                      # api.js, app.js (estrutura comum) e um arquivo por tela
    └── img/                     # logo
```

### Banco de dados
Entidades principais: `estabelecimento`, `usuario`, `sessao`, `produto`, `lote`, `alerta`, `alerta_evento` (histórico de cada alerta), `promocao`, `venda_recuperada`, `doacao`, `perda` e `pedido_demonstracao`.

### API (resumo)
Todas as rotas, exceto cadastro, login e saúde, exigem o cabeçalho `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Verifica servidor e banco |
| POST | `/api/signup` · `/api/login` · `/api/logout` | Conta e sessão |
| GET | `/api/me` | Usuário logado, alertas abertos e notificações não lidas |
| GET | `/api/dashboard/summary` | Números do dashboard |
| GET/POST/PUT/DELETE | `/api/produtos` | Catálogo |
| GET/POST | `/api/lotes` · PUT `/api/lotes/{id}/saldo` | Lotes e saldo |
| GET | `/api/alertas` (`?status=historico`) | Alertas abertos ou resolvidos |
| POST | `/api/alertas/{id}/decisao` | Aplicar ou não a promoção |
| POST | `/api/alertas/{id}/resultado` | Vendido, doado, descartado e observação |
| GET | `/api/promocoes` | Promoções |
| GET/POST | `/api/perdas` | Perdas |
| GET | `/api/relatorios` (`?dias=&categoria=`) | Relatórios |
| GET | `/api/validacao` (`?de=&ate=`) | Relatório de validação |
| GET | `/api/notificacoes` · POST `/api/notificacoes/lidas` | Notificações |

---

## Equipe

| Integrante | RA | Função |
|---|---|---|
| Felipe Luis Moraes Laperutta | RA264068 | Líder do grupo e organização do projeto |
| João Henrique Nascimento de Carvalho | RA263202 | Documentação |
| Thaynan Willian Dias | RA240256 | Desenvolvimento da ideia, GitHub e sistema |
| Gabriel Rodrigues de Paula Anselmo | RA264538 | Landing page, persona e canvas |

**Orientadora:** Profa. Brenda Medina de Oliveira
