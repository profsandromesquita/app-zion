

## Plano: Tabela de Feature Flags

### Objetivo
Criar uma tabela `feature_flags` que permita ativar/desativar funcionalidades V2 (Método IO) sem afetar o comportamento V1 em produção. Essa tabela sera consultada tanto pelo frontend quanto pelas Edge Functions.

### Tabela: `feature_flags`

```sql
CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,          -- ex: 'io_daily_session', 'io_phase_manager'
  description text,                   -- descrição legível
  enabled boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'all',  -- 'all', 'staging', 'production'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode ler (edge functions usam service_role)
CREATE POLICY "Anyone can read flags" ON public.feature_flags
  FOR SELECT TO authenticated USING (true);

-- Apenas admin/dev pode gerenciar
CREATE POLICY "Admins can manage flags" ON public.feature_flags
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor'));

-- Trigger updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
```

### Dados iniciais (seed)

Inserir flags para cada funcionalidade V2 planejada, todas desabilitadas:

| key | description | enabled |
|---|---|---|
| `io_phase_manager` | Ativa o gerenciador de fases IO no zyon-chat | false |
| `io_daily_session` | Ativa sessão diária estruturada na UI | false |
| `io_igi_calculator` | Ativa cálculo do IGI | false |
| `io_prompt_adapter` | Usa prompt adaptado por fase IO no zyon-chat | false |
| `io_progress_ui` | Mostra progressão visual IO no perfil | false |

### Hook frontend: `useFeatureFlag`

```typescript
// src/hooks/useFeatureFlag.ts
export const useFeatureFlag = (key: string): { enabled: boolean; loading: boolean } => {
  // Query feature_flags where key = key
  // Retorna enabled com cache via react-query (staleTime: 5min)
}
```

### Uso nas Edge Functions

Nas edge functions, consultar via service_role antes de executar lógica V2:

```typescript
const { data } = await supabaseAdmin
  .from('feature_flags')
  .select('enabled')
  .eq('key', 'io_phase_manager')
  .single();

if (data?.enabled) {
  // lógica V2
} else {
  // lógica V1 (atual, intocada)
}
```

### Painel admin

Adicionar uma página `/admin/feature-flags` com toggle para cada flag, acessível apenas por admin/desenvolvedor.

### Resumo das entregas

1. Migration: criar tabela `feature_flags` com RLS e trigger
2. Seed: inserir 5 flags IO desabilitadas
3. Hook `useFeatureFlag` no frontend
4. Página admin `/admin/feature-flags` com toggles
5. Nenhuma alteração em edge functions neste passo

