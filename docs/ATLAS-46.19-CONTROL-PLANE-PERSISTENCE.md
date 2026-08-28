# ATLAS 46.19 — Control Plane Persistence & Transactional Integrity Gate

## 1. Objetivo

Estabelecer a primeira camada real de persistência do Control Plane, eliminando
o estado efêmero dos stores onde já existem modelos Prisma equivalentes —
não migrando os ~20 módulos in-memory do Atlas, mas provando, com uma
unidade real e reutilizável, que o Control Plane pode deixar de ter uma
segunda fonte de verdade em memória.

Princípio arquitetural adotado: `HTTP → Handler → Service/Repository →
Prisma → PostgreSQL`.

## 2. Estado encontrado (auditoria)

- Todo o histórico deste projeto (sprints 46.1 a 46.18) rodou com
  `"Database unavailable — running with in-memory stores only"` — nunca
  houve, de fato, uma conexão Postgres funcional neste ambiente de
  desenvolvimento.
- `packages/database/prisma/schema.prisma` já continha um schema completo e
  correto (`AtlasAdminUser`, `Tenant`, `Organization`, `Workspace`,
  `Environment`, e dezenas de outros modelos) — nunca aplicado como
  migração real.
- O histórico de migrações (`prisma/migrations/`) continha **uma única
  migração incremental** (`20260715000000_add_erp_integrations`), que
  pressupunha uma baseline nunca capturada — aplicá-la contra um banco
  vazio falhava (`relation "Organization" does not exist"`).
- Dos 6 módulos do Control Plane auditados nas sprints 46.16–46.18
  (admin-identity, runtime-registration, erp-connectivity, erp-metadata,
  semantic-mapping, canonical-model), **nenhum** possui um modelo Prisma
  próprio já pronto (não existe `Runtime`, `ConnectionProfile`,
  `DiscoveryRequest`, `SemanticMapping` ou `CanonicalModel` no schema).
- `apps/api/src/modules/control-plane/control-plane-store.ts` (956 linhas),
  por outro lado, já continha o comentário explícito: _"Mirrors
  apps/cloud/prisma/schema.prisma field-for-field so a future swap to real
  Prisma-backed persistence is a drop-in replacement, not a rewrite."_ —
  ou seja, a intenção original já era exatamente esta migração, e o
  Tenant/Organization desse store batem campo-a-campo com os modelos
  Prisma `Tenant`/`Organization` já existentes.

## 3. Entidade escolhida

**Tenant + Organization**, do módulo `control-plane` (rotas
`/admin/control-plane/tenants` e `/admin/control-plane/organizations`).

Critérios atendidos:

1. já possui modelo Prisma (`Tenant`, `Organization`, com relação FK real
   `Organization.tenantId -> Tenant.id`, `onDelete: SetNull`);
2. já possui CRUD real e testado (35 testes HTTP pré-existentes);
3. já possui consumidores HTTP (8 rotas + módulos `chaos`, `fleet-ops`,
   `ha`);
4. impacto arquitetural alto — Tenant/Organization são a raiz de toda a
   hierarquia do Control Plane (Project/Workspace/Environment/Runtime
   referenciam `organizationId`).

A prioridade sugerida pela especificação (Organization/Tenant em primeiro
lugar) coincidiu com o que o código realmente permitia sem inventar schema
novo — `admin-identity` também tinha modelos Prisma prontos
(`AtlasAdminUser` etc.), mas foi descartado porque essa entidade é global
por desenho (SUPER_ADMIN, sem conceito de tenant), tornando a Etapa 7
(isolamento tenant-aware) inaplicável a ela da forma pedida pela sprint.

## 4. Modelo Prisma utilizado

`packages/database/prisma/schema.prisma`, modelos `Tenant` e
`Organization` (já existentes, inalterados nesta sprint). Nenhum campo foi
adicionado ao schema.

## 5. Arquitetura antes/depois

**Antes:**

