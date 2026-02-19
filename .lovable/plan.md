
# Auditoria Completa da Inteligencia da Zion e Plano de Edição

## PARTE 1: Mapa Completo dos Agentes de IA

| # | Agente | Função | Modelo | Arquivo |
|---|--------|--------|--------|---------|
| 1 | Crisis Detector | Detecta risco de suicídio/autolesão | Gemini 2.5 Flash Lite | `crisis-detector/index.ts` |
| 2 | Intent Router | Classifica intenção da mensagem | Gemini 2.5 Flash Lite | `intent-router/index.ts` |
| 3 | Zyon Chat Core | Agente principal de conversa | Gemini 2.5 Flash | `zyon-chat/index.ts` |
| 4 | Output Validator/Rewriter | Valida e reescreve respostas | Gemini 2.5 Flash Lite | `zyon-chat/index.ts` (inline) |
| 5 | Turn Insight Observer | Analisa qualidade e progresso | GPT-5-mini / GPT-5 / Gemini Flash (fallback) | `turn-insight-observer/index.ts` |
| 6 | Testimony Transcriber | Transcreve áudio | Gemini 2.5 Flash / Pro (fallback) | `process-testimony/index.ts` |
| 7 | Testimony Analyzer | Análise teológica do testemunho | Gemini 3 Flash Preview | `process-testimony/index.ts` |

---

## PARTE 2: Inventário de Textos de Inteligência (System Prompts e Regras)

### A. Textos HARDCODED (nao editáveis pelo admin)

