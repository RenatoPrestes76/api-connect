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
`agent/` (o daemon real) e `runtime/node.exe` (Node v20.20.2, win-x64,
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
   (Requer um `profileId` de conexão já configurado — ver
   `docs/ATLAS-RUNTIME-CLIENT.md` se isso ainda não existir no seu
   ambiente de teste.)
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

## 7. Matar o processo — o serviço reinicia sozinho

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

## 8. Desinstalar sem deixar lixo

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

| Item                            | Resultado     | Observações |
| ------------------------------- | ------------- | ----------- |
| 1. Instalar                     | ☐ OK ☐ Falhou |             |
| 2. Serviço sobe                 | ☐ OK ☐ Falhou |             |
| 3. Sobrevive a reboot           | ☐ OK ☐ Falhou |             |
| 4. Lê credenciais do instalador | ☐ OK ☐ Falhou |             |
| 5. Heartbeat chega na nuvem     | ☐ OK ☐ Falhou |             |
| 6. Fila reenvia sem duplicar    | ☐ OK ☐ Falhou |             |
| 7. Reinicia após kill           | ☐ OK ☐ Falhou |             |
| 8. Desinstala sem lixo          | ☐ OK ☐ Falhou |             |

## Nota sobre o protocolo de ativação antigo

O protocolo antigo (`/api/v1/activate` + CRUD de `activation-tokens`) foi
**removido** do servidor e do instalador na Sprint A2.5 — ele nunca era
chamado pelo daemon real (`apps/agent/src/atlas-runtime-client/`), que
sempre usou o protocolo Ed25519 via `organizationCode`/
`atlasActivationKey`. O wizard não pede mais nenhum "activation token";
o passo 1 deste roteiro já reflete isso. Ver o commit de remoção para a
lista completa do que dependia do protocolo antigo.
