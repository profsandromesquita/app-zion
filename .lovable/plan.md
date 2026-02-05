
# Plano de Correção: Upload de Áudio e Persistência de Estado

## Problemas Identificados

### Problema 1: MIME Type `video/webm` não suportado
A imagem mostra claramente o erro:
```
mime type video/webm is not supported
```

**Causa**: O bucket `testimonies` está configurado para aceitar apenas:
- `audio/webm`, `audio/ogg`, `audio/mp4`, `audio/mpeg`, `audio/wav`

Porém, muitos navegadores (especialmente Chrome) identificam arquivos `.webm` como `video/webm` mesmo quando contêm apenas áudio. Isso ocorre porque o container WebM pode ser usado tanto para vídeo quanto para áudio.

### Problema 2: Perda de Estado ao Navegar
Quando o usuário sai da página `/testimony/:id` e volta, todo o progresso é perdido porque:
1. O estado do React vive apenas em memória
2. Não há persistência em `sessionStorage` ou similar
3. A função `handleTabChange` limpa o áudio ao alternar abas

---

## Solução

### Parte 1: Atualizar MIME Types Permitidos

**Ação**: Criar migração SQL para atualizar o bucket `testimonies`

Adicionar à lista de MIME types permitidos:
- `video/webm` (containers WebM que contêm apenas áudio)
- `video/mp4` (containers MP4 com apenas áudio, comum em iPhones)

```sql
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 
  'audio/wav', 'audio/aac', 'audio/x-m4a', 'audio/x-wav',
  'video/webm', 'video/mp4'
]
WHERE id = 'testimonies';
```

### Parte 2: Atualizar Validação no Frontend

**Arquivo**: `src/components/soldado/AudioUploader.tsx`

Expandir a lista de MIME types aceitos:
```typescript
const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg",      // .mp3
  "audio/wav",       // .wav
  "audio/x-wav",     // .wav (alternative)
  "audio/mp4",       // .m4a
  "audio/x-m4a",     // .m4a (alternative)
  "audio/webm",      // .webm
  "audio/ogg",       // .ogg
  "audio/aac",       // .aac
  "video/webm",      // .webm (some browsers report as video)
  "video/mp4",       // .m4a (some browsers report as video)
];
```

### Parte 3: Preservar Estado entre Abas

**Arquivo**: `src/pages/SoldadoTestimony.tsx`

Modificar `handleTabChange` para NÃO limpar o áudio ao trocar de aba:
```typescript
const handleTabChange = (value: string) => {
  // Only change the mode, don't clear the audio
  // This allows user to switch tabs without losing progress
  setInputMode(value as InputMode);
};
```

Usar renderização condicional com `hidden` em vez de desmontar componentes:
```tsx
<TabsContent value="record" className={inputMode !== "record" ? "hidden" : ""}>
  <AudioRecorder ... />
</TabsContent>
<TabsContent value="upload" className={inputMode !== "upload" ? "hidden" : ""}>
  <AudioUploader ... />
</TabsContent>
```

### Parte 4: Aviso de Navegação (Navigation Guard)

**Arquivo**: `src/pages/SoldadoTestimony.tsx`

Adicionar `beforeunload` listener para avisar o usuário quando tentar sair com áudio não enviado:
```typescript
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (audioBlob && !submitted) {
      e.preventDefault();
      e.returnValue = ""; // Required for Chrome
    }
  };
  
  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [audioBlob, submitted]);
```

**Nota**: Para navegação via React Router, também interceptar o botão "Voltar":
```typescript
const handleBack = () => {
  if (audioBlob && !submitted) {
    if (confirm("Você tem um áudio não enviado. Deseja sair mesmo assim?")) {
      navigate("/profile", { replace: true });
    }
  } else {
    navigate("/profile", { replace: true });
  }
};
```

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Nova migração SQL | CRIAR | Atualizar `allowed_mime_types` do bucket |
| `src/components/soldado/AudioUploader.tsx` | MODIFICAR | Adicionar `video/webm` e `video/mp4` aos tipos aceitos |
| `src/pages/SoldadoTestimony.tsx` | MODIFICAR | Preservar estado entre abas + adicionar navigation guard |

---

## Fluxo Corrigido

```text
1. Usuário anexa arquivo .webm (MIME: video/webm)
2. Frontend valida → ACEITA (video/webm está na lista)
3. Upload para bucket → ACEITA (bucket atualizado)
4. Usuário alterna para aba "Gravar" → ÁUDIO PRESERVADO
5. Usuário clica em "Voltar" → CONFIRMAÇÃO antes de sair
6. Usuário fecha navegador → AVISO do beforeunload
```

---

## Comportamento Esperado Após Correção

1. **Upload de WebM funciona**: Arquivos com MIME `video/webm` são aceitos
2. **Alternar abas não perde áudio**: Estado é preservado ao mudar de modo
3. **Aviso ao sair**: Usuário é alertado antes de perder o trabalho
4. **Compatibilidade ampliada**: Aceita mais formatos de arquivo comuns
