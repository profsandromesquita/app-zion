import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { ProfileEditor } from "@/components/soldado/ProfileEditor";
import { AvailabilityCalendar } from "@/components/soldado/AvailabilityCalendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Shield, 
  Users, 
  Calendar, 
  MessageSquare, 
  Settings,
  ArrowLeft,
  CheckCircle,
  Clock,
  TrendingUp
} from "lucide-react";

interface SoldadoProfile {
  id: string;
  display_name: string | null;
  bio: string | null;
  specialties: string[];
  is_available: boolean;
  max_weekly_sessions: number;
  testimony_id: string | null;
}

interface DashboardStats {
  activeBuscadores: number;
  weeklyConversations: number;
  totalConversations: number;
}

export default function SoldadoDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isSoldado, loading: roleLoading } = useUserRole();
  const [profile, setProfile] = useState<SoldadoProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    activeBuscadores: 0,
    weeklyConversations: 0,
    totalConversations: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("soldado_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // Profile não existe, criar um
          const { data: newProfile, error: createError } = await supabase
            .from("soldado_profiles")
            .insert({
              id: user.id,
              display_name: user.email?.split("@")[0] || "Soldado",
            })
            .select()
            .single();

          if (createError) throw createError;
          setProfile(newProfile);
        } else {
          throw error;
        }
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error("Error fetching soldado profile:", error);
    }
  };

  const fetchStats = async () => {
    if (!user) return;

    try {
      // Contar buscadores ativos
      const { count: activeCount } = await supabase
        .from("soldado_assignments")
        .select("*", { count: "exact", head: true })
        .eq("soldado_id", user.id)
        .eq("status", "active");

      // Contar conversas da semana (usando assigned_at como proxy)
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const { count: weeklyCount } = await supabase
        .from("soldado_assignments")
        .select("*", { count: "exact", head: true })
        .eq("soldado_id", user.id)
        .gte("assigned_at", weekStart.toISOString());

      // Total de assignações
      const { count: totalCount } = await supabase
        .from("soldado_assignments")
        .select("*", { count: "exact", head: true })
        .eq("soldado_id", user.id);

      setStats({
        activeBuscadores: activeCount || 0,
        weeklyConversations: weeklyCount || 0,
        totalConversations: totalCount || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  useEffect(() => {
    if (!authLoading && !roleLoading) {
      if (!user) {
        navigate("/auth");
        return;
      }
      if (!isSoldado) {
        navigate("/");
        return;
      }

      Promise.all([fetchProfile(), fetchStats()]).finally(() => {
        setIsLoading(false);
      });
    }
  }, [user, authLoading, roleLoading, isSoldado, navigate]);

  if (authLoading || roleLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Perfil não encontrado</CardTitle>
            <CardDescription>
              Não foi possível carregar seu perfil de soldado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")}>Voltar ao início</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto py-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Dashboard do Soldado</h1>
                  <p className="text-sm text-muted-foreground">
                    {profile.display_name || "Soldado"}
                  </p>
                </div>
              </div>
            </div>
            <Badge variant={profile.is_available ? "default" : "secondary"}>
              {profile.is_available ? "Disponível" : "Indisponível"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto py-6 px-4 space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Buscadores Ativos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeBuscadores}</div>
              <p className="text-xs text-muted-foreground">
                de {profile.max_weekly_sessions} máximo semanal
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Conversas Esta Semana</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.weeklyConversations}</div>
              <p className="text-xs text-muted-foreground">novas conexões</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Acompanhamentos</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalConversations}</div>
              <p className="text-xs text-muted-foreground">desde o início</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="availability" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Horários
            </TabsTrigger>
            <TabsTrigger value="buscadores" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Buscadores
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileEditor profile={profile} onUpdate={fetchProfile} />
          </TabsContent>

          <TabsContent value="availability">
            <AvailabilityCalendar soldadoId={user!.id} />
          </TabsContent>

          <TabsContent value="buscadores">
            <BuscadoresList soldadoId={user!.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Componente auxiliar para lista de buscadores
function BuscadoresList({ soldadoId }: { soldadoId: string }) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const { data, error } = await supabase
          .from("soldado_assignments")
          .select(`
            *,
            buscador:profiles!soldado_assignments_buscador_id_fkey(id, nome, avatar_url)
          `)
          .eq("soldado_id", soldadoId)
          .eq("status", "active")
          .order("assigned_at", { ascending: false });

        if (error) throw error;
        setAssignments(data || []);
      } catch (error) {
        console.error("Error fetching assignments:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssignments();
  }, [soldadoId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (assignments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Meus Buscadores</CardTitle>
          <CardDescription>
            Pessoas que você está acompanhando em sua jornada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum buscador atribuído ainda</p>
            <p className="text-sm">
              Quando você for conectado a alguém, aparecerá aqui
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meus Buscadores</CardTitle>
        <CardDescription>
          {assignments.length} pessoa{assignments.length !== 1 ? "s" : ""} em acompanhamento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  {assignment.buscador?.avatar_url ? (
                    <img
                      src={assignment.buscador.avatar_url}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <Users className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div>
                  <p className="font-medium">
                    {assignment.buscador?.nome || "Buscador"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Desde {new Date(assignment.assigned_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Ativo
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
