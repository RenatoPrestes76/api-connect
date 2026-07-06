-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 27 — SIGMA · Seed data (dados de produção simulados, realistas)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Depósitos ─────────────────────────────────────────────────────────────────
INSERT INTO depositos (codigo, descricao) VALUES
  ('DEP-A', 'Depósito Central'),
  ('DEP-B', 'Depósito Filial Sul'),
  ('DEP-C', 'Depósito Loja');

-- ── Grupos de produto ─────────────────────────────────────────────────────────
INSERT INTO grupos_produto (codigo, descricao) VALUES
  ('ELET',  'Eletrônicos'),
  ('ALIM',  'Alimentos'),
  ('BEBID', 'Bebidas'),
  ('HIGI',  'Higiene e Limpeza'),
  ('FERR',  'Ferramentas');

-- ── Fornecedores ──────────────────────────────────────────────────────────────
INSERT INTO fornecedores (codigo, razao_social, nome_fantasia, cnpj, email, prazo_entrega) VALUES
  ('FOR-001', 'Distribuidora Alfa Ltda',          'Alfa Dist',     '12.345.678/0001-90', 'compras@alfa.com.br',    7),
  ('FOR-002', 'Suprimentos Beta S/A',              'Beta Supply',   '98.765.432/0001-10', 'pedidos@beta.com.br',   10),
  ('FOR-003', 'Importadora Gamma Comércio',        'Gamma Import',  '11.222.333/0001-44', 'import@gamma.com.br',   21),
  ('FOR-004', 'Indústria Delta de Alimentos',      'Delta Foods',   '55.666.777/0001-55', 'vendas@delta.com.br',    5),
  ('FOR-005', 'Tech Omega Equipamentos Eletrônicos','Tech Omega',   '33.444.555/0001-66', 'b2b@omega.com.br',      14);

-- ── Produtos (30 itens, 5 grupos) ─────────────────────────────────────────────
INSERT INTO produtos (codigo, descricao, unidade, preco_venda, preco_custo, cod_grupo, cod_fornecedor, ativo) VALUES
  -- Eletrônicos (cod_grupo=1)
  ('EL-001', 'Cabo HDMI 2m',              'UN',  49.90,  22.00, 1, 5, TRUE),
  ('EL-002', 'Adaptador USB-C 65W',       'UN', 129.90,  55.00, 1, 5, TRUE),
  ('EL-003', 'Mouse Sem Fio',             'UN',  89.90,  38.00, 1, 5, TRUE),
  ('EL-004', 'Teclado Mecânico Compacto', 'UN', 289.90, 130.00, 1, 5, TRUE),
  ('EL-005', 'Hub USB 4 Portas',          'UN',  79.90,  32.00, 1, 5, TRUE),
  ('EL-006', 'Webcam 1080p',              'UN', 199.90,  85.00, 1, 5, FALSE),
  -- Alimentos (cod_grupo=2)
  ('AL-001', 'Arroz Branco 5kg',          'SC',  28.90,  18.00, 2, 4, TRUE),
  ('AL-002', 'Feijão Preto 1kg',          'UN',   9.90,   5.50, 2, 4, TRUE),
  ('AL-003', 'Macarrão Espaguete 500g',   'UN',   5.90,   2.80, 2, 4, TRUE),
  ('AL-004', 'Azeite Extra Virgem 500ml', 'UN',  38.90,  20.00, 2, 3, TRUE),
  ('AL-005', 'Farinha de Trigo 1kg',      'UN',   7.50,   3.90, 2, 4, TRUE),
  ('AL-006', 'Leite Integral 1L',         'LT',   5.20,   2.90, 2, 4, TRUE),
  -- Bebidas (cod_grupo=3)
  ('BE-001', 'Água Mineral 500ml',        'UN',   2.50,   0.80, 3, 2, TRUE),
  ('BE-002', 'Suco de Laranja 1L',        'UN',   8.90,   4.20, 3, 2, TRUE),
  ('BE-003', 'Refrigerante Cola 2L',      'UN',   9.90,   4.80, 3, 2, TRUE),
  ('BE-004', 'Cerveja Pilsen 350ml',      'UN',   4.50,   2.10, 3, 1, TRUE),
  ('BE-005', 'Vinho Tinto Seco 750ml',    'UN',  35.90,  16.00, 3, 3, FALSE),
  -- Higiene (cod_grupo=4)
  ('HI-001', 'Shampoo Neutro 400ml',      'UN',  18.90,   8.50, 4, 2, TRUE),
  ('HI-002', 'Condicionador 400ml',       'UN',  18.90,   8.50, 4, 2, TRUE),
  ('HI-003', 'Sabonete Barra 90g',        'UN',   4.50,   1.80, 4, 2, TRUE),
  ('HI-004', 'Detergente Neutro 500ml',   'UN',   3.90,   1.50, 4, 1, TRUE),
  ('HI-005', 'Desinfetante 1L',           'UN',   6.90,   2.80, 4, 1, TRUE),
  ('HI-006', 'Papel Higiênico 12un',      'PC',  22.90,  10.00, 4, 1, TRUE),
  -- Ferramentas (cod_grupo=5)
  ('FE-001', 'Chave Phillips PH2',        'UN',  12.90,   5.50, 5, 3, TRUE),
  ('FE-002', 'Alicate Universal 8"',      'UN',  45.90,  20.00, 5, 3, TRUE),
  ('FE-003', 'Fita Isolante 20m',         'RL',   8.90,   3.50, 5, 1, TRUE),
  ('FE-004', 'Nível de Bolha 60cm',       'UN',  38.90,  16.00, 5, 3, TRUE),
  ('FE-005', 'Trena 5m',                  'UN',  29.90,  12.00, 5, 3, TRUE),
  ('FE-006', 'Serra Manual 45cm',         'UN',  69.90,  30.00, 5, 3, TRUE),
  ('FE-007', 'Martelo Carpinteiro 500g',  'UN',  55.90,  24.00, 5, 3, FALSE);

