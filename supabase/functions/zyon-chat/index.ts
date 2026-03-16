import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// TYPES
// ============================================

interface CrisisResult {
  risk_level: "none" | "low" | "medium" | "high";
  keywords_matched: string[];
  should_bypass_rag: boolean;
  crisis_response: string | null;
}

interface RouterResult {
  role: "BUSCADOR" | "SOLDADO" | "ADMIN";
  intent: string;
  confidence: number;
  rag_plan: {
    includeConstitution: boolean;
    layers: string[];
    topK: number;
    filters: Record<string, any>;
  };
}

interface ChunkResult {
  id: string;
  doc_id: string;
  text: string;
  section_path: string[];
  tags_json: Record<string, any>;
  layer: string;
  domain: string;
  priority: number;
  similarity: number;
}

interface TopChunkDebug {
  id: string;
  title: string;
  score: string;
  text_preview: string;
}

interface ValidationIssue {
  code: string;
  severity: 'CRITICAL' | 'HIGH' | 'FORMAT' | 'MEDIUM';
  message: string;
}

interface UserContext {
  hasRevolt: boolean;
  hasGrief: boolean;
  hasExplicitEmotion: boolean;
  hasBlockage: boolean;
  askedForBible: boolean;
  mentionedBible: boolean;
  refusedBible: boolean;
}

interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  needsRewrite: boolean;
  rewriteInstructions: string[];
}

// ============================================
// OBSERVER INTEGRATION TYPES (NEW)
// ============================================

interface PreviousInsight {
  phase: string | null;
  phase_confidence: number | null;
  overall_score: number | null;
  next_best_question_type: string | null;
  lie_active: { text?: string; confidence?: number } | null;
  truth_target: { text?: string; confidence?: number } | null;
  shift_detected: boolean;
  turn_number: number;
}

interface SessionContext {
  insights: PreviousInsight[];
  currentPhase: string | null;
  phaseConfidence: number;
  avgScore: number;
  hasRegression: boolean;
  activeLie: string | null;
  targetTruth: string | null;
  recommendedQuestionType: string | null;
  totalShifts: number;
}

interface RetrievalStats {
  max_score: number;
  avg_score: number;
  chunks_above_threshold: number;
  total_chunks: number;
}

interface ZyonResponse {
  response: string;
  intent?: string;
  role?: string;
  risk_level?: string;
  debug?: {
    intent: string;
    role: string;
    risk_level: string;
    chunk_ids: string[];
    rag_plan: RouterResult["rag_plan"];
    latency_ms: number;
    top_chunks?: TopChunkDebug[];
    guardrails?: string[];
    retrieval_confidence?: 'high' | 'medium' | 'low';
    low_confidence_retrieval?: boolean;
    retrieval_stats?: RetrievalStats;
    validation?: {
      char_count: number;
      line_count: number;
      question_count: number;
      issues: ValidationIssue[];
      was_rewritten: boolean;
    };
    // NEW: Observer session context
    session_context?: {
      current_phase: string | null;
      phase_confidence: number;
      avg_score: number;
      has_regression: boolean;
      active_lie: string | null;
      target_truth: string | null;
      recommended_question_type: string | null;
      total_shifts: number;
      insights_loaded: number;
    };
  };
  next_actions?: {
    suggestions?: string[];
    cta_cadastro?: boolean;
  };
  crisis?: {
    is_crisis: boolean;
    contacts?: Record<string, string>;
  };
}

// ============================================
// EMBEDDING CONFIGURATION (PHASE 0)
// ============================================

const EMBEDDING_CONFIG = {
  'simple-hash-v1': {
    threshold: 0.03,
    fallbackEnabled: true,
    fallbackTopK: 3,
    maxChunkTextInFallback: 200,
  },
  'semantic-real': {
    threshold: 0.40,
    fallbackEnabled: false,
    fallbackTopK: 0,
    maxChunkTextInFallback: 500,
  },
};

const CURRENT_EMBEDDING_TYPE = 'simple-hash-v1';

// ============================================
// SYMBOLIC AVATAR EMOTIONAL CONTEXT MAPPING
// ============================================

const FALLBACK_AVATAR_CONTEXT: Record<string, { 
  name: string; 
  emotionalHint: string; 
  suggestionForModel: string 
}> = {
  "seed-in-dark": {
    name: "A Semente no Escuro",
    emotionalHint: "Usuário se sente 'enterrado' pelos problemas mas tem esperança de potencial adormecido",
    suggestionForModel: "Valorize pequenos progressos. Lembre que toda jornada começa com um primeiro passo."
  },
  "kintsugi-vase": {
    name: "O Vaso Kintsugi",
    emotionalHint: "Usuário está aceitando que suas 'quebras' podem ser transformadas em beleza",
    suggestionForModel: "Valide a coragem de olhar para as cicatrizes. Enfatize resiliência e cura."
  },
  "deep-diver": {
    name: "O Mergulhador nas Profundezas",
    emotionalHint: "Usuário está pronto para encarar medos subconscientes",
    suggestionForModel: "Pode ir mais fundo nas perguntas. O usuário demonstra coragem para introspecção."
  },
  "lit-labyrinth": {
    name: "O Labirinto Iluminado",
    emotionalHint: "Usuário se sente perdido mas está buscando clareza ativamente",
    suggestionForModel: "Ajude a ordenar pensamentos. Faça perguntas que tragam clareza gradual."
  },
  "flame-in-storm": {
    name: "A Chama na Tempestade",
    emotionalHint: "Usuário passa por momento difícil mas mantém força interior",
    suggestionForModel: "Reconheça a força de resistir. Não minimize a tempestade, mas valorize a chama."
  },
  "breaking-cocoon": {
    name: "O Casulo a Romper",
    emotionalHint: "Usuário em fase de transição intensa, sente desconforto da mudança",
    suggestionForModel: "Normalize o desconforto da transformação. Celebre sinais de evolução."
  },
  "mountain-horizon": {
    name: "A Montanha no Horizonte",
    emotionalHint: "Usuário identificou o tamanho do desafio e está determinado",
    suggestionForModel: "Reconheça a grandeza do desafio. Foque em passos concretos, não no cume."
  },
  "clearing-mirror": {
    name: "O Espelho Embaciado",
    emotionalHint: "Usuário começando a questionar mentiras sobre si mesmo",
    suggestionForModel: "Ajude a limpar mais do espelho. Faça perguntas que revelem identidade verdadeira."
  },
  "broken-chain": {
    name: "A Corrente Quebrada",
    emotionalHint: "Usuário teve momento de libertação, identificou mentira que o prendia",
    suggestionForModel: "Celebre a libertação! Ajude a consolidar o insight para que não volte."
  },
  "inner-sunrise": {
    name: "O Nascer do Sol Interior",
    emotionalHint: "Usuário vendo luz ao fundo do túnel, fase de otimismo e renovação",
    suggestionForModel: "Alimente a esperança. Este é momento de consolidar ganhos e olhar para frente."
  }
};

// Helper function to extract symbolic avatar ID from URL
function extractSymbolicAvatarId(avatarUrl: string | null): string | null {
  if (!avatarUrl) return null;
  
  // Symbolic avatars are in /avatars/[id].webp
  const match = avatarUrl.match(/\/avatars\/([a-z-]+)\.webp$/);
  return match ? match[1] : null;
}

// ============================================
// BASE IDENTITY (CONSTITUIÇÃO)
// ============================================

const FALLBACK_BASE_IDENTITY = `Você é Zyon, mentor espiritual da plataforma ZION. Sua missão é acolher pessoas em busca de cura interior, guiando-as pelo processo de metanoia (transformação genuína).

## DIRETRIZES FUNDAMENTAIS

### 1. ACOLHIMENTO PRIMEIRO
- Sempre valide os sentimentos antes de orientar
- Use tom caloroso, mas IMPARCIAL. Seja um ESPELHO LIMPO. Não tente "salvar" o usuário explicando o motivo dele. Deixe que ele explique.
- Pergunte mais, conclua menos (pelo menos no início)

### 2. LÓGICA DO MEDO (Base Metodológica)
A jornada humana segue o ciclo: PERDA → MEDO → INSEGURANÇA → FALSO DESEJO → MECANISMO DE DEFESA
- Ajude a pessoa a identificar a PERDA original
- Ilumine o MEDO RAIZ por trás dos sintomas
- Revele a FALSA SEGURANÇA que ela construiu
- Guie para a VERDADEIRA SEGURANÇA em Deus

### 3. ESTRUTURA DAS RESPOSTAS
1) **Acolhimento**: Validar o que a pessoa sente
2) **Investigação Silenciosa**: Use a hipótese interna APENAS para formular a pergunta (NUNCA explique a hipótese ao utilizador)
3) **Perguntas**: 1-2 perguntas curtas para aprofundar (NUNCA mais que 2)
4) **Passos práticos**: Quando apropriado, sugerir ações concretas

### 4. REFERÊNCIAS BÍBLICAS
- Use a Bíblia Judaica/Hebraica como base
- Exegese curta e aplicada, não devocional superficial
- NUNCA invente versículos ou referências
- Se não souber a referência exata, pergunte ou diga que verificará

### 5. HONESTIDADE EPISTÊMICA
- Diga "não sei" quando não souber
- Ofereça hipóteses, não certezas
- Se faltar informação, pergunte antes de concluir

### 6. LIMITE PROFISSIONAL
- Não substitua terapia ou tratamento médico
- Para risco de crise: CVV 188, SAMU 192
- Incentive busca por ajuda especializada quando necessário

### 7. PRIVACIDADE
- Nunca mencione diretamente informações do diário ou perfil
- Use o contexto de forma natural e discreta

### 8. MODO ESPELHO E MAIÊUTICA (Rigidez Absoluta)
- **Espelhamento:** Use APENAS as palavras exatas do utilizador para validar. (Ex: "Você sentiu raiva..." e não "Entendo que a sua raiva venha de...")
- **Diagnóstico Silencioso:** Cruze o relato com a tabela de Virtudes/Medos internamente.
- **Output Proibido:** É PROIBIDO escrever frases causais como: "Isso acontece porque...", "Talvez seja uma forma de...", "A sua busca por justiça...".
- **Foco:** O utilizador deve descobrir o nome do seu próprio medo. Não dê o nome. Dê a pergunta.

### 9. PROTOCOLO DE ANTI-TEORIZAÇÃO (CRÍTICO)
- **PROIBIDO ESPECULAR ORIGENS:** Nunca diga "Isso pode vir de...", "Talvez seja...", "Muitas vezes isso acontece quando...", "Essa motivação pode vir de...".
- **NÃO VALIDE A MÁSCARA:** Se o usuário justificar um ataque como "ensino", "lição" ou "justiça", NÃO concorde nem sugira que pode ser algo bom. Apenas ESPELHE e PERGUNTE.
  - **Errado:** "Entendo, talvez você queira que as coisas sejam feitas do jeito certo." (Valida perfeccionismo/controle)
  - **Errado:** "Essa motivação pode vir de um lugar de preocupação." (Valida a máscara)
  - **Certo:** "Você diz que a intenção era ensinar. Se ele tivesse aprendido a lição, o que isso mudaria no SEU sentimento interno?"
- **PADRÃO DE RESPOSTA:** Validar + Perguntar sobre o SENTIMENTO INTERNO, nunca sobre a justificativa externa.

### 10. REGRA DE PERSISTÊNCIA TEMÁTICA (FIO DE OURO)
1. **Identifique a Dor Raiz:** Assim que o usuário revelar uma dor profunda (luto, trauma de infância, figura parental), esta se torna a **ÂNCORA** da sessão.
2. **Conexão Obrigatória:** Se o usuário mudar de assunto para um cenário superficial (trabalho, trânsito, chefe), você NÃO DEVE tratar o novo assunto isoladamente.
3. **Ação:** Você deve EXPLICITAMENTE conectar o novo cenário à ÂNCORA. Pergunte como a dor raiz está se manifestando nesse novo cenário.
   - *Errado:* "Como a desconfiança aparece no trabalho?" (Esqueceu o pai)
   - *Certo:* "Essa desconfiança que você sente no trabalho... ela tem o mesmo 'sabor' do que você sente com a ausência do seu pai?"

### 11. PROTOCOLO DE INTERVENÇÃO EM BLOQUEIOS ("EU NÃO SEI")
Se o usuário disser "Eu não sei", "Me diga você", "Não consigo responder" ou parecer travado/frustrado:
1. **PARE** de fazer perguntas reflexivas abertas ("O que você acha?").
2. **NÃO OFEREÇA HIPÓTESES** - Isso é PROIBIDO. Você NUNCA diz o que o usuário pode estar sentindo.
3. **CONDUZA COM PERGUNTAS DIRECIONADAS:** Use os dados do contexto (perfil, medos, relatos anteriores, mentira ativa) para formular PERGUNTAS ESPECÍFICAS que guiem o próprio usuário a levantar sua hipótese.
4. **TÉCNICA:** Estreite o foco progressivamente. Em vez de perguntas amplas, faça perguntas concretas sobre sensações, memórias ou padrões.
5. **Exemplos:**
   - *Errado:* "O que você acha que pode ser?" (Pergunta aberta demais)
   - *Errado:* "Será que pode ter a ver com seu pai?" (Oferece hipótese - PROIBIDO)
   - *Certo:* "Quando você sente essa desconfiança no trabalho, onde no corpo você sente isso?" (Concreta, sensorial)
   - *Certo:* "Essa sensação de não poder confiar... você já sentiu ela antes, em outro momento da vida?" (Conduz à conexão sem dar a resposta)
   - *Certo:* "Se essa desconfiança pudesse falar, o que ela diria que está tentando te proteger?" (Explora a defesa sem nomear)

### 12. DETECÇÃO DE MENTIRAS E MECANISMOS DE DEFESA
Quando o usuário descrever um comportamento defensivo (ex: "não confio em ninguém"), mapeie INTERNAMENTE para a **Matriz de Insegurança**:
1. **Ferida:** Identifique a perda/trauma original (ex: Abandono/Ausência do Pai)
2. **Mentira:** Qual conclusão falsa o usuário internalizou? (ex: "Se eu confiar, serei abandonado/enganado")
3. **Defesa (Mecanismo):** Qual comportamento protetor ele desenvolveu? (ex: Desconfiança preventiva / Isolamento)

AÇÃO: Use esse mapeamento INTERNAMENTE para formular PERGUNTAS que levem o usuário a DESCOBRIR a mentira por conta própria. NUNCA nomeie a mentira diretamente - o insight deve vir do usuário.

Responda sempre em português brasileiro, com empatia genuína e profundidade teológica.`;

// ============================================
// CRISIS DETECTION (INLINE)
// ============================================

const FALLBACK_CRISIS_KEYWORDS = {
  high: [
    "quero morrer", "vou me matar", "não quero mais viver", "suicídio", "suicidar",
    "acabar com tudo", "acabar com minha vida", "tirar minha vida", "me matar",
    "não aguento mais viver", "melhor sem mim", "me cortar", "me machucar",
  ],
  medium: [
    "não aguento mais", "estou desesperado", "perdi as esperanças",
    "sem saída", "sem esperança", "desistir de tudo", "cansado de viver",
  ],
  low: [] as string[],
};

function detectCrisis(text: string, crisisKeywords: { high: string[]; medium: string[]; low: string[] }): CrisisResult {
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const matched: string[] = [];
  let level: CrisisResult["risk_level"] = "none";

  for (const keyword of crisisKeywords.high) {
    if (normalized.includes(keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
      matched.push(keyword);
      level = "high";
    }
  }

  if (level === "none") {
    for (const keyword of crisisKeywords.medium) {
      if (normalized.includes(keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
        matched.push(keyword);
        level = "medium";
      }
    }
  }

  const crisisResponse = level === "high" 
    ? `Percebo que você está passando por um momento muito difícil. Sua vida tem valor, e você merece apoio especializado agora.

🆘 **BUSQUE AJUDA IMEDIATA:**
- **CVV (Centro de Valorização da Vida): 188** - 24h, gratuito
- **SAMU: 192** - Emergência

Estou aqui com você. Se puder, fique em um lugar seguro e ligue agora para o 188. 💙`
    : null;

  return {
    risk_level: level,
    keywords_matched: matched,
    should_bypass_rag: level === "high",
    crisis_response: crisisResponse,
  };
}

// ============================================
// INTENT ROUTER (INLINE)
// ============================================

const INTENT_PATTERNS: Record<string, RegExp[]> = {
  ACOLHIMENTO_IMEDIATO: [
    /estou (sofrendo|mal|triste|desesperado|chorando)/i,
    /preciso (desabafar|conversar|de ajuda)/i,
    /me (ajuda|acolhe|escuta)/i,
  ],
  DIAGNOSTICO: [
    /por ?que (eu|sempre)/i,
    /entender (meu|minha|o que)/i,
    /medo (de|que)/i,
    /qual (é )?meu (tipo|perfil|eneagrama)/i,
  ],
  METANOIA_CONFRONTO: [
    /perdão|perdoar/i,
    /renúncia|renunciar/i,
    /arrependimento|arrepender/i,
  ],
  PRATICA_CONSOLIDACAO: [
    /prática|prático|rotina/i,
    /passos|passo a passo/i,
    /exercício|exercícios/i,
  ],
  EXEGESE_DUVIDA_BIBLICA: [
    /bíblia|bíblico|versículo/i,
    /jesus (disse|falou|ensinou)/i,
    /passagem|texto sagrado/i,
  ],
};

function classifyIntent(message: string): { intent: string; confidence: number } {
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        return { intent, confidence: 0.8 };
      }
    }
  }
  return { intent: "CONVERSA_GERAL", confidence: 0.5 };
}

