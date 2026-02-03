
# Plano de Implementacao - ETAPA 4: Processamento de Testemunho (Edge Function)

## Verificacao de Pre-requisitos

### Etapa 1 - Status: COMPLETO
- Tabela `soldado_applications` com campo `testimony_id`
- Enum `soldado_application_status` com todos os status necessarios
- Trigger `on_testimony_created` para atualizar application status

### Etapa 2 - Status: COMPLETO
- UI de gestao de candidaturas funcionando
- Cards de aprovacao implementados

### Etapa 3 - Status: COMPLETO
- Tabela `testimonies` criada com campos:
  - `id`, `user_id`, `application_id`
  - `audio_url`, `duration_seconds`, `file_size_bytes`, `mime_type`
  - `status` (testimony_status enum)
  - `transcript` (text, nullable)
  - `analysis` (jsonb)
  - `embedding` (vector 1536)
  - `curator_notes`, `curated_by`, `curated_at`
- Storage bucket `testimonies` (privado)
- Pagina de gravacao `SoldadoTestimony.tsx` funcionando
- Upload para storage criando registro com `status: 'processing'`

### Infraestrutura Existente
- **Lovable AI Gateway** disponivel (`LOVABLE_API_KEY` configurado)
- **Push Notifications** configuradas (VAPID keys, `send-push-reminder`)
- **Embedding system** usando hash-based de 1536 dimensoes (`simple-hash-v1`)
- **Taxonomia ZION** definida (Scenario, Center, Security Matrix)

---

## Arquitetura da Solucao

```text
┌─────────────────────────────────────────────────────────────┐
│  Upload Testemunho (SoldadoTestimony.tsx)                   │
│  status: 'processing'                                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Trigger: process-testimony (chamado via webhook ou cron)   │
│  OU: Chamada manual via Admin UI                            │
└─────────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│ 1. Download Audio        │  │ Fallback: Marcar como        │
│    do Storage            │  │ 'curator_required'           │
└──────────────────────────┘  └──────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Transcricao (Lovable AI - gemini-2.5-flash multimodal)   │
│    - Input: Audio base64                                     │
│    - Output: Texto transcrito                                │
└──────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Analise Teologica (Lovable AI - gemini-3-flash-preview)  │
│    - Tool calling para extracao estruturada                  │
│    - Schema: TestimonyAnalysis                               │
└──────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Vetorizacao (Hash-based embedding 1536)                   │
│    - Compativel com sistema de chunks existente              │
└──────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. Update Testimony                                          │
│    - transcript, analysis, embedding                         │
│    - status: 'analyzed' (aguardando curadoria humana)        │
└──────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. Notificacoes                                              │
│    - Push notification para candidato                        │
│    - Alerta para curadores (Admin/Pastor/Profissional)       │
└──────────────────────────────────────────────────────────────┘
```

---

## PARTE 1: Edge Function `process-testimony`

### Arquivo: `supabase/functions/process-testimony/index.ts`

### Entrada
```typescript
interface ProcessTestimonyRequest {
  testimony_id: string;
  skip_transcription?: boolean; // Para reprocessar apenas analise
}
```

### Pipeline de Processamento

#### Passo 1: Download do Audio
```typescript
// Extrair path do storage a partir da audio_url
const audioPath = extractStoragePath(testimony.audio_url);

// Download do arquivo
const { data: audioData, error } = await supabase.storage
  .from('testimonies')
  .download(audioPath);

// Converter para base64 para envio ao Lovable AI
const audioBase64 = await blobToBase64(audioData);
```

#### Passo 2: Transcricao com Lovable AI
```typescript
// Usar Gemini 2.5 Flash (multimodal) para transcricao
const transcriptionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [
      {
        role: "system",
        content: "Voce e um transcriptor de audio em portugues brasileiro. Transcreva o audio fielmente, mantendo pausas como '...' e expressoes emocionais entre colchetes [choro], [riso]. Nao adicione nenhum comentario proprio."
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Transcreva este audio de testemunho:" },
          { type: "audio_url", audio_url: { url: `data:audio/webm;base64,${audioBase64}` } }
        ]
      }
    ],
    max_tokens: 16000,
  }),
});

const transcription = transcriptionResponse.choices[0].message.content;
```

#### Passo 3: Analise Teologica
```typescript
const ANALYSIS_SYSTEM_PROMPT = `Voce e um analista teologico especializado na metodologia ZION.
Analise o testemunho transcrito e extraia informacoes estruturadas.

TAXONOMIA ZION:
- CENARIO (onde doi): CASAMENTO, CARREIRA, FAMILIA, VIDA_SOCIAL, AUTOESTIMA, 
  SAUDE, FINANCAS, MINISTERIO, LUTO, SEXUALIDADE, PATERNIDADE, MATERNIDADE
- CENTRO (como reage): INSTINTIVO (raiva/controle), EMOCIONAL (magoa/vergonha), MENTAL (ansiedade/paralisia)
- MATRIZ DE SEGURANCA (raiz): SOBREVIVENCIA (Eu estou seguro?), IDENTIDADE (Eu sou amado?), CAPACIDADE (Eu sou capaz?)

