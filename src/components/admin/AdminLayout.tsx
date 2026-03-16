import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  FileText, 
  Settings, 
  ArrowLeft,
  BookOpen,
  Database,
  Search,
  MessageSquare,
  Map,
  Shield,
  FileCheck,
  Sparkles,
  ToggleLeft,
  FlaskConical,
  Activity,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import zionLogo from "@/assets/zion-logo.png";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const navigate = useNavigate();

  const navItems = [
    { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
    { to: "/admin/ai-intelligence", icon: Sparkles, label: "Inteligência" },
    { to: "/admin/soldado-applications", icon: Shield, label: "Candidatos Soldado" },
    { to: "/admin/testimony-curation", icon: FileCheck, label: "Curadoria Testemunhos" },
    { to: "/admin/documents", icon: Database, label: "Documentos RAG" },
    { to: "/admin/rag-test", icon: Search, label: "Teste RAG" },
    { to: "/admin/feedback-dataset", icon: MessageSquare, label: "Dataset Feedback" },
    { to: "/admin/journey-map", icon: Map, label: "Mapa de Jornada" },
    { to: "/admin/knowledge", icon: BookOpen, label: "Base Legada" },
    { to: "/admin/instructions", icon: Settings, label: "System Instructions" },
    { to: "/admin/feature-flags", icon: ToggleLeft, label: "Feature Flags" },
    { to: "/admin/cohorts", icon: FlaskConical, label: "Cohorts" },
    { to: "/admin/io-overview", icon: Activity, label: "IO Overview" },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-2 mb-1">
              <img src={zionLogo} alt="Zion" className="h-8 w-8" />
              <h1 className="text-xl font-semibold text-foreground">Painel Admin</h1>
            </div>
            <p className="text-sm text-muted-foreground">Gerenciamento ZION</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t border-border p-4">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => navigate("/chat")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Chat
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">{children}</div>
      </main>
    </div>
  );
};

export default AdminLayout;
