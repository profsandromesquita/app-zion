
# Plano: Exibir Avatar do Usuário no Sidebar

## Problema Identificado

O avatar carregado no perfil não aparece no sidebar porque:

1. **ChatSidebar.tsx** usa apenas `AvatarFallback` estático (ícone de usuário)
2. **Não há busca** do `avatar_url` do banco de dados
3. **Não há `AvatarImage`** para exibir a foto/avatar simbólico

---

## Solução Proposta

### Abordagem A: Buscar avatar diretamente no Sidebar (Recomendada)

O `ChatSidebar` já recebe o `user.id`, então pode buscar o `avatar_url` internamente.

```text
ESTADO ATUAL:
┌─────────────────────────────────────┐
│  ┌────┐                             │
│  │ 👤 │  sandro.mesquita@...  ▼     │  ← Ícone estático
│  └────┘                             │
└─────────────────────────────────────┘

ESTADO DESEJADO:
┌─────────────────────────────────────┐
│  ┌────┐                             │
│  │ 🌱 │  sandro.mesquita@...  ▼     │  ← Avatar real do perfil
│  └────┘                             │
└─────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/components/chat/ChatSidebar.tsx` | Buscar `avatar_url`, adicionar `AvatarImage`, atualizar estado |
| `src/components/profile/SymbolicAvatarGrid.tsx` | Corrigir erro de ref usando `forwardRef` |

---

## Implementação Detalhada

### 1. Atualizar ChatSidebar.tsx

**Adicionar import do AvatarImage** (linha 7):
```typescript
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
```

**Adicionar estado para avatar** (após linha 72):
```typescript
const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
```

**Buscar avatar_url do perfil** (dentro do useEffect existente ou novo):
```typescript
useEffect(() => {
  const loadUserAvatar = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    
    if (data?.avatar_url) {
      setAvatarUrl(data.avatar_url);
    }
  };
  
  loadUserAvatar();
}, [user]);
```

**Atualizar renderização do Avatar** (linhas 375-379):
```typescript
<Avatar className="h-8 w-8">
  {avatarUrl && (
    <AvatarImage src={avatarUrl} alt="Avatar" className="object-cover" />
  )}
  <AvatarFallback className="bg-primary/10 text-primary text-xs">
    <User className="h-3 w-3" />
  </AvatarFallback>
</Avatar>
```

### 2. Corrigir Erro de Ref no SymbolicAvatarGrid.tsx

O erro ocorre porque `TooltipTrigger` com `asChild` tenta passar uma ref para um `<button>` que é um componente funcional inline.

**Solução**: Extrair o botão para um componente com `forwardRef`:

```typescript
import { forwardRef } from "react";

const AvatarButton = forwardRef<HTMLButtonElement, {
  avatar: SymbolicAvatar;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}>(({ avatar, isSelected, onClick, onMouseEnter, onMouseLeave }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    className={cn(
      "relative aspect-square rounded-xl overflow-hidden transition-all duration-200",
      "border-2 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
      isSelected
        ? "border-primary ring-2 ring-primary ring-offset-2"
        : "border-border hover:border-primary/50"
    )}
  >
    {/* ... conteúdo do botão ... */}
  </button>
));
AvatarButton.displayName = "AvatarButton";
```

---

## Fluxo de Implementação

```text
PASSO 1: Atualizar ChatSidebar.tsx
├── 1.1 Adicionar import de AvatarImage
├── 1.2 Adicionar estado avatarUrl
├── 1.3 Criar useEffect para buscar avatar do perfil
└── 1.4 Renderizar AvatarImage quando avatarUrl existir

PASSO 2: Corrigir SymbolicAvatarGrid.tsx
├── 2.1 Importar forwardRef
├── 2.2 Extrair botão para componente com ref
└── 2.3 Usar componente extraído dentro do TooltipTrigger
```

---

## Considerações Técnicas

### Cache-busting
Se o usuário fizer upload de uma nova foto, a URL pode ter um parâmetro `?t=timestamp`. O `AvatarImage` do Radix lida bem com isso.

### Fallback
Se `avatar_url` for `null` ou a imagem falhar ao carregar, o `AvatarFallback` será exibido automaticamente (comportamento nativo do Radix Avatar).

### Performance
A busca do avatar é feita apenas uma vez quando o componente monta (ou quando `user` muda). Não há re-fetches desnecessários.

---

## Resultado Esperado

1. Avatar do perfil aparece no sidebar (foto ou avatar simbólico)
2. Fallback com ícone de usuário quando não há avatar definido
3. Erro de ref no console corrigido
4. Atualização automática quando usuário altera avatar (próxima sessão)
