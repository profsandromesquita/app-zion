
# Plano de Implementacao - ETAPA 3: Gravacao de Testemunho (Audio)

## Verificacao de Pre-requisitos

### Etapa 1 - Status: COMPLETO
- Tabela `soldado_applications` com campo `testimony_id` (uuid, nullable)
- Enum `soldado_application_status` inclui `testimony_required`
- RLS policies configuradas para candidaturas
- Trigger de auto-aprovacao funcionando

### Etapa 2 - Status: COMPLETO
- Pagina `SoldadoApplications.tsx` implementada
- Formulario de nova candidatura criando status `testimony_required`
- Cards de aprovacao funcionando
- Navegacao integrada

### GAP Identificado
A tabela `testimonies` e o storage bucket `testimonies` ainda NAO existem no banco de dados. Serao criados nesta etapa.

---

## Arquitetura da Solucao

```text
Candidato Soldado
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  /testimony/:applicationId                          │
│  (Pagina SoldadoTestimony.tsx)                      │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Instrucoes de Gravacao                       │   │
│  │ - Diretrizes teologicas                      │   │
│  │ - Tempo recomendado (5-15 min)               │   │
│  │ - Dicas para estruturar o testemunho         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ AudioRecorder Component                       │   │
│  │ ┌─────────────────────────────────────────┐  │   │
│  │ │  [Waveform Visualization]                │  │   │
│  │ │   ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁                        │  │   │
│  │ │                                          │  │   │
│  │ │   00:00:00 / 15:00                        │  │   │
│  │ └─────────────────────────────────────────┘  │   │
│  │                                               │   │
│  │   [○ Gravar]  [⏸ Pausar]  [↻ Reiniciar]     │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Preview + Envio                              │   │
│  │ - Player de audio                            │   │
│  │ - Botao Enviar Testemunho                    │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  Upload para Storage Bucket: testimonies/           │
│  - Arquivo: {user_id}/{application_id}.webm         │
│  - Bucket privado (RLS)                             │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  Tabela: testimonies                                │
│  - status: 'uploading' -> 'processing'              │
│  - Trigger: atualiza soldado_applications           │
│    (status -> 'under_review')                       │
└─────────────────────────────────────────────────────┘
       │
       ▼
  [ETAPA 4: Edge Function process-testimony]
```

---

## PARTE 1: Migracao de Banco de Dados

### Nova Tabela: testimonies

```sql
-- Enum para status do testemunho
CREATE TYPE testimony_status AS ENUM (
  'uploading',
  'processing',
  'analyzed',
  'curated',
  'published',
  'rejected'
);

-- Tabela principal de testemunhos
CREATE TABLE public.testimonies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  application_id uuid REFERENCES soldado_applications(id) ON DELETE SET NULL,
  
  -- Arquivo de audio
  audio_url text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  file_size_bytes integer,
  mime_type text DEFAULT 'audio/webm',
  
  -- Status e processamento
  status testimony_status NOT NULL DEFAULT 'uploading',
  
  -- Dados preenchidos pela IA (Etapa 4)
  transcript text,
  analysis jsonb DEFAULT '{}',
  
  -- Curadoria humana (Etapa 5)
  curator_notes text,
  curated_by uuid REFERENCES profiles(id),
  curated_at timestamptz,
  
  -- Embedding para matchmaking (Etapa 7)
  embedding vector(1536),
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Apenas um testemunho ativo por usuario
  CONSTRAINT unique_active_testimony UNIQUE (user_id, application_id)
);

-- Index para buscas
CREATE INDEX idx_testimonies_user_id ON testimonies(user_id);
CREATE INDEX idx_testimonies_application_id ON testimonies(application_id);
CREATE INDEX idx_testimonies_status ON testimonies(status);

-- Trigger para updated_at
CREATE TRIGGER set_testimonies_updated_at
  BEFORE UPDATE ON testimonies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();
```

### RLS Policies para testimonies

