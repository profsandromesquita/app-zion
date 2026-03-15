import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, MessageCircle, User } from "lucide-react";

interface SessionCompleteProps {
  session: {
    check_in_mood: string | null;
    igi_at_session: number | null;
    feedback_generated: string | null;
    reforco_identitario: string | null;
    duration_seconds: number | null;
  };
  streak: number;
}

const moodLabels: Record<string, string> = {
  pesado: "😔 Pesado",
  ansioso: "😟 Ansioso",
  neutro: "😐 Neutro",
  tranquilo: "🙂 Tranquilo",
  bem: "😊 Bem",
  forte: "💪 Forte",
};

const SessionComplete = ({ session, streak }: SessionCompleteProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">
            Sessão de hoje concluída
          </h1>
          <p className="text-muted-foreground">
            Você já completou sua sessão diária. Volte amanhã para continuar.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            {session.check_in_mood && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Humor</span>
                <span className="text-sm font-medium">
                  {moodLabels[session.check_in_mood] || session.check_in_mood}
                </span>
              </div>
            )}
            {session.igi_at_session !== null && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">IGI</span>
                <span className="text-sm font-bold text-primary">
                  {session.igi_at_session}
                </span>
              </div>
            )}
            {streak > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Sequência</span>
                <span className="text-sm font-medium">🔥 {streak} dias</span>
              </div>
            )}
            {session.duration_seconds && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Duração</span>
                <span className="text-sm font-medium">
                  {Math.round(session.duration_seconds / 60)} min
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {session.reforco_identitario && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <p className="text-primary font-medium italic">
                "{session.reforco_identitario}"
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate("/chat")}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Chat
          </Button>
          <Button className="flex-1" onClick={() => navigate("/profile")}>
            <User className="w-4 h-4 mr-2" />
            Minha jornada
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SessionComplete;
