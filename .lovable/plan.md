

# Plano: Análise LLM do registro_text na sessão diária

## Alterações

### 1. Migration SQL

- Adicionar coluna `registro_analysis jsonb` (nullable) em `io_daily_sessions`
- Inserir flag `io_pm_registro_analysis_enabled` (global, false, description: "Habilita análise LLM do registro da missão para alimentar o Phase Manager")

### 2. Edge function `io-session-feedback/index.ts`

Após gerar o feedback (linha 121) e ANTES de retornar a response (linha 123):

- Checar flag `io_pm_registro_analysis_enabled` via `get_feature_flag`
- Se true, buscar `registro_text` da sessão via `session_id` na tabela `io_daily_sessions`
- Se `registro_text` >= 10 chars: chamar LLM com tool calling para extrair JSON estruturado
- Se vazio ou < 10 chars: gravar objeto `{ skipped: true, genuineness_score: 0, coherence_with_scales: 0, depth_level: "superficial", repetition_detected: false, key_themes: [], analysis_summary: "Registro vazio ou insuficiente" }`
- Se LLM falhar: gravar `registro_analysis = null`, log warning
- Todo o bloco em try/catch — não afeta o feedback já gerado
- Response inclui `registro_analysis_completed: true/false`

### Prompt de análise (tool calling)

Instrui o modelo a extrair via tool call `analyze_registro`:

- **`genuineness_score`**: number 0.0-1.0 (0=vazio/copiado, 1=profundamente pessoal)
- **`coherence_with_scales`**: number 0.0-1.0 (0=totalmente incoerente com as escalas, 1=perfeitamente alinhado)
- `depth_level`: enum "superficial" | "moderado" | "profundo"
- `repetition_detected`: boolean
- `key_themes`: string[]
- `analysis_summary`: string (breve)

O contexto passado ao LLM inclui o texto do registro, as escalas preenchidas e a missão do dia.

### Arquivos alterados
- `supabase/functions/io-session-feedback/index.ts`
- 1 migration SQL (coluna + flag)

### Segurança
- Flag OFF = zero mudança no comportamento atual
- Falha na análise não bloqueia feedback nem sessão
- Nenhum outro edge function alterado