```sql
-- Habilitar RLS
ALTER TABLE testimonies ENABLE ROW LEVEL SECURITY;

-- Usuarios podem ver seus proprios testemunhos
CREATE POLICY "Users can view own testimonies"
  ON testimonies FOR SELECT
  USING (auth.uid() = user_id);

-- Usuarios podem inserir seus proprios testemunhos
CREATE POLICY "Users can insert own testimonies"
  ON testimonies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Usuarios podem atualizar seus proprios testemunhos (status uploading apenas)
CREATE POLICY "Users can update own uploading testimonies"
  ON testimonies FOR UPDATE
  USING (auth.uid() = user_id AND status = 'uploading');

-- Admin/Dev/Profissional/Pastor podem ver todos para curadoria
CREATE POLICY "Authorized roles can view all testimonies"
  ON testimonies FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'desenvolvedor') OR
    has_role(auth.uid(), 'profissional') OR
    has_role(auth.uid(), 'pastor')
  );

-- Admin/Profissional/Pastor podem atualizar para curadoria
CREATE POLICY "Authorized roles can update testimonies"
  ON testimonies FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'desenvolvedor') OR
    has_role(auth.uid(), 'profissional') OR
    has_role(auth.uid(), 'pastor')
  );
```

### Storage Bucket: testimonies

```sql
-- Criar bucket privado para testemunhos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'testimonies',
  'testimonies',
  false,
  104857600, -- 100MB max
  ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
);

-- RLS para storage
CREATE POLICY "Users can upload own testimonies"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'testimonies' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own testimonies"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'testimonies' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'desenvolvedor') OR
      has_role(auth.uid(), 'profissional') OR
      has_role(auth.uid(), 'pastor')
    )
  );

CREATE POLICY "Authorized roles can access all testimonies"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'testimonies' AND
    (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'desenvolvedor')
    )
  );
```

### Funcao para atualizar status da candidatura

```sql
CREATE OR REPLACE FUNCTION update_application_on_testimony()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quando testemunho e criado, atualizar candidatura
  IF TG_OP = 'INSERT' THEN
    -- Linkar testemunho na candidatura
    UPDATE soldado_applications
    SET testimony_id = NEW.id,
        status = 'under_review',
        updated_at = now()
    WHERE id = NEW.application_id
      AND status = 'testimony_required';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_testimony_created
  AFTER INSERT ON testimonies
  FOR EACH ROW
  EXECUTE FUNCTION update_application_on_testimony();
```

---

## PARTE 2: Componente AudioRecorder.tsx

### Funcionalidades
1. **MediaRecorder API** para captura de audio
2. **Visualizacao de Waveform** usando Web Audio API (AnalyserNode)
3. **Timer** com limite maximo (15 minutos)
4. **Estados**: idle, recording, paused, stopped
5. **Preview** do audio gravado antes de enviar

### Interface do Componente

```typescript
interface AudioRecorderProps {
  maxDurationSeconds?: number; // default 900 (15 min)
  minDurationSeconds?: number; // default 60 (1 min)
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void;
  onRecordingStart?: () => void;
  disabled?: boolean;
}
```

### Estrutura Visual

```text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │     [Canvas Waveform - altura 80px]                   │   │
│  │      ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁                   │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                     03:45 / 15:00                           │
│               ████████████░░░░░░░░░░░░░░                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │   [🎤 Gravar]    [⏸ Pausar]    [↻ Reiniciar]        │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Estados do Componente

```typescript
type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

const [state, setState] = useState<RecordingState>('idle');
const [duration, setDuration] = useState(0);
const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
const [audioUrl, setAudioUrl] = useState<string | null>(null);
```

### Implementacao do Waveform

```typescript
// Usar Web Audio API para capturar frequencias
const audioContextRef = useRef<AudioContext | null>(null);
const analyserRef = useRef<AnalyserNode | null>(null);
const canvasRef = useRef<HTMLCanvasElement>(null);

