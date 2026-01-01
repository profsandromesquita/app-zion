import { useState } from "react";
import { ThumbsUp, ThumbsDown, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface MessageFeedbackProps {
  messageId: string;
  sessionId: string;
  userId?: string | null;
  disabled?: boolean;
}

export const MessageFeedback = ({
  messageId,
  sessionId,
  userId,
  disabled = false,
}: MessageFeedbackProps) => {
  const [submitted, setSubmitted] = useState<"helpful" | "not_helpful" | "heresia" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHeresiaModal, setShowHeresiaModal] = useState(false);
  const [heresiaReason, setHeresiaReason] = useState("");

  const submitFeedback = async (type: "helpful" | "not_helpful" | "heresia", reason?: string) => {
    if (disabled || submitted) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke("feedback-handler", {
        body: {
          message_id: messageId,
          session_id: sessionId,
          user_id: userId,
          type,
          reason,
        },
      });

      if (error) throw error;

      setSubmitted(type);
      toast({
        title: "Feedback enviado",
        description: "Obrigado por nos ajudar a melhorar!",
      });
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Erro ao enviar feedback",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleHeresiaSubmit = () => {
    if (!heresiaReason.trim()) {
      toast({
        title: "Justificativa obrigatória",
        description: "Por favor, explique o motivo da sua preocupação.",
        variant: "destructive",
      });
      return;
    }
    setShowHeresiaModal(false);
    submitFeedback("heresia", heresiaReason);
    setHeresiaReason("");
  };

  if (submitted) {
    return (
      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="h-3 w-3 text-primary" />
        <span>Feedback enviado</span>
      </div>
    );
  }

  return (
    <>
      <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 md:opacity-60">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-primary"
          onClick={() => submitFeedback("helpful")}
          disabled={isLoading || disabled}
          title="Útil"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => submitFeedback("not_helpful")}
          disabled={isLoading || disabled}
          title="Não útil"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-yellow-500"
          onClick={() => setShowHeresiaModal(true)}
          disabled={isLoading || disabled}
          title="Reportar problema teológico"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Dialog open={showHeresiaModal} onOpenChange={setShowHeresiaModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar Problema Teológico</DialogTitle>
            <DialogDescription>
              Por favor, explique o que você identificou como teologicamente inadequado 
              ou contrário aos princípios cristãos nesta resposta.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={heresiaReason}
            onChange={(e) => setHeresiaReason(e.target.value)}
            placeholder="Descreva sua preocupação..."
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHeresiaModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleHeresiaSubmit} disabled={isLoading}>
              Enviar Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
