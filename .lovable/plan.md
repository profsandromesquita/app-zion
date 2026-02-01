

# Correção: Oscilação entre Poster e Vídeo

## Diagnóstico do Problema

O evento `onLoadedData` está sendo disparado **antes** do vídeo ter buffer suficiente para reprodução contínua:

```text
PROBLEMA ATUAL:
┌─────────────────────────────────────────────────────────────────┐
│  onLoadedData dispara → videoLoaded = true → mostra vídeo       │
│  Vídeo ainda buffering → tela "congela" brevemente              │
│  Navegador mostra poster enquanto buffer → oscilação visual     │
└─────────────────────────────────────────────────────────────────┘
```

## Solução

Trocar o evento `onLoadedData` por `onCanPlayThrough`, que só dispara quando o navegador estima que pode reproduzir o vídeo **até o final sem pausas para buffering**.

| Evento | Quando Dispara |
|--------|----------------|
| `onLoadedData` | Primeiro frame carregado (muito cedo) |
| `onCanPlay` | Pode começar a reproduzir (ainda pode pausar) |
| `onCanPlayThrough` | Pode reproduzir até o fim sem interrupção |

## Mudanças Necessárias

### Arquivo: `src/pages/Index.tsx`

**Linha 50** - Trocar evento:

```tsx
// ANTES (problema)
onLoadedData={() => setVideoLoaded(true)}

// DEPOIS (correção)
onCanPlayThrough={() => setVideoLoaded(true)}
```

## Fluxo Corrigido

```text
DEPOIS DA CORREÇÃO:
┌─────────────────────────────────────────────────────────────────┐
│  0ms      500ms    1000ms    2000ms    3000ms                   │
│  [Poster estático]────────[Buffer completo]─[Fade suave]────    │
│                              ↑                                  │
│                   onCanPlayThrough dispara aqui                 │
└─────────────────────────────────────────────────────────────────┘
```

## Resumo da Correção

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Evento usado** | `onLoadedData` | `onCanPlayThrough` |
| **Quando dispara** | ~500ms (muito cedo) | ~2-3s (buffer completo) |
| **Resultado** | Oscilação/flickering | Transição suave única |

Esta é uma mudança de apenas **uma linha** que resolve completamente o problema de oscilação.

