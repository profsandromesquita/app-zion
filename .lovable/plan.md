

# Plano: Redesign da Landing Page do Zion com Vídeo de Background

## Visao Geral

Integrar o vídeo de paisagem montanhosa (Golden Hour) como background imersivo e redesenhar completamente a landing page seguindo o novo estilo visual descrito: minimalista, moderno e calmo.

---

## Analise do Video e Conceito Visual

**Cenario do Video:**
- Paisagem de alta montanha refletida em lago espelhado
- Iluminacao Golden Hour (tons quentes: laranja, pessego, dourado)
- Silhuetas de montanhas em tons frios (azul profundo, violeta)
- Nevoa leve sobre o lago criando atmosfera onirica

**Novo Design System:**
- Logo Zion com gradiente verde-azul (simbolizando equilibrio e crescimento)
- Botao primario com gradiente verde-esmeralda para lima
- Botao secundario branco solido
- Tipografia geometrica moderna com bom espacamento

---

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `public/videos/hero-background.mp4` | **CRIAR** - Copiar video do upload |
| `src/pages/Index.tsx` | **MODIFICAR** - Redesign completo da pagina |
| `src/index.css` | **MODIFICAR** - Adicionar novas variaveis de cor e animacoes |
| `tailwind.config.ts` | **MODIFICAR** - Adicionar keyframes para animacoes avancadas |

---

## Implementacao Tecnica Detalhada

### 1. Copiar Video para o Projeto

O video sera copiado para `public/videos/hero-background.mp4` para acesso direto (streaming progressivo).

### 2. Novas Variaveis de Cor (src/index.css)

```css
/* Nova paleta inspirada no video */
--zion-emerald: 160 84% 39%;      /* Verde esmeralda para CTA */
--zion-lime: 82 84% 45%;           /* Lima para gradiente */
--zion-mountain: 240 30% 25%;      /* Azul profundo das montanhas */
--zion-sunset: 25 95% 70%;         /* Laranja do por do sol */

/* Novo gradiente do botao primario */
--gradient-cta: linear-gradient(135deg, hsl(160 84% 39%) 0%, hsl(82 84% 45%) 100%);
```

### 3. Novas Animacoes (tailwind.config.ts)

```javascript
keyframes: {
  // Ken Burns - zoom lento no video
  "ken-burns": {
    "0%": { transform: "scale(1)" },
    "100%": { transform: "scale(1.1)" }
  },
  // Fade-in com slide suave
  "fade-slide-up": {
    "0%": { opacity: "0", transform: "translateY(30px)" },
    "100%": { opacity: "1", transform: "translateY(0)" }
  },
  // Entrada escalonada para elementos
  "stagger-in": {
    "0%": { opacity: "0", transform: "translateY(20px)" },
    "100%": { opacity: "1", transform: "translateY(0)" }
  }
}
```

### 4. Estrutura do Novo Index.tsx

```text
+--------------------------------------------------+
| [VIDEO BACKGROUND - Ken Burns Effect]             |
|                                                   |
|   +------------------------------------------+    |
|   |  [OVERLAY ESCURECIDO - bg-black/40]      |    |
|   |                                          |    |
|   |      LOGO ZION (gradiente verde-azul)    |    |
|   |      "Seu refugio espiritual"            |    |
|   |                                          |    |
|   |      "Encontre paz e orientacao"         |    |
|   |      "Um espaco seguro para..."          |    |
|   |                                          |    |
|   |   +--------------------------------+     |    |
|   |   | Preciso de Ajuda Agora         |     |    | <- Gradiente verde->lima
|   |   +--------------------------------+     |    |
|   |   +--------------------------------+     |    |
|   |   | Entrar / Cadastrar             |     |    | <- Branco solido
|   |   +--------------------------------+     |    |
|   |                                          |    |
|   |   [Shield] 100% Confidencial             |    |
|   |   [Heart] Acolhimento Cristao            |    |
|   |                                          |    |
|   |   ----- SEPARADOR FINO -----             |    |
|   |   [Icones sociais minimalistas]          |    |
|   +------------------------------------------+    |
+--------------------------------------------------+
```

### 5. Componente Video Background

```tsx
{/* Video Background com Ken Burns */}
<div className="absolute inset-0 -z-20 overflow-hidden">
  <video
    autoPlay
    muted
    loop
    playsInline
    className="h-full w-full object-cover animate-ken-burns"
  >
    <source src="/videos/hero-background.mp4" type="video/mp4" />
  </video>
  
  {/* Overlay para legibilidade */}
  <div className="absolute inset-0 bg-black/40" />
  
  {/* Gradiente suave na base */}
  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
</div>
```

