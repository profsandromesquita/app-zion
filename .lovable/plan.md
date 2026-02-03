

# ETAPA 8: Agendamento e Conexao - Plano de Implementacao

## Visao Geral

Esta etapa final implementa o sistema de agendamento de conexoes entre Buscadores e Soldados, completando o ciclo de matchmaking iniciado na Etapa 7.

---

## Arquitetura da Solucao

```text
┌─────────────────────────────────────────────────────────────────┐
│  BUSCADOR aceita sugestao de Soldado                            │
│  (handleAcceptSoldado em Chat.tsx - atualmente TODO)            │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. SELECAO DE HORARIO                                          │
│  - Exibir slots disponiveis do Soldado                          │
│  - Buscador clica no horario desejado                           │
│  - UI: TimeSlotPicker com pills clicaveis                       │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. CRIACAO DA CONNECTION_SESSION                               │
│  - Edge Function: schedule-connection                           │
│  - Cria registro com status 'scheduled'                         │
│  - Gera meeting_url (placeholder ou Jitsi)                      │
│  - Retorna dados da sessao                                      │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. NOTIFICACOES                                                │
│  - Push notification para Soldado                               │
│  - (Futuro: email/SMS)                                          │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. CONFIRMACAO NO CHAT                                         │
│  - ScheduleConfirmation.tsx                                     │
│  - Resumo do agendamento                                        │
│  - Botao "Adicionar ao Calendario" (.ics)                       │
│  - Instrucoes pre-sessao                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## PARTE 1: Alteracoes no Banco de Dados

### 1.1 Nova tabela connection_sessions

```sql
-- Enum para status de sessao de conexao
CREATE TYPE connection_session_status AS ENUM (
  'scheduled',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show'
);

-- Tabela principal de sessoes de conexao
CREATE TABLE public.connection_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soldado_id uuid NOT NULL REFERENCES auth.users(id),
  buscador_id uuid NOT NULL REFERENCES auth.users(id),
  chat_session_id uuid REFERENCES public.chat_sessions(id),
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 30,
  status connection_session_status DEFAULT 'scheduled',
  meeting_url text,
  soldado_notes text,
  buscador_feedback jsonb DEFAULT '{}',
  cancelled_by uuid,
  cancelled_reason text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indices
CREATE INDEX idx_connection_sessions_soldado 
ON public.connection_sessions(soldado_id, status);

CREATE INDEX idx_connection_sessions_buscador 
ON public.connection_sessions(buscador_id, status);

CREATE INDEX idx_connection_sessions_scheduled 
ON public.connection_sessions(scheduled_at) 
WHERE status IN ('scheduled', 'confirmed');

-- RLS
ALTER TABLE public.connection_sessions ENABLE ROW LEVEL SECURITY;

-- Soldados podem ver suas proprias sessoes
CREATE POLICY "Soldados can view own sessions"
ON public.connection_sessions FOR SELECT
USING (soldado_id = auth.uid() AND has_role(auth.uid(), 'soldado'));

-- Buscadores podem ver suas proprias sessoes
CREATE POLICY "Buscadores can view own sessions"
ON public.connection_sessions FOR SELECT
USING (buscador_id = auth.uid());

-- Service role pode inserir
CREATE POLICY "Service role can insert sessions"
ON public.connection_sessions FOR INSERT
WITH CHECK (true);

-- Soldados podem atualizar suas sessoes (notas, status)
CREATE POLICY "Soldados can update own sessions"
ON public.connection_sessions FOR UPDATE
USING (soldado_id = auth.uid() AND has_role(auth.uid(), 'soldado'));

-- Ambos podem cancelar
CREATE POLICY "Participants can cancel"
ON public.connection_sessions FOR UPDATE
USING (soldado_id = auth.uid() OR buscador_id = auth.uid());

-- Admins podem gerenciar tudo
CREATE POLICY "Admins can manage all sessions"
ON public.connection_sessions FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor'));

-- Trigger para updated_at
CREATE TRIGGER update_connection_sessions_updated_at
BEFORE UPDATE ON public.connection_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

### 1.2 Tabela soldado_session_feedback (Mocado para fase futura)

