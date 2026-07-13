# Auditoria de Arquitetura — Seltriva Connect / Atlas Connect

**Data:** 2026-07-13
**Levantado por:** Claude Code, diretamente do código em `c:\Users\user\Desktop\API_Connect`
**Propósito:** registro de estado real do monorepo neste momento — não é roadmap, não é intenção futura. Serve como linha de base ("certidão de nascimento") para o Plano de Fechamento da v2.

> Metodologia: todo dado abaixo vem de inspeção direta do código (`package.json`, código-fonte, schemas, workflows) e de builds/testes executados de fato nesta sessão — não de documentação antiga ou suposição. Onde a confiança é menor (ex: "endpoints não usados"), isso está declarado explicitamente.

---

## 1. Árvore do repositório

```
API_Connect/
├── apps/                        9 aplicações (ver seção 2)
│   ├── admin/                   100 arquivos versionados
│   ├── agent/                   27 arquivos
│   ├── api/                     329 arquivos
│   ├── cloud/                   80 arquivos
│   ├── developer-portal/        12 arquivos
│   ├── docs/                    11 arquivos
│   ├── runtime-installer/       18 arquivos
│   ├── studio/                  11 arquivos
│   └── web/                     306 arquivos
├── packages/                    38 packages internos (ver seção 3)
├── connectors/
│   └── erp-provider/            29 arquivos — ORION, conector ERP genérico
├── docs/                        API.md, ARCHITECTURE.md, DECISIONS.md, DEVELOPMENT.md,
│                                 ROADMAP.md, VERCEL-DEPLOYMENT.md, adr/, architecture/
├── docker/                      Dockerfile.api + suporte
├── infra/                       infraestrutura declarativa
├── load-tests/                  scripts de carga
├── scripts/                     utilitários de repo
├── .github/workflows/           ci.yml, format.yml (ver seção 9)
├── docker-compose.yml           postgres + redis + api (dev local)
├── pnpm-workspace.yaml          apps/*, packages/*, connectors/*
├── turbo.json                   pipeline de tasks (build, dev, test, lint, type-check)
└── tsconfig.json                config raiz — todo package estende este arquivo
```

**Estatísticas:** 1.590 arquivos versionados no total · 9 apps · 38 packages · 1 connector · 1 turbo pipeline.

---

## 2. Status de cada app

| App                   | Status               | O que existe de fato                                                                                                                                                                                                         | Deploy                                |
| --------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **web**               | 🟢 Pronto            | ATLAS HUB — o app mais completo. Dezenas de rotas reais: dashboard, conectores, agentes, workflows (com builder visual e IA), governança, billing, segurança, marketplace, observatory, prometheus, helios. 306 arquivos.    | Vercel · Next.js 15                   |
| **cloud**             | 🟢 Pronto            | Atlas Cloud Control Plane — organizações, agentes, empresas, conectores. Prisma + Postgres (Supabase) como banco próprio.                                                                                                    | Vercel · Next.js 15 + Prisma          |
| **admin**             | 🟢 Pronto            | Atlas Control Plane global — tenants, fleet, licenças, feature flags, deployments, auditoria. Fala com `api` via proxy (`/api/admin/*` → backend).                                                                           | Vercel · Next.js 15                   |
| **studio**            | 🟡 Placeholder       | Só a página inicial existe ("fundação pronta para implementação"). Nenhuma tela funcional.                                                                                                                                   | Vercel · Next.js 15                   |
| **docs**              | 🟡 Placeholder       | Mesmo estado do studio — só a página inicial, sem conteúdo de documentação real.                                                                                                                                             | Vercel · Next.js 15                   |
| **developer-portal**  | 🔴 Não implementado  | Só existe `src/domain/index.ts` (tipos e regras de negócio). Nenhuma página, nenhuma rota `app/`. Não é deployável como site hoje.                                                                                           | Nenhum — falta construir a UI inteira |
| **api**               | ⚪ Serviço (não-web) | Backend central. Processo Node persistente: WebSocket hub, eleição de líder, autoscaler, rotação de segredos, estado em memória. Arquiteturalmente incompatível com serverless. 24 grupos de rotas, 334 endpoints (seção 6). | Docker (imagem própria, não Vercel)   |
| **agent**             | ⚪ Agente (não-web)  | Sentinel — agente de borda instalado na infraestrutura do cliente. Sync, scheduler, cache, telemetria, bootstrap em 7 fases.                                                                                                 | Binário on-premise                    |
| **runtime-installer** | ⚪ CLI (não-web)     | Instalador (`atlas-install`) que faz bootstrap de um runtime numa máquina alvo — serviço Linux/Windows, ativação, health check.                                                                                              | Binário CLI                           |

