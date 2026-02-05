import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Save, Shield, Pencil, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SafetyExit from "@/components/SafetyExit";
import AvatarEditor from "@/components/profile/AvatarEditor";
import JourneySection from "@/components/profile/JourneySection";
import ChurchProfileSection, { ChurchData } from "@/components/profile/ChurchProfileSection";
import SoldadoConnectionTeaser from "@/components/profile/SoldadoConnectionTeaser";
import ApplicationStatusBadge from "@/components/soldado/ApplicationStatusBadge";
import zionLogo from "@/assets/zion-logo.png";
import type { Database } from "@/integrations/supabase/types";

type SoldadoApplicationStatus = Database["public"]["Enums"]["soldado_application_status"];

interface ProfileData {
  nome: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface JourneyData {
  fase_jornada: string | null;
  active_themes_count: number | null;
  global_avg_score: number | null;
  spiritual_maturity: string | null;
  total_shifts: number | null;
  updated_at: string | null;
}

const roleLabels: Record<AppRole, string> = {
  buscador: "Buscador",
  soldado: "Soldado",
  pastor: "Pastor",
  igreja: "Igreja",
  profissional: "Profissional",
  auditor: "Auditor",
  desenvolvedor: "Desenvolvedor",
  admin: "Admin",
};

const roleColors: Record<AppRole, string> = {
  buscador: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  soldado: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  pastor: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  igreja: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  profissional: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
  auditor: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300",
  desenvolvedor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

interface PendingApplication {
  id: string;
  status: SoldadoApplicationStatus;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading, isBuscador, isIgreja, isSoldado } = useUserRole();
  const { toast } = useToast();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [churchData, setChurchData] = useState<ChurchData | null>(null);
  const [churchLoading, setChurchLoading] = useState(false);
  const [pendingApplication, setPendingApplication] = useState<PendingApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);

  // Form state
  const [nome, setNome] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  // Load church data when user has igreja role
  useEffect(() => {
    if (user && isIgreja && !rolesLoading) {
      loadChurchData();
    }
  }, [user, isIgreja, rolesLoading]);

  const loadChurchData = async () => {
    if (!user) return;

    setChurchLoading(true);

    // Find church where this user is the pastor
    const { data, error } = await supabase
      .from("churches")
      .select("id, name, address, city, state, phone, email, website, created_at")
      .eq("pastor_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error loading church:", error);
    } else if (data) {
      setChurchData(data as ChurchData);
    }

