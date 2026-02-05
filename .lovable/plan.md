
## O que eu investiguei (exaurindo as possibilidades relevantes)

### Fato 1 — O erro vem do banco (não do storage)
O erro `duplicate key value violates unique constraint "unique_active_testimony"` é disparado **na tabela `public.testimonies`** (não no bucket de arquivos).

Confirmação no backend:
- Constraint/índice: **`UNIQUE (user_id, application_id)`**
  - Consulta ao banco retornou: `unique_active_testimony UNIQUE (user_id, application_id)`
  - Também existe o índice `CREATE UNIQUE INDEX unique_active_testimony ... (user_id, application_id)`

Isso significa: **para um mesmo usuário + mesma candidatura, só pode existir 1 linha em `testimonies`**, independentemente de `status`.

### Fato 2 — Já existe um registro “bloqueando” a nova inserção
Na amostra real do banco, existe pelo menos 1 caso com:
- `user_id = 5273...`
- `application_id = 83ee...`
- `status = rejected`

Então, quando o candidato tenta reenviar, o `INSERT` falha porque o registro anterior continua existindo.

### Fato 3 — O seu frontend tenta apagar antes de inserir, mas esse DELETE não está autorizado
No `src/pages/SoldadoTestimony.tsx`, o fluxo atual é:

1) Upload do arquivo no storage (ok)  
2) createSignedUrl (ok)  
3) **DELETE em `public.testimonies`** (para limpar o anterior)  
4) INSERT novo

O problema: olhando as políticas atuais de RLS da tabela `public.testimonies`, existe:
- SELECT próprio ✅
- INSERT próprio ✅
- UPDATE próprio **só quando `status = 'uploading'`** ✅ (limitado)
- **DELETE próprio: NÃO existe** ❌

E o próprio schema confirma:
- “Currently users can't DELETE records from the table testimonies”

Resultado prático:
- o `.delete()` não remove nada (por RLS)
- o código não checa `deleteError`
- o `.insert()` bate na UNIQUE e explode com `unique_active_testimony`

### Outras hipóteses consideradas (e por que não são as mais prováveis)
1) **Duplo clique / duas submissões simultâneas**
   - Pode piorar, mas não explica o “sempre” acontecer mesmo com um único envio se já houver `rejected` no banco.
2) **`applicationId` errado / null**
   - Se fosse null, a UNIQUE não impediria múltiplos (Postgres permite múltiplos NULL em UNIQUE). Aqui o app usa `applicationId` e o erro acusa exatamente a constraint `(user_id, application_id)`.
3) **Trigger criando linha duplicada**
   - O trigger `on_testimony_created` só atualiza `soldado_applications`, não insere novo testimony.
4) **DELETE executa mas não “a tempo” (race)**
   - Mesmo se houvesse race, a causa primária continua sendo: hoje não existe permissão para o delete acontecer.

## Causa raiz (mais provável e evidenciada)
**O usuário não tem permissão (RLS) para deletar o próprio registro em `public.testimonies`.**  
Por isso o registro antigo permanece e o `INSERT` viola `unique_active_testimony`.

## Plano de correção (definitivo, com o menor risco)

### A) Backend (migração): permitir DELETE do próprio testimony no cenário correto
Criar uma migração SQL adicionando policy de DELETE para o usuário deletar o próprio testemunho **quando a candidatura estiver em `testimony_required`** (ou seja, quando o sistema explicitamente está pedindo reenvio).

Política sugerida (mais segura do que “pode deletar sempre”):
- Permite DELETE somente se:
  - `auth.uid() = testimonies.user_id`
  - `testimonies.application_id` pertence ao usuário
  - e `soldado_applications.status = 'testimony_required'`

Isso impede o candidato de apagar testemunhos que já estão sob curadoria/fluxo final.

### B) Frontend: tornar o erro impossível de “passar batido”
No `src/pages/SoldadoTestimony.tsx`:

1) **Checar e abortar se o DELETE falhar**
   - Capturar `{ error: deleteError }` do `.delete()`
   - Se `deleteError`, lançar/mostrar erro claro e **não executar o insert**

2) **Hard-guard contra múltiplos submits**
   - no início do `handleSubmit`, se `submitting === true`, retornar
   - isso reduz race por clique repetido

3) (Opcional, mas recomendado) **Log de diagnóstico**
   - `console.error` incluindo `deleteError` e `dbError` com contexto (`user.id`, `applicationId`)
   - só para garantir rastreabilidade em caso de outro bloqueio

### C) Teste de ponta a ponta (cenários que precisam passar)
1) **Primeiro envio** (sem registro existente): deve inserir normalmente.
2) **Regravação solicitada**:
   - existir linha antiga `rejected`
   - aplicação em `testimony_required`
   - novo envio deve:
     - deletar a linha antiga
     - inserir a nova sem violar UNIQUE
3) **Tentativa de deletar quando não deve**:
   - aplicação não está `testimony_required`
   - delete deve ser negado pelo backend (segurança ok)
4) **Clique duplo**:
   - não deve gerar duas tentativas concorrentes

## Arquivos/itens que serão alterados quando eu implementar
- `supabase/migrations/<nova_migracao>.sql`
  - adicionar a policy de DELETE na tabela `public.testimonies` (com condição pelo status da aplicação)
- `src/pages/SoldadoTestimony.tsx`
  - checar `deleteError`
  - guard `if (submitting) return;`

## Observação importante (para não cair em armadilha)
Uma alternativa seria trocar “DELETE+INSERT” por “UPSERT”.
Mas aqui isso é perigoso sem mudanças adicionais, porque:
- UPSERT em conflito vira UPDATE
- usuários hoje só podem UPDATE quando `status='uploading'`
- e além disso o trigger que linka a candidatura roda apenas em INSERT (não em UPDATE)
Então a solução mais simples e robusta para este desenho atual é:
**corrigir RLS de DELETE + validar erro no frontend.**
