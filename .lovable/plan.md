
# Plano de Implementação: Melhorias na Página de Perfil

## Resumo Executivo
Implementar sistema completo de avatar com upload de foto pessoal e 10 avatares simbólicos pré-definidos, além de redesenhar a seção "Minha Jornada" com um layout moderno e responsivo.

---

## Análise do Estado Atual

### Avatar (Problema A e B)
```text
SITUAÇÃO ATUAL:
┌──────────────────────────────────────────────────────────┐
│  ┌──────┐                                                │
│  │  👤  │  ← Avatar estático com ícone User             │
│  │      │  ← Não clicável, não editável                 │
│  └──────┘                                                │
└──────────────────────────────────────────────────────────┘

- Campo `avatar_url` existe na tabela `profiles` mas não é utilizado
- Nenhum bucket de storage configurado para uploads
- Componente AvatarImage existe mas não é importado
```

### Seção Minha Jornada (Problema C)
```text
SITUAÇÃO ATUAL:
┌────────────────────────────────────────────────────────────────────┐
│ ❤️ Minha Jornada                                                   │
├────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┬─────────────┬─────────────┬─────────────────────┐ │
│  │    Início   │      0      │      —      │  Consolidado        │ │
│  │    Fase     │ Temas Ativos│ Score Médio │  Maturidade         │ │
│  └─────────────┴─────────────┴─────────────┴─────────────────────┘ │
│                                              ↑ Overflow no mobile  │
└────────────────────────────────────────────────────────────────────┘

PROBLEMAS:
- Grid com 4 colunas não é responsivo
- Texto "Maturidade" com valores longos ultrapassa limites
- Design simplista e sem hierarquia visual
- Falta contexto emocional/acolhedor
```

---

## Solução Proposta

### A. Upload de Foto de Avatar

#### 1. Criar Bucket de Storage
```sql
-- Criar bucket para avatares
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- Política: usuários podem fazer upload do próprio avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política: avatares são públicos para leitura
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Política: usuários podem deletar/atualizar próprio avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

#### 2. Componente de Upload
```text
NOVO COMPONENTE: src/components/profile/AvatarEditor.tsx

┌─────────────────────────────────────────────────────────────┐
│                    ESCOLHA SEU AVATAR                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│            ┌────────────────────────┐                       │
│            │                        │                       │
│            │   [AVATAR ATUAL 120px] │  ← Clicável           │
│            │                        │                       │
│            └────────────────────────┘                       │
│                                                             │
│    [📷 Enviar minha foto]   [🗑️ Remover]                    │
│                                                             │
│  ─────────── ou escolha um avatar simbólico ──────────────  │
│                                                             │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                        │
│  │ 🌱 │ │ 🏺 │ │ 🏊 │ │ 🔦 │ │ 🕯️ │                        │
│  └────┘ └────┘ └────┘ └────┘ └────┘                        │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                        │
│  │ 🦋 │ │ 🏔️ │ │ 🪞 │ │ ⛓️ │ │ 🌅 │                        │
│  └────┘ └────┘ └────┘ └────┘ └────┘                        │
│                                                             │
│  [ Semente no Escuro ]  ← Nome ao passar mouse/touch       │
│                                                             │
│                              [Salvar]  [Cancelar]           │
└─────────────────────────────────────────────────────────────┘
```

### B. 10 Avatares Simbólicos Pré-definidos

#### Geração de Imagens
As 10 imagens serão geradas via IA (usando Gemini) e armazenadas na pasta `public/avatars/`:

| ID | Nome | Arquivo | Descrição |
|----|------|---------|-----------|
| seed-in-dark | A Semente no Escuro | `seed-in-dark.webp` | Pequena semente brilhando sob a terra |
| kintsugi-vase | O Vaso Kintsugi | `kintsugi-vase.webp` | Vaso reparado com linhas douradas |
| deep-diver | O Mergulhador | `deep-diver.webp` | Silhueta mergulhando no oceano |
| lit-labyrinth | O Labirinto Iluminado | `lit-labyrinth.webp` | Vista aérea de labirinto com luz |
| flame-in-storm | A Chama na Tempestade | `flame-in-storm.webp` | Vela protegida no meio da chuva |
| breaking-cocoon | O Casulo a Romper | `breaking-cocoon.webp` | Casulo com luz colorida saindo |
| mountain-horizon | A Montanha no Horizonte | `mountain-horizon.webp` | Pessoa olhando para montanha |
| clearing-mirror | O Espelho Embaciado | `clearing-mirror.webp` | Espelho com área limpa revelando olho |
| broken-chain | A Corrente Quebrada | `broken-chain.webp` | Elo de corrente partindo com luz |
| inner-sunrise | O Nascer do Sol Interior | `inner-sunrise.webp` | Caverna olhando para nascer do sol |

#### Estrutura de Dados
```typescript
interface SymbolicAvatar {
  id: string;
  name: string;
  description: string;
  emotionalState: string;
  imagePath: string;
}

