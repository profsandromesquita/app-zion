import { BookOpen, Clock, AlertTriangle, Heart, Sparkles, FileAudio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const TestimonyInstructions = () => {
  return (
    <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-lime-50 dark:from-emerald-950/50 dark:to-lime-950/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-emerald-800 dark:text-emerald-200">
          <BookOpen className="h-5 w-5" />
          Instruções para seu Testemunho
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          Seu testemunho será usado para conectar você com buscadores que enfrentam
          lutas semelhantes às que você venceu. Fale com o coração, conte sua história
          de transformação.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white/50 dark:bg-black/20 p-3">
            <Heart className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm text-foreground">Sua Jornada</p>
              <p className="text-xs text-muted-foreground">
                Compartilhe como era sua vida antes da transformação
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white/50 dark:bg-black/20 p-3">
            <Sparkles className="h-5 w-5 text-lime-600 dark:text-lime-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm text-foreground">Momento de Virada</p>
              <p className="text-xs text-muted-foreground">
                Descreva o ponto de mudança em sua vida
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Tempo recomendado: <strong>5 a 15 minutos</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <FileAudio className="h-4 w-4" />
            <span>Formatos aceitos: <strong>MP3, WAV, M4A, WebM, OGG, AAC</strong> (máx. 50MB)</span>
          </div>
        </div>

        <Alert variant="default" className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>Importante:</strong> Evite mencionar nomes de terceiros para proteger
            a privacidade. Foque na sua experiência pessoal com Deus.
          </AlertDescription>
        </Alert>

        <div className="text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Sugestões do que compartilhar:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Como era sua vida antes de conhecer a verdade</li>
            <li>Os desafios e lutas que enfrentou</li>
            <li>Como Deus agiu em sua transformação</li>
            <li>O que mudou após o arrependimento genuíno</li>
            <li>Uma palavra de encorajamento para quem está lutando</li>
          </ul>
        </div>

        <div className="rounded-lg border border-muted bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Dica:</strong> Você pode gravar diretamente pelo navegador ou anexar 
            um arquivo de áudio já gravado (ex: gravador do celular). Escolha a opção 
            que for mais confortável para você.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default TestimonyInstructions;
