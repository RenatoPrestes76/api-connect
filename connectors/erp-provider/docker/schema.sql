-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 27 — SIGMA · ERP Seltriva (produção simulada, esquema realista)
-- Dialect: PostgreSQL 15
-- ─────────────────────────────────────────────────────────────────────────────

SET client_encoding = 'UTF8';

-- ── Fornecedores ──────────────────────────────────────────────────────────────
CREATE TABLE fornecedores (
  id              SERIAL PRIMARY KEY,
  codigo          VARCHAR(20)  UNIQUE NOT NULL,
  razao_social    VARCHAR(200) NOT NULL,
  nome_fantasia   VARCHAR(200),
  cnpj            VARCHAR(18),
  email           VARCHAR(100),
  telefone        VARCHAR(20),
  prazo_entrega   INTEGER DEFAULT 7,
  ativo           BOOLEAN     NOT NULL DEFAULT TRUE,
  dt_cadastro     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Grupos de produto ─────────────────────────────────────────────────────────
CREATE TABLE grupos_produto (
  id          SERIAL PRIMARY KEY,
  codigo      VARCHAR(10) UNIQUE NOT NULL,
  descricao   VARCHAR(100) NOT NULL
);

-- ── Produtos ──────────────────────────────────────────────────────────────────
CREATE TABLE produtos (
  id                      SERIAL PRIMARY KEY,
  codigo                  VARCHAR(20)     UNIQUE NOT NULL,
  descricao               VARCHAR(200)    NOT NULL,
  unidade                 VARCHAR(10)     NOT NULL DEFAULT 'UN',
  preco_venda             NUMERIC(15, 4)  NOT NULL DEFAULT 0,
  preco_custo             NUMERIC(15, 4)           DEFAULT 0,
  cod_grupo               INTEGER         REFERENCES grupos_produto(id),
  cod_fornecedor          INTEGER         REFERENCES fornecedores(id),
  ativo                   BOOLEAN         NOT NULL DEFAULT TRUE,
  dt_cadastro             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  dt_alteracao            TIMESTAMPTZ
);

-- ── Depósitos ─────────────────────────────────────────────────────────────────
CREATE TABLE depositos (
  id        SERIAL PRIMARY KEY,
  codigo    VARCHAR(10) UNIQUE NOT NULL,
  descricao VARCHAR(100) NOT NULL,
  ativo     BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── Estoque ───────────────────────────────────────────────────────────────────
CREATE TABLE estoque (
  id                  SERIAL PRIMARY KEY,
  cod_produto         INTEGER        NOT NULL REFERENCES produtos(id),
  cod_deposito        INTEGER        NOT NULL REFERENCES depositos(id),
  qtd_atual           NUMERIC(15, 4) NOT NULL DEFAULT 0,
  qtd_minima          NUMERIC(15, 4)           DEFAULT 0,
  qtd_maxima          NUMERIC(15, 4),
  qtd_reservada       NUMERIC(15, 4)           DEFAULT 0,
  dt_ultima_entrada   TIMESTAMPTZ,
  dt_ultima_saida     TIMESTAMPTZ,
  UNIQUE (cod_produto, cod_deposito)
);

-- ── Clientes ──────────────────────────────────────────────────────────────────
CREATE TABLE clientes (
  id              SERIAL PRIMARY KEY,
  codigo          VARCHAR(20)    UNIQUE NOT NULL,
  razao_social    VARCHAR(200)   NOT NULL,
  nome_fantasia   VARCHAR(200),
  cnpj_cpf        VARCHAR(18),
  tipo_pessoa     CHAR(1)        NOT NULL DEFAULT 'J',  -- J=Jurídica, F=Física
  email           VARCHAR(100),
  telefone        VARCHAR(20),
  endereco        VARCHAR(300),
  cidade          VARCHAR(100),
  estado          CHAR(2),
  cep             VARCHAR(10),
  limite_credito  NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ativo           BOOLEAN        NOT NULL DEFAULT TRUE,
  dt_cadastro     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  dt_alteracao    TIMESTAMPTZ
);

-- ── Usuários ──────────────────────────────────────────────────────────────────
CREATE TABLE usuarios (
  id                  SERIAL PRIMARY KEY,
  login               VARCHAR(50)  UNIQUE NOT NULL,
  nome                VARCHAR(200) NOT NULL,
  email               VARCHAR(100),
  perfil              VARCHAR(20)  NOT NULL DEFAULT 'OPERADOR',
  ativo               BOOLEAN      NOT NULL DEFAULT TRUE,
  dt_cadastro         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  dt_ultimo_acesso    TIMESTAMPTZ
);

-- ── Pedidos ───────────────────────────────────────────────────────────────────
CREATE TABLE pedidos (
  id              SERIAL PRIMARY KEY,
  numero          VARCHAR(20)    UNIQUE NOT NULL,
  cod_cliente     INTEGER        REFERENCES clientes(id),
  cod_usuario     INTEGER        REFERENCES usuarios(id),
  dt_emissao      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  dt_entrega      DATE,
  status          VARCHAR(20)    NOT NULL DEFAULT 'ABERTO',
  valor_bruto     NUMERIC(15, 2) NOT NULL DEFAULT 0,
  valor_desconto  NUMERIC(15, 2) NOT NULL DEFAULT 0,
  valor_total     NUMERIC(15, 2) NOT NULL DEFAULT 0,
  observacoes     TEXT
);

-- ── Itens do pedido ───────────────────────────────────────────────────────────
CREATE TABLE itens_pedido (
  id              SERIAL PRIMARY KEY,
  cod_pedido      INTEGER        NOT NULL REFERENCES pedidos(id),
  cod_produto     INTEGER        NOT NULL REFERENCES produtos(id),
  qtd             NUMERIC(15, 4) NOT NULL,
  preco_unitario  NUMERIC(15, 4) NOT NULL,
  desconto_perc   NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  valor_total     NUMERIC(15, 2) NOT NULL
);

-- ── Movimentos de estoque ─────────────────────────────────────────────────────
CREATE TABLE movimentos_estoque (
  id              SERIAL PRIMARY KEY,
  cod_produto     INTEGER        NOT NULL REFERENCES produtos(id),
  cod_deposito    INTEGER        NOT NULL REFERENCES depositos(id),
  tipo            CHAR(1)        NOT NULL,  -- E=Entrada, S=Saída
  qtd             NUMERIC(15, 4) NOT NULL,
  valor_unitario  NUMERIC(15, 4),
  origem          VARCHAR(20),              -- COMPRA/VENDA/AJUSTE/TRANSFERENCIA
  cod_referencia  INTEGER,
  dt_movimento    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Tabelas de preço ──────────────────────────────────────────────────────────
CREATE TABLE tabelas_preco (
  id          SERIAL PRIMARY KEY,
  cod_produto INTEGER        NOT NULL REFERENCES produtos(id),
  cod_tabela  INTEGER        NOT NULL DEFAULT 1,
  preco       NUMERIC(15, 4) NOT NULL,
  dt_inicio   DATE,
  dt_fim      DATE,
  ativo       BOOLEAN        NOT NULL DEFAULT TRUE
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_produtos_codigo        ON produtos (codigo);
CREATE INDEX idx_produtos_ativo         ON produtos (ativo);
CREATE INDEX idx_produtos_dt_alteracao  ON produtos (dt_alteracao);
CREATE INDEX idx_clientes_codigo        ON clientes (codigo);
CREATE INDEX idx_clientes_ativo         ON clientes (ativo);
CREATE INDEX idx_clientes_dt_alteracao  ON clientes (dt_alteracao);
CREATE INDEX idx_estoque_produto        ON estoque (cod_produto);
CREATE INDEX idx_estoque_deposito       ON estoque (cod_deposito);
CREATE INDEX idx_pedidos_cliente        ON pedidos (cod_cliente);
CREATE INDEX idx_pedidos_status         ON pedidos (status);
CREATE INDEX idx_movimentos_produto     ON movimentos_estoque (cod_produto);
CREATE INDEX idx_movimentos_dt          ON movimentos_estoque (dt_movimento);
