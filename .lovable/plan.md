

# Plano de Implementacao - FASE 2: Conexao Remota Soldado-Buscador

## Resumo Executivo

Este plano detalha a implementacao da Fase 2 do ZION, que conecta remotamente Soldados (mentores que venceram lutas) com Buscadores (usuarios em processo de transformacao). O sistema inclui: cadastro multi-aprovacao de Soldados, gravacao e processamento de testemunhos com IA, matchmaking semantico, e agendamento de conexoes.

## Arquitetura Atual (Auditoria)

### Tabelas Existentes Relevantes
- `profiles`, `user_profiles`: Dados de usuarios
- `user_roles` + enum `app_role`: Sistema de roles (soldado ja existe)
- `soldado_assignments`: Atribuicoes soldado-buscador (parcialmente implementada)
- `churches`, `church_members`: Estrutura eclesiastica
- `professional_credentials`: Credenciais verificaveis
- `user_themes`: Temas/dores por usuario (cenario + centro + matriz)
- `chunks` + vetores: Sistema RAG existente

### Funcoes SQL Existentes
- `has_role()`, `can_view_journey()`, `is_soldado_of()`: Permissoes
- `can_accept_assignment()`: Limite 10 buscadores por soldado
- `search_chunks()`: Busca vetorial existente

### Edge Functions Existentes
- `zyon-chat`: Chat principal com RAG
- `turn-insight-observer`: Extracao de taxonomia (cenario/centro/matriz)
- `aggregate-user-journey`: Consolidacao de temas por usuario

### Gaps Identificados
1. Nao existe fluxo de candidatura a Soldado
2. Nao existe sistema de aprovacao multi-autoridade
3. Nao existe armazenamento/processamento de testemunhos
4. Nao existe matchmaking semantico Buscador-Soldado
5. Nao existe sistema de agendamento
6. Nao existe chat soldado-buscador

---

## Divisao em Etapas de Implementacao

A implementacao sera dividida em **8 Etapas** independentes, cada uma gerando valor incremental e testavel.

---

## ETAPA 1: Schema de Candidatura a Soldado
**Complexidade:** Media | **Dependencias:** Nenhuma

### Objetivo
Criar infraestrutura de banco para candidaturas a soldado com aprovacao tripla (Admin + Profissional + Pastor).

### Novas Tabelas

```text
soldado_applications
├── id (uuid, PK)
├── user_id (uuid, FK profiles)
├── sponsored_by (uuid, FK profiles) -- Igreja/Admin/Profissional que iniciou
├── sponsor_role (app_role)
├── status (enum: pending, under_review, approved, rejected)
├── testimony_id (uuid, FK) -- linkado apos gravar testemunho
├── created_at, updated_at
└── rejection_reason (text, nullable)

soldado_application_approvals
├── id (uuid, PK)
├── application_id (uuid, FK)
├── approver_id (uuid, FK profiles)
├── approver_role (enum: admin, profissional, pastor)
├── approved (boolean)
├── notes (text)
├── created_at
└── UNIQUE(application_id, approver_role) -- Uma aprovacao por role
```

### Enums a Criar
```sql
CREATE TYPE soldado_application_status AS ENUM 
  ('pending', 'testimony_required', 'under_review', 'approved', 'rejected');
```

### RLS Policies
- Igreja/Admin/Profissional podem INSERT applications
- Admin/Profissional/Pastor podem INSERT approvals (restricao por role)
- Trigger para AUTO-APROVAR quando 3 roles aprovarem

### Entregaveis
- [ ] Migration com tabelas e enums
- [ ] RLS policies
- [ ] Funcao `check_soldado_approval_complete(application_id)` que atribui role

---

## ETAPA 2: UI de Candidatura a Soldado
**Complexidade:** Media | **Dependencias:** Etapa 1

### Objetivo
Criar interface para Igreja/Admin/Profissional cadastrar candidato a Soldado.

### Novos Componentes

```text
src/pages/admin/SoldadoApplications.tsx
├── Lista de candidaturas pendentes
├── Filtros por status
└── Botao "Nova Candidatura"

src/components/soldado/NewApplicationForm.tsx
├── Selecionar usuario existente OU convidar por email
├── Justificativa da indicacao
└── Submit cria application com status 'pending'

src/components/soldado/ApplicationApprovalCard.tsx
├── Dados do candidato
├── Testemunho (se existir)
├── Botoes Aprovar/Rejeitar por role
└── Campo de notas
```