| ID | Texto | Localização | Linhas | Tamanho aprox. |
|----|-------|-------------|--------|----------------|
| H1 | **BASE_IDENTITY** - Identidade completa do Zyon (12 seções: Acolhimento, Lógica do Medo, Estrutura de Respostas, Referências Bíblicas, Honestidade Epistêmica, Limite Profissional, Privacidade, Modo Espelho, Anti-Teorização, Fio de Ouro, Protocolo de Bloqueios, Detecção de Mentiras) | `zyon-chat/index.ts` L250-334 | 85 linhas | ~4KB |
| H2 | **OBSERVER_SYSTEM_PROMPT** - Prompt do Observer (Fases da Jornada, Regras de Transição, Ciclo ZION, Rubricas, Issues, Taxonomia, Extração de Fatos) | `turn-insight-observer/index.ts` L13-155 | 143 linhas | ~7KB |
| H3 | **CRISIS_KEYWORDS** (high/medium) - Palavras-chave de crise | `zyon-chat/index.ts` L340-349 | 10 linhas | ~500B |
| H4 | **CRISIS_KEYWORDS** (high/medium/low) - Palavras-chave de crise (versão completa) | `crisis-detector/index.ts` L8-48 | 40 linhas | ~2KB |
| H5 | **CRISIS_CONTACTS** - Contatos de emergência | `crisis-detector/index.ts` L51-56 | 5 linhas | ~200B |
| H6 | **CRISIS_RESPONSE (high)** - Resposta de crise alta | `zyon-chat/index.ts` L373-381 | 8 linhas | ~500B |
| H7 | **CRISIS_RESPONSE (high/medium)** - Respostas de crise (versão completa) | `crisis-detector/index.ts` L68-93 | 25 linhas | ~1.5KB |
| H8 | **INTENT_PATTERNS** - Regex de classificação de intenção | `zyon-chat/index.ts` L396-422 | 26 linhas | ~1KB |
| H9 | **INTENT_PATTERNS** (versão completa com MATCHMAKING) | `intent-router/index.ts` L51-101 | 50 linhas | ~2KB |
| H10 | **Intent Router AI System Prompt** - Prompt de classificação por IA | `intent-router/index.ts` L258-271 | 13 linhas | ~800B |
| H11 | **RAG_PLANS** - Configuração de plano de busca por intenção | `zyon-chat/index.ts` L436-467 + `intent-router/index.ts` L131-204 | ~70 linhas | ~2KB |
| H12 | **OUTPUT_VALIDATOR** - Regras completas de validação (formato, presunção, causalidade, diagnóstico, explicação psicológica, especulação, conflito como fato, bíblia/maturidade, luto) | `zyon-chat/index.ts` L557-763 | 206 linhas | ~10KB |
| H13 | **REWRITE_PROMPT_BUILDER** - Template de reescrita | `zyon-chat/index.ts` L769-800 | 31 linhas | ~1.5KB |
| H14 | **MINIMAL_SAFE_RESPONSE** - Resposta de fallback segura | `zyon-chat/index.ts` L806-810 | 4 linhas | ~150B |
| H15 | **AVATAR_EMOTIONAL_CONTEXT** - 10 avatares simbólicos com dicas emocionais e sugestões para o modelo | `zyon-chat/index.ts` L180-234 | 54 linhas | ~3KB |
| H16 | **INTENT_GUIDANCE** - Orientações por intenção no prompt | `zyon-chat/index.ts` L1941-1947 | 7 linhas | ~600B |
| H17 | **QUESTION_TYPE_GUIDE** - Guias por tipo de pergunta recomendada | `zyon-chat/index.ts` L1960-1967 | 7 linhas | ~500B |
| H18 | **SYNONYM_MAP** - Mapa de sinônimos para compensação semântica | `zyon-chat/index.ts` L839-912 | ~73 linhas | ~3KB |
| H19 | **SPIRITUAL_MATURITY_GUIDE** - Guias por maturidade espiritual | `zyon-chat/index.ts` L1768-1774 | 6 linhas | ~500B |
| H20 | **VIOLATION_DESCRIPTIONS** - Descrições completas das violações | `zyon-chat/index.ts` L1003-1019 | 16 linhas | ~1KB |
| H21 | **TRANSCRIPTION_SYSTEM_PROMPT** - Prompt de transcrição de áudio | `process-testimony/index.ts` L159-174 | 15 linhas | ~800B |
| H22 | **ANALYSIS_SYSTEM_PROMPT** - Prompt de análise teológica de testemunho | `process-testimony/index.ts` L135-157 | 22 linhas | ~1.5KB |
| H23 | **BLOCKAGE_ALERT** - Instrução especial quando bloqueio detectado | `zyon-chat/index.ts` L2003-2013 | 10 linhas | ~600B |

### B. Textos EDITÁVEIS pelo admin (via painel)

| ID | Texto | Mecanismo | Página Admin |
|----|-------|-----------|--------------|
| E1 | **System Instructions** (Constituição + Instruções adicionais) | Tabela `system_instructions` (CRUD completo: nome, conteúdo, prioridade, ativo/inativo, pinned como Constituição) | `/admin/instructions` |
| E2 | **Curated Corrections / Few-Shot Examples** (Positivos, Negativos, Refinamentos) | Tabela `curated_corrections` (status, violations, diagnosis, corrected_response, notes) | `/admin/feedback-dataset` |
| E3 | **Knowledge Base / RAG Documents** | Tabela `documents` + `chunks` (upload, versionamento, camadas, domínios) | `/admin/documents` |

---

## PARTE 3: Gap Analysis - O que NAO e editável pelo admin

