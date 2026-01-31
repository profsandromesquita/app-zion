
# Plano: Corrigir Avatar no Modal de Detalhes do Usuário

## Problema Identificado

O modal "Detalhes do Usuário" não mostra a imagem do avatar porque:

1. A query no `AdminDashboard.tsx` não inclui o campo `avatar_url` quando busca os perfis
2. A interface `UserWithRoles` não possui o campo `avatar_url`
3. O `UserDetailsModal` só usa `AvatarFallback`, não tem `AvatarImage`

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/admin/AdminDashboard.tsx` | Adicionar `avatar_url` na query e interface |
| `src/components/admin/UserDetailsModal.tsx` | Adicionar `avatar_url` na interface e usar `AvatarImage` |

---

## Detalhes Técnicos

### 1. AdminDashboard.tsx

**Query atual (linha 79):**
```tsx
supabase.from("profiles").select("id, nome, email, phone, created_at")
```

**Query corrigida:**
```tsx
supabase.from("profiles").select("id, nome, email, phone, created_at, avatar_url")
```

**Interface UserWithRoles - adicionar campo:**
```tsx
interface UserWithRoles {
  id: string;
  nome: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  avatar_url: string | null;  // ADICIONAR
  roles: AppRole[];
  // ... demais campos
}
```

### 2. UserDetailsModal.tsx

**Interface UserWithRoles - adicionar campo:**
```tsx
interface UserWithRoles {
  id: string;
  nome: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  avatar_url?: string | null;  // ADICIONAR
  roles: AppRole[];
  // ... demais campos
}
```

**Importar AvatarImage:**
```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
```

**Avatar atual (linhas 182-186):**
```tsx
<Avatar className="h-16 w-16">
  <AvatarFallback className="bg-primary/10 text-primary text-xl">
    <User className="h-8 w-8" />
  </AvatarFallback>
</Avatar>
```

**Avatar corrigido:**
```tsx
<Avatar className="h-16 w-16">
  {user.avatar_url && (
    <AvatarImage src={user.avatar_url} alt={user.nome || "Avatar"} className="object-cover" />
  )}
  <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xl">
    <User className="h-8 w-8" />
  </AvatarFallback>
</Avatar>
```

Também atualizo o fallback para usar as cores emerald-lime do novo design.

---

## Resultado Esperado

Antes:
```text
+------------------+
| [Icone genérico] |  <- Sempre mostra fallback
| Sandro Mesquita  |
+------------------+
```

Depois:
```text
+------------------+
| [Foto do avatar] |  <- Mostra imagem real se disponível
| Sandro Mesquita  |
+------------------+
| ou               |
| [Fallback verde] |  <- Mostra fallback emerald se não tiver foto
+------------------+
```
