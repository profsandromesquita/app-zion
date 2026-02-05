import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Upload, Loader2, CheckCircle2, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SafetyExit from "@/components/SafetyExit";
import AudioRecorder from "@/components/soldado/AudioRecorder";
import TestimonyInstructions from "@/components/soldado/TestimonyInstructions";
import zionLogo from "@/assets/zion-logo.png";

interface ApplicationData {
  id: string;
  status: string;
  user_id: string;
}

const SoldadoTestimony = () => {
  const navigate = useNavigate();
  const { applicationId } = useParams<{ applicationId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && applicationId) {
      loadApplication();
    }
  }, [user, applicationId]);

  const loadApplication = async () => {
    if (!applicationId) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("soldado_applications")
      .select("id, status, user_id")
      .eq("id", applicationId)
      .single();

    if (error) {
      console.error("Error loading application:", error);
      toast({
        title: "Erro",
        description: "Candidatura não encontrada.",
        variant: "destructive",
      });
      navigate("/profile");
      return;
    }

    // Validate access
    if (data.user_id !== user?.id) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta candidatura.",
        variant: "destructive",
      });
      navigate("/profile");
      return;
    }

    if (data.status !== "testimony_required") {
      toast({
        title: "Testemunho não necessário",
        description: "Esta candidatura não requer testemunho no momento.",
      });
      navigate("/profile");
      return;
    }

    setApplication(data);
    setLoading(false);
  };

  const handleRecordingComplete = (blob: Blob, durationSeconds: number) => {
    setAudioBlob(blob);
    setAudioDuration(durationSeconds);
  };

  const handleSubmit = async () => {
    if (!audioBlob || !user || !applicationId) return;

    setSubmitting(true);

    try {
      // 1. Generate file name
      const fileExtension = audioBlob.type.includes("mp4") ? "mp4" : "webm";
      const fileName = `${user.id}/${applicationId}.${fileExtension}`;

      // 2. Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("testimonies")
        .upload(fileName, audioBlob, {
          contentType: audioBlob.type,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 3. Get signed URL for private bucket
      const { data: urlData, error: urlError } = await supabase.storage
        .from("testimonies")
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

      if (urlError) throw urlError;

      // 4. Create testimony record
      const { error: dbError } = await supabase
        .from("testimonies")
        .insert({
          user_id: user.id,
          application_id: applicationId,
          audio_url: urlData.signedUrl,
          duration_seconds: audioDuration,
          file_size_bytes: audioBlob.size,
          mime_type: audioBlob.type,
          status: "processing",
        });

      if (dbError) throw dbError;

      // 5. Success
      setSubmitted(true);
      toast({
        title: "Testemunho enviado!",
        description: "Você será notificado quando a análise for concluída.",
      });
    } catch (error: any) {
      console.error("Error uploading testimony:", error);
      toast({
        title: "Erro ao enviar",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--gradient-peace)" }}
      >
        <div className="animate-pulse-soft">
          <img src={zionLogo} alt="Zion" className="h-16 w-16" />
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <SafetyExit />

        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="container mx-auto flex items-center gap-4 px-4 py-4">
            <h1 className="text-xl font-semibold text-foreground">Testemunho Enviado</h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-xl">
            <Card className="border-emerald-200 dark:border-emerald-800">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/50 p-4">
                      <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-semibold text-foreground">
                    Testemunho Enviado com Sucesso!
                  </h2>
                  <p className="text-muted-foreground">
                    Seu testemunho foi recebido e será analisado por nossa equipe.
                    Você receberá uma notificação quando o processo for concluído.
                  </p>
                  <div className="pt-4">
                    <Button
                      onClick={() => navigate("/profile", { replace: true })}
                      className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white"
                    >
                      Voltar ao Perfil
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SafetyExit />

      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/profile", { replace: true })}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-emerald-600" />
            <h1 className="text-xl font-semibold text-foreground">
              Gravar Testemunho
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Instructions */}
          <TestimonyInstructions />

          {/* Audio Recorder */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gravação de Áudio</CardTitle>
            </CardHeader>
            <CardContent>
              <AudioRecorder
                maxDurationSeconds={900}
                minDurationSeconds={60}
                onRecordingComplete={handleRecordingComplete}
                disabled={submitting}
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          {audioBlob && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Gravação pronta! Revise o áudio acima e clique em enviar quando estiver
                    satisfeito com sua gravação.
                  </p>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting}
                    size="lg"
                    className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-5 w-5" />
                        Enviar Testemunho
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default SoldadoTestimony;
