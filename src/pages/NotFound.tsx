import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import zionLogo from "@/assets/zion-logo.png";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center" style={{ background: "var(--gradient-peace)" }}>
      <div className="text-center animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src={zionLogo} alt="Zion Logo" className="h-12 w-12" />
          <span className="text-2xl font-bold text-foreground">Zion</span>
        </div>
        
        {/* 404 */}
        <h1 className="mb-4 text-6xl font-bold bg-gradient-to-r from-emerald-500 to-lime-500 bg-clip-text text-transparent">
          404
        </h1>
        <p className="mb-8 text-xl text-muted-foreground">
          Página não encontrada
        </p>
        
        {/* Back Button */}
        <Button 
          asChild
          className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300"
        >
          <a href="/">
            <Home className="mr-2 h-4 w-4" />
            Voltar ao Início
          </a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
