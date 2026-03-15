

# Plano: Ajuste fino do Prompt Adapter (4 correções)

## Alterações em `supabase/functions/zyon-chat/index.ts`

### 1. IDENTITY_TONE — Adicionar regras de espelhamento e termos banidos (linhas 1565-1599)

Expandir o bloco IDENTITY_TONE com 3 novas seções após "ACOLHIMENTO PRIMEIRO":

- **ESPELHAMENTO PURO**: Regra absoluta de usar apenas palavras exatas do usuário, com exemplos de ERRADO/CERTO
- **TERMOS BANIDOS**: Lista explícita incluindo "Sinto que/a...", "Fico feliz...", "É ótimo que...", "Isso mostra que..."
- **REGRA DE UMA PERGUNTA**: Preferir 1 pergunta; se 2, a segunda deve ser alternativa sensorial, não repetição

A seção "ESTRUTURA DAS RESPOSTAS" permanece mas fica após as novas regras.

### 2. Fase 1 — Expandir orientação (linhas 1473-1479)

Substituir o texto compacto atual da Fase 1 em `getIOPhaseOrientation` por versão expandida:

- **PERGUNTAS RECOMENDADAS**: Categorizadas em Sensoriais, De nomeação, De repetição. Com instrução explícita "PREFIRA sensoriais e de nomeação. EVITE perguntas de identidade."
- **COMPORTAMENTO PROIBIDO**: Expandido com item explícito proibindo perguntas de identidade ("O que isso diz sobre você?", "Quem você é quando sente isso?") com nota de que pertencem à Fase 3
- **FOCO**: Acrescentar "Perguntas devem acessar SENSAÇÃO e NOMEAÇÃO, não IDENTIDADE"

### O que NÃO muda

- Branch legado (flag OFF) — intocado
- Pipeline (Steps 1-8) — intocado
- Outros blocos do buildIOSystemPrompt (3-14) — intocados
- Fases 2-7 em getIOPhaseOrientation — intocadas
- Nenhum outro edge function alterado