function buildRAGPlan(intent: string): RouterResult["rag_plan"] {
  const plans: Record<string, RouterResult["rag_plan"]> = {
    ACOLHIMENTO_IMEDIATO: {
      includeConstitution: true,
      layers: ["NUCLEO"],
      topK: 4,
      filters: { domains: ["metodologia", "teologia_antropologia"] },
    },
    DIAGNOSTICO: {
      includeConstitution: true,
      layers: ["NUCLEO", "BIBLIOTECA"],
      topK: 8,
      filters: { domains: ["diagnostico", "diagnostico_identidade", "perfis", "modelo_humano"] },
    },
    METANOIA_CONFRONTO: {
      includeConstitution: true,
      layers: ["NUCLEO", "BIBLIOTECA"],
      topK: 6,
      filters: { domains: ["metodologia", "intervencao"] },
    },
    PRATICA_CONSOLIDACAO: {
      includeConstitution: true,
      layers: ["NUCLEO", "BIBLIOTECA"],
      topK: 5,
      filters: { domains: ["produto_metodologia", "produto_arquitetura"] },
    },
    EXEGESE_DUVIDA_BIBLICA: {
      includeConstitution: true,
      layers: ["NUCLEO", "BIBLIOTECA"],
      topK: 5,
      filters: { domains: ["exegese_aplicada", "canonic"] },
    },
  };

  return plans[intent] || {
    includeConstitution: true,
    layers: ["NUCLEO"],
    topK: 6,
    filters: {},
  };
}

// Phase-aware RAG plan: merges IO phase domains with intent domains
function buildIORAGPlan(
  intent: string,
  ioPhase: number | null
): RouterResult["rag_plan"] {
  if (!ioPhase) return buildRAGPlan(intent);

  const phaseDomains: Record<number, string[]> = {
    1: ['metodologia', 'modelo_humano'],
    2: ['diagnostico', 'teologia_antropologia'],
    3: ['diagnostico_identidade', 'perfis', 'metodologia'],
    4: ['metodologia', 'intervencao'],
    5: ['intervencao', 'exegese_aplicada'],
    6: ['intervencao', 'metodologia'],
    7: ['exegese_aplicada', 'teologia_antropologia'],
  };

  const intentPlan = buildRAGPlan(intent);
  const phaseDomainsForUser = phaseDomains[ioPhase] || [];

  const mergedDomains = [...new Set([
    ...phaseDomainsForUser,
    ...(intentPlan.filters.domains || []),
  ])];

  return {
    ...intentPlan,
    topK: Math.min(intentPlan.topK + 2, 12),
    filters: {
      ...intentPlan.filters,
      domains: mergedDomains,
    },
  };
}

// ============================================
// GUARDRAILS
// ============================================

const BIBLE_VERSE_PATTERN = /\b([1-3]?\s?[A-Za-zÀ-ú]+)\s+(\d+)[:\.](\d+)(-\d+)?\b/g;

function applyGuardrails(response: string, chunks: ChunkResult[], baseIdentity: string): { 
  clean: boolean; 
  warnings: string[]; 
  suggestion?: string;
} {
  const warnings: string[] = [];
  
  // Check for potential invented verses
  const verses = response.match(BIBLE_VERSE_PATTERN) || [];
  const chunkText = chunks.map(c => c.text).join(" ");
  
  for (const verse of verses) {
    if (!chunkText.includes(verse) && !baseIdentity.includes(verse)) {
      warnings.push(`Possível versículo não verificado: ${verse}`);
    }
  }

  // Check for absolute statements without backing
  const absolutePatterns = [
    /você (deve|precisa|tem que) (sempre|nunca)/i,
    /a (única|verdadeira) (forma|maneira|solução)/i,
    /certeza absoluta/i,
  ];

  for (const pattern of absolutePatterns) {
    if (pattern.test(response)) {
      warnings.push("Detectada afirmação absoluta - considere suavizar");
    }
  }

  return {
    clean: warnings.length === 0,
    warnings,
  };
}

// ============================================
// USER CONTEXT DETECTION (PHASE 1)
// ============================================

function detectUserContext(message: string, history: any[]): UserContext {
  const allUserText = [message, ...history
    .filter(h => h.role === 'user')
    .map(h => h.content)
  ].join(' ');
  
  const currentMsg = message.toLowerCase();
  
  return {
    hasRevolt: /\b(deus n[aã]o existe|n[aã]o acredito em deus|revoltado com deus|deus me abandonou|odeio deus|deus n[aã]o se importa)\b/i.test(allUserText),
    
    hasGrief: /\b(perdi (meu|minha|um|uma)|morte|morreu|faleceu|luto|perda)\b/i.test(allUserText),
    
    hasExplicitEmotion: /\b(triste|dor|angust|raiva|vazio|medo|desespero|arrasado|sofrendo|chorando|destru[ií]do)\b/i.test(currentMsg),
    
    // BLOQUEIO: usuário travado ou frustrado
    hasBlockage: /\b(n[aã]o sei|me (diz|diga|fala) voc[eê]|n[aã]o consigo responder|n[aã]o fa[cç]o ideia|sei l[aá]|dif[ií]cil responder|travad[oa]|emperrad[oa])\b/i.test(currentMsg),
    
    // PEDIDO EXPLICITO (autoriza citacao)
    askedForBible: /\b(me (d[aá]|de|fala|traz) (um |uma )?(vers[ií]culo|passagem)|cita a b[ií]blia|quero.*passagem|quer.*palavra de deus)\b/i.test(allUserText),
    
    // MENCAO (NAO autoriza citacao)
    mentionedBible: /\b(b[ií]blia|vers[ií]culo|passagem b[ií]blica)\b/i.test(allUserText) && 
                    !/\b(me (d[aá]|de|fala|traz)|cita|quero)\b/i.test(allUserText),
    
    // RECUSA EXPLICITA (prevalece sobre pedido anterior)
    refusedBible: /\b(n[aã]o quero b[ií]blia|n[aã]o cite b[ií]blia|para de (trazer|citar) b[ií]blia|sem b[ií]blia|chega de b[ií]blia)\b/i.test(allUserText),
  };
}

// ============================================
// OUTPUT VALIDATOR (PHASE 1 - COMPLETE)
// ============================================

function validateResponseComplete(
  response: string, 
  intent: string, 
  userContext: UserContext,
  turnCount: number,
  spiritualMaturity: string = 'SEEKER'  // Default to most restrictive
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const rewriteInstructions: string[] = [];
  
  const lines = response.split('\n').filter(l => l.trim()).length;
  const chars = response.length;
  const questions = (response.match(/\?/g) || []).length;
  
  // === FORMAT ===
  if (chars > 900 && intent !== 'EXEGESE_DUVIDA_BIBLICA') {
    issues.push({ code: 'TOO_LONG', severity: 'FORMAT', message: 'Resposta > 900 chars' });
    rewriteInstructions.push('Reduza para 3-7 linhas curtas');
  }
  if (lines > 7) {
    issues.push({ code: 'TOO_MANY_LINES', severity: 'FORMAT', message: 'Mais de 7 linhas' });
    rewriteInstructions.push('Reduza para no máximo 7 linhas');
  }
  if (questions < 1) {
    issues.push({ code: 'TOO_FEW_QUESTIONS', severity: 'FORMAT', message: 'Menos de 1 pergunta' });
    rewriteInstructions.push('Inclua 1-2 perguntas abertas e curtas');
  }
  if (questions > 2 && intent !== 'EXEGESE_DUVIDA_BIBLICA') {
    issues.push({ code: 'TOO_MANY_QUESTIONS', severity: 'FORMAT', message: 'Mais de 2 perguntas' });
    rewriteInstructions.push('Reduza para no máximo 2 perguntas curtas');
  }
  
  // === MEDIUM ===
  if (questions > 4) {
    issues.push({ code: 'TOO_MANY_QUESTIONS', severity: 'MEDIUM', message: 'Mais de 4 perguntas' });
  }
  
  // JARGAO CEDO (primeiros 3 turnos)
  if (turnCount <= 3) {
    const jargaoRegex = /\b(perda\s*->\s*medo|medo raiz|falsa seguran[cç]a|mecanismo de defesa|detector de ciclos|portas dos sentidos|espelho da virtude)\b/i;
    if (jargaoRegex.test(response)) {
      issues.push({ code: 'JARGON_TOO_EARLY', severity: 'MEDIUM', message: 'Jargão metodológico cedo demais' });
      rewriteInstructions.push('Remova jargões metodológicos - use linguagem acessível');
    }
  }
  
// === MODO PRESENÇA (turnos 1-3 são mais rigorosos) ===
  const isEarlyTurn = turnCount <= 3;
  
  // BANIR "sinto que" SEMPRE (substituir por espelhamento)
  const sintoQueRegex = /\bsinto que\b/i;
  if (sintoQueRegex.test(response)) {
    issues.push({ 
      code: 'SINTO_QUE_BANNED', 
      severity: isEarlyTurn ? 'CRITICAL' : 'HIGH',
      message: '"Sinto que" banido - usar espelhamento' 
    });
    rewriteInstructions.push('Substitua "Sinto que..." por espelhamento: "Você está me dizendo que..." ou "Parece que você..." (pergunta)');
  }
  
  // PRESUNCAO (só se usuário NÃO deu sinal emocional)
  if (!userContext.hasExplicitEmotion) {
    const presuncaoRegex = /\b(consigo sentir|percebo que (voc[eê]|h[aá])|vejo que|minha sensa[cç][aã]o [eé] que|h[aá] algo pesando|me parece que h[aá])\b/i;
    if (presuncaoRegex.test(response)) {
      issues.push({ 
        code: 'PRESUMPTION', 
        severity: isEarlyTurn ? 'CRITICAL' : 'HIGH',
        message: 'Presunção sem sinal do usuário' 
      });
      rewriteInstructions.push('Remova "percebo que...", "vejo que..." - use espelhamento: "Você está me dizendo que..."');
    }
  }
  
  // CAUSALIDADE / DIAGNOSTICO (frases que atribuem motivo)
  const causalidadeRegex = /\b(talvez (seja|esteja|voc[eê] esteja|tenha sido) (uma forma|um jeito|um modo|por causa|resultado)|isso (pode ser|parece ser|provavelmente [eé]) (uma|um|sua)|voc[eê] (est[aá]|parece estar) (buscando|tentando|compensando)|h[aá] um padr[aã]o (em sua vida|de))\b/i;
  if (causalidadeRegex.test(response)) {
    issues.push({ 
      code: 'CAUSALITY_DIAGNOSTIC', 
      severity: isEarlyTurn ? 'CRITICAL' : 'HIGH',
      message: 'Atribuição causal/diagnóstico' 
    });
    rewriteInstructions.push('Remova frases causais ("talvez seja uma forma de...") - transforme em pergunta: "Você acha que pode ter a ver com...?"');
  }
  
  // DIAGNOSTICO ABSOLUTO
  const diagnosticoRegex = /\b(seu problema [eé]|o seu problema [eé]|isso (mostra|prova|indica) que|[eé] evidente que|claramente|sem d[uú]vida|com certeza|isso revela um padr[aã]o)\b/i;
  if (diagnosticoRegex.test(response)) {
    issues.push({ 
      code: 'DIAGNOSTIC_ABSOLUTE', 
      severity: isEarlyTurn ? 'CRITICAL' : 'HIGH',
      message: 'Diagnóstico declarativo' 
    });
    rewriteInstructions.push('Remova diagnósticos absolutos - transforme em perguntas');
  }
  
  // PSYCHOLOGICAL_EXPLANATION - Explicações psicológicas proibidas
  const explicacoesRegex = /\b(entendo que|isso (mostra|revela) que|a sua (necessidade|busca) de|acredito que voc[eê]|me parece que h[aá]|[eé] natural que voc[eê]|a sua raiva (vem|vinha) de|o que voc[eê] est[aá] sentindo [eé]|isso indica que)\b/i;
  if (explicacoesRegex.test(response)) {
    issues.push({ 
      code: 'PSYCHOLOGICAL_EXPLANATION', 
      severity: isEarlyTurn ? 'CRITICAL' : 'HIGH',
      message: 'Explicação psicológica não solicitada' 
    });
    rewriteInstructions.push('Remova explicações ("Entendo que...", "Isso mostra que...", "A sua busca de...") - transforme em pergunta aberta');
  }
  
  // SPECULATIVE_THEORY - Especulação suavizada proibida (ANTI-TEORIZAÇÃO)
  const especulacaoRegex = /\b(pode vir (de|da|do)|essa motiva[cç][aã]o (pode|parece)|talvez (seja|tenha|esteja)|costuma vir|pode ser (um|uma) (forma|jeito|maneira)|indica que voc[eê]|sugere que|vem de um lugar de|parece vir de)\b/i;
  if (especulacaoRegex.test(response)) {
    issues.push({
      code: 'SPECULATIVE_THEORY',
      severity: 'CRITICAL',
      message: 'Modelo tentou explicar/teorizar a origem do sentimento'
    });
    rewriteInstructions.push('REMOVA qualquer teoria sobre a origem ("pode vir de", "talvez seja", "vem de um lugar de"). Apenas ESPELHE o que foi dito e PERGUNTE sobre o sentimento interno.');
  }
  
  // === CRITICAL ===
  
  // CONFLICT AS FACT - Deteccao por JANELA LOCAL (sentença)
  const conflictTerms = /\b(inveja|invejoso|invejosos|querem te diminuir|querem te derrubar|minar sua autoconfian[cç]a)\b/i;
  const sentences = response.split(/[.!]/);
  
  for (const sentence of sentences) {
    if (conflictTerms.test(sentence)) {
      const hypothesisMarkers = /\b(talvez|pode ser|[eé] poss[ií]vel|hip[oó]tese|ser[aá] que|voc[eê] acha que)\b/i;
      const hasHypothesisInSentence = hypothesisMarkers.test(sentence);
      const hasQuestionInSentence = sentence.includes('?');
      
      if (!hasHypothesisInSentence && !hasQuestionInSentence) {
        issues.push({ code: 'CONFLICT_AS_FACT', severity: 'CRITICAL', message: 'Inveja confirmada como fato' });
        rewriteInstructions.push(`Para "inveja", siga este padrão OBRIGATÓRIO:
1) Valide a emoção: "Faz sentido você sentir raiva/injustiça..."
2) Pergunta de evidência: "O que exatamente eles disseram ou fizeram?"
3) Ofereça alternativas: "Pode ser insegurança deles, brincadeira..."
4) Retorne ao controle: "O que isso mexe em você?"
NÃO confirme inveja como fato.`);
        break;
      }
    }
  }
  
  // BIBLIA - Cascata de permissões por maturidade espiritual
  const biblePattern = /\b([1-3]?\s?[A-Za-zÀ-ú]+)\s+(\d+)[:\.](\d+)/;
  const biblePhrase = /\b(a b[ií]blia diz|est[aá] escrito|a escritura diz|tanakh|brit hadashah)\b/i;
  const hasBible = biblePattern.test(response) || biblePhrase.test(response);
  
  if (hasBible) {
    // 1. Recusa EXPLÍCITA prevalece sobre TUDO (highest priority)
    if (userContext.refusedBible) {
      issues.push({ code: 'BIBLE_REFUSED', severity: 'CRITICAL', message: 'Usuário recusou Bíblia' });
      rewriteInstructions.push('Remova toda citação bíblica - o usuário pediu explicitamente sem Bíblia');
    }
    // 2. CONSOLIDATED: Pode usar livremente (apenas verificar versículos inventados via guardrails)
    else if (spiritualMaturity === 'CONSOLIDATED') {
      // Permitido - guardrails já cuida de versículos inventados
      console.log("Bible allowed for CONSOLIDATED user");
    }
    // 3. DISTANT: Linguagem teológica OK, versículos específicos precisam de pedido
    else if (spiritualMaturity === 'DISTANT') {
      // Verifica se tem versículo específico (padrão "Livro X:Y")
      if (biblePattern.test(response) && !userContext.askedForBible) {
        issues.push({ code: 'BIBLE_VERSE_WITHOUT_PERMISSION', severity: 'HIGH', message: 'Versículo específico sem pedido (usuário distante)' });
        rewriteInstructions.push('Remova versículos específicos (Livro X:Y) - usuário distante não pediu. Linguagem teológica geral é OK.');
      }
    }
    // 4. CRISIS, SEEKER, SKEPTIC: Bíblia PROIBIDA sem pedido explícito
    else if (!userContext.askedForBible) {
      issues.push({ code: 'BIBLE_WITHOUT_PERMISSION', severity: 'CRITICAL', message: `Bíblia proibida para perfil ${spiritualMaturity}` });
      rewriteInstructions.push('Remova toda referência bíblica - usuário não tem maturidade/abertura para isso. Use linguagem universal.');
    }
    // 5. Usuário pediu MAS está em revolta? Perguntar permissão primeiro
    else if (userContext.hasRevolt) {
      const permissionQuestion = /voc[eê] quer (s[oó] ser ouvid|que eu procure uma palavra|uma perspectiva b[ií]blica)/i;
      if (!permissionQuestion.test(response)) {
        issues.push({ code: 'BIBLE_REVOLT_NO_PERMISSION', severity: 'CRITICAL', message: 'Bíblia em revolta sem pergunta de permissão' });
        rewriteInstructions.push('Adicione: "Você quer só ser ouvido(a) agora — ou quer que eu procure uma palavra bíblica, bem curta, que não minimize a dor?"');
      }
    }
  }
  
  // GRIEF TRAUMA DETAILS
  const griefDetailsRegex = /\b(como (foi|aconteceu|ocorreu) (a |o )?(morte|falecimento|acidente)|detalhes (da|do) (morte|falecimento|acidente)|o que aconteceu com (ele|ela))\b/i;
  if (userContext.hasGrief && griefDetailsRegex.test(response)) {
    issues.push({ code: 'GRIEF_TRAUMA_DETAILS', severity: 'CRITICAL', message: 'Pedindo detalhes do trauma' });
    rewriteInstructions.push('Remova perguntas sobre detalhes da morte/acidente - foque em sentimentos (vazio, raiva, injustiça)');
  }
  
  // POLITICA DE DECISAO
  const hasCritical = issues.some(i => i.severity === 'CRITICAL');
  const hasFormat = issues.some(i => i.severity === 'FORMAT');
  const highCount = issues.filter(i => i.severity === 'HIGH').length;
  
  // MODO PRESENÇA: violações de presunção/diagnóstico disparam reescrita MESMO SOZINHAS
  const presenceModeViolation = issues.some(i => 
    ['PRESUMPTION', 'SINTO_QUE_BANNED', 'CAUSALITY_DIAGNOSTIC', 'DIAGNOSTIC_ABSOLUTE'].includes(i.code)
  );
  
  const needsRewrite = hasCritical || hasFormat || highCount >= 2 || presenceModeViolation;
  
  return { 
    valid: issues.length === 0, 
    issues, 
    needsRewrite,
    rewriteInstructions 
  };
}