**Resumo:** 3 prontos e no ar, 2 placeholders mínimos, 1 sem interface nenhuma, 3 que não são sites.

---

## 3. Status de cada package (38)

Todos os 38 fazem `build` (`tsc`) com sucesso hoje — isso foi verificado nesta sessão com um `--force` rebuild completo do monorepo (47/47 tasks, zero warnings de "no output files"). O que diferencia cada um é **cobertura de testes** (seção 7) e **quem realmente consome** (seção 4).

### Fundação (usados por praticamente tudo)

| Package    | Descrição                                                             |
| ---------- | --------------------------------------------------------------------- |
| `core`     | Interfaces e contratos da arquitetura enterprise                      |
| `types`    | Tipos TypeScript compartilhados                                       |
| `config`   | Configuração de ambiente                                              |
| `logger`   | Logging estruturado                                                   |
| `shared`   | Utilitários compartilhados                                            |
| `auth`     | Integração de autenticação (Supabase)                                 |
| `database` | Camada Prisma ORM (schema principal, 41 models)                       |
| `drivers`  | Integrações com serviços externos                                     |
| `ai`       | Integrações e utilitários de IA/ML                                    |
| `ui`       | Biblioteca de componentes — exporta `src/` direto (sem build de dist) |
| `runtime`  | Connect Runtime Platform (CRP) — núcleo operacional                   |

### Ciclo de vida do agente

| Package               | Descrição                                                  |
| --------------------- | ---------------------------------------------------------- |
| `activation`          | Tokens de ativação para instalação headless                |
| `agent-identity`      | ARGUS — modelo de domínio de identidade do agente          |
| `agent-observability` | SENTINEL — métricas, heartbeat, histórico de sync          |
| `agent-provisioning`  | HERMES-II — persistência Prisma + fluxo de provisionamento |

### Conectividade & dados

| Package              | Descrição                                              |
| -------------------- | ------------------------------------------------------ |
| `connectors`         | UDCF — framework universal de conectores               |
| `connector-sdk`      | FUSION — plataforma de extensibilidade de conectores   |
| `connector-registry` | Catálogo do marketplace, 30 conectores pré-cadastrados |
| `database-sdk`       | GENESIS — adaptador universal de bancos, drivers reais |
| `synchronization`    | HERMES — motor de sincronização inteligente            |

### Inteligência & IA

| Package                 | Descrição                                                   |
| ----------------------- | ----------------------------------------------------------- |
| `ai-core`               | ATHENA — núcleo de IA para decisões de integração           |
| `database-intelligence` | ATHENA DB AI — motor de inteligência de banco de dados      |
| `schema-intelligence`   | SIE — normalização, comparação e versionamento de schema    |
| `semantic-engine`       | USME — mapeia estruturas de dados para linguagem de negócio |

### Segurança & governança

| Package      | Descrição                                           |
| ------------ | --------------------------------------------------- |
| `aegis`      | Cripto, TOTP, policy engine, cadeia de auditoria    |
| `governance` | Plataforma de governança orientada a políticas      |
| `titan`      | Circuit breaker, feature flags, tracing distribuído |

### Ecossistema de plugins (sustenta o `developer-portal`, que não tem UI ainda)

| Package           | Descrição                                                     |
| ----------------- | ------------------------------------------------------------- |
| `plugin-sdk`      | SDK para construir plugins/conectores enterprise              |
| `cli`             | Toolchain de dev para publicar plugins Seltriva               |
| `generator`       | Gera projetos de plugin completos a partir de templates       |
| `templates`       | Scaffolds prontos de projetos de plugin                       |
| `testing`         | Framework de teste — harness, mocks, asserções                |
| `validator`       | Validação de manifesto, interface, compatibilidade, segurança |
| `marketplace-api` | Contratos do marketplace para publishers/consumers            |
| `sdk`             | SDK oficial — cliente Atlas Cloud para devs externos          |

### Runtime & negócio

| Package            | Descrição                                                      |
| ------------------ | -------------------------------------------------------------- |
| `workflow-builder` | Planner de IA, validador, simulador, versionamento de workflow |
| `billing`          | Planos, licenças, custo de créditos de IA                      |
| `atlasctl`         | CLI operacional para gestão do cluster Atlas Connect           |
| `release`          | Checklist de GA, changelog, SBOM, go-live                      |

---

## 4. Mapa de dependências