```sql
-- Feedback pos-sessao do Soldado sobre o Buscador
CREATE TABLE public.soldado_session_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.connection_sessions(id) ON DELETE CASCADE,
  soldado_id uuid NOT NULL REFERENCES auth.users(id),
  buscador_engagement integer CHECK (buscador_engagement BETWEEN 1 AND 5),
  progress_observed text,
  concerns text,
  recommend_professional boolean DEFAULT false,
  follow_up_needed boolean DEFAULT false,
  follow_up_notes text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.soldado_session_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Soldados can manage own feedback"
ON public.soldado_session_feedback FOR ALL
USING (soldado_id = auth.uid() AND has_role(auth.uid(), 'soldado'))
WITH CHECK (soldado_id = auth.uid() AND has_role(auth.uid(), 'soldado'));

CREATE POLICY "Admins can view all feedback"
ON public.soldado_session_feedback FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'profissional'));
```

---

## PARTE 2: Edge Function schedule-connection

### Entrada

```typescript
interface ScheduleConnectionRequest {
  buscador_id: string;
  soldado_id: string;
  chat_session_id: string;
  scheduled_at: string;      // ISO timestamp
  duration_minutes?: number; // default 30
}
```

### Saida

```typescript
interface ScheduleConnectionResponse {
  success: boolean;
  session: {
    id: string;
    scheduled_at: string;
    duration_minutes: number;
    meeting_url: string;
    soldado_name: string;
  };
  calendar_event: {
    title: string;
    description: string;
    start: string;
    end: string;
    location: string;
  };
  error?: string;
}
```

### Logica Principal

1. Validar que soldado esta disponivel no horario
2. Validar que nao ha conflitos de agendamento
3. Criar registro em connection_sessions
4. Gerar meeting_url (Jitsi ou placeholder)
5. Atualizar matchmaking_state para 'matched'
6. Enviar push notification para Soldado
7. Retornar dados para UI

---

## PARTE 3: Componentes UI

### 3.1 TimeSlotPicker.tsx

Seletor de horario com pills clicaveis:

```typescript
interface TimeSlotPickerProps {
  slots: AvailabilitySlot[];
  selectedSlot: AvailabilitySlot | null;
  onSelect: (slot: AvailabilitySlot) => void;
  disabled?: boolean;
}
```

Exibicao:
- Agrupar por dia (Hoje, Amanha, Proximos dias)
- Pills com horario de inicio/fim
- Destaque visual para slot selecionado
- Indicador "Hoje" / "Amanha"

### 3.2 ScheduleConfirmation.tsx

Card de confirmacao pos-agendamento:

```typescript
interface ScheduleConfirmationProps {
  session: {
    id: string;
    soldadoName: string;
    scheduledAt: string;
    durationMinutes: number;
    meetingUrl: string;
  };
  onAddToCalendar: () => void;
  onDismiss: () => void;
}
```

Conteudo:
- Checkmark de sucesso
- Nome do Soldado
- Data/hora formatada
- Duracao estimada
- Botao "Adicionar ao Calendario" (gera .ics)
- Instrucoes pre-sessao

### 3.3 Funcao generateICalEvent

Gerar arquivo .ics para download:

```typescript
function generateICalEvent(event: {
  title: string;
  description: string;
  start: Date;
  end: Date;
  location?: string;
}): string
```

---

## PARTE 4: Integracao com Chat.tsx

### Fluxo Atualizado do handleAcceptSoldado

```typescript
const handleAcceptSoldado = useCallback(async (soldadoId: string) => {
  if (!chatSessionId || !user) return;
  
  // 1. Se ja tem slots, mostrar picker
  if (matchmakingSuggestion?.soldado?.available_slots?.length > 0) {
    setShowTimeSlotPicker(true);
    setSelectedSoldadoForScheduling(matchmakingSuggestion.soldado);
    return;
  }
  
  // 2. Se nao tem slots, criar assignment direto (fallback)
  // ... logica de fallback
}, [chatSessionId, user, matchmakingSuggestion]);

// Novo handler para confirmar agendamento
const handleConfirmSchedule = useCallback(async (slot: AvailabilitySlot) => {
  if (!selectedSoldadoForScheduling || !user || !chatSessionId) return;
  
  setMatchmakingLoading(true);
  
  try {
    // Calcular scheduled_at baseado no slot
    const scheduledAt = calculateNextOccurrence(slot);
    
    const response = await supabase.functions.invoke("schedule-connection", {
      body: {
        buscador_id: user.id,
        soldado_id: selectedSoldadoForScheduling.soldado_id,
        chat_session_id: chatSessionId,
        scheduled_at: scheduledAt.toISOString(),
      },
    });
    
    if (response.error) throw new Error(response.error.message);
    
    // Limpar estado de matchmaking
    setMatchmakingSuggestion(null);
    setShowTimeSlotPicker(false);
    
    // Mostrar confirmacao
    setScheduleConfirmation(response.data.session);
    
    // Adicionar mensagem de confirmacao no chat
    const confirmMsg: Message = {
      id: `system-${Date.now()}`,
      sender: "ai",
      content: `Perfeito! Sua conversa com ${response.data.session.soldado_name} foi agendada para ${formatDateTime(scheduledAt)}. Voce recebera um lembrete antes do horario.`,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, confirmMsg]);
    
  } catch (error) {
    console.error("Error scheduling connection:", error);
    toast({
      title: "Erro ao agendar",
      description: "Nao foi possivel agendar a conexao. Tente novamente.",
      variant: "destructive",
    });
  } finally {
    setMatchmakingLoading(false);
  }
}, [selectedSoldadoForScheduling, user, chatSessionId, toast]);
```

