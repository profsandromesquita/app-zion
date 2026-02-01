
## Diagnóstico (causa raiz provável) — por que ainda oscila

Mesmo com `onCanPlayThrough`, a oscilação pode continuar por 2 motivos (frequentes em vídeos “hero background”):

1) **O navegador alterna o que desenha dentro do elemento `<video>` quando faltam frames decodificados**
- Quando o vídeo entra em buffering/decode stall (especialmente com **vídeo grande**, conexão instável, ou **transform/scale animando o vídeo** como o Ken Burns), alguns navegadores **voltam a exibir o `poster` do próprio `<video>`** temporariamente, e depois retomam o vídeo.
- Como hoje o `<video>` tem `poster="/videos/hero-poster.webp"`, o efeito visual vira exatamente “vídeo → imagem → vídeo → imagem”.

2) **`onCanPlayThrough` não é confiável para esse uso**
- Em vários cenários ele dispara “otimista” (o browser estima que dá para tocar), mas depois o vídeo ainda entra em `waiting/stalled`.
- Resultado: a transição acontece cedo demais e o browser regride para o poster (dentro do `<video>`), causando o “vai e volta”.

> Importante: isso pode acontecer **sem** o estado React (`videoLoaded`) ficar alternando. Ou seja: mesmo com `videoLoaded` sempre `true`, o browser pode trocar o conteúdo renderizado do `<video>` (poster/frame) quando não há frame disponível.

---

## Correção definitiva (robusta) — estratégia

Vamos implementar um “mini state machine” de mídia, com estas regras:

1) **O poster visível inicial será só o `div` de background** (nosso placeholder), não o `poster` do `<video>`.
2) **O `<video>` começa invisível** e só aparece quando houver evidência real de playback.
3) **A condição para mostrar vídeo será `onPlaying` + confirmação por tempo** (ex.: o `currentTime` avançou) — isso elimina transição prematura.
4) **Depois que o vídeo for exibido pela primeira vez, nunca mais voltamos para o poster** (evita flicker). Se houver buffering, o usuário verá o último frame congelado (que é muito menos agressivo do que “trocar para imagem”).
5) Opcional (recomendado): **remover o atributo `poster` do `<video>`** (ou torná-lo condicional apenas antes do vídeo ficar visível). Isso impede o browser de “voltar para poster” dentro do `<video>`.

---

## Mudanças propostas (código)

### A) `src/pages/Index.tsx` — ref + eventos + estado robusto

1. **Criar `videoRef`**
- `const videoRef = useRef<HTMLVideoElement | null>(null);`

2. **Trocar `videoLoaded` por algo como:**
- `const [showVideo, setShowVideo] = useState(false);`
- `const hasShownVideoRef = useRef(false);` (para “nunca voltar para poster” depois)

3. **Remover `poster="/videos/hero-poster.webp"` do `<video>`**
- Manter apenas o `div` de poster como placeholder.
- (Se quiser manter por compatibilidade, tornar condicional: só existe enquanto `!showVideo`.)

4. **Usar eventos do vídeo para decidir**
- `onPlaying`: quando disparar, iniciar um timer curto (ex.: 250–400ms) e confirmar que `currentTime > 0` e `!paused`. Aí `setShowVideo(true)` e `hasShownVideoRef.current = true`.
- `onWaiting` / `onStalled`: se `hasShownVideoRef.current === false`, manter `showVideo=false` (ainda não “entregou” a experiência). Se já mostrou uma vez, **não alterar** (evita flicker).
- `onError`: manter poster (showVideo=false) e logar erro para identificar codec/mime.

5. **Tentar forçar `play()` no mount** (ajuda em alguns browsers quando o autoplay demora)
- Em um `useEffect`, chamar `videoRef.current?.play().catch(() => {})` (sem quebrar a página).

6. **CSS/Classes**
- O `div` poster continua com `opacity` baseado em `showVideo`.
- O `<video>` continua com `opacity` baseado em `showVideo`.
- Manter `transition-opacity duration-1000`.
- (Opcional) Para reduzir chance de glitch: aplicar Ken Burns no container e não diretamente no `<video>` (ver seção “B”).

**Resultado esperado:** a imagem aparece instantaneamente; o vídeo só “entra” quando estiver realmente tocando; e não existe mais “volta” para poster.

---

### B) (Recomendado) Ajuste do Ken Burns para reduzir stress no decoder

Animar `transform: scale()` diretamente no `<video>` pode ser pesado em alguns devices e aumentar a chance de stall. Ajuste proposto:

- Colocar o `animate-ken-burns` no **wrapper** do vídeo (um `div` envolvendo `<video>`), e deixar o `<video>` apenas com `object-cover`.
- Isso reduz situações em que o browser reconfigura o pipeline de vídeo + transform.

---

### C) (Extra, mas muito útil) Atualizar o Service Worker para cachear `.webp` e `.webm`

Hoje o `sw.js` só considera imagens `png/jpg/jpeg/gif/svg/ico` e fonts. Isso significa:
- `hero-poster.webp` e `hero-background.webm` **não entram no cache**.
- Em visitas seguintes, pode recarregar tudo e piorar a experiência.

Mudança proposta em `public/sw.js`:
- Atualizar regex `isStaticAsset` para incluir `webp` e `webm` (e opcionalmente `mp4`).
- Isso não resolve o flicker por si só, mas melhora performance e estabilidade nas próximas cargas.

---

## Plano de execução (passo a passo)

1) **Instrumentação rápida (para confirmar a causa)**
- Adicionar logs DEV-only (guardados por `import.meta.env.DEV`) nos eventos: `playing`, `waiting`, `stalled`, `timeupdate`, `error`.
- Objetivo: confirmar que durante a oscilação há `waiting/stalled` ocorrendo.

2) **Implementar state machine**
- `videoRef`, `showVideo`, `hasShownVideoRef`.
- Trocar `onCanPlayThrough` por `onPlaying` + verificação de `currentTime`.

3) **Remover/condicionar atributo `poster` do `<video>`**
- Poster passa a ser exclusivamente o `div` de background.

4) **(Opcional recomendado) Mover Ken Burns para wrapper**
- Minimiza risco de stall/glitch.

5) **(Extra) Ajustar service worker**
- Cachear `.webp` e `.webm` para melhorar consistência.

---

## Critérios de aceite (como você valida que ficou “definitivo”)

1) **Em rede lenta (DevTools → Slow 3G)**
- A imagem aparece instantaneamente.
- O vídeo só entra uma vez e não volta para imagem.

2) **Em rede normal**
- Transição acontece em 1 fade e fica estável.

3) **Safari/iPhone**
- O WebM será ignorado e o MP4 entra como fallback; ainda assim:
  - Poster aparece instantaneamente.
  - Vídeo entra quando realmente “playing”.

4) **Sem regressão visual**
- Overlay e gradiente continuam ok.
- Botões e textos permanecem legíveis.

---

## Observações finais (se mesmo assim persistir)

Se após a correção acima ainda houver stalls frequentes, a causa passa a ser quase certamente **arquivo de vídeo pesado/bitrate alto** para o dispositivo. Aí a correção “definitiva” inclui re-encode:
- reduzir resolução (ex.: 1920→1280),
- reduzir bitrate,
- garantir codec WebM VP9/VP8 compatível,
- garantir MP4 H.264 baseline/main adequado.

Mas primeiro vale aplicar a correção de lógica (state machine + remover poster do `<video>`), porque ela elimina o flicker mesmo quando há buffering.