Só os apps que de fato importam packages de domínio via `workspace:*` estão listados — os demais apps Next.js conversam com `api` por HTTP (direto ou via proxy Next.js) em vez de importar essas camadas diretamente.

| App                 | Depende diretamente de                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api`               | activation, aegis, agent-identity, agent-observability, agent-provisioning, atlasctl, billing, config, connector-registry, database, database-intelligence, database-sdk, logger, release, titan, types, workflow-builder |
| `developer-portal`  | marketplace-api, plugin-sdk, sdk, templates, validator                                                                                                                                                                    |
| `agent`             | core, runtime, types                                                                                                                                                                                                      |
| `cloud`             | core, runtime, types (+ Prisma schema próprio)                                                                                                                                                                            |
| `studio`            | config, sdk, types, ui                                                                                                                                                                                                    |
| `docs`              | ui                                                                                                                                                                                                                        |
| `web`               | workflow-builder (o resto é via HTTP para `api`)                                                                                                                                                                          |
| `runtime-installer` | activation                                                                                                                                                                                                                |
| `admin`             | nenhum package de domínio — 100% via proxy HTTP para `api`                                                                                                                                                                |

**Observação:** `web`, `admin` e `cloud` — os 3 apps realmente prontos — majoritariamente **não** importam a rica camada de domínio (`aegis`, `governance`, `titan`, `synchronization`, etc.) diretamente; essas camadas só são consumidas por `api`. Isso é arquiteturalmente correto (separação front/back), mas significa que boa parte dos 38 packages só tem **um único consumidor real** (`api`).

---

## 5. Schema Prisma

Existem **dois schemas Prisma independentes** — não um só:

| Schema                                   | Models | Datasource                                       | Observação                                                                                                                                                         |
| ---------------------------------------- | ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/database/prisma/schema.prisma` | 41     | `DATABASE_URL`                                   | Superset — inclui os models `Atlas*` (AtlasAgent, AtlasAdminUser, AtlasAdminRole...), `ActivationToken`, `AgentAccessToken`, `ProvisioningToken`, usados por `api` |
| `apps/cloud/prisma/schema.prisma`        | 28     | `DATABASE_URL` + `DIRECT_URL` (pooling Supabase) | Subconjunto dos 28 models "core" (Agent, Organization, User, Workspace, Deployment...) — sem os models de identidade/ativação do agente                            |

**Risco real:** os 28 models que aparecem nos dois schemas (`Agent`, `Organization`, `User`, `Workspace`, `Deployment`, etc.) são definições **duplicadas e mantidas manualmente em dois arquivos separados**. Uma alteração em um lado (novo campo, nova relação) não se propaga automaticamente para o outro — risco de drift silencioso entre o schema que `api` usa e o que `cloud` usa.

**`db:seed`:** `apps/cloud/package.json` declara `"db:seed": "tsx prisma/seed.ts"`, mas **`apps/cloud/prisma/seed.ts` não existe** — o comando falharia se executado.

---

## 6. Migrations

**Não existe nenhum diretório `prisma/migrations` em lugar nenhum do repositório.**

Isso significa que os dois schemas acima nunca passaram por `prisma migrate dev`/`deploy` — toda sincronização de schema até hoje depende de `prisma db push` (scripts `db:push` existem em `packages/database` e `apps/cloud`), que aplica o schema diretamente sem gerar um histórico revisável de mudanças. Para produção, isso é um risco: não há como saber que sequência de alterações levou o banco ao estado atual, nem como fazer rollback de uma mudança de schema específica.

---

## 7. Cobertura de testes

Execução real nesta sessão (`turbo run test --continue=always`), não estimativa:

| Componente                                                                                                                                                                                                                                                   | Resultado                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **`apps/api`**                                                                                                                                                                                                                                               | ✅ 44 arquivos de teste, **1.043 testes passando**                                                                                       |
| **`packages/connector-sdk`**                                                                                                                                                                                                                                 | ✅ 8 arquivos, 76 testes passando                                                                                                        |
| **17 outros packages com testes**                                                                                                                                                                                                                            | ✅ todos passando (agent-identity, agent-provisioning, agent-observability, activation, connectors, database-sdk, synchronization, etc.) |
| **Sem nenhum arquivo de teste:** `apps/cloud`, `apps/runtime-installer`, `packages/cli`, `packages/database-intelligence`, `packages/generator`, `packages/marketplace-api`, `packages/plugin-sdk`, `packages/sdk`, `packages/testing`, `packages/validator` | ❌ 0 testes — 10 componentes, incluindo um app em produção (`cloud`)                                                                     |