---

## PARTE 5: Atualizacao do SoldadoDashboard

### Novo Tab: Proximos Agendamentos

Adicionar na lista de tabs do dashboard:

```typescript
<TabsTrigger value="sessions" className="flex items-center gap-2">
  <Calendar className="h-4 w-4" />
  Sessoes
</TabsTrigger>
```

### Componente UpcomingSessions.tsx

Listar sessoes agendadas/confirmadas:

```typescript
interface UpcomingSessionsProps {
  soldadoId: string;
}
```

Exibicao:
- Lista de cards com proximas sessoes
- Nome do buscador
- Data/hora
- Status (scheduled/confirmed)
- Botoes: Confirmar, Cancelar, Iniciar (quando hora chegar)

---

## PARTE 6: Notificacoes Push

### Notificar Soldado ao Agendar

Reutilizar padrao existente de `sendPushToUser`:

```typescript
// Em schedule-connection edge function
await sendPushToUser(supabaseUrl, supabaseKey, soldadoId, {
  title: "Nova conexao agendada 📅",
  body: `${buscadorName} quer conversar com voce no ${formattedDate}`,
  data: { 
    url: "/soldado",
    session_id: session.id 
  },
});
```

---

## PARTE 7: Geracao de Calendario iCal

### Funcao generateICalEvent

```typescript
export function generateICalEvent(event: {
  title: string;
  description: string;
  start: Date;
  end: Date;
  location?: string;
  organizer?: string;
}): string {
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const uid = `${Date.now()}@zion.app`;
  
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ZION//Connection Session//PT
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(event.start)}
DTEND:${formatDate(event.end)}
SUMMARY:${event.title}
DESCRIPTION:${event.description.replace(/\n/g, '\\n')}
${event.location ? `LOCATION:${event.location}` : ''}
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Lembrete: Sua conversa no ZION comeca em 15 minutos
END:VALARM
END:VEVENT
END:VCALENDAR`;
}

export function downloadICalFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

---

## PARTE 8: Revisao de Integracao das Etapas Anteriores

### Checklist de Verificacao

| Etapa | Componente | Status | Acao Necessaria |
|-------|------------|--------|-----------------|
| 5 | Formulario de Candidatura | Implementado | - |
| 5 | Aprovacao Multi-Role | Implementado | - |
| 5 | Trigger de criacao de perfil | Implementado | - |
| 6 | ProfileEditor | Implementado | - |
| 6 | AvailabilityCalendar | Implementado | - |
| 6 | SoldadoDashboard | Implementado | Adicionar tab Sessoes |
| 7 | matchmaking-soldado | Implementado | - |
| 7 | SoldadoSuggestionCard | Implementado | Adicionar TimeSlotPicker |
| 7 | handleAcceptSoldado | TODO | Implementar fluxo completo |
| 7 | handleRejectSoldado | Implementado | - |
| 8 | connection_sessions | Novo | Criar tabela |
| 8 | schedule-connection | Novo | Criar edge function |
| 8 | ScheduleConfirmation | Novo | Criar componente |
| 8 | Push para Soldado | Novo | Implementar notificacao |

### Correcoes Identificadas

1. **handleAcceptSoldado em Chat.tsx** - Atualmente apenas exibe mensagem TODO, precisa implementar fluxo real

2. **handleListenTestimony** - Marcado como TODO, implementar player de audio

3. **SoldadoSuggestionCard** - Adicionar seletor de horarios inline

---

## PARTE 9: Ordem de Implementacao

