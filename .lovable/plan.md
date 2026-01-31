

# Plano: Aplicar Design Unificado em Todas as Paginas e Componentes

## Resumo das Areas Pendentes

Com base na analise, as seguintes areas ainda usam a paleta azul antiga (bg-primary = azul) ou nao seguem o novo padrao visual emerald-lime:

| Componente/Pagina | Problemas Identificados |
|-------------------|------------------------|
| **OnboardingFlow.tsx** | Logo com Heart azul, botoes com bg-primary azul, tags de selecao com border-primary azul, nome "Zyon" (errado) |
| **Profile.tsx** | Loading spinner com border-primary azul, Avatar fallback com bg-primary/10 azul |
| **ChatSidebar.tsx** | Logo com Heart azul em bg-primary/10, nome "Zyon" (errado), Avatar fallback com bg-primary azul |
| **Diary.tsx** | Sidebar inteira com estilo antigo (sem gradientes emerald-lime) |
| **Chat.tsx (mensagens usuario)** | Bolha de mensagem do usuario com `bg-primary` (azul) - deve ser gradiente emerald-lime |
| **Progress.tsx** | Barra de progresso com `bg-primary` (azul) |
| **JourneySection.tsx** | Card com `bg-gradient-to-r from-primary/5 to-primary/10` (azul), Heart com `text-primary` (azul) |
| **AvatarEditor.tsx** | Botao Salvar sem gradiente, spinner com border-primary azul |

---

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `src/components/onboarding/OnboardingFlow.tsx` | Trocar logo Heart por zionLogo, gradientes emerald-lime em botoes e selecoes, corrigir "Zyon" para "Zion" |
| `src/pages/Profile.tsx` | Loading com zionLogo, gradiente em avatar fallback |
| `src/components/chat/ChatSidebar.tsx` | Logo zionLogo, gradiente emerald no avatar, corrigir "Zyon" para "Zion" |
| `src/pages/Diary.tsx` | Sidebar com estilo harmonizado |
| `src/pages/Chat.tsx` | Bolha do usuario com gradiente emerald-lime |
| `src/components/ui/progress.tsx` | Barra com gradiente emerald-lime |
| `src/components/profile/JourneySection.tsx` | Gradientes emerald no lugar de primary/azul |
| `src/components/profile/AvatarEditor.tsx` | Botao Salvar com gradiente |

---

## Detalhes Tecnicos

### 1. OnboardingFlow.tsx

**Antes:**
```tsx
<Heart className="h-5 w-5 text-primary" />
<span className="font-medium text-foreground">Zyon</span>
```

**Depois:**
```tsx
<img src={zionLogo} alt="Zion" className="h-10 w-10" />
<span className="font-semibold text-foreground">Zion</span>
```

**Botoes de selecao - Antes:**
```tsx
formData.grammar_gender === option.value
  ? "border-primary bg-primary/5"
  : "border-border hover:border-primary/50"
```

**Depois:**
```tsx
formData.grammar_gender === option.value
  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
  : "border-border hover:border-emerald-500/50"
```

**Check icon:**
```tsx
<Check className="h-5 w-5 text-emerald-500" />
```

**Botao Continuar/Comecar:**
```tsx
className="flex-1 bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300"
```

**Tags de dor - selecionada:**
```tsx
formData.initial_pain_focus.includes(tag)
  ? "border-emerald-500 bg-gradient-to-r from-emerald-500 to-lime-500 text-white"
  : "border-border text-foreground hover:border-emerald-500/50"
```

### 2. Profile.tsx - Loading

**Antes:**
```tsx
<div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
```

**Depois:**
```tsx
<img src={zionLogo} alt="Zion" className="h-16 w-16 animate-pulse-soft" />
```

### 3. ChatSidebar.tsx

**Logo - Antes:**
```tsx
<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
  <Heart className="h-4 w-4 text-primary" />
</div>
{!collapsed && <span className="font-semibold text-foreground">Zyon</span>}
```

**Depois:**
```tsx
<img src={zionLogo} alt="Zion" className="h-8 w-8" />
{!collapsed && <span className="font-semibold text-foreground">Zion</span>}
```

