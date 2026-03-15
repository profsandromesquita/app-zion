

# Plano: Delete sessão + Fix staleTime do useFeatureFlag

## 1. Deletar sessão diária (via migração)

Executar SQL via migration tool:

```sql
DELETE FROM io_daily_sessions 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'staging_buscador1@test.com')
  AND session_date = CURRENT_DATE;
```

## 2. Alterar `src/hooks/useFeatureFlag.ts`

No `useFeatureFlag`:
- `staleTime: 5 * 60 * 1000` → `staleTime: 30 * 1000`
- `gcTime: 10 * 60 * 1000` → `gcTime: 2 * 60 * 1000`
- Adicionar `refetchOnWindowFocus: true`

No `useAllFeatureFlags`:
- `staleTime: 30 * 1000` já está ok, manter
- Adicionar `refetchOnWindowFocus: true`

Nenhum outro arquivo alterado.