    setChurchLoading(false);
  };

  const loadProfile = async () => {
    if (!user) return;

    setLoading(true);

    // Load profile data
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("nome, email, phone, bio, avatar_url, created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Error loading profile:", profileError);
    } else if (profileData) {
      setProfile(profileData);
      setNome(profileData.nome || "");
      setPhone(profileData.phone || "");
      setBio(profileData.bio || "");
    }

    // Load journey data
    const { data: journeyData, error: journeyError } = await supabase
      .from("user_profiles")
      .select("fase_jornada, active_themes_count, global_avg_score, spiritual_maturity, total_shifts, updated_at")
      .eq("id", user.id)
      .maybeSingle();

    if (journeyError) {
      console.error("Error loading journey:", journeyError);
    } else if (journeyData) {
      setJourney(journeyData);
    }

    // Load pending soldado application
    const { data: applicationData } = await supabase
      .from("soldado_applications")
      .select("id, status")
      .eq("user_id", user.id)
      .in("status", ["pending", "testimony_required", "under_review"])
      .maybeSingle();

    if (applicationData) {
      setPendingApplication(applicationData as PendingApplication);
    }

    setLoading(false);
  };

  const handleChurchSave = (data: Partial<ChurchData>) => {
    setChurchData((prev) => prev ? { ...prev, ...data } : null);
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        nome,
        phone,
        bio,
      })
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });
      setProfile((prev) => prev ? { ...prev, nome, phone, bio } : null);
    }
  };

  const handleAvatarChange = (newUrl: string | null) => {
    setProfile((prev) => prev ? { ...prev, avatar_url: newUrl } : null);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--gradient-peace)" }}>
        <div className="animate-pulse-soft">
          <img src={zionLogo} alt="Zion" className="h-16 w-16" />
        </div>
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
            onClick={() => navigate("/chat")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Meu Perfil</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Profile Header Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                {/* Clickable Avatar */}
                <button
                  type="button"
                  onClick={() => setAvatarEditorOpen(true)}
                  className="relative group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full"
                >
                  <Avatar className="h-20 w-20 transition-opacity group-hover:opacity-80">
                    {profile?.avatar_url ? (
                      <AvatarImage src={profile.avatar_url} alt="Avatar" className="object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-2xl">
                      <User className="h-10 w-10" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil className="h-5 w-5 text-white" />
                  </div>
                </button>

                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-foreground">
                    {profile?.nome || "Usuário"}
                  </h2>
                  <p className="text-muted-foreground">{profile?.email}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Membro desde{" "}
                    {profile?.created_at
                      ? new Date(profile.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Roles Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" />
                Suas Roles
              </CardTitle>
              <CardDescription>
                Permissões e níveis de acesso na plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rolesLoading ? (
                <div className="h-8 w-32 animate-pulse rounded bg-muted" />
              ) : roles.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma role atribuída</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <Badge
                      key={role}
                      variant="secondary"
                      className={roleColors[role]}
                    >
                      {roleLabels[role]}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Soldado Dashboard Link - Only for approved Soldados */}
          {isSoldado && (
            <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                    <Shield className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="font-semibold text-foreground">
                      Você é um Soldado!
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Acesse seu painel para gerenciar seu perfil, disponibilidade e acompanhar buscadores.
                    </p>
                    <Button
                      onClick={() => navigate("/soldado")}
                      className="mt-2 bg-gradient-to-r from-emerald-500 to-lime-500 text-white"
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Acessar Dashboard do Soldado
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending Soldado Application Card */}
          {pendingApplication && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-amber-100 dark:bg-amber-900 p-3">
                    <Shield className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="font-semibold text-foreground">
                      Candidatura a Soldado
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <ApplicationStatusBadge status={pendingApplication.status} />
                    </div>
                    {pendingApplication.status === "testimony_required" && (
                      <Button
                        size="sm"
                        onClick={() => navigate(`/testimony/${pendingApplication.id}`)}
                        className="mt-2 bg-gradient-to-r from-emerald-500 to-lime-500 text-white"
                      >
                        <Mic className="mr-2 h-4 w-4" />
                        Gravar Testemunho
                      </Button>
                    )}
                    {pendingApplication.status === "under_review" && (
                      <p className="text-sm text-muted-foreground">
                        Seu testemunho está sendo analisado. Você será notificado quando o processo for concluído.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Church Profile Section - Only for Igreja role */}
          {isIgreja && (
            <ChurchProfileSection
              church={churchData}
              onSave={handleChurchSave}
              loading={churchLoading}
            />
          )}

          {/* Personal Data Card - Not shown for Igreja role */}
          {!isIgreja && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dados Pessoais</CardTitle>
                <CardDescription>
                  Atualize suas informações de perfil
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Conte um pouco sobre você..."
                    rows={3}
                  />
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300">
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Journey Card - Only for Buscadores */}
          {isBuscador && journey && (
            <JourneySection journey={journey} />
          )}

          {/* Soldado Connection Teaser - Only for Buscadores without pending application */}
          {isBuscador && !pendingApplication && !isSoldado && (
            <SoldadoConnectionTeaser />
          )}
        </div>
      </main>

      {/* Avatar Editor Modal */}
      {user && (
        <AvatarEditor
          open={avatarEditorOpen}
          onOpenChange={setAvatarEditorOpen}
          currentAvatarUrl={profile?.avatar_url || null}
          userId={user.id}
          onAvatarChange={handleAvatarChange}
        />
      )}
    </div>
  );
};

export default Profile;
