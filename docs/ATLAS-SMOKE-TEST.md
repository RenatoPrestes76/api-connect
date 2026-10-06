# Atlas Runtime — Roteiro de Smoke Test Manual (VM Windows limpa)

> Sprint A2.5. Este roteiro é para ser executado **à mão**, por uma pessoa, numa
> VM Windows **sem Node.js pré-instalado** — é exatamente o cenário que o
> empacotamento autossuficiente (`scripts/package-runtime.mjs`) existe para
> validar. Nada neste documento foi automatizado; os resultados abaixo não são
> garantidos até alguém rodar isto de verdade numa VM de verdade.

## Antes de começar

### 1. Gere o pacote (numa máquina de desenvolvimento, não na VM)

```powershell
node scripts/package-runtime.mjs dist-runtime-package
```

Isso produz `dist-runtime-package/` com `dist/index.js` (instalador),
`agent/` (o daemon real) e `runtime/node.exe` (Node v24.21.0, win-x64,
checksum verificado). Copie essa pasta inteira para a VM (zip + transferência,
pendrive, pasta compartilhada — qualquer meio).

### 2. Provisione uma organização + chave de ativação

Na nuvem Atlas (`apps/api`), autenticado como admin:

```
POST /admin/runtime-registration/activation-keys
{ "organizationCode": "ORG-TESTE" }
```

Guarde o `organizationCode` e o `activationKey` retornado — são o que o
instalador vai pedir no wizard. (Ver `docs/ATLAS-RUNTIME-CLIENT.md`.)

### 3. Confirme que a VM alcança a nuvem Atlas

Da VM: `curl https://<seu-atlas-api>/health` deve responder 200. Se a nuvem
roda localmente (fora da VM), confirme que a URL usada é alcançável da VM
(não `localhost`).

### 4. Confirme que a VM está mesmo limpa

```powershell
Get-Command node -ErrorAction SilentlyContinue
```

Deve retornar vazio/erro. Se houver um Node instalado, o teste de
autossuficiência (item 1 abaixo) fica inconclusivo — desinstale-o primeiro.

### 5. Suba o banco do micro ERP de teste (isolado, sem Supabase)

O ERP de teste é o `supermais-micro-erp` (`d:\Projetos\supermais-micro-erp`
nesta máquina de desenvolvimento) — um ERP real, com schema/migrations
reais, não um Postgres genérico. O que muda aqui é **onde** o schema é
aplicado: um Postgres isolado em Docker, nunca o Supabase de produção
daquele repositório.

Numa máquina de desenvolvimento (ou dentro da própria VM, se ela tiver
Docker — qualquer um funciona, desde que a VM alcance a porta exposta;
ver item 7):

```powershell
docker run -d --name supermais_erp_test_postgres `
  -e POSTGRES_USER=supermais_test `
  -e POSTGRES_PASSWORD=supermais_test_password `
  -e POSTGRES_DB=supermais_erp_test `
  -p 5434:5432 `
  postgres:16-alpine
