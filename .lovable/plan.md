

# Plano: Adicionar Upload de Arquivo de Áudio ao Testemunho

## Visão Geral

Permitir que candidatos a Soldado possam **anexar um arquivo de áudio pré-gravado** como alternativa à gravação direta no navegador. Isso é útil para:
- Dispositivos sem microfone disponível
- Áudios já gravados em outro aplicativo (ex: gravador do celular)
- Melhor qualidade de áudio (equipamento profissional)

---

## Arquitetura da Solução

### Abordagem Escolhida: Componente Híbrido com Tabs

Criar um componente com duas abas:
1. **Gravar** - Usar o microfone (componente atual)
2. **Anexar** - Upload de arquivo de áudio

```text
┌─────────────────────────────────────────────┐
│  [🎙️ Gravar]    [📎 Anexar Arquivo]        │
├─────────────────────────────────────────────┤
│                                             │
│   (Conteúdo da aba selecionada)            │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Componentes a Criar/Modificar

### PARTE 1: Novo Componente `AudioUploader.tsx`

**Arquivo:** `src/components/soldado/AudioUploader.tsx`

Componente para upload de arquivo de áudio com:
- Drag & Drop area
- Seleção via botão de arquivo
- Validação de formatos: `.mp3`, `.wav`, `.m4a`, `.webm`, `.ogg`, `.aac`
- Validação de tamanho máximo: 50MB
- Extração da duração do áudio via Web Audio API
- Preview com player de áudio
- Validação de duração mínima (60 segundos)

```typescript
interface AudioUploaderProps {
  maxFileSizeMB?: number;
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
  onFileSelected: (blob: Blob, durationSeconds: number) => void;
  disabled?: boolean;
}
```

### PARTE 2: Modificar `SoldadoTestimony.tsx`

Adicionar sistema de tabs para alternar entre gravação e upload:

```typescript
// Adicionar estado para controlar modo
const [inputMode, setInputMode] = useState<"record" | "upload">("record");

// Usar Tabs do Radix
<Tabs value={inputMode} onValueChange={setInputMode}>
  <TabsList>
    <TabsTrigger value="record"><Mic /> Gravar</TabsTrigger>
    <TabsTrigger value="upload"><Upload /> Anexar Arquivo</TabsTrigger>
  </TabsList>
  <TabsContent value="record">
    <AudioRecorder ... />
  </TabsContent>
  <TabsContent value="upload">
    <AudioUploader ... />
  </TabsContent>
</Tabs>
```

### PARTE 3: Atualizar `TestimonyInstructions.tsx`

Adicionar orientações sobre formatos de arquivo aceitos:
- Formatos suportados
- Tamanho máximo
- Dicas para gravações externas

---

## Detalhes Técnicos

### Validações do Upload

| Validação | Valor | Mensagem de Erro |
|-----------|-------|------------------|
| Formato | mp3, wav, m4a, webm, ogg, aac | "Formato não suportado. Use MP3, WAV, M4A ou WebM." |
| Tamanho | ≤ 50MB | "Arquivo muito grande. Máximo 50MB." |
| Duração mínima | ≥ 60 segundos | "Áudio muito curto. Mínimo 1 minuto." |
| Duração máxima | ≤ 900 segundos | "Áudio muito longo. Máximo 15 minutos." |

### Extração de Duração do Áudio

```typescript
const getAudioDuration = async (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    audio.addEventListener("loadedmetadata", () => {
      const duration = Math.floor(audio.duration);
      URL.revokeObjectURL(audio.src);
      resolve(duration);
    });
    audio.addEventListener("error", reject);
  });
};
```

### Formatos MIME Aceitos

```typescript
const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg",        // .mp3
  "audio/wav",         // .wav
  "audio/x-wav",       // .wav (alternativo)
  "audio/mp4",         // .m4a
  "audio/x-m4a",       // .m4a (alternativo)
  "audio/webm",        // .webm
  "audio/ogg",         // .ogg
  "audio/aac",         // .aac
];
```

---

## Fluxo do Usuário

```text
1. Candidato acessa /testimony/:id
2. Vê duas opções: "Gravar" ou "Anexar Arquivo"
3a. Se escolher Gravar → Fluxo atual (inalterado)
3b. Se escolher Anexar:
    → Arrasta arquivo ou clica para selecionar
    → Sistema valida formato, tamanho e duração
    → Mostra preview com player
    → Candidato clica "Usar este arquivo"
4. Botão "Enviar Testemunho" aparece
5. Submissão funciona igual para ambos os modos
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/soldado/AudioUploader.tsx` | CRIAR | Novo componente de upload de áudio |
| `src/pages/SoldadoTestimony.tsx` | MODIFICAR | Adicionar tabs para alternar entre modos |
| `src/components/soldado/TestimonyInstructions.tsx` | MODIFICAR | Adicionar informações sobre upload |

---

## Interface do AudioUploader

```text
┌─────────────────────────────────────────────────────┐
│                                                     │
│      ┌─────────────────────────────────────┐       │
│      │                                     │       │
│      │   📁 Arraste um arquivo de áudio   │       │
│      │         ou clique para             │       │
│      │          selecionar                │       │
│      │                                     │       │
│      │   Formatos: MP3, WAV, M4A, WebM    │       │
│      │   Tamanho máximo: 50MB             │       │
│      └─────────────────────────────────────┘       │
│                                                     │
└─────────────────────────────────────────────────────┘

(Após selecionar arquivo)

┌─────────────────────────────────────────────────────┐
│                                                     │
│   📄 meu-testemunho.mp3                            │
│   Duração: 08:45 | Tamanho: 12.3 MB                │
│                                                     │
│   ┌─────────────────────────────────────────┐      │
│   │  ▶️ [======●================] 08:45    │      │
│   └─────────────────────────────────────────┘      │
│                                                     │
│   [ Trocar arquivo ]     [ Usar este arquivo ]     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Comportamento Esperado

1. **Acesso à página**: Usuário vê tabs "Gravar" e "Anexar Arquivo"
2. **Tab Gravar**: Funciona exatamente como hoje
3. **Tab Anexar**: 
   - Área de drag & drop visualmente clara
   - Validação imediata ao selecionar arquivo
   - Preview com player de áudio
   - Botão para confirmar uso do arquivo
4. **Após selecionar áudio** (qualquer modo): Botão "Enviar Testemunho" aparece
5. **Submissão**: Mesma lógica para ambos os modos

---

## Considerações de UX

- **Tabs claramente identificadas** com ícones (Mic e Upload)
- **Estados visuais** para drag & drop (hover, error)
- **Feedback imediato** de validação
- **Mensagens de erro claras** e acionáveis
- **Preview de áudio** antes de confirmar
- **Consistência visual** com o componente de gravação