```
HTTP → routes/v1/control-plane/{tenants,organizations}.ts
     → controlPlaneStore (singleton)
     → this.tenants: Tenant[] / this.organizations: Organization[] (RAM)
```

**Depois:**

```
HTTP → routes/v1/control-plane/{tenants,organizations}.ts
     → controlPlaneStore (mesma interface pública, métodos agora async)
     → tenancyRepository (novo — único ponto que toca Prisma)
     → prisma.tenant.* / prisma.organization.*
     → PostgreSQL (docker-compose, container seltriva_postgres)
```

`Project`/`Workspace`/`Environment`/`Runtime`/`Connector`/`Deployment`/
`FeatureFlag` **continuam 100% em memória**, propositalmente fora de
escopo (ver Seção 14).

## 6. Arquivos alterados

Novos:

- `apps/api/src/modules/control-plane/tenancy.repository.ts` — repository
  Prisma-only para Tenant/Organization; único arquivo que importa `prisma`
  neste módulo.
- `apps/api/src/__tests__/control-plane/tenancy-persistence.test.ts` —
  restart persistence, rollback transacional, concorrência, isolamento.
- `apps/api/vitest.setup.ts` — carrega `.env` antes dos testes (necessário
  agora que há uma dependência real de `DATABASE_URL`).
- `docker/postgres-init/01-grant-public-schema.sql` — grant automático de
  `CREATE` no schema `public` (Postgres 15+ não concede isso por padrão ao
  dono do banco).
- `packages/database/prisma/migrations/20260824000000_init_baseline/` —
  baseline completa gerada a partir do schema atual, substituindo a
  migração incompleta anterior (ver Seção 2).
- Este documento.

Modificados:

- `apps/api/src/modules/control-plane/control-plane-store.ts` — métodos de
  Tenant/Organization (e os que dependem deles: `createProject`,
  `createEnvironment`, `createDeployment`, `getDashboardSummary`) agora
  `async`, delegando ao repository; `exportSnapshot`/`importSnapshot`
  (Disaster Recovery) não incluem mais Tenant/Organization (ver Seção 9);
  seed idempotente para tenant/org (get-or-create por slug).
- `apps/api/src/routes/v1/control-plane/{tenants,organizations,projects,
environments,deployments,connectors,dashboard}.ts` — `await` adicionado
  nas chamadas agora assíncronas; `organizations.ts` trata o novo erro
  `TENANT_NOT_FOUND`.
- `apps/api/src/routes/v1/fleet/connector-ops.ts` — mesmo ajuste.
- `apps/api/src/modules/fleet-ops/fleet-ops-store.ts` — `executeJob`,
  `createDeploymentJob`, `approveDeploymentJob`, `tickScheduledJobs` agora
  `async` (encadeiam `controlPlaneStore.createDeployment`).
- `apps/api/src/modules/chaos/chaos-runner.ts` — `runDeploymentRollback`
  agora `async`.
- `apps/api/package.json` — `@prisma/client` já era dependência; nenhuma
  nova dependência de produção adicionada.
- `apps/api/vitest.config.ts` — `setupFiles` apontando para
  `vitest.setup.ts`.
- `apps/api/src/__tests__/control-plane/control-plane-routes.test.ts` —
  `beforeAll` limpa as linhas de teste conhecidas (Tenant/Organization
  agora persistem entre execuções, ao contrário do resto do store).
- `apps/api/src/__tests__/health/health-live-ready.test.ts` — `/health` e
  `/ready` agora esperam `200`/`ok` (o Postgres realmente conecta neste
  ambiente pela primeira vez em toda a engagement).
- `.env`, `apps/api/.env`, `.env.example`, `apps/api/.env.example`,
  `docker-compose.yml` — porta do Postgres remapeada de `5432` para
  `5433` (ver Seção 15, bloqueio externo).

## 7. Repository/Service