### Rotas
- `/admin/soldado-applications` - Lista/gestao (Admin/Prof/Pastor)

### Entregaveis
- [ ] Pagina de listagem de candidaturas
- [ ] Formulario de nova candidatura
- [ ] Card de aprovacao com logica de role
- [ ] Rota e navegacao

---

## ETAPA 3: Gravacao de Testemunho (Audio)
**Complexidade:** Alta | **Dependencias:** Etapa 1

### Objetivo
Permitir que candidato grave testemunho em audio com feedback imediato.

### Novos Componentes

```text
src/pages/SoldadoTestimony.tsx
├── Instrucoes de gravacao
├── Componente de gravacao de audio
├── Preview antes de enviar
└── Mensagem pos-envio

src/components/soldado/AudioRecorder.tsx
├── MediaRecorder API
├── Visualizacao de waveform
├── Limite de tempo (5-15 min)
└── Botoes gravar/pausar/reiniciar
```

### Nova Tabela

```text
testimonies
├── id (uuid, PK)
├── user_id (uuid, FK profiles)
├── application_id (uuid, FK soldado_applications, nullable)
├── audio_url (text) -- Storage bucket
├── duration_seconds (int)
├── status (enum: uploading, processing, curated, published, rejected)
├── transcript (text, nullable) -- Preenchido pela IA
├── analysis (jsonb) -- Classificacao da IA
├── curator_notes (text)
├── curated_by (uuid)
├── curated_at (timestamp)
├── embedding (vector, nullable) -- Para matchmaking
├── created_at, updated_at
```

