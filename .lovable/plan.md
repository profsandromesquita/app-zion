

# Plano: Substituir Logo do Zion

## Analise das Imagens

**Imagem 1 (Logo):**
- Logo em forma de "Z" estilizada
- Composta por 3 formas arredondadas
- Cores: gradiente verde-ciano (topo) e azul escuro (base)
- Design moderno e clean

**Imagem 2 (Referencia de Layout):**
- Logo posicionada ao lado esquerdo do texto "Zion"
- Disposicao horizontal (logo + texto lado a lado)
- Tamanho da logo menor e proporcional ao texto
- Texto "Zion" em preto/escuro

---

## Mudancas Necessarias

### 1. Copiar imagem da logo para o projeto
- Copiar `user-uploads://Untitled_design-2.png` para `src/assets/zion-logo.png`
- Usar src/assets para aproveitar otimizacao do bundler

### 2. Atualizar estrutura da logo em Index.tsx

**De (atual):**
```text
+------------------------+
|  +------------------+  |
|  |  [HEART ICON]    |  |  <- Quadrado com gradiente
|  +------------------+  |
|                        |
|        Zion            |  <- Texto abaixo
|  Seu refugio espiritual|
+------------------------+
```

**Para (novo):**
```text
+--------------------------------+
|                                |
|   [Z LOGO]  Zion              |  <- Logo e texto lado a lado
|                                |
|   Seu refugio espiritual       |  <- Tagline abaixo (opcional)
+--------------------------------+
```

### 3. Codigo atualizado

```tsx
// Importar a logo
import zionLogo from "@/assets/zion-logo.png";

// Novo componente de logo
<div className="mb-8 text-center opacity-0 animate-fade-slide-up"
     style={{ animationDelay: "0ms", animationFillMode: "forwards" }}>
  
  {/* Logo + Texto lado a lado */}
  <div className="flex items-center justify-center gap-3 mb-2">
    <img 
      src={zionLogo} 
      alt="Zion Logo" 
      className="h-12 w-12 md:h-14 md:w-14 drop-shadow-lg"
    />
    <h1 className="text-5xl font-bold tracking-tight text-white drop-shadow-lg md:text-6xl">
      Zion
    </h1>
  </div>
  
  {/* Tagline permanece abaixo */}
  <p className="mt-2 text-white/80 drop-shadow-md opacity-0 animate-fade-slide-up"
     style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
    Seu refugio espiritual
  </p>
</div>
```

---

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/assets/zion-logo.png` | **CRIAR** - Copiar logo do upload |
| `src/pages/Index.tsx` | **MODIFICAR** - Trocar estrutura da logo |

---

## Detalhes Tecnicos

- **Importacao ES6**: `import zionLogo from "@/assets/zion-logo.png"` para melhor otimizacao
- **Responsividade**: Logo com `h-12 w-12` em mobile e `md:h-14 md:w-14` em desktop
- **Layout horizontal**: Usando `flex items-center justify-center gap-3`
- **Efeito visual**: `drop-shadow-lg` para destacar a logo sobre o video

---

## Resultado Visual Esperado

```text
        [Z]  Zion
   Seu refugio espiritual
```

A logo ficara posicionada exatamente como na imagem 2 de referencia: ao lado esquerdo do texto "Zion", em disposicao horizontal e com tamanho proporcional.

