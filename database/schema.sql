-- Estrutura inicial do banco do EcoStock (MySQL).

CREATE DATABASE IF NOT EXISTS ecostock
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ecostock;

CREATE TABLE IF NOT EXISTS estabelecimento (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuario (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  estabelecimento_id INT UNSIGNED NOT NULL,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuario_estabelecimento
    FOREIGN KEY (estabelecimento_id) REFERENCES estabelecimento(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS produto (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  estabelecimento_id INT UNSIGNED NOT NULL,
  nome VARCHAR(120) NOT NULL,
  categoria VARCHAR(80),
  unidade VARCHAR(12) NOT NULL DEFAULT 'un',
  preco_venda DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  custo_unitario DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_produto_estabelecimento
    FOREIGN KEY (estabelecimento_id) REFERENCES estabelecimento(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_produto_preco_venda CHECK (preco_venda >= 0),
  CONSTRAINT chk_produto_custo CHECK (custo_unitario >= 0),
  INDEX idx_produto_estabelecimento (estabelecimento_id, nome)
);

CREATE TABLE IF NOT EXISTS lote (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  produto_id INT UNSIGNED NOT NULL,
  codigo VARCHAR(40),
  quantidade_recebida DECIMAL(10,3) NOT NULL,
  quantidade_atual DECIMAL(10,3) NOT NULL,
  data_validade DATE NOT NULL,
  data_entrada DATE NOT NULL,
  CONSTRAINT fk_lote_produto
    FOREIGN KEY (produto_id) REFERENCES produto(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_lote_quantidade_recebida CHECK (quantidade_recebida > 0),
  CONSTRAINT chk_lote_quantidade_atual CHECK (
    quantidade_atual >= 0 AND quantidade_atual <= quantidade_recebida
  ),
  UNIQUE KEY uq_lote_produto_codigo (produto_id, codigo),
  INDEX idx_lote_validade (data_validade, quantidade_atual)
);

CREATE TABLE IF NOT EXISTS alerta (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lote_id INT UNSIGNED NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  mensagem VARCHAR(240) NOT NULL,
  status ENUM('ABERTO', 'RESOLVIDO') NOT NULL DEFAULT 'ABERTO',
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolvido_em DATETIME,
  CONSTRAINT fk_alerta_lote
    FOREIGN KEY (lote_id) REFERENCES lote(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_alerta_lote_status (lote_id, status)
);

CREATE TABLE IF NOT EXISTS promocao (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lote_id INT UNSIGNED NOT NULL,
  desconto_sugerido DECIMAL(5,2) NOT NULL,
  status ENUM('PENDENTE', 'ACEITA', 'RECUSADA') NOT NULL DEFAULT 'PENDENTE',
  criada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decidida_em DATETIME,
  CONSTRAINT fk_promocao_lote
    FOREIGN KEY (lote_id) REFERENCES lote(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_promocao_desconto CHECK (
    desconto_sugerido > 0 AND desconto_sugerido <= 100
  ),
  INDEX idx_promocao_lote_status (lote_id, status)
);

CREATE TABLE IF NOT EXISTS perda (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lote_id INT UNSIGNED NOT NULL,
  usuario_id INT UNSIGNED,
  quantidade DECIMAL(10,3) NOT NULL,
  motivo VARCHAR(180) NOT NULL,
  data_perda DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valor_estimado DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_perda_lote
    FOREIGN KEY (lote_id) REFERENCES lote(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_perda_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuario(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_perda_quantidade CHECK (quantidade > 0),
  CONSTRAINT chk_perda_valor CHECK (valor_estimado >= 0),
  INDEX idx_perda_data (data_perda)
);