### Storage Bucket
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('testimonies', 'testimonies', false);
```

### Entregaveis
- [ ] Pagina de gravacao de testemunho
- [ ] Componente de gravacao de audio
- [ ] Upload para storage
- [ ] Atualizacao do status da application

---

## ETAPA 4: Processamento de Testemunho (Edge Function)
**Complexidade:** Alta | **Dependencias:** Etapa 3

### Objetivo
Processar testemunho em background: transcrever, analisar e classificar.

### Nova Edge Function

```text
supabase/functions/process-testimony/index.ts
├── 1. Download audio do storage
├── 2. Transcricao (ElevenLabs STT ou Lovable AI)
├── 3. Analise Teologica (LLM)
│   ├── Classificacao: Arrependimento vs Remorso
│   ├── Extracao de entidades (vicio/trauma)
│   ├── Mentira Matriz + Seguranca Perdida
│   ├── Tags automaticas (#Drogas, #Familia, etc)
│   └── Padrao de Transformacao (oracao, jejum, terapia)
├── 4. Anonimizacao de terceiros
├── 5. Vetorizacao para matchmaking
└── 6. Update testimony com resultados
```

### Schema de Analise (analysis JSONB)

```json
{
  "repentance_classification": "true_repentance" | "remorse",
  "repentance_confidence": 0.85,
  "repentance_evidence": ["reconheci que ofendi a Deus"],
  "entities": {
    "traumas": ["abandono", "abuso"],
    "addictions": ["alcool"],
    "victories": ["sobriedade", "reconciliacao"]
  },
  "lie_matrix": {
    "security_lost": "IDENTIDADE",
    "false_security": "aprovacao dos outros",
    "lie_believed": "Nao tenho valor se nao agradar"
  },
  "transformation_pattern": ["oracao", "comunidade", "terapia"],
  "suggested_tags": ["#Alcool", "#Familia", "#Restauracao"],
  "scenario": "FAMILIA",
  "center": "EMOCIONAL",
  "security_matrix": "IDENTIDADE",
  "safe_for_publication": true,
  "curator_required_reason": null
}
```

### Notificacao
- Push notification quando processamento concluir
- Email para curador humano revisar

### Entregaveis
- [ ] Edge function de processamento
- [ ] Integracao com transcricao (Lovable AI ou ElevenLabs)
- [ ] Prompt de analise teologica
- [ ] Vetorizacao compativel com chunks existentes
- [ ] Notificacao ao usuario

---

## ETAPA 5: Curadoria de Testemunhos
**Complexidade:** Media | **Dependencias:** Etapa 4

### Objetivo
Interface para Admin/Pastor/Profissional validar testemunhos antes de ativar Soldado.

### Novos Componentes

```text
src/pages/admin/TestimonyCuration.tsx
├── Lista de testemunhos pendentes
├── Player de audio
├── Transcricao ao lado
├── Analise da IA (sugestoes, nao bloqueio)
├── Botoes: Aprovar / Rejeitar / Pedir Regravacao
└── Campo de notas

src/components/soldado/TestimonyPlayer.tsx
├── Waveform visual
├── Controles de velocidade
└── Timestamps clicaveis
```

### Workflow
1. Curador revisa transcricao + analise
2. Se classificado como "Remorso", pode aprovar com ressalva ou pedir regravacao
3. Aprovacao atualiza `testimony.status = 'published'`
4. Se 3 aprovacoes em `soldado_application_approvals`: ativar role soldado

### Entregaveis
- [ ] Pagina de curadoria
- [ ] Player de audio com transcricao
- [ ] Fluxo de aprovacao/rejeicao
- [ ] Ativacao automatica do Soldado

---

## ETAPA 6: Perfil e Disponibilidade do Soldado
**Complexidade:** Media | **Dependencias:** Etapa 5

### Objetivo
Soldados configuram perfil publico e horarios disponiveis para conexoes.

### Novas Tabelas

```text
soldado_profiles
├── id (uuid, PK, FK profiles)
├── display_name (text) -- Nome para buscadores
├── bio (text) -- Resumo da jornada
├── testimony_id (uuid, FK) -- Testemunho principal
├── specialties (text[]) -- Tags de experiencia
├── is_available (boolean) -- Pausar temporariamente
├── max_weekly_sessions (int, default 5)
├── created_at, updated_at

soldado_availability
├── id (uuid, PK)
├── soldado_id (uuid, FK)
├── day_of_week (int, 0-6)
├── start_time (time)
├── end_time (time)
├── timezone (text, default 'America/Sao_Paulo')
├── is_recurring (boolean)
└── specific_date (date, nullable) -- Para excecoes
```

### Novos Componentes

```text
src/pages/SoldadoDashboard.tsx
├── Estatisticas (buscadores ativos, sessoes)
├── Proximos agendamentos
└── Link para configuracoes

src/components/soldado/ProfileEditor.tsx
├── Edicao de bio e nome
├── Selecao de tags/especialidades
└── Toggle disponibilidade

src/components/soldado/AvailabilityCalendar.tsx
├── Grade semanal
├── Drag-and-drop para horarios
└── Excecoes por data
```

### Entregaveis
- [ ] Pagina dashboard do Soldado
- [ ] Editor de perfil
- [ ] Calendario de disponibilidade
- [ ] RLS para soldados verem apenas proprio perfil

---

## ETAPA 7: Matchmaking Semantico
**Complexidade:** Alta | **Dependencias:** Etapas 4, 6

### Objetivo
IA sugere Soldados compativeis baseado na dor do Buscador.

### Nova Edge Function

```text
supabase/functions/matchmaking-soldado/index.ts
├── Input: user_id (buscador)
├── 1. Buscar user_themes ativos do buscador
├── 2. Buscar testemunhos publicados com embeddings
├── 3. Calcular similaridade semantica
├── 4. Filtrar por disponibilidade
├── 5. Ordenar por:
│   ├── Similaridade de cenario/matriz
│   ├── Proximidade de horario
│   └── Rating/feedback anterior
└── Output: Lista de soldados ranqueados
```

### Fallbacks (MVP com poucos soldados)
1. **Soldado Generalista**: Flag em `soldado_profiles.is_generalist`
2. **Conteudo Passivo**: Sugerir apenas ouvir testemunho (sem conexao)
3. **Retorno ao Zyon**: Continuar chat IA apos 3 recusas

### Novas Colunas em `chat_sessions`
```sql
ALTER TABLE chat_sessions ADD COLUMN matchmaking_state jsonb DEFAULT '{}';
-- { "attempts": 0, "excluded_soldados": [], "last_suggestion": null }
```

### Entregaveis
- [ ] Edge function de matchmaking
- [ ] Logica de fallback
- [ ] Integracao com chat Zyon

---

## ETAPA 8: Agendamento e Conexao
**Complexidade:** Media | **Dependencias:** Etapa 7

### Objetivo
Buscador agenda chamada com Soldado sugerido.

### Novas Tabelas

```text
connection_sessions
├── id (uuid, PK)
├── soldado_id (uuid, FK)
├── buscador_id (uuid, FK)
├── scheduled_at (timestamp with time zone)
├── duration_minutes (int, default 30)
├── status (enum: scheduled, confirmed, in_progress, completed, cancelled, no_show)
├── meeting_url (text) -- Google Meet, Jitsi, etc
├── soldado_notes (text) -- Preenchido apos
├── buscador_feedback (jsonb) -- Formulario pos-sessao
├── created_at, updated_at

soldado_session_feedback (MOCADO para Fase futura)
├── id, session_id, soldado_id
├── buscador_engagement (1-5)
├── progress_observed (text)
├── concerns (text)
├── recommend_professional (boolean)
└── created_at
```

### Fluxo UI no Chat

```text
1. Zyon detecta momento de sugerir conexao
   ├── Chamada a matchmaking-soldado
   └── Retorna top 3 soldados

2. UI exibe card de sugestao
   ├── Foto/nome/resumo do soldado
   ├── Horarios disponiveis
   └── Botoes: Agendar / Nao me identifico / Nao quero falar agora

3. Opcoes de recusa (por tipo):
   A. "Nao tenho disponibilidade" → UI pede horarios alternativos
   B. "Nao e minha situacao" → Feedback + nova busca
   C. "Nao estou pronto" → Oferece ouvir testemunho passivo
   D. 3 recusas → Retorna ao chat Zyon

4. Agendamento confirmado:
   ├── Criar connection_sessions
   ├── Notificar Soldado
   └── Adicionar ao calendario
```

### Novos Componentes

```text
src/components/chat/SoldadoSuggestionCard.tsx
├── Avatar e nome do soldado
├── Tags de experiencia
├── Trecho do testemunho
└── Horarios disponiveis (pills clicaveis)

src/components/chat/ScheduleConfirmation.tsx
├── Resumo do agendamento
├── Instrucoes pre-sessao
└── Adicionar ao calendario (ical)

src/pages/ConnectionRoom.tsx (futuro)
├── Video call integrado
├── Timer da sessao
└── Formulario pos-sessao
```

### Entregaveis
- [ ] Tabelas de agendamento
- [ ] Card de sugestao no chat
- [ ] Fluxo de recusa com fallbacks
- [ ] Confirmacao e notificacoes
- [ ] Formulario de feedback (mocado)

---

## Cronograma Sugerido

```text
Etapa 1: Schema Candidatura        │ 1 sessao
Etapa 2: UI Candidatura            │ 1-2 sessoes
Etapa 3: Gravacao Audio            │ 2 sessoes
Etapa 4: Processamento IA          │ 2-3 sessoes
Etapa 5: Curadoria                 │ 1-2 sessoes
Etapa 6: Perfil Soldado            │ 1-2 sessoes
Etapa 7: Matchmaking               │ 2-3 sessoes
Etapa 8: Agendamento               │ 2-3 sessoes
─────────────────────────────────────────────────
Total estimado: 13-19 sessoes
```

---

## Consideracoes Tecnicas

### Limite de Tokens
Cada etapa foi projetada para ser implementavel em 1-3 sessoes, mantendo contexto gerenciavel.

### Pre-requisitos por Etapa
- Etapa 2 depende de Etapa 1
- Etapa 4 depende de Etapa 3
- Etapa 5 depende de Etapa 4
- Etapa 7 depende de Etapas 4 + 6
- Etapa 8 depende de Etapa 7

### Riscos e Mitigacoes
1. **Poucos Soldados no MVP**: Fallbacks implementados na Etapa 7
2. **Classificacao Arrependimento/Remorso fragil**: Curador humano tem palavra final
3. **Latencia de processamento**: Background job com notificacao
4. **Matchmaking sem embeddings semanticos reais**: Hash-based inicial (como chunks existentes)

---

## Proximos Passos

Apos aprovacao deste plano, implementaremos **Etapa 1: Schema de Candidatura a Soldado** como primeira entrega, incluindo:
- Migrations para novas tabelas
- Enums e funcoes SQL
- RLS policies
- Testes de integridade

