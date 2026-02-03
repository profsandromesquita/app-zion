import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Clock,
  Video,
  CheckCircle,
  XCircle,
  User,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

interface ConnectionSession {
  id: string;
  buscador_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "scheduled" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
  meeting_url: string | null;
  soldado_notes: string | null;
  buscador: {
    id: string;
    nome: string | null;
    avatar_url: string | null;
  } | null;
}

interface UpcomingSessionsProps {
  soldadoId: string;
}

const statusConfig = {
  scheduled: { label: "Agendada", variant: "default" as const, icon: Calendar },
  confirmed: { label: "Confirmada", variant: "default" as const, icon: CheckCircle },
  in_progress: { label: "Em andamento", variant: "secondary" as const, icon: Video },
  completed: { label: "Concluída", variant: "outline" as const, icon: CheckCircle },
  cancelled: { label: "Cancelada", variant: "destructive" as const, icon: XCircle },
  no_show: { label: "Não compareceu", variant: "destructive" as const, icon: XCircle },
};

export function UpcomingSessions({ soldadoId }: UpcomingSessionsProps) {
  const [sessions, setSessions] = useState<ConnectionSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      // First fetch sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("connection_sessions")
        .select("id, buscador_id, scheduled_at, duration_minutes, status, meeting_url, soldado_notes")
        .eq("soldado_id", soldadoId)
        .in("status", ["scheduled", "confirmed", "in_progress"])
        .order("scheduled_at", { ascending: true });

      if (sessionsError) throw sessionsError;
      
      if (!sessionsData || sessionsData.length === 0) {
        setSessions([]);
        return;
      }

      // Fetch buscador profiles separately
      const buscadorIds = [...new Set(sessionsData.map(s => s.buscador_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .in("id", buscadorIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // Combine data
      const combinedSessions: ConnectionSession[] = sessionsData.map(session => ({
        ...session,
        buscador: profilesMap.get(session.buscador_id) || null,
      }));

      setSessions(combinedSessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [soldadoId]);

  const handleConfirm = async (sessionId: string) => {
    setUpdatingId(sessionId);
    try {
      const { error } = await supabase
        .from("connection_sessions")
        .update({ status: "confirmed" })
        .eq("id", sessionId);

      if (error) throw error;
      
      toast({
        title: "Sessão confirmada",
        description: "O buscador será notificado.",
      });
      
      fetchSessions();
    } catch (error) {
      console.error("Error confirming session:", error);
      toast({
        title: "Erro",
        description: "Não foi possível confirmar a sessão.",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancel = async (sessionId: string) => {
    setUpdatingId(sessionId);
    try {
      const { error } = await supabase
        .from("connection_sessions")
        .update({ 
          status: "cancelled",
          cancelled_by: soldadoId,
          cancelled_reason: "Cancelado pelo soldado",
        })
        .eq("id", sessionId);

      if (error) throw error;
      
      toast({
        title: "Sessão cancelada",
        description: "O buscador será notificado.",
      });
      
      fetchSessions();
    } catch (error) {
      console.error("Error cancelling session:", error);
      toast({
        title: "Erro",
        description: "Não foi possível cancelar a sessão.",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStartSession = async (sessionId: string, meetingUrl: string | null) => {
    if (!meetingUrl) {
      toast({
        title: "Erro",
        description: "URL da reunião não disponível.",
        variant: "destructive",
      });
      return;
    }

    // Update status to in_progress
    try {
      await supabase
        .from("connection_sessions")
        .update({ 
          status: "in_progress",
          started_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    } catch (error) {
      console.error("Error starting session:", error);
    }

    // Open meeting URL
    window.open(meetingUrl, "_blank");
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }),
      time: date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const isSessionStartable = (scheduledAt: string) => {
    const now = new Date();
    const scheduled = new Date(scheduledAt);
    const diffMinutes = (scheduled.getTime() - now.getTime()) / (1000 * 60);
    // Allow starting 5 minutes before scheduled time
    return diffMinutes <= 5 && diffMinutes >= -60;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Próximas Sessões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Próximas Sessões</CardTitle>
          <CardDescription>
            Sessões de conexão agendadas com buscadores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma sessão agendada</p>
            <p className="text-sm">
              Quando um buscador agendar uma conversa, aparecerá aqui
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Próximas Sessões</CardTitle>
        <CardDescription>
          {sessions.length} sessão{sessions.length !== 1 ? "ões" : ""} agendada{sessions.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sessions.map((session) => {
          const { date, time } = formatDateTime(session.scheduled_at);
          const config = statusConfig[session.status];
          const StatusIcon = config.icon;
          const canStart = isSessionStartable(session.scheduled_at);
          const isUpdating = updatingId === session.id;

          return (
            <div
              key={session.id}
              className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {session.buscador?.avatar_url ? (
                      <img
                        src={session.buscador.avatar_url}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      {session.buscador?.nome || "Buscador"}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{date}</span>
                      <Clock className="h-3.5 w-3.5 ml-1" />
                      <span>{time}</span>
                    </div>
                  </div>
                </div>
                <Badge variant={config.variant}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {config.label}
                </Badge>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {session.status === "scheduled" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleConfirm(session.id)}
                      disabled={isUpdating}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Confirmar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" disabled={isUpdating}>
                          <XCircle className="h-4 w-4 mr-1" />
                          Cancelar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancelar sessão?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O buscador será notificado do cancelamento. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Voltar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleCancel(session.id)}
                          >
                            Confirmar cancelamento
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}

                {(session.status === "confirmed" || session.status === "in_progress") && (
                  <Button
                    size="sm"
                    onClick={() => handleStartSession(session.id, session.meeting_url)}
                    disabled={!canStart && session.status !== "in_progress"}
                    className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white"
                  >
                    <Video className="h-4 w-4 mr-1" />
                    {session.status === "in_progress" ? "Retomar" : "Iniciar"} Chamada
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                )}

                {!canStart && session.status === "confirmed" && (
                  <p className="text-xs text-muted-foreground flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    Disponível 5 min antes
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
