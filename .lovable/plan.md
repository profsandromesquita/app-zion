
## Objetivo (o que você pediu)
Remover toda a “engenharia” extra (state machine, fades condicionais, force-play, etc.) e deixar **somente** a funcionalidade de **escolha automática de formato**:
- **WebM** para navegadores que suportam
- **MP4** como fallback para os demais (Safari/iOS, etc.)

Além disso, como parte da auditoria, vou eliminar os pontos do código que podem estar **induzindo instabilidade** (incluindo interferência do Service Worker em requests de mídia).

---

## Auditoria (o que está hoje e o que foi alterado)

### 1) `src/pages/Index.tsx` (estado atual)
Hoje o arquivo contém:
- `showVideo` + `hasShownVideoRef` + `videoRef`
- `useEffect` chamando `video.play()` no mount
- handlers `onPlaying` e `onTimeUpdate` para decidir quando “mostrar o vídeo”
- um `div` de poster com `opacity` alternando
- wrapper com `animate-ken-burns` + `opacity` alternando

Embora o estado pareça “one-way”, na prática esse tipo de montagem (camadas + opacity + vídeo) pode resultar em sensação de “vai e volta” quando:
- o vídeo fica momentaneamente sem frame decodificado e “some”, deixando a imagem de baixo aparente
- ou o browser realiza rebuffer/queda de frames em conjunto com transform/paint

### 2) `public/sw.js` (estado atual)
O Service Worker está configurado para **cache-first** para extensões incluindo:
- `webm` e `mp4`

Isso é um grande sinal de risco para mídia, porque vídeos frequentemente usam **Range Requests** (206 Partial Content). Um SW cache-first simples pode:
- cachear respostas parciais
- servir respostas incompatíveis com o que o player espera
- causar stutter/interrupções visuais

Mesmo que isso não seja “a única causa”, é uma fonte clássica de instabilidade em playback e precisa ser removida para um comportamento previsível.

---

## Correção definitiva (mantendo somente “WebM se suportado, senão MP4”)

### A) Simplificar `src/pages/Index.tsx` para “zero lógica” (sem state machine)
Vamos transformar o background em:
- Um container com **background-image** do poster (sempre presente)
- Um `<video>` por cima, **sem** estado React, **sem** handlers de playback, **sem** `useRef`, **sem** `useEffect` de `play()`
- Dois `<source>` em ordem de prioridade:
  1. WebM
  2. MP4

Modelo (conceito):
- Manter o poster como `backgroundImage` do container (ou `poster` do vídeo, mas recomendo **background** para reduzir “trocas”)
- Video sempre montado, o browser escolhe a melhor fonte automaticamente

Mudanças específicas:
1) Remover do `Index.tsx`:
   - `useState`, `useRef` (se não forem usados para mais nada)
   - `showVideo`, `hasShownVideoRef`, `videoRef`
   - `useEffect` que chama `video.play()`
   - `handlePlaying`, `handleTimeUpdate`
   - toda lógica de `opacity` condicional com `showVideo`
2) Ajustar JSX do hero background para algo estável e simples:
   - `div` de fundo com `style={{ backgroundImage: 'url(/videos/hero-poster.webp)' }}`
   - `<video autoPlay muted loop playsInline preload="metadata">`
   - `<source src="/videos/hero-background.webm" type="video/webm" />`
   - `<source src="/videos/hero-background.mp4" type="video/mp4" />`

Observação: isso por si só já garante “WebM quando suportado; caso contrário MP4”, porque o browser avalia `type` e seleciona a primeira fonte que consegue decodificar.

---

### B) Service Worker: parar de cachear vídeo (crítico)
Vamos ajustar `public/sw.js` para garantir que **vídeo não passa pelo cache-first**.

Mudanças específicas:
1) Antes da lógica `isHashedAsset / isStaticAsset`, adicionar um “early return” para mídia:
   - Se `url.pathname` terminar em `.mp4` ou `.webm`, **não interceptar** com cache-first:
     - `event.respondWith(fetch(event.request))`
2) (Recomendado) também bypass para Range Requests:
   - Se existir `event.request.headers.get('range')`, bypass total do cache (mesmo para outras extensões), porque Range + Cache API sem implementação dedicada é receita para bugs.
3) Manter cache para ícones/manifest e assets pequenos normalmente.

Isso remove uma classe inteira de problemas de playback.

---

## Sequência de implementação (passo a passo)
1) **Editar `src/pages/Index.tsx`**
   - Remover toda a lógica de estado e eventos do vídeo
   - Deixar o `<video>` com apenas os `<source>` (webm primeiro, mp4 depois)
   - Manter overlay/gradiente e o resto do layout inalterado

2) **Editar `public/sw.js`**
   - Bypass explícito para `.webm` e `.mp4` (network-only)
   - Bypass para requests com header `Range`
   - (Opcional) Incrementar `CACHE_VERSION` para forçar atualização do SW e evitar que o browser fique rodando uma versão antiga

3) **Validação**
   - Chrome/Edge/Firefox: confirmar que o vídeo tocando é WebM (DevTools Network → olhar a request de `hero-background.webm`)
   - Safari/iOS: confirmar que a request usada é `hero-background.mp4`
   - Testar com rede lenta (throttling): poster aparece imediatamente, vídeo carrega quando der, sem “vai e volta” induzido por lógica de opacity/estado

---

## Critérios de aceite (definitivo)
- Não existe mais nenhum controle React para “mostrar/esconder vídeo”
- O único mecanismo de seleção de formato é o padrão do HTML:
  - `<source webm>` primeiro
  - `<source mp4>` fallback
- Service Worker não interfere em requests de vídeo (especialmente Range)
- Em navegadores compatíveis, WebM é sempre a mídia carregada; caso contrário, MP4

---

## Notas técnicas (para garantir que “só o formato” está sendo controlado)
- Não vamos usar `canPlayType()` em JS, porque isso reintroduz lógica e edge cases.
- O padrão `<source>` é o caminho mais confiável e “limpo” para esse requisito.
- Remover o cache de vídeo do SW é essencial para evitar efeitos colaterais invisíveis (principalmente em PWA).