// Animacao do waveform
const drawWaveform = useCallback(() => {
  if (!analyserRef.current || !canvasRef.current) return;
  
  const analyser = analyserRef.current;
  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d');
  
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteTimeDomainData(dataArray);
  
  // Desenhar waveform com gradiente emerald/lime
  // ...
  
  if (state === 'recording') {
    requestAnimationFrame(drawWaveform);
  }
}, [state]);
```

---

## PARTE 3: Pagina SoldadoTestimony.tsx

### Rota
- `/testimony/:applicationId` - Pagina de gravacao de testemunho

### Validacoes de Acesso
1. Usuario deve estar logado
2. Usuario deve ser o candidato da application
3. Application deve estar com status `testimony_required`
4. Usuario NAO deve ter testemunho ativo em processamento

### Estrutura da Pagina

```text
┌─────────────────────────────────────────────────────────────┐
│ [←] Gravar Testemunho                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📖 Instrucoes para seu Testemunho                    │   │
│  │                                                       │   │
│  │ Seu testemunho sera usado para conectar voce com     │   │
│  │ buscadores que enfrentam lutas semelhantes as que    │   │
│  │ voce venceu.                                          │   │
│  │                                                       │   │
│  │ Dicas:                                                │   │
│  │ • Fale sobre sua jornada de transformacao            │   │
│  │ • Compartilhe como Deus agiu em sua vida             │   │
│  │ • Mencione os desafios que enfrentou                 │   │
│  │ • Descreva o momento de virada                        │   │
│  │ • Tempo recomendado: 5 a 15 minutos                  │   │
│  │                                                       │   │
│  │ ⚠️ Evite mencionar nomes de terceiros                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │  [AudioRecorder Component]                            │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  {audioUrl && (                                             │
│    ┌─────────────────────────────────────────────────┐     │
│    │ ✓ Gravacao pronta para envio                     │     │
│    │                                                   │     │
│    │ <audio controls src={audioUrl} />                 │     │
│    │                                                   │     │
│    │ Duracao: 08:32                                    │     │
│    │                                                   │     │
│    │ [🔄 Regravar]    [📤 Enviar Testemunho]          │     │
│    └─────────────────────────────────────────────────┘     │
│  )}                                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Fluxo de Upload

```typescript
const handleSubmit = async () => {
  if (!audioBlob || !user || !applicationId) return;
  
  setSubmitting(true);
  
  try {
    // 1. Gerar nome do arquivo
    const fileName = `${user.id}/${applicationId}.webm`;
    
    // 2. Upload para storage
    const { error: uploadError } = await supabase.storage
      .from('testimonies')
      .upload(fileName, audioBlob, {
        contentType: 'audio/webm',
        upsert: true,
      });
    
    if (uploadError) throw uploadError;
    
    // 3. Obter URL do arquivo
    const { data: urlData } = supabase.storage
      .from('testimonies')
      .getPublicUrl(fileName);
    
    // 4. Criar registro no banco
    const { error: dbError } = await supabase
      .from('testimonies')
      .insert({
        user_id: user.id,
        application_id: applicationId,
        audio_url: urlData.publicUrl,
        duration_seconds: duration,
        file_size_bytes: audioBlob.size,
        status: 'processing', // Trigger ira atualizar application
      });
    
    if (dbError) throw dbError;
    
    // 5. Sucesso - redirecionar com mensagem
    toast({
      title: "Testemunho enviado!",
      description: "Voce sera notificado quando a analise for concluida.",
    });
    
    navigate('/profile');
    
  } catch (error) {
    console.error('Error uploading testimony:', error);
    toast({
      title: "Erro ao enviar",
      description: "Tente novamente mais tarde.",
      variant: "destructive",
    });
  } finally {
    setSubmitting(false);
  }
};
```

---

## PARTE 4: Integracao com UI Existente

### ApplicationApprovalCard.tsx - Adicionar link para gravar

