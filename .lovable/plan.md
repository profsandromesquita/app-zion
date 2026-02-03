
# Auditoria das Etapas 1-4 e Plano para Etapa 5

## AUDITORIA COMPLETA DAS ETAPAS ANTERIORES

---

### ETAPA 1: Schema de Candidaturas (Status: COMPLETO)

**Banco de Dados - Verificado:**

| Item | Status | Detalhes |
|------|--------|----------|
| Enum `soldado_application_status` | OK | pending, testimony_required, under_review, approved, rejected |
| Enum `testimony_status` | OK | uploading, processing, analyzed, curated, published, rejected |
| Tabela `soldado_applications` | OK | id, user_id, sponsored_by, sponsor_role, status, testimony_id, rejection_reason, created_at, updated_at |
| Tabela `soldado_application_approvals` | OK | id, application_id, approver_id, approver_role, approved, notes, created_at |
| Tabela `testimonies` | OK | 12 campos incluindo audio_url, transcript, analysis, embedding, curator_notes |
| Storage bucket `testimonies` | OK | Bucket privado configurado |

**Funcoes SQL - Verificado:**

| Funcao | Status | Descricao |
|--------|--------|-----------|
| `can_sponsor_soldado(_sponsor_id)` | OK | Verifica se usuario pode indicar soldado |
| `check_soldado_approval_complete()` | OK | Trigger que promove a soldado quando 3 aprovacoes |
| `get_application_approval_status(_application_id)` | OK | Retorna status de cada aprovador |
| `update_application_on_testimony()` | OK | Atualiza application para under_review quando testemunho criado |

**Triggers Configurados:**

| Trigger | Tabela | Funcao |
|---------|--------|--------|
| `trigger_check_soldado_approval` | soldado_application_approvals | check_soldado_approval_complete |
| `set_soldado_applications_updated_at` | soldado_applications | trigger_set_updated_at |
| `on_testimony_created` | testimonies | update_application_on_testimony |
| `set_testimonies_updated_at` | testimonies | trigger_set_updated_at |

**Dados de Teste:**
- 1 candidatura existente em status `testimony_required`
- 0 testemunhos gravados ainda

---

### ETAPA 2: UI de Candidatura (Status: COMPLETO)

**Componentes Criados:**

| Arquivo | Status | Funcionalidade |
|---------|--------|----------------|
| `ApplicationStatusBadge.tsx` | OK | Badge visual com icone e cor para cada status |
| `NewApplicationForm.tsx` | OK | Dialog com busca de usuarios elegiveis, validacao Zod |
| `ApplicationApprovalCard.tsx` | OK | Card com avatar, info sponsor, aprovacoes, botoes aprovar/rejeitar |
| `SoldadoApplications.tsx` | OK | Pagina com tabs por status, lista de candidaturas |

**Integracao na Navegacao:**
- Rota `/admin/soldado-applications` funcionando
- AdminLayout com item de menu "Candidatos Soldado"
- AdminDashboard com card de contagem

---

### ETAPA 3: Gravacao de Testemunho (Status: COMPLETO)

**Componentes Criados:**

| Arquivo | Status | Funcionalidade |
|---------|--------|----------------|
| `AudioRecorder.tsx` | OK | MediaRecorder API, waveform canvas, timer, estados idle/recording/paused/stopped |
| `TestimonyInstructions.tsx` | OK | Instrucoes para gravacao do testemunho |
| `SoldadoTestimony.tsx` | OK | Pagina de gravacao com upload para storage |

**Fluxo de Upload:**
1. Grava audio com WebM/Opus
2. Upload para storage bucket `testimonies/{user_id}/{application_id}.webm`
3. Cria registro em `testimonies` com status `processing`
4. Trigger `on_testimony_created` atualiza application para `under_review`

**Integracao com UI:**
- Profile.tsx mostra card de candidatura pendente com botao "Gravar Testemunho"
- ApplicationApprovalCard mostra botao para candidato gravar
- Rota `/testimony/:applicationId` configurada

---

### ETAPA 4: Processamento de Testemunho (Status: COMPLETO)

**Edge Function `process-testimony`:**

