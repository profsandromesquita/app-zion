import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Church, Mail, Lock, MapPin, Phone, Globe, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO"
];

const churchSignupSchema = z.object({
  churchName: z.string().min(3, "Nome da igreja deve ter no mínimo 3 caracteres"),
  responsibleName: z.string().min(2, "Nome do responsável deve ter no mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  website: z.string().url("URL inválida").optional().or(z.literal("")),
});

interface ChurchSignupFormProps {
  onBack: () => void;
}

export function ChurchSignupForm({ onBack }: ChurchSignupFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    churchName: "",
    responsibleName: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    website: "",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = churchSignupSchema.safeParse(formData);

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
      // 1. Create auth user com account_type: 'igreja'
      // Isso faz o trigger handle_new_user() atribuir role 'igreja' automaticamente
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            nome: formData.responsibleName,
            account_type: "igreja", // CRÍTICO: Define role no backend
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Erro ao criar usuário");

      const userId = authData.user.id;

      // 2. Update profile with responsible name
      await supabase
        .from("profiles")
        .update({ nome: formData.responsibleName, phone: formData.phone })
        .eq("id", userId);

      // 3. Create church record
      const { error: churchError } = await supabase.from("churches").insert({
        name: formData.churchName,
        pastor_id: userId,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        phone: formData.phone || null,
        email: formData.email,
        website: formData.website || null,
      });

      if (churchError) throw churchError;

      // 4. Add 'igreja' role using SECURITY DEFINER function
      const { error: roleError } = await supabase.rpc("add_user_role", {
        _user_id: userId,
        _role: "igreja",
      });

      if (roleError) {
        console.error("Error adding igreja role:", roleError);
      }

      // 5. Mark onboarding as completed (not applicable for churches)
      await supabase.from("user_profiles").update({
        onboarding_completed_at: new Date().toISOString(),
      }).eq("id", userId);

      toast({
        title: "Cadastro realizado!",
        description: "Igreja cadastrada com sucesso. Redirecionando...",
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
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
          <Church className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-medium text-foreground">Cadastro de Igreja</h3>
          <p className="text-sm text-muted-foreground">Dados da instituição</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="churchName">Nome da Igreja *</Label>
        <div className="relative">
          <Church className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="churchName"
            placeholder="Nome da igreja"
            className="pl-10"
            value={formData.churchName}
            onChange={(e) => handleChange("churchName", e.target.value)}
            disabled={isLoading}
          />
        </div>
        {errors.churchName && (
          <p className="text-sm text-destructive">{errors.churchName}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="responsibleName">Nome do Responsável *</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="responsibleName"
            placeholder="Nome completo"
            className="pl-10"
            value={formData.responsibleName}
            onChange={(e) => handleChange("responsibleName", e.target.value)}
            disabled={isLoading}
          />
        </div>
        {errors.responsibleName && (
          <p className="text-sm text-destructive">{errors.responsibleName}</p>
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
              placeholder="contato@igreja.com"
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
        <Label htmlFor="phone">Telefone</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="phone"
            placeholder="(00) 00000-0000"
            className="pl-10"
            value={formData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Endereço</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="address"
            placeholder="Rua, número, bairro"
            className="pl-10"
            value={formData.address}
            onChange={(e) => handleChange("address", e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">Cidade</Label>
          <Input
            id="city"
            placeholder="Cidade"
            value={formData.city}
            onChange={(e) => handleChange("city", e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="state">Estado</Label>
          <Select
            value={formData.state}
            onValueChange={(value) => handleChange("state", value)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {BRAZILIAN_STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <div className="relative">
          <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="website"
            placeholder="https://www.suaigreja.com.br"
            className="pl-10"
            value={formData.website}
            onChange={(e) => handleChange("website", e.target.value)}
            disabled={isLoading}
          />
        </div>
        {errors.website && (
          <p className="text-sm text-destructive">{errors.website}</p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={isLoading}>
          Voltar
        </Button>
        <Button type="submit" className="flex-1 bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300" disabled={isLoading}>
          {isLoading ? "Criando conta..." : "Cadastrar Igreja"}
        </Button>
      </div>
    </form>
  );
}
