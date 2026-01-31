import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Heart, Shield, MessageCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import SafetyExit from "@/components/SafetyExit";
const Index = () => {
  const navigate = useNavigate();
  const {
    user,
    loading
  } = useAuth();
  useEffect(() => {
    if (!loading && user) {
      navigate("/chat");
    }
  }, [user, loading, navigate]);
  const handleNeedHelp = () => {
    navigate("/chat?mode=nicodemos");
  };
  const handleLogin = () => {
    navigate("/auth");
  };
  return <div className="relative min-h-screen overflow-hidden" style={{
    background: "var(--gradient-peace)"
  }}>
      <SafetyExit />
      
      {/* Background decorativo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
      </div>

      <div className="container relative mx-auto flex min-h-screen flex-col items-center justify-center px-4">
        {/* Logo/Brand */}
        <div className="mb-8 animate-fade-in text-center">
          <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Heart className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-light tracking-tight text-foreground md:text-5xl">Zion</h1>
          <p className="mt-2 text-muted-foreground">Seu refúgio espiritual</p>
        </div>

        {/* Hero Content */}
        <div className="mb-12 max-w-lg animate-slide-up text-center">
          <h2 className="mb-4 text-2xl font-medium text-foreground md:text-3xl">
            Encontre paz e orientação
          </h2>
          <p className="text-muted-foreground">
            Um espaço seguro para compartilhar seus pensamentos, encontrar acolhimento 
            e descobrir esperança através da fé.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex w-full max-w-sm flex-col gap-4 animate-slide-up">
          <Button onClick={handleNeedHelp} size="lg" className="group relative h-14 w-full overflow-hidden bg-primary text-lg font-medium text-primary-foreground shadow-lg transition-all hover:shadow-xl">
            <MessageCircle className="mr-2 h-5 w-5" />
            Preciso de Ajuda Agora
            <span className="absolute inset-0 -z-10 bg-gradient-to-r from-primary to-accent opacity-0 transition-opacity group-hover:opacity-100" />
          </Button>

          <Button onClick={handleLogin} variant="outline" size="lg" className="h-14 w-full border-2 text-lg font-medium">
            <LogIn className="mr-2 h-5 w-5" />
            Entrar / Cadastrar
          </Button>
        </div>

        {/* Trust Indicators */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground animate-fade-in">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span>100% Confidencial</span>
          </div>
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            <span>Acolhimento Cristão</span>
          </div>
        </div>

        {/* Footer */}
        <footer className="absolute bottom-4 text-center text-xs text-muted-foreground">
          <p>Você não está sozinho. Há esperança.</p>
        </footer>
      </div>
    </div>;
};
export default Index;