1. **Migracao SQL** - connection_sessions + soldado_session_feedback + RLS
2. **Edge Function schedule-connection** - Logica de agendamento
3. **config.toml** - Registrar nova funcao
4. **TimeSlotPicker.tsx** - Seletor de horarios
5. **ScheduleConfirmation.tsx** - Card de confirmacao
6. **lib/icalendar.ts** - Geracao de arquivos .ics
7. **Chat.tsx** - Integrar novo fluxo de agendamento
8. **SoldadoDashboard.tsx** - Adicionar tab de sessoes
9. **UpcomingSessions.tsx** - Lista de sessoes agendadas
10. **Push notifications** - Notificar soldado
11. **Testes end-to-end** - Validar fluxo completo

---

## PARTE 10: Secao Tecnica - Meeting URL

### Opcao 1: Jitsi (Recomendado para MVP)

```typescript
function generateJitsiUrl(sessionId: string): string {
  const roomName = `zion-${sessionId.substring(0, 8)}`;
  return `https://meet.jit.si/${roomName}`;
}
```

Vantagens:
- Gratuito e sem conta necessaria
- Funciona em todos browsers
- URL simples e direta

### Opcao 2: Placeholder para Futuro

```typescript
function generateMeetingUrl(sessionId: string): string {
  // Placeholder que pode ser substituido por integracao real
  return `/connection/${sessionId}`;
}
```

Para o MVP, usaremos Jitsi por ser gratuito e nao requerer integracao complexa.

---

## PARTE 11: Estados do Chat

### Novos Estados em Chat.tsx

```typescript
// Estados para agendamento
const [showTimeSlotPicker, setShowTimeSlotPicker] = useState(false);
const [selectedSoldadoForScheduling, setSelectedSoldadoForScheduling] = useState<SoldadoMatch | null>(null);
const [selectedTimeSlot, setSelectedTimeSlot] = useState<AvailabilitySlot | null>(null);
const [scheduleConfirmation, setScheduleConfirmation] = useState<{
  id: string;
  soldadoName: string;
  scheduledAt: string;
  durationMinutes: number;
  meetingUrl: string;
} | null>(null);
```

### Renderizacao Condicional

```typescript
{/* Time Slot Picker - aparece apos aceitar soldado */}
{showTimeSlotPicker && selectedSoldadoForScheduling && (
  <div className="mb-4 flex justify-start">
    <div className="max-w-[90%]">
      <TimeSlotPicker
        slots={selectedSoldadoForScheduling.available_slots}
        selectedSlot={selectedTimeSlot}
        onSelect={setSelectedTimeSlot}
        onConfirm={handleConfirmSchedule}
        onCancel={() => {
          setShowTimeSlotPicker(false);
          setSelectedSoldadoForScheduling(null);
        }}
        isLoading={matchmakingLoading}
      />
    </div>
  </div>
)}

{/* Schedule Confirmation - aparece apos agendar */}
{scheduleConfirmation && (
  <div className="mb-4 flex justify-start">
    <div className="max-w-[90%]">
      <ScheduleConfirmation
        session={scheduleConfirmation}
        onAddToCalendar={() => {
          const ical = generateICalEvent({
            title: `Conversa ZION com ${scheduleConfirmation.soldadoName}`,
            description: `Sessao de acompanhamento espiritual`,
            start: new Date(scheduleConfirmation.scheduledAt),
            end: new Date(
              new Date(scheduleConfirmation.scheduledAt).getTime() + 
              scheduleConfirmation.durationMinutes * 60000
            ),
            location: scheduleConfirmation.meetingUrl,
          });
          downloadICalFile(ical, 'zion-conexao.ics');
        }}
        onDismiss={() => setScheduleConfirmation(null)}
      />
    </div>
  </div>
)}
```

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| Migracao SQL | CRIAR | connection_sessions + feedback + RLS |
| `supabase/functions/schedule-connection/index.ts` | CRIAR | Edge function de agendamento |
| `supabase/config.toml` | MODIFICAR | Adicionar nova funcao |
| `src/components/chat/TimeSlotPicker.tsx` | CRIAR | Seletor de horarios |
| `src/components/chat/ScheduleConfirmation.tsx` | CRIAR | Card de confirmacao |
| `src/lib/icalendar.ts` | CRIAR | Geracao de .ics |
| `src/pages/Chat.tsx` | MODIFICAR | Integrar fluxo completo |
| `src/pages/SoldadoDashboard.tsx` | MODIFICAR | Adicionar tab sessoes |
| `src/components/soldado/UpcomingSessions.tsx` | CRIAR | Lista de sessoes |