**Ironia notável:** `packages/testing` — o próprio framework de teste de plugins do Atlas — não tem testes para si mesmo.

---

## 8. Rotas HTTP da API (`apps/api`)

Todas as rotas são registradas centralmente em `apps/api/src/server.ts`, que importa uma função `register*Routes(router)` de cada um dos 24 módulos. **334 endpoints únicos** no total.

| Módulo          | Rotas | Módulo             | Rotas |
| --------------- | ----- | ------------------ | ----- |
| `security`      | 41    | `governance`       | 12    |
| `control-plane` | 35    | `admin`            | 11    |
| `fleet`         | 34    | `operations`       | 11    |
| `helios`        | 29    | `regions`          | 11    |
| `billing`       | 18    | `copilot`          | 9     |
| `orchestrator`  | 18    | `setup`            | 9     |
| `ha`            | 17    | `workflow-builder` | 9     |
| `portal`        | 17    | `atlas`            | 6     |
| `release`       | 15    | `admin-identity`   | 6     |
| `marketplace`   | 14    | `discovery`        | 4     |
| `prometheus`    | 23    | `chaos`            | 3     |
| `observatory`   | 24    |                    |       |
| `hub`           | 24    |                    |       |
| `ops`           | 20    |                    |       |

_(lista completa dos 334 endpoints disponível sob consulta — omitida aqui por tamanho)_

---

## 9. Endpoints ainda não utilizados

**Metodologia e sua limitação:** cross-referenciar 334 rotas de backend contra o código de 5 frontends via grep estático é impreciso neste código-base especificamente, porque os service files usam o padrão `const BASE = '/api/v1/x'; api.get(\`${BASE}/y\`)`— o caminho completo nunca aparece como uma string literal única. A primeira tentativa (grep literal) apontou 223 rotas como "não usadas", o que se provou **majoritariamente falso** ao verificar manualmente casos como`helios`e`prometheus`(ambos usados por`web`, só que com `BASE`genérico`/api/v1` + sufixo). Depois de reconstruir os fragmentos de caminho corretamente e considerar as rotas-proxy do Next.js (`admin`→`/api/admin/fleet`→ backend`fleet`; `admin`→`/api/admin/control-plane`→ backend`control-plane`) e o consumo do agente on-premise (`apps/agent`chama`/api/v1/agents/register` diretamente), a lista caiu para:

| Método   | Rota                           | Evidência                                                                    |
| -------- | ------------------------------ | ---------------------------------------------------------------------------- |
| `GET`    | `/admin/activation-tokens`     | Nenhuma página em `apps/admin` referencia `activation-token` em lugar nenhum |
| `POST`   | `/admin/activation-tokens`     | idem                                                                         |
| `DELETE` | `/admin/activation-tokens/:id` | idem                                                                         |

**Essas 3 rotas são o único grupo com confiança real de "sem consumidor frontend"** — o backend de tokens de ativação (`packages/activation`) está completo e testado, mas `apps/admin` nunca ganhou uma tela para gerenciá-los.

Todas as outras 331 rotas têm evidência (direta ou via proxy/agente) de uso por pelo menos um cliente.

---

## 10. Pipelines de CI/CD

Dois workflows em `.github/workflows/`:

### `ci.yml` — Build & Test + Security Scan

- Dispara em push/PR para `[main, develop]`
- Job **Build & Test**: install → lint → type-check → build → format:check (timeout 15min)
- Job **Security Scan**: `pnpm audit --audit-level=moderate` (`continue-on-error: true`, ou seja, nunca quebra o pipeline)

### `format.yml` — Auto Format & Fix

- Dispara em push para `[main, develop]`
- Roda `pnpm format` + `pnpm lint:fix`, comita automaticamente de volta (`git-auto-commit-action`, `--no-verify`)

### 🔴 Problema crítico encontrado

**A branch `main` não existe neste repositório** — só existem `master`, `develop` e `release/1.0` (confirmado via `git branch -a` e `git ls-remote`). Os dois workflows disparam em `[main, develop]`.

**Consequência:** todo push para `master` — a branch real de produção, de onde a Vercel faz deploy — **nunca disparou o CI**. Nem lint, nem type-check, nem build, nem format-check rodaram automaticamente em nenhum commit de `master` até hoje. Isso ajuda a explicar por que vários bugs estruturais (tsconfig faltando, comentário JSDoc quebrando o parser, `.gitignore` engolindo pastas `logs/` inteiras) só foram descobertos manualmente nesta sessão, um deploy de cada vez — o pipeline automático que deveria pegar isso simplesmente nunca rodou.

