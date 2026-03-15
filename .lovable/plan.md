
## Objetivo
Eliminar inconsistência do `useFeatureFlag` no frontend fazendo-o usar a mesma lógica de resolução de flags do backend (cascata **user > cohort > global**) via RPC `get_feature_flag`, em vez de consultar diretamente `feature_flags` com `scope = 'global'`.

## Escopo / Regras (seguindo seu pedido)
- Alterar **APENAS** `useFeatureFlag` em `src/hooks/useFeatureFlag.ts`
- **NÃO** alterar `useAllFeatureFlags`
- **NÃO** alterar edge functions
- **NÃO** alterar tabelas

## O que vou mudar (arquivo: `src/hooks/useFeatureFlag.ts`)
### 1) Importar e usar autenticação
- Adicionar `import { useAuth } from "@/hooks/useAuth";`
- Dentro do hook: `const { user, loading: authLoading } = useAuth();`

### 2) Trocar consulta direta por RPC `get_feature_flag`
Substituir o `queryFn` atual (que faz `.from("feature_flags")...eq("scope","global")...single()`) por:

- `supabase.rpc("get_feature_flag", { p_flag_name: flagName, p_user_id: user?.id || null, p_cohort_id: null })`
- Em caso de erro: `console.error("Feature flag error:", error); return false;`
- Retorno: `return data === true;`

### 3) Ajustar cache/atualização para reduzir “sumiço/aparecimento”
- `queryKey`: incluir o usuário para “bust” automático quando o auth mudar  
  `queryKey: ["feature-flag", flagName, user?.id]`
- Manter:
  - `staleTime: 30 * 1000`
  - `gcTime: 2 * 60 * 1000`
  - `refetchOnWindowFocus: true`
- Adicionar:
  - `refetchOnMount: true` (conforme solicitado)

### 4) Estado de loading consistente (evitar flicker na troca null → user)
- Retornar `loading: isLoading || authLoading` (continua dentro do escopo do `useFeatureFlag` e melhora a estabilidade visual durante bootstrap do auth)

## Resultado esperado
- O frontend passa a calcular “flag habilitada” exatamente como o backend (mesma função RPC já usada em `io-phase-manager`, `zyon-chat`, `io-session-feedback`).
- Flags por usuário e por cohort deixam de ser ignoradas.
- Reduz drasticamente o caso de UI “aparecer/desaparecer” por leitura global incompleta + timing de autenticação.

## Checklist de validação (manual)
1. Logar como um usuário comum e verificar se IO aparece quando `global=true`.
2. Setar `global=false` e criar uma flag `scope=user` para o usuário → IO deve aparecer só para ele.
3. Alternar usuário (logout/login) e confirmar que o comportamento acompanha o novo `userId` (queryKey muda).
4. Alternar aba do navegador e confirmar que volta atualizando (refetchOnWindowFocus).
