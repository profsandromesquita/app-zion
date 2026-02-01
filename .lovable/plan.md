

# Plano Definitivo: Ajustes de UX/UI na Página Chat

## Problema 1: Sidebar com Histórico Poluído

### Diagnóstico
O sidebar atual (`ChatSidebar.tsx`) exibe **cada sessão individualmente com uma data** logo abaixo do título:

```tsx
// Linhas 254-257 - Cada item mostra a data
<span className="text-xs text-muted-foreground truncate w-full">
  {formatDate(session.updated_at)}
</span>
```

Isso cria ruído visual e dificulta a navegação, especialmente quando há muitas conversas.

### Solução: Agrupamento Temporal com Cabeçalhos de Seção

Implementar agrupamento inteligente por período temporal, seguindo padrões modernos de UX (como ChatGPT, Notion, etc.):

| Grupo | Critério |
|-------|----------|
| **Hoje** | Sessões atualizadas hoje |
| **Últimos 7 dias** | Sessões da última semana (exceto hoje) |
| **Último mês** | Sessões dos últimos 30 dias (exceto os 7 dias) |
| **Antigas** | Sessões com mais de 30 dias |

### Mudanças Específicas

**1. Remover datas individuais dos itens:**
```tsx
// REMOVER este bloco (linhas 254-258)
{!collapsed && (
  <span className="text-xs text-muted-foreground truncate w-full">
    {formatDate(session.updated_at)}
  </span>
)}
```

**2. Criar função de agrupamento temporal:**
```tsx
const groupSessionsByTime = (sessions: ChatSession[]) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  return {
    today: sessions.filter(s => new Date(s.updated_at) >= today),
    lastWeek: sessions.filter(s => {
      const date = new Date(s.updated_at);
      return date >= weekAgo && date < today;
    }),
    lastMonth: sessions.filter(s => {
      const date = new Date(s.updated_at);
      return date >= monthAgo && date < weekAgo;
    }),
    older: sessions.filter(s => new Date(s.updated_at) < monthAgo),
  };
};
```

**3. Renderizar grupos com cabeçalhos visuais:**
```tsx
{/* Grupo: Hoje */}
{grouped.today.length > 0 && (
  <>
    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
      Hoje
    </div>
    {grouped.today.map(renderSessionItem)}
  </>
)}

{/* Grupo: Últimos 7 dias */}
{grouped.lastWeek.length > 0 && (
  <>
    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
      Últimos 7 dias
    </div>
    {grouped.lastWeek.map(renderSessionItem)}
  </>
)}
// ... mesmo padrão para lastMonth e older
```

### Resultado Visual Esperado

```text
┌─────────────────────────────────┐
│ ⭐ FAVORITOS                    │
│ ├─ Conversa sobre ansiedade     │
│ └─ Momento de oração            │
├─────────────────────────────────┤
│ 📁 CONVERSAS                    │
│                                 │
│ HOJE                            │
│ ├─ Como lidar com perdas        │
│ └─ Reflexão sobre fé            │
│                                 │
│ ÚLTIMOS 7 DIAS                  │
│ ├─ Dúvidas sobre propósito      │
│ └─ Gratidão diária              │
│                                 │
│ ÚLTIMO MÊS                      │
│ └─ Jornada de autoconhecimento  │
│                                 │
│ ANTIGAS                         │
│ └─ Primeira conversa            │
└─────────────────────────────────┘
```

---

## Problema 2: Botão de Saída Rápida Sobrepondo Elementos

### Diagnóstico
O componente `SafetyExit.tsx` está posicionado em:
```tsx
className="fixed bottom-20 right-4 z-50 ... sm:bottom-4"
```

- **Mobile:** `bottom-20` (80px do fundo) 
- **Desktop:** `bottom-4` (16px do fundo)

No mobile, a área de input tem `padding-bottom: max(1rem, env(safe-area-inset-bottom))` e o botão de enviar tem altura de `50px`. Isso causa sobreposição visual em certos dispositivos.

### Solução: Reposicionar para o Header

Mover o botão de saída rápida para o **header da página**, ao lado dos outros ícones (push notification, debug). Isso:

1. ✅ Elimina conflito com área de input
2. ✅ Fica sempre visível e acessível
3. ✅ Segue padrões de UX (ações importantes no topo)
4. ✅ Mantém a funcionalidade de emergência

### Mudanças Específicas

**1. Modificar SafetyExit.tsx para variante header:**
```tsx
interface SafetyExitProps {
  variant?: "floating" | "header";
}

const SafetyExit = ({ variant = "floating" }: SafetyExitProps) => {
  const handleSafetyExit = () => {
    window.location.replace("https://www.google.com");
  };

  if (variant === "header") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleSafetyExit}
            variant="ghost"
            size="icon"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label="Sair rápido"
          >
            <X className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-destructive text-destructive-foreground">
          <p>Sair Rápido</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Manter versão floating como fallback (modo anônimo)
  return (/* código atual */);
};
```

**2. Mover SafetyExit para o header no Chat.tsx:**

**De (linha 765):**
```tsx
<div className="flex h-[100dvh] w-full bg-background">
  <SafetyExit /> {/* Posição atual - conflituosa */}
  <ChatSidebar ... />
```

**Para (dentro do header, linha 807):**
```tsx
<div className="flex items-center gap-1">
  {/* Safety Exit Button */}
  <SafetyExit variant="header" />
  
  {/* Push notification toggle */}
  <PushNotificationPrompt userId={user?.id || null} variant="icon" />
  
  {/* Debug toggle for admins */}
  {isAdmin && (...)}
</div>
```

### Resultado Visual no Header

```text
┌─────────────────────────────────────────────────────┐
│ ☰  [Zion Logo] Zion              [X] [🔔] [🐛]     │
│                   Acolhimento                       │
└─────────────────────────────────────────────────────┘
                                    ↑
                              Botão de Saída
                              Rápida (discreto
                              mas acessível)
```

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/components/chat/ChatSidebar.tsx` | Remover datas individuais, adicionar agrupamento temporal |
| `src/components/SafetyExit.tsx` | Adicionar prop `variant` para suportar versão header |
| `src/pages/Chat.tsx` | Mover SafetyExit do corpo para o header (modo autenticado e anônimo) |

---

## Benefícios da Solução

### Sidebar
- **Redução de 50% no ruído visual** (remoção de datas repetitivas)
- **Navegação intuitiva** por contexto temporal
- **Padrão familiar** (usuários reconhecem de outros apps)
- **Melhor escaneabilidade** dos títulos das conversas

### Botão de Saída Rápida
- **Zero conflito** com elementos interativos
- **Visibilidade consistente** em todas as telas
- **UX profissional** (ações de emergência no header)
- **Funciona em todos os dispositivos** sem ajustes de posição

---

## Considerações de Acessibilidade

1. Os cabeçalhos temporais usam `uppercase` e `tracking-wider` para diferenciação visual
2. O botão de saída rápida mantém `aria-label="Sair rápido"` e tooltip
3. O contraste do botão de saída (`text-destructive`) garante visibilidade
4. A funcionalidade de teclado (foco e ativação) permanece intacta

