import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  Calendar, 
  Clock, 
  Video, 
  Download,
  X
} from "lucide-react";
import { generateICalEvent, downloadICalFile, formatDateTimePtBr } from "@/lib/icalendar";

export interface ScheduleConfirmationData {
  id: string;
  soldadoName: string;
  scheduledAt: string;
  durationMinutes: number;
  meetingUrl: string;
}

interface ScheduleConfirmationProps {
  session: ScheduleConfirmationData;
  onDismiss: () => void;
}

export function ScheduleConfirmation({
  session,
  onDismiss,
}: ScheduleConfirmationProps) {
  const scheduledDate = new Date(session.scheduledAt);
  const endDate = new Date(scheduledDate.getTime() + session.durationMinutes * 60000);

  const handleAddToCalendar = () => {
    const icalContent = generateICalEvent({
      title: `Conversa ZION com ${session.soldadoName}`,
      description: `Sessão de acompanhamento espiritual no ZION.\n\nLink da reunião: ${session.meetingUrl}`,
      start: scheduledDate,
      end: endDate,
      location: session.meetingUrl,
    });
    
    downloadICalFile(icalContent, `zion-conexao-${session.id.substring(0, 8)}`);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  return (
    <Card className="border-emerald-500/30 bg-card/95 backdrop-blur-sm shadow-lg animate-fade-in">
      <CardHeader className="pb-3 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
          <CheckCircle2 className="h-7 w-7 text-emerald-500" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          Conexão Agendada!
        </h3>
        <p className="text-sm text-muted-foreground">
          Sua conversa com {session.soldadoName} foi marcada
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Date/Time Info */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">
                {formatDateTimePtBr(scheduledDate)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">
              Duração: {formatDuration(session.durationMinutes)}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Video className="h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground truncate flex-1">
              Videochamada via Jitsi
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Antes da conversa:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Escolha um lugar tranquilo e privado</li>
            <li>Verifique sua conexão de internet</li>
            <li>Teste seu microfone e câmera</li>
            <li>Você receberá um lembrete 15 minutos antes</li>
          </ul>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 pt-0">
        <Button
          onClick={handleAddToCalendar}
          variant="outline"
          className="w-full"
        >
          <Download className="mr-2 h-4 w-4" />
          Adicionar ao Calendário
        </Button>
        
        <Button
          onClick={onDismiss}
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
        >
          Continuar conversando
        </Button>
      </CardFooter>
    </Card>
  );
}
