

# Ajuste de Tom no Prompt — io-session-feedback

## Arquivo
`supabase/functions/io-session-feedback/index.ts`

## Mudanças no prompt (linhas 76-122)

### 1. Corrigir exemplos que citam escalas numericamente
- Linha 101: trocar `"Clareza 1 diz que está difícil enxergar agora..."` por exemplo sem número
- Linhas 109/113: trocar exemplos de escalas caindo/subindo para versões sem números explícitos

### 2. Adicionar bloco "REGRAS DE TOM" ao prompt (antes das REGRAS GERAIS)

Novo bloco:
```
REGRAS DE TOM:

- NUNCA cite escalas pelo número no texto do feedback.
  PROIBIDO: "Clareza em 1", "Com identidade em 3", "Suas escalas mostram"
  As escalas informam o TOM internamente, mas o texto NÃO as menciona.

- NUNCA use linguagem formal ou clínica.
  PROIBIDO: "Acolho sua presença", "Valido seu sentimento", "momento desafiador"
  USE linguagem humana: "Está pesado, né.", "Faz sentido.", "Você veio mesmo assim."

- USE as palavras do usuário como gancho.
  Se registro diz "Raiva": "Raiva. Você nomeou. Isso já é o começo."
  Se mood é "pesado": "Dia pesado. Mas você está aqui."

- Se a missão pedia nomear algo e o usuário nomeou, reconheça que CUMPRIU.
  "A missão era nomear. Você nomeou. Feito."

- O feedback deve soar como um amigo presente, não como um sistema analisando dados.
```

### 3. Atualizar exemplos existentes

| Seção | Antes | Depois |
|-------|-------|--------|
| Escalas baixas (101) | "Clareza 1 diz que está difícil enxergar agora..." | "Está difícil enxergar agora. Tudo bem. Você não precisa ter clareza pra estar aqui." |
| Escalas caindo (109) | "Ontem clareza estava em 6, hoje em 3..." | "Ontem estava mais leve, hoje nem tanto. Dias assim existem. O importante é que você está aqui." |
| Escalas subindo (113) | "Regulação subiu de 3 para 6. Algo mudou." | "Algo mudou hoje, né? O que será?" |

### 4. Nada mais muda
- Mesma estrutura, modelo, temperature, max_tokens
- Nenhuma tabela alterada

