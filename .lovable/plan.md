
## Objetivo (regra obrigatória)
Implementar de forma “à prova de falhas” a regra:

- **Cadastro == Igreja?**  
  - **Sim** → **NÃO** deve aparecer onboarding (nunca).  
  - **Não** → onboarding segue normal (apenas pessoas).

Hoje isso já foi “tentado” no `Chat.tsx`, mas ainda aparece onboarding porque **a identificação “igreja” nem sempre está garantida** (role pode não ter sido gravada, ou o usuário pode ter igreja criada mas sem role, etc.). Então vamos fazer a regra funcionar mesmo em cenários inconsistentes.

---

## Diagnóstico do porquê ainda aparece onboarding (causa mais provável)
Apesar do `Chat.tsx` já checar `user_roles`, o onboarding ainda pode surgir quando:

1. O usuário **não está com a role `igreja`** na tabela `user_roles` (por falha no fluxo de cadastro ou inconsistência de dados).
2. Mesmo sendo “igreja na prática” (tem registro em `churches`), o app está decidindo onboarding somente por `user_roles` e/ou `onboarding_completed_at`.
3. A checagem de onboarding acontece antes de a lógica “institucional” ficar estável, e o app entra no fluxo padrão.

A correção definitiva é: **não depender de um único sinal** (role) e sim ter um “detector institucional” robusto.

---

## Entrega (o que será mudado)
### Parte 1 — Garantir a regra no Chat (independente de role)
**Arquivo:** `src/pages/Chat.tsx`

1) **Parar de decidir onboarding apenas por `user_roles`** (ou por um fetch pontual).  
2) Introduzir uma lógica única e clara no `checkOnboardingAndInit()`:

**Regra final no Chat:**
- Se o usuário é **igreja** → **não mostrar onboarding**, inicializar chat imediatamente.
- Caso contrário → aplicar regra padrão (se `onboarding_completed_at` é nulo, mostra onboarding).

**Como detectar “igreja” de forma robusta:**
- Prioridade 1: `user_roles` contém `'igreja'`
- Prioridade 2 (fallback): existe registro em `churches` com `pastor_id = user.id`  
  - Se existir, então o usuário é igreja “na prática”, e o app deve:
    - **pular onboarding** imediatamente
    - (opcional, mas recomendado) tentar “consertar” a role automaticamente chamando `add_user_role` para incluir `'igreja'` (best-effort, sem quebrar o fluxo)

3) Garantir que **mesmo que `showOnboarding` já esteja true**, ao detectar igreja o app:
- fecha o onboarding (`setShowOnboarding(false)`)
- segue para `initAuthenticatedSession()`

Resultado: **não importa o estado do `user_profiles`** — igreja nunca verá onboarding.

---

### Parte 2 — Garantir que Igreja receba role “igreja” corretamente no cadastro (fonte da verdade)
**Arquivo:** `src/components/auth/ChurchSignupForm.tsx`

1) No `signUp`, adicionar metadado explícito para o tipo de conta:
- `account_type: "igreja"` (ou nome equivalente consistente)

2) Isso permite que o backend crie a role correta já no nascimento do usuário.

---

### Parte 3 — Ajustar o backend para setar role correta no momento do signup
**Arquivos:** `supabase/migrations/...sql` (nova migration)

Hoje existe a função `public.handle_new_user()` (SECURITY DEFINER) que roda no signup e **insere sempre** role `'buscador'`. Vamos tornar isso inteligente:

1) Atualizar `public.handle_new_user()` para:
- Ler `NEW.raw_user_meta_data ->> 'account_type'`
- Se for `"igreja"` → inserir role `'igreja'`
- Caso contrário → inserir role `'buscador'`

2) (Opcional, mas recomendado pela regra) Se `account_type = 'igreja'`:
- já marcar `user_profiles.onboarding_completed_at = now()`  
  Mesmo que o Chat vá pular onboarding, isso evita qualquer fluxo futuro depender desse campo e “reabrir” onboarding por acidente.

Isso torna a regra verdadeira desde a origem: “nasceu igreja → nunca entra em onboarding”.

---

### Parte 4 — Corrigir usuários já criados (backfill)
**Arquivo:** `supabase/migrations/...sql` (na mesma migration ou outra)

Para corrigir dados existentes (igrejas cadastradas antes do ajuste), criar um backfill seguro:

1) Inserir role `'igreja'` para todo `pastor_id` que já tenha uma igreja:
- `INSERT INTO user_roles (user_id, role) SELECT pastor_id, 'igreja' FROM churches ... ON CONFLICT DO NOTHING`

2) (Opcional) marcar onboarding como completo nesses usuários igreja:
- `UPDATE user_profiles SET onboarding_completed_at = now() WHERE id IN (SELECT pastor_id FROM churches ...) AND onboarding_completed_at IS NULL`

---

## Sequência de implementação (ordem obrigatória)
1) **Migration**: atualizar `handle_new_user()` + backfill (Parte 3 e 4)  
2) **Frontend**: atualizar `Chat.tsx` com “detector institucional” (Parte 1)  
3) **Frontend**: atualizar `ChurchSignupForm.tsx` para setar `account_type: 'igreja'` no signup (Parte 2)  

---

## Critérios de aceite (testes obrigatórios)
1) Criar um novo cadastro de **Igreja** e entrar em `/chat`:
- **Onboarding não aparece** em nenhum momento.
2) Fazer login com um usuário “igreja antigo” (já existente):
- **Onboarding não aparece** (mesmo que `onboarding_completed_at` esteja null).
3) Criar um usuário normal (não igreja):
- onboarding aparece normalmente se não tiver completado.
4) Recarregar a página várias vezes em `/chat`:
- igreja nunca cai no onboarding (sem “piscar” ou intermitência).

---

## Observações de segurança
- Roles continuam exclusivamente na tabela `user_roles` (como exigido).
- A função `add_user_role` já valida `_user_id = auth.uid()` (isso é essencial e será mantido).
- O backfill só usa relações já existentes (`churches.pastor_id`) e não abre brechas de privilégio.

---

## Arquivos envolvidos
- `src/pages/Chat.tsx` (regra final: igreja nunca tem onboarding, com fallback via `churches`)
- `src/components/auth/ChurchSignupForm.tsx` (setar metadata `account_type: 'igreja'`)
- `supabase/migrations/<nova>.sql` (atualizar `handle_new_user` + backfill de roles + (opcional) marcar onboarding como completo para igrejas)
