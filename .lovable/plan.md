
# Plano de Correção: Duração NaN no Upload de Áudio

## Diagnóstico

### Problema Identificado
A imagem mostra que após o upload de um arquivo WebM:
- **Duração exibe "NaN:NaN"** em vez do tempo real
- **O player de prévia mostra "1:34"** - indicando que o áudio É válido
- **Botão "Usar este arquivo" não funciona** devido à validação

### Causa Raiz

A função `getAudioDuration` tem dois problemas:

1. **Evento `loadedmetadata` pode disparar prematuramente**: Para arquivos WebM com certos codecs, a `audio.duration` pode ser `Infinity` ou `NaN` no momento do evento, pois o browser ainda não calculou a duração completa.

2. **Sem tratamento de valores inválidos**: O código não verifica se `audio.duration` é um número finito antes de retornar.

```typescript
// Código atual (problemático)
audio.addEventListener("loadedmetadata", () => {
  const duration = Math.floor(audio.duration); // Pode ser NaN ou Infinity!
  resolve(duration);
});
```

### Por que o botão não funciona

```typescript
// Linha 332 - Condição de desabilitado
disabled={disabled || duration < minDurationSeconds}
```

Quando `duration = NaN`:
- `NaN < 60` retorna `false` (comparações com NaN são sempre false)
- Porém, `handleConfirm` verifica `duration >= minDurationSeconds` que também é `false`
- Resultado: Botão parece habilitado mas não executa a ação

---

## Solução

### Estratégia: Múltiplas tentativas de extração de duração

1. **Usar `durationchange` em vez de `loadedmetadata`**: Evento dispara quando a duração se torna disponível
2. **Polling como fallback**: Se após 3 segundos a duração não estiver pronta, tentar ler periodicamente
3. **Validação de valores**: Verificar `isFinite()` e `!isNaN()` antes de aceitar

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/soldado/AudioUploader.tsx` | MODIFICAR | Corrigir função `getAudioDuration` |

---

## Mudanças Técnicas

### Correção da função `getAudioDuration`

```typescript
const getAudioDuration = async (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);
    let resolved = false;

    const tryGetDuration = () => {
      const duration = audio.duration;
      if (isFinite(duration) && !isNaN(duration) && duration > 0) {
        if (!resolved) {
          resolved = true;
          URL.revokeObjectURL(objectUrl);
          resolve(Math.floor(duration));
        }
      }
    };

    // Tentar no loadedmetadata
    audio.addEventListener("loadedmetadata", tryGetDuration);
    
    // Tentar no durationchange (mais confiável para WebM)
    audio.addEventListener("durationchange", tryGetDuration);
    
    // Tentar quando estiver pronto para tocar
    audio.addEventListener("canplaythrough", tryGetDuration);

    audio.addEventListener("error", () => {
      if (!resolved) {
        resolved = true;
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Não foi possível processar o arquivo de áudio."));
      }
    });

    audio.src = objectUrl;
    audio.load();

    // Timeout: Se após 5 segundos não tiver duração, falhar
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Não foi possível determinar a duração do áudio."));
      }
    }, 5000);
  });
};
```

### Correção da formatação de tempo (defensiva)

```typescript
const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    return "00:00";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};
```

### Correção da condição do botão (defensiva)

```typescript
// Linha 332 - Adicionar verificação de NaN
disabled={disabled || !isFinite(duration) || duration < minDurationSeconds}
```

---

## Fluxo Corrigido

```text
1. Usuário seleciona arquivo WebM
2. Audio.load() é chamado
3. Sistema aguarda um destes eventos:
   - loadedmetadata (tentativa 1)
   - durationchange (tentativa 2, mais confiável)
   - canplaythrough (tentativa 3, garantido)
4. Em cada evento, verifica se duration é número válido
5. Se válido: retorna duração
6. Se timeout (5s): mostra erro "Não foi possível determinar duração"
7. Botão habilita apenas com duration >= 60 e finito
```

---

## Comportamento Esperado Após Correção

1. **Upload de WebM**: Duração é extraída corretamente (ex: "01:34")
2. **Botão habilitado**: "Usar este arquivo" funciona quando duração >= 1 minuto
3. **Fallback de erro**: Se realmente não conseguir ler duração, mostra mensagem clara
4. **Exibição segura**: Nunca mostra "NaN:NaN" - mostra "00:00" como fallback

---

## Testes de Validação

Após implementação, testar com:
1. **Arquivo WebM** gravado pelo navegador
2. **Arquivo MP3** padrão
3. **Arquivo M4A** do iPhone
4. **Arquivo com duração < 1 minuto** (deve mostrar erro)
5. **Arquivo corrompido** (deve mostrar erro)
