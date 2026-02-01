
# Plano: Corrigir Zoom Automático no Campo de Chat Mobile

## Diagnóstico Completo

### Causa Raiz Identificada
O zoom automático que acontece quando você toca no campo de texto do chat é um **comportamento padrão dos navegadores mobile** (especialmente Safari/iOS). Os navegadores fazem zoom automaticamente em campos de input que têm fonte menor que **16px** para melhorar a legibilidade.

### Análise do Código Atual

**Componente responsável:** `src/components/ui/textarea.tsx`
```tsx
// Linha 11 - fonte definida como text-sm (14px)
"flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ..."
```

**Uso no Chat:** `src/pages/Chat.tsx` (linhas 732-739 e 858-865)
```tsx
<Textarea
  value={input}
  onChange={(e) => setInput(e.target.value)}
  onKeyDown={handleKeyDown}
  placeholder="Compartilhe o que está em seu coração..."
  className="min-h-[50px] max-h-32 resize-none"
  disabled={isLoading}
/>
```

**Meta viewport atual:** `index.html` (linha 5)
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

### Por que o zoom acontece?
1. A classe `text-sm` no Tailwind equivale a `font-size: 0.875rem` (14px)
2. Safari/iOS faz zoom automático em inputs com fonte < 16px
3. Isso é uma "feature" de acessibilidade do navegador, não um bug do código

---

## Solução

### Estratégia (Múltiplas Camadas)

A correção envolve 3 ajustes complementares para garantir que funcione em todos os navegadores mobile:

### 1. CSS Global - Prevenir ajuste automático de tamanho de texto
**Arquivo:** `src/index.css`
```css
/* Prevenir zoom automático em inputs no mobile */
input, textarea, select {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  font-size: 16px !important; /* iOS requer mínimo 16px para não dar zoom */
}

@media screen and (min-width: 768px) {
  input, textarea, select {
    font-size: inherit !important; /* Desktop volta ao normal */
  }
}
```

### 2. Atualizar Componente Textarea
**Arquivo:** `src/components/ui/textarea.tsx`

Adicionar classe condicional para garantir 16px no mobile:
```tsx
className={cn(
  "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background ...",
  className,
)}
```

A mudança de `text-sm` para `text-base md:text-sm` garante:
- **Mobile (< 768px):** `text-base` = 16px (sem zoom)
- **Desktop (≥ 768px):** `text-sm` = 14px (visual original)

### 3. Atualizar Meta Viewport (Opcional - Reforço)
**Arquivo:** `index.html`

Adicionar atributos para desabilitar zoom do usuário também:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

> **Nota de Acessibilidade:** Desabilitar `user-scalable` pode prejudicar usuários com baixa visão. A solução CSS (opções 1 e 2) é preferível e menos intrusiva.

---

## Arquivos a Serem Modificados

| Arquivo | Modificação |
|---------|-------------|
| `src/index.css` | Adicionar regras CSS para prevenir zoom em inputs |
| `src/components/ui/textarea.tsx` | Mudar `text-sm` para `text-base md:text-sm` |

---

## Detalhes Técnicos

### Regras CSS a Adicionar em `src/index.css`

Após a linha 131 (após o fechamento de `@layer base`):

```css
/* Prevenir zoom automático em inputs no iOS/mobile */
@layer base {
  input, textarea, select, button {
    font-size: 16px;
  }
}

@media screen and (min-width: 768px) {
  input, textarea, select, button {
    font-size: inherit;
  }
}
```

### Alteração no Textarea Component

**De:**
```tsx
"flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background..."
```

**Para:**
```tsx
"flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background..."
```

---

## Resultado Esperado

1. ✅ Zoom automático eliminado ao tocar no campo de chat no mobile
2. ✅ Tamanho da fonte visualmente mantido no desktop (14px)
3. ✅ Fonte legível no mobile (16px) - melhor UX
4. ✅ Funciona em Safari, Chrome, Firefox mobile
5. ✅ Compatível com modo PWA standalone

---

## Impacto em Outros Componentes

Esta alteração também beneficiará outros campos de input no app:
- Formulários de login/cadastro
- Campos de busca
- Outros textareas

A mudança é segura e melhora a experiência geral do usuário mobile.