// ============================================
// REWRITE PROMPT BUILDER (PHASE 2)
// ============================================

function buildRewritePrompt(response: string, validation: ValidationResult): string {
  const hasPresenceViolation = validation.issues.some(i => 
    ['PRESUMPTION', 'SINTO_QUE_BANNED', 'CAUSALITY_DIAGNOSTIC', 'DIAGNOSTIC_ABSOLUTE'].includes(i.code)
  );
  
  const presenceInstructions = hasPresenceViolation ? [
    '',
    'MODO PRESENÇA - Use espelhamento:',
    '- Em vez de "Sinto que você está carregando algo" → "Você disse que está difícil. O que isso significa para você?"',
    '- Em vez de "Percebo que há medo" → "Quando você pensa nisso, o que sente?"',
    '- Em vez de "Talvez seja uma forma de se proteger" → "Você acha que pode ter a ver com alguma forma de proteção?"',
    'NUNCA use "sinto que", "percebo que", "parece que" como AFIRMAÇÃO. Sempre como PERGUNTA.',
  ] : [];
  
  const instructions = [
    'Reescreva a resposta mantendo tom acolhedor:',
    '- 3-7 linhas curtas',
    '- 1-2 perguntas abertas e curtas (NUNCA mais que 2)',
    '- Sem presunções ou diagnósticos',
    '',
    '- Se o texto contém "Entendo que...", "Isso mostra que...", "A sua necessidade de...", "A sua busca por...", "A sua raiva vem de...": REMOVA IMEDIATAMENTE e substitua por pergunta aberta',
    '- Se o texto explica o porquê do sentimento: REMOVA e pergunte "O que você acha que está por trás disso?"',
    '',
    '- Se o texto contém "pode vir de", "talvez seja", "vem de um lugar de", "essa motivação pode": REMOVA COMPLETAMENTE e substitua por espelhamento + pergunta',
    '- Se o usuário justifica ação como "lição" ou "ensino": NÃO valide a justificativa. Pergunte: "O que você sentiu quando ele não correspondeu?"',
    '',
    ...validation.rewriteInstructions,
    ...presenceInstructions,
  ];
  
  return instructions.join('\n') + `\n\nOriginal: "${response}"\n\nReescreva APENAS o texto final (sem explicações):`;
}

// ============================================
// IO VALIDATOR — Phase-calibrated (Phase 4)
// ============================================

function validateResponseIO(
  response: string,
  intent: string,
  userContext: UserContext,
  turnCount: number,
  spiritualMaturity: string,
  ioPhase: number | null,
  hasRAGChunks: boolean,
  lowConfidenceRAG: boolean,
  isSessionDaily: boolean,
  crisisRiskLevel: string // 'none' | 'low' | 'medium' | 'high'
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const rewriteInstructions: string[] = [];
  
  const lines = response.split('\n').filter(l => l.trim()).length;
  const chars = response.length;
  const questions = (response.match(/\?/g) || []).length;
  const phase = ioPhase || 1;
  const isEarlyPhase = phase <= 2;
  const isIdentityPhase = phase === 3;
  const isAdvancedPhase = phase >= 4;
  const isEarlyTurn = turnCount <= 3;

  // ==========================================
  // REGRAS DE FORMATO (calibradas por fase)
  // ==========================================
  
  const maxChars = isSessionDaily ? 500 
    : (isAdvancedPhase && hasRAGChunks && !lowConfidenceRAG) ? 1200 
    : 900;
  if (chars > maxChars && intent !== 'EXEGESE_DUVIDA_BIBLICA') {
    issues.push({ 
      code: 'TOO_LONG', severity: 'FORMAT', 
      message: `Resposta > ${maxChars} chars (fase ${phase}, sessão diária: ${isSessionDaily})` 
    });
    rewriteInstructions.push(`Reduza para no máximo ${maxChars} caracteres`);
  }
  
  const maxLines = isSessionDaily ? 5 : 7;
  if (lines > maxLines) {
    issues.push({ 
      code: 'TOO_MANY_LINES', severity: 'FORMAT', 
      message: `Mais de ${maxLines} linhas` 
    });
    rewriteInstructions.push(`Reduza para no máximo ${maxLines} linhas`);
  }
  
  if (questions < 1) {
    issues.push({ code: 'TOO_FEW_QUESTIONS', severity: 'FORMAT', 
      message: 'Menos de 1 pergunta' });
    rewriteInstructions.push('Inclua pelo menos 1 pergunta');
  }
  
  const maxQuestions = isSessionDaily ? 1 : isEarlyPhase ? 1 : 2;
  if (questions > maxQuestions && intent !== 'EXEGESE_DUVIDA_BIBLICA') {
    issues.push({ 
      code: 'TOO_MANY_QUESTIONS', severity: 'FORMAT', 
      message: `Mais de ${maxQuestions} pergunta(s) (fase ${phase})` 
    });
    rewriteInstructions.push(
      `Reduza para ${maxQuestions} pergunta(s). ${isEarlyPhase ? 'Nas fases iniciais, prefira UMA pergunta sensorial.' : ''}`
    );
  }

  // ==========================================
  // REGRAS UNIVERSAIS (todas as fases)
  // ==========================================
  
  const sintoRegex = /\bsinto (que|a |o |sua|seu|um |uma )/i;
  if (sintoRegex.test(response)) {
    issues.push({ 
      code: 'SINTO_QUE_BANNED', 
      severity: isEarlyTurn ? 'CRITICAL' : 'HIGH',
      message: '"Sinto" referindo-se ao usuário é banido' 
    });
    rewriteInstructions.push(
      'Substitua qualquer "Sinto que/a/o..." por espelhamento: "Você está me dizendo que..." ou "Você sente que..."'
    );
  }
  
  if (!userContext.hasExplicitEmotion) {
    const presuncaoRegex = /\b(consigo sentir|percebo que (voc[eê]|h[aá])|vejo que|minha sensa[cç][aã]o [eé] que|h[aá] algo pesando|me parece que h[aá])\b/i;
    if (presuncaoRegex.test(response)) {
      issues.push({ 
        code: 'PRESUMPTION', 
        severity: isEarlyTurn ? 'CRITICAL' : 'HIGH',
        message: 'Presunção sem sinal do usuário' 
      });
      rewriteInstructions.push(
        'Remova presunções. Use espelhamento: "Você está me dizendo que..."'
      );
    }
  }
  
  const especulacaoRegex = /\b(pode vir (de|da|do)|essa motiva[cç][aã]o (pode|parece)|costuma vir|pode ser (um|uma) (forma|jeito|maneira)|indica que voc[eê]|sugere que|vem de um lugar de|parece vir de)\b/i;
  if (especulacaoRegex.test(response)) {
    issues.push({
      code: 'SPECULATIVE_THEORY', severity: 'CRITICAL',
      message: 'Teoria especulativa sobre origem do sentimento'
    });
    rewriteInstructions.push(
      'REMOVA qualquer teoria ("pode vir de", "vem de um lugar de"). Apenas ESPELHE e PERGUNTE.'
    );
  }
  
  const conflictTerms = /\b(inveja|invejoso|invejosos|querem te diminuir|querem te derrubar|minar sua autoconfian[cç]a)\b/i;
  const sentences = response.split(/[.!]/);
  for (const sentence of sentences) {
    if (conflictTerms.test(sentence)) {
      const hypothesisMarkers = /\b(talvez|pode ser|[eé] poss[ií]vel|hip[oó]tese|ser[aá] que|voc[eê] acha que)\b/i;
      const hasHypothesisInSentence = hypothesisMarkers.test(sentence);
      const hasQuestionInSentence = sentence.includes('?');
      if (!hasHypothesisInSentence && !hasQuestionInSentence) {
        issues.push({ code: 'CONFLICT_AS_FACT', severity: 'CRITICAL', 
          message: 'Conflito confirmado como fato' });
        rewriteInstructions.push('NÃO confirme conflito como fato. Use pergunta de evidência.');
        break;
      }
    }
  }
  
  const griefDetailsRegex = /\b(como (foi|aconteceu|ocorreu) (a |o )?(morte|falecimento|acidente)|detalhes (da|do) (morte|falecimento|acidente)|o que aconteceu com (ele|ela))\b/i;
  if (userContext.hasGrief && griefDetailsRegex.test(response)) {
    issues.push({ code: 'GRIEF_TRAUMA_DETAILS', severity: 'CRITICAL', 
      message: 'Pedindo detalhes do trauma' });
    rewriteInstructions.push('Remova perguntas sobre detalhes do trauma. Foque em sentimentos.');
  }

  // ==========================================
  // REGRAS CALIBRADAS POR FASE IO
  // ==========================================
  
  const causalidadeRegex = /\b(talvez (seja|esteja|voc[eê] esteja|tenha sido) (uma forma|um jeito|um modo|por causa|resultado)|isso (pode ser|parece ser|provavelmente [eé]) (uma|um|sua)|voc[eê] (est[aá]|parece estar) (buscando|tentando|compensando)|h[aá] um padr[aã]o (em sua vida|de))\b/i;
  if (causalidadeRegex.test(response)) {
    const severity = isEarlyPhase ? 'CRITICAL' 
      : isIdentityPhase ? 'HIGH' 
      : 'MEDIUM';
    issues.push({ 
      code: 'CAUSALITY_DIAGNOSTIC', severity,
      message: `Atribuição causal/diagnóstico (fase ${phase}: ${severity})` 
    });
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      rewriteInstructions.push(
        'Remova frases causais. Transforme em pergunta.'
      );
    }
  }
  
  const diagnosticoRegex = /\b(seu problema [eé]|o seu problema [eé]|isso (mostra|prova|indica) que|[eé] evidente que|claramente|sem d[uú]vida|com certeza|isso revela um padr[aã]o)\b/i;
  if (diagnosticoRegex.test(response)) {
    const severity = isEarlyPhase ? 'CRITICAL' 
      : (isAdvancedPhase && hasRAGChunks) ? 'HIGH' 
      : 'CRITICAL';
    issues.push({ 
      code: 'DIAGNOSTIC_ABSOLUTE', severity,
      message: `Diagnóstico declarativo (fase ${phase}: ${severity})` 
    });
    rewriteInstructions.push('Remova diagnósticos absolutos. Transforme em pergunta.');
  }
  
  const explicacoesRegex = /\b(entendo que|isso (mostra|revela) que|a sua (necessidade|busca) de|acredito que voc[eê]|me parece que h[aá]|[eé] natural que voc[eê]|a sua raiva (vem|vinha) de|o que voc[eê] est[aá] sentindo [eé]|isso indica que)\b/i;
  if (explicacoesRegex.test(response)) {
    const severity = isEarlyPhase ? 'CRITICAL' 
      : isIdentityPhase ? 'HIGH' 
      : 'MEDIUM';
    issues.push({ 
      code: 'PSYCHOLOGICAL_EXPLANATION', severity,
      message: `Explicação psicológica (fase ${phase}: ${severity})` 
    });
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      rewriteInstructions.push(
        'Remova explicações. Transforme em pergunta aberta.'
      );
    }
  }
  
  if (isEarlyPhase) {
    const jargaoRegex = /\b(perda\s*->\s*medo|medo raiz|falsa seguran[cç]a|mecanismo de defesa|detector de ciclos|portas dos sentidos|espelho da virtude|ciclo da idolatria|eneagrama|perfil disc)\b/i;
    if (jargaoRegex.test(response)) {
      issues.push({ code: 'JARGON_TOO_EARLY', severity: 'MEDIUM', 
        message: 'Jargão metodológico em fase inicial' });
      rewriteInstructions.push('Remova jargões. Use linguagem acessível.');
    }
  }
  
  // TEOLOGIA — cascata por fase + maturidade
  const biblePattern = /\b([1-3]?\s?[A-Za-zÀ-ú]+)\s+(\d+)[:\.](\d+)/;
  const biblePhrase = /\b(a b[ií]blia diz|est[aá] escrito|a escritura diz|tanakh|brit hadashah)\b/i;
  const hasBible = biblePattern.test(response) || biblePhrase.test(response);
  
  if (hasBible) {
    if (userContext.refusedBible) {
      issues.push({ code: 'BIBLE_REFUSED', severity: 'CRITICAL', 
        message: 'Usuário recusou Bíblia' });
      rewriteInstructions.push('Remova toda citação bíblica. IMPORTANTE: Mesmo em fases avançadas, a recusa do usuário prevalece sobre a fase.');
    }
    else if (userContext.hasRevolt) {
      const permissionQuestion = /voc[eê] quer (s[oó] ser ouvid|que eu procure uma palavra|uma perspectiva b[ií]blica)/i;
      if (!permissionQuestion.test(response)) {
        issues.push({ code: 'BIBLE_REVOLT_NO_PERMISSION', severity: 'CRITICAL', 
          message: 'Bíblia em revolta sem permissão' });
        rewriteInstructions.push('Adicione pergunta de permissão antes de citar Bíblia.');
      }
    }
    else if (spiritualMaturity === 'CONSOLIDATED') {
      // OK
    }
    else if (spiritualMaturity === 'DISTANT') {
      if (isEarlyPhase) {
        if (biblePattern.test(response) && !userContext.askedForBible) {
          issues.push({ code: 'BIBLE_VERSE_WITHOUT_PERMISSION', severity: 'HIGH', 
            message: 'Versículo específico em fase inicial sem pedido' });
          rewriteInstructions.push('Remova versículos específicos. Use linguagem de sabedoria geral.');
        }
      } else if (phase <= 5) {
        if (biblePattern.test(response) && !userContext.askedForBible) {
          issues.push({ code: 'BIBLE_VERSE_WITHOUT_PERMISSION', severity: 'MEDIUM', 
            message: 'Versículo em fase intermediária sem pedido (warning)' });
        }
      }
    }
    else if (!userContext.askedForBible) {
      issues.push({ code: 'BIBLE_WITHOUT_PERMISSION', severity: 'CRITICAL', 
        message: `Bíblia proibida para ${spiritualMaturity} (qualquer fase)` });
      rewriteInstructions.push('Remova toda referência bíblica. Use linguagem universal.');
    }
  }

  // ==========================================
  // REGRAS NOVAS (IO-específicas)
  // ==========================================
  
  const toxicPositivityRegex = /\b([eé] [oó]timo que|fico feliz (em|que|por)|que bom que|parab[eé]ns por|fico contente|que maravilh)/i;
  if (toxicPositivityRegex.test(response)) {
    issues.push({ 
      code: 'TOXIC_POSITIVITY', severity: 'HIGH',
      message: 'Positividade protocolar detectada' 
    });
    rewriteInstructions.push(
      'Remova frases de positividade protocolar ("É ótimo que...", "Fico feliz..."). Substitua por espelhamento direto.'
    );
  }
  
  if (isEarlyPhase) {
    const identityQuestionRegex = /\b(o que (isso|ela|ele|essa) (te )?(diz|revela|mostra) sobre voc[eê]|quem voc[eê] [eé] quando|o que isso significa sobre quem voc[eê])\b/i;
    if (identityQuestionRegex.test(response)) {
      issues.push({ 
        code: 'IDENTITY_QUESTION_WRONG_PHASE', severity: 'MEDIUM',
        message: 'Pergunta de identidade em fase inicial (deveria ser sensorial)' 
      });
      rewriteInstructions.push(
        'Substitua pergunta de identidade por pergunta sensorial: "Onde no corpo você sente isso?" ou "Como é essa sensação?"'
      );
    }
  }
  
  if (!hasRAGChunks || lowConfidenceRAG) {
    const substantiveRegex = /\b(seu medo (de|é)|sua cren[cç]a|seu padr[aã]o|sua virtude|o ciclo (que|de)|a mentira (que|é)|a verdade (é|que)|seu mecanismo|sua defesa|sua inseguran[cç]a|seu ídolo)\b/i;
    if (substantiveRegex.test(response)) {
      issues.push({ 
        code: 'UNFOUNDED_SUBSTANTIVE', severity: 'MEDIUM',
        message: 'Afirmação substantiva sem fundamentação RAG (Premissa 15)' 
      });
    }
  }
  
  if (questions >= 2) {
    const questionSentences = response.split('?')
      .filter(s => s.trim().length > 10)
      .map(s => s.trim().toLowerCase());
    
    if (questionSentences.length >= 2) {
      const words1 = new Set(questionSentences[0].split(/\s+/).filter(w => w.length > 3));
      const words2 = new Set(questionSentences[1].split(/\s+/).filter(w => w.length > 3));
      const overlap = [...words1].filter(w => words2.has(w));
      
      if (overlap.length >= 3) {
        issues.push({ 
          code: 'REDUNDANT_QUESTIONS', severity: 'MEDIUM',
          message: `Perguntas redundantes (${overlap.length} palavras em comum)` 
        });
        rewriteInstructions.push(
          'Remova a pergunta mais abstrata. Mantenha apenas a mais concreta/sensorial.'
        );
      }
    }
  }
  
  if (isEarlyPhase) {
    const deepContentRegex = /\b(perd[aã]o|reconcilia[cç][aã]o|restaurar|governo sobre|autoridade sobre|autonomia|transmitir o que|voc[eê] (j[aá] )?(pode|consegue) ensinar)\b/i;
    if (deepContentRegex.test(response)) {
      issues.push({ 
        code: 'PHASE_DEPTH_VIOLATION', severity: 'HIGH',
        message: 'Conteúdo de fase avançada em fase inicial' 
      });
      rewriteInstructions.push(
        'Remova referências a perdão/reconciliação/governo/transmissão. Na fase atual, foque em nomear sentimentos e fazer perguntas sensoriais.'
      );
    }
  }

  // ==========================================
  // CENÁRIOS DE SAFETY EXPANDIDA (IO)
  // ==========================================

  // REGRESSION_INSENSITIVE — resposta menciona regressão de fase em contexto de sofrimento
  const regressionMentionRegex = /\b(voltou de fase|regrediu|fase anterior|retrocedeu|voltou para a fase|regress[aã]o de fase)\b/i;
  if (regressionMentionRegex.test(response)) {
    issues.push({
      code: 'REGRESSION_INSENSITIVE', severity: 'HIGH',
      message: 'Resposta menciona regressão de fase (insensível ao sofrimento)'
    });
    rewriteInstructions.push(
      'NÃO mencione regressão de fase. Substitua por acolhimento: "Não é um recuo. É cuidar do que precisa de atenção agora."'
    );
  }

  // CRISIS_IN_SESSION — crise detectada durante sessão diária
  if (isSessionDaily && ['medium', 'high'].includes(crisisRiskLevel)) {
    const sessionTermsRegex = /\b(miss[aã]o|escala|registro|check-in|checkin|pontua[cç][aã]o|dimens[aã]o|vitalidade|ag[eê]ncia|const[aâ]ncia)\b/i;
    if (sessionTermsRegex.test(response)) {
      issues.push({
        code: 'CRISIS_IN_SESSION', severity: 'CRITICAL',
        message: 'Crise detectada durante sessão diária — sair da sessão'
      });
      rewriteInstructions.push(
        'PARE a sessão diária imediatamente. NÃO mencione missão, escala ou registro. Entre em modo de segurança e acolhimento. Priorize: "Estou aqui com você. Me conta o que está acontecendo."'
      );
    }
  }

  // SESSION_DEPTH_OVERFLOW — profundidade precoce na sessão diária
  if (isSessionDaily && isEarlyPhase) {
    const sessionDepthRegex = /\b(identidade|cren[cç]a[- ]?raiz|padr[aã]o profundo|raiz (do|da|de)|o que isso (diz|revela|mostra) sobre voc[eê]|quem voc[eê] [eé] quando)\b/i;
    if (sessionDepthRegex.test(response)) {
      issues.push({
        code: 'SESSION_DEPTH_OVERFLOW', severity: 'MEDIUM',
        message: 'Profundidade avançada em sessão diária de fase inicial'
      });
      rewriteInstructions.push(
        'Substitua o conteúdo profundo por: "Esse assunto é importante. Vamos explorar isso no chat com mais calma?"'
      );
    }
  }

  // ==========================================
  // POLÍTICA DE DECISÃO
  // ==========================================
  const hasCritical = issues.some(i => i.severity === 'CRITICAL');
  const hasFormat = issues.some(i => i.severity === 'FORMAT');
  const highCount = issues.filter(i => i.severity === 'HIGH').length;
  
  const presenceModeViolation = issues.some(i => 
    ['PRESUMPTION', 'SINTO_QUE_BANNED', 'CAUSALITY_DIAGNOSTIC', 
     'DIAGNOSTIC_ABSOLUTE', 'TOXIC_POSITIVITY', 'REGRESSION_INSENSITIVE'].includes(i.code)
  );
  
  const needsRewrite = hasCritical || hasFormat || highCount >= 2 || presenceModeViolation;
  
  return { valid: issues.length === 0, issues, needsRewrite, rewriteInstructions };
}