| Prioridade | Texto Hardcoded | Impacto | Risco de edição |
|------------|----------------|---------|-----------------|
| ALTA | H1: BASE_IDENTITY (Identidade central do Zyon) | Define todo o comportamento conversacional | Baixo (texto) |
| ALTA | H2: OBSERVER_SYSTEM_PROMPT (Observer) | Define como a jornada e avaliada | Baixo (texto) |
| ALTA | H12: OUTPUT_VALIDATOR (Regras de validação) | Determina o que e reescrito/bloqueado | Medio (regras complexas) |
| MEDIA | H3/H4: CRISIS_KEYWORDS | Afeta detecção de crise | Alto (segurança) |
| MEDIA | H6/H7: CRISIS_RESPONSES | Texto mostrado em emergência | Alto (segurança) |
| MEDIA | H15: AVATAR_EMOTIONAL_CONTEXT | Personalização por avatar | Baixo |
| MEDIA | H8/H9: INTENT_PATTERNS (regex) | Afeta classificação de mensagens | Alto (técnico) |
| MEDIA | H10: Intent Router AI Prompt | Classificação por IA | Baixo |
| MEDIA | H16: INTENT_GUIDANCE | Orientação por intenção | Baixo |
| MEDIA | H19: SPIRITUAL_MATURITY_GUIDE | Regras de Bíblia por perfil | Baixo |
| MEDIA | H21/H22: Testimony Prompts | Transcrição e análise | Baixo |
| BAIXA | H13: REWRITE_PROMPT_BUILDER | Template de reescrita | Baixo |
| BAIXA | H14: MINIMAL_SAFE_RESPONSE | Fallback seguro | Baixo |
| BAIXA | H17: QUESTION_TYPE_GUIDE | Micro-orientações | Baixo |
| BAIXA | H18: SYNONYM_MAP | Busca semântica | Medio |
| BAIXA | H20: VIOLATION_DESCRIPTIONS | Labels de violação | Baixo |

---

## PARTE 4: Plano de Implantação - Painel de Edição da Inteligência

### Estratégia

Criar uma nova tabela `ai_prompt_blocks` para armazenar todos os textos de inteligência atualmente hardcoded, e uma nova página admin "Inteligência Zion" para editá-los. As edge functions buscarão esses textos do banco em vez de usar constantes hardcoded.

### 4.1 Nova Tabela: `ai_prompt_blocks`

```text
ai_prompt_blocks
  id           UUID (PK)
  key          TEXT UNIQUE    -- Ex: "BASE_IDENTITY", "OBSERVER_SYSTEM_PROMPT"
  category     TEXT           -- Ex: "core", "crisis", "observer", "validator", "testimony"
  name         TEXT           -- Nome legível: "Identidade do Zyon"
  content      TEXT           -- O texto/prompt em si
  description  TEXT           -- Descrição do que faz (ajuda ao admin)
  is_active    BOOLEAN        -- Permite desativar temporariamente
  is_locked    BOOLEAN        -- Bloqueia edicao (para itens criticos de seguranca)
  version      INTEGER        -- Controle de versao
  updated_by   UUID           -- Quem editou por ultimo
  updated_at   TIMESTAMPTZ
  created_at   TIMESTAMPTZ
```

RLS: Somente `admin` e `desenvolvedor` podem ler/escrever.

### 4.2 Categorias e Blocos a Migrar

| Categoria | Blocos (key) | Locked? |
|-----------|-------------|---------|
| `core` | BASE_IDENTITY, MINIMAL_SAFE_RESPONSE, BLOCKAGE_ALERT | Nao |
| `crisis` | CRISIS_KEYWORDS_HIGH, CRISIS_KEYWORDS_MEDIUM, CRISIS_KEYWORDS_LOW, CRISIS_RESPONSE_HIGH, CRISIS_RESPONSE_MEDIUM, CRISIS_CONTACTS | Sim (seguranca) |
| `observer` | OBSERVER_SYSTEM_PROMPT, QUESTION_TYPE_GUIDE | Nao |
| `validator` | VALIDATION_RULES (JSON estruturado), REWRITE_TEMPLATE, VIOLATION_DESCRIPTIONS, SPIRITUAL_MATURITY_GUIDE | Nao |
| `testimony` | TRANSCRIPTION_SYSTEM_PROMPT, ANALYSIS_SYSTEM_PROMPT | Nao |
| `router` | INTENT_ROUTER_AI_PROMPT, INTENT_GUIDANCE | Nao |
| `personalization` | AVATAR_EMOTIONAL_CONTEXT (JSON) | Nao |

