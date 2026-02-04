
# Plano: Adicionar Download de Áudio do Testemunho

## Objetivo

Permitir que curadores/admins baixem o áudio do testemunho mesmo quando o candidato foi rejeitado. Isso é útil para:
- Arquivamento de evidências
- Revisão posterior
- Treinamento de curadores

---

## Análise Atual

### Estado Atual
- O áudio é carregado via signed URL do Supabase Storage (bucket `testimonies`, privado)
- O `TestimonyPlayer` apenas reproduz o áudio, sem opção de download
- O `TestimonyCurationCard` exibe o player para todos os status, incluindo rejeitados
- Não há restrição de visualização por status - o áudio já está acessível

### O que Falta
- Botão de download no player ou no card
- Função para baixar o arquivo usando a signed URL

---

## Solução Proposta

### PARTE 1: Adicionar Botão de Download ao TestimonyPlayer

Adicionar um botão de download na barra de controles do player que:
1. Usa a mesma `audioUrl` (signed URL) já disponível
2. Faz fetch do blob e cria um download link
3. Gera nome de arquivo baseado na data/hora

```text
┌─────────────────────────────────────────────────────────────┐
│  [Waveform visualization]                                    │
│  [====================━━━━━━━━━━━━━━━━━]                     │
│                                                             │
│  [⟲] [▶] [🔊]                    1:30 / 5:00      [⬇] [1x]  │
│                                                   ↑          │
│                                            Novo botão        │
└─────────────────────────────────────────────────────────────┘
```

### PARTE 2: Função de Download

```typescript
const handleDownload = async () => {
  if (!audioUrl) return;
  setDownloading(true);
  
  try {
    const response = await fetch(audioUrl);
    const blob = await response.blob();
    
    // Gerar nome do arquivo
    const timestamp = new Date().toISOString().split('T')[0];
    const extension = audioUrl.includes('.mp4') ? 'mp4' : 'webm';
    const filename = `testemunho-${timestamp}.${extension}`;
    
    // Criar link de download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download failed:', error);
    // Mostrar toast de erro
  } finally {
    setDownloading(false);
  }
};
```

---

## Arquivo a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/soldado/TestimonyPlayer.tsx` | MODIFICAR | Adicionar botão de download e função de download |

---

## Detalhamento Técnico

### Modificações no TestimonyPlayer.tsx

1. **Adicionar import do ícone Download**
```typescript
import { Play, Pause, RotateCcw, Volume2, VolumeX, Download } from "lucide-react";
```

2. **Adicionar estado de loading do download**
```typescript
const [downloading, setDownloading] = useState(false);
```

3. **Adicionar função handleDownload**
Função que faz fetch do áudio via signed URL e dispara o download

4. **Adicionar botão na barra de controles**
Posicionado entre o tempo e o seletor de velocidade

### Comportamento Esperado

- Botão visível em TODOS os status de testemunho (incluindo rejected)
- Ícone de loading durante o download
- Nome do arquivo: `testemunho-YYYY-MM-DD.webm` (ou .mp4)
- Funciona mesmo com a signed URL temporária

---

## Resultado Esperado

1. Botão de download visível no player de áudio
2. Curador pode baixar áudio de qualquer testemunho
3. Download funciona para testemunhos rejeitados, curados, pendentes, etc.
4. Arquivo baixado com nome identificável
