
## Diagnóstico (causa raiz)

### 1) iPhone Safari (modo normal, não instalado) e iPhone Chrome
Isso é esperado hoje por limitação do iOS: **Web Push no iPhone só funciona quando o site está instalado na Tela de Início (modo “app”)**.  
Nesses casos, normalmente acontece isto:

- `PushManager` **não existe** no navegador (ou não é utilizável), então `isSupported` fica `false`.
- O componente `PushNotificationPrompt` atualmente faz:
  - `if (!isSupported || permission === "denied") return null;`
  - Resultado: **o sino some**, e o usuário não recebe a instrução “instale na tela inicial”.

Ou seja: no iPhone Safari normal e no Chrome iOS, o sino não aparece porque o app conclui “push não suportado” e **esconde o botão**.

### 2) Android Chrome (logado) sem sino
Em Android, o Push costuma ser suportado, então o sino deveria aparecer. Se não aparece, na prática só existem 3 causas comuns:

1. **O navegador/ambiente não expõe Push APIs** (por exemplo: WebView/in-app browser, modo “lite”, alguma política do aparelho) ⇒ `PushManager` não existe ⇒ `isSupported=false` ⇒ o sino é ocultado.
2. **A permissão já está “denied” no Chrome** (mesmo que o usuário “não lembre de ter negado”) ⇒ `permission="denied"` ⇒ o sino é ocultado.
3. **O usuário está vendo uma versão desatualizada do front-end** por cache/service worker/publish (muito comum em PWA). Como o SW está cacheando praticamente tudo com `CACHE_VERSION = 'zion-v1'`, pode existir discrepância entre dispositivos até limpar dados do site.

Como hoje o botão some quando algo dá errado, fica impossível diferenciar (1), (2) e (3) apenas pelo que o usuário vê.

---

## Correção definitiva (objetivo)
1. **O sino deve sempre aparecer no header em qualquer dispositivo**, nem que seja como “indisponível”.
2. Ao tocar no sino:
   - Se iPhone sem instalação: mostrar instruções “Adicionar à Tela de Início”.
   - Se Android com permissão bloqueada: explicar como desbloquear.
   - Se o browser não suporta: explicar que não dá naquele navegador e sugerir alternativas.
3. Criar um **botão/área de instalação** no app para desktop e mobile (porque o navegador nem sempre mostra um “link de instalação” visível).

---

## Plano de implementação (passo a passo)

### Fase A — Ajuste definitivo do sino (não esconder mais)
**Arquivos principais**
- `src/components/PushNotificationPrompt.tsx`
- `src/hooks/usePushNotifications.ts`

**Mudanças**
1. Alterar a regra: **nunca retornar `null` só porque não suporta**.
   - Em vez disso, renderizar um botão “desabilitado/informativo”.
   - Estados visuais sugeridos:
     - `checking` (carregando): ícone desabilitado “Verificando…”
     - `supported + not subscribed`: BellOff clicável (pede permissão)
     - `supported + subscribed`: Bell clicável (desativa)
     - `unsupported`: BellOff desabilitado (clicável apenas para mostrar “Por que não funciona”)
     - `permission denied`: BellOff com “Bloqueado” (clicável para mostrar como desbloquear)
2. Ajustar o tratamento específico do iOS:
   - Se `isIOS && !isInStandaloneMode`, **mostrar o sino** e, ao clicar, mostrar toast/modal com passo a passo.
3. Ajustar o hook para expor um estado explícito de diagnóstico:
   - Ex.: `supportStatus: "checking" | "supported" | "unsupported"`
   - Ex.: `permission: "default" | "granted" | "denied"`
   - (Opcional) `unsupportedReason` inferido via checks:
     - sem serviceWorker
     - sem PushManager
     - sem Notification
     - não é secure context

**Por que isso resolve**
- Mesmo quando o push não é possível (iOS Safari normal), o usuário verá o sino e receberá orientação.
- No Android, se for um problema de permissão bloqueada, ficará evidente (em vez de “sumir”).

---

### Fase B — Página de “Instalar” dentro do app (desktop e mobile)
**Objetivo**: você não depende do navegador mostrar um ícone escondido na barra; o próprio Zion oferece um botão “Instalar”.

**Arquivos**
- Criar `src/pages/Install.tsx`
- Atualizar `src/App.tsx` para adicionar rota `/install`
- (Opcional) adicionar link no sidebar/menu para `/install`

**Comportamento**
1. **Chrome/Edge desktop (Windows/Mac)**:
   - Usar o evento `beforeinstallprompt`:
     - Quando disponível, mostrar botão “Instalar Zion”.
     - Ao clicar, chamar `prompt()` e capturar escolha.
2. **Safari iPhone (não instalado)**:
   - Mostrar instruções claras:
     - “Compartilhar” → “Adicionar à Tela de Início”
3. **Safari Mac**:
   - Mostrar instruções compatíveis (dependendo da versão do macOS):
     - “Adicionar ao Dock” (quando disponível) ou criar atalho.
4. Mostrar “Diagnóstico PWA”:
   - Se SW está registrado/ativo
   - Se manifest carregou
   - Se está em modo standalone

---

### Fase C — Mitigação de cache (para evitar “no desktop aparece / no celular não”)
**Arquivo**
- `public/sw.js`

**Mudanças recomendadas**
1. Versionar corretamente o cache para evitar que dispositivos fiquem presos em builds antigos:
   - Atualizar `CACHE_VERSION` quando houver release (ou gerar versão).
2. Restringir o que o SW cacheia:
   - Evitar cachear HTML de rotas dinamicamente de forma agressiva.
   - Manter foco em assets estáticos (JS/CSS com hash) e manifest.
3. Incluir um “botão limpar cache” na página `/install` (opcional):
   - orientar usuário a “Limpar dados do site” e reiniciar.

---

## Como você instala no desktop hoje (mesmo sem link no app)
Enquanto não implementamos o botão interno, o caminho depende do navegador:

### Chrome (Windows/Mac)
- Abra o site publicado
- Clique no menu (⋮) → **“Instalar Zion…”**  
  ou procure o ícone de instalação na barra de endereço (se aparecer).

### Microsoft Edge (Windows/Mac)
- Menu (⋯) → **Apps** → **Instalar este site como um app**

### Safari (Mac)
- Em versões recentes: **Arquivo → Adicionar ao Dock** (quando disponível)
- Caso não exista: você pode criar um atalho, mas não fica igual a “app instalado” no padrão PWA do Chrome/Edge.

---

## Validação (checklist)
1. Abrir `/chat` no Android Chrome:
   - O sino deve aparecer (nem que seja “indisponível”).
   - Ao clicar, deve explicar o motivo se não suportado / bloqueado.
2. Abrir `/chat` no iPhone Safari (não instalado):
   - O sino deve aparecer e, ao clicar, deve orientar “Adicionar à Tela de Início”.
3. Abrir `/install` no desktop Chrome/Edge:
   - Deve haver botão “Instalar” quando o navegador permitir.
4. Testar com cache limpo:
   - Android: Configurações do site → Armazenamento → Limpar
   - iPhone: Ajustes → Safari → Avançado → Dados dos Sites → remover o domínio

---

## Entregáveis de código (o que será implementado após sua autorização)
- Renderização do sino sempre visível com estados e mensagens explicativas.
- Nova página `/install` com instalação para Chromium + instruções para iOS.
- Ajustes no Service Worker para reduzir inconsistência entre dispositivos.

