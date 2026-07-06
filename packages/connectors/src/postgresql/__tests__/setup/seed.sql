-- Atlas Connect — PostgreSQL test seed
-- Creates a minimal schema that exercises all discovery paths:
--   schemas, tables, columns (all types), PKs, FKs, indexes,
--   views, materialized views, sequences, enums, comments

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Schema ──────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS vendas;

-- ─── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE public.status_pedido AS ENUM ('pendente', 'aprovado', 'cancelado', 'entregue');
CREATE TYPE vendas.categoria_produto AS ENUM ('eletronico', 'vestuario', 'alimento', 'outro');

-- ─── Sequences ───────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.produto_seq START 1000 INCREMENT 1;

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- Cliente
CREATE TABLE public.cliente (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        VARCHAR(200) NOT NULL,
  email       VARCHAR(200) NOT NULL UNIQUE,
  cpf         CHAR(11),
  telefone    VARCHAR(20),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
COMMENT ON TABLE  public.cliente         IS 'Cadastro de clientes';
COMMENT ON COLUMN public.cliente.cpf     IS 'CPF sem formatação (apenas dígitos)';
COMMENT ON COLUMN public.cliente.email   IS 'E-mail principal do cliente';

-- Produto
CREATE TABLE public.produto (
  id            BIGINT       PRIMARY KEY DEFAULT nextval('produto_seq'),
  sku           VARCHAR(50)  NOT NULL UNIQUE,
  descricao     TEXT         NOT NULL,
  preco_custo   NUMERIC(12,2),
  preco_venda   NUMERIC(12,2) NOT NULL,
  estoque       INTEGER       NOT NULL DEFAULT 0,
  categoria     vendas.categoria_produto,
  ativo         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE  public.produto              IS 'Catálogo de produtos';
COMMENT ON COLUMN public.produto.preco_venda  IS 'Preço de venda com IPI';
COMMENT ON COLUMN public.produto.preco_custo  IS 'Custo de aquisição';
COMMENT ON COLUMN public.produto.estoque      IS 'Saldo disponível em estoque';

-- Filial
CREATE TABLE public.filial (
  id      SERIAL       PRIMARY KEY,
  nome    VARCHAR(100) NOT NULL,
  cnpj    CHAR(14)     UNIQUE,
  cidade  VARCHAR(100),
  estado  CHAR(2)
);

-- Pedido
CREATE TABLE public.pedido (
  id          BIGSERIAL    PRIMARY KEY,
  cliente_id  UUID         NOT NULL REFERENCES public.cliente(id) ON DELETE RESTRICT,
  filial_id   INTEGER      REFERENCES public.filial(id),
  status      public.status_pedido NOT NULL DEFAULT 'pendente',
  total       NUMERIC(12,2),
  observacoes TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.pedido IS 'Pedidos de venda';

-- Item do Pedido
CREATE TABLE public.item_pedido (
  id          BIGSERIAL    PRIMARY KEY,
  pedido_id   BIGINT       NOT NULL REFERENCES public.pedido(id) ON DELETE CASCADE,
  produto_id  BIGINT       NOT NULL REFERENCES public.produto(id),
  quantidade  INTEGER      NOT NULL CHECK (quantidade > 0),
  preco_unit  NUMERIC(12,2) NOT NULL,
  desconto    NUMERIC(5,2)  DEFAULT 0,
  UNIQUE(pedido_id, produto_id)
);

-- Estoque por filial
CREATE TABLE public.estoque_filial (
  filial_id   INTEGER  NOT NULL REFERENCES public.filial(id),
  produto_id  BIGINT   NOT NULL REFERENCES public.produto(id),
  quantidade  INTEGER  NOT NULL DEFAULT 0,
  PRIMARY KEY (filial_id, produto_id)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_pedido_cliente    ON public.pedido(cliente_id);
CREATE INDEX idx_pedido_status     ON public.pedido(status);
CREATE INDEX idx_pedido_created    ON public.pedido(created_at DESC);
CREATE INDEX idx_produto_sku       ON public.produto(sku);
CREATE INDEX idx_produto_categoria ON public.produto(categoria);
CREATE INDEX idx_cliente_email     ON public.cliente(email);
CREATE INDEX idx_cliente_cpf       ON public.cliente(cpf) WHERE cpf IS NOT NULL;

-- ─── Views ───────────────────────────────────────────────────────────────────
CREATE VIEW public.vw_pedido_resumo AS
  SELECT
    p.id,
    c.nome           AS cliente_nome,
    c.email          AS cliente_email,
    f.nome           AS filial_nome,
    p.status,
    p.total,
    p.created_at
  FROM public.pedido p
  JOIN public.cliente c ON c.id = p.cliente_id
  LEFT JOIN public.filial f ON f.id = p.filial_id;

COMMENT ON VIEW public.vw_pedido_resumo IS 'Resumo de pedidos com dados de cliente e filial';

-- ─── Materialized View ───────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW public.mv_estoque_consolidado AS
  SELECT
    pr.id           AS produto_id,
    pr.sku,
    pr.descricao,
    pr.preco_venda,
    SUM(ef.quantidade) AS estoque_total
  FROM public.produto pr
  LEFT JOIN public.estoque_filial ef ON ef.produto_id = pr.id
  GROUP BY pr.id, pr.sku, pr.descricao, pr.preco_venda
WITH DATA;

CREATE UNIQUE INDEX ON public.mv_estoque_consolidado(produto_id);

-- ─── Seed Data ───────────────────────────────────────────────────────────────
INSERT INTO public.filial (nome, cnpj, cidade, estado) VALUES
  ('Filial Centro',   '12345678000195', 'São Paulo',  'SP'),
  ('Filial Norte',    '98765432000100', 'Campinas',   'SP'),
  ('Filial Sul',      '11222333000144', 'Curitiba',   'PR');

INSERT INTO public.produto (sku, descricao, preco_custo, preco_venda, estoque, categoria) VALUES
  ('PROD-001', 'Notebook Dell i7',   2500.00, 4999.99, 10, 'eletronico'),
  ('PROD-002', 'Mouse Sem Fio',        25.00,   89.90, 50, 'eletronico'),
  ('PROD-003', 'Camiseta Polo M',      30.00,   79.90, 30, 'vestuario'),
  ('PROD-004', 'Café Especial 500g',    8.00,   24.90, 100, 'alimento');

INSERT INTO public.cliente (nome, email, cpf) VALUES
  ('Maria Silva',  'maria@exemplo.com', '12345678901'),
  ('João Santos',  'joao@exemplo.com',  '98765432100'),
  ('Ana Oliveira', 'ana@exemplo.com',   NULL);
