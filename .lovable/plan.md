

# Plano de Correção: Formato do Payload Multimodal para Transcrição

## Diagnóstico Completo

### Áudio Real vs. Transcrição Gerada

| Aspecto | Áudio Real (Bita) | IA Gerou (Errado) |
|---------|-------------------|-------------------|
| **Nome** | "Eu sou o Bita, 43 anos" | Pessoa anônima feminina |
| **História** | Overdose, cocaína, golpes na internet | Problemas de trabalho/família |
| **Detalhes** | Filho de 7 anos encontrou, parada cardíaca | Chorar no quarto |
| **Resultado** | "Deus me resgatou, fui totalmente curado" | "Decidi levantar" |

### Causa Raiz Identificada

O modelo **não está ouvindo o áudio**. A transcrição é completamente inventada porque o formato do payload multimodal está incorreto.

**Código Atual (ERRADO):**
```typescript
content: [
  { type: "text", text: "Transcreva..." },        // ❌ type não necessário
  { 
    type: "inline_data",                           // ❌ campo type inválido
    inline_data: { mime_type, data } 
  },
]
```

**Formato Correto do Gemini:**
```typescript
content: [
  { text: "Transcreva..." },                       // ✅ texto direto
  { inline_data: { mime_type, data } },            // ✅ sem campo type
]
```

O Lovable AI Gateway espera o formato nativo do Gemini, onde cada parte é identificada pela presença da chave (`text` ou `inline_data`), não por um campo `type` separado.

---

## Plano de Correção

### PARTE 1: Remover campos "type" desnecessários

**Arquivo:** `supabase/functions/process-testimony/index.ts`

#### 1.1 Corrigir payload do Gemini Flash (linhas 388-397)

```typescript
// ANTES:
content: [
  { type: "text", text: "Transcreva fielmente este áudio..." },
  {
    type: "inline_data",
    inline_data: {
      mime_type: testimony.mime_type || "audio/webm",
      data: audioBase64,
    },
  },
],

// DEPOIS:
content: [
  { text: "Transcreva fielmente este áudio de testemunho em português brasileiro:" },
  {
    inline_data: {
      mime_type: testimony.mime_type || "audio/webm",
      data: audioBase64,
    },
  },
],
```

#### 1.2 Corrigir payload do Gemini Pro fallback (linhas 455-464)

Aplicar a mesma correção no bloco de retry com o modelo Pro.

### PARTE 2: Adicionar log para debug do formato

Adicionar log antes da chamada de API para verificar se o payload está correto:

```typescript
console.log(`Audio payload format: mime_type=${testimony.mime_type}, data_length=${audioBase64.length}`);
```

### PARTE 3: Reprocessar o testemunho existente

Após deploy da correção:
1. Atualizar status do testemunho para "processing"
2. Triggar o reprocessamento
3. Validar que a nova transcrição menciona "Bita", "overdose", "13 anos limpo"

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/process-testimony/index.ts` | MODIFICAR | Remover campos `type` do array de content multimodal |

---

## Seção Técnica

### Por que o modelo "alucina"?

1. O Gateway recebe `{ type: "inline_data", inline_data: {...} }`
2. O Gemini não reconhece o campo `type` neste contexto
3. O modelo ignora o objeto com `type` desconhecido
4. Sobra apenas o prompt de texto: "Transcreva este áudio..."
5. Sem áudio para transcrever, o modelo inventa um testemunho plausível

### Formato das partes multimodais (Gemini API)

| Tipo de Parte | Formato Correto |
|---------------|-----------------|
| Texto | `{ text: "string" }` |
| Imagem/Áudio inline | `{ inline_data: { mime_type: "...", data: "base64" } }` |
| Arquivo URL | `{ file_data: { file_uri: "...", mime_type: "..." } }` |

O campo `type` é usado em outras APIs (como OpenAI) mas **não faz parte** do schema nativo do Gemini.

### Logs de evidência

```
Audio downloaded: 3455389 bytes, type: audio/webm
Audio converted to base64: 4607188 chars
Transcription complete (Flash): 27 chars          ← Modelo não ouviu nada
Retrying with Gemini Pro model...
Transcription complete (Pro): 1184 chars          ← Modelo inventou texto
```

---

## Testes de Validação

Após implementação:

1. **Deploy da edge function**
2. **Reprocessar testemunho** de `contato@profsandromesquita.com`
3. **Verificar transcrição** deve conter:
   - "Bita" (nome do narrador)
   - "43 anos"
   - "13 anos limpo"
   - "overdose"
   - "cocaína"
   - "parada cardíaca"
   - "Deus me resgatou"

4. **Comparar com áudio real**:
> "Oi, eu sou o Bita, eu tenho 43 anos, estou há 13 anos limpo, vim de uma overdose há 13 anos atrás, me perdi de químico, de cocaína..."

---

## Resultado Esperado

1. Transcrição fiel ao conteúdo real do áudio
2. Análise teológica baseada no testemunho verdadeiro do Bita
3. Sistema funcionando para todos os futuros testemunhos