-- ── Estoque (DEP-A, DEP-B, DEP-C) ────────────────────────────────────────────
INSERT INTO estoque (cod_produto, cod_deposito, qtd_atual, qtd_minima, qtd_maxima, qtd_reservada) VALUES
  -- DEP-A (central)
  (1,  1, 150,  20, 500,  10),  -- EL-001
  (2,  1,  80,  10, 200,   5),  -- EL-002
  (3,  1, 120,  15, 300,   8),  -- EL-003
  (4,  1,  45,   5, 100,   2),  -- EL-004
  (5,  1,  90,  10, 250,   4),  -- EL-005
  (7,  1, 500,  50,1000,  30),  -- AL-001
  (8,  1, 300,  30, 600,  20),  -- AL-002
  (9,  1, 400,  40, 800,  15),  -- AL-003
  (10, 1,  60,   5, 150,   3),  -- AL-004
  (13, 1, 800, 100,2000,  50),  -- BE-001
  (14, 1, 200,  20, 500,  10),  -- BE-002
  (15, 1, 350,  30, 700,  20),  -- BE-003
  (18, 1, 180,  20, 400,  10),  -- HI-001
  (19, 1, 180,  20, 400,  10),  -- HI-002
  (20, 1, 600,  50,1200,  40),  -- HI-003
  (24, 1, 120,  15, 300,   8),  -- FE-001
  (25, 1,  70,  10, 200,   5),  -- FE-002
  -- DEP-B (filial)
  (1,  2,  60,  10, 200,   4),  -- EL-001
  (3,  2,  50,  10, 150,   2),  -- EL-003
  (7,  2, 200,  20, 500,  10),  -- AL-001
  (8,  2, 100,  10, 250,   5),  -- AL-002
  (13, 2, 400,  50,1000,  20),  -- BE-001
  (20, 2, 300,  30, 600,  15),  -- HI-003
  -- DEP-C (loja)
  (1,  3,  30,   5, 100,   1),  -- EL-001
  (2,  3,  20,   3,  60,   0),  -- EL-002
  (3,  3,  25,   5,  80,   2),  -- EL-003
  (7,  3, 100,  10, 250,   5),  -- AL-001
  (13, 3, 150,  20, 400,   8),  -- BE-001
  (18, 3,  40,   5, 120,   3),  -- HI-001
  (24, 3,  35,   5, 100,   2);  -- FE-001

