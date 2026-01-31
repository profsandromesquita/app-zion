
# Plano: Aplicar Design Emerald-Lime nas Paginas Restantes

## Resumo

As seguintes areas ainda usam a paleta azul antiga (bg-primary = azul) e precisam ser atualizadas para o novo padrao emerald-lime:

| Componente | Problemas Identificados |
|------------|------------------------|
| **AccountTypeSelector.tsx** | Cards selecionados com `border-primary` e `ring-primary/20` (azul), icones com `bg-primary` (azul) |
| **Auth.tsx (Buscador form)** | Icone do Buscador com `bg-blue-100 text-blue-800` |
| **ChurchSignupForm.tsx** | Botao de submit sem gradiente emerald-lime |
| **ProfessionalSignupForm.tsx** | Botao de submit sem gradiente emerald-lime |
| **AdminLayout.tsx** | Sidebar com navegacao usando `bg-primary` (azul) para item ativo, logo ausente |
| **Todas as paginas admin** | Botoes de acao sem gradiente, spinners com `border-primary` (azul), badges diversas |

---

## Arquivos a Modificar

### 1. AccountTypeSelector.tsx

**Problema**: Cards de selecao (Buscador, Igreja, Profissional) usam `border-primary` e `bg-primary` azul

**Mudancas**:
```tsx
// Card selecionado - ANTES:
selected === type && "border-primary ring-2 ring-primary/20"
// DEPOIS:
selected === type && "border-emerald-500 ring-2 ring-emerald-500/20"

// Hover do card - ANTES:
"hover:border-primary/50"
// DEPOIS:
"hover:border-emerald-500/50"

// Icone selecionado - ANTES:
selected === type ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
// DEPOIS:
selected === type ? "bg-gradient-to-r from-emerald-500 to-lime-500 text-white" : "bg-muted text-muted-foreground"
```

### 2. Auth.tsx (Formulario Buscador)

**Problema**: Icone do formulario de Buscador usa `bg-blue-100 text-blue-800`

**Mudancas**:
```tsx
// ANTES (linha 135):
<div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
// DEPOIS:
<div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
```

### 3. ChurchSignupForm.tsx

**Problema**: Botao de submit sem gradiente

**Mudancas**:
```tsx
// ANTES (linha 328):
<Button type="submit" className="flex-1" disabled={isLoading}>
// DEPOIS:
<Button type="submit" className="flex-1 bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300" disabled={isLoading}>
```

### 4. ProfessionalSignupForm.tsx

**Problema**: Botao de submit sem gradiente

**Mudancas**:
```tsx
// ANTES (linha 288):
<Button type="submit" className="flex-1" disabled={isLoading}>
// DEPOIS:
<Button type="submit" className="flex-1 bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300" disabled={isLoading}>
```

### 5. AdminLayout.tsx

**Problemas**:
- Navegacao ativa usa `bg-primary text-primary-foreground` (azul)
- Falta logo Zion no header da sidebar

**Mudancas**:
```tsx
// Adicionar import:
import zionLogo from "@/assets/zion-logo.png";

// Header da sidebar - adicionar logo:
<div className="border-b border-border p-4">
  <div className="flex items-center gap-2 mb-1">
    <img src={zionLogo} alt="Zion" className="h-8 w-8" />
    <h1 className="text-xl font-semibold text-foreground">Painel Admin</h1>
  </div>
  <p className="text-sm text-muted-foreground">Gerenciamento ZION</p>
</div>

// Navegacao ativa - ANTES:
isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
// DEPOIS:
isActive ? "bg-gradient-to-r from-emerald-500 to-lime-500 text-white" : "text-muted-foreground hover:bg-accent"
```

### 6. Paginas Admin - Botoes de Acao

Todas as paginas admin que usam botoes primarios precisam do gradiente:

**Documents.tsx**:
- Botao "Novo Documento" (linha 395-398)
- Botao "Criar Documento" / "Salvar Nova Versao" no dialog (linha 495-496)

**RagTest.tsx**:
- Botao de busca (linha 136)

**FeedbackDataset.tsx**:
- Botao "Exportar" (linha 498-500)

**JourneyMap.tsx**:
- Botoes de acao diversos

**KnowledgeBase.tsx**:
- Botao "Novo Documento" (linha 199-207)
- Botao "Criar Documento" no dialog (linha 291)
- Spinner de loading (linha 302)

**SystemInstructions.tsx**:
- Botao "Nova Instrucao" (linha 172-180)
- Botao "Criar Instrucao" no dialog (linha 242)
- Spinner de loading (linha 252)
- Badge "Constituicao" (linha 278-281)

---

## Detalhes Tecnicos por Arquivo

### AdminLayout.tsx - Codigo Completo da Mudanca

```tsx
// Import
import zionLogo from "@/assets/zion-logo.png";

// Header
<div className="border-b border-border p-4">
  <div className="flex items-center gap-2 mb-1">
    <img src={zionLogo} alt="Zion" className="h-8 w-8" />
    <h1 className="text-xl font-semibold text-foreground">Painel Admin</h1>
  </div>
  <p className="text-sm text-muted-foreground">Gerenciamento ZION</p>
</div>

// Navegacao
className={({ isActive }) =>
  cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-md"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
  )
}
```

### Botoes Admin - Padrao

Todos os botoes primarios nas paginas admin devem usar:
```tsx
className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300"
```

### Spinners de Loading - Padrao

```tsx
// ANTES:
<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />

// DEPOIS (usar logo):
<img src={zionLogo} alt="Zion" className="h-12 w-12 animate-pulse" />
```

### Badges Constituicao em SystemInstructions.tsx

```tsx
// ANTES:
<span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
// DEPOIS:
<span className="text-xs bg-gradient-to-r from-emerald-500 to-lime-500 text-white px-2 py-0.5 rounded-full">
```

---

## Lista Completa de Arquivos

| Arquivo | Tipo de Mudanca |
|---------|-----------------|
| `src/components/auth/AccountTypeSelector.tsx` | Cards de selecao, icones |
| `src/pages/Auth.tsx` | Icone do formulario Buscador |
| `src/components/auth/ChurchSignupForm.tsx` | Botao submit |
| `src/components/auth/ProfessionalSignupForm.tsx` | Botao submit |
| `src/components/admin/AdminLayout.tsx` | Logo, navegacao ativa |
| `src/pages/admin/Documents.tsx` | Botoes primarios |
| `src/pages/admin/RagTest.tsx` | Botao busca |
| `src/pages/admin/FeedbackDataset.tsx` | Botao exportar |
| `src/pages/admin/JourneyMap.tsx` | Botoes diversos |
| `src/pages/admin/KnowledgeBase.tsx` | Botoes, spinner |
| `src/pages/admin/SystemInstructions.tsx` | Botoes, spinner, badge |

---

## Resultado Visual Esperado

```text
ANTES (Azul):
+------------------------+
| [Buscador]  <- border-primary azul
| [Igreja]    <- hover azul
| [Profissional]
+------------------------+
| [Botao Azul]
+------------------------+

DEPOIS (Emerald-Lime):
+------------------------+
| [Buscador]  <- border-emerald-500 + gradiente
| [Igreja]    <- hover emerald
| [Profissional]
+------------------------+
| [Gradiente Verde]
+------------------------+
```

Admin Sidebar:
```text
ANTES:
+------------------+
| Painel Admin     |
|------------------|
| [Dashboard] <- bg-primary azul
| [Documentos]
+------------------+

DEPOIS:
+------------------+
| [Z] Painel Admin |  <- Logo + titulo
|------------------|
| [Dashboard] <- gradiente verde
| [Documentos]
+------------------+
```