- **Repository** (`tenancy.repository.ts`): único ponto de acesso a
  `prisma.tenant`/`prisma.organization`. Métodos com tipos de retorno
  explícitos (`Tenant`/`Organization`/`undefined`/`null`), tratamento
  explícito de not-found (`P2025`) e de unicidade (`P2002`, deixado
  propagar para o chamador testar/tratar). Nenhum `any` na assinatura
  pública — o `any` pré-existente do proxy `services/prisma.ts` (já
  documentado e aceito no projeto) é a única fronteira não tipada, igual
  ao resto do código-base.
- **Service**: o próprio `control-plane-store.ts` cumpre esse papel para
  esta entidade — contém a única regra de negócio (o workspace/ambientes
  padrão criados ao criar uma Organization) e delega toda persistência ao
  repository. Não foi criado um terceiro arquivo `*.service.ts` separado
  porque o store já era, na prática, essa camada — duplicá-la seria
  abstração sem necessidade.

## 8. Transações

`tenancyRepository.createOrganization()` usa `prisma.$transaction(async
(tx) => {...})`: dentro da transação, verifica que o `tenantId` informado
(quando presente) corresponde a um Tenant real e não deletado, e só então
insere a Organization. Se a verificação falhar, nada é inserido.

Não foi encontrada nenhuma outra operação dentro de Tenant/Organization
que escreva mais de uma tabela Postgres ao mesmo tempo — cada CRUD
restante é uma única instrução SQL, atômica por natureza. A cascata de
Workspace + 3 Environments ao criar uma Organization permanece em memória
(fora de escopo) e roda **depois** do commit da transação Postgres —
comportamento equivalente ao anterior à migração (nunca foi atômica com
nada, porque tudo era memória).

## 9. Isolamento tenant

