import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, User, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import SafetyExit from "@/components/SafetyExit";
import { AccountTypeSelector, type AccountType } from "@/components/auth/AccountTypeSelector";
import { ChurchSignupForm } from "@/components/auth/ChurchSignupForm";
import { ProfessionalSignupForm } from "@/components/auth/ProfessionalSignupForm";
import { InstallAppButton } from "@/components/InstallAppButton";
import { z } from "zod";
import zionLogo from "@/assets/zion-logo.png";
const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres")
});
const signupSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres")
});
const Auth = () => {
  const navigate = useNavigate();
  const {
    user,
    loading,
    signIn,
    signUp
  } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Account type selection
  const [selectedAccountType, setSelectedAccountType] = useState<AccountType | null>(null);
  const [showAccountTypeSelector, setShowAccountTypeSelector] = useState(true);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form state (for Buscador)
  const [signupNome, setSignupNome] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  useEffect(() => {
    if (!loading && user) {
      navigate("/chat");
    }
  }, [user, loading, navigate]);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const result = loginSchema.safeParse({
      email: loginEmail,
      password: loginPassword
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[`login_${err.path[0]}`] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }
    setIsLoading(true);
    const {
      error
    } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);
    if (!error) {
      navigate("/chat");
    }
  };
  const handleBuscadorSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const result = signupSchema.safeParse({
      nome: signupNome,
      email: signupEmail,
      password: signupPassword
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[`signup_${err.path[0]}`] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }
    setIsLoading(true);
    const {
      error
    } = await signUp(signupEmail, signupPassword, signupNome);
    setIsLoading(false);
    if (!error) {
      navigate("/chat");
    }
  };
  const handleAccountTypeSelect = (type: AccountType) => {
    setSelectedAccountType(type);
    setShowAccountTypeSelector(false);
  };
  const handleBackToSelector = () => {
    setSelectedAccountType(null);
    setShowAccountTypeSelector(true);
  };
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--gradient-peace)" }}>
        <div className="animate-pulse-soft">
          <img src={zionLogo} alt="Zion" className="h-16 w-16" />
        </div>
      </div>;
  }
  const renderSignupContent = () => {
    if (showAccountTypeSelector) {
      return <AccountTypeSelector selected={selectedAccountType} onSelect={handleAccountTypeSelect} />;
    }
    if (selectedAccountType === "igreja") {
      return <ChurchSignupForm onBack={handleBackToSelector} />;
    }
    if (selectedAccountType === "profissional") {
      return <ProfessionalSignupForm onBack={handleBackToSelector} />;
    }

    // Buscador form
    return <form onSubmit={handleBuscadorSignup} className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Cadastro de Buscador</h3>
            <p className="text-sm text-muted-foreground">Pessoa em busca de acolhimento</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-nome">Nome</Label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input id="signup-nome" type="text" placeholder="Seu nome" className="pl-10" value={signupNome} onChange={e => setSignupNome(e.target.value)} disabled={isLoading} />
          </div>
          {errors.signup_nome && <p className="text-sm text-destructive">{errors.signup_nome}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input id="signup-email" type="email" placeholder="seu@email.com" className="pl-10" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} disabled={isLoading} />
          </div>
          {errors.signup_email && <p className="text-sm text-destructive">{errors.signup_email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password">Senha</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input id="signup-password" type="password" placeholder="••••••••" className="pl-10" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} disabled={isLoading} />
          </div>
          {errors.signup_password && <p className="text-sm text-destructive">{errors.signup_password}</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={handleBackToSelector} disabled={isLoading}>
            Voltar
          </Button>
          <Button type="submit" className="flex-1 bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300" disabled={isLoading}>
            {isLoading ? "Criando conta..." : "Criar Conta"}
          </Button>
        </div>
      </form>;
  };
  return <div className="relative min-h-screen" style={{
    background: "var(--gradient-peace)"
  }}>
      <SafetyExit />

      {/* Back Button */}
      <Button variant="ghost" className="absolute left-4 top-4" onClick={() => navigate("/")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      <div className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4 py-16">
        {/* Logo */}
        <div className="mb-8 text-center animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src={zionLogo} alt="Zion Logo" className="h-12 w-12 drop-shadow-lg" />
            <h1 className="text-3xl font-bold text-foreground">Zion</h1>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="w-full max-w-md border-0 shadow-xl animate-slide-up">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-medium">Bem-vindo</CardTitle>
            <CardDescription>
              Entre ou crie sua conta para acessar todas as funcionalidades
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full" onValueChange={value => {
            if (value === "signup") {
              setShowAccountTypeSelector(true);
              setSelectedAccountType(null);
            }
          }}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="login-email" type="email" placeholder="seu@email.com" className="pl-10" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} disabled={isLoading} />
                    </div>
                    {errors.login_email && <p className="text-sm text-destructive">{errors.login_email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="login-password" type="password" placeholder="••••••••" className="pl-10" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} disabled={isLoading} />
                    </div>
                    {errors.login_password && <p className="text-sm text-destructive">{errors.login_password}</p>}
                  </div>

                  <Button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300" size="lg" disabled={isLoading}>
                    {isLoading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                {renderSignupContent()}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Alternative action */}
        <p className="mt-6 text-center text-sm text-muted-foreground animate-fade-in">
          Precisa de ajuda agora?{" "}
          <button onClick={() => navigate("/chat?mode=nicodemos")} className="text-primary underline-offset-4 hover:underline">
            Acesse o chat anônimo
          </button>
        </p>

        {/* Install App Button */}
        <div className="mt-4 animate-fade-in">
          <InstallAppButton variant="compact" />
        </div>
      </div>
    </div>;
};
export default Auth;