const SYMBOLIC_AVATARS: SymbolicAvatar[] = [
  {
    id: "seed-in-dark",
    name: "A Semente no Escuro",
    description: "Uma pequena semente a brilhar timidamente debaixo da terra",
    emotionalState: "Para quem se sente 'enterrado' pelos problemas, mas sabe que tem um potencial imenso adormecido à espera de brotar. Representa a esperança contida e o início da jornada.",
    imagePath: "/avatars/seed-in-dark.webp"
  },
  // ... outros 9 avatares
];
```

### C. Redesign da Seção "Minha Jornada"

```text
NOVO DESIGN - Layout Responsivo e Acolhedor:

┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  ❤️ Minha Jornada                                              │  │
│  │  ─────────────────────────────────────────────────────────────  │  │
│  │  Seu progresso na jornada de transformação                     │  │
│  │                                                                │  │
│  │  ┌─────────────────────────────────────────────────────────┐   │  │
│  │  │  ╭──────────────────────────────────────────────────╮   │   │  │
│  │  │  │                                                  │   │   │  │
│  │  │  │   🌱 FASE DA JORNADA                             │   │   │  │
│  │  │  │   ───────────────                                │   │   │  │
│  │  │  │   Início                                         │   │   │  │
│  │  │  │                                                  │   │   │  │
│  │  │  │   "Você está dando os primeiros passos.          │   │   │  │
│  │  │  │    Cada jornada começa com coragem."             │   │   │  │
│  │  │  │                                                  │   │   │  │
│  │  │  ╰──────────────────────────────────────────────────╯   │   │  │
│  │  └─────────────────────────────────────────────────────────┘   │  │
│  │                                                                │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │  │
│  │  │  📊 TEMAS ATIVOS │  │  ⭐ SCORE MÉDIO  │  │ 🌿 MATURIDADE │  │  │
│  │  │  ────────────────│  │  ────────────────│  │ ─────────────│  │  │
│  │  │                  │  │                  │  │              │  │  │
│  │  │        0         │  │       3.5        │  │  Consolidado │  │  │
│  │  │                  │  │                  │  │              │  │  │
│  │  │  Temas em        │  │  Progresso       │  │  Nível de    │  │  │
│  │  │  exploração      │  │  geral           │  │  crescimento │  │  │
│  │  └──────────────────┘  └──────────────────┘  └──────────────┘  │  │
│  │                                                                │  │
│  │  ┌─────────────────────────────────────────────────────────┐   │  │
│  │  │  📈 Barra de Progresso Visual                          │   │  │
│  │  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │   │  │
│  │  │           35% do caminho percorrido                     │   │  │
│  │  └─────────────────────────────────────────────────────────┘   │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

