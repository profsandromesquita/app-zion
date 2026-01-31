

# Relatório de Auditoria: Notificações Push em Mobile

## Resumo Executivo

O ícone de notificações (sino) **está implementado corretamente** e deveria aparecer em dispositivos móveis. A análise identificou **2 problemas prováveis** que impedem sua exibição em celulares Android e iPhone.

---

## Status da Implementação

| Componente | Desktop | Mobile | Status |
|------------|---------|--------|--------|
| Service Worker registrado | ✅ | ⚠️ | Log confirma registro no desktop |
| Manifesto PWA | ✅ | ✅ | Corretamente configurado |
| Ícones PWA | ✅ | ✅ | 192x192 e 512x512 criados |
| Hook `usePushNotifications` | ✅ | ⚠️ | Código correto, mas pode falhar silenciosamente |
| Componente `PushNotificationPrompt` | ✅ | ❌ | **Não renderiza em mobile** |
| Edge Function `get-vapid-key` | ✅ | ✅ | Funcional |
| Edge Function `send-push-reminder` | ✅ | ✅ | Sem logs (nunca executado ainda) |
| Tabela `push_subscriptions` | ✅ | ✅ | Criada corretamente |
| CRON job | ✅ | ✅ | Agendado corretamente |

---

## Problemas Identificados

### PROBLEMA 1: Componente Tooltip não funciona em touch devices (CRÍTICO)

**Localização:** `src/components/PushNotificationPrompt.tsx` (linhas 31-76)

**Causa Raiz:**  
O componente usa `<Tooltip>` do Radix UI para envolver o botão. Em dispositivos touch (mobile), tooltips baseados em hover **não funcionam nativamente** e podem interferir com o comportamento do botão.

```tsx
// Código problemático (linhas 31-52)
<Tooltip>
  <TooltipTrigger asChild>
    <Button ... onClick={unsubscribe}>
      <Bell className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Lembretes ativos • Clique para desativar</p>
  </TooltipContent>
</Tooltip>
```

**Comportamento em Mobile:**
- O `TooltipTrigger` pode capturar o primeiro toque para mostrar o tooltip
- O botão interno pode não receber o evento de clique
- Em alguns browsers mobile, o tooltip pode simplesmente não renderizar corretamente

---

### PROBLEMA 2: Verificação de suporte pode falhar silenciosamente (MODERADO)

**Localização:** `src/hooks/usePushNotifications.ts` (linhas 21-30)

**Causa Raiz:**  
A verificação de suporte para Push API pode retornar `false` em alguns contextos móveis:

```tsx
const isSupported =
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;
```

**Cenários de Falha:**
1. **iOS Safari pré-16.4**: Web Push só foi adicionado no iOS 16.4. Versões anteriores retornam `isSupported: false`
2. **Chrome Android em modo incógnito**: Service Workers são desabilitados
3. **Safari sem PWA instalada**: iOS requer que o app seja adicionado à tela inicial para push funcionar
4. **HTTPS obrigatório**: Push API só funciona em contexto seguro

Quando `isSupported === false`, o componente retorna `null`:

```tsx
// Linha 26
if (!isSupported || permission === "denied") return null;
```

---

### PROBLEMA 3: Service Worker pode não estar ativo (MENOR)

**Localização:** `src/hooks/usePushNotifications.ts` (linhas 36-43)

A verificação de subscrição existente só acontece se:
- `userId` existe (usuário logado)
- `permission === "granted"`

Se o Service Worker ainda não foi registrado ou ativado quando o componente monta, a verificação pode falhar silenciosamente.

---

## Por que funciona no Desktop?

1. **Tooltip funciona com hover:** No desktop, passar o mouse sobre o botão funciona normalmente
2. **APIs totalmente suportadas:** Chrome/Firefox/Edge desktop têm suporte completo a Push API há anos
3. **Contexto HTTPS válido:** O preview do Lovable usa HTTPS

---

## Plano de Correção