CLASSIFICACAO DE ARREPENDIMENTO:
- ARREPENDIMENTO VERDADEIRO: Reconhece que ofendeu a Deus, nao apenas consequencias. 
  Palavras-chave: "pequei contra Deus", "desobedeci", "me arrependi diante de Deus"
- REMORSO: Foco nas consequencias, dor propria, medo do castigo.
  Palavras-chave: "me arrependo das consequencias", "foi dificil para mim", "nao quero sofrer de novo"

REGRAS:
- Se nao identificar claramente, use confidence baixa
- Cite evidencias diretas do texto
- Anonimize nomes de terceiros com [PESSOA_1], [PESSOA_2]
- Sinalize conteudo potencialmente problematico para curadoria`;

const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
      { role: "user", content: `Analise este testemunho:\n\n${transcription}` }
    ],
    tools: [ANALYSIS_EXTRACTION_TOOL],
    tool_choice: { type: "function", function: { name: "extract_testimony_analysis" } },
  }),
});
```

### Schema de Analise (Tool Calling)
```typescript
const ANALYSIS_EXTRACTION_TOOL = {
  type: "function",
  function: {
    name: "extract_testimony_analysis",
    description: "Extrai analise estruturada do testemunho",
    parameters: {
      type: "object",
      properties: {
        repentance_classification: {
          type: "string",
          enum: ["true_repentance", "remorse", "unclear"],
          description: "Classificacao do tipo de arrependimento"
        },
        repentance_confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Confianca na classificacao (0-1)"
        },
        repentance_evidence: {
          type: "array",
          items: { type: "string" },
          description: "Citacoes diretas que evidenciam a classificacao"
        },
        entities: {
          type: "object",
          properties: {
            traumas: {
              type: "array",
              items: { type: "string" },
              description: "Traumas identificados (abandono, abuso, etc)"
            },
            addictions: {
              type: "array",
              items: { type: "string" },
              description: "Vicios mencionados (alcool, drogas, pornografia, etc)"
            },
            victories: {
              type: "array",
              items: { type: "string" },
              description: "Vitorias alcancadas (sobriedade, reconciliacao, etc)"
            }
          }
        },
        lie_matrix: {
          type: "object",
          properties: {
            security_lost: {
              type: "string",
              enum: ["SOBREVIVENCIA", "IDENTIDADE", "CAPACIDADE"],
              description: "Qual matriz de seguranca foi ferida"
            },
            false_security: {
              type: "string",
              description: "O que a pessoa buscou como falsa seguranca"
            },
            lie_believed: {
              type: "string",
              description: "A mentira que a pessoa acreditou"
            }
          }
        },
        transformation_pattern: {
          type: "array",
          items: { type: "string" },
          description: "Elementos do padrao de transformacao (oracao, jejum, comunidade, terapia, etc)"
        },
        suggested_tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags sugeridas no formato #Tag (ex: #Alcool, #Familia)"
        },
        scenario: {
          type: "string",
          enum: ["CASAMENTO", "CARREIRA", "FAMILIA", "VIDA_SOCIAL", "AUTOESTIMA",
                 "SAUDE", "FINANCAS", "MINISTERIO", "LUTO", "SEXUALIDADE",
                 "PATERNIDADE", "MATERNIDADE"],
          description: "Cenario principal do testemunho"
        },
        related_scenarios: {
          type: "array",
          items: { type: "string" },
          description: "Cenarios secundarios relacionados"
        },
        center: {
          type: "string",
          enum: ["INSTINTIVO", "EMOCIONAL", "MENTAL"],
          description: "Centro dominante na experiencia"
        },
        security_matrix: {
          type: "string",
          enum: ["SOBREVIVENCIA", "IDENTIDADE", "CAPACIDADE"],
          description: "Matriz de seguranca raiz"
        },
        safe_for_publication: {
          type: "boolean",
          description: "Se o conteudo parece seguro para publicacao sem curadoria adicional"
        },
        curator_required_reason: {
          type: "string",
          nullable: true,
          description: "Razao pela qual curadoria humana e necessaria (heresia, conteudo sensivel, etc)"
        },
        anonymized_transcript: {
          type: "string",
          description: "Transcricao com nomes de terceiros anonimizados"
        }
      },
      required: [
        "repentance_classification", "repentance_confidence", "scenario", 
        "center", "security_matrix", "safe_for_publication"
      ]
    }
  }
};
```

#### Passo 4: Vetorizacao
```typescript
// Usar mesma funcao de embedding do ingest-document
// Hash-based embedding de 1536 dimensoes (compativel com chunks)
const embedding = await generateSimpleEmbedding(transcription);
```