---

## 11. Variáveis de ambiente

| App                                  | Variáveis referenciadas no código                                                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web`                                | `HUB_API_URL`, `HUB_JWT_SECRET`, `NEXT_PUBLIC_ANTHROPIC_MODE`, `NEXT_PUBLIC_HUB_API_URL`, `NODE_ENV`                                                     |
| `admin`                              | `ADMIN_API_URL`, `ADMIN_JWT_SECRET`, `NEXT_PUBLIC_ADMIN_API_WS_URL`, `NODE_ENV`                                                                          |
| `cloud`                              | `ATLAS_API_URL`, `NEXT_PUBLIC_ATLAS_API_URL` (+ `DATABASE_URL`/`DIRECT_URL` via Prisma, não lido diretamente no código de app)                           |
| `api`                                | `ADMIN_JWT_SECRET`, `ANTHROPIC_API_KEY`, `NODE_ENV`, `SUPABASE_JWT_SECRET` (+ `DATABASE_URL`, `REDIS_URL`, `API_PORT`, `API_SECRET_KEY` no `.env` local) |
| `agent`                              | `SELTRIVA_CLOUD_URL`                                                                                                                                     |
| `runtime-installer`                  | `ATLAS_API_URL`, `NODE_ENV`, `USER`, `USERNAME`                                                                                                          |
| `developer-portal`, `docs`, `studio` | nenhuma                                                                                                                                                  |

**Observação:** `ADMIN_JWT_SECRET` é referenciado tanto por `api` quanto por `admin` — precisa ser o **mesmo valor** nos dois ambientes de deploy (Docker + Vercel) para a autenticação funcionar; nada no código valida isso automaticamente hoje.

---

## 12. Pendências para produção

Lista consolidada, em ordem de impacto:

1. **CI nunca rodou em `master`** (seção 10) — corrigir os triggers de `main` → `master` é a ação de maior alavancagem única deste documento; sem isso, todo o resto continua sendo pego manualmente, um deploy de cada vez.
2. **`developer-portal` não tem interface** — todo o backend (marketplace-api, plugin-sdk, validator, templates, sdk) está pronto e sem consumidor visual.
3. **`docs` e `studio` são placeholders** — prontos para receber conteúdo, mas vazios.
4. **10 componentes sem nenhum teste**, incluindo o app em produção `cloud` (seção 7).
5. **Dois schemas Prisma com models duplicados manualmente** (`database` vs `cloud`) — risco de drift silencioso (seção 5).
6. **Nenhuma migration Prisma existe** — todo o histórico de schema depende de `db push` não revisável (seção 6).
7. **Endpoint de ativação sem UI de gestão** — `/admin/activation-tokens*` pronto no backend, sem tela (seção 9).
8. **`apps/cloud/prisma/seed.ts` não existe**, apesar do script `db:seed` apontar para ele.
9. **`eslint.ignoreDuringBuilds: true`** em `admin`, `cloud` e `web` — dívida de lint real, não bloqueia build hoje mas também não é corrigida automaticamente.
10. **Segurança do CI é cosmética** — `pnpm audit` roda com `continue-on-error: true`, ou seja, nunca reprova o pipeline mesmo com vulnerabilidade encontrada.
11. **Vercel — confirmar Root Directory de cada projeto** — histórico desta sessão mostrou builds rodando o monorepo inteiro em vez de escopados por app; pode já estar resolvido, mas não foi confirmado via novo log limpo ainda.

---

## Classe de bugs corrigidos nesta sessão (contexto histórico)

Registrado aqui porque explica _por que_ este documento existe agora: ao longo desta sessão, praticamente **todo** app/package teve seu primeiro build/lint/format real já dentro desta conversa — nunca tinham sido exercitados de ponta a ponta antes. Bugs encontrados e corrigidos incluíram: 9+ packages sem `tsconfig.json` próprio (causando poluição cruzada via fallback pro tsconfig raiz), cache incremental do `tsc` mascarando builds vazios como "sucesso", um `.gitignore` com `logs/` não ancorado que apagava pastas de código-fonte inteiras da árvore versionada, uma versão do Node aberta (`>=20.0.0`) que a Vercel escalava sozinha para uma versão incompatível com um módulo nativo, e um comentário JSDoc com `*/` literal que quebrava o parser. Nenhum desses seria pego por uma pessoa lendo o código — só por builds reais rodando de ponta a ponta, que é exatamente o que o CI deveria estar fazendo em todo push (ver item 1 da seção 12).
