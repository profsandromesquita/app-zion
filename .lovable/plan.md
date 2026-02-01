
# Plano: Atualizar Página de Instalação para o Design System Zion

## Problema Identificado

A página `/install` está usando o design antigo com cores azul/lavanda (variáveis `primary`), enquanto o resto do app Zion utiliza o padrão **"Golden Hour"** com gradiente verde esmeralda e lima (`from-emerald-500 to-lime-500`).

### Elementos fora do padrão (visíveis na screenshot):
1. **Círculos numerados** (1, 2, 3) - estão usando `bg-primary/10` (azul/lavanda)
2. **Badges de status** ("Ativo", "OK") - estão usando `variant="default"` que é azul
3. **Ícones de diagnóstico** - sem cor temática

---

## Solução

Atualizar todos os elementos da página `src/pages/Install.tsx` para usar o padrão emerald/lime, mantendo consistência visual com o resto do app.

---

## Alterações Detalhadas

### 1. Círculos Numerados (Steps)

**De:**
```tsx
<div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
  <span className="text-sm font-medium">1</span>
</div>
```

**Para:**
```tsx
<div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-lime-500 flex items-center justify-center">
  <span className="text-sm font-medium text-white">1</span>
</div>
```

### 2. Badges de Status no Diagnóstico

Os badges para "Ativo", "OK", "Sim", "Disponível" devem usar classes customizadas com cores emerald em vez de `variant="default"`.

**De:**
```tsx
<Badge variant={swStatus === "active" ? "default" : "secondary"}>
  {swStatus === "active" ? "Ativo" : "Inativo"}
</Badge>
```

**Para:**
```tsx
<Badge 
  variant="secondary"
  className={swStatus === "active" ? "bg-gradient-to-r from-emerald-500 to-lime-500 text-white border-0" : ""}
>
  {swStatus === "active" ? "Ativo" : "Inativo"}
</Badge>
```

### 3. Ícones Temáticos

Atualizar ícones para usar cores emerald onde apropriado:
- Ícone de Diagnóstico: `text-emerald-500`
- Outros ícones decorativos

### 4. Botão "Limpar Cache"

Manter como `variant="outline"` (padrão neutro está OK para ações secundárias).

---

## Arquivos a Modificar

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Install.tsx` | Atualizar cores dos steps e badges para padrão emerald/lime |

---

## Contagem de Alterações

A página possui **6 seções** com steps numerados que precisam ser atualizados:
1. iOS/iPhone (3 steps) - linhas 274-308
2. Chrome/Edge Desktop (3 steps) - linhas 331-371
3. Safari Mac (2 steps) - linhas 384-405
4. Android (2 steps) - linhas 418-442

E **4 badges** de diagnóstico:
1. Service Worker - linha 460
2. Manifest - linha 467
3. Modo Standalone - linha 474
4. Prompt de Instalação - linha 481

---

## Resultado Esperado

1. Círculos numerados com gradiente verde/lima (como botões primários)
2. Badges de status positivo ("Ativo", "OK", "Sim") com gradiente emerald
3. Aparência visual consistente com o resto do app Zion
4. Melhor experiência visual seguindo o design system "Golden Hour"

---

## Visualização do Antes/Depois

| Elemento | Antes (Azul) | Depois (Emerald) |
|----------|--------------|------------------|
| Círculos Steps | `bg-primary/10` (lavanda) | `bg-gradient-to-r from-emerald-500 to-lime-500` |
| Badge "Ativo" | `bg-primary` (azul) | `from-emerald-500 to-lime-500` |
| Badge "OK" | `bg-primary` (azul) | `from-emerald-500 to-lime-500` |
| Ícone Diagnóstico | Sem cor especial | `text-emerald-500` |
