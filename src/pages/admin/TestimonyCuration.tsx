import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import RoleRoute from "@/components/admin/RoleRoute";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TestimonyCurationCard from "@/components/soldado/TestimonyCurationCard";
import type { Database } from "@/integrations/supabase/types";
import type { AppRole } from "@/hooks/useUserRole";

type TestimonyStatus = Database["public"]["Enums"]["testimony_status"];
type ApplicationStatus = Database["public"]["Enums"]["soldado_application_status"];

interface Testimony {
  id: string;
  user_id: string;
  application_id: string | null;
  audio_url: string;
  duration_seconds: number;
  status: TestimonyStatus;
  transcript: string | null;
  analysis: Record<string, unknown> | null;
  curator_notes: string | null;
  curated_by: string | null;
  curated_at: string | null;
  created_at: string;
}

interface Application {
  id: string;
  user_id: string;
  sponsored_by: string;
  sponsor_role: AppRole;
  status: ApplicationStatus;
  sponsor_notes: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  nome: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface TestimonyWithRelations extends Testimony {
  application: Application | null;
  candidateProfile: Profile | null;
  sponsorProfile: Profile | null;
}

const TestimonyCuration = () => {
  const { toast } = useToast();
  const [testimonies, setTestimonies] = useState<TestimonyWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

  useEffect(() => {
    fetchTestimonies();
  }, []);

  const fetchTestimonies = async () => {
    setLoading(true);

    try {
      // Fetch testimonies
      const { data: testimoniesData, error: testimonyError } = await supabase
        .from("testimonies")
        .select("*")
        .order("created_at", { ascending: false });

      if (testimonyError) throw testimonyError;

      if (!testimoniesData || testimoniesData.length === 0) {
        setTestimonies([]);
        setLoading(false);
        return;
      }

      // Get unique IDs
      const applicationIds = testimoniesData
        .map(t => t.application_id)
        .filter((id): id is string => id !== null);
      
      const userIds = testimoniesData.map(t => t.user_id);

      // Fetch applications
      let applications: Application[] = [];
      if (applicationIds.length > 0) {
        const { data: appsData } = await supabase
          .from("soldado_applications")
          .select("id, user_id, sponsored_by, sponsor_role, status, sponsor_notes, created_at")
          .in("id", applicationIds);
        applications = (appsData || []) as Application[];
      }

      // Get sponsor IDs
      const sponsorIds = applications.map(a => a.sponsored_by);
      const allUserIds = [...new Set([...userIds, ...sponsorIds])];

      // Fetch profiles
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, nome, email, avatar_url")
        .in("id", allUserIds);
      
      const profiles = (profilesData || []) as Profile[];
      const profilesMap = new Map(profiles.map(p => [p.id, p]));
      const applicationsMap = new Map(applications.map(a => [a.id, a]));

      // Build relations
      const testimoniesWithRelations: TestimonyWithRelations[] = testimoniesData.map(t => {
        const application = t.application_id ? applicationsMap.get(t.application_id) || null : null;
        return {
          ...t,
          analysis: t.analysis as Record<string, unknown> | null,
          application,
          candidateProfile: profilesMap.get(t.user_id) || null,
          sponsorProfile: application ? profilesMap.get(application.sponsored_by) || null : null,
        };
      });

      setTestimonies(testimoniesWithRelations);
    } catch (error) {
      console.error("Error fetching testimonies:", error);
      toast({
        title: "Erro ao carregar testemunhos",
        description: "Não foi possível buscar os testemunhos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBatchProcess = async () => {
    setBatchProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-testimony", {
        body: { batch: true },
      });

      if (error) throw error;

      toast({
        title: "Processamento iniciado",
        description: `${data?.processed || 0} testemunho(s) em processamento.`,
      });

      // Refresh after a delay
      setTimeout(fetchTestimonies, 10000);
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Error batch processing:", err);
      toast({
        title: "Erro no processamento em lote",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBatchProcessing(false);
    }
  };

  const filterTestimonies = (status: string): TestimonyWithRelations[] => {
    switch (status) {
      case "pending":
        return testimonies.filter(t => t.status === "processing" || t.status === "uploading");
      case "analyzed":
        return testimonies.filter(t => t.status === "analyzed");
      case "curated":
        return testimonies.filter(t => t.status === "curated" || t.status === "published");
      case "rejected":
        return testimonies.filter(t => t.status === "rejected");
      default:
        return testimonies;
    }
  };

  const getTabCount = (status: string): number => {
    return filterTestimonies(status).length;
  };

  const pendingCount = getTabCount("pending");
  const analyzedCount = getTabCount("analyzed");

  return (
    <RoleRoute allowedRoles={["admin", "desenvolvedor", "profissional", "pastor"]}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                Curadoria de Testemunhos
              </h2>
              <p className="text-muted-foreground">
                Revise e aprove testemunhos de candidatos a Soldado
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={fetchTestimonies}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              {pendingCount > 0 && (
                <Button
                  onClick={handleBatchProcess}
                  disabled={batchProcessing}
                >
                  {batchProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                  )}
                  Processar Pendentes ({pendingCount})
                </Button>
              )}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pending" className="relative">
                Pendentes
                {pendingCount > 0 && (
                  <span className="ml-1 text-xs bg-amber-500 text-white rounded-full px-1.5">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="analyzed" className="relative">
                Analisados
                {analyzedCount > 0 && (
                  <span className="ml-1 text-xs bg-blue-500 text-white rounded-full px-1.5">
                    {analyzedCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="curated">Curados</TabsTrigger>
              <TabsTrigger value="rejected">Rejeitados</TabsTrigger>
            </TabsList>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <TabsContent value="pending" className="space-y-4">
                  {filterTestimonies("pending").length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Nenhum testemunho pendente de processamento.
                    </div>
                  ) : (
                    filterTestimonies("pending").map(testimony => (
                      <TestimonyCurationCard
                        key={testimony.id}
                        testimony={testimony}
                        application={testimony.application}
                        candidateProfile={testimony.candidateProfile}
                        sponsorProfile={testimony.sponsorProfile}
                        onUpdate={fetchTestimonies}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="analyzed" className="space-y-4">
                  {filterTestimonies("analyzed").length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Nenhum testemunho aguardando curadoria.
                    </div>
                  ) : (
                    filterTestimonies("analyzed").map(testimony => (
                      <TestimonyCurationCard
                        key={testimony.id}
                        testimony={testimony}
                        application={testimony.application}
                        candidateProfile={testimony.candidateProfile}
                        sponsorProfile={testimony.sponsorProfile}
                        onUpdate={fetchTestimonies}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="curated" className="space-y-4">
                  {filterTestimonies("curated").length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Nenhum testemunho curado ainda.
                    </div>
                  ) : (
                    filterTestimonies("curated").map(testimony => (
                      <TestimonyCurationCard
                        key={testimony.id}
                        testimony={testimony}
                        application={testimony.application}
                        candidateProfile={testimony.candidateProfile}
                        sponsorProfile={testimony.sponsorProfile}
                        onUpdate={fetchTestimonies}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="rejected" className="space-y-4">
                  {filterTestimonies("rejected").length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Nenhum testemunho rejeitado.
                    </div>
                  ) : (
                    filterTestimonies("rejected").map(testimony => (
                      <TestimonyCurationCard
                        key={testimony.id}
                        testimony={testimony}
                        application={testimony.application}
                        candidateProfile={testimony.candidateProfile}
                        sponsorProfile={testimony.sponsorProfile}
                        onUpdate={fetchTestimonies}
                      />
                    ))
                  )}
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </AdminLayout>
    </RoleRoute>
  );
};

export default TestimonyCuration;
