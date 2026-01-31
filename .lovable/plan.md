

# Plano: Adicionar Vídeo de Background na Landing Page do Zion

## Análise do Vídeo
O vídeo enviado é um arquivo MP4 de alta qualidade (4K, 16:9, 24fps) com estilo cinemático. Pela nomenclatura, parece ser um vídeo atmosférico/contemplativo — ideal para usar como **background imersivo** na página inicial.

## Estratégia de Integração Recomendada

### Opção Escolhida: Vídeo como Background Full-Screen
O vídeo será colocado como **fundo da página inteira**, com uma camada de overlay escurecido para garantir legibilidade do texto e botões por cima.

**Vantagens:**
- Experiência imersiva e premium
- Mantém a hierarquia visual dos elementos (logo, texto, botões)
- Funciona bem em dispositivos móveis (fallback para poster/imagem)

---

## Implementação Técnica

### 1. Copiar Vídeo para o Projeto
O vídeo será copiado para `public/videos/hero-background.mp4` (pasta pública para acesso direto).

**Por que `public/` e não `src/assets/`?**
- Vídeos grandes (especialmente 4K) não devem passar pelo bundler do Vite
- Acesso direto via URL (`/videos/hero-background.mp4`) é mais eficiente
- Permite streaming progressivo pelo navegador

### 2. Estrutura do Vídeo de Background

```tsx
{/* Video Background */}
<div className="absolute inset-0 -z-20 overflow-hidden">
  <video
    autoPlay
    muted
    loop
    playsInline
    className="h-full w-full object-cover"
    poster="/images/hero-poster.jpg"  // fallback para conexões lentas
  >
    <source src="/videos/hero-background.mp4" type="video/mp4" />
  </video>
  
  {/* Overlay escurecido para legibilidade */}
  <div className="absolute inset-0 bg-black/50" />
  
  {/* Gradiente suave na parte inferior */}
  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
</div>
```

### 3. Ajustes de Estilo para os Elementos

**Texto e Logo:**
- Trocar cores para `text-white` para contrastar com vídeo
- Adicionar `drop-shadow` sutil para destacar texto

**Botões com Efeitos Aprimorados:**
- Botão primário: efeito de "glow" ao hover + escala
- Botão secundário: borda luminosa + backdrop blur

```tsx
{/* Botão Primário - com glow effect */}
<Button 
  className="group relative h-14 w-full overflow-hidden 
             bg-primary text-lg font-medium text-primary-foreground 
             shadow-lg shadow-primary/30
             transition-all duration-300
             hover:shadow-xl hover:shadow-primary/50 hover:scale-[1.02]"
>
  <MessageCircle className="mr-2 h-5 w-5 transition-transform group-hover:scale-110" />
  Preciso de Ajuda Agora
  <span className="absolute inset-0 -z-10 bg-gradient-to-r from-primary to-accent 
                   opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
</Button>

{/* Botão Secundário - com backdrop blur */}
<Button 
  variant="outline"
  className="h-14 w-full border-2 border-white/30 
             bg-white/10 backdrop-blur-md
             text-white text-lg font-medium
             transition-all duration-300
             hover:bg-white/20 hover:border-white/50 hover:scale-[1.02]"
>
  <LogIn className="mr-2 h-5 w-5" />
  Entrar / Cadastrar
</Button>
```

### 4. Responsividade e Performance

**Mobile:**
- Vídeo continua funcionando, mas com `poster` como fallback em conexões 3G
- Considerar versão comprimida do vídeo para mobile (futura otimização)

**Performance:**
- `autoPlay muted loop playsInline` — necessário para autoplay funcionar
- `object-cover` — garante que vídeo cubra toda a área sem distorção
- `poster` — imagem exibida enquanto vídeo carrega

### 5. Acessibilidade
- Vídeo é puramente decorativo (sem conteúdo informativo)
- Será silenciado (`muted`) por padrão
- Não interfere na navegação por teclado/leitor de tela

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `public/videos/hero-background.mp4` | **CRIAR** - Copiar vídeo do upload |
| `src/pages/Index.tsx` | **MODIFICAR** - Adicionar vídeo de background + ajustar estilos |

---

## Resultado Visual Esperado

```text
┌─────────────────────────────────────────┐
│  [VÍDEO CINEMÁTICO EM LOOP]             │
│  ╔═══════════════════════════════════╗  │
│  ║   ❤️  (logo)                      ║  │
│  ║        Zion                       ║  │
│  ║   Seu refúgio espiritual          ║  │
│  ║                                   ║  │
│  ║   Encontre paz e orientação       ║  │
│  ║   Um espaço seguro para...        ║  │
│  ║                                   ║  │
│  ║ ┌─────────────────────────────┐   ║  │
│  ║ │  💬 Preciso de Ajuda Agora  │   ║  │ ← Glow effect no hover
│  ║ └─────────────────────────────┘   ║  │
│  ║ ┌─────────────────────────────┐   ║  │
│  ║ │  🔑 Entrar / Cadastrar      │   ║  │ ← Backdrop blur
│  ║ └─────────────────────────────┘   ║  │
│  ║                                   ║  │
│  ║  🛡️ 100% Confidencial  ❤️ Acolhimento ║
│  ╚═══════════════════════════════════╝  │
│  [OVERLAY ESCURECIDO SOBRE VÍDEO]       │
└─────────────────────────────────────────┘
```

---

## Efeitos dos Botões (Detalhado)

| Botão | Estado Normal | Estado Hover |
|-------|---------------|--------------|
| **Preciso de Ajuda** | Azul sólido, sombra suave | Gradiente azul→lavanda, sombra "glow", escala 1.02x, ícone pulsa |
| **Entrar/Cadastrar** | Transparente com borda, backdrop blur | Fundo mais opaco, borda mais visível, escala 1.02x |

---

## Considerações de Tamanho do Arquivo

O vídeo original é 4K, o que pode ser grande (~50-100MB). Recomendações futuras:
- Comprimir para 1080p (qualidade ainda excelente, ~10-20MB)
- Criar versão WebM para navegadores compatíveis (menor tamanho)
- Usar CDN para entrega otimizada

Por agora, vamos usar o arquivo original para garantir qualidade máxima.