| Passo | Status | Detalhes |
|-------|--------|----------|
| Download audio | OK | Extrai path do audio_url e baixa do storage |
| Transcricao | OK | Usa Gemini 2.5 Flash multimodal com `input_audio` |
| Analise Teologica | OK | Usa Gemini 3 Flash com tool calling `extract_testimony_analysis` |
| Vetorizacao | OK | Hash-based embedding de 1536 dimensoes |
| Update testimony | OK | Atualiza transcript, analysis, embedding, status para `analyzed` |
| Push notification | OK | Envia notificacao ao candidato |

**Schema de Analise (JSONB):**
```text
repentance_classification: true_repentance | remorse | unclear
repentance_confidence: 0-1
repentance_evidence: []
entities: { traumas, addictions, victories }
lie_matrix: { security_lost, false_security, lie_believed }
transformation_pattern: []
suggested_tags: []
scenario, center, security_matrix (Taxonomia ZION)
safe_for_publication: boolean
curator_required_reason: string | null
anonymized_transcript: string
```

**Modos de Operacao:**
- Modo individual: `{ testimony_id: "uuid" }`
- Modo batch: `{ batch: true }` - processa ate 10 pendentes

---

## GAPS IDENTIFICADOS (Ajustes para Etapa 5)

### Gap 1: Trigger de Processamento Automatico
- O testemunho e criado com status `processing`, mas nao ha trigger automatico para chamar a edge function
- **Solucao na Etapa 5**: Adicionar botao "Processar" na UI de curadoria + opcao de cron job

### Gap 2: Falta Badge para Status do Testemunho
- Existe `ApplicationStatusBadge` mas nao existe `TestimonyStatusBadge`
- **Solucao na Etapa 5**: Criar componente para exibir status do testemunho

### Gap 3: Curadores nao conseguem ver testemunhos na UI
- A pagina `SoldadoApplications` nao mostra informacoes do testemunho
- **Solucao na Etapa 5**: Criar pagina dedicada de curadoria

### Gap 4: Campo `justification` do formulario nao e salvo
- O `NewApplicationForm` coleta justificativa mas nao salva em lugar nenhum
- **Impacto baixo**: A justificativa e opcional, mas poderia ser util para os aprovadores

---

## FLUXO COMPLETO VALIDADO

```text
1. Igreja/Admin/Profissional cria candidatura
   └─> soldado_applications.status = 'testimony_required'

2. Candidato grava testemunho
   └─> Upload para storage: testimonies/{user_id}/{app_id}.webm
   └─> Insert testimonies com status = 'processing'
   └─> Trigger: application.status = 'under_review', testimony_id linkado

3. Edge function processa (manual ou batch)
   └─> Transcricao + Analise + Embedding
   └─> testimonies.status = 'analyzed'
   └─> Push notification ao candidato

4. [ETAPA 5] Curadores revisam testemunho
   └─> Admin/Pastor/Profissional aprovam
   └─> testimonies.status = 'curated' ou 'published'

5. Triple-approval ja implementado
   └─> Trigger check_soldado_approval_complete
   └─> 3 aprovacoes -> user_roles += 'soldado'
   └─> soldado_applications.status = 'approved'
```

---

## RESUMO DAS ETAPAS FUTURAS

| Etapa | Nome | Status | Dependencia |
|-------|------|--------|-------------|
| 5 | Curadoria de Testemunhos | **PROXIMO** | Etapa 4 |
| 6 | Dashboard do Soldado | Pendente | Etapa 5 |
| 7 | Matchmaking Semantico | Pendente | Etapas 4, 5, 6 |
| 8 | Chat Soldado-Buscador | Pendente | Etapa 7 |

---

# PLANO DE IMPLEMENTACAO - ETAPA 5: Curadoria de Testemunhos

## Objetivo

Criar interface para Admin/Pastor/Profissional validar testemunhos antes de ativar Soldado. O curador deve:
1. Ouvir o audio
2. Ler a transcricao
3. Revisar sugestoes da IA (nao bloqueantes)
4. Aprovar, rejeitar ou pedir regravacao