-- ── Clientes (15) ────────────────────────────────────────────────────────────
INSERT INTO clientes (codigo, razao_social, nome_fantasia, cnpj_cpf, tipo_pessoa, email, telefone, cidade, estado, limite_credito, ativo) VALUES
  ('CLI-001', 'Mercado Central Ltda',           'Mercado Central',    '12.345.678/0001-01', 'J', 'compras@mercadocentral.com.br',  '(11) 3333-1001', 'São Paulo',       'SP', 150000.00, TRUE),
  ('CLI-002', 'Restaurante Bom Prato Ltda',     'Bom Prato',          '23.456.789/0001-02', 'J', 'pedidos@bomprato.com.br',         '(21) 3333-2002', 'Rio de Janeiro',  'RJ',  50000.00, TRUE),
  ('CLI-003', 'Padaria Trigo Dourado S/A',      'Padaria TD',         '34.567.890/0001-03', 'J', 'admin@trigodourado.com.br',       '(31) 3333-3003', 'Belo Horizonte',  'MG',  30000.00, TRUE),
  ('CLI-004', 'Supermercado Família Cia',        'Super Família',      '45.678.901/0001-04', 'J', 'financeiro@superfamilia.com.br',  '(41) 3333-4004', 'Curitiba',        'PR', 200000.00, TRUE),
  ('CLI-005', 'Lanchonete Sabor & Arte Ltda',   'Sabor Arte',         '56.789.012/0001-05', 'J', 'contato@saborarte.com.br',        '(51) 3333-5005', 'Porto Alegre',    'RS',  25000.00, TRUE),
  ('CLI-006', 'Maria Aparecida dos Santos',     NULL,                 '987.654.321-00',     'F', 'maria.santos@gmail.com',          '(11) 9999-6006', 'São Paulo',       'SP',   5000.00, TRUE),
  ('CLI-007', 'Depósito Popular Ltda',           'Dep Popular',        '67.890.123/0001-07', 'J', 'vendas@deppopular.com.br',        '(62) 3333-7007', 'Goiânia',         'GO',  80000.00, TRUE),
  ('CLI-008', 'Atacado Norte Comércio Ltda',    'Atacado Norte',      '78.901.234/0001-08', 'J', 'atacado@norte.com.br',            '(91) 3333-8008', 'Belém',           'PA', 120000.00, TRUE),
  ('CLI-009', 'Bar do João Ltda ME',             'Bar do João',        '89.012.345/0001-09', 'J', 'joao@bardojoao.com.br',           '(85) 9999-9009', 'Fortaleza',       'CE',  15000.00, FALSE),
  ('CLI-010', 'Mercadinho Perto de Casa',        'Mercadinho PdC',     '90.123.456/0001-10', 'J', 'mercadinho@pdcasa.com.br',        '(27) 3333-0010', 'Vitória',         'ES',  40000.00, TRUE),
  ('CLI-011', 'Carlos Eduardo Lima',             NULL,                 '123.456.789-11',     'F', 'carloseduardo@hotmail.com',       '(71) 9999-1011', 'Salvador',        'BA',   8000.00, TRUE),
  ('CLI-012', 'Empório Gourmet Fino Ltda',      'Empório Fino',       '11.223.344/0001-12', 'J', 'compras@emporiofino.com.br',      '(48) 3333-2012', 'Florianópolis',   'SC',  60000.00, TRUE),
  ('CLI-013', 'Conveniência 24h Ltda',           'Conv 24h',           '22.334.455/0001-13', 'J', 'oper@conv24h.com.br',             '(19) 3333-3013', 'Campinas',        'SP',  20000.00, TRUE),
  ('CLI-014', 'Minimercado Vizinhança Eireli',   'Mini Viz',           '33.445.566/0001-14', 'J', 'minimercado@vizinhanca.com.br',   '(47) 3333-4014', 'Joinville',       'SC',  35000.00, TRUE),
  ('CLI-015', 'Ana Paula Ferreira ME',           NULL,                 '222.333.444-15',     'F', 'anapaula.ferreira@outlook.com',   '(61) 9999-5015', 'Brasília',        'DF',   3000.00, FALSE);

-- ── Usuários ──────────────────────────────────────────────────────────────────
INSERT INTO usuarios (login, nome, email, perfil, dt_ultimo_acesso) VALUES
  ('admin',    'Administrador do Sistema',   'admin@seltriva.com.br',    'ADMIN',      NOW() - INTERVAL '1 hour'),
  ('gerente',  'Gerente de Operações',       'gerente@seltriva.com.br',  'GERENTE',    NOW() - INTERVAL '3 hours'),
  ('vendas1',  'Carlos Vendedor',            'carlos.v@seltriva.com.br', 'VENDAS',     NOW() - INTERVAL '30 min'),
  ('vendas2',  'Ana Vendas',                 'ana.v@seltriva.com.br',    'VENDAS',     NOW() - INTERVAL '2 hours'),
  ('estoque1', 'Roberto Estoque',            'roberto.e@seltriva.com.br','ESTOQUE',    NOW() - INTERVAL '1 day'),
  ('financ1',  'Patricia Financeiro',        'patricia.f@seltriva.com.br','FINANCEIRO', NOW() - INTERVAL '4 hours'),
  ('support',  'Suporte Técnico',            'suporte@seltriva.com.br',  'SUPORTE',    NOW() - INTERVAL '2 days'),
  ('api',      'Integração API Atlas',       'api@seltriva.com.br',      'API',        NOW() - INTERVAL '10 min');

