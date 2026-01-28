import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Mail, Lock, User, FileText, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO"
];

const PROFESSIONS = [
  { value: "psicologo", label: "Psicólogo(a)" },
  { value: "psiquiatra", label: "Psiquiatra" },
  { value: "terapeuta", label: "Terapeuta" },
];

const professionalSignupSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  profession: z.string().min(1, "Selecione uma profissão"),
  licenseNumber: z.string().min(3, "Número do registro é obrigatório"),
  licenseState: z.string().min(2, "Selecione o estado"),
});

interface ProfessionalSignupFormProps {
  onBack: () => void;
}

export function ProfessionalSignupForm({ onBack }: ProfessionalSignupFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    profession: "",
    licenseNumber: "",
    licenseState: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const getLicenseLabel = () => {
    if (formData.profession === "psicologo") return "CRP";
    if (formData.profession === "psiquiatra") return "CRM";
    return "Registro Profissional";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = professionalSignupSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            nome: formData.name,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Erro ao criar usuário");

      const userId = authData.user.id;

      // 2. Create professional credentials (pending verification)
      const { error: credentialsError } = await supabase
        .from("professional_credentials")
        .insert({
          user_id: userId,
          profession: formData.profession,
          license_number: formData.licenseNumber,
          license_state: formData.licenseState,
          verified: false,
        });

      if (credentialsError) throw credentialsError;

      // Note: The 'profissional' role will be added after admin verification
      // For now, the user has 'buscador' role from the trigger

      toast({
        title: "Cadastro realizado!",
        description: "Suas credenciais foram enviadas para verificação. Você será notificado quando aprovado.",
      });

      navigate("/chat");
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Erro no cadastro",
        description: error.message || "Erro ao criar conta",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300">
          <Brain className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-medium text-foreground">Cadastro Profissional</h3>
          <p className="text-sm text-muted-foreground">Psicólogo, Psiquiatra ou Terapeuta</p>
        </div>
      </div>

      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          Suas credenciais serão verificadas por nossa equipe antes de liberar o acesso completo à plataforma.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label htmlFor="name">Nome Completo *</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="name"
            placeholder="Seu nome completo"
            className="pl-10"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            disabled={isLoading}
          />
        </div>
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              className="pl-10"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              disabled={isLoading}
            />
          </div>
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha *</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className="pl-10"
              value={formData.password}
              onChange={(e) => handleChange("password", e.target.value)}
              disabled={isLoading}
            />
          </div>
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profession">Profissão *</Label>
        <Select
          value={formData.profession}
          onValueChange={(value) => handleChange("profession", value)}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione sua profissão" />
          </SelectTrigger>
          <SelectContent>
            {PROFESSIONS.map((prof) => (
              <SelectItem key={prof.value} value={prof.value}>
                {prof.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.profession && (
          <p className="text-sm text-destructive">{errors.profession}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="licenseNumber">{getLicenseLabel()} *</Label>
          <div className="relative">
            <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="licenseNumber"
              placeholder={formData.profession === "psiquiatra" ? "123456" : "06/123456"}
              className="pl-10"
              value={formData.licenseNumber}
              onChange={(e) => handleChange("licenseNumber", e.target.value)}
              disabled={isLoading}
            />
          </div>
          {errors.licenseNumber && (
            <p className="text-sm text-destructive">{errors.licenseNumber}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="licenseState">Estado do Registro *</Label>
          <Select
            value={formData.licenseState}
            onValueChange={(value) => handleChange("licenseState", value)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              {BRAZILIAN_STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.licenseState && (
            <p className="text-sm text-destructive">{errors.licenseState}</p>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={isLoading}>
          Voltar
        </Button>
        <Button type="submit" className="flex-1" disabled={isLoading}>
          {isLoading ? "Criando conta..." : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
}