#### Passo 5: Update no Banco
```typescript
const { error: updateError } = await supabase
  .from('testimonies')
  .update({
    transcript: analysis.anonymized_transcript || transcription,
    analysis: analysisData,
    embedding: embedding,
    status: 'analyzed',
    updated_at: new Date().toISOString(),
  })
  .eq('id', testimony_id);
```

#### Passo 6: Notificacoes
```typescript
// Push notification para o candidato
await sendPushToUser(testimony.user_id, {
  title: "Testemunho Analisado",
  body: "Seu testemunho foi processado e esta aguardando revisao.",
  data: { url: "/profile" }
});

// Inserir alerta para curadores (via tabela ou canal realtime)
// Os curadores verao na pagina de admin
```

---

## PARTE 2: Trigger de Processamento

### Opcao A: Webhook apos INSERT (recomendado)
Criar um Database Webhook que dispara a edge function quando um testemunho e inserido com `status = 'processing'`.

### Opcao B: Chamada Manual via Admin
Adicionar botao "Processar" na UI de curadoria para reprocessar testemunhos.

### Opcao C: Job Periodico (pg_cron)
Similar ao `send-push-reminder`, rodar a cada hora para processar testemunhos pendentes.

```sql
-- Job pg_cron para processar testemunhos pendentes
SELECT cron.schedule(
  'process-pending-testimonies',
  '0 * * * *', -- A cada hora
  $$
  SELECT net.http_post(
    url := 'https://nqbagdwufarytluhaaas.supabase.co/functions/v1/process-testimony-batch',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

## PARTE 3: Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `supabase/functions/process-testimony/index.ts` | CRIAR | Edge function principal |
| `supabase/config.toml` | MODIFICAR | Adicionar `[functions.process-testimony]` |

---

## PARTE 4: Detalhes Tecnicos

### Modelo para Transcricao
- **Modelo**: `google/gemini-2.5-flash` (multimodal, suporta audio)
- **Formato de Audio**: WebM/Opus (como gravado no frontend)
- **Limite**: Audio de ate 15 minutos (~5-10MB)

### Modelo para Analise
- **Modelo**: `google/gemini-3-flash-preview` (rapido, bom em tool calling)
- **Estrategia**: Tool calling para extracao estruturada
- **Fallback**: Se tool calling falhar, usar JSON schema em system prompt

### Embeddings
- **Metodo**: Hash-based (`simple-hash-v1`)
- **Dimensoes**: 1536 (compativel com chunks existentes)
- **Uso**: Matchmaking semantico na Etapa 7

### Rate Limits e Custos
- Lovable AI tem limites por workspace
- Processar um testemunho de 10 min ~2-3 chamadas de API
- Implementar retry com backoff exponencial

---

## PARTE 5: Tratamento de Erros

```typescript
// Estados de erro possiveis
const ERROR_STATES = {
  AUDIO_DOWNLOAD_FAILED: {
    status: 'processing', // Manter para retry
    error_message: 'Falha ao baixar audio do storage'
  },
  TRANSCRIPTION_FAILED: {
    status: 'processing',
    error_message: 'Falha na transcricao'
  },
  ANALYSIS_FAILED: {
    status: 'analyzed', // Continuar com transcricao apenas
    error_message: 'Falha na analise, transcricao disponivel'
  },
  RATE_LIMITED: {
    status: 'processing',
    retry_after: '1 hour'
  }
};
```

---

## PARTE 6: Seguranca

### Acesso a Edge Function
- `verify_jwt = false` para permitir chamadas via webhook/cron
- Validar `SUPABASE_SERVICE_ROLE_KEY` internamente
- Opcional: Secret header para webhooks

### Dados Sensiveis
- Transcricoes nao sao expostas publicamente
- Anonimizacao de nomes de terceiros
- RLS policies ja configuradas

---

## Ordem de Implementacao

1. **Criar Edge Function** `process-testimony/index.ts`
2. **Atualizar config.toml** com nova funcao
3. **Testar manualmente** com um testemunho existente
4. **Implementar trigger** (webhook ou cron)
5. **Testar fluxo completo** end-to-end

---

## Consideracoes

### Audio Multimodal com Gemini
O Gemini 2.5 Flash suporta audio como input multimodal. O audio deve ser enviado em base64 no formato:
```json
{
  "type": "audio_url",
  "audio_url": { "url": "data:audio/webm;base64,..." }
}
```

**Nota**: Se o Lovable AI Gateway nao suportar input de audio diretamente, sera necessario:
1. Usar ElevenLabs STT (conectar via connector)
2. Ou implementar transcricao manual como fallback

### Compatibilidade com Etapa 5 (Curadoria)
O status `analyzed` indica que o testemunho foi processado pela IA e esta pronto para revisao humana.
A Etapa 5 criara a UI de curadoria onde Admin/Pastor/Profissional poderao:
- Revisar transcricao
- Corrigir classificacoes
- Aprovar/rejeitar para publicacao

### Compatibilidade com Etapa 7 (Matchmaking)
O embedding gerado sera usado para encontrar testemunhos semanticamente similares aos temas do Buscador (`user_themes`).