```

`5434` (não `5432`/`5433`) propositalmente — evita colidir com qualquer
Postgres nativo do Windows ou com o `seltriva_postgres` que o
`docker-compose.yml` deste repositório já usa em `5433`.

Aplique o schema real do ERP (migrations já existentes no repositório,
não um `db push` especulativo) e semeie dados fictícios:

```powershell
cd d:\Projetos\supermais-micro-erp
$env:DATABASE_URL = "postgresql://supermais_test:supermais_test_password@localhost:5434/supermais_erp_test"
$env:DIRECT_URL = $env:DATABASE_URL   # sem pgBouncer aqui — mesmo valor das duas
npx prisma migrate deploy
npx prisma db seed
```

**Esperado:** `prisma migrate deploy` aplica as 8 migrations existentes
sem erro; `prisma db seed` termina com `Seed da Rede Super Mais Atacarejo
concluído.` — cria a empresa fictícia "Rede Super Mais Atacarejo Ltda",
10 filiais e 8 produtos (`P001`..`P008`, ex.: `"Arroz Branco 5kg"`), todos
inventados (ver `prisma/seed.mjs` nesse repositório — o próprio arquivo
documenta que nunca deve rodar contra o banco remoto real).

**Isolamento confirmado, não assumido:** o container acima não tem
nenhuma referência a `NEXT_PUBLIC_SUPABASE_URL`/chaves do Supabase — só
`DATABASE_URL`/`DIRECT_URL` apontando para o container local. Para
confirmar que não há vazamento acidental:

```powershell
docker exec supermais_erp_test_postgres psql -U supermais_test -d supermais_erp_test -c "SELECT inet_server_addr(), current_database();"
```

**Esperado:** endereço do próprio container (não um host externo) e
`current_database = supermais_erp_test`.

### 6. Crie o usuário somente leitura no banco do micro ERP

Mesmo padrão já documentado em `docs/ATLAS-RUNTIME-CLIENT.md` ("Database
access requirements"), aplicado às tabelas reais do `supermais-micro-erp`
(`produtos`, `empresas`, `filiais`, etc. — nomes via `@@map` no
`prisma/schema.prisma` daquele repositório):

```powershell
docker exec -it supermais_erp_test_postgres psql -U supermais_test -d supermais_erp_test
```

```sql
CREATE ROLE atlas_readonly WITH LOGIN PASSWORD 'troque-por-uma-senha-forte';
GRANT CONNECT ON DATABASE supermais_erp_test TO atlas_readonly;
GRANT USAGE ON SCHEMA public TO atlas_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO atlas_readonly;
-- Para que tabelas criadas depois (novas migrations) continuem somente leitura:
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO atlas_readonly;
```

**Esperado:** os 4 comandos rodam sem erro. Confirme que a role não tem
nenhum privilégio de escrita:

```sql
\dp produtos
```

**Esperado:** a linha de `atlas_readonly` nos "Access privileges" mostra
só `r` (SELECT) — nunca `a`/`w`/`d` (INSERT/UPDATE/DELETE).

### 7. Rede: como a VM alcança o banco do micro ERP e a nuvem Atlas (VirtualBox)

Assumindo o adaptador de rede padrão do VirtualBox (**NAT**, não "NAT
Network" nem "Bridged") — o caso mais comum para uma VM de teste isolada:

- De **dentro da VM**, o host (onde o Docker e/ou a nuvem Atlas local
  estão rodando) é sempre alcançável no endereço fixo e documentado pelo
  próprio VirtualBox para esse modo: **`10.0.2.2`** — nunca `localhost`
  nem o IP real da rede do host (o NAT isola a VM numa sub-rede virtual
  própria).
- Banco do micro ERP: `10.0.2.2:5434` (a porta publicada no item 5).
- Nuvem Atlas, se também rodando localmente via este repositório
  (`docker compose up`, que expõe `apps/api` em `3001:3001`):
  `http://10.0.2.2:3001`. Se a nuvem Atlas estiver hospedada de verdade
  (não local), use a URL pública normalmente — o `10.0.2.2` só se aplica
  a serviços rodando no HOST.

De dentro da VM, confirme as duas rotas antes de seguir:

```powershell
Test-NetConnection -ComputerName 10.0.2.2 -Port 5434
Test-NetConnection -ComputerName 10.0.2.2 -Port 3001   # se a nuvem for local
```

**Esperado:** `TcpTestSucceeded: True` para ambas.

**Se falhar:** o Firewall do Windows no HOST (não na VM) é a causa mais
comum — o Docker Desktop no Windows normalmente já abre a porta
publicada para todas as interfaces, mas um firewall de terceiros pode
bloquear o adaptador virtual (`VirtualBox Host-Only`/NAT) especificamente.
Crie uma regra de entrada liberando a porta publicada (`5434`, e `3001`
se aplicável) para esse adaptador, ou temporariamente para "Rede
privada".

