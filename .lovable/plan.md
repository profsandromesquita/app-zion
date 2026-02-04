
# Plano de Correção: Transcrição de Áudio do Testemunho

## Diagnóstico da Causa Raiz

### Problema Identificado
A transcrição gerada está completamente incorreta porque o modelo de IA não está recebendo o áudio corretamente. A investigação revelou:

1. **Formato de Payload Incorreto**: O código atual usa `input_audio` (formato OpenAI), mas o Lovable AI Gateway espera `inline_data` (formato Gemini nativo)
2. **Áudio Não Processado**: O modelo recebeu apenas o texto do prompt e "inventou" uma transcrição plausível baseada no contexto (abandono, drogas, etc)
3. **Evidência**: A transcrição mostra um testemunho feminino genérico sobre abandono e drogas, o que indica "alucinação" - o modelo não ouviu o áudio real

### Código Problemático (Atual)
```typescript
// supabase/functions/process-testimony/index.ts:382-388
{
  type: "input_audio",  // ❌ Formato incorreto
  input_audio: {
    data: audioBase64,
    format: "webm",     // ❌ Deveria ser mime_type completo
  },
}
```

### Formato Correto (Gemini)
```typescript
{
  type: "inline_data",  // ✅ Formato Gemini
  inline_data: {
    mime_type: "audio/webm",  // ✅ MIME type completo
    data: audioBase64,
  },
}
```

---

## Plano de Correção

### Opção A: Corrigir Formato do Payload (Recomendado)
Modificar a chamada de API para usar o formato `inline_data` suportado pelo Gemini.

**Vantagens:**
- Correção rápida e simples
- Sem custos adicionais
- Usa infraestrutura existente

**Riscos:**
- Qualidade de transcrição depende do Gemini (não especializado em STT)

### Opção B: Integrar ElevenLabs STT (Alternativa Premium)
Usar ElevenLabs Speech-to-Text que é especializado em transcrição de alta qualidade.

**Vantagens:**
- Transcrição de altíssima qualidade
- Suporte nativo a português brasileiro
- Diarização e detecção de eventos

**Riscos:**
- Requer configurar conector ElevenLabs (custo adicional)
- Mais complexidade na implementação

---

## Implementação Escolhida: Opção A (Corrigir Formato)

### PARTE 1: Modificar Edge Function process-testimony

**Arquivo:** `supabase/functions/process-testimony/index.ts`

#### 1.1 Corrigir Payload de Transcrição (linhas 375-393)

```typescript
// ANTES (incorreto):
content: [
  { type: "text", text: "Transcreva este áudio de testemunho:" },
  {
    type: "input_audio",
    input_audio: {
      data: audioBase64,
      format: testimony.mime_type?.includes("webm") ? "webm" : "mp3",
    },
  },
],

// DEPOIS (correto):
content: [
  { type: "text", text: "Transcreva fielmente este áudio de testemunho em português brasileiro:" },
  {
    type: "inline_data",
    inline_data: {
      mime_type: testimony.mime_type || "audio/webm",
      data: audioBase64,
    },
  },
],
```

#### 1.2 Melhorar System Prompt de Transcrição (linhas 159-166)

```typescript
const TRANSCRIPTION_SYSTEM_PROMPT = `Você é um transcritor profissional especializado em português brasileiro.

TAREFA: Transcreva o áudio com TOTAL FIDELIDADE ao que foi dito. NÃO invente, NÃO adicione, NÃO interprete.

REGRAS ESTRITAS:
1. Transcreva EXATAMENTE o que a pessoa disse no áudio
2. Mantenha pausas longas como "..."
3. Indique expressões emocionais entre colchetes: [choro], [riso], [pausa longa], [suspiro]
4. Preserve gírias, sotaques e expressões regionais
5. NÃO adicione comentários ou interpretações
6. NÃO corrija gramática ou pronúncia
7. Mantenha repetições e hesitações naturais da fala
8. Se o áudio estiver inaudível, indique [inaudível]
9. Se não conseguir ouvir o áudio, responda APENAS: "[ERRO: ÁUDIO NÃO DETECTADO]"

IMPORTANTE: Se você não consegue acessar ou processar o conteúdo de áudio, NÃO invente uma transcrição. Responda indicando o erro.`;
```

#### 1.3 Adicionar Validação de Resposta (após linha 410)

```typescript
// Verificar se a transcrição parece válida (não é alucinação)
if (transcript && transcript.length > 0) {
  // Detectar padrões de alucinação comum
  const hallucination_indicators = [
    "[ERRO: ÁUDIO NÃO DETECTADO]",
    "não consegui acessar",
    "não foi possível processar",
  ];
  
  const isHallucination = hallucination_indicators.some(ind => 
    transcript.toLowerCase().includes(ind.toLowerCase())
  );
  
  if (isHallucination) {
    console.log("Transcription appears to be a hallucination or error");
    transcript = "[TRANSCRIÇÃO FALHOU - Requer transcrição manual]";
  }
}
```

### PARTE 2: Adicionar Fallback para Modelo Alternativo

Se o Gemini Flash falhar, tentar com modelo mais robusto:

```typescript
// Primeira tentativa: Gemini Flash
let transcriptionResponse = await fetch(url, {
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    // ...
  }),
});

// Fallback: Gemini Pro se Flash falhar
if (!transcriptionResponse.ok || needsRetry) {
  console.log("Retrying with Gemini Pro...");
  transcriptionResponse = await fetch(url, {
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      // ...
    }),
  });
}
```

### PARTE 3: Reprocessar Testemunho Existente

Após a correção, o testemunho de Marcos precisará ser reprocessado:

1. Atualizar status para "processing"
2. Chamar edge function com `skip_transcription: false`
3. Validar nova transcrição

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/process-testimony/index.ts` | MODIFICAR | Corrigir formato de payload e melhorar prompts |

---

## Seção Técnica: Detalhes da Implementação

### Formato Correto do Payload Multimodal

O Lovable AI Gateway traduz requisições para o formato nativo do Gemini. O formato correto para conteúdo multimodal com áudio:

```json
{
  "model": "google/gemini-2.5-flash",
  "messages": [
    {
      "role": "system",
      "content": "Prompt de transcrição..."
    },
    {
      "role": "user", 
      "content": [
        {
          "type": "text",
          "text": "Transcreva este áudio:"
        },
        {
          "type": "inline_data",
          "inline_data": {
            "mime_type": "audio/webm",
            "data": "BASE64_AUDIO_DATA"
          }
        }
      ]
    }
  ],
  "max_tokens": 16000
}
```

### Mapeamento de MIME Types

| Extensão | MIME Type Correto |
|----------|-------------------|
| .webm | audio/webm |
| .mp3 | audio/mp3 |
| .wav | audio/wav |
| .ogg | audio/ogg |
| .m4a | audio/m4a |

### Limitações do Gemini para Áudio

- Tamanho máximo inline: 20MB
- Para áudios maiores, seria necessário usar Files API (não disponível via gateway)
- Duração máxima recomendada: ~5 minutos para melhor precisão

---

## Testes de Validação

Após implementação:

1. Reprocessar testemunho de Marcos
2. Comparar transcrição gerada com áudio original
3. Verificar se a análise teológica faz sentido com o novo texto
4. Testar com áudios de diferentes durações e qualidades

---

## Resultado Esperado

1. Transcrição fiel ao conteúdo real do áudio
2. Análise teológica baseada no testemunho verdadeiro
3. Sistema de fallback para erros de processamento
4. Detecção de falhas para evitar "alucinações" silenciosas
