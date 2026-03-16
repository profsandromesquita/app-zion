

# Mini Indicador de Jornada IO na Sidebar do Chat

## Resumo
Adicionar um micro-card clicável na sidebar (entre a lista de conversas e os links de navegação do footer) mostrando fase, IGI e streak do usuário quando `io_prompt_adapter_enabled = true`.

## Alterações

### 1. `src/pages/Chat.tsx` — Expandir query IO (linha 131)
Adicionar `igi_current` ao select da query existente:
```typescript
.select('current_phase, streak_current, total_sessions, last_session_date, igi_current')
```

Passar `ioPhaseData` e `isIOEnabled` como props para `ChatSidebar`.

### 2. `src/components/chat/ChatSidebar.tsx` — Receber props e renderizar card

**Props**: Adicionar `ioPhaseData` e `isIOEnabled` à interface `ChatSidebarProps`.

**Constante de nomes de fase** (antes do componente):
```typescript
const IO_PHASE_NAMES: Record<number, string> = {
  1: 'Consciência', 2: 'Limites', 3: 'Identidade', 4: 'Ritmo',
  5: 'Vitalidade', 6: 'Governo', 7: 'Plenitude',
};
```

**Mini card** — novo componente interno renderizado no `SidebarFooter`, ACIMA do `<Separator className="mb-2" />` (linha 526):

```text
┌──────────────────────────────┐
│ Fase 2 — Limites             │
│ ████░░░░░░ 3.0  ·  🔥 2     │
└──────────────────────────────┘
```

- Linha 1: `text-xs font-medium` — "Fase {N} — {nome}"
- Linha 2: `text-xs text-muted-foreground` — micro barra (div com width%) + valor IGI + " · " + Flame icon + streak (ou "—" se 0)
- Caso novo (igi=0, total_sessions=0): "Complete sua primeira sessão" em vez de barra/streak
- Clicável → `navigate('/profile')`, hover `bg-muted/50`
- Estilo: `bg-muted/30 border border-border/50 rounded-lg p-3 mx-2 mb-2 cursor-pointer`
- Condicional: só renderiza quando `isIOEnabled && ioPhaseData`
- Desaparece com sidebar colapsada (`!collapsed`)

### 3. Onde renderizar na sidebar
No `SidebarFooter` (linha 525), ANTES do primeiro `<Separator>`:

```tsx
<SidebarFooter className="p-2">
  {/* NOVO: Mini Journey Card */}
  {!collapsed && isIOEnabled && ioPhaseData && (
    <JourneyMiniCard ... />
  )}
  <Separator className="mb-2" />
  {/* links existentes inalterados */}
```

## Arquivos alterados
- `src/pages/Chat.tsx` (adicionar `igi_current` à query + passar props)
- `src/components/chat/ChatSidebar.tsx` (nova prop, constante, mini card)

