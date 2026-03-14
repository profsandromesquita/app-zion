

# Plano de Correcao: Fluxo de Testemunho e Aprovacao de Soldados

## Diagnostico Confirmado

Dados reais do banco confirmam os problemas:
- **1 candidatura travada** em `under_review` com testemunho em `processing` (nunca processado, sem transcrição nem analise)
- **0 usuarios com role `pastor`** no sistema -- aprovacao tripla e impossivel
- A pagina de curadoria (`TestimonyCuration`) exige role `admin` via `AdminRoute`, bloqueando `profissional` e `pastor`
- O envio de testemunho NAO dispara `process-testimony` automaticamente
- O card de aprovacao (`ApplicationApprovalCard`) nao mostra feedback sobre quais aprovacoes faltam quando o usuario ja aprovou

---

## Ordem de Deploy (5 etapas)

### Etapa 1: Migration -- Flexibilizar aprovacao tripla

**Problema:** Sem pastor no sistema, nenhuma candidatura pode ser aprovada.

**Solucao:** Criar uma funcao que verifica aprovacao com logica flexivel: se nao existe usuario com role `pastor` no sistema, a aprovacao de pastor e dispensada. O trigger `check_soldado_approval_complete` sera atualizado.

```text
Logica da nova funcao check_soldado_approval_complete:
  - admin_approved = obrigatorio
  - profissional_approved = obrigatorio
  - pastor_approved = obrigatorio SE existir pelo menos 1 usuario com role 'pastor'
  - Se nao existir pastor, aprovacao completa com admin + profissional
```

**SQL (migration):**
- Recriar a funcao `check_soldado_approval_complete` com a logica condicional
- Atualizar a funcao `get_application_approval_status` para refletir o campo `pastor_required`

---

### Etapa 2: Edge Function -- Auto-processar testemunho apos envio

**Problema:** O testemunho e inserido com status `processing` mas a Edge Function `process-testimony` nunca e chamada automaticamente.

**Solucao:** Adicionar chamada a `process-testimony` no frontend imediatamente apos o INSERT do testemunho em `SoldadoTestimony.tsx`.

**Arquivo:** `src/pages/SoldadoTestimony.tsx`
- Apos o INSERT bem-sucedido na tabela `testimonies` (linha ~213), invocar:
  ```typescript
  supabase.functions.invoke("process-testimony", {
    body: { testimony_id: insertedId }
  });
  ```
- Sera fire-and-forget (nao bloqueia a UX de sucesso)
- Requer retornar o `id` do INSERT (usar `.select('id').single()`)

---

### Etapa 3: UI -- Abrir curadoria para profissional e pastor

**Problema:** `TestimonyCuration.tsx` usa `AdminRoute` que bloqueia profissional e pastor.

**Solucao:** Trocar `AdminRoute` por `RoleRoute` com roles permitidas.

**Arquivo:** `src/pages/admin/TestimonyCuration.tsx`
- Substituir `<AdminRoute>` por `<RoleRoute allowedRoles={["admin", "desenvolvedor", "profissional", "pastor"]}>`
- Importar `RoleRoute` no lugar de `AdminRoute`

---

### Etapa 4: UI -- Feedback de aprovacoes pendentes no card

**Problema:** Apos o admin aprovar, o card some os botoes sem explicar o que falta.

**Solucao:** Adicionar mensagem contextual em `ApplicationApprovalCard.tsx`.

**Arquivo:** `src/components/soldado/ApplicationApprovalCard.tsx`
- Quando `canApprove === false` e `status === "under_review"`:
  - Mostrar banner informativo: "Sua aprovacao foi registrada. Aguardando: [lista de roles pendentes]"
  - Calcular roles pendentes a partir de `application.approvals`

---

### Etapa 5: UI -- Guardar curadoria antes de aprovacao

**Problema:** O curador pode aprovar a candidatura ANTES do testemunho ser processado pela IA (status `processing`).

**Solucao:** No `TestimonyCurationCard.tsx`, ja existe logica parcial (`canTakeAction` verifica `analyzed || processing`). Ajustar para:
- Botoes de "Aprovar"/"Rejeitar" so aparecem quando `testimony.status === "analyzed"`
- Quando `processing`, mostrar apenas botao "Processar" e mensagem de aguardo
- Remover `processing` da condicao `canTakeAction` para acoes de curadoria

**Arquivo:** `src/components/soldado/TestimonyCurationCard.tsx` (linha 331-333)
```typescript
// ANTES:
const canTakeAction = approverRole !== null && 
  (testimony.status === "analyzed" || testimony.status === "processing");

// DEPOIS:
const canTakeAction = approverRole !== null && testimony.status === "analyzed";
```

---

## Resumo de Arquivos Impactados

| Arquivo | Tipo de Mudanca |
|---|---|
| Nova migration SQL | Recriar trigger de aprovacao flexivel |
| `src/pages/SoldadoTestimony.tsx` | Chamar process-testimony apos envio |
| `src/pages/admin/TestimonyCuration.tsx` | Trocar AdminRoute por RoleRoute |
| `src/components/soldado/ApplicationApprovalCard.tsx` | Feedback de aprovacoes pendentes |
| `src/components/soldado/TestimonyCurationCard.tsx` | Bloquear curadoria antes da analise |

## Riscos e Mitigacoes

- **Risco:** Flexibilizar pastor pode permitir aprovacao prematura.
  **Mitigacao:** A logica so dispensa pastor se literalmente nao existe nenhum usuario com essa role no sistema. Quando um pastor for cadastrado, a exigencia volta automaticamente.

- **Risco:** Chamada fire-and-forget do process-testimony pode falhar silenciosamente.
  **Mitigacao:** O botao "Processar" na tela de curadoria ja existe como fallback manual.