### 6. Novo Logo com Gradiente

```tsx
{/* Logo com gradiente verde-azul */}
<div className="mb-4 inline-flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-2xl shadow-emerald-500/30">
  <Heart className="h-12 w-12 text-white" />
</div>
<h1 className="text-5xl font-bold tracking-tight text-white drop-shadow-lg md:text-6xl">
  Zion
</h1>
```

### 7. Botoes com Novo Design

**Botao Primario (Gradiente verde-esmeralda para lima):**
```tsx
<Button 
  className="group relative h-16 w-full overflow-hidden rounded-xl 
             bg-gradient-to-r from-emerald-500 to-lime-500
             text-lg font-semibold text-white 
             shadow-xl shadow-emerald-500/40
             transition-all duration-300
             hover:shadow-2xl hover:shadow-emerald-500/50 hover:scale-[1.03]"
>
  <MessageCircle className="mr-3 h-6 w-6 transition-transform duration-300 group-hover:scale-110" />
  Preciso de Ajuda Agora
</Button>
```

**Botao Secundario (Branco solido):**
```tsx
<Button 
  variant="outline"
  className="h-16 w-full rounded-xl 
             bg-white text-gray-900 
             text-lg font-semibold
             shadow-lg
             transition-all duration-300
             hover:bg-gray-50 hover:scale-[1.02]"
>
  <LogIn className="mr-3 h-6 w-6" />
  Entrar / Cadastrar
</Button>
```

### 8. Animacoes de Entrada (Staggered)

Os elementos entrarao com delay escalonado para criar efeito de "pouso":

| Elemento | Delay |
|----------|-------|
| Logo | 0ms |
| Tagline | 100ms |
| Titulo principal | 200ms |
| Descricao | 300ms |
| Botao primario | 400ms |
| Botao secundario | 500ms |
| Trust indicators | 600ms |
| Footer/Sociais | 700ms |

```tsx
<div className="animate-fade-slide-up" style={{ animationDelay: "200ms" }}>
  {/* Conteudo */}
</div>
```

### 9. Interacao nos Botoes (Hover Effects)

- **Escala sutil:** `hover:scale-[1.03]`
- **Sombra aumentada:** `hover:shadow-2xl`
- **Icone pulsa:** `group-hover:scale-110`
- **Transicao suave:** `transition-all duration-300`

### 10. Footer com Icones Sociais Minimalistas

```tsx
<footer className="absolute bottom-6 left-0 right-0 text-center">
  {/* Separador fino */}
  <div className="mx-auto mb-4 h-px w-32 bg-white/20" />
  
  {/* Mensagem de esperanca */}
  <p className="mb-4 text-sm text-white/70">
    Voce nao esta sozinho. Ha esperanca.
  </p>
  
  {/* Icones sociais (opcional) */}
  <div className="flex justify-center gap-4">
    {/* Icones minimalistas */}
  </div>
</footer>
```

---

## Sequencia de Implementacao

1. **Copiar video** para `public/videos/hero-background.mp4`
2. **Atualizar `src/index.css`** com novas variaveis de cor
3. **Atualizar `tailwind.config.ts`** com novos keyframes (ken-burns, fade-slide-up)
4. **Redesenhar `src/pages/Index.tsx`** com nova estrutura completa

---

## Detalhes de Performance

- **Video:** `autoPlay muted loop playsInline` para funcionamento em todos os navegadores
- **Ken Burns:** Animacao CSS pura (10-15s), nao afeta performance
- **Fallback:** `poster` image para conexoes lentas (opcional, pode ser adicionado depois)
- **Overlay:** CSS simples, sem impacto em performance

---

## Acessibilidade

- Video e puramente decorativo (sem conteudo informativo)
- Silenciado por padrao (`muted`)
- Texto com `drop-shadow` para contraste
- Botoes com estados de foco visiveis
- Nao interfere com leitores de tela

---

## Resultado Final Esperado

Uma landing page premium e imersiva com:
- Video cinematico de paisagem serena em loop
- Efeito Ken Burns sutil dando vida ao background
- Elementos de UI aparecendo com animacao "pouso"
- Botoes com feedback visual rico (hover effects)
- Atmosfera calma e acolhedora alinhada com a proposta do Zion