-- ── Pedidos (10) ─────────────────────────────────────────────────────────────
INSERT INTO pedidos (numero, cod_cliente, cod_usuario, dt_entrega, status, valor_bruto, valor_desconto, valor_total) VALUES
  ('PED-2024-0001', 1, 3, CURRENT_DATE + 3, 'FATURADO',  499.50,  0.00,  499.50),
  ('PED-2024-0002', 4, 3, CURRENT_DATE + 5, 'FATURADO', 1250.00, 50.00, 1200.00),
  ('PED-2024-0003', 2, 4, CURRENT_DATE + 2, 'ABERTO',    348.70,  0.00,  348.70),
  ('PED-2024-0004', 7, 3, CURRENT_DATE + 7, 'ABERTO',    890.00, 44.50,  845.50),
  ('PED-2024-0005', 1, 4, CURRENT_DATE + 4, 'FATURADO',  672.30,  0.00,  672.30),
  ('PED-2024-0006', 8, 3, CURRENT_DATE + 10,'ABERTO',   2100.00,105.00, 1995.00),
  ('PED-2024-0007', 3, 4, CURRENT_DATE + 1, 'CANCELADO',  185.60,  0.00,  185.60),
  ('PED-2024-0008', 5, 3, CURRENT_DATE + 3, 'ABERTO',    520.00, 26.00,  494.00),
  ('PED-2024-0009',12, 4, CURRENT_DATE + 6, 'FATURADO',  415.80,  0.00,  415.80),
  ('PED-2024-0010',10, 3, CURRENT_DATE + 8, 'ABERTO',    780.00, 39.00,  741.00);

-- ── Itens dos pedidos ─────────────────────────────────────────────────────────
INSERT INTO itens_pedido (cod_pedido, cod_produto, qtd, preco_unitario, desconto_perc, valor_total) VALUES
  (1, 1,  5, 49.90, 0,  249.50),
  (1, 3,  2, 89.90, 0,  179.80),
  (1, 5,  1, 79.90, 0,   79.90),
  (2, 7, 20, 28.90, 0,  578.00),
  (2, 8, 30,  9.90, 0,  297.00),
  (2, 13,50,  2.50, 4,  120.00),
  (3, 9, 30,  5.90, 0,  177.00),
  (3, 10, 2, 38.90, 0,   77.80),
  (3, 11, 6,  7.50, 0,   45.00),
  (4, 18, 20,18.90, 0,  378.00),
  (4, 20, 50, 4.50, 0,  225.00),
  (5, 1,  3, 49.90, 0,  149.70),
  (5, 2,  2,129.90, 0,  259.80),
  (5, 5,  2, 79.90, 0,  159.80),
  (6, 7, 50, 28.90, 0, 1445.00),
  (6, 13,100, 2.50, 0,  250.00),
  (6, 14, 50, 8.90, 0,  445.00),
  (8, 24, 10,12.90, 0,  129.00),
  (8, 25,  5, 45.90, 0, 229.50),
  (9, 4,  1,289.90, 0,  289.90),
  (9, 2,  1,129.90, 0,  129.90),
  (10,7,  10, 28.90, 0, 289.00),
  (10,8,  20,  9.90, 0, 198.00);

-- ── Últimas alterações nos produtos (para teste de sync incremental) ──────────
UPDATE produtos SET dt_alteracao = NOW() - INTERVAL '2 days'  WHERE codigo IN ('EL-001','EL-002','EL-003','AL-001','AL-002');
UPDATE produtos SET dt_alteracao = NOW() - INTERVAL '1 day'   WHERE codigo IN ('BE-001','BE-002','HI-001','FE-001');
UPDATE produtos SET dt_alteracao = NOW() - INTERVAL '1 hour'  WHERE codigo IN ('EL-004','HI-003');

-- ── Últimas alterações nos clientes ──────────────────────────────────────────
UPDATE clientes SET dt_alteracao = NOW() - INTERVAL '3 days'  WHERE codigo IN ('CLI-001','CLI-002','CLI-004');
UPDATE clientes SET dt_alteracao = NOW() - INTERVAL '1 day'   WHERE codigo IN ('CLI-007','CLI-008');
UPDATE clientes SET dt_alteracao = NOW() - INTERVAL '30 min'  WHERE codigo = 'CLI-012';