---

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────┐
│  /admin/testimony-curation                                  │
│  (Pagina TestimonyCuration.tsx)                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Tabs: Todos | Pendentes | Em Curadoria | Publicados │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ TestimonyCurationCard                                │   │
│  │ ┌─────────────────────────────────────────────────┐ │   │
│  │ │ [Avatar] Candidato | Sponsor | Data              │ │   │
│  │ │ [ApplicationStatusBadge] [TestimonyStatusBadge]  │ │   │
│  │ └─────────────────────────────────────────────────┘ │   │
│  │                                                       │   │
│  │ ┌─────────────────────────────────────────────────┐ │   │
│  │ │ TestimonyPlayer                                  │ │   │
│  │ │ [Waveform + Play/Pause + Speed + Progress]      │ │   │
│  │ └─────────────────────────────────────────────────┘ │   │
│  │                                                       │   │
│  │ ┌─────────────────────────────────────────────────┐ │   │
│  │ │ Transcricao (ScrollArea)                         │ │   │
│  │ │ [Texto anonimizado com highlights de emocao]    │ │   │
│  │ └─────────────────────────────────────────────────┘ │   │
│  │                                                       │   │
│  │ ┌─────────────────────────────────────────────────┐ │   │
│  │ │ Analise IA (Accordion)                           │ │   │
│  │ │ > Arrependimento: true_repentance (85%)         │ │   │
│  │ │ > Taxonomia: FAMILIA / EMOCIONAL / IDENTIDADE   │ │   │
│  │ │ > Entidades: Traumas, Vicios, Vitorias          │ │   │
│  │ │ > Tags Sugeridas: #Alcool #Familia              │ │   │
│  │ │ > Aviso: [curator_required_reason]               │ │   │
│  │ └─────────────────────────────────────────────────┘ │   │
│  │                                                       │   │
│  │ [Textarea: Notas do Curador]                         │   │
│  │                                                       │   │
│  │ [Rejeitar] [Pedir Regravacao] [Aprovar]              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Componentes a Criar

### 1. TestimonyStatusBadge.tsx
Badge visual para status do testemunho (uploading, processing, analyzed, curated, published, rejected).

### 2. TestimonyPlayer.tsx
Player de audio com:
- Waveform visual (canvas)
- Play/Pause/Stop
- Controle de velocidade (0.75x, 1x, 1.25x, 1.5x, 2x)
- Barra de progresso clicavel
- Display de tempo atual/total

### 3. TestimonyAnalysisPanel.tsx
Painel com accordion para exibir:
- Classificacao de arrependimento com badge de confianca
- Taxonomia ZION (Cenario, Centro, Matriz)
- Entidades extraidas (traumas, vicios, vitorias)
- Tags sugeridas
- Lie Matrix (Seguranca Perdida, Falsa Seguranca, Mentira)
- Aviso do curador se `safe_for_publication = false`

### 4. TestimonyCurationCard.tsx
Card completo com:
- Info do candidato e sponsor
- TestimonyPlayer
- Transcricao em ScrollArea
- TestimonyAnalysisPanel (collapsible)
- Campo de notas do curador
- Botoes de acao: Rejeitar, Pedir Regravacao, Aprovar

### 5. TestimonyCuration.tsx (Pagina)
Pagina principal com:
- Tabs: Pendentes (processing/analyzed) | Em Curadoria (curated) | Publicados | Rejeitados
- Lista de TestimonyCurationCard
- Botao para processar testemunhos pendentes (chamar edge function)

---

## Fluxo de Aprovacao

### Acao: Aprovar
```typescript
// 1. Atualizar testemunho
await supabase.from("testimonies").update({
  status: "curated", // ou "published" se auto-publicar
  curator_notes: notes,
  curated_by: user.id,
  curated_at: new Date().toISOString(),
}).eq("id", testimonyId);

// 2. Registrar aprovacao na tabela de aprovacoes (se ainda nao existir)
// O trigger check_soldado_approval_complete cuidara da promocao
await supabase.from("soldado_application_approvals").insert({
  application_id: applicationId,
  approver_id: user.id,
  approver_role: approverRole, // admin, profissional, ou pastor
  approved: true,
  notes: notes,
});
```

