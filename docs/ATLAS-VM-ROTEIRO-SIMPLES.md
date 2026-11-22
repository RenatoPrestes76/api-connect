# Roteiro de Teste do Atlas Runtime na VM — passo a passo, em linguagem simples

> Este roteiro é o mesmo teste de `docs/ATLAS-SMOKE-TEST.md`, só que organizado na ordem que você pediu e escrito sem jargão. Os resultados de cada passo aqui mapeiam direto para os itens do `ATLAS-SMOKE-TEST.md` (indicado entre parênteses) — é esse outro arquivo que eu preencho depois que você me mandar o que aconteceu em cada passo.

## Antes de começar

Parta do snapshot "Windows limpo com rede e adicionais" (a VM já tem rede funcionando e os Guest Additions instalados — não precisa reinstalar nada disso).

Confirme que você tem estas 5 coisas prontas **antes** do Passo 1 (se alguma não existir ainda, veja `docs/ATLAS-SMOKE-TEST.md`, seção "Antes de começar", itens 2, 3, 5, 6, 7 — lá estão os comandos para criar cada uma):

- [ ] O pacote do Runtime (`dist-runtime-package.zip`) copiado para dentro da VM e descompactado (ex: em `C:\atlas-package\`).
- [ ] O banco de teste do ERP (`supermais-micro-erp`) rodando e acessível da VM em `10.0.2.2:5434`, com o usuário somente-leitura `atlas_readonly` já criado.
- [ ] A nuvem Atlas acessível da VM (anote a URL — é o que você vai digitar na Etapa 2/6 do instalador).
- [ ] Uma organização + chave de ativação já emitidas na nuvem Atlas (`POST /admin/runtime-registration/activation-keys`). Anote os dois valores: `organizationCode` e `activationKey` — vai usá-los no Passo 1.
- [ ] A senha do usuário `atlas_readonly` em mãos (vai digitar na Etapa 4/6 do instalador — só aparecem `*` na tela, nunca o texto real).

**Onde olhar se algo der errado, em qualquer passo:**

| O que você quer saber                              | Onde olhar                                                                                                                 |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| O instalador deu erro                              | `C:\ProgramData\Seltriva\Atlas\logs\installer.log`                                                                         |
| O serviço está rodando?                            | `Get-Service AtlasRuntime` (olhe a coluna `Status`)                                                                        |
| O que o serviço está fazendo agora / por que parou | `C:\ProgramData\Seltriva\Atlas\agent\dist\cli\daemon\atlasruntime.out.log` (saída normal) e `atlasruntime.err.log` (erros) |
| O serviço está mesmo registrado no Windows         | `sc.exe query atlasruntime.exe` (note o `.exe` no final — é assim que o Windows registrou o nome por baixo dos panos)      |

---

## Passo 1 — Instalar

**O que fazer:**

```powershell
cd C:\atlas-package
.\runtime\node.exe .\dist\index.js
```

Responda o assistente (6 etapas):

1. Runtime identity — nome/hostname/ambiente à sua escolha.
2. API connection — a URL da nuvem Atlas que você anotou.
3. Atlas runtime enrollment — o `organizationCode` e a `activationKey` que você anotou.
4. ERP database connection — responda **Yes**, `dbType: postgres`, host `10.0.2.2`, porta `5434`, banco `supermais_erp_test`, usuário `atlas_readonly`, senha do `atlas_readonly`.
5. Service installation — **Yes** para instalar como serviço, **Yes** para iniciar automaticamente no boot.
6. Confirm — confira o resumo e confirme.

**O que deve acontecer:**

- O assistente termina sem nenhuma mensagem de erro.
- Ele mesmo já tenta iniciar o serviço no final — e deve conseguir, sem pedir para você abrir outro terminal (essa era a falha que corrigimos agora).
- `Get-Service AtlasRuntime` mostra `Status: Running`.

**Se der errado:** abra `C:\ProgramData\Seltriva\Atlas\logs\installer.log` e me mande as últimas linhas. _(Mapeia para o item 1 e 1b do ATLAS-SMOKE-TEST.md.)_

---

## Passo 2 — Confirmar que a ativação aconteceu

A chave de ativação só é realmente consumida na nuvem quando o serviço liga e se registra pela primeira vez (isso acontece automaticamente, logo depois do Passo 1 — não é um passo manual separado no instalador).

**O que fazer:** na nuvem Atlas (painel admin ou API), consulte a lista de runtimes da sua organização:

```
GET /admin/runtime-registration/runtimes
```

**O que deve acontecer:**

- Aparece um runtime novo com o nome que você deu no Passo 1.
- O status dele é `REGISTERED` ou `ACTIVE` (não `PENDING` por muito tempo).
- Se você tentar emitir/consultar a mesma chave de ativação de novo, ela aparece como usada (`used: true`).

**Se der errado:** confira `C:\ProgramData\Seltriva\Atlas\agent\dist\cli\daemon\atlasruntime.err.log` — é lá que aparece se o registro com a nuvem falhou (ex: chave errada, API inalcançável). _(Faz parte do item 1 do ATLAS-SMOKE-TEST.md — o registro acontece dentro do mesmo fluxo de instalação.)_

---

## Passo 3 — Conectar ao ERP de teste (porta 5434)

**O que fazer:** peça uma "descoberta" do banco do ERP para este runtime (precisa do `profileId` — se ainda não criou um perfil de conexão na nuvem, veja o item 4c do `ATLAS-SMOKE-TEST.md` antes de rodar isto):

```
POST /erp-metadata/discover
{ "runtimeId": "<runtimeId do Passo 2>", "organizationId": "<sua organização>", "profileId": "<profileId>" }
```

Espere uns segundos e confira o resultado:

```
GET /erp-metadata/requests/<requestId>
```

**O que deve acontecer:**

- `status: "COMPLETED"`.
- No schema retornado aparece a tabela `produtos`, com as colunas reais do banco de teste (`id`, `empresaId`, `codigoInterno`, `descricao`, etc.).
- **Importante:** isso prova que o Runtime leu a **estrutura** do banco de teste de verdade — não prova (ainda) que os valores de cada produto chegam na nuvem. Isso é esperado, não é falha.

**Se der errado:** confira `atlasruntime.err.log` (erro de conexão com o banco) e confirme com `Test-NetConnection -ComputerName 10.0.2.2 -Port 5434` que a VM alcança o banco. _(Item 7 do ATLAS-SMOKE-TEST.md.)_

---

## Passo 4 — Confirmar o sinal (heartbeat)

**O que fazer:**

```
GET /admin/runtime-registration/runtimes/<runtimeId>
```

Repita essa consulta duas ou três vezes, com uns 30-40 segundos de intervalo.

**O que deve acontecer:**

- `status: ACTIVE`.
- O campo `lastHeartbeat` muda de valor a cada consulta — prova que o serviço está realmente vivo e conversando com a nuvem continuamente, não só na instalação.

**Se der errado:** `atlasruntime.out.log` deve mostrar linhas repetindo a cada ~30s, algo como `heartbeat ok — status=ACTIVE`. Se não aparecerem, o serviço pode ter caído — confira `Get-Service AtlasRuntime`. _(Item 5 do ATLAS-SMOKE-TEST.md.)_

---

## Passo 5 — Desligar a rede e confirmar a fila offline

**O que fazer:**

1. Com a rede ainda ligada, peça mais uma descoberta (igual ao Passo 3) — isso cria um trabalho pendente.
2. Logo depois, desligue a rede da VM (desative o adaptador de rede, ou puxe o cabo virtual no VirtualBox).
3. Espere alguns minutos (o ciclo de sincronização roda a cada 5 minutos por padrão).

**O que deve acontecer:**

- Em `atlasruntime.out.log`, aparece uma linha dizendo que a sincronização falhou (algo como `sync failed: ...`) — e isso é o comportamento **esperado**, não um bug: a rede está desligada de propósito.
- O serviço **continua rodando** (`Get-Service AtlasRuntime` ainda mostra `Running`) — ele não deve cair só porque a rede caiu.
- Existe um arquivo `C:\ProgramData\Seltriva\Atlas\agent-data\atlas-runtime-queue.sqlite` — é onde o resultado pendente fica guardado enquanto não consegue enviar.

**Se der errado:** se o serviço parar de rodar (não só de sincronizar), isso é uma falha real — anote a última linha de `atlasruntime.err.log` antes da queda. _(Item 6 do ATLAS-SMOKE-TEST.md, primeira metade.)_

---

## Passo 6 — Religar a rede e confirmar o envio

**O que fazer:** religue a rede da VM e espere mais um ciclo de sincronização (até 5 minutos).

**O que deve acontecer:**

- Em `atlasruntime.out.log`, uma linha `flushedFromQueue=1` (ou similar) — o resultado que ficou pendente foi enviado com sucesso.
- Confira na nuvem (`GET /erp-metadata/requests/<requestId>` do Passo 5) que o status é `COMPLETED` **uma única vez** — não duplicado.

**Se der errado:** se o arquivo `atlas-runtime-queue.sqlite` continuar com o item pendente muito tempo depois da rede voltar, isso é falha — me avise. _(Item 6 do ATLAS-SMOKE-TEST.md, segunda metade.)_

---

## Passo 7 — Reiniciar o Windows e confirmar que o serviço sobe sozinho

**O que fazer:**

```powershell
Restart-Computer
```

Depois que o Windows terminar de ligar, **sem fazer login manualmente em nada relacionado ao Atlas**, espere um minuto e confira:

```powershell
Get-Service AtlasRuntime
```

**O que deve acontecer:**

- `Status: Running` — sozinho, sem ninguém precisar ligar nada à mão.
- `atlasruntime.out.log` deve ter uma nova linha `[atlas-runtime] Starting — ...` com horário depois do reboot.

**Se der errado:** se o status ficar `Stopped`, tente `Start-Service AtlasRuntime` manualmente e veja se funciona — se funcionar manualmente mas não automaticamente, é um problema de configuração de boot, não o mesmo bug que já corrigimos. _(Item 3 do ATLAS-SMOKE-TEST.md.)_

---

## Passo 8 — Desinstalar (o serviço para e é removido)

**O que fazer:**

```powershell
cd C:\atlas-package
.\runtime\node.exe .\dist\index.js uninstall
```

**O que deve acontecer:**

- `sc.exe query atlasruntime.exe` passa a dizer que o serviço não existe mais.
- Não sobra nenhum processo `node.exe` rodando de dentro de `C:\ProgramData\Seltriva\Atlas\` (confira com `Get-Process node` — não deve aparecer nada com esse caminho).
- A pasta `C:\ProgramData\Seltriva\Atlas\` **continua existindo** (isso é esperado — os dados não são apagados automaticamente, de propósito, para não perder a identidade do Runtime num desinstalar sem querer).

**Se der errado:** se o comando travar ou avisar que um arquivo está em uso, é justamente o tipo de problema que a correção desta sprint (parar o serviço antes de desinstalar) deveria ter eliminado — me avise se acontecer. _(Item 10 do ATLAS-SMOKE-TEST.md.)_

---

## Passo 9 — Reinstalar

**O que fazer:** sem apagar nada manualmente, rode o instalador de novo, do mesmo jeito do Passo 1 (pode usar a mesma chave de ativação só se ela ainda não tiver sido usada — senão, emita uma nova na nuvem).

**O que deve acontecer:**

- Funciona de novo, do zero, sem nenhum erro de "arquivo em uso" ou "serviço já existe".
- `Get-Service AtlasRuntime` mostra `Running` de novo, com um runtime novo (ou o mesmo, se reaproveitou a identidade) aparecendo ativo na nuvem.

**Se der errado:** se precisar, para garantir um recomeço 100% limpo, pode apagar `C:\ProgramData\Seltriva\Atlas\` manualmente antes de reinstalar — mas o objetivo deste passo é provar que **não precisa** disso. _(Confirma, na prática, que os itens 1 e 10 do ATLAS-SMOKE-TEST.md continuam funcionando em sequência, um depois do outro.)_

---

## Como me mandar o resultado

Para cada passo, só preciso de: **Passo N → OK ou Falhou**, e se falhou, a mensagem de erro (ou um print/trecho do log indicado). Eu uso isso para preencher a tabela "Resultado" do `docs/ATLAS-SMOKE-TEST.md`. Só depois de todos os passos aparecerem como OK eu abro o PR e faço o merge na `master`.
