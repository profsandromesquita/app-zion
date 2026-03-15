

# Plano: Edge Function io-session-feedback

## Arquivo a criar

### `supabase/functions/io-session-feedback/index.ts`

Edge function que gera feedback contextual de 2-3 frases via Lovable AI (gemini-2.5-flash-lite).

**Fluxo:**
1. CORS + OPTIONS handling
2. Step 0: Verificar flag `io_daily_session_enabled` via Supabase RPC `get_feature_flag`. Se false → retornar feedback genérico sem chamar LLM
3. Montar prompt com fase, mood, escalas atuais vs anteriores, missão, streak
4. Chamar `https://ai.gateway.lovable.dev/v1/chat/completions` com `LOVABLE_API_KEY`, model `google/gemini-2.5-flash-lite`, temperature 0.5, max_tokens 200
5. Retornar `{ feedback, success: true }`
6. Fallback em qualquer erro: `{ feedback: "Você completou mais um passo...", success: false, fallback: true }`

**Prompt do sistema:** Conforme especificação — tom encorajador, nunca clínico, celebrar subidas, normalizar descidas, reconhecer streak > 5, banir "Fico feliz"/"É ótimo que"/"Parabéns".

### `supabase/config.toml`

Adicionar entrada:
```toml
[functions.io-session-feedback]
verify_jwt = false
```

## O que NÃO muda

- Session.tsx — já chama `io-session-feedback` corretamente
- Nenhum outro edge function
- Nenhuma tabela ou RLS