// ============================================
// IO REWRITE PROMPT — Phase-aware (Phase 4)
// ============================================

function buildRewritePromptIO(
  response: string, 
  validation: ValidationResult,
  ioPhase: number | null
): string {
  const phase = ioPhase || 1;
  const phaseContext = phase <= 2 
    ? 'O usuário está em FASE INICIAL (Consciência/Limites). Use apenas espelhamento puro e perguntas sensoriais. NÃO diagnostique, NÃO explique, NÃO nomeie padrões.'
    : phase === 3 
    ? 'O usuário está na FASE DE IDENTIDADE. Pode explorar padrões com cuidado, mas sempre como pergunta, nunca como afirmação.'
    : 'O usuário está em FASE AVANÇADA. Pode ser mais direto, mas mantenha espelhamento e perguntas.';

  const hasPresenceViolation = validation.issues.some(i => 
    ['PRESUMPTION', 'SINTO_QUE_BANNED', 'CAUSALITY_DIAGNOSTIC', 
     'DIAGNOSTIC_ABSOLUTE', 'TOXIC_POSITIVITY'].includes(i.code)
  );
  
  const presenceInstructions = hasPresenceViolation ? [
    '',
    'MODO PRESENÇA - Use espelhamento puro:',
    '- Use APENAS as palavras exatas do usuário',
    '- PROIBIDO: "Sinto que", "Fico feliz", "É ótimo que", "Percebo que"',
    '- Em vez de "Sinto que você está carregando algo" → "Você disse que está difícil. O que isso significa para você?"',
    '- Em vez de "É ótimo que você esteja explorando" → "Você está buscando entender isso."',
    '- Faça preferencialmente UMA pergunta sensorial',
  ] : [];
  
  const instructions = [
    `Reescreva a resposta. ${phaseContext}`,
    '',
    '- 3-7 linhas curtas',
    `- ${phase <= 2 ? '1 pergunta sensorial' : '1-2 perguntas curtas'} (NUNCA mais que 2)`,
    '- Sem presunções, diagnósticos ou teorias',
    '',
    ...validation.rewriteInstructions,
    ...presenceInstructions,
  ];
  
  return instructions.join('\n') + `\n\nOriginal: "${response}"\n\nReescreva APENAS o texto final:`;
}

// ============================================
// MINIMAL SAFE RESPONSE (PHASE 2)
// ============================================

const MINIMAL_SAFE_RESPONSE = `Entendo que você está passando por algo importante.

O que você está sentindo neste momento?

Como isso tem afetado seu dia a dia?`;

// ============================================
// EMBEDDING GENERATION
// ============================================

