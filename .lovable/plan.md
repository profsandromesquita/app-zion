

# Chat Header: Fase IO como subtítulo contextual

## Resumo
Substituir o subtítulo estático "Acolhimento" no header do chat pela fase IO oficial do usuário, quando a feature flag `io_prompt_adapter_enabled` estiver ativa.

## Alterações em `src/pages/Chat.tsx`

### 1. Imports (topo do arquivo)
- Adicionar `useFeatureFlag` de `@/hooks/useFeatureFlag`
- Adicionar `useQuery` de `@tanstack/react-query` (verificar se já está importado)

### 2. Constante de mapeamento (antes do componente)
```typescript
const PHASE_HEADER_SUBTITLES: Record<number, string> = {
  1: 'Percebendo o que sente',
  2: 'Separando o que é seu',
  3: 'Descobrindo seus padrões',
  4: 'Construindo constância',
  5: 'Restaurando vínculos',
  6: 'Assumindo sua vida',
  7: 'Vivendo com inteireza',
};
```

### 3. Hooks (dentro do componente)
```typescript
const { enabled: isIOEnabled } = useFeatureFlag("io_prompt_adapter_enabled");

const { data: ioPhase } = useQuery({
  queryKey: ['io-phase-header', user?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from('io_user_phase')
      .select('current_phase')
      .eq('user_id', user!.id)
      .maybeSingle();
    return data?.current_phase || null;
  },
  staleTime: 5 * 60 * 1000,
  enabled: isIOEnabled && !!user?.id,
});
```

### 4. Renderização (linha 1078)
Substituir `<p className="text-xs text-muted-foreground">Acolhimento</p>` por:
```tsx
<p className="text-xs text-muted-foreground">
  {isIOEnabled && ioPhase ? PHASE_HEADER_SUBTITLES[ioPhase] || 'Acolhimento' : 'Acolhimento'}
</p>
```

### Comportamento
- Flag ON + fase encontrada: mostra subtítulo IO (ex: "Separando o que é seu")
- Flag OFF ou fase null ou erro: mostra "Acolhimento" (comportamento atual)
- Query com staleTime de 5 min para performance

## Arquivo alterado
- `src/pages/Chat.tsx` (imports, constante, hooks, linha 1078)

