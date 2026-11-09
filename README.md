# EcoStock

**Controle de validade para pequenos comércios.** O EcoStock acompanha a validade de cada lote de mercadoria, avisa antes do vencimento, sugere um desconto e registra o que aconteceu com o produto: vendido, doado ou descartado. O objetivo é reduzir perdas financeiras e o desperdício de alimentos em padarias, mercearias, hortifrútis e pequenos mercados.

Projeto da disciplina **UPX2 – Usina de Projetos Experimentais II** (tema Desenvolvimento Sustentável), curso de Análise e Desenvolvimento de Sistemas do **Centro Universitário Facens**. Relacionado ao **ODS 12 – Consumo e produção responsáveis**.

> **Resumo rápido:** clone o repositório, inicie o MySQL, entre na pasta `backend` e rode `mvn compile exec:java`. Depois abra **http://localhost:8080** e entre com `demo@ecostock.local` / `EcoStockDemo2026!`.

---

## Sumário

1. [O que o sistema faz](#1-o-que-o-sistema-faz)
2. [Tecnologias](#2-tecnologias)
3. [Instalando os pré-requisitos](#3-instalando-os-pré-requisitos)
4. [Clonando e rodando o projeto](#4-clonando-e-rodando-o-projeto)
5. [Testando o sistema passo a passo](#5-testando-o-sistema-passo-a-passo)
6. [Problemas comuns e soluções](#6-problemas-comuns-e-soluções)
7. [Estrutura do projeto](#7-estrutura-do-projeto)
8. [Banco de dados](#8-banco-de-dados)
9. [API](#9-api)
10. [Como contribuir](#10-como-contribuir)
11. [Equipe](#11-equipe)

---

## 1. O que o sistema faz

### Fluxo principal

```
Cadastro do lote  →  Alerta automático  →  Decisão do comerciante  →  Resultado  →  Relatórios e validação
(produto, validade)  (mensagem + desconto)  (aplica ou não a promoção)  (vendido, doado,   (perdas, economia,
                                                                         descartado)       % fora do lixo)
```

Cada passo é gravado com data e hora no histórico do alerta. Esse histórico vira a evidência do uso real do sistema no **Relatório de validação**.

### Telas

| Tela | O que faz |
|---|---|
| **Landing page** (`/`) | Apresenta o EcoStock, os recursos, os planos e permite criar uma conta ou pedir uma demonstração. |
| **Login / cadastro** | Uma conta por loja. A senha é guardada com hash (PBKDF2) e a sessão dura 7 dias. |
| **Dashboard** | Lotes que pedem atenção (vencidos, vencem hoje, vencem em até 7 dias, em dia), valor em risco, economia do mês, produtos salvos, perdas x recuperado por semana e motivos de perda. |
| **Produtos** | Catálogo com categoria, unidade, preço de custo, preço de venda e margem. Mostra o estoque somado e a próxima validade de cada produto. |
| **Lotes / Estoque** | Entrada de mercadoria com quantidade, **data de fabricação** (opcional), data de entrada e validade. Calcula os dias restantes, mostra o saldo e permite atualizar o saldo ou registrar perda. |
| **Vencimentos** | Alertas agrupados por urgência, com a **mensagem do sistema** e a **sugestão de desconto**. O comerciante aplica (ou não) a promoção e registra o **resultado**: quanto foi vendido, doado ou descartado, com uma **observação da equipe**. A aba **Histórico** mostra a linha do tempo de cada alerta. |
| **Promoções** | Sugestões aguardando decisão, promoções em andamento e encerradas, com o valor vendido. |
| **Perdas** | Registro de descarte com motivo e valor de custo. Cada registro dá baixa no lote. |
| **Relatórios** | Valor perdido x recuperado, aproveitamento, **para onde foram os produtos** (vendido, doado, descartado e % que não foi para o lixo), desempenho dos alertas e perdas por motivo e por produto. Filtra por período e categoria e exporta CSV. |
| **Validação** | Relatório para **imprimir ou salvar em PDF** com cada alerta de um período: mensagem emitida, decisão do comerciante, reação da equipe e resultado. |
| **Notificações** | Avisos do sistema (alerta emitido, urgência aumentou) e ações da equipe (promoção, resultado, perda), agrupados por dia, com controle de lidas e não lidas. |
| **Configurações** | Dados da loja, regras de alerta e restauração dos dados de demonstração. |

### Recursos de usabilidade
- **Sidebar verde recolhível:** o botão `|<` deixa só os ícones, e a escolha fica salva. No celular, a sidebar vira um menu no topo.
- **Filtros** em todas as listagens (busca, categoria, situação, período e ordenação), com o contador "Mostrando X de Y" e o botão "Limpar filtros".
- **Paginação** em todas as listagens, com 10, 20 ou 30 itens por página.
- **Janela de confirmação** antes de sair do sistema e antes de ações que não podem ser desfeitas.
- **Layout responsivo**, do computador ao celular.

### Regras de alerta e desconto

Um lote gera alerta quando faltam **7 dias ou menos** para o vencimento. Se o lote muda de faixa, o alerta é atualizado.

| Faixa de validade | Desconto sugerido | Ação sugerida |
|---|---|---|
| 4 a 7 dias | 15% | Promoção leve para acelerar a saída |
| 1 a 3 dias | 30% | Promoção e destaque na prateleira |
| Vence hoje | 50% | Última chance de venda |
| Vencido | — | Retirar da venda e registrar o descarte (não pode ser vendido nem doado) |

---

## 2. Tecnologias

| Camada | Tecnologia |
|---|---|
| Back-end | **Java 17+**, servidor HTTP do próprio JDK, **Maven**, Gson, MySQL Connector/J |
| Banco de dados | **MySQL 8+** |
| Front-end | HTML, CSS e JavaScript puros (sem framework), servidos pelo próprio back-end |
| Ferramentas | VS Code, Git/GitHub, Figma (protótipos), Trello (organização) |

> Não é preciso instalar Node.js. Os arquivos `backend/server.js` e `backend/api.js` são de uma versão antiga em Node e **não são usados**.

---

## 3. Instalando os pré-requisitos

Você vai precisar de **Git**, **Java 17 ou superior**, **Maven** e **MySQL 8 ou superior**.

### macOS (com Homebrew)

```bash
# Homebrew (se ainda não tiver): https://brew.sh
brew install git openjdk@21 maven mysql

# Inicia o MySQL e deixa ligado sempre que o Mac iniciar
brew services start mysql
```

No Homebrew, o MySQL vem com o usuário `root` **sem senha**, que é o padrão que o EcoStock usa.

### Windows

1. **Git:** https://git-scm.com/download/win
2. **Java (JDK 17 ou 21):** https://adoptium.net. Na instalação, marque **"Set JAVA_HOME"** e **"Add to PATH"**.
3. **Maven:** baixe o `.zip` em https://maven.apache.org/download.cgi, extraia (ex.: `C:\maven`) e adicione `C:\maven\bin` à variável `PATH`.
4. **MySQL:** https://dev.mysql.com/downloads/installer. Escolha **MySQL Server** e **anote a senha do `root`** definida na instalação. Deixe o serviço configurado para iniciar com o Windows.

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y git openjdk-21-jdk maven mysql-server
sudo systemctl start mysql
```

No Ubuntu, o `root` do MySQL usa autenticação do sistema. Crie um usuário próprio para o EcoStock:

```bash
sudo mysql -e "CREATE USER 'ecostock'@'localhost' IDENTIFIED BY 'ecostock123';
GRANT ALL PRIVILEGES ON ecostock.* TO 'ecostock'@'localhost'; FLUSH PRIVILEGES;"
```

Depois, rode o projeto com `DB_USER=ecostock DB_PASSWORD=ecostock123` (veja a seção 4).

### Conferindo as instalações

```bash
git --version     # qualquer versão
java -version     # precisa ser 17 ou maior
mvn -v            # Apache Maven 3.x
mysql --version   # 8.x ou maior
```

---

## 4. Clonando e rodando o projeto

### 4.1 Clonar o repositório

```bash
git clone https://github.com/ansemogabriel/EcoStock.git
cd EcoStock
```

### 4.2 Garantir que o MySQL está rodando

| Sistema | Comando |
|---|---|
| macOS | `brew services start mysql` |
| Windows | Abra **Serviços** e inicie o **MySQL80**, ou rode `net start MySQL80` como administrador |
| Linux | `sudo systemctl start mysql` |

**Não é preciso criar o banco nem rodar scripts SQL.** O back-end cria tudo sozinho.

### 4.3 Subir o EcoStock

Entre na pasta `backend` e rode o servidor:

**Se o `root` do MySQL não tem senha** (padrão no macOS com Homebrew):
```bash
cd backend
mvn compile exec:java
```

**Se o MySQL tem senha:**

macOS / Linux:
```bash
cd backend
DB_PASSWORD=sua_senha mvn compile exec:java
```

Windows (PowerShell):
```powershell
cd backend
$env:DB_PASSWORD="sua_senha"
mvn compile exec:java
```

Windows (Prompt de Comando):
```cmd
cd backend
set DB_PASSWORD=sua_senha
mvn compile exec:java
```

> A primeira execução demora um pouco mais, porque o Maven baixa as dependências.

### 4.4 Conferir se subiu

No terminal, devem aparecer estas linhas:

```
Banco de dados pronto (../database/schema.sql).
Conta de demonstração criada: demo@ecostock.local / EcoStockDemo2026!

EcoStock rodando em http://localhost:8080
Conta demo: demo@ecostock.local / EcoStockDemo2026!
```

Na primeira execução, o servidor:
1. cria o banco `ecostock` e todas as tabelas (a partir de `database/schema.sql`);
2. cria a **conta de demonstração**, com 15 produtos, lotes em todas as faixas de validade e o histórico das últimas semanas;
3. serve o site e a API no mesmo endereço.

Para testar se o servidor e o banco estão funcionando:
```bash
curl http://localhost:8080/api/health
# {"status":"ok","banco":"conectado"}
```

Abra **http://localhost:8080** no navegador.

### 4.5 Parar o servidor

No terminal onde ele está rodando, aperte **`Ctrl + C`**.

### 4.6 Variáveis de ambiente (opcionais)

| Variável | Padrão | Para que serve |
|---|---|---|
| `PORT` | `8080` | Porta do servidor |
| `DB_URL` | `jdbc:mysql://localhost:3306/ecostock?...` | Endereço do MySQL |
| `DB_USER` | `root` | Usuário do MySQL |
| `DB_PASSWORD` | *(vazio)* | Senha do MySQL |

Exemplo usando outra porta: `PORT=9090 mvn compile exec:java`, e depois abra http://localhost:9090.

### 4.7 Atualizar o projeto depois

```bash
cd EcoStock
git pull
cd backend
mvn compile exec:java
```

Mudanças no banco (tabelas ou colunas novas) são aplicadas automaticamente, **sem apagar os dados**.

---

## 5. Testando o sistema passo a passo

### Contas de acesso

| Conta | E-mail | Senha |
|---|---|---|
| Demonstração (já tem dados) | `demo@ecostock.local` | `EcoStockDemo2026!` |
| Sua própria loja | Crie em **Começar grátis** na landing page | A que você definir (mínimo 6 caracteres) |

> **Antes de testar ou gravar uma apresentação:** entre com a conta demo e vá em **Configurações → Restaurar dados de demonstração**. As validades são recalculadas a partir do dia de hoje.

### Roteiro completo de teste

**1. Landing page e cadastro**
1. Abra http://localhost:8080 e navegue pelas seções.
2. Clique em **Começar grátis** e crie uma conta (opcional). Você entra direto no painel da sua loja, que começa vazia.
3. Para seguir com dados prontos, saia (o sistema pede confirmação) e entre com a conta demo.

**2. Dashboard**
1. Confira o bloco "lotes pedem atenção", com a linha da validade (vencidos → hoje → até 7 dias → em dia).
2. Confira o valor em risco, a economia do mês, os produtos salvos e os gráficos.
3. O sino no topo leva às Notificações.

**3. Produtos**
1. Clique em **Novo produto** e cadastre, por exemplo, "Coxinha", categoria "Salgados", unidade `un`, custo `2,10`, venda `6,50`. A margem é calculada na hora.
2. Teste a busca, o filtro de categoria e a ordenação.
3. Clique em **Editar** e altere o preço.

**4. Lotes**
1. Na Coxinha, clique em **Novo lote** (ou use o botão do topo da tela de Lotes).
2. Informe quantidade `30`, fabricação de ontem, entrada de hoje e **validade daqui a 2 dias**.
3. A prévia mostra: "Ao salvar, o EcoStock emite um alerta com sugestão de 30% de desconto". Salve.
4. Teste os filtros por faixa de validade, o "Mostrar lotes sem estoque", **Saldo** (atualizar o saldo) e **Perda**.

**5. Vencimentos: o fluxo principal**
1. O alerta da Coxinha aparece em **"Vencem em 1 a 3 dias"**, com a mensagem do sistema, por exemplo: *"Coxinha (lote …) vence em 2 dias. 30 un em estoque, R$ 63,00 em risco."*
2. Ajuste o desconto, se quiser, e clique em **Aplicar promoção**. A trilha marca "Decisão: Promoção de 30% aplicada".
3. Clique em **Registrar resultado** e informe, por exemplo, **Vendido 20**, **Doado 5** (instituição opcional) e **Descartado 2** (motivo). Escreva a observação: *"Colocamos na vitrine da frente e avisamos os clientes no caixa."*
4. O alerta vai para o **Histórico**, com a linha do tempo completa: emitido, sugestão, promoção aplicada, resultado e observação.
5. Teste um produto **vencido** (ex.: Presunto Cozido na conta demo): o sistema só permite registrar o descarte.

**6. Promoções**
- Veja as abas Aguardando decisão, Em andamento e Encerradas, com o valor vendido em cada promoção.

**7. Perdas**
1. Clique em **Registrar perda**, escolha um lote, a quantidade e o motivo.
2. O saldo do lote baixa e a perda entra nos totais. Teste os filtros por motivo e por origem (alerta ou manual).

**8. Relatórios**
1. Veja o painel **"Para onde foram os produtos"**, com vendido, doado, descartado e o percentual que não foi para o lixo.
2. Mude o período e a categoria. Clique em **Exportar perdas (CSV)**.

**9. Validação**
1. Escolha o período (atalhos ou datas De/Até).
2. Cada alerta aparece como uma ficha: **1) alerta emitido** (mensagem exata) → **2) decisão** → **3) reação da equipe** → **4) resultado**.
3. Clique em **Imprimir ou salvar PDF** e escolha "Salvar como PDF" na janela de impressão.

**10. Notificações**
1. Veja os avisos agrupados por dia, com as abas Não lidas e Todas.
2. Clique em **Abrir alerta** para ir direto ao alerta. Clique em **Marcar todas como lidas**.

**11. Sidebar e configurações**
1. Clique em `|<` para recolher a sidebar e em `|>` para expandir.
2. Em **Configurações**, veja as regras de alerta. Use **Restaurar dados de demonstração** quando quiser recomeçar.

### Testando pela API (opcional)

```bash
# Login e token
TOKEN=$(curl -s -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@ecostock.local","senha":"EcoStockDemo2026!"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')

# Dashboard e alertas abertos
curl -s http://localhost:8080/api/dashboard/summary -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:8080/api/alertas -H "Authorization: Bearer $TOKEN"
```

---

## 6. Problemas comuns e soluções

| Problema | Causa provável | Solução |
|---|---|---|
| `Não foi possível acessar o banco de dados` ou `Access denied for user 'root'` | A senha do MySQL não confere | Rode com `DB_PASSWORD=sua_senha` (seção 4.3). No Homebrew, o padrão é sem senha. |
| `Communications link failure` | O MySQL não está rodando | Inicie o MySQL (seção 4.2). |
| `Address already in use` | A porta 8080 já está ocupada | Feche o outro servidor ou use `PORT=9090`. No macOS/Linux, `lsof -i :8080` mostra quem está usando a porta. |
| `mvn: command not found` | O Maven não está instalado ou não está no PATH | Instale o Maven (seção 3) e abra um terminal novo. |
| `release version 17 not supported` | O Java é anterior ao 17 | Instale o JDK 17 ou 21 e confira com `java -version`. |
| `Arquivo database/schema.sql não encontrado` | O servidor foi iniciado fora da pasta `backend` | Rode `cd backend` antes de `mvn compile exec:java`. |
| A página abre, mas mostra "Não foi possível conectar ao servidor" | O back-end não está rodando, ou a página foi aberta direto do arquivo | Suba o back-end e acesse sempre **http://localhost:8080**. |
| A tela mostra algo antigo depois de um `git pull` | Cache do navegador | Recarregue com `Ctrl+Shift+R` (Windows/Linux) ou `Cmd+Shift+R` (macOS). |
| A sessão expirou e voltou para o login | A sessão dura 7 dias | Entre de novo. |
| Quero apagar tudo e começar do zero | — | Na conta demo, use **Configurações → Restaurar dados de demonstração**. Para apagar o banco inteiro: `mysql -u root -e "DROP DATABASE ecostock;"` e suba o servidor de novo. |

---

## 7. Estrutura do projeto

```
EcoStock/
├── README.md
├── database/
│   └── schema.sql                 # estrutura do banco (executada automaticamente)
├── backend/                       # API e servidor (Java + Maven)
│   ├── pom.xml
│   └── src/main/java/br/com/ecostock/
│       ├── Main.java              # inicialização e rotas da API
│       ├── Database.java          # conexão com o MySQL
│       ├── db/
│       │   ├── Sql.java           # utilitário de consultas (linhas → JSON)
│       │   └── Migracao.java      # cria/atualiza tabelas ao iniciar
│       ├── http/
│       │   ├── Router.java        # roteamento, autenticação e erros
│       │   ├── Req.java           # leitura de parâmetros e corpo JSON
│       │   ├── ApiException.java  # erros com mensagem para a tela
│       │   └── StaticHandler.java # entrega os arquivos do front-end
│       └── service/
│           ├── AuthService.java          # cadastro, login, sessão
│           ├── EstoqueService.java       # produtos e lotes
│           ├── AlertaService.java        # alertas, decisão, resultado, validação
│           ├── PerdaService.java         # perdas
│           ├── PainelService.java        # dashboard, relatórios, promoções
│           ├── NotificacaoService.java   # notificações
│           ├── DemoService.java          # conta e dados de demonstração
│           └── Fmt.java                  # formatação em português (R$, quantidades)
└── frontend/                      # telas
    ├── index.html                 # landing page
    ├── login.html
    ├── dashboard.html, produtos.html, lotes.html, vencimentos.html,
    │   promocoes.html, perdas.html, relatorios.html, validacao.html,
    │   notificacoes.html, configuracoes.html
    ├── css/
    │   ├── base.css               # design system: cores, fontes, botões, formulários
    │   ├── dashboard.css          # estrutura das telas internas e sidebar
    │   ├── app.css                # tabelas, filtros, paginação, janelas, relatórios
    │   ├── site.css               # landing page
    │   └── auth.css               # login
    ├── js/
    │   ├── api.js                 # comunicação com o back-end
    │   ├── Auth.js                # sessão no navegador
    │   ├── app.js                 # sidebar, filtros, paginação, confirmação, gráficos
    │   └── <tela>.js              # um arquivo por tela
    └── img/                       # logo
```

---

## 8. Banco de dados

O banco é criado e atualizado automaticamente a partir de `database/schema.sql`.

| Tabela | O que guarda |
|---|---|
| `estabelecimento` | A loja (nome e plano) |
| `usuario` | Login da loja (senha em hash) |
| `sessao` | Tokens de acesso |
| `produto` | Catálogo (categoria, unidade, custo, venda) |
| `lote` | Entradas de mercadoria (quantidade, fabricação, entrada, validade, saldo) |
| `alerta` | Alertas de validade (faixa, mensagem, situação, observação da equipe) |
| `alerta_evento` | Histórico de cada alerta: emissão, sugestão, decisão, resultado, observação |
| `promocao` | Desconto sugerido e decisão (pendente, aceita, recusada) |
| `venda_recuperada` | O que foi vendido depois de um alerta |
| `doacao` | O que foi doado (quantidade, instituição, valor de custo) |
| `perda` | Descartes (quantidade, motivo, valor de custo) |
| `pedido_demonstracao` | Pedidos de demonstração feitos na landing page |

---

## 9. API

Base: `http://localhost:8080/api`. Todas as rotas, exceto `health`, `signup`, `login` e `demo`, exigem o cabeçalho `Authorization: Bearer <token>`, recebido no login. Os erros voltam como `{"erro": "mensagem"}`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Verifica o servidor e o banco |
| POST | `/signup` | Cria a loja e o usuário (`loja`, `email`, `senha`, `plano`) |
| POST | `/login` | Entra (`email`, `senha`) e devolve o `token` |
| POST | `/logout` | Encerra a sessão |
| POST | `/demo` | Pedido de demonstração da landing page |
| GET | `/me` | Usuário logado, alertas abertos, notificações não lidas e regras |
| GET | `/dashboard/summary` | Números do dashboard |
| GET / POST | `/produtos` | Lista ou cria produtos |
| PUT / DELETE | `/produtos/{id}` | Edita ou remove (desativa) um produto |
| GET / POST | `/lotes` | Lista (`?todos=1` inclui zerados) ou cria lotes |
| PUT | `/lotes/{id}/saldo` | Atualiza o saldo do lote |
| GET | `/alertas` | Alertas abertos (`?status=historico` para os resolvidos) |
| POST | `/alertas/{id}/decisao` | `{"aplicar": true, "desconto": 30}` |
| POST | `/alertas/{id}/resultado` | `{"vendido", "doado", "descartado", "motivo", "instituicao", "observacao"}` |
| GET | `/promocoes` | Promoções e regras de desconto |
| GET / POST | `/perdas` | Lista (`?dias=30`) ou registra perdas |
| GET | `/relatorios` | Relatórios (`?dias=30&categoria=`) |
| GET | `/validacao` | Relatório de validação (`?de=AAAA-MM-DD&ate=AAAA-MM-DD`) |
| GET | `/notificacoes` | Notificações (`?dias=90`) |
| POST | `/notificacoes/lidas` | Marca todas como lidas |
| POST | `/demo/restaurar` | Restaura os dados da conta demo (só a conta demo) |

---

## 10. Como contribuir

```bash
git switch main
git pull
git switch -c feature/minha-alteracao
# ... altere o código ...
git add .
git commit -m "feat: descrição curta da alteração"
git push -u origin feature/minha-alteracao
```

Depois abra um Pull Request para o `main` no GitHub (ou rode `gh pr create`).

---

## 11. Equipe

| Integrante | RA | Função |
|---|---|---|
| Felipe Luis Moraes Laperutta | RA264068 | Líder do grupo e organização do projeto |
| João Henrique Nascimento de Carvalho | RA263202 | Elaboração e edição da documentação |
| Thaynan Willian Dias | RA240256 | Desenvolvimento da ideia, GitHub e sistema |
| Gabriel Rodrigues de Paula Anselmo | RA264538 | Landing page, persona e canvas de proposta de valor |

**Orientadora:** Profa. Brenda Medina de Oliveira
