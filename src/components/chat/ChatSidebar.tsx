import { useState, useEffect } from "react";
import { Plus, Search, Heart, LogOut, BookOpen, Shield, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

interface ChatSession {
  id: string;
  title: string;
  updated_at: string;
}

interface ChatSidebarProps {
  user: { id: string; email?: string } | null;
  isAdmin: boolean;
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onSignOut: () => void;
}

export function ChatSidebar({
  user,
  isAdmin,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onSignOut,
}: ChatSidebarProps) {
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  const loadSessions = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("id, title, updated_at")
      .eq("user_id", user.id)
      .eq("is_anonymous", false)
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setSessions(data);
    }
    setLoading(false);
  };

  const filteredSessions = sessions.filter((session) =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `${diffDays} dias atrás`;
    return date.toLocaleDateString("pt-BR");
  };

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Heart className="h-4 w-4 text-primary" />
          </div>
          {!collapsed && <span className="font-semibold text-foreground">Zyon</span>}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="px-2">
            <Button
              onClick={onNewChat}
              className="w-full justify-start gap-2"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              {!collapsed && "Novo Chat"}
            </Button>

            {!collapsed && (
              <div className="mt-3 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar em chats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2" />

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Conversas</SidebarGroupLabel>}
          <SidebarGroupContent>
            <ScrollArea className="h-[calc(100vh-320px)]">
              <SidebarMenu>
                {loading ? (
                  <div className="px-4 py-2">
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-muted" />
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-muted-foreground">
                    {searchQuery ? "Nenhum chat encontrado" : "Nenhuma conversa ainda"}
                  </div>
                ) : (
                  filteredSessions.map((session) => (
                    <SidebarMenuItem key={session.id}>
                      <SidebarMenuButton
                        onClick={() => onSelectSession(session.id)}
                        isActive={session.id === activeSessionId}
                        className="w-full justify-start"
                        tooltip={collapsed ? session.title : undefined}
                      >
                        <div className="flex flex-col items-start overflow-hidden">
                          <span className="truncate w-full text-sm">
                            {session.title || "Nova Conversa"}
                          </span>
                          {!collapsed && (
                            <span className="text-xs text-muted-foreground">
                              {formatDate(session.updated_at)}
                            </span>
                          )}
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </ScrollArea>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <Separator className="mb-2" />
        
        {!collapsed && (
          <div className="space-y-1">
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => navigate("/admin")}
              >
                <Shield className="mr-2 h-4 w-4" />
                Painel Admin
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => navigate("/diary")}
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Diário Espiritual
            </Button>
          </div>
        )}

        <Separator className="my-2" />

        <div className="flex items-center gap-2 rounded-lg p-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              <User className="h-3 w-3" />
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{user?.email}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onSignOut}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