### 4.3 Nova Pagina Admin: `/admin/ai-intelligence`

Interface organizada por abas (categorias):

- **Core** - Identidade, fallback, bloqueio
- **Crise** - Keywords, respostas, contatos (com aviso de seguranca)
- **Observer** - Prompt do Observer, guias de perguntas
- **Validador** - Regras de validação, template de reescrita, violações
- **Testemunho** - Prompts de transcrição e análise
- **Router** - Prompt de classificação, orientações por intenção
- **Personalização** - Avatares e contexto emocional

Cada bloco terá:
- Editor de texto (textarea grande com preview markdown)
- Indicador de versão e quem editou por último
- Botao "Restaurar Original" (salva a versão hardcoded original como fallback)
- Badge de "Bloqueado" para itens criticos de seguranca (editável apenas com confirmação dupla)
- Diff view entre versão atual e original

### 4.4 Alterações nas Edge Functions

Cada edge function será modificada para:

1. Buscar o bloco do banco via `supabase.from("ai_prompt_blocks").select("content").eq("key", "BLOCO_KEY").eq("is_active", true).single()`
2. Usar fallback hardcoded se a busca falhar (resiliência)
3. Cache em memória por request (os blocos são lidos 1x por chamada)

Funções afetadas:
- `zyon-chat/index.ts` - Buscar BASE_IDENTITY, CRISIS_KEYWORDS, CRISIS_RESPONSE, INTENT_GUIDANCE, AVATAR_EMOTIONAL_CONTEXT, QUESTION_TYPE_GUIDE, SPIRITUAL_MATURITY_GUIDE, MINIMAL_SAFE_RESPONSE, VIOLATION_DESCRIPTIONS, REWRITE_TEMPLATE
- `turn-insight-observer/index.ts` - Buscar OBSERVER_SYSTEM_PROMPT
- `crisis-detector/index.ts` - Buscar CRISIS_KEYWORDS, CRISIS_RESPONSE, CRISIS_CONTACTS
- `intent-router/index.ts` - Buscar INTENT_ROUTER_AI_PROMPT
- `process-testimony/index.ts` - Buscar TRANSCRIPTION_SYSTEM_PROMPT, ANALYSIS_SYSTEM_PROMPT

### 4.5 Seed dos Dados Iniciais

A migração incluirá INSERT dos textos atuais hardcoded como valores iniciais, preservando tudo que funciona hoje.

### 4.6 Sequência de Implementação

1. Criar tabela `ai_prompt_blocks` com RLS e seed dos dados atuais
2. Criar a rota `/admin/ai-intelligence` no App.tsx
3. Criar a página `src/pages/admin/AIIntelligence.tsx` com CRUD por abas
4. Modificar `zyon-chat/index.ts` para buscar blocos do banco (com fallback)
5. Modificar `turn-insight-observer/index.ts` idem
6. Modificar `crisis-detector/index.ts` idem
7. Modificar `intent-router/index.ts` idem
8. Modificar `process-testimony/index.ts` idem
9. Testar ponta a ponta

### Nota sobre OUTPUT_VALIDATOR (H12)

As regras de validação (regex patterns, thresholds) são as mais complexas de externalizar porque envolvem lógica programática, não apenas texto. A abordagem recomendada é:

- Externalizar os **textos** de instrução de reescrita (rewriteInstructions) como editáveis
- Manter os **regex patterns** e **lógica** hardcoded (pois editar regex via UI seria perigoso)
- Permitir ajustar **thresholds numéricos** (max chars, max linhas, max perguntas) via um bloco JSON editável

---

## Resumo do Escopo

- **1 nova tabela** com ~25 blocos de texto iniciais
- **1 nova página admin** com 7 abas por categoria
- **5 edge functions** modificadas para buscar prompts do banco
- **Zero** quebra de funcionalidade (fallback para valores hardcoded)
