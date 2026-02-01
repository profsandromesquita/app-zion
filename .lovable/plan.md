

# Plano: Botão "Instalar App" para Facilitar Experiência do Usuário

## Análise das Possibilidades Técnicas

### O que é possível fazer automaticamente?

| Plataforma | Instalação com 1 clique? | Motivo |
|------------|--------------------------|--------|
| **Chrome/Edge (Desktop e Android)** | SIM | O navegador dispara o evento `beforeinstallprompt` que podemos capturar e chamar `.prompt()` |
| **Safari iOS (iPhone/iPad)** | NÃO | A Apple **não permite** instalação automática. O usuário precisa ir em "Compartilhar → Adicionar à Tela de Início" manualmente |
| **Safari Mac** | NÃO | Precisa ir em "Arquivo → Adicionar ao Dock" manualmente |
| **Firefox** | NÃO | Firefox desktop não suporta PWA (mobile suporta parcialmente) |

### Conclusão
- Para **Chrome/Edge** (que representa ~70% dos usuários): podemos criar um botão que faz a instalação automática
- Para **Safari/iOS**: o máximo que podemos fazer é mostrar instruções claras

---

## Solução Proposta

### Componente `InstallAppButton`
Um componente reutilizável que:
1. **Captura o evento `beforeinstallprompt`** quando disponível
2. **Renderiza um botão "Instalar App"** quando instalação automática é possível
3. **Mostra tooltip/modal com instruções** quando não é possível (iOS)
4. **Se esconde automaticamente** quando o app já está instalado

### Onde exibir o botão?

| Local | Por quê? |
|-------|----------|
| **Página inicial (Index.tsx)** | Primeiro contato do usuário |
| **Página de Login (Auth.tsx)** | Momento de decisão do usuário |
| **Sidebar do Chat** | Acesso fácil após login |
| **Página /install existente** | Já tem (manter como está) |

---

## Implementação Detalhada

### Fase 1: Criar Hook Reutilizável `useInstallPrompt`

**Arquivo:** `src/hooks/useInstallPrompt.ts`

Este hook centraliza toda a lógica de instalação PWA:

```typescript
interface UseInstallPromptReturn {
  canInstallNatively: boolean;     // Chrome/Edge - pode instalar com 1 clique
  isInstalled: boolean;            // Já está instalado
  isIOS: boolean;                  // Precisa de instruções manuais
  isAndroid: boolean;              // Android Chrome
  promptInstall: () => Promise<boolean>; // Chamar para instalar
}
```

**Funcionalidades:**
- Captura `beforeinstallprompt` em qualquer página
- Armazena o prompt para uso posterior
- Detecta se já está em modo standalone
- Detecta plataforma (iOS, Android, Desktop)

---

### Fase 2: Criar Componente `InstallAppButton`

**Arquivo:** `src/components/InstallAppButton.tsx`

**Comportamento:**
1. Se `isInstalled = true`: não renderiza nada
2. Se `canInstallNatively = true`: 
   - Mostra botão "Instalar App" com ícone de download
   - Ao clicar: chama `promptInstall()` → abre o diálogo nativo do navegador
3. Se `isIOS = true`:
   - Mostra botão "Instalar App"
   - Ao clicar: abre modal/toast com instruções "Compartilhar → Adicionar à Tela de Início"
4. Se nenhum dos acima:
   - Navega para `/install` com instruções detalhadas

**Props opcionais:**
- `variant`: "hero" (grande, para página inicial) | "compact" (pequeno, para sidebar)
- `className`: customização de estilo

---

### Fase 3: Adicionar Botão na Página Inicial (Index.tsx)

**Local:** Abaixo dos botões "Preciso de Ajuda Agora" e "Entrar/Cadastrar"

```tsx
{/* Install Button - aparece só se não instalado */}
<InstallAppButton variant="hero" />
```

**Visual sugerido:**
- Texto: "Adicionar à Tela Inicial"
- Ícone: Download ou Smartphone
- Estilo: outline sutil (não competir com CTAs principais)

---

### Fase 4: Adicionar Botão na Página de Login (Auth.tsx)

**Local:** No footer, abaixo do link "Acesse o chat anônimo"