**Avatar fallback - Antes:**
```tsx
<AvatarFallback className="bg-primary/10 text-primary text-xs">
```

**Depois:**
```tsx
<AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs">
```

### 4. Chat.tsx - Bolha de Mensagem do Usuario

**Antes:**
```tsx
message.sender === "user"
  ? "bg-primary text-primary-foreground"
  : "bg-muted text-foreground"
```

**Depois:**
```tsx
message.sender === "user"
  ? "bg-gradient-to-r from-emerald-500 to-lime-500 text-white"
  : "bg-muted text-foreground"
```

### 5. Progress.tsx - Barra de Progresso

**Antes:**
```tsx
<ProgressPrimitive.Indicator
  className="h-full w-full flex-1 bg-primary transition-all"
```

**Depois:**
```tsx
<ProgressPrimitive.Indicator
  className="h-full w-full flex-1 bg-gradient-to-r from-emerald-500 to-lime-500 transition-all"
```

### 6. JourneySection.tsx

**Card header - Antes:**
```tsx
<CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
  <Heart className="h-5 w-5 text-primary" />
```

**Depois:**
```tsx
<CardHeader className="bg-gradient-to-r from-emerald-50 to-lime-50 dark:from-emerald-950/20 dark:to-lime-950/20 border-b">
  <Heart className="h-5 w-5 text-emerald-500" />
```

**Phase card - Antes:**
```tsx
<div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-background p-5 border border-primary/20">
  <Sprout className="h-5 w-5 text-primary" />
```

**Depois:**
```tsx
<div className="rounded-xl bg-gradient-to-br from-emerald-100 via-emerald-50 to-background dark:from-emerald-900/30 dark:via-emerald-950/20 dark:to-background p-5 border border-emerald-200 dark:border-emerald-800">
  <Sprout className="h-5 w-5 text-emerald-500" />
```

**Progresso percentual:**
```tsx
<span className="font-medium text-emerald-600 dark:text-emerald-400">
```

**Milestones:**
```tsx
dynamicProgress >= i * 20 ? "bg-white" : "bg-emerald-200/50 dark:bg-emerald-700/50"
```

### 7. AvatarEditor.tsx

**Botao Salvar - Antes:**
```tsx
<Button onClick={handleSave}>
  Salvar
</Button>
```

**Depois:**
```tsx
<Button onClick={handleSave} className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300">
  Salvar
</Button>
```

### 8. Diary.tsx - Sidebar

A sidebar do diario ja esta ok, mas vou verificar se os cards de entrada selecionada usam o estilo correto:

**Card selecionado - Antes:**
```tsx
selectedEntry?.id === entry.id ? "border-primary bg-muted/50" : ""
```

**Depois:**
```tsx
selectedEntry?.id === entry.id ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30" : ""
```

---

## Resumo Visual das Mudancas

```text
ANTES (Azul):
+------------------+
| [Heart Azul]     |  <- bg-primary/10 + text-primary
| Zyon             |  <- Nome errado
| [ Botao Azul ]   |  <- bg-primary
| [=====     ]     |  <- Progress azul
+------------------+

DEPOIS (Emerald-Lime):
+------------------+
| [Z Logo]         |  <- Imagem real do logo
| Zion             |  <- Nome correto
| [Gradiente]      |  <- from-emerald-500 to-lime-500
| [=====     ]     |  <- Progress gradiente verde
+------------------+
```

---

## Arquivos Finais a Editar

1. `src/components/onboarding/OnboardingFlow.tsx`
2. `src/pages/Profile.tsx`
3. `src/components/chat/ChatSidebar.tsx`
4. `src/pages/Chat.tsx`
5. `src/components/ui/progress.tsx`
6. `src/components/profile/JourneySection.tsx`
7. `src/components/profile/AvatarEditor.tsx`
8. `src/pages/Diary.tsx`

---

## Resultado Esperado

Todas as paginas e componentes terao:
- Logo Zion real (imagem) em vez de icone Heart
- Nome "Zion" consistente (nao "Zyon")
- Gradiente emerald-lime em botoes primarios e elementos selecionados
- Barra de progresso com gradiente verde
- Fallbacks de avatar em tons de emerald
- Cards selecionados com borda emerald
- Consistencia visual total em todo o app