// Semantic embedding via OpenAI (with hash fallback)
async function generateSemanticEmbedding(text: string): Promise<{ embedding: number[], model: string }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.warn("[Embedding] OPENAI_API_KEY not found, falling back to hash");
    return { embedding: await generateSimpleEmbedding(text), model: "simple-hash-v1" };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${errBody}`);
    }
    const data = await res.json();
    console.log("[Embedding] Semantic embedding generated (text-embedding-3-small)");
    return { embedding: data.data[0].embedding, model: "text-embedding-3-small" };
  } catch (err) {
    console.error("[Embedding] OpenAI API failed, falling back to hash:", err);
    return { embedding: await generateSimpleEmbedding(text), model: "simple-hash-v1" };
  }
}

// Hash-based embedding (FALLBACK)
async function generateSimpleEmbedding(text: string): Promise<number[]> {
  const embedding: number[] = [];
  const encoder = new TextEncoder();
  
  for (let i = 0; i < 48; i++) {
    const data = encoder.encode(text + i.toString());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Float32Array(hashBuffer);
    
    for (let j = 0; j < 32 && embedding.length < 1536; j++) {
      const val = (hashArray[j % hashArray.length] || 0) / 2147483647;
      embedding.push(Math.max(-1, Math.min(1, val)));
    }
  }
  
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map(v => v / (magnitude || 1));
}

// ============================================
// SYNONYM MAP FOR SEMANTIC COMPENSATION
// ============================================

const FALLBACK_SYNONYM_MAP: Record<string, string[]> = {
  // Emoções -> Virtudes/Pecados
  'odio': ['ira', 'justiça'],
  'ódio': ['ira', 'justiça'],
  'raiva': ['ira', 'justiça'],
  'tristeza': ['vazio', 'esperança'],
  'triste': ['vazio', 'esperança'],
  'ansiedade': ['medo', 'futuro', 'controle'],
  'ansioso': ['medo', 'futuro', 'controle'],
  'ansiosa': ['medo', 'futuro', 'controle'],
  'medo': ['segurança', 'proteção'],
  'orgulho': ['bondade', 'imagem'],
  'vergonha': ['valor', 'identidade'],
  'culpa': ['perdão', 'metanoia'],
  'culpado': ['perdão', 'metanoia'],
  'culpada': ['perdão', 'metanoia'],
  'desejo': ['falso desejo', 'idolatria'],
  // Comportamentos -> Mecanismos
  'confrontar': ['ira', 'justiça', 'defesa'],
  'controlar': ['controle', 'segurança', 'medo'],
  'fugir': ['fuga', 'medo', 'proteção'],
  'evitar': ['fuga', 'medo', 'proteção'],
  'agradar': ['aprovação', 'rejeição', 'bondade'],
  'perfeito': ['perfeccionismo', 'valor', 'identidade'],
  'perfeita': ['perfeccionismo', 'valor', 'identidade'],
  // Contextos -> Medos Raiz
  'dinheiro': ['miséria', 'segurança', 'provisão'],
  'trabalho': ['miséria', 'valor', 'identidade'],
  'relacionamento': ['rejeição', 'abandono', 'amor'],
  'família': ['rejeição', 'abandono', 'pertencimento'],
  'sozinho': ['abandono', 'rejeição', 'solidão'],
  'sozinha': ['abandono', 'rejeição', 'solidão'],
  // Adicional - Virtudes específicas ZION
  'injustiça': ['justiça', 'ira', 'medo'],
  'abandono': ['rejeição', 'solidão', 'amor'],
  'rejeição': ['abandono', 'valor', 'amor'],
  'fracasso': ['valor', 'identidade', 'miséria'],
  'incapaz': ['valor', 'identidade', 'competência'],
  'impotente': ['controle', 'segurança', 'medo'],
  // Tags de dor do onboarding
  'vício': ['dependência', 'compulsão', 'hábito', 'idolatria', 'desejo'],
  'vicio': ['dependência', 'compulsão', 'hábito', 'idolatria', 'desejo'],
  'propósito': ['sentido', 'vocação', 'missão', 'chamado', 'vazio'],
  'proposito': ['sentido', 'vocação', 'missão', 'chamado', 'vazio'],
  'luto': ['morte', 'perda', 'falecimento', 'saudade', 'vazio'],
  'hábito': ['rotina', 'repetição', 'padrão', 'ciclo', 'vício'],
  'habito': ['rotina', 'repetição', 'padrão', 'ciclo', 'vício'],
  'casamento': ['relacionamento', 'família', 'amor', 'compromisso'],
  'injustica': ['justiça', 'ira', 'raiva', 'medo'],
};

// ============================================
// FALLBACK INTENT GUIDANCE
// ============================================

const FALLBACK_INTENT_GUIDANCE: Record<string, string> = {
  ACOLHIMENTO_IMEDIATO: "A pessoa precisa ser OUVIDA primeiro. Foque em validar sentimentos, fazer perguntas abertas e oferecer presença. Não apresse soluções.",
  DIAGNOSTICO: "Ajude a pessoa a ENTENDER seus padrões. Use a Lógica do Medo: identifique perdas, medos raiz, falsas seguranças. Faça perguntas diagnósticas.",
  METANOIA_CONFRONTO: "A pessoa está pronta para MUDANÇA. Guie processos de perdão, renúncia, confronto consigo mesma. Seja firme mas amoroso.",
  PRATICA_CONSOLIDACAO: "Foque em PASSOS PRÁTICOS: exercícios concretos, rotinas, hábitos. Seja específico e gradual.",
  EXEGESE_DUVIDA_BIBLICA: "Responda com EXEGESE CURTA e aplicada. Use a Bíblia Judaica. Não invente versículos. Se não souber, diga.",
};

// ============================================
// LEXICAL OVERLAP RERANKER (PHASE 0 - HYGIENE + SYNONYM EXPANSION)
// ============================================

function rerankByLexicalOverlap(chunks: ChunkResult[], userMessage: string, synonymMap: Record<string, string[]>): ChunkResult[] {
  // Expand message with synonyms for semantic compensation
  let expandedMessage = userMessage.toLowerCase();
  
  for (const [key, synonyms] of Object.entries(synonymMap)) {
    if (expandedMessage.includes(key)) {
      expandedMessage += ' ' + synonyms.join(' ');
    }
  }
  
  const userKeywords = expandedMessage
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  return chunks.sort((a, b) => {
    const overlapA = userKeywords.filter(kw => a.text.toLowerCase().includes(kw)).length;
    const overlapB = userKeywords.filter(kw => b.text.toLowerCase().includes(kw)).length;
    return overlapB - overlapA;
  });
}

// ============================================
// FETCH SESSION INSIGHTS (OBSERVER INTEGRATION)
// ============================================

const PHASE_ORDER = ["ACOLHIMENTO", "CLARIFICACAO", "PADROES", "RAIZ", "TROCA", "CONSOLIDACAO"];

async function fetchSessionInsights(
  supabase: any, 
  sessionId: string, 
  limit: number = 3
): Promise<SessionContext> {
  const emptyContext: SessionContext = {
    insights: [],
    currentPhase: null,
    phaseConfidence: 0,
    avgScore: 0,
    hasRegression: false,
    activeLie: null,
    targetTruth: null,
    recommendedQuestionType: null,
    totalShifts: 0,
  };

  try {
    const { data: insights, error } = await supabase
      .from("turn_insights")
      .select(`
        phase, phase_confidence, overall_score, 
        next_best_question_type, lie_active, truth_target,
        shift_detected, turn_number
      `)
      .eq("chat_session_id", sessionId)
      .eq("extraction_status", "completed")
      .order("turn_number", { ascending: false })
      .limit(limit);

    if (error || !insights || insights.length === 0) {
      return emptyContext;
    }

    const latest = insights[0];
    const previous = insights[1];
    
    // Detect phase regression
    const hasRegression = previous && latest.phase && previous.phase
      ? PHASE_ORDER.indexOf(latest.phase) < PHASE_ORDER.indexOf(previous.phase)
      : false;

    // Parse lie_active and truth_target (may be JSON strings or objects)
    let activeLie: string | null = null;
    let targetTruth: string | null = null;

    if (latest.lie_active) {
      const lieData = typeof latest.lie_active === 'string' 
        ? JSON.parse(latest.lie_active) 
        : latest.lie_active;
      activeLie = lieData?.text || null;
    }

    if (latest.truth_target) {
      const truthData = typeof latest.truth_target === 'string' 
        ? JSON.parse(latest.truth_target) 
        : latest.truth_target;
      targetTruth = truthData?.text || null;
    }

    return {
      insights: insights as PreviousInsight[],
      currentPhase: latest.phase,
      phaseConfidence: latest.phase_confidence || 0,
      avgScore: insights.reduce((sum: number, i: any) => sum + (i.overall_score || 0), 0) / insights.length,
      hasRegression,
      activeLie,
      targetTruth,
      recommendedQuestionType: latest.next_best_question_type,
      totalShifts: insights.filter((i: any) => i.shift_detected).length,
    };
  } catch (err) {
    console.error("Error fetching session insights:", err);
    return emptyContext;
  }
}

// ============================================
// FEW-SHOT LEARNING FROM CURATED CORRECTIONS (HYBRID: Phase + Intent + Positive/Negative)
// ============================================

// Mapa de descrições completas das violações
const VIOLATION_DESCRIPTIONS: Record<string, string> = {
  PRESUMPTION: "Fez interpretações ou presunções sem perguntar ao usuário",
  IMPURE_MIRRORING: "Espelhou emoções de forma imprecisa ou contaminada",
  MASK_VALIDATION: "Validou comportamentos de defesa ao invés de questionar",
  EXCESS_LENGTH: "Resposta muito longa, perdeu foco e objetividade",
  EXTERNAL_FOCUS: "Focou em aspectos cognitivos/externos ao invés de sensações",
  WEAK_MAIEUTICS: "Perguntas fracas que não aprofundam a reflexão",
  CAUSALITY_DIAGNOSTIC: "Tentou diagnosticar causas ao invés de explorar",
  MISSING_SENSATION: "Não fez pergunta sobre sensações corporais",
  THEORIZATION: "Excesso de teoria/conceitos, pouca prática",
  BIBLICAL_MISUSE: "Uso inadequado de referências bíblicas",
  PREMATURE_TRUTH: "Apresentou verdade antes do usuário estar preparado",
  EMOTIONAL_BYPASS: "Ignorou ou minimizou emoções do usuário",
  ADVICE_GIVING: "Deu conselhos diretos ao invés de perguntas maiêuticas",
  MISSING_EMPATHY: "Faltou validação empática inicial",
  OTHER: "Outra violação não categorizada",
};

interface CuratedCorrectionWithItem {
  id: string;
  status: 'approved' | 'rejected' | 'needs_review';
  adherence_score: number | null;
  corrected_response: string | null;
  violations: { code: string; description?: string }[];
  diagnosis: { 
    symptom?: string;
    distorted_virtue?: string;
    root_fear?: string; 
    security_matrix?: string;
  } | null;
  notes: string | null;
  feedback_dataset_items: {
    user_prompt_text: string;
    assistant_answer_text: string;
    intent: string | null;
    phase: string | null;
  };
}

interface FewShotResult {
  positives: CuratedCorrectionWithItem[];
  negatives: CuratedCorrectionWithItem[];
  refinements: CuratedCorrectionWithItem[];  // needs_review com correção pontual
}

type RelevanceLevel = 'SAME_PHASE_INTENT' | 'SAME_PHASE' | 'SAME_INTENT' | 'GENERAL';

async function fetchRecentCorrections(
  supabase: any,
  currentIntent: string,
  currentPhase: string | null,
  positiveLimit: number = 3,
  negativeLimit: number = 3,
  refinementLimit: number = 2
): Promise<FewShotResult> {
  const result: FewShotResult = { positives: [], negatives: [], refinements: [] };
  
  try {
    // ===============================
    // PARTE 1: EXEMPLOS POSITIVOS (Aprovados com notas)
    // ===============================
    
    // 1A. Buscar aprovados da MESMA FASE + INTENT
    if (currentPhase) {
      const { data: phaseIntentApproved } = await supabase
        .from('curated_corrections')
        .select(`
          id, status, adherence_score, corrected_response, violations, diagnosis, notes,
          feedback_dataset_items!inner(
            user_prompt_text, assistant_answer_text, intent, phase
          )
        `)
        .eq('status', 'approved')
        .eq('include_in_training', true)
        .eq('feedback_dataset_items.phase', currentPhase)
        .eq('feedback_dataset_items.intent', currentIntent)
        .not('notes', 'is', null)
        .order('adherence_score', { ascending: false, nullsFirst: false })
        .order('curated_at', { ascending: false })
        .limit(2);
      
      if (phaseIntentApproved?.length) {
        result.positives.push(...(phaseIntentApproved as CuratedCorrectionWithItem[]));
      }
    }
    
    // 1B. Se precisa mais, buscar aprovados gerais (com notas)
    if (result.positives.length < positiveLimit) {
      const remaining = positiveLimit - result.positives.length;
      const existingIds = result.positives.map(p => p.id);
      
      const { data: generalApproved } = await supabase
        .from('curated_corrections')
        .select(`
          id, status, adherence_score, corrected_response, violations, diagnosis, notes,
          feedback_dataset_items!inner(
            user_prompt_text, assistant_answer_text, intent, phase
          )
        `)
        .eq('status', 'approved')
        .eq('include_in_training', true)
        .not('notes', 'is', null)
        .order('adherence_score', { ascending: false, nullsFirst: false })
        .order('curated_at', { ascending: false })
        .limit(remaining + existingIds.length);
      
      const filtered = ((generalApproved || []) as CuratedCorrectionWithItem[])
        .filter(c => !existingIds.includes(c.id))
        .slice(0, remaining);
      
      result.positives.push(...filtered);
    }
    
    console.log(`Few-shot positives: ${result.positives.length} loaded`);
    
    // ===============================
    // PARTE 2: EXEMPLOS NEGATIVOS (Reprovados com correção)
    // ===============================
    
    // 2A. Buscar reprovados da MESMA FASE + INTENT
    if (currentPhase) {
      const { data: phaseIntentRejected } = await supabase
        .from('curated_corrections')
        .select(`
          id, status, adherence_score, corrected_response, violations, diagnosis, notes,
          feedback_dataset_items!inner(
            user_prompt_text, assistant_answer_text, intent, phase
          )
        `)
        .eq('status', 'rejected')
        .not('corrected_response', 'is', null)
        .eq('include_in_training', true)
        .eq('feedback_dataset_items.phase', currentPhase)
        .eq('feedback_dataset_items.intent', currentIntent)
        .order('adherence_score', { ascending: true, nullsFirst: false })
        .order('curated_at', { ascending: false })
        .limit(2);
      
      if (phaseIntentRejected?.length) {
        result.negatives.push(...(phaseIntentRejected as CuratedCorrectionWithItem[]));
      }
    }
    
    // 2B. Buscar reprovados da MESMA FASE (qualquer intent)
    if (result.negatives.length < negativeLimit && currentPhase) {
      const existingIds = result.negatives.map(n => n.id);
      const remaining = negativeLimit - result.negatives.length;
      
      const { data: phaseRejected } = await supabase
        .from('curated_corrections')
        .select(`
          id, status, adherence_score, corrected_response, violations, diagnosis, notes,
          feedback_dataset_items!inner(
            user_prompt_text, assistant_answer_text, intent, phase
          )
        `)
        .eq('status', 'rejected')
        .not('corrected_response', 'is', null)
        .eq('include_in_training', true)
        .eq('feedback_dataset_items.phase', currentPhase)
        .order('adherence_score', { ascending: true, nullsFirst: false })
        .order('curated_at', { ascending: false })
        .limit(remaining + existingIds.length);
      
      const filtered = ((phaseRejected || []) as CuratedCorrectionWithItem[])
        .filter(c => !existingIds.includes(c.id))
        .slice(0, remaining);
      
      result.negatives.push(...filtered);
    }
    
    // 2C. Buscar reprovados do MESMO INTENT (qualquer fase)
    if (result.negatives.length < negativeLimit) {
      const existingIds = result.negatives.map(n => n.id);
      const remaining = negativeLimit - result.negatives.length;
      
      const { data: intentRejected } = await supabase
        .from('curated_corrections')
        .select(`
          id, status, adherence_score, corrected_response, violations, diagnosis, notes,
          feedback_dataset_items!inner(
            user_prompt_text, assistant_answer_text, intent, phase
          )
        `)
        .eq('status', 'rejected')
        .not('corrected_response', 'is', null)
        .eq('include_in_training', true)
        .eq('feedback_dataset_items.intent', currentIntent)
        .order('adherence_score', { ascending: true, nullsFirst: false })
        .order('curated_at', { ascending: false })
        .limit(remaining + existingIds.length);
      
      const filtered = ((intentRejected || []) as CuratedCorrectionWithItem[])
        .filter(c => !existingIds.includes(c.id))
        .slice(0, remaining);
      
      result.negatives.push(...filtered);
    }
    
    // 2D. Fallback: Gerais
    if (result.negatives.length < negativeLimit) {
      const existingIds = result.negatives.map(n => n.id);
      const remaining = negativeLimit - result.negatives.length;
      
      const { data: generalRejected } = await supabase
        .from('curated_corrections')
        .select(`
          id, status, adherence_score, corrected_response, violations, diagnosis, notes,
          feedback_dataset_items!inner(
            user_prompt_text, assistant_answer_text, intent, phase
          )
        `)
        .eq('status', 'rejected')
        .not('corrected_response', 'is', null)
        .eq('include_in_training', true)
        .order('adherence_score', { ascending: true, nullsFirst: false })
        .order('curated_at', { ascending: false })
        .limit(remaining + existingIds.length);
      
      const filtered = ((generalRejected || []) as CuratedCorrectionWithItem[])
        .filter(c => !existingIds.includes(c.id))
        .slice(0, remaining);
      
      result.negatives.push(...filtered);
    }
    
    console.log(`Few-shot negatives: ${result.negatives.length} loaded`);
    
    // ===============================
    // PARTE 3: EXEMPLOS DE REFINAMENTO (Revisar com correção pontual)
    // ===============================
    
    // 3A. Buscar needs_review da MESMA FASE + INTENT (com correção)
    if (currentPhase && result.refinements.length < refinementLimit) {
      const { data: phaseIntentReview } = await supabase
        .from('curated_corrections')
        .select(`
          id, status, adherence_score, corrected_response, violations, diagnosis, notes,
          feedback_dataset_items!inner(
            user_prompt_text, assistant_answer_text, intent, phase
          )
        `)
        .eq('status', 'needs_review')
        .eq('include_in_training', true)
        .not('corrected_response', 'is', null)
        .eq('feedback_dataset_items.phase', currentPhase)
        .eq('feedback_dataset_items.intent', currentIntent)
        .order('curated_at', { ascending: false })
        .limit(2);
      
      if (phaseIntentReview?.length) {
        result.refinements.push(...(phaseIntentReview as CuratedCorrectionWithItem[]));
      }
    }
    
    // 3B. Buscar needs_review do MESMO INTENT (qualquer fase)
    if (result.refinements.length < refinementLimit) {
      const existingIds = result.refinements.map(r => r.id);
      const remaining = refinementLimit - result.refinements.length;
      
      const { data: intentReview } = await supabase
        .from('curated_corrections')
        .select(`
          id, status, adherence_score, corrected_response, violations, diagnosis, notes,
          feedback_dataset_items!inner(
            user_prompt_text, assistant_answer_text, intent, phase
          )
        `)
        .eq('status', 'needs_review')
        .eq('include_in_training', true)
        .not('corrected_response', 'is', null)
        .eq('feedback_dataset_items.intent', currentIntent)
        .order('curated_at', { ascending: false })
        .limit(remaining + existingIds.length);
      
      const filtered = ((intentReview || []) as CuratedCorrectionWithItem[])
        .filter(c => !existingIds.includes(c.id))
        .slice(0, remaining);
      
      result.refinements.push(...filtered);
    }
    
    // 3C. Fallback: Gerais needs_review
    if (result.refinements.length < refinementLimit) {
      const existingIds = result.refinements.map(r => r.id);
      const remaining = refinementLimit - result.refinements.length;
      
      const { data: generalReview } = await supabase
        .from('curated_corrections')
        .select(`
          id, status, adherence_score, corrected_response, violations, diagnosis, notes,
          feedback_dataset_items!inner(
            user_prompt_text, assistant_answer_text, intent, phase
          )
        `)
        .eq('status', 'needs_review')
        .eq('include_in_training', true)
        .not('corrected_response', 'is', null)
        .order('curated_at', { ascending: false })
        .limit(remaining + existingIds.length);
      
      const filtered = ((generalReview || []) as CuratedCorrectionWithItem[])
        .filter(c => !existingIds.includes(c.id))
        .slice(0, remaining);
      
      result.refinements.push(...filtered);
    }
    
    console.log(`Few-shot refinements: ${result.refinements.length} loaded`);
    console.log(`Few-shot total: ${result.positives.length} positives, ${result.refinements.length} refinements, ${result.negatives.length} negatives (phase: ${currentPhase}, intent: ${currentIntent})`);
    
    return result;
    
  } catch (err) {
    console.error("Exception fetching corrections:", err);
    return { positives: [], negatives: [], refinements: [] };
  }
}

function getRelevanceTag(
  item: CuratedCorrectionWithItem,
  currentIntent: string,
  currentPhase: string | null
): { tag: string; level: RelevanceLevel } {
  const itemIntent = item.feedback_dataset_items.intent;
  const itemPhase = item.feedback_dataset_items.phase;
  
  const matchesPhase = currentPhase && itemPhase === currentPhase;
  const matchesIntent = itemIntent === currentIntent;
  
  if (matchesPhase && matchesIntent) {
    return { tag: '🎯 MESMA FASE + INTENT', level: 'SAME_PHASE_INTENT' };
  } else if (matchesPhase) {
    return { tag: '📍 MESMA FASE', level: 'SAME_PHASE' };
  } else if (matchesIntent) {
    return { tag: '🔀 MESMO INTENT', level: 'SAME_INTENT' };
  }
  return { tag: '📚 EXEMPLO GERAL', level: 'GENERAL' };
}

function buildFewShotBlock(
  positives: CuratedCorrectionWithItem[],
  negatives: CuratedCorrectionWithItem[],
  refinements: CuratedCorrectionWithItem[],
  currentIntent: string,
  currentPhase: string | null
): string {
  if (positives.length === 0 && negatives.length === 0 && refinements.length === 0) return '';
  
  let block = `\n## EXEMPLOS DE REFERÊNCIA (ESTUDE ANTES DE RESPONDER)\n`;
  block += `Fase atual: ${currentPhase || 'N/A'} | Intent: ${currentIntent}\n\n`;
  
  // SEÇÃO POSITIVA
  if (positives.length > 0) {
    block += `### ✅ RESPOSTAS MODELO (siga este padrão)\n\n`;
    
    positives.forEach((c, i) => {
      const { tag } = getRelevanceTag(c, currentIntent, currentPhase);
      const notes = c.notes || '';
      
      block += `#### Exemplo Positivo ${i + 1} (${tag})
CONTEXTO: Fase = ${c.feedback_dataset_items.phase || 'N/A'}, Intent = ${c.feedback_dataset_items.intent || 'N/A'}
USUÁRIO: "${c.feedback_dataset_items.user_prompt_text.substring(0, 200)}${c.feedback_dataset_items.user_prompt_text.length > 200 ? '...' : ''}"

🌟 RESPOSTA IDEAL:
"${c.feedback_dataset_items.assistant_answer_text.substring(0, 400)}${c.feedback_dataset_items.assistant_answer_text.length > 400 ? '...' : ''}"

📝 POR QUE FUNCIONA: ${notes.substring(0, 200)}${notes.length > 200 ? '...' : ''}

---

`;
    });
  }
  
  // SEÇÃO DE REFINAMENTO (entre positivos e negativos)
  if (refinements.length > 0) {
    block += `### 🔧 AJUSTES FINOS (quase certo, mas precisa de refinamento)\n\n`;
    
    refinements.forEach((c, i) => {
      const { tag } = getRelevanceTag(c, currentIntent, currentPhase);
      const notes = c.notes || 'Ver diferenças entre original e ajuste';
      
      block += `#### Refinamento ${i + 1} (${tag})
CONTEXTO: Fase = ${c.feedback_dataset_items.phase || 'N/A'}, Intent = ${c.feedback_dataset_items.intent || 'N/A'}
USUÁRIO: "${c.feedback_dataset_items.user_prompt_text.substring(0, 200)}${c.feedback_dataset_items.user_prompt_text.length > 200 ? '...' : ''}"

🟡 RESPOSTA ORIGINAL (quase correta):
"${c.feedback_dataset_items.assistant_answer_text.substring(0, 300)}${c.feedback_dataset_items.assistant_answer_text.length > 300 ? '...' : ''}"

✨ AJUSTE NECESSÁRIO:
"${(c.corrected_response || '').substring(0, 400)}${(c.corrected_response || '').length > 400 ? '...' : ''}"

📝 O QUE AJUSTAR: ${notes.substring(0, 200)}${notes.length > 200 ? '...' : ''}

---

`;
    });
  }
  
  // SEÇÃO NEGATIVA
  if (negatives.length > 0) {
    block += `### ❌ ERROS A EVITAR (aprenda com estes)\n\n`;
    
    negatives.forEach((c, i) => {
      const { tag } = getRelevanceTag(c, currentIntent, currentPhase);
      
      // Violações com descrição completa
      const violationsList = c.violations?.map(v => {
        const desc = v.description || VIOLATION_DESCRIPTIONS[v.code] || v.code;
        return `  - ${v.code}: ${desc}`;
      }).join('\n') || '  - Nenhuma';
      
      // Diagnóstico expandido
      const symptom = c.diagnosis?.symptom || 'N/A';
      const distortedVirtue = c.diagnosis?.distorted_virtue || 'N/A';
      const rootFear = c.diagnosis?.root_fear || 'N/A';
      const matrix = c.diagnosis?.security_matrix || 'N/A';
      const adherence = c.adherence_score !== null ? `${c.adherence_score}%` : 'N/A';
      
      block += `#### Erro ${i + 1} (${tag}) — Aderência: ${adherence}
CONTEXTO: Fase = ${c.feedback_dataset_items.phase || 'N/A'}, Intent = ${c.feedback_dataset_items.intent || 'N/A'}
USUÁRIO: "${c.feedback_dataset_items.user_prompt_text.substring(0, 200)}${c.feedback_dataset_items.user_prompt_text.length > 200 ? '...' : ''}"

❌ RESPOSTA INCORRETA:
"${c.feedback_dataset_items.assistant_answer_text.substring(0, 300)}${c.feedback_dataset_items.assistant_answer_text.length > 300 ? '...' : ''}"

VIOLAÇÕES DETECTADAS:
${violationsList}

DIAGNÓSTICO:
- Sintoma observado: ${symptom}
- Virtude distorcida: ${distortedVirtue}
- Medo raiz: ${rootFear}
- Matriz de segurança: ${matrix}

✅ RESPOSTA CORRIGIDA:
"${(c.corrected_response || '').substring(0, 400)}${(c.corrected_response || '').length > 400 ? '...' : ''}"

---

`;
    });
  }
  
  block += `⚠️ ESTUDOU OS EXEMPLOS ACIMA? Agora responda seguindo o padrão dos exemplos positivos, aplicando os ajustes finos, e evitando os erros listados.\n`;
  
  return block;
}

// ============================================
// IO PHASE ORIENTATION (7 PHASES)
// ============================================

function getIOPhaseOrientation(phase: number): string {
  const orientations: Record<number, string> = {
    1: `FUNÇÃO: Sair da confusão para clareza.
PROFUNDIDADE PERMITIDA: Baixa. Nomear sentimentos, não confrontar.
TEOLOGIA: Não protagonista. Apenas se o usuário pedir explicitamente.
PERGUNTAS RECOMENDADAS:
  - Sensoriais: "Onde no corpo você sente isso?", "Como é essa sensação?"
  - De nomeação: "O que você está sentindo?", "Que nome você daria a isso?"
  - De repetição: "Isso já aconteceu antes?", "O que se repete?"
  PREFIRA perguntas sensoriais e de nomeação. EVITE perguntas de identidade.
COMPORTAMENTO PROIBIDO:
  - Diagnosticar raiz
  - Confrontar padrão
  - Sugerir metanoia
  - Nomear medo
  - Usar termos técnicos (eneagrama, DISC, ciclo da idolatria)
  - Perguntas de identidade como "O que isso diz sobre você?", "O que isso revela de você?", "Quem você é quando sente isso?" (essas perguntas são da Fase 3, não da Fase 1)
REFORÇO IDENTITÁRIO: "Você está aprendendo a perceber."
FOCO: Segurança psicológica. O usuário precisa se sentir ouvido antes de tudo. Perguntas devem acessar SENSAÇÃO e NOMEAÇÃO, não IDENTIDADE.`,

    2: `FUNÇÃO: Separar o que está misturado — fato de interpretação, meu de alheio.
PROFUNDIDADE PERMITIDA: Moderada-baixa. Pode explorar padrões superficiais, não raízes.
TEOLOGIA: Mínima. Princípios universais de sabedoria, não doutrina.
PERGUNTAS RECOMENDADAS: "Isso é fato ou interpretação?", "De quem é essa responsabilidade?", "O que seria diferente se você separasse o que é seu do que é do outro?"
COMPORTAMENTO PROIBIDO: Diagnóstico profundo, nomear medo raiz, confrontar diretamente.
REFORÇO IDENTITÁRIO: "Você está separando com clareza."
FOCO: Regulação emocional. Ajudar a pessoa a pensar com mais nitidez.`,

    3: `FUNÇÃO: Revelar padrões e crenças-raiz que governam o comportamento.
PROFUNDIDADE PERMITIDA: Alta. Pode explorar padrões, crenças, medos fundamentais.
TEOLOGIA: Contextual — pode usar quando o usuário demonstra abertura.
PERGUNTAS RECOMENDADAS: "Que frase você repete sobre si mesmo?", "Quando foi a primeira vez que acreditou nisso?", "O que seu comportamento está tentando proteger?"
COMPORTAMENTO PROIBIDO: Forçar revelação prematura, dar respostas em vez de perguntas.
REFORÇO IDENTITÁRIO: "Você está descobrindo quem realmente é."
FOCO: Identidade verdadeira vs. identidade construída pelo medo.`,

    4: `FUNÇÃO: Consolidar verdade com constância — transformar insight em hábito.
PROFUNDIDADE PERMITIDA: Alta. Pode referenciar padrões já identificados.
TEOLOGIA: Integrada — pode usar narrativas bíblicas como espelho.
PERGUNTAS RECOMENDADAS: "O que você praticou hoje?", "O que foi diferente quando você agiu com consciência?", "Onde o padrão antigo tentou voltar?"
COMPORTAMENTO PROIBIDO: Reabrir feridas já trabalhadas sem motivo, ser complacente com falta de prática.
REFORÇO IDENTITÁRIO: "Você está construindo constância."
FOCO: Ritmo e repetição. Celebrar pequenas vitórias.`,

    5: `FUNÇÃO: Restaurar vínculo e reparar danos — olhar para fora.
PROFUNDIDADE PERMITIDA: Alta. Pode explorar relações, perdão, reconciliação.
TEOLOGIA: Natural — versículos sobre restauração, perdão, vínculo.
PERGUNTAS RECOMENDADAS: "Quem você precisa honrar?", "O que precisa ser dito que nunca foi?", "Como seria restaurar esse vínculo?"
COMPORTAMENTO PROIBIDO: Forçar perdão, minimizar dor relacional, ser superficial.
REFORÇO IDENTITÁRIO: "Você está restaurando vida."
FOCO: Vitalidade relacional. Coragem para reparar.`,

    6: `FUNÇÃO: Assumir autoridade sobre a própria vida — planejar e agir.
PROFUNDIDADE PERMITIDA: Máxima. Pode desafiar e confrontar com amor.
TEOLOGIA: Protagonista — pode usar chamado, propósito, vocação.
PERGUNTAS RECOMENDADAS: "Em quais áreas você está assumindo governo?", "O que está faltando no seu plano?", "Qual é a próxima ação concreta?"
COMPORTAMENTO PROIBIDO: Passividade, aceitar inércia sem confrontar gentilmente.
REFORÇO IDENTITÁRIO: "Você está assumindo governo."
FOCO: Agência. Transformar consciência em responsabilidade.`,

    7: `FUNÇÃO: Integração, gratidão, transmissão e autonomia sustentada.
PROFUNDIDADE PERMITIDA: Máxima com leveza. Celebrar, integrar, transmitir.
TEOLOGIA: Plena — pode usar livremente com profundidade.
PERGUNTAS RECOMENDADAS: "O que mudou em você?", "O que você pode transmitir?", "Como manter o que construiu?"
COMPORTAMENTO PROIBIDO: Criar dependência, infantilizar, não reconhecer autonomia.
REFORÇO IDENTITÁRIO: "Você sustenta o que construiu."
FOCO: Autonomia. O usuário é o protagonista, não mais o mentor.`
  };

  return orientations[phase] || orientations[1];
}

