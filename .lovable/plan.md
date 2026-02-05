

# Plano de Correção: Erro RLS no Upload de Testemunho

## Problema Identificado

### Causa Raiz
O erro `new row violates row-level security policy` ocorre porque:

1. **O código usa `upsert: true`** que tenta substituir arquivos existentes
2. **NÃO existe política de UPDATE** para o bucket `testimonies`
3. Quando o usuário tenta enviar novamente (mesmo arquivo ou novo), o sistema tenta fazer UPDATE mas é bloqueado pelo RLS

### Políticas Atuais do Bucket `testimonies`
| Operação | Existe? |
|----------|---------|
| SELECT   | ✅ Sim  |
| INSERT   | ✅ Sim  |
| UPDATE   | ❌ Não  |
| DELETE   | ❌ Não  |

---

## Solução

### Estratégia: Adicionar políticas UPDATE e DELETE

Em vez de mudar para nomes únicos (que complicaria a lógica), vamos adicionar as políticas que faltam para permitir que o usuário sobrescreva seu próprio arquivo.

### Migração SQL

```sql
-- Permitir que usuários atualizem seus próprios arquivos de testemunho
CREATE POLICY "Users can update own testimonies"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'testimonies' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'testimonies' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Permitir que usuários deletem seus próprios arquivos de testemunho
CREATE POLICY "Users can delete own testimonies"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'testimonies' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
```

### Correção Adicional: Normalizar MIME Type

O `audioBlob.type` pode conter parâmetros como `audio/webm;codecs=opus` que não são aceitos pelo bucket. Precisamos normalizar:

**Arquivo**: `src/pages/SoldadoTestimony.tsx`

```typescript
// Antes (problemático)
contentType: audioBlob.type, // Pode ser "audio/webm;codecs=opus"

// Depois (corrigido)
const normalizedMimeType = audioBlob.type.split(';')[0]; // Remove ";codecs=opus"
contentType: normalizedMimeType,
```

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Nova migração SQL | CRIAR | Adicionar políticas UPDATE e DELETE |
| `src/pages/SoldadoTestimony.tsx` | MODIFICAR | Normalizar MIME type antes do upload |

---

## Fluxo Corrigido

```text
1. Usuário anexa arquivo .webm
2. MIME type normalizado: "audio/webm;codecs=opus" → "audio/webm"
3. Upload com upsert:true
4. Se arquivo não existe: INSERT ✅ (política existe)
5. Se arquivo já existe: UPDATE ✅ (nova política)
6. Sucesso!
```

---

## Comportamento Esperado

1. **Primeiro upload**: Funciona (INSERT)
2. **Reenvio/Substituição**: Funciona (UPDATE com nova política)
3. **MIME types complexos**: Aceitos (normalização remove parâmetros)
4. **Estado na página**: Mantido enquanto a página estiver aberta (já corrigido anteriormente)

