

# Correção de Segurança — Feature Flag io_phase_manager_enabled

## Estado Atual

Verifiquei o banco agora:
- ✅ Flag global `io_phase_manager_enabled` já está **false** (não precisa de UPDATE)
- ❌ Não existe flag com scope `user` para o staging_admin

## Ação Necessária

Executar apenas o INSERT da flag user-scoped:

```sql
INSERT INTO public.feature_flags (flag_name, flag_value, scope, scope_id, description)
VALUES (
  'io_phase_manager_enabled', 
  true, 
  'user', 
  'c0b6ae4a-72d7-4f28-a7ee-372324d621c2',
  'Ativado apenas para staging_admin no ambiente de teste'
)
ON CONFLICT (flag_name, scope, scope_id) DO NOTHING;
```

Após execução, o resultado esperado será:
- `global / false` — protege produção
- `user / true / c0b6ae4a-...` — habilita apenas para staging_admin

A cascata do `get_feature_flag` resolve: user > cohort > global, então o staging_admin terá a flag ativa e todos os demais terão false.