### Acao: Rejeitar
```typescript
// 1. Atualizar testemunho
await supabase.from("testimonies").update({
  status: "rejected",
  curator_notes: notes,
  curated_by: user.id,
  curated_at: new Date().toISOString(),
}).eq("id", testimonyId);

// 2. Atualizar candidatura
await supabase.from("soldado_applications").update({
  status: "rejected",
  rejection_reason: notes,
}).eq("id", applicationId);
```

### Acao: Pedir Regravacao
```typescript
// 1. Rejeitar testemunho atual
await supabase.from("testimonies").update({
  status: "rejected",
  curator_notes: "Solicitada regravacao: " + notes,
  curated_by: user.id,
  curated_at: new Date().toISOString(),
}).eq("id", testimonyId);

// 2. Voltar candidatura para testimony_required
await supabase.from("soldado_applications").update({
  status: "testimony_required",
  testimony_id: null,
}).eq("id", applicationId);

// 3. Enviar push notification ao candidato
```

---

## Integracao com Navegacao

### AdminLayout.tsx
Adicionar item de menu:
```typescript
{ to: "/admin/testimony-curation", icon: FileCheck, label: "Curadoria de Testemunhos" }
```

### App.tsx
Adicionar rota:
```typescript
<Route path="/admin/testimony-curation" element={<TestimonyCuration />} />
```

### AdminDashboard.tsx
Adicionar card de contagem de testemunhos pendentes.

---

## Ajuste Identificado: Gap 4 (Justificativa)

Adicionar campo `sponsor_notes` na tabela `soldado_applications` para armazenar a justificativa da indicacao:

```sql
ALTER TABLE soldado_applications 
ADD COLUMN sponsor_notes text;
```

Atualizar `NewApplicationForm.tsx` para salvar a justificativa.

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/components/soldado/TestimonyStatusBadge.tsx` | CRIAR | Badge para status do testemunho |
| `src/components/soldado/TestimonyPlayer.tsx` | CRIAR | Player de audio com waveform |
| `src/components/soldado/TestimonyAnalysisPanel.tsx` | CRIAR | Painel de analise da IA |
| `src/components/soldado/TestimonyCurationCard.tsx` | CRIAR | Card completo de curadoria |
| `src/pages/admin/TestimonyCuration.tsx` | CRIAR | Pagina principal |
| `src/components/admin/AdminLayout.tsx` | MODIFICAR | Adicionar item de menu |
| `src/pages/admin/AdminDashboard.tsx` | MODIFICAR | Adicionar card de pendentes |
| `src/App.tsx` | MODIFICAR | Adicionar rota |
| `src/components/soldado/NewApplicationForm.tsx` | MODIFICAR | Salvar justificativa |
| Migracao SQL | CRIAR | Adicionar campo sponsor_notes |

---

## Ordem de Implementacao

1. **Migracao SQL** - Adicionar `sponsor_notes` em soldado_applications
2. **TestimonyStatusBadge.tsx** - Componente simples
3. **TestimonyPlayer.tsx** - Player de audio
4. **TestimonyAnalysisPanel.tsx** - Painel de analise
5. **TestimonyCurationCard.tsx** - Card principal
6. **TestimonyCuration.tsx** - Pagina completa
7. **Atualizacoes de navegacao** - AdminLayout, App.tsx, AdminDashboard
8. **NewApplicationForm.tsx** - Salvar justificativa

---

## Consideracoes Tecnicas

### Acesso ao Audio
O bucket `testimonies` e privado. Usar signed URLs:
```typescript
const { data } = await supabase.storage
  .from("testimonies")
  .createSignedUrl(path, 3600); // 1 hora
```

### Permissoes de Curadoria
Roles autorizados: admin, desenvolvedor, profissional, pastor
Ja coberto pelas RLS policies existentes na tabela `testimonies`.

### Processamento Manual
Adicionar botao "Processar Testemunho" que chama a edge function:
```typescript
await supabase.functions.invoke("process-testimony", {
  body: { testimony_id: testimonyId },
});
```
