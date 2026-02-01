

# Plano de Implementação: Otimização do Carregamento de Vídeo

## Resumo

Com os arquivos fornecidos (poster WebP e vídeo WebM), vamos otimizar a página inicial para carregar instantaneamente uma imagem enquanto o vídeo é baixado em segundo plano, com transição suave.

---

## Arquivos a Adicionar

| Arquivo | Destino | Propósito |
|---------|---------|-----------|
| `Zion-folder-load-pagina-inicial.webp` | `public/videos/hero-poster.webp` | Imagem exibida instantaneamente |
| `zion-video-expandido.webm` | `public/videos/hero-background.webm` | Vídeo otimizado (Chrome/Edge/Firefox) |

**Nota**: O MP4 original será mantido como fallback para Safari/iOS.

---

## Modificações no Código

### Arquivo: `src/pages/Index.tsx`

**1. Adicionar estado para controlar carregamento**

```tsx
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";  // Adicionar useState
```

**2. Criar estado de loading do vídeo**

```tsx
const [videoLoaded, setVideoLoaded] = useState(false);
```

**3. Atualizar o bloco do vídeo (linhas 32-49)**

Substituir por:

```tsx
{/* Video Background com Ken Burns */}
<div className="absolute inset-0 -z-20 overflow-hidden">
  {/* Poster instantâneo enquanto vídeo carrega */}
  <div 
    className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
      videoLoaded ? 'opacity-0' : 'opacity-100'
    }`}
    style={{ backgroundImage: 'url(/videos/hero-poster.webp)' }}
  />
  
  <video
    autoPlay
    muted
    loop
    playsInline
    preload="auto"
    poster="/videos/hero-poster.webp"
    onLoadedData={() => setVideoLoaded(true)}
    className={`h-full w-full object-cover animate-ken-burns transition-opacity duration-1000 ${
      videoLoaded ? 'opacity-100' : 'opacity-0'
    }`}
  >
    {/* WebM primeiro - menor e mais eficiente (Chrome/Edge/Firefox) */}
    <source src="/videos/hero-background.webm" type="video/webm" />
    {/* MP4 fallback - Safari/iOS e navegadores antigos */}
    <source src="/videos/hero-background.mp4" type="video/mp4" />
  </video>

  {/* Overlay para legibilidade */}
  <div className="absolute inset-0 bg-black/40" />

  {/* Gradiente suave na base */}
  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
</div>
```

---

## Fluxo de Carregamento Otimizado

```text
ANTES (atual):
┌─────────────────────────────────────────────────────────────┐
│  0ms      500ms    1000ms    2000ms    3000ms              │
│  [──────── Tela vazia ────────][Vídeo aparece de repente]  │
└─────────────────────────────────────────────────────────────┘

DEPOIS (otimizado):
┌─────────────────────────────────────────────────────────────┐
│  0ms      500ms    1000ms    2000ms    3000ms              │
│  [Poster instantâneo]────[Fade suave para vídeo]──────────  │
└─────────────────────────────────────────────────────────────┘
```

---

## Benefícios da Implementação

| Aspecto | Melhoria |
|---------|----------|
| **Primeira impressão** | Imagem aparece em ~50ms vs ~3000ms do vídeo |
| **Experiência visual** | Transição suave (fade 1 segundo) |
| **Tamanho do download** | WebM ~30% menor que MP4 |
| **Compatibilidade** | Safari usa MP4, demais usam WebM |
| **Ken Burns** | Efeito continua funcionando normalmente |

---

## Estrutura Final de Arquivos

```text
public/videos/
├── hero-background.mp4     (existente - fallback Safari)
├── hero-background.webm    (novo - navegadores modernos)
└── hero-poster.webp        (novo - loading instantâneo)
```

---

## Detalhes Técnicos

- **`preload="auto"`**: Instrui o navegador a priorizar o download do vídeo
- **`poster`**: Atributo nativo do HTML5 para imagem de placeholder
- **`onLoadedData`**: Evento disparado quando o vídeo está pronto para reproduzir
- **`transition-opacity duration-1000`**: Fade suave de 1 segundo entre poster e vídeo
- **Ordem dos `<source>`**: WebM primeiro (preferido), MP4 segundo (fallback)