```tsx
<InstallAppButton variant="compact" />
```

---

### Fase 5: Adicionar no Sidebar do Chat

**Local:** Em `ChatSidebar.tsx`, no footer (antes do menu de usuário)

```tsx
{!isInstalled && (
  <Button
    variant="ghost"
    size="sm"
    className="w-full justify-start"
    onClick={handleInstall}
  >
    <Download className="mr-2 h-4 w-4" />
    Instalar App
  </Button>
)}
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useInstallPrompt.ts` | **CRIAR** - Hook centralizado de instalação |
| `src/components/InstallAppButton.tsx` | **CRIAR** - Componente de botão inteligente |
| `src/pages/Index.tsx` | **MODIFICAR** - Adicionar botão na hero |
| `src/pages/Auth.tsx` | **MODIFICAR** - Adicionar botão no footer |
| `src/components/chat/ChatSidebar.tsx` | **MODIFICAR** - Adicionar opção no menu |

---

## Fluxo do Usuário (Visual)

```text
┌─────────────────────────────────────────────────────────────────┐
│                      PÁGINA INICIAL                              │
│                                                                  │
│                         [Logo Zion]                              │
│                                                                  │
│              [ Preciso de Ajuda Agora ]  (CTA principal)         │
│              [   Entrar / Cadastrar   ]  (secundário)            │
│              [  Adicionar à Tela ↓    ]  (novo - terciário)      │
│                                                                  │
│              ────────────────────────                            │
│              Você não está sozinho...                            │
└─────────────────────────────────────────────────────────────────┘

    │ Usuário clica em "Adicionar à Tela"
    ▼

┌─────────────────────────────────────────────────────────────────┐
│  SE Chrome/Edge:                                                 │
│  ┌──────────────────────────────────────┐                       │
│  │  Instalar "Zion"?                    │  ← Diálogo nativo     │
│  │  [Instalar]  [Cancelar]              │                       │
│  └──────────────────────────────────────┘                       │
│                                                                  │
│  SE iPhone:                                                      │
│  ┌──────────────────────────────────────┐                       │
│  │  📱 Para instalar no iPhone:         │  ← Modal/Toast        │
│  │  1. Toque em "Compartilhar" ⬆️        │                       │
│  │  2. Role e toque em "Adicionar à     │                       │
│  │     Tela de Início"                  │                       │
│  │  3. Confirme tocando em "Adicionar"  │                       │
│  └──────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detalhes Técnicos

### Hook useInstallPrompt.ts

```typescript
import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const canInstallNatively = deferredPrompt !== null;

  useEffect(() => {
    // Capturar prompt
    const handlePrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // Detectar instalação concluída
    const handleInstalled = () => setIsInstalled(true);

    // Verificar se já está instalado
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    
    return outcome === "accepted";
  }, [deferredPrompt]);

  return {
    canInstallNatively,
    isInstalled,
    isIOS,
    isAndroid,
    promptInstall,
  };
}
```

### Componente InstallAppButton.tsx

```typescript
interface InstallAppButtonProps {
  variant?: "hero" | "compact" | "sidebar";
  className?: string;
}
```

**Variante "hero"**: Botão grande com gradiente sutil, para página inicial
**Variante "compact"**: Botão pequeno com texto, para footer
**Variante "sidebar"**: Botão ghost para menu lateral

---

## Validação (Checklist de Testes)

| Cenário | Esperado |
|---------|----------|
| Chrome Desktop, não instalado | Botão aparece → clique abre prompt nativo |
| Chrome Android, não instalado | Botão aparece → clique abre prompt nativo |
| Safari iPhone, não instalado | Botão aparece → clique mostra instruções |
| App já instalado (qualquer) | Botão não aparece |
| Firefox Desktop | Botão leva para /install com instruções |

---

## Resultado Esperado

Após a implementação:
1. **Chrome/Edge**: Usuário clica em "Instalar" → o Zion "se instala sozinho" (na verdade, mostra o diálogo nativo e o usuário confirma)
2. **iPhone**: Usuário clica → recebe instruções claras sem precisar ir no navegador
3. **Qualquer plataforma**: O botão some automaticamente após a instalação