---

## 1. Instalar

```powershell
cd C:\caminho\para\dist-runtime-package
.\runtime\node.exe .\dist\index.js
```

Siga o wizard:

- Runtime name / Hostname / Ambiente / Connector type: valores à sua escolha
- API base URL: a URL da sua nuvem Atlas
- **Organization code** / **Atlas activation key**: os valores do passo 2
- Install as a system service? **Yes**
- Start automatically on boot? **Yes**

**Esperado:**

- O wizard completa sem erro.
- `C:\ProgramData\Seltriva\Atlas\` existe, com subpastas `agent\`,
  `runtime\`, `config\`, `agent-data\`, `logs\`, etc.
- `C:\ProgramData\Seltriva\Atlas\runtime\node.exe` existe (prova de que o
  instalador funcionou **sem precisar de Node já instalado na VM** — o
  próprio instalador só roda porque você apontou pro `node.exe` empacotado
  no passo acima).
- `sc query AtlasRuntime` mostra o serviço registrado, `STATE: RUNNING`.

**Se falhar:** confira `C:\ProgramData\Seltriva\Atlas\logs\installer.log`.

---

## 2. O serviço sobe

```powershell
Get-Service AtlasRuntime
```

**Esperado:** `Status: Running`.

Abra o Visualizador de Eventos do Windows ou
`C:\ProgramData\Seltriva\Atlas\logs\` — não há log de aplicação dedicado do
daemon ainda (ele loga em stdout/stderr, capturado pelo wrapper do
node-windows em `daemon\*.log` dentro da mesma pasta de instalação do
serviço). Confirme que aparecem linhas como:

```
[atlas-runtime] Starting — api=... host=...
[atlas-runtime] Daemon started — heartbeat and sync are now scheduled.
[atlas-daemon] Runtime rt_... registered
[atlas-daemon] heartbeat ok — status=ACTIVE
```

---

## 3. Reiniciar a VM e o serviço voltar sozinho

```powershell
Restart-Computer
```

Depois do boot completo, sem logar manualmente em nada relacionado ao Atlas:

```powershell
Get-Service AtlasRuntime
```

**Esperado:** `Status: Running` — o serviço subiu sozinho, sem ninguém
iniciá-lo manualmente (confirma que o Windows Service Control Manager está
de fato gerenciando isso, não um processo solto que só existia enquanto
alguém estava logado).

---

## 4. O serviço consegue ler as credenciais gravadas pelo instalador

Isto é o teste real do ajuste de escopo do DPAPI (Sprint A2.5): o
instalador grava a chave privada Ed25519 (`identity.json`) criptografada
com DPAPI `LocalMachine` — não `CurrentUser` — justamente porque quem
instala (você, interativamente) e quem roda o serviço (LocalSystem, por
padrão do `node-windows`) são contas Windows diferentes.

**Esperado, só de o item 2/3 acima já terem funcionado:** se o heartbeat
está chegando (próximo passo) com o `runtimeId` estável entre reinícios, a
service account já leu com sucesso o que o instalador gravou. Para
confirmar explicitamente:

```powershell
Get-Content "C:\ProgramData\Seltriva\Atlas\agent-data\atlas-runtime-identity.json" | ConvertFrom-Json | Select publicKeyPem, runtimeId, fingerprint
```

**Esperado:** o JSON tem `encryptedPrivateKey.scheme: "dpapi"` — nunca
`privateKeyPem` em texto puro — e `runtimeId` já preenchido (não `null`),
provando que o registro (que exige ler a chave privada pra assinar) já
aconteceu sob a conta do serviço.

### 4b. Um usuário comum da VM não consegue abrir esse arquivo

Além da criptografia DPAPI, o arquivo em si tem a ACL do NTFS restrita a
`SYSTEM` + `Administradores` (`restrictToSystemAndAdministrators` em
`apps/agent/src/security/credential-encryption.ts`) — um usuário padrão,
sem privilégio administrativo, não deve conseguir nem abrir o arquivo
(não é só "não consegue decifrar"; o sistema de arquivos já bloqueia a
leitura).

1. Crie (ou use) uma conta Windows **padrão, sem privilégio de
   administrador** na mesma VM:
   ```powershell
   net user atlas-standard-test "SenhaTeste123!" /add
   ```
2. Faça login nessa conta (RDP de outra máquina, ou `runas` sem elevação,
   ou troque de usuário na própria VM) e tente ler o arquivo:
   ```powershell
   Get-Content "C:\ProgramData\Seltriva\Atlas\agent-data\atlas-runtime-identity.json"
   ```
3. Confira a ACL efetiva de qualquer conta (não precisa estar logado nela):
   ```powershell
   icacls "C:\ProgramData\Seltriva\Atlas\agent-data\atlas-runtime-identity.json"
   ```

**Esperado:**

- No passo 2, a conta padrão recebe **"Acesso negado"** — nunca o
  conteúdo do arquivo.
- No passo 3, a lista mostra só `NT AUTHORITY\SYSTEM` e
  `BUILTIN\Administrators`(F) como concedidos — nenhuma outra conta
  (nem a `atlas-standard-test`, nem "Users"/"Authenticated Users"
  herdados) aparece.
- Ao final, remova a conta de teste: `net user atlas-standard-test /delete`.

### 4c. Configurar o runtime para ler o micro ERP (organização de teste)

A `organizationCode`/`atlasActivationKey` do passo 2 (seção "Antes de
começar") já é a organização de teste — isso o wizard já cobriu na
instalação. O que falta é apontar o runtime para o banco real do item 5:
isso é feito por variáveis de ambiente (`ATLAS_SCAN_DB_*`, ver
`apps/agent/src/cli/bin.ts` e `docs/ATLAS-RUNTIME-CLIENT.md`) que o
wizard **não** pede hoje — não existe campo para isso no instalador, só
no serviço Windows já instalado.

1. Pare o serviço antes de editar sua configuração:
   ```powershell
   Stop-Service AtlasRuntime
   ```
2. Edite o XML gerado pelo `node-windows`/WinSW — **não** o `.env`, que
   não existe para um serviço Windows; o WinSW lê este arquivo a cada
   início do serviço, então editar + reiniciar é suficiente (nenhuma
   necessidade de reiniciar a VM):
   ```powershell
   notepad "C:\ProgramData\Seltriva\Atlas\agent\dist\cli\daemon\atlasruntime.xml"
   ```
3. Adicione estas 5 linhas `<env>` como filhas diretas de `<service>`
   (ao lado das `<env>` que o instalador já gravou para
   `ATLAS_API_URL`/`ATLAS_ORGANIZATION_CODE`/etc. — não as remova):
   ```xml
   <env name="ATLAS_SCAN_DB_HOST" value="10.0.2.2"/>
   <env name="ATLAS_SCAN_DB_PORT" value="5434"/>
   <env name="ATLAS_SCAN_DB_NAME" value="supermais_erp_test"/>
   <env name="ATLAS_SCAN_DB_USER" value="atlas_readonly"/>
   <env name="ATLAS_SCAN_DB_PASSWORD" value="troque-por-uma-senha-forte"/>
   ```
   (Use o mesmo host/porta confirmados no item 7 e a mesma senha definida
   no item 6.)
4. Salve e reinicie o serviço:
   ```powershell
   Start-Service AtlasRuntime
   ```

Separadamente, crie também o **perfil de conexão** no lado da nuvem
Atlas — é um registro administrativo (nome/host/porta/credencial,
guardado em `apps/api`), usado para abrir jobs de descoberta; ele **não**
alimenta automaticamente as variáveis `ATLAS_SCAN_DB_*` do passo acima
(são dois lugares de configuração hoje, não um só — ver
`apps/agent/src/atlas-runtime-client/run.ts`: o runtime sempre usa seu
próprio `scanTarget` local, nunca lê de volta o que está salvo no
perfil). Mantenha os dois com os mesmos valores:

```
POST /erp-connectivity/profiles
{
  "runtimeId": "<runtimeId>",
  "organizationId": "<organizationId>",
  "name": "Super Mais — banco de teste",
  "erpName": "supermais-micro-erp",
  "dbType": "postgres",
  "host": "10.0.2.2",
  "port": 5434,
  "database": "supermais_erp_test",
  "username": "atlas_readonly",
  "password": "troque-por-uma-senha-forte"
}
```

Guarde o `profile.id` retornado — é o `profileId` usado nos itens 7 e 8
abaixo.

**Esperado:**

```powershell
Get-Service AtlasRuntime   # Status: Running de novo
```

e, nos logs (`daemon\*.log`), nenhuma linha `No scan target configured
on this Runtime` no próximo ciclo de sync — confirma que `ATLAS_SCAN_DB_*`
foi lido com sucesso.

---

## 5. Heartbeat chega na nuvem

No painel/admin da nuvem Atlas (ou via API: `GET
/admin/runtime-registration/runtimes/<runtimeId>`), confirme:

- `status: ACTIVE`
- `lastHeartbeat` atualizando a cada ~30s (padrão de
  `ATLAS_HEARTBEAT_INTERVAL_MS`).

---

## 6. Desligar a rede, gerar dados, religar — fila reenvia sem duplicar

1. **Com a rede ligada**, peça (via API admin, autenticado, permissão
   `erp-metadata.write`) um discovery job para este Runtime:
   ```
   POST /erp-metadata/discover
   { "runtimeId": "<runtimeId>", "organizationId": "<organizationId>", "profileId": "<profileId>" }
   ```
   (Requer o `profileId` criado no item 4c.)
2. **Desligue a rede da VM** (desative o adaptador, ou bloqueie a saída no
   firewall) logo após confirmar que o job foi criado.
3. Espere pelo menos um ciclo de sync completo (padrão: a cada 5 min —
   `ATLAS_SYNC_CRON_EXPRESSION`). Confirme nos logs que ele **falhou**
   (`sync failed: ...`) sem derrubar o serviço.
4. Religue a rede.
5. Espere o próximo ciclo de sync.

**Esperado:**

- Nos logs, uma linha `sync ok — jobs=1/1, flushedFromQueue=0` (o job foi
  buscado e completado) **ou**, se a falha de rede caiu bem no meio do
  envio do resultado, uma linha posterior `flushedFromQueue=1` (resultado
  que ficou na fila foi reenviado com sucesso).
- `C:\ProgramData\Seltriva\Atlas\agent-data\atlas-runtime-queue.sqlite`
  existe. Inspecione com o próprio `node.exe` empacotado:
  ```powershell
  .\runtime\node.exe -e "const db=require('./agent/node_modules/better-sqlite3')('C:\ProgramData\Seltriva\Atlas\agent-data\atlas-runtime-queue.sqlite'); console.log(db.prepare('SELECT * FROM pending_results').all())"
  ```
  **Esperado:** array vazio `[]` depois do reenvio — nada ficou pendente
  pra sempre.
- **Prova de que não duplicou:** confira o discovery request no admin da
  nuvem (`GET /erp-metadata/requests/<requestId>` ou equivalente) —
  `status: COMPLETED` **uma vez**, não duas classificações ATHENA
  diferentes pro mesmo request. Internamente, isso é garantido porque (a)
  a fila local é idempotente por `requestId` (chave primária) e (b) o
  servidor (`erp-metadata-store.ts`) já detecta um request em status
  terminal e devolve `reused: true` sem reprocessar.

---

## 7. Leitura ponta a ponta: o micro ERP aparece no Atlas na nuvem

Peça uma descoberta real contra o `profileId` criado no item 4c:

```
POST /erp-metadata/discover
{ "runtimeId": "<runtimeId>", "organizationId": "<organizationId>", "profileId": "<profileId>" }
```

Espere um ciclo de sync (ou force um: `Restart-Service AtlasRuntime` —
`ensureRegistered`/sync rodam de novo no próximo tick, não precisa
esperar o cron inteiro numa VM de teste). Depois:

```
GET /erp-metadata/requests/<requestId>
```

**Esperado:** `status: "COMPLETED"` e, no schema reportado, a tabela
`produtos` (mapeada de `Produto` no `prisma/schema.prisma` do
`supermais-micro-erp`) aparece com as colunas reais: `id`, `empresaId`,
`codigoInterno`, `codigoBarras`, `descricao`, `unidade`, `ativo`,
`createdAt`, `updatedAt` — exatamente o schema do banco semeado no item
5, lido ao vivo, não uma fixture.

**Importante — o que isso prova e o que não prova:** este é um teste de
**schema**, não de **dados de linha**. `executeDiscoveryScan`
(`apps/agent/src/atlas-runtime-client/executor.ts`) chama só
`driver.readSchema()`, e `DatabaseSchema`
(`packages/database-sdk/src/schema/metadata.ts`) carrega nome/colunas/
tipos/relações das tabelas — nunca os valores das linhas. Ou seja: isto
prova que o runtime leu de verdade a estrutura real do micro ERP (a
tabela `produtos` existe só porque o seed do item 5 rodou, então "aparecer"
já é uma prova de leitura ponta a ponta genuína) — mas o produto
específico cadastrado (ex. `"Arroz Branco 5kg"`) **não** viaja até o
Atlas hoje; só a existência/estrutura da tabela onde ele mora. Se o
objetivo for ver o valor literal de um produto chegar na nuvem, isso
ainda não existe no runtime atual — seria uma funcionalidade nova, fora
do escopo deste roteiro.

Para tornar a prova mais concreta de que é uma leitura **ao vivo** (não
cache/fixture): conectado como `supermais_test` (não `atlas_readonly` —
isso é DDL, a role somente leitura nem poderia), adicione uma coluna
nova em `produtos`:

```sql
ALTER TABLE produtos ADD COLUMN teste_smoke TEXT;
```

Repita o discovery e confirme que `teste_smoke` aparece no novo schema
reportado — prova que cada descoberta reflete o estado real e atual do
banco, não um resultado antigo reaproveitado.

---

## 8. Confirmar somente leitura: uma escrita pelo runtime é recusada

O runtime (`apps/agent`) nunca chama nada além de `readSchema()` — não
existe caminho de escrita no código do daemon para "tentar" diretamente.
A prova realista para um teste manual é confirmar a camada que
efetivamente impediria uma escrita **se** algum bug algum dia abrisse
esse caminho: a role `atlas_readonly` criada no item 6, a mesma que o
runtime usa de verdade (`ATLAS_SCAN_DB_USER` configurado no item 4c).

Da VM (ou de qualquer máquina que alcance `10.0.2.2:5434`), conecte **com
essas mesmas credenciais** e tente escrever:

```powershell
docker exec -it supermais_erp_test_postgres psql -U atlas_readonly -d supermais_erp_test
```

```sql
INSERT INTO produtos ("id", "empresaId", "codigoInterno", "descricao", "unidade")
VALUES ('teste-smoke-001', (SELECT id FROM empresas LIMIT 1), 'SMOKE-001', 'Produto de teste — não deveria existir', 'UN');
```

**Esperado:** Postgres recusa com `ERROR: permission denied for table
produtos` — a role nunca recebeu `INSERT`/`UPDATE`/`DELETE` (item 6:
`GRANT SELECT` é o único privilégio concedido). Confirme também que a
tabela `produtos` continua com a mesma contagem de linhas de antes
(`SELECT count(*) FROM produtos;` — deve ser 8, os produtos do seed).

Isto é a prova de nível de banco (a 3ª e última camada — ver
`docs/ATLAS-RUNTIME-CLIENT.md`, "Database access requirements"); as
outras duas camadas (`ReadOnlyAdapter` recusando qualquer query que não
seja `SELECT`, e a conexão abrindo com `default_transaction_read_only=on`)
já têm prova automatizada real em
`packages/database-sdk/src/__tests__/read-only-adapter.test.ts` e
`postgres-read-only-session.test.ts` — não precisam ser repetidas à mão
aqui.

---

## 9. Matar o processo — o serviço reinicia sozinho

```powershell
Get-Process node | Where-Object { $_.Path -like "*ProgramData\Seltriva*" } | Stop-Process -Force
```

Espere ~2-5 segundos (política de restart: `wait: 2s`, crescendo).

```powershell
Get-Service AtlasRuntime
```

**Esperado:** `Status: Running` de novo, com um novo PID — o wrapper do
node-windows detectou a morte do processo filho e relançou. Confira nos
logs um novo `[atlas-runtime] Starting — ...` após o horário do kill.

Repita isso algumas vezes (o limite configurado é `maxRestarts: 999` — não
deve esgotar num teste manual).

---

## 10. Desinstalar sem deixar lixo

```powershell
.\runtime\node.exe .\dist\index.js uninstall
```

**Esperado:**

- `sc query AtlasRuntime` → serviço não existe mais.
- Processo `node.exe` sob `C:\ProgramData\Seltriva\Atlas\` não aparece
  mais em `Get-Process`.
- O comando informa que a configuração continua em
  `C:\ProgramData\Seltriva\Atlas\` — **isso é esperado** (dados/identidade
  não são apagados automaticamente, por design, para não destruir a
  identidade do Runtime num desinstalar acidental). Para limpar de verdade:
  ```powershell
  Remove-Item -Recurse -Force "C:\ProgramData\Seltriva\Atlas"
  ```
- Depois dessa remoção manual, confirme que não resta nenhum registro de
  serviço (`sc query AtlasRuntime` → "serviço não existe") nem processo
  `node.exe` órfão.

---

## Resultado

Preencha ao executar:

| Item                                     | Resultado     | Observações |
| ---------------------------------------- | ------------- | ----------- |
| 1. Instalar                              | ☐ OK ☐ Falhou |             |
| 2. Serviço sobe                          | ☐ OK ☐ Falhou |             |
| 3. Sobrevive a reboot                    | ☐ OK ☐ Falhou |             |
| 4. Lê credenciais do instalador          | ☐ OK ☐ Falhou |             |
| 4b. Usuário comum não lê credencial      | ☐ OK ☐ Falhou |             |
| 4c. Runtime configurado p/ micro ERP     | ☐ OK ☐ Falhou |             |
| 5. Heartbeat chega na nuvem              | ☐ OK ☐ Falhou |             |
| 6. Fila reenvia sem duplicar             | ☐ OK ☐ Falhou |             |
| 7. Leitura ponta a ponta (schema do ERP) | ☐ OK ☐ Falhou |             |
| 8. Escrita pelo runtime é recusada       | ☐ OK ☐ Falhou |             |
| 9. Reinicia após kill                    | ☐ OK ☐ Falhou |             |
| 10. Desinstala sem lixo                  | ☐ OK ☐ Falhou |             |

## Nota sobre o protocolo de ativação antigo

O protocolo antigo (`/api/v1/activate` + CRUD de `activation-tokens`) foi
**removido** do servidor e do instalador na Sprint A2.5 — ele nunca era
chamado pelo daemon real (`apps/agent/src/atlas-runtime-client/`), que
sempre usou o protocolo Ed25519 via `organizationCode`/
`atlasActivationKey`. O wizard não pede mais nenhum "activation token";
o passo 1 deste roteiro já reflete isso. Ver o commit de remoção para a
lista completa do que dependia do protocolo antigo.