Não existe, neste sistema, um papel de usuário com credenciais escopadas a
um único Tenant que possa acessar estas rotas — o Control Plane é operado
por staff SUPER*ADMIN-like, global por desenho (confirmado explicitamente
na Sprint 46.16: *"SUPER*ADMIN is global by design — respect that, don't
invent an incompatible isolation rule"*). A propriedade testada é, por
isso, mais estreita e mais correta para este domínio: o **filtro**
`tenantId` usado por um operador global nunca vaza linhas de outro tenant,
e uma alteração por id nunca afeta uma linha diferente da endereçada. Ver
os 4 testes em `describe('Tenant-scoped query correctness (Etapa 7)')`.

## 10. Testes

- `control-plane-routes.test.ts` (pré-existente, 35 testes) — sem nenhuma
  asserção alterada; passam integralmente contra Postgres real.
- `tenancy-persistence.test.ts` (novo, 8 testes) — restart persistence (2),
  rollback transacional (2), concorrência (2), isolamento por tenant (2).
- `health-live-ready.test.ts` — atualizado para refletir `/health` e
  `/ready` reportando sucesso real.

## 11. Restart persistence (Etapa 8)

Duas provas independentes:

1. **Automatizada** — `tenancy-persistence.test.ts`: dados escritos por
   uma conexão Prisma são lidos por uma segunda instância de
   `PrismaClient`, completamente independente da que escreveu — só um
   round-trip real ao banco explica o resultado.
2. **Manual, processo real** — durante esta sprint: criado um Tenant via
   HTTP no processo `apps/api` rodando (PID vivo); processo **morto** via
   `taskkill /F`; processo **novo** iniciado do zero (`pnpm dev`, PID
   diferente, módulo `control-plane-store.ts` reinicializado do zero,
   incluindo seu `await controlPlaneStore.ready()` de topo de módulo);
   o mesmo Tenant, pelo mesmo id, consultado com sucesso pelo processo
   novo. Registro do id usado:
   `cmt7rzln20000wsef0iyfpe4w` (removido do banco ao final do teste).

## 12. Concorrência

`tenancy-persistence.test.ts`, `describe('Concurrency (Etapa 9)')`:

- duas criações de Tenant com o mesmo slug disparadas em paralelo
  (`Promise.allSettled`) — exatamente uma é bem-sucedida, a outra falha
  com `P2002` (constraint do Postgres, não um mutex em memória — funciona
  igualmente bem com duas instâncias reais da API apontando para o mesmo
  banco);
- cinco criações de Organization concorrentes sob o mesmo Tenant, slugs
  distintos — todas bem-sucedidas, ids todos distintos, nenhuma colisão.

## 13. Resultado dos gates

| Gate                                        | Resultado                    |
| ------------------------------------------- | ---------------------------- |
| Testes específicos (`control-plane/`)       | 43/43 PASS                   |
| apps/api completo                           | 1521/1521 PASS               |
| Monorepo (`turbo run test --force`)         | 30/30 tasks PASS             |
| TypeScript (`turbo run type-check --force`) | 64/64 tasks PASS             |
| ESLint (`turbo run lint --force`)           | 21/21 tasks PASS             |
| Build (`turbo run build --force`)           | 46/46 tasks PASS             |
| Browser E2E                                 | 41/41 PASS                   |
| Restart persistence                         | PASS (automatizado + manual) |
| Concorrência                                | PASS                         |
| Rollback transacional                       | PASS                         |
| Isolamento tenant-aware                     | PASS                         |

## 14. Limitações restantes

- `Project`, `Workspace`, `Environment`, `Runtime` (Agent), `Connector`,
  `Deployment`, `FeatureFlag` continuam em memória — deliberadamente fora
  de escopo desta sprint (Etapa 12). Um restart do processo apaga essa
  parte do estado, exatamente como antes da 46.19.
- O snapshot de Disaster Recovery (`ha/backup-service.ts`) não inclui mais
  Tenant/Organization — essa parte da persistência agora tem sua própria
  história de backup (pg_dump/pg_restore ou snapshot gerenciado do
  Postgres), em vez de ser serializada num JSON junto com o resto do
  estado em memória.
- Nenhum dos outros 5 módulos do Control Plane citados nas sprints
  46.16–46.18 (runtime-registration, erp-connectivity, erp-metadata,
  semantic-mapping, canonical-model) foi tocado — nenhum deles tem modelo
  Prisma equivalente hoje; criar esses modelos ficaria fora da regra
  "não altere o schema até comprovar que o modelo existente não é
  suficiente" combinada com "não invente modelos Prisma".

## 15. Bloqueio externo encontrado e resolvido

Este ambiente tinha **dois problemas de infraestrutura pré-existentes**
que impediam qualquer conexão Postgres real em qualquer sprint anterior
desta engagement — ambos resolvidos nesta sprint, não são workarounds
temporários:

1. **Docker Desktop não estava em execução** — iniciado nesta sessão.
2. **Postgres 15+ não concede `CREATE` no schema `public` ao dono do
   banco por padrão** — resolvido com um `GRANT` manual (imediato) e um
   script de inicialização automático (`docker/postgres-init/`, permanente
   para qualquer novo ambiente).
3. **Um serviço nativo do Windows (`postgres.exe`, não relacionado a este
   projeto) já escutava a porta 5432** — a porta host do container foi
   remapeada para `5433` (`docker-compose.yml`, `.env*`) em vez de tocar
   nesse serviço, que não pertence a este projeto.

Nenhum desses três itens bloqueia a conclusão da sprint — todos foram
resolvidos e validados de ponta a ponta (ver Seção 13).

## 16. Próxima etapa recomendada

Se a mesma abordagem for desejada para os demais módulos do Control
Plane, a ordem natural (sem modelo Prisma ainda existente para nenhum
deles) seria: desenhar os modelos `Runtime`/`ActivationKeyRecord` do
módulo `runtime-registration` primeiro (é o próximo elo da cadeia
Organization → Runtime já validada ponta-a-ponta pelo Browser E2E), depois
`ConnectionProfile` (erp-connectivity). `admin-identity` já tem modelos
prontos (`AtlasAdminUser` etc.) e pode ser migrado a qualquer momento sem
depender desta ordem — foi apenas descartado nesta sprint por não ser
tenant-scoped.