Quando o candidato visualiza sua propria candidatura com status `testimony_required`:

```tsx
{application.candidate.id === user?.id && 
 application.status === 'testimony_required' && (
  <Button 
    onClick={() => navigate(`/testimony/${application.id}`)}
    className="bg-gradient-to-r from-emerald-500 to-lime-500"
  >
    <Mic className="mr-2 h-4 w-4" />
    Gravar Testemunho
  </Button>
)}
```

### Profile.tsx - Status da candidatura

Adicionar card de status para usuarios com candidatura ativa:

```tsx
{pendingApplication && (
  <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
    <CardContent className="pt-6">
      <div className="flex items-center gap-4">
        <Shield className="h-10 w-10 text-amber-600" />
        <div>
          <h3 className="font-semibold">Candidatura a Soldado</h3>
          <p className="text-sm text-muted-foreground">
            Status: <ApplicationStatusBadge status={pendingApplication.status} />
          </p>
          {pendingApplication.status === 'testimony_required' && (
            <Button 
              size="sm" 
              className="mt-2"
              onClick={() => navigate(`/testimony/${pendingApplication.id}`)}
            >
              Gravar Testemunho
            </Button>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

---

## PARTE 5: Atualizacoes de Navegacao

### App.tsx - Nova rota

```typescript
import SoldadoTestimony from "./pages/SoldadoTestimony";

// Na lista de rotas
<Route path="/testimony/:applicationId" element={<SoldadoTestimony />} />
```

---

## Ordem de Implementacao

1. **Migracao SQL** - Criar tabela `testimonies`, enum, RLS, storage bucket
2. **AudioRecorder.tsx** - Componente de gravacao com waveform
3. **SoldadoTestimony.tsx** - Pagina completa de gravacao
4. **Atualizacoes de UI** - Integrar botoes em ApplicationApprovalCard e Profile
5. **App.tsx** - Adicionar rota

---

## Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| `supabase/migrations/xxx_testimonies_schema.sql` | CRIAR (via tool) |
| `src/components/soldado/AudioRecorder.tsx` | CRIAR |
| `src/pages/SoldadoTestimony.tsx` | CRIAR |
| `src/components/soldado/TestimonyInstructions.tsx` | CRIAR |
| `src/components/soldado/AudioPreview.tsx` | CRIAR |
| `src/components/soldado/ApplicationApprovalCard.tsx` | MODIFICAR |
| `src/pages/Profile.tsx` | MODIFICAR |
| `src/App.tsx` | MODIFICAR |

---

## Consideracoes Tecnicas

### Compatibilidade de Navegadores
- **MediaRecorder API**: Chrome 49+, Firefox 25+, Safari 14.1+, Edge 79+
- **Web Audio API**: Suporte amplo, exceto IE
- **Fallback**: Mensagem de navegador nao suportado

### Formato de Audio
- **Preferido**: WebM/Opus (menor tamanho, boa qualidade)
- **Fallback**: MP4/AAC para Safari antigo
- **Configuracao**: `mimeType: 'audio/webm;codecs=opus'`

### Limite de Tamanho
- **Storage**: 100MB por arquivo (configurado no bucket)
- **Pratico**: 15 min de audio WebM ~ 5-10MB

### Experiencia Offline
- Gravar localmente, enviar quando tiver conexao
- Mostrar indicador de conexao
- Salvar blob temporariamente em IndexedDB (stretch goal)

---

## Dependencias

Nenhuma nova dependencia npm necessaria:
- `MediaRecorder` - API nativa do browser
- `Web Audio API` - API nativa do browser
- `Supabase Storage` - Ja configurado

---

## Proximos Passos (Etapa 4)

Apos conclusao da Etapa 3, a Etapa 4 implementara:
- Edge function `process-testimony` para:
  - Transcricao de audio (Lovable AI/ElevenLabs STT)
  - Analise teologica (LLM)
  - Vetorizacao para matchmaking
- Notificacao push ao usuario