MOBILE (empilhado):
┌────────────────────────────────┐
│ ❤️ Minha Jornada               │
├────────────────────────────────┤
│  ┌──────────────────────────┐  │
│  │  🌱 FASE                 │  │
│  │  Início                  │  │
│  │  "Você está dando os     │  │
│  │   primeiros passos..."   │  │
│  └──────────────────────────┘  │
│                                │
│  ┌────────────┬─────────────┐  │
│  │  📊        │  ⭐          │  │
│  │  TEMAS     │  SCORE      │  │
│  │    0       │   3.5       │  │
│  └────────────┴─────────────┘  │
│                                │
│  ┌──────────────────────────┐  │
│  │  🌿 MATURIDADE           │  │
│  │  Consolidado             │  │
│  └──────────────────────────┘  │
│                                │
│  ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░ 35%    │
└────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

### Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/components/profile/AvatarEditor.tsx` | Componente modal para edição de avatar |
| `src/components/profile/SymbolicAvatarGrid.tsx` | Grid de seleção dos 10 avatares simbólicos |
| `src/components/profile/JourneySection.tsx` | Seção redesenhada da jornada |
| `src/data/symbolicAvatars.ts` | Dados dos 10 avatares simbólicos |
| `public/avatars/*.webp` | 10 imagens dos avatares simbólicos (geradas via IA) |

### Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/pages/Profile.tsx` | Integrar AvatarEditor, substituir seção Jornada, adicionar estado para avatar_url |

---

## Migração de Banco de Dados

```sql
-- Criar bucket para avatares de usuário
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- Política: usuários autenticados podem fazer upload na própria pasta
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política: leitura pública dos avatares
CREATE POLICY "Avatars are publicly readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Política: usuários podem atualizar próprio avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política: usuários podem deletar próprio avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## Fluxo de Implementação

```text
FASE 1: Infraestrutura de Storage
├── 1.1 Criar bucket "avatars" via migração SQL
└── 1.2 Configurar políticas RLS para upload/leitura

FASE 2: Dados e Assets
├── 2.1 Criar src/data/symbolicAvatars.ts com os 10 avatares
└── 2.2 Gerar 10 imagens via IA e salvar em public/avatars/

FASE 3: Componentes de Avatar
├── 3.1 Criar SymbolicAvatarGrid.tsx (grid de seleção)
├── 3.2 Criar AvatarEditor.tsx (modal com upload + seleção)
└── 3.3 Integrar no Profile.tsx (substituir avatar estático)

FASE 4: Redesign da Seção Jornada
├── 4.1 Criar JourneySection.tsx com novo layout
└── 4.2 Substituir seção atual no Profile.tsx

FASE 5: Testes e Ajustes
├── 5.1 Testar upload de imagem
├── 5.2 Testar seleção de avatar simbólico
├── 5.3 Testar responsividade da seção Jornada
└── 5.4 Testar em diferentes tamanhos de tela
```

---

## Detalhes Técnicos

### Upload de Avatar
```typescript
const uploadAvatar = async (file: File) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${user.id}/avatar.${fileExt}`;
  
  // Upload para o bucket
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, { upsert: true });
  
  if (uploadError) throw uploadError;
  
  // Obter URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName);
  
  // Atualizar perfil
  await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', user.id);
};
```

### Seleção de Avatar Simbólico
```typescript
const selectSymbolicAvatar = async (avatarId: string) => {
  const avatar = SYMBOLIC_AVATARS.find(a => a.id === avatarId);
  if (!avatar) return;
  
  // Salvar o path do avatar simbólico como avatar_url
  await supabase
    .from('profiles')
    .update({ avatar_url: avatar.imagePath })
    .eq('id', user.id);
};
```

---

## Resultado Esperado

Após implementação:

1. **Avatar Editável**: Usuário pode clicar no avatar para abrir modal de edição
2. **Upload de Foto**: Usuário pode enviar foto pessoal que será armazenada no storage
3. **Avatares Simbólicos**: 10 opções representativas com significados emocionais profundos
4. **Jornada Redesenhada**: Layout moderno, responsivo e acolhedor com barra de progresso visual
5. **Experiência Mobile**: Seções empilhadas corretamente sem overflow

