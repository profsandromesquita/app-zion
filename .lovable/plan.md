
# Plano: Completar Fluxo de Visibilidade do Soldado

## Problemas Identificados

Apos investigacao detalhada, identifiquei as seguintes lacunas no fluxo atual:

### 1. Usuario indicado nao recebe notificacao
- A candidatura de Marcos foi criada com sucesso (status: `testimony_required`)
- Porem, **nao ha push notification** enviada ao usuario quando ele e indicado
- Marcos so saberia da indicacao se acessar a pagina de Perfil e notar o card

### 2. Onde gravar audio - Falta de descobribilidade
- A rota `/testimony/:applicationId` existe e funciona
- Porem o usuario precisa acessar `/profile` para ver o card com botao "Gravar Testemunho"
- Nao ha nenhum indicador visual no Chat ou home que sinalize a pendencia

### 3. Recurso de conexao com Soldado invisivel para Buscadores
- A opcao de solicitar um Soldado so aparece **reativamente** durante o chat quando:
  - Usuario atinge fase PADROES
  - lie_active e identificado com confidence >= 0.6
- Buscadores nao sabem que essa funcionalidade existe
- Deveria haver um preview/teaser visivel (mesmo desabilitado) para awareness

---

## Solucao Proposta

### PARTE 1: Notificacao Push ao ser Indicado

Modificar `NewApplicationForm.tsx` para enviar push notification apos criar candidatura.

```text
Novo fluxo:
1. Admin cria candidatura via form
2. Sistema insere em soldado_applications (ja existe)
3. [NOVO] Sistema chama edge function para notificar usuario
4. Usuario recebe push: "Voce foi indicado para Soldado! 🎖️"
```

Opcoes de implementacao:
- **A) Trigger de banco de dados**: Apos INSERT em soldado_applications, disparar pg_net para edge function
- **B) Chamada direta do frontend**: Apos sucesso do insert, chamar supabase.functions.invoke

Recomendacao: Opcao B (mais simples, ja temos o padrao)

### PARTE 2: Indicador Visual de Pendencia

Adicionar um "badge" ou banner no header do Chat e/ou na Home quando o usuario tiver candidatura pendente.

```typescript
// Em Chat.tsx ou num componente global
{hasPendingApplication && applicationStatus === "testimony_required" && (
  <Banner 
    onClick={() => navigate(`/testimony/${applicationId}`)}
    icon={<Mic />}
    text="Voce foi indicado para Soldado! Clique para gravar seu testemunho."
  />
)}
```

### PARTE 3: Preview do Recurso "Conversar com Soldado"

Adicionar card/teaser visivel no perfil do Buscador que:
- Mostra que a conexao com Soldados existe
- Explica que sera sugerido durante a jornada
- Pode ter um CTA "Saiba mais" ou estar desabilitado

```text
┌─────────────────────────────────────────────┐
│  🎖️ Conexao com Soldados                    │
│                                             │
│  Em algum momento da sua jornada, podemos   │
│  sugerir conversar com alguem que passou    │
│  por algo parecido. Isso acontece quando    │
│  identificamos que voce pode se beneficiar. │
│                                             │
│  [Indisponivel - Continue sua jornada]      │
└─────────────────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `supabase/functions/notify-application-created/index.ts` | CRIAR | Edge function para notificar usuario indicado |
| `supabase/config.toml` | MODIFICAR | Adicionar nova funcao |
| `src/components/soldado/NewApplicationForm.tsx` | MODIFICAR | Chamar edge function apos criar candidatura |
| `src/components/soldado/PendingApplicationBanner.tsx` | CRIAR | Banner de pendencia para Chat/Header |
| `src/pages/Chat.tsx` | MODIFICAR | Adicionar verificacao de candidatura pendente e banner |
| `src/pages/Profile.tsx` | MODIFICAR | Adicionar card "Conexao com Soldados" para Buscadores |
| `src/components/profile/SoldadoConnectionTeaser.tsx` | CRIAR | Card teaser explicando o recurso |

---

## Detalhamento Tecnico

### 1. Edge Function notify-application-created

```typescript
// Entrada
interface NotifyApplicationRequest {
  user_id: string;
  application_id: string;
  sponsor_name?: string;
}

// Logica
1. Buscar push_subscriptions do user_id
2. Enviar push notification:
   - Titulo: "Voce foi indicado para Soldado! 🎖️"
   - Body: "Alguem reconhece sua jornada e acredita em voce. Acesse seu perfil para gravar seu testemunho."
   - Data: { url: "/profile" }
```

### 2. PendingApplicationBanner.tsx

```typescript
interface PendingApplicationBannerProps {
  applicationId: string;
  status: "testimony_required" | "pending" | "under_review";
  onNavigate: () => void;
}

// Renderizacao contextual:
- testimony_required: "Grave seu testemunho para continuar"
- under_review: "Seu testemunho esta sendo analisado"
- pending: "Aguardando proximos passos"
```

### 3. Modificacao em Chat.tsx

```typescript
// Adicionar state
const [pendingApplication, setPendingApplication] = useState<{
  id: string;
  status: string;
} | null>(null);

// Carregar na inicializacao (apos checkOnboardingAndInit)
const loadPendingApplication = async () => {
  if (!user) return;
  const { data } = await supabase
    .from("soldado_applications")
    .select("id, status")
    .eq("user_id", user.id)
    .in("status", ["pending", "testimony_required", "under_review"])
    .maybeSingle();
  setPendingApplication(data);
};

// Renderizar banner no topo do chat se houver pendencia
```

### 4. SoldadoConnectionTeaser.tsx (Profile)

Card informativo que aparece para todo Buscador:
- Explica que o recurso existe
- Indica que sera sugerido organicamente
- Nao e um botao de acao (nao dispara matchmaking)
- Visual diferente (mais sutil, informativo)

---

## Ordem de Implementacao

1. **notify-application-created** - Edge function de notificacao
2. **config.toml** - Registrar funcao
3. **NewApplicationForm.tsx** - Integrar chamada da edge function
4. **PendingApplicationBanner.tsx** - Componente de banner
5. **Chat.tsx** - Adicionar banner de candidatura pendente
6. **SoldadoConnectionTeaser.tsx** - Card teaser
7. **Profile.tsx** - Adicionar teaser para Buscadores
8. **Testes** - Validar fluxo completo

---

## Resultado Esperado

1. **Marcos recebe push**: "Voce foi indicado para Soldado!"
2. **Ao abrir o app**: Ve banner no chat indicando acao necessaria
3. **No perfil**: Ve card de candidatura com botao "Gravar Testemunho"
4. **Todo Buscador**: Ve card explicando que pode conversar com Soldados no futuro
