

# Plano: Grupos de Histórico Colapsáveis com Design Estilo Dashboard

## Referência Visual

A imagem mostra um design com:
- Fundo gradiente verde (emerald → lime)
- Ícone à esquerda do texto
- Bordas arredondadas (`rounded-lg`)
- Texto branco sobre o gradiente

## Solução: Grupos Colapsáveis

Transformar cada cabeçalho temporal em um **trigger clicável** que expande/recolhe as conversas dentro daquele período.

---

## Mudanças Técnicas

### 1. Adicionar Import do Collapsible

```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
```

### 2. Adicionar State para Controlar Grupos Abertos

```tsx
const [openGroups, setOpenGroups] = useState({
  today: true,
  lastWeek: true,
  lastMonth: false,
  older: false,
});
```

### 3. Criar Componente de Header do Grupo

Estilo baseado na imagem (gradiente verde, ícone, texto branco):

```tsx
const GroupHeader = ({ 
  label, 
  count, 
  isOpen, 
  onToggle 
}: { 
  label: string; 
  count: number; 
  isOpen: boolean; 
  onToggle: () => void 
}) => (
  <CollapsibleTrigger 
    onClick={onToggle}
    className="mx-2 px-3 py-2 w-[calc(100%-1rem)] flex items-center justify-between 
               text-xs font-medium text-white uppercase tracking-wider 
               bg-gradient-to-r from-emerald-500 to-lime-500 
               rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
  >
    <div className="flex items-center gap-2">
      <ChevronRight 
        className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} 
      />
      <span>{label}</span>
    </div>
    <span className="text-white/80 text-[10px] font-normal">
      {count}
    </span>
  </CollapsibleTrigger>
);
```

### 4. Refatorar renderGroupedSessions()

Cada grupo agora usa `Collapsible` para expandir/recolher:

```tsx
const renderGroupedSessions = () => {
  const filteredRegular = filterSessions(regularSessions);
  const grouped = groupSessionsByTime(filteredRegular);

  return (
    <>
      {grouped.today.length > 0 && (
        <Collapsible open={openGroups.today} className="mb-2">
          {!collapsed && (
            <GroupHeader
              label="Hoje"
              count={grouped.today.length}
              isOpen={openGroups.today}
              onToggle={() => setOpenGroups(prev => ({ ...prev, today: !prev.today }))}
            />
          )}
          <CollapsibleContent className="mt-1">
            {grouped.today.map(renderSessionItem)}
          </CollapsibleContent>
        </Collapsible>
      )}

      {grouped.lastWeek.length > 0 && (
        <Collapsible open={openGroups.lastWeek} className="mb-2">
          {!collapsed && (
            <GroupHeader
              label="Últimos 7 dias"
              count={grouped.lastWeek.length}
              isOpen={openGroups.lastWeek}
              onToggle={() => setOpenGroups(prev => ({ ...prev, lastWeek: !prev.lastWeek }))}
            />
          )}
          <CollapsibleContent className="mt-1">
            {grouped.lastWeek.map(renderSessionItem)}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Mesmo padrão para lastMonth e older */}
    </>
  );
};
```

---

## Resultado Visual Esperado

```text
┌─────────────────────────────────────────┐
│ ⭐ FAVORITOS                            │
│ ├─ Conversa sobre ansiedade             │
│ └─ Momento de oração                    │
├─────────────────────────────────────────┤
│ 📁 CONVERSAS                            │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ▼ HOJE                           3  │ │  ← Gradiente verde, clicável
│ └─────────────────────────────────────┘ │
│   ├─ Como lidar com perdas              │
│   ├─ Reflexão sobre fé                  │
│   └─ Pensamentos sobre gratidão         │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ► ÚLTIMOS 7 DIAS                 5  │ │  ← Recolhido (seta para direita)
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ► ÚLTIMO MÊS                     8  │ │  ← Recolhido
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ► ANTIGAS                       12  │ │  ← Recolhido
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## Arquivo a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/components/chat/ChatSidebar.tsx` | Adicionar imports, state, componente GroupHeader e refatorar renderGroupedSessions() |

---

## Benefícios

1. **Interface Limpa**: Usuário pode recolher períodos antigos para focar no que importa
2. **Contagem Visual**: Badge mostra quantas conversas há em cada período
3. **Identidade Visual**: Gradiente verde combina com o design system "Golden Hour" da Zion
4. **Animação Suave**: Seta rotaciona indicando estado aberto/fechado
5. **UX Intuitiva**: Padrão familiar de accordions/collapsibles

---

## Comportamento Padrão

- **Hoje**: Aberto por padrão (conversas mais recentes)
- **Últimos 7 dias**: Aberto por padrão
- **Último mês**: Fechado por padrão
- **Antigas**: Fechado por padrão

Isso otimiza o espaço visual mantendo as conversas mais relevantes visíveis.

