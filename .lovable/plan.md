
# Plano de Correção: Usuário Preso na Página de Perfil

## Diagnóstico

### Causa Raiz Identificada

O problema é um **loop de navegação infinito** causado pela combinação de dois fatores:

1. **Profile.tsx linha 239**: Usa `navigate(-1)` para voltar no histórico
2. **SoldadoTestimony.tsx linha 78-84**: Verifica se status é `testimony_required` e redireciona para `/profile` se não for

### Fluxo do Bug

```text
Sequência que causa o loop:

1. Usuário em /testimony/abc123 (status: testimony_required)
2. Usuário envia testemunho → status muda para "processing" ou "under_review"
3. Tela de sucesso → clica "Voltar ao Perfil" → navigate("/profile")
4. Usuário está em /profile
5. Clica botão "Voltar" → navigate(-1) → volta para /testimony/abc123
6. SoldadoTestimony carrega, verifica status...
7. Status NÃO é mais "testimony_required" (é "processing")
8. Código redireciona: navigate("/profile") (linha 83-84)
9. Usuário volta para /profile → clica voltar → ciclo infinito
```

O `navigate(-1)` está tentando voltar para a página de testemunho, mas essa página rejeita o usuário e manda de volta para o perfil.

---

## Solução

### Opção A: Substituir `navigate(-1)` por rota fixa (Recomendado)

Em vez de usar `navigate(-1)` que depende do histórico, usar uma rota fixa segura como `/chat`.

**Vantagens:**
- Simples e previsível
- Sempre funciona independente do histórico
- Comportamento consistente

**Desvantagens:**
- Perde a flexibilidade de "voltar para onde estava"

### Opção B: Limpar histórico após submissão do testemunho

Usar `navigate("/profile", { replace: true })` após submissão para substituir a entrada no histórico.

**Vantagens:**
- Mantém a navegação com `navigate(-1)` em outros casos
- Resolve o problema específico

**Desvantagens:**
- Precisa modificar dois arquivos

### Opção C: Combinação inteligente

Usar `navigate(-1)` com fallback para `/chat` se não houver histórico anterior válido.

---

## Implementação Escolhida: Combinação de A e B

### PARTE 1: Corrigir SoldadoTestimony.tsx

Após submissão bem-sucedida, usar `replace: true` para não deixar a página de testemunho no histórico:

```typescript
// Linha 200 - No botão "Voltar ao Perfil" após submissão
onClick={() => navigate("/profile", { replace: true })}
```

Também corrigir o botão de voltar no header (linha 225) para usar rota fixa:

```typescript
// Linha 225 - Botão voltar no header
onClick={() => navigate("/profile", { replace: true })}
```

### PARTE 2: Corrigir Profile.tsx

Substituir `navigate(-1)` por uma rota fixa segura:

```typescript
// Linha 239
onClick={() => navigate("/chat")}
```

Ou, se quiser manter flexibilidade, verificar se há histórico válido:

```typescript
onClick={() => {
  // Se vier de rota que causa loop, ir para chat
  const canGoBack = window.history.length > 2;
  if (canGoBack) {
    navigate(-1);
  } else {
    navigate("/chat");
  }
}}
```

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/SoldadoTestimony.tsx` | MODIFICAR | Usar `replace: true` na navegação pós-submissão |
| `src/pages/Profile.tsx` | MODIFICAR | Substituir `navigate(-1)` por `/chat` |

---

## Detalhes Técnicos

### Modificações em SoldadoTestimony.tsx

**Linha 200** - Botão "Voltar ao Perfil" na tela de sucesso:
```typescript
// ANTES:
onClick={() => navigate("/profile")}

// DEPOIS:
onClick={() => navigate("/profile", { replace: true })}
```

**Linha 225** - Botão de voltar no header:
```typescript
// ANTES:
onClick={() => navigate("/profile")}

// DEPOIS:
onClick={() => navigate("/profile", { replace: true })}
```

### Modificações em Profile.tsx

**Linha 239** - Botão de voltar no header:
```typescript
// ANTES:
onClick={() => navigate(-1)}

// DEPOIS:
onClick={() => navigate("/chat")}
```

---

## Comportamento Esperado

Após a correção:

1. Usuário grava testemunho e clica "Voltar ao Perfil"
2. Navegação usa `replace: true`, substituindo `/testimony/...` por `/profile` no histórico
3. Usuário está em `/profile`
4. Clica botão "Voltar" → vai para `/chat` (destino seguro)
5. Sem loops, navegação funciona normalmente

---

## Testes de Validação

1. Gravar testemunho e submeter
2. Clicar "Voltar ao Perfil" na tela de sucesso
3. Na página de perfil, clicar no botão de voltar (seta)
4. Verificar que vai para `/chat` sem ficar preso