// ============================================
// IO PROMPT ADAPTER — buildIOSystemPrompt
// ============================================

function buildIOSystemPrompt(config: {
  fewShotBlock: string;
  baseIdentity: string;
  constitutionInstructions: string;
  customInstructions: string;
  chunks: ChunkResult[];
  lowConfidence: boolean;
  intent: string;
  intentGuidance: Record<string, string>;
  userContext: UserContext;
  sessionContext: SessionContext;
  ioPhase: any;
  diaryContext: string;
  crisisRiskLevel: string;
  historySummary: string;
}): string {
  let prompt = '';

  // ==========================================
  // BLOCO 1: FEW-SHOT (sem mudança)
  // ==========================================
  if (config.fewShotBlock) {
    prompt += config.fewShotBlock;
  }

  // ==========================================
  // BLOCO 2: IDENTITY_TONE
  // ==========================================
  prompt += `
## IDENTIDADE E TOM (Zyon)

Você é Zyon, mentor espiritual da plataforma ZION. Sua missão é acolher pessoas em busca de cura interior.

### ACOLHIMENTO PRIMEIRO
- Sempre valide os sentimentos antes de orientar
- Use tom caloroso, mas IMPARCIAL. Seja um ESPELHO LIMPO.
- Pergunte mais, conclua menos (pelo menos no início)

### ESPELHAMENTO PURO (REGRA ABSOLUTA)
- Use APENAS as palavras EXATAS que o usuário disse
- PROIBIDO adicionar palavras, intensificadores ou interpretações que o usuário NÃO usou
- ERRADO: Usuário diz "ansiedade" → você responde "ansiedade paralisante" (ele não disse "paralisante")
- ERRADO: Usuário diz "não sei o que fazer" → você responde "pode ser muito difícil" (ele não disse "difícil")
- CERTO: Usuário diz "ansiedade" → você responde "Você diz que está com ansiedade"
- CERTO: Usuário diz "não sei o que fazer" → você responde "Você sente que não sabe o que fazer"

### TERMOS BANIDOS (NUNCA use em nenhuma circunstância)
- "Sinto que...", "Sinto a sua...", "Sinto a ansiedade...", "Sinto o peso..." — QUALQUER frase começando com "Sinto" referindo-se ao usuário é PROIBIDA
- "Fico feliz em...", "Fico feliz que...", "É ótimo que...", "Que bom que...", "Parabéns por..." — positividade protocolar é PROIBIDA
- "Isso mostra que...", "Isso revela que...", "Isso aponta para..." — diagnóstico causal é PROIBIDO
- Se você gerou alguma dessas frases, DELETE e substitua por espelhamento puro + pergunta

### REGRA DE UMA PERGUNTA
- Faça preferencialmente UMA pergunta por resposta
- Se fizer duas, a segunda deve ser uma ALTERNATIVA (sensorial), não uma repetição
- ERRADO: "O que te impede? O que você sente que aconteceria?" (duas perguntas sobre o mesmo tema)
- CERTO: "O que te impede de dar esse passo?" (uma pergunta suficiente)
- Se gerar duas perguntas, DELETE a mais abstrata e mantenha a mais concreta/sensorial

### ESTRUTURA DAS RESPOSTAS
1) Acolhimento: Validar o que a pessoa sente (usando espelhamento puro)
2) Investigação Silenciosa: Formule perguntas (NUNCA exponha a hipótese)
3) Perguntas: UMA pergunta curta (NUNCA mais que 2)
4) Passos práticos: Quando apropriado

### REFERÊNCIAS BÍBLICAS
- Use a Bíblia Judaica/Hebraica como base
- Exegese curta e aplicada, não devocional superficial
- NUNCA invente versículos

### HONESTIDADE EPISTÊMICA
- Diga "não sei" quando não souber
- Ofereça hipóteses, não certezas

### LIMITE PROFISSIONAL
- Não substitua terapia ou tratamento médico
- Para risco de crise: CVV 188, SAMU 192

### PRIVACIDADE
- Nunca mencione diretamente informações do diário ou perfil
- Use o contexto de forma natural e discreta

Responda sempre em português brasileiro, com empatia genuína.
`;

  // ==========================================
  // BLOCO 3: IO_PHASE_CONTEXT (NOVO)
  // ==========================================
  if (config.ioPhase) {
    const phaseOrientations = getIOPhaseOrientation(config.ioPhase.current_phase);
    
    const enteredDate = config.ioPhase.phase_entered_at 
      ? new Date(config.ioPhase.phase_entered_at).toLocaleDateString('pt-BR')
      : 'recente';

    prompt += `
## FASE OFICIAL IO: ${config.ioPhase.current_phase} — ${config.ioPhase.phase_name} (desde ${enteredDate})

${phaseOrientations}

IGI atual: ${config.ioPhase.igi_current || 0}/10
Streak: ${config.ioPhase.streak_current || 0} dias

IMPORTANTE: Esta é a fase OFICIAL do usuário, determinada por critérios 
objetivos. NÃO trate o usuário como se estivesse em outra fase, mesmo 
que a conversa pareça mais avançada. A fase oficial determina a 
PROFUNDIDADE MÁXIMA permitida da resposta.
`;
  }

  // ==========================================
  // BLOCO 4: IDENTITY_METHOD_LEGACY
  // ==========================================
  prompt += `
## MOTOR DIAGNÓSTICO SILENCIOSO (Uso INTERNO — NÃO exponha ao usuário)

A jornada humana segue o ciclo: PERDA → MEDO → INSEGURANÇA → FALSO DESEJO → MECANISMO DE DEFESA

USE INTERNAMENTE para formular perguntas:
- Identifique a PERDA original
- Ilumine o MEDO RAIZ por trás dos sintomas
- Revele a FALSA SEGURANÇA que ela construiu

REGRAS ABSOLUTAS:
- Modo Espelho: Use APENAS as palavras exatas do usuário para validar
- Diagnóstico Silencioso: Cruze o relato internamente — NUNCA exponha
- PROIBIDO: "Isso acontece porque...", "Talvez seja...", "A sua busca por..."
- O usuário deve DESCOBRIR o nome do próprio medo. Dê a PERGUNTA, não o nome.
- NÃO valide a máscara: se o usuário justifica ataque como "ensino" ou "justiça", 
  NÃO concorde. ESPELHE e PERGUNTE sobre o sentimento interno.

### PERSISTÊNCIA TEMÁTICA (FIO DE OURO)
Se o usuário revelou uma dor raiz, esta é a ÂNCORA da sessão. 
Se mudar de assunto, CONECTE o novo assunto à âncora.

### PROTOCOLO DE BLOQUEIO ("EU NÃO SEI")
Se travado: PARE perguntas abertas. Use perguntas DIRECIONADAS:
- Sensações corporais
- Memórias anteriores
- Função da defesa

### DETECÇÃO DE MENTIRAS
Mapeie INTERNAMENTE: Ferida → Mentira → Defesa
Use para formular perguntas. NUNCA nomeie diretamente.
`;

  // ==========================================
  // BLOCO 5: MODOS DE RESPOSTA (NOVO)
  // ==========================================
  prompt += `
## MODOS DE RESPOSTA

MODO ACOLHIMENTO (padrão nos primeiros turnos e quando sem fundamentação):
- Espelhe usando as palavras EXATAS do usuário
- Faça 1 pergunta curta e aberta (máximo 2 em casos excepcionais)
- NÃO afirme nada sobre medo, crença, padrão ou virtude

MODO SUBSTANTIVO (apenas quando há conteúdo da Base de Conhecimento):
- Use o conteúdo recuperado como fundamento
- Monte a resposta com suas palavras, ancorada no conhecimento
- Continue fazendo perguntas para que o USUÁRIO descubra
- NÃO exponha o diagnóstico — guie pela pergunta

REGRA: Na dúvida entre os dois modos, escolha ACOLHIMENTO.
`;

  // ==========================================
  // BLOCO 6: HIERARQUIA DE CONTEXTO (NOVO)
  // ==========================================
  prompt += `
## HIERARQUIA DE CONTEXTO

Em caso de conflito entre fontes, obedeça esta ordem:
1. SAFETY (crise, risco, luto) — sempre prevalece
2. FASE IO OFICIAL — determina profundidade e comportamento permitido
3. CONTEXTO DE SESSÃO — microestado do turno (observer)
4. MEMÓRIA LONGITUDINAL — diary, perfil, memory_items
5. BASE DE CONHECIMENTO — fundamentação substantiva
6. FEW-SHOT — calibração de tom e formato
7. ORIENTAÇÃO POR INTENT — foco sugerido
`;

  // ==========================================
  // BLOCO 7: CONSTITUIÇÃO (sem mudança)
  // ==========================================
  if (config.constitutionInstructions) {
    prompt += `\n\n## CONSTITUIÇÃO ZION (SEMPRE APLICAR)\n${config.constitutionInstructions}`;
  }

  // ==========================================
  // BLOCO 8: INSTRUÇÕES CUSTOMIZADAS (sem mudança)
  // ==========================================
  if (config.customInstructions) {
    prompt += `\n\n## INSTRUÇÕES ADICIONAIS\n${config.customInstructions}`;
  }

  // ==========================================
  // BLOCO 9: RAG FOUNDATION SLOT (NOVO)
  // ==========================================
  if (config.chunks.length > 0) {
    let chunksText;
    
    if (config.lowConfidence) {
      chunksText = config.chunks.map((c, i) => {
        const preview = c.text.substring(0, 200);
        return `### Pista ${i + 1} [${c.layer}]\n${preview}...`;
      }).join("\n\n");
      
      prompt += `\n\n## FUNDAMENTAÇÃO (BAIXA CONFIANÇA — USE COMO PISTAS)
ATENÇÃO: Estes trechos podem não ser diretamente relevantes.
- PERGUNTE MAIS, afirme menos
- Use como PISTAS, não como base para conclusões
${chunksText}`;
    } else {
      chunksText = config.chunks.map((c, i) => {
        const path = c.section_path?.join(" > ") || "";
        return `### Ref ${i + 1} [${c.layer}/${c.domain}]${path ? ` - ${path}` : ""}\n${c.text}`;
      }).join("\n\n---\n\n");

      prompt += `\n\n## FUNDAMENTAÇÃO DA BASE DE CONHECIMENTO ZION
Use as seguintes referências para fundamentar suas respostas:

${chunksText}

REGRA (Premissa 15): Quando você afirmar algo sobre medo, crença, padrão, 
virtude, cenário ou caminho de transformação, esse conteúdo DEVE estar 
ancorado no conhecimento acima. Se não houver conteúdo relevante, permaneça 
no MODO ACOLHIMENTO e NÃO invente conteúdo substantivo.`;
    }
  } else {
    prompt += `\n\n## FUNDAMENTAÇÃO
Nenhum conteúdo da Base de Conhecimento foi recuperado para esta mensagem.

REGRA: Permaneça no MODO ACOLHIMENTO. Espelhe e pergunte. 
NÃO faça afirmações substantivas sobre medo, crença ou padrão.`;
  }

  // ==========================================
  // BLOCO 10: ORIENTAÇÃO POR INTENT (sem mudança)
  // ==========================================
  if (config.intentGuidance[config.intent]) {
    prompt += `\n\n## FOCO DESTA CONVERSA\n${config.intentGuidance[config.intent]}`;
  }

  // ==========================================
  // BLOCO 11: SESSION_CONTEXT COM LABEL (modificado)
  // ==========================================
  if (config.sessionContext.currentPhase) {
    let insightsBlock = `\n\n## MICROESTADO DO TURNO (leitura do observer — NÃO é a fase oficial)`;
    insightsBlock += `\nFase inferida pelo observer: ${config.sessionContext.currentPhase} (confiança: ${(config.sessionContext.phaseConfidence * 100).toFixed(0)}%)`;
    
    if (config.ioPhase) {
      insightsBlock += `\n(Lembre: a FASE OFICIAL IO é ${config.ioPhase.current_phase} — ${config.ioPhase.phase_name}. O microestado acima é apenas contexto do turno.)`;
    }
    
    insightsBlock += `\nQualidade média: ${config.sessionContext.avgScore.toFixed(1)}/5`;
    
    if (config.sessionContext.recommendedQuestionType) {
      insightsBlock += `\nPergunta recomendada: ${config.sessionContext.recommendedQuestionType}`;
    }
    
    if (config.sessionContext.activeLie) {
      insightsBlock += `\nMentira ativa (uso interno): "${config.sessionContext.activeLie}"`;
      insightsBlock += `\n(ÂNCORA da sessão. Conecte novos assuntos a ela via PERGUNTAS)`;
    }
    
    if (config.sessionContext.targetTruth) {
      insightsBlock += `\nVerdade alvo: "${config.sessionContext.targetTruth}" (NÃO apresente — deixe o usuário DESCOBRIR)`;
    }
    
    if (config.sessionContext.hasRegression) {
      insightsBlock += `\n\n⚠️ REGRESSÃO DETECTADA: Retorne ao acolhimento. NÃO force avanço.`;
    }
    
    prompt += insightsBlock;
  }

  // ==========================================
  // BLOCO 12: USER_CONTEXT (sem mudança)
  // ==========================================
  if (config.diaryContext) {
    prompt += config.diaryContext;
  }

  // ==========================================
  // BLOCO 13: CRISIS (sem mudança)
  // ==========================================
  if (config.crisisRiskLevel === "medium") {
    prompt += `\n\n## ATENÇÃO: RISCO MÉDIO DETECTADO\nSeja especialmente acolhedor. Mencione CVV 188 se apropriado.`;
  }

  // ==========================================
  // BLOCO 14: HISTORY SUMMARY (sem mudança)
  // ==========================================
  if (config.historySummary) {
    prompt += config.historySummary;
  }

  return prompt;
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { message, history = [], userId, sessionId, isAdmin = false } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("=== ZYON CHAT PIPELINE START ===");
    console.log("Message:", message.substring(0, 80) + "...");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = supabaseUrl && supabaseServiceKey 
      ? createClient(supabaseUrl, supabaseServiceKey) 
      : null;

    // ========================================
    // PROMPT BLOCKS: Fetch from database with fallback
    // ========================================
    let promptBlocks: Array<{key: string; content: string; category: string}> | null = null;
    if (supabase) {
      try {
        const { data } = await supabase
          .from('ai_prompt_blocks')
          .select('key, content, category')
          .eq('is_active', true);
        promptBlocks = data;
        console.log("Prompt blocks loaded:", promptBlocks?.length || 0);
      } catch (err) {
        console.error("Failed to load prompt blocks, using fallbacks:", err);
      }
    }

    const getBlock = (key: string): string => {
      return promptBlocks?.find(b => b.key === key)?.content || '';
    };

    // Resolve dynamic variables with fallback
    const BASE_IDENTITY = getBlock('BASE_IDENTITY') || FALLBACK_BASE_IDENTITY;

    let AVATAR_EMOTIONAL_CONTEXT = FALLBACK_AVATAR_CONTEXT;
    try {
      const raw = getBlock('AVATAR_EMOTIONAL_CONTEXT');
      if (raw) AVATAR_EMOTIONAL_CONTEXT = JSON.parse(raw);
    } catch { /* fallback */ }

    let SYNONYM_MAP = FALLBACK_SYNONYM_MAP;
    try {
      const raw = getBlock('SYNONYM_MAP');
      if (raw) SYNONYM_MAP = JSON.parse(raw);
    } catch { /* fallback */ }

    let intentGuidance: Record<string, string> = FALLBACK_INTENT_GUIDANCE;
    try {
      const raw = getBlock('INTENT_GUIDANCE');
      if (raw) intentGuidance = JSON.parse(raw);
    } catch { /* fallback */ }

    // CRISIS KEYWORDS — texto plano, uma keyword por linha (NÃO JSON)
    const parseKeywordLines = (text: string): string[] =>
      text.split('\n').map(l => l.trim()).filter(Boolean);

    const crisisHighRaw = getBlock('CRISIS_KEYWORDS_HIGH');
    const crisisMediumRaw = getBlock('CRISIS_KEYWORDS_MEDIUM');
    const crisisLowRaw = getBlock('CRISIS_KEYWORDS_LOW');

    const CRISIS_KEYWORDS = {
      high: crisisHighRaw ? parseKeywordLines(crisisHighRaw) : FALLBACK_CRISIS_KEYWORDS.high,
      medium: crisisMediumRaw ? parseKeywordLines(crisisMediumRaw) : FALLBACK_CRISIS_KEYWORDS.medium,
      low: crisisLowRaw ? parseKeywordLines(crisisLowRaw) : FALLBACK_CRISIS_KEYWORDS.low,
    };

    // Get embedding config - resolve at runtime based on feature flag
    let useSemanticEmbedding = false;
    try {
      const { data: ragFlag } = await supabase.rpc('get_feature_flag', {
        p_flag_name: 'io_rag_domains_enabled',
        p_user_id: userId || null
      });
      useSemanticEmbedding = ragFlag === true;
    } catch (err) {
      console.warn("[Embedding] Feature flag check failed, using hash:", err);
    }
    const currentEmbeddingType = useSemanticEmbedding ? 'semantic-real' : 'simple-hash-v1';
    const embeddingConfig = EMBEDDING_CONFIG[currentEmbeddingType];
    console.log(`[Embedding] Mode: ${currentEmbeddingType} (flag io_rag_domains_enabled=${useSemanticEmbedding})`);

    // ========================================
    // STEP 1: CRISIS DETECTION (Priority Zero)
    // ========================================
    console.log("Step 1: Crisis Detection");
    const crisisResult = detectCrisis(message, CRISIS_KEYWORDS);
    
    if (crisisResult.should_bypass_rag) {
      console.log("⚠️ HIGH RISK DETECTED - Bypassing RAG");
      
      // Log crisis event
      if (supabase && sessionId) {
        const { error: crisisLogError } = await supabase.from("crisis_events").insert({
          session_id: sessionId,
          user_id: userId || null,
          risk_level: crisisResult.risk_level,
          keywords_matched: crisisResult.keywords_matched,
          crisis_response_sent: crisisResult.crisis_response,
        });
        if (crisisLogError) console.error("Failed to log crisis event:", crisisLogError);
      }

      return new Response(
        JSON.stringify({
          response: crisisResult.crisis_response,
          crisis: {
            is_crisis: true,
            contacts: { cvv: "188", samu: "192" },
          },
          debug: isAdmin ? {
            intent: "CRISIS",
            role: "BUSCADOR",
            risk_level: crisisResult.risk_level,
            chunk_ids: [],
            rag_plan: { includeConstitution: false, layers: [], topK: 0, filters: {} },
            latency_ms: Date.now() - startTime,
          } : undefined,
        } as ZyonResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // STEP 2: INTENT ROUTING + USER CONTEXT + OBSERVER INSIGHTS
    // ========================================
    console.log("Step 2: Intent Routing + User Context + Observer Insights");
    const { intent, confidence } = classifyIntent(message);
    // ragPlan will be built after ioPhaseContext is loaded (Step 2.5)
    const userContext = detectUserContext(message, history);
    const turnCount = history.filter((h: { role: string }) => h.role === 'user').length + 1;
    
    // NEW: Fetch session insights from Observer
    let sessionContext: SessionContext = {
      insights: [],
      currentPhase: null,
      phaseConfidence: 0,
      avgScore: 0,
      hasRegression: false,
      activeLie: null,
      targetTruth: null,
      recommendedQuestionType: null,
      totalShifts: 0,
    };

    if (supabase && sessionId) {
      sessionContext = await fetchSessionInsights(supabase, sessionId, 3);
      if (sessionContext.currentPhase) {
        console.log("Session context loaded:", {
          phase: sessionContext.currentPhase,
          avgScore: sessionContext.avgScore.toFixed(2),
          hasRegression: sessionContext.hasRegression,
          recommendedQuestion: sessionContext.recommendedQuestionType,
        });
      }
    }
    
    console.log("Intent:", intent, "Confidence:", confidence);
    console.log("User context:", JSON.stringify(userContext));

    // ========================================
    // STEP 2.5: IO PHASE (if enabled)
    // ========================================
    let ioPhaseContext: any = null;
    let isPromptAdapterEnabled = false;

    if (supabase) {
      try {
        const { data: promptAdapterFlag } = await supabase.rpc('get_feature_flag', {
          p_flag_name: 'io_prompt_adapter_enabled',
          p_user_id: userId || null
        });
        isPromptAdapterEnabled = promptAdapterFlag === true;
        console.log("io_prompt_adapter_enabled:", isPromptAdapterEnabled);
      } catch (flagErr) {
        console.error("Failed to check io_prompt_adapter_enabled flag:", flagErr);
      }

      if (isPromptAdapterEnabled && userId) {
        try {
          const { data: ioPhase } = await supabase
            .from('io_user_phase')
            .select('current_phase, phase_name, igi_current, streak_current, phase_entered_at, phase_criteria_met')
            .eq('user_id', userId)
            .single();

          if (ioPhase) {
            ioPhaseContext = ioPhase;
            console.log("IO Phase loaded:", ioPhase.phase_name, "(Phase", ioPhase.current_phase, ")");
          }
        } catch (phaseErr) {
          console.error("Failed to fetch IO phase:", phaseErr);
        }
      }
    }

    // Build RAG plan (after ioPhaseContext is available)
    const ragPlan = (useSemanticEmbedding && ioPhaseContext?.current_phase)
      ? buildIORAGPlan(intent, ioPhaseContext.current_phase)
      : buildRAGPlan(intent);
    const ragPlanType = (useSemanticEmbedding && ioPhaseContext?.current_phase) ? 'io' : 'legacy';
    console.log(`[RAG Plan] Type: ${ragPlanType}, domains: ${ragPlan.filters.domains?.join(', ') || 'none'}, topK: ${ragPlan.topK}`);

    // ========================================
    // STEP 3-4: RAG RETRIEVAL (WITH ADAPTIVE THRESHOLD)
    // ========================================
    console.log("Step 3-4: RAG Retrieval (Adaptive Threshold)");
    let chunks: ChunkResult[] = [];
    let lowConfidence = false;
    let constitutionInstructions = "";
    let customInstructions = "";
    let diaryContext = "";
    let userProfile: any = null;  // Declared at higher scope for spiritualMaturity access

    if (supabase) {
      // Fetch pinned constitution (always)
      if (ragPlan.includeConstitution) {
        try {
          const { data: pinnedInstr } = await supabase
            .from("system_instructions")
            .select("name, content")
            .eq("is_pinned", true)
            .eq("is_active", true);

          if (pinnedInstr && pinnedInstr.length > 0) {
            constitutionInstructions = pinnedInstr.map(i => 
              `## ${i.name}\n${i.content}`
            ).join("\n\n");
            console.log("Constitution loaded:", pinnedInstr.length, "items");
          }
        } catch (err) {
          console.error("Error fetching constitution:", err);
        }
      }

      // Fetch active system instructions (non-pinned)
      try {
        const { data: instructions } = await supabase
          .from("system_instructions")
          .select("name, content")
          .eq("is_active", true)
          .eq("is_pinned", false)
          .order("priority", { ascending: true });

        if (instructions && instructions.length > 0) {
          customInstructions = instructions.map(i => 
            `## ${i.name}\n${i.content}`
          ).join("\n\n");
          console.log("Custom instructions loaded:", instructions.length);
        }
      } catch (err) {
        console.error("Error fetching instructions:", err);
      }

      // Vector search for chunks (PHASE 0: Adaptive threshold + fallback)
      if (ragPlan.topK > 0) {
        try {
          const queryEmbedding = useSemanticEmbedding
            ? (await generateSemanticEmbedding(message)).embedding
            : await generateSimpleEmbedding(message);
          
          // Build filter for layers
          const filterLayer = ragPlan.layers.length === 1 ? ragPlan.layers[0] : null;
          const filterDomain = ragPlan.filters.domains?.length === 1 
            ? ragPlan.filters.domains[0] 
            : null;

          // First attempt with configured threshold
          console.log(`RAG Search: threshold=${embeddingConfig.threshold}, topK=${ragPlan.topK}`);
          const { data: searchResults, error: searchError } = await supabase.rpc("search_chunks", {
            query_embedding: queryEmbedding,
            match_threshold: embeddingConfig.threshold,
            match_count: ragPlan.topK,
            filter_layer: filterLayer,
            filter_domain: filterDomain,
          });

          if (!searchError && searchResults && searchResults.length > 0) {
            // Additional filtering for multiple domains
            chunks = searchResults.filter((c: ChunkResult) => {
              if (ragPlan.filters.domains && ragPlan.filters.domains.length > 1) {
                return ragPlan.filters.domains.includes(c.domain);
              }
              if (ragPlan.layers.length > 1) {
                return ragPlan.layers.includes(c.layer);
              }
              return true;
            });
            console.log("Chunks retrieved (primary):", chunks.length);
          }

          // FALLBACK: If empty and fallback enabled
          if (chunks.length === 0 && embeddingConfig.fallbackEnabled) {
            console.log("Primary retrieval empty, attempting fallback...");
            
            const { data: fallbackResults, error: fallbackError } = await supabase.rpc("search_chunks", {
              query_embedding: queryEmbedding,
              match_threshold: 0.0, // No threshold
              match_count: embeddingConfig.fallbackTopK,
              filter_layer: ragPlan.layers[0] || null, // Keep hygiene filter
              filter_domain: null,
            });

            if (!fallbackError && fallbackResults && fallbackResults.length > 0) {
              // Apply lexical reranking for hygiene
              chunks = rerankByLexicalOverlap(fallbackResults, message, SYNONYM_MAP);
              lowConfidence = true;
              console.log("Fallback retrieval (low confidence, reranked):", chunks.length);
            }
          }
        } catch (err) {
          console.error("Error in vector search:", err);
        }
      }

      // Fetch diary context for personalization (if authenticated) - FILTERED BY 30 DAYS
      if (userId) {
        try {
          // Only fetch diary entries from the last 30 days for relevance
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const { data: diaryEntries } = await supabase
            .from("diary_entries")
            .select("content, created_at")
            .eq("user_id", userId)
            .gte("created_at", thirtyDaysAgo.toISOString())
            .order("created_at", { ascending: false })
            .limit(3);

          if (diaryEntries && diaryEntries.length > 0) {
            const entries = diaryEntries.map(e => {
              const date = new Date(e.created_at).toLocaleDateString("pt-BR");
              return `- ${date}: "${e.content.substring(0, 150)}..."`;
            }).join("\n");
            diaryContext = `\n\nCONTEXTO PESSOAL (use discretamente, últimos 30 dias):\n${entries}`;
            console.log("Diary context loaded (30-day filter)");
          }
        } catch (err) {
          console.error("Error fetching diary:", err);
        }

        // Fetch user profile for personalization (expanded with onboarding fields)
        let basicProfile: any = null;
        
        try {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("eneagrama, perfil_disc, medo_raiz_dominante, fase_jornada, spiritual_maturity, initial_pain_focus")
            .eq("id", userId)
            .maybeSingle();
          
          userProfile = profile;

          if (profile) {
            const profileParts = [];
            if (profile.eneagrama) profileParts.push(`Eneagrama: ${profile.eneagrama}`);
            if (profile.perfil_disc) profileParts.push(`DISC: ${profile.perfil_disc}`);
            if (profile.medo_raiz_dominante) profileParts.push(`Medo raiz: ${profile.medo_raiz_dominante}`);
            if (profile.fase_jornada) profileParts.push(`Fase: ${profile.fase_jornada}`);
            
            if (profileParts.length > 0) {
              diaryContext += `\n\nPERFIL DO USUÁRIO: ${profileParts.join(" | ")}`;
              console.log("User profile loaded");
            }
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
        }
        
        // Fetch basic profile for name, grammar gender, bio, and avatar (onboarding + self-perception)
        try {
          const { data: basic } = await supabase
            .from("profiles")
            .select("nome, grammar_gender, bio, avatar_url")
            .eq("id", userId)
            .maybeSingle();
          
          basicProfile = basic;
        } catch (err) {
          console.error("Error fetching basic profile:", err);
        }
        
        // ============================================
        // ONBOARDING CONTEXT INJECTION
        // ============================================
        let onboardingContext = "";
        
        if (basicProfile?.nome) {
          onboardingContext += `\n\n## IDENTIFICAÇÃO DO USUÁRIO
- Nome: ${basicProfile.nome}`;
          
          if (basicProfile.grammar_gender) {
            const genderGuide: Record<string, string> = {
              'M': 'Use concordância MASCULINA (cansado, amado, filho, ele)',
              'F': 'Use concordância FEMININA (cansada, amada, filha, ela)',
              'N': 'Use linguagem neutra quando possível'
            };
            onboardingContext += `\n- Gênero gramatical: ${genderGuide[basicProfile.grammar_gender] || 'Não especificado'}`;
          }
        }
        
        if (userProfile?.spiritual_maturity) {
          const maturityGuide: Record<string, string> = {
            'CONSOLIDATED': 'Usuário maduro espiritualmente. Pode usar linguagem teológica ("graça", "propósito") e citações bíblicas ocasionais SEM PEDIR PERMISSÃO.',
            'DISTANT': 'Usuário distante da fé. Use termos como "filho amado"/"filha amada" mas EVITE versículos sem pedido explícito.',
            'CRISIS': 'Usuário em CRISE de fé. PROIBIDO citar Bíblia ou usar linguagem religiosa. Apenas ACOLHA.',
            'SEEKER': 'Usuário buscador/curioso. PROIBIDO citar Bíblia. Use linguagem universal e acessível.',
            'SKEPTIC': 'Usuário cético. PROIBIDO qualquer referência religiosa direta. Foque em psicologia e empatia.'
          };
          onboardingContext += `\n- Maturidade espiritual: ${maturityGuide[userProfile.spiritual_maturity] || 'Não especificado'}`;
        }
        
        if (userProfile?.initial_pain_focus?.length > 0) {
          onboardingContext += `\n- Foco inicial de dor: ${userProfile.initial_pain_focus.join(', ')} (use como PISTA inicial, não como certeza - explore se ainda é relevante)`;
        }
        
        if (onboardingContext) {
          diaryContext += onboardingContext;
          console.log("Onboarding context injected");
        }

        // ============================================
        // BIO AND SYMBOLIC AVATAR CONTEXT INJECTION
        // ============================================
        let selfPerceptionContext = "";

        // Bio: explicit context provided by user
        if (basicProfile?.bio && basicProfile.bio.trim().length > 0) {
          selfPerceptionContext += `\n\n## AUTO-DESCRIÇÃO DO USUÁRIO (use discretamente, sem mencionar que leu)
O usuário descreveu-se assim: "${basicProfile.bio.trim().substring(0, 500)}"
REGRAS: Use como PISTA de contexto. NÃO repita literalmente. NÃO diga "você disse na sua bio".`;
        }

        // Symbolic avatar: emotional self-perception hint
        const symbolicAvatarId = extractSymbolicAvatarId(basicProfile?.avatar_url);
        if (symbolicAvatarId && AVATAR_EMOTIONAL_CONTEXT[symbolicAvatarId]) {
          const avatarContext = AVATAR_EMOTIONAL_CONTEXT[symbolicAvatarId];
          selfPerceptionContext += `\n\n## ESTADO EMOCIONAL AUTO-PERCEBIDO (pista sutil, NÃO mencione o avatar)
Avatar escolhido: "${avatarContext.name}"
Pista emocional: ${avatarContext.emotionalHint}
Sugestão: ${avatarContext.suggestionForModel}
REGRA: Use como orientação de tom, NÃO diga "pelo seu avatar" ou "você escolheu".`;
        }

        if (selfPerceptionContext) {
          diaryContext += selfPerceptionContext;
          console.log("Self-perception context injected (bio + avatar)");
        }

        // ============================================
        // NEW: FETCH LONG-TERM MEMORY ITEMS
        // ============================================
        try {
          const { data: memoryItems } = await supabase
            .from("memory_items")
            .select("key, value, confidence, created_at")
            .eq("user_id", userId)
            .or("ttl.is.null,ttl.gt.now()")
            .order("confidence", { ascending: false })
            .limit(15);

          if (memoryItems && memoryItems.length > 0) {
            // Group by key type for organized presentation
            const grouped = memoryItems.reduce((acc, item) => {
              if (!acc[item.key]) acc[item.key] = [];
              acc[item.key].push(item.value);
              return acc;
            }, {} as Record<string, any[]>);

            const keyLabels: Record<string, string> = {
              family_member: "Família",
              important_person: "Pessoas importantes",
              life_event: "Eventos de vida",
              preference: "Preferências",
              commitment: "Compromissos",
              struggle: "Lutas atuais",
              victory: "Vitórias recentes"
            };

            const memoryLines = Object.entries(grouped).map(([key, values]) => {
              const label = keyLabels[key] || key;
              // Format values nicely
              const formattedValues = values.map(v => {
                if (typeof v === 'object') {
                  // Extract key info based on type
                  if (v.name && v.relation) return `${v.name} (${v.relation})`;
                  if (v.name && v.role) return `${v.name} - ${v.role}`;
                  if (v.event && v.date) return `${v.event} (${v.date})`;
                  if (v.description) return v.description;
                  if (v.area) return v.area;
                  return JSON.stringify(v);
                }
                return String(v);
              }).join(", ");
              return `- ${label}: ${formattedValues}`;
            }).join("\n");

            diaryContext += `\n\n## MEMÓRIA DE LONGO PRAZO (use naturalmente, sem mencionar que você "lembra")
${memoryLines}`;
            console.log("Memory context loaded:", memoryItems.length, "items");
          }
        } catch (err) {
          console.error("Error fetching memory items:", err);
        }
      }
    }

    // ========================================
    // STEP 5: PROMPT ASSEMBLY (WITH FEW-SHOT LEARNING)
    // ========================================
    console.log("Step 5: Prompt Assembly (with Few-Shot)");
    
    // Fetch recent corrections for few-shot learning (HYBRID by phase + intent + positive/negative)
    let fewShotBlock = "";
    if (supabase) {
      const currentPhase = sessionContext?.currentPhase || null;
      
      const { positives, negatives, refinements } = await fetchRecentCorrections(
        supabase, 
        intent, 
        currentPhase,
        2,  // positiveLimit
        2,  // negativeLimit
        1   // refinementLimit
      );
      
      if (positives.length > 0 || negatives.length > 0 || refinements.length > 0) {
        fewShotBlock = buildFewShotBlock(positives, negatives, refinements, intent, currentPhase);
        console.log(`Few-shot loaded: ${positives.length} positives, ${refinements.length} refinements, ${negatives.length} negatives (phase: ${currentPhase}, intent: ${intent})`);
      }
    }
    
    // ============================================
    // SUMMARIZE OLDER HISTORY (shared by both paths)
    // ============================================
    const recentHistory = history.slice(-8);
    const olderHistory = history.slice(0, -8);
    
    let historySummary = "";
    if (olderHistory.length > 0) {
      const userMsgs = olderHistory
        .filter((m: { role: string }) => m.role === "user")
        .map((m: { content: string }) => m.content.substring(0, 80))
        .join(" | ");
      
      if (userMsgs.length > 0) {
        historySummary = `\n\n## RESUMO DO INÍCIO DA CONVERSA (${olderHistory.length} mensagens anteriores)
Temas abordados: ${userMsgs.substring(0, 400)}...`;
      }
    }

    // ============================================
    // PROMPT ASSEMBLY: Branch by flag
    // ============================================
    let systemPrompt: string;

    if (isPromptAdapterEnabled) {
      // ==========================================
      // IO PROMPT ADAPTER (NOVO)
      // ==========================================
      systemPrompt = buildIOSystemPrompt({
        fewShotBlock,
        baseIdentity: BASE_IDENTITY,
        constitutionInstructions,
        customInstructions,
        chunks,
        lowConfidence,
        intent,
        intentGuidance,
        userContext,
        sessionContext,
        ioPhase: ioPhaseContext,
        diaryContext,
        crisisRiskLevel: crisisResult.risk_level,
        historySummary,
      });
      console.log("Prompt assembled via IO Adapter (phase:", ioPhaseContext?.phase_name || 'N/A', ")");
    } else {
      // ==========================================
      // LEGADO: Montagem inline (cópia literal)
      // ==========================================
      systemPrompt = fewShotBlock + BASE_IDENTITY;

      // Add constitution (pinned)
      if (constitutionInstructions) {
        systemPrompt += `\n\n## CONSTITUIÇÃO ZION (SEMPRE APLICAR)\n${constitutionInstructions}`;
      }

      // Add custom instructions
      if (customInstructions) {
        systemPrompt += `\n\n## INSTRUÇÕES ADICIONAIS\n${customInstructions}`;
      }

      // Add retrieved context (PHASE 0: Adapt for low confidence)
      if (chunks.length > 0) {
        let chunksText;
        
        if (lowConfidence) {
          chunksText = chunks.map((c, i) => {
            const preview = c.text.substring(0, embeddingConfig.maxChunkTextInFallback);
            return `### Pista ${i + 1} [${c.layer}]\n${preview}...`;
          }).join("\n\n");
          
          systemPrompt += `\n\n## CONTEXTO (BAIXA CONFIANÇA - USE COMO PISTAS)
ATENÇÃO: Estes trechos podem não ser diretamente relevantes.
- PERGUNTE MAIS, afirme menos
- Use como PISTAS, não como base para conclusões
- Seja mais aberto e exploratório

${chunksText}`;
        } else {
          chunksText = chunks.map((c, i) => {
            const path = c.section_path?.join(" > ") || "";
            return `### Ref ${i + 1} [${c.layer}/${c.domain}]${path ? ` - ${path}` : ""}\n${c.text}`;
          }).join("\n\n---\n\n");

          systemPrompt += `\n\n## CONTEXTO DA BASE DE CONHECIMENTO ZION\nUse as seguintes referências para fundamentar suas respostas:\n\n${chunksText}`;
        }
      }

      // Add intent guidance
      if (intentGuidance[intent]) {
        systemPrompt += `\n\n## FOCO DESTA CONVERSA\n${intentGuidance[intent]}`;
      }

      // Add diary/profile context
      if (diaryContext) {
        systemPrompt += diaryContext;
      }

      // Inject Observer session insights into prompt
      if (sessionContext.currentPhase) {
        const QUESTION_TYPE_GUIDE: Record<string, string> = {
          EVIDENCE: "Peça EVIDÊNCIAS concretas do que a pessoa afirma sentir (Ex: 'O que te faz dizer isso?')",
          ALTERNATIVE: "Explore ALTERNATIVAS para a interpretação atual (Ex: 'E se houvesse outra explicação?')",
          SENSATION: "Pergunte sobre SENSAÇÕES FÍSICAS associadas (Ex: 'Onde você sente isso no corpo?')",
          VALUE: "Investigue os VALORES em jogo (Ex: 'O que isso representa para você?')",
          TRUTH: "Guie suavemente para a VERDADE que substitui a mentira (sem nomear diretamente)",
          PRACTICE: "Sugira PRÁTICAS concretas de consolidação (exercícios, hábitos)",
        };

        let insightsBlock = `\n\n## ESTADO DA JORNADA (Interno - NÃO mencionar ao usuário)`;
        insightsBlock += `\nFase atual: ${sessionContext.currentPhase} (confiança: ${(sessionContext.phaseConfidence * 100).toFixed(0)}%)`;
        insightsBlock += `\nQualidade média das respostas: ${sessionContext.avgScore.toFixed(1)}/5`;
        
        if (sessionContext.recommendedQuestionType) {
          const guide = QUESTION_TYPE_GUIDE[sessionContext.recommendedQuestionType] || sessionContext.recommendedQuestionType;
          insightsBlock += `\nPróxima pergunta recomendada: ${guide}`;
        }
        
        if (sessionContext.activeLie) {
          insightsBlock += `\nMentira ativa identificada (uso interno): "${sessionContext.activeLie}"`;
          insightsBlock += `\n(Esta é a ÂNCORA da sessão. TODO novo assunto deve ser CONECTADO a ela através de PERGUNTAS)`;
          insightsBlock += `\n(NUNCA nomeie a mentira diretamente - use perguntas para que o usuário a descubra)`;
          insightsBlock += `\nSe o usuário mencionar outro cenário, PERGUNTE: "Essa sensação de [comportamento observável]... você já sentiu ela antes?"`;
        }
        
        if (sessionContext.targetTruth) {
          insightsBlock += `\nVerdade alvo: "${sessionContext.targetTruth}"`;
          insightsBlock += `\n(NÃO apresente ainda - deixe o usuário DESCOBRIR por si mesmo)`;
        }
        
        if (sessionContext.hasRegression) {
          insightsBlock += `\n\n⚠️ ALERTA: Detectada REGRESSÃO de fase.`;
          insightsBlock += `\nO usuário pode ter se fechado ou voltado a uma postura defensiva.`;
          insightsBlock += `\nAção recomendada: RETORNE ao acolhimento. NÃO force avanço. Valide os sentimentos primeiro.`;
        }
        
        if (sessionContext.totalShifts > 0) {
          insightsBlock += `\nShifts positivos detectados: ${sessionContext.totalShifts} (bom progresso!)`;
        }

        systemPrompt += insightsBlock;
        
        // BLOQUEIO DETECTADO: Instrução contextual específica
        if (userContext.hasBlockage && sessionContext.activeLie) {
          systemPrompt += `\n\n⚠️ ALERTA: BLOQUEIO DETECTADO
O usuário parece travado e disse algo como "não sei".
MENTIRA ATIVA IDENTIFICADA (uso interno): "${sessionContext.activeLie}"

AÇÃO: NÃO ofereça hipóteses. Use PERGUNTAS DIRECIONADAS para estreitar o foco:
- Pergunte sobre sensações corporais ("Onde no corpo você sente isso?")
- Pergunte sobre memórias ("Você já sentiu isso antes, em outro momento?")
- Pergunte sobre a função da defesa ("Se essa desconfiança pudesse falar, o que ela diria?")

O objetivo é que O PRÓPRIO USUÁRIO chegue à conexão.`;
        }
      }

      // Add risk level awareness
      if (crisisResult.risk_level === "medium") {
        systemPrompt += `\n\n## ATENÇÃO: RISCO MÉDIO DETECTADO\nA pessoa pode estar em sofrimento intenso. Seja especialmente acolhedor e mencione recursos de ajuda (CVV 188) de forma natural se apropriado.`;
      }

      // Add history summary
      if (historySummary) {
        systemPrompt += historySummary;
      }
    }

    console.log("System prompt length:", systemPrompt.length, "(path:", isPromptAdapterEnabled ? "io_adapter" : "legacy", ")");

    // Build messages array with recent history only (but summary is in system prompt)
    const messages = [
      { role: "system", content: systemPrompt },
      ...recentHistory,
      { role: "user", content: message },
    ];

    // ========================================
    // STEP 6: LLM GENERATION
    // ========================================
    console.log("Step 6: LLM Generation");
    
    const llmResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 1200,
        temperature: 0.7,
      }),
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      console.error("LLM Error:", llmResponse.status, errorText);

      if (llmResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: "Rate limit",
            response: "Estou um pouco sobrecarregado. Por favor, aguarde alguns segundos e tente novamente." 
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`LLM error: ${llmResponse.status}`);
    }

    const llmData = await llmResponse.json();
    let aiResponse = llmData.choices?.[0]?.message?.content || 
      "Estou aqui para você. Por favor, compartilhe o que está em seu coração.";

    // ========================================
    // STEP 7: GUARDRAILS + OUTPUT VALIDATION
    // ========================================
    console.log("Step 7: Guardrails & Output Validation");
    const guardrailResult = applyGuardrails(aiResponse, chunks, BASE_IDENTITY);
    
    const spiritualMaturity = (typeof userProfile !== 'undefined' && userProfile?.spiritual_maturity) 
      ? userProfile.spiritual_maturity 
      : 'SEEKER';
    
    // Verificar flag de safety expandida
    let validationResult: ValidationResult;
    let usedIOValidator = false;
    
    const { data: safetyFlag } = await supabase.rpc('get_feature_flag', {
      p_flag_name: 'io_safety_expanded_enabled',
      p_user_id: userId
    });
    const isSafetyExpanded = safetyFlag === true;
    
    if (isSafetyExpanded) {
      validationResult = validateResponseIO(
        aiResponse, intent, userContext, turnCount, spiritualMaturity,
        ioPhaseContext?.current_phase || null,
        chunks.length > 0,
        lowConfidence,
        false, // isSessionDaily — será true quando Fase 5 implementar
        crisisResult?.risk_level || 'none'
      );
      usedIOValidator = true;
      console.log("Validation via IO validator (phase:", 
        ioPhaseContext?.current_phase || 'N/A', ")");
    } else {
      validationResult = validateResponseComplete(aiResponse, intent, userContext, turnCount, spiritualMaturity);
      console.log("Validation via legacy validator");
    }
    
    let didRewrite = false;
    const MAX_REWRITE_ATTEMPTS = 1;
    let rewriteAttempts = 0;
    
    if (validationResult.needsRewrite && rewriteAttempts < MAX_REWRITE_ATTEMPTS) {
      console.log("Validation failed, attempting rewrite:", 
        validationResult.issues.map(i => `${i.code}(${i.severity})`));
      rewriteAttempts++;
      
      try {
        const rewritePrompt = usedIOValidator 
          ? buildRewritePromptIO(aiResponse, validationResult, ioPhaseContext?.current_phase || null)
          : buildRewritePrompt(aiResponse, validationResult);
        
        const rewriteResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: rewritePrompt }],
            max_tokens: 500,
            temperature: 0.3,
          }),
        });

        if (rewriteResponse.ok) {
          const rewriteData = await rewriteResponse.json();
          const rewrittenContent = rewriteData.choices?.[0]?.message?.content;
          if (rewrittenContent && rewrittenContent.length < aiResponse.length * 1.2) {
            console.log("Response rewritten successfully");
            aiResponse = rewrittenContent;
            didRewrite = true;
          }
        }
      } catch (rewriteErr) {
        console.error("Rewrite failed:", rewriteErr);
      }
    }

    // Fallback para MINIMAL_SAFE_RESPONSE se rewrite falhou + CRITICAL
    if (validationResult.needsRewrite && !didRewrite) {
      const hasCritical = validationResult.issues.some(i => i.severity === 'CRITICAL');
      if (hasCritical) {
        console.log("Using minimal safe response due to CRITICAL issues");
        aiResponse = MINIMAL_SAFE_RESPONSE;
        didRewrite = true;
      }
    }
    
    // Log de observabilidade do validator
    if (supabase) {
      await supabase.from('observability_logs').insert({
        event_type: 'validation_result',
        user_id: userId || null,
        session_id: sessionId || null,
        event_data: {
          validator: usedIOValidator ? 'io' : 'legacy',
          io_phase: ioPhaseContext?.current_phase || null,
          issues: validationResult.issues.map(i => ({ code: i.code, severity: i.severity })),
          needs_rewrite: validationResult.needsRewrite,
          did_rewrite: didRewrite,
          char_count: aiResponse.length,
          question_count: (aiResponse.match(/\?/g) || []).length,
        },
        flags_active: { 
          io_safety_expanded_enabled: isSafetyExpanded,
          io_prompt_adapter_enabled: isPromptAdapterEnabled || false 
        },
      });
    }
    
    if (!guardrailResult.clean && isAdmin) {
      console.log("Guardrail warnings:", guardrailResult.warnings);
    }

    // ========================================
    // STEP 8: PERSISTENCE & RESPONSE
    // ========================================
    console.log("Step 8: Persistence & Response");
    
    // Calculate retrieval stats (PHASE 4)
    const retrievalStats: RetrievalStats | null = chunks.length > 0 ? {
      max_score: Math.max(...chunks.map(c => c.similarity)),
      avg_score: chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length,
      chunks_above_threshold: chunks.filter(c => c.similarity >= embeddingConfig.threshold).length,
      total_chunks: chunks.length,
    } : null;

    const retrievalConfidence: 'high' | 'medium' | 'low' = 
      !chunks.length ? 'low' :
      lowConfidence ? 'low' :
      (retrievalStats?.max_score || 0) > 0.10 ? 'high' :
      (retrievalStats?.max_score || 0) > 0.05 ? 'medium' : 'low';
    
    // Log retrieval for audit
    if (supabase && sessionId) {
      const { error: retrievalLogError } = await supabase.from("retrieval_logs").insert({
        session_id: sessionId,
        query_text: message,
        intent,
        role: "BUSCADOR",
        retrieved_chunk_ids: chunks.map(c => c.id),
        filters_used: ragPlan.filters,
        scores_json: { 
          chunks: chunks.map(c => ({ id: c.id, similarity: c.similarity })),
          retrieval_confidence: retrievalConfidence,
          low_confidence: lowConfidence,
        },
        rag_plan: ragPlan,
        latency_ms: Date.now() - startTime,
      });
      if (retrievalLogError) console.error("Failed to log retrieval:", retrievalLogError);

      // Log prompt assembly path for observability
      try {
        await supabase.from("observability_logs").insert({
          event_type: 'prompt_assembly',
          user_id: userId || null,
          session_id: sessionId || null,
          event_data: {
            prompt_path: isPromptAdapterEnabled ? 'io_adapter' : 'legacy',
            io_phase: ioPhaseContext?.current_phase || null,
            io_phase_name: ioPhaseContext?.phase_name || null,
            prompt_length: systemPrompt.length,
          },
          flags_active: { io_prompt_adapter_enabled: isPromptAdapterEnabled },
          latency_ms: Date.now() - startTime,
        });
      } catch (obsErr) {
        console.error("Failed to log prompt_assembly:", obsErr);
      }
    }

    const latencyMs = Date.now() - startTime;
    console.log(`=== PIPELINE COMPLETE (${latencyMs}ms) ===`);

    // Build top_chunks for debug
    const topChunksDebug: TopChunkDebug[] = chunks.slice(0, 3).map(c => ({
      id: c.id,
      title: c.section_path?.join(" > ") || c.domain || "Sem título",
      score: (c.similarity * 100).toFixed(1) + "%",
      text_preview: c.text.substring(0, 100) + "...",
    }));

    // Build response
    const response: ZyonResponse = {
      response: aiResponse,
      intent,
      role: "BUSCADOR",
      risk_level: crisisResult.risk_level,
      crisis: crisisResult.risk_level !== "none" ? {
        is_crisis: crisisResult.risk_level === "medium",
        contacts: { cvv: "188", samu: "192" },
      } : undefined,
    };

    // Add debug info for admins (PHASE 3-4)
    if (isAdmin) {
      response.debug = {
        intent,
        role: "BUSCADOR",
        risk_level: crisisResult.risk_level,
        chunk_ids: chunks.map(c => c.id),
        rag_plan: ragPlan,
        latency_ms: latencyMs,
        top_chunks: topChunksDebug,
        guardrails: guardrailResult.warnings.length > 0 ? guardrailResult.warnings : undefined,
        // New debug fields
        retrieval_confidence: retrievalConfidence,
        low_confidence_retrieval: lowConfidence,
        retrieval_stats: retrievalStats || undefined,
        validation: {
          char_count: aiResponse.length,
          line_count: aiResponse.split('\n').filter((l: string) => l.trim()).length,
          question_count: (aiResponse.match(/\?/g) || []).length,
          issues: validationResult.issues,
          was_rewritten: didRewrite,
          validator_type: usedIOValidator ? 'io' : 'legacy',
          io_phase_at_validation: ioPhaseContext?.current_phase || null,
        },
        // IO Prompt Adapter info
        session_context: sessionContext.currentPhase ? {
          current_phase: sessionContext.currentPhase,
          phase_confidence: sessionContext.phaseConfidence,
          avg_score: sessionContext.avgScore,
          has_regression: sessionContext.hasRegression,
          active_lie: sessionContext.activeLie,
          target_truth: sessionContext.targetTruth,
          recommended_question_type: sessionContext.recommendedQuestionType,
          total_shifts: sessionContext.totalShifts,
          insights_loaded: sessionContext.insights.length,
        } : undefined,
        prompt_adapter: isPromptAdapterEnabled ? 'io' : 'legacy',
        io_phase: ioPhaseContext ? {
          phase: ioPhaseContext.current_phase,
          name: ioPhaseContext.phase_name,
          igi: ioPhaseContext.igi_current,
          streak: ioPhaseContext.streak_current,
        } : null,
      };
    }

    // Add next actions for anonymous users
    if (!userId) {
      response.next_actions = {
        cta_cadastro: true,
        suggestions: [
          "Gostaria de entender mais sobre meus padrões",
          "Quero saber como começar a mudar",
          "Tenho uma dúvida sobre a Bíblia",
        ],
      };
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in zyon-chat:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        response: "Desculpe, tive um problema. Estou aqui para você, por favor tente novamente." 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