### Fase 1: Remover Tooltip em Mobile (Correção Principal)

Modificar `PushNotificationPrompt.tsx` para detectar mobile e renderizar sem Tooltip:

```tsx
// Adicionar hook useIsMobile
import { useIsMobile } from "@/hooks/use-mobile";

export function PushNotificationPrompt({ userId, variant = "icon" }: Props) {
  const isMobile = useIsMobile();
  
  // ... resto do hook
  
  // Versão compacta (ícone apenas)
  if (variant === "icon") {
    const buttonElement = (
      <Button
        variant="ghost"
        size="icon"
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={isLoading}
        className={cn(
          "h-8 w-8",
          isSubscribed ? "text-emerald-500 hover:text-emerald-600" : "text-muted-foreground hover:text-emerald-500"
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSubscribed ? (
          <Bell className="h-4 w-4" />
        ) : (
          <BellOff className="h-4 w-4" />
        )}
      </Button>
    );
    
    // Mobile: renderizar sem tooltip
    if (isMobile) {
      return buttonElement;
    }
    
    // Desktop: com tooltip
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {buttonElement}
        </TooltipTrigger>
        <TooltipContent>
          <p>{isSubscribed ? "Lembretes ativos • Clique para desativar" : "Ativar lembretes"}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  // ...
}
```

---

### Fase 2: Adicionar Logging de Debug no Hook

Adicionar logs para diagnosticar falhas em mobile:

```tsx
useEffect(() => {
  const checkSupport = async () => {
    console.log("[Push] Checking support...");
    console.log("[Push] serviceWorker:", "serviceWorker" in navigator);
    console.log("[Push] PushManager:", "PushManager" in window);
    console.log("[Push] Notification:", "Notification" in window);
    
    const isSupported = /* ... */;
    
    console.log("[Push] isSupported:", isSupported);
    console.log("[Push] Notification.permission:", Notification.permission);
    
    // ... resto
  };
  checkSupport();
}, [userId]);
```

---

### Fase 3: Tratamento Especial para iOS

Adicionar detecção de iOS e mostrar instruções específicas:

```tsx
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;

// iOS requer instalação como PWA para push funcionar
if (isIOS && !isInStandaloneMode) {
  // Mostrar toast instruindo a adicionar à tela inicial
}
```

---

### Fase 4: Adicionar Ferramenta de Teste Manual

Criar endpoint para testar envio de push sem esperar 48h:

```typescript
// Edge function: test-push-notification
Deno.serve(async (req) => {
  const { user_id } = await req.json();
  
  // Buscar subscrição do usuário e enviar push de teste
});
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/PushNotificationPrompt.tsx` | Remover Tooltip em mobile, adicionar detecção iOS |
| `src/hooks/usePushNotifications.ts` | Adicionar logging de debug |
| `supabase/functions/test-push-notification/index.ts` | Criar (nova edge function para testes) |

---

## Verificação Recomendada

Após a correção, testar nos seguintes cenários:

| Dispositivo | Browser | Esperado |
|-------------|---------|----------|
| Android | Chrome | Sino visível, clique abre prompt de permissão |
| Android | Firefox | Sino visível, clique abre prompt de permissão |
| iPhone (iOS 16.4+) | Safari (PWA instalada) | Sino visível, clique abre prompt |
| iPhone (iOS 16.4+) | Safari (browser) | Sino visível, mas mensagem "Adicione à tela inicial" |
| iPhone (iOS < 16.4) | Safari | Sino oculto (sem suporte) |
| Desktop | Chrome/Firefox/Edge | Sino com tooltip, clique funciona |

---

## Conclusão

O problema principal é o uso de `<Tooltip>` que interfere com eventos touch em dispositivos móveis. A correção é simples: detectar mobile e renderizar o botão diretamente sem o wrapper do Tooltip.

Adicionalmente, recomendo adicionar logging de debug para identificar se há dispositivos específicos onde a API não está disponível, e uma ferramenta de teste para validar o envio de push sem esperar 48 horas.

