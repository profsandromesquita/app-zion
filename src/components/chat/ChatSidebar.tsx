import { useState, useEffect } from "react";
import { Plus, Search, Heart, LogOut, BookOpen, Shield, User, Star } from "lucide-react";
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
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChatSessionContextMenu } from "./ChatSessionContextMenu";
import { ColorDot, type ColorTag } from "./ColorTagPicker";

interface ChatSession {
  id: string;
  title: string;
  updated_at: string;
  is_favorite: boolean;
  color_tag: string | null;
  favorited_at: string | null;
}

interface ChatSidebarProps {
  user: { id: string; email?: string } | null;
  isAdmin: boolean;
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onSignOut: () => void;
}

const MAX_FAVORITES = 3;

export function ChatSidebar({
  user,
  isAdmin,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onSignOut,
}: ChatSidebarProps) {
  const navigate = useNavigate();
  const { state, isMobile } = useSidebar();
  const { toast } = useToast();
  const collapsed = !isMobile && state === "collapsed";
  
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
      .select("id, title, updated_at, is_favorite, color_tag, favorited_at")
      .eq("user_id", user.id)
      .eq("is_anonymous", false)
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setSessions(data);
    }
    setLoading(false);
  };

  const favoriteSessions = sessions
    .filter((s) => s.is_favorite)
    .sort((a, b) => {
      if (!a.favorited_at || !b.favorited_at) return 0;
      return new Date(b.favorited_at).getTime() - new Date(a.favorited_at).getTime();
    });

  const regularSessions = sessions.filter((s) => !s.is_favorite);

  const filterSessions = (sessionList: ChatSession[]) =>
    sessionList.filter((session) =>
      session.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const canFavorite = favoriteSessions.length < MAX_FAVORITES;

  const handleRename = async (sessionId: string, newTitle: string) => {
    const { error } = await supabase
      .from("chat_sessions")
      .update({ title: newTitle })
      .eq("id", sessionId);

    if (error) {
      toast({ title: "Erro ao renomear", description: error.message, variant: "destructive" });
      return;
    }

    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s))
    );
    toast({ title: "Conversa renomeada" });
  };

  const handleDelete = async (sessionId: string) => {
    const { error } = await supabase
      .from("chat_sessions")
      .delete()
      .eq("id", sessionId);

    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }

    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    toast({ title: "Conversa excluída" });

    if (sessionId === activeSessionId) {
      onNewChat();
    }
  };

  const handleToggleFavorite = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const newIsFavorite = !session.is_favorite;

    if (newIsFavorite && !canFavorite) {
      toast({
        title: "Limite de favoritos",
        description: "Você já tem 3 favoritos. Remova um para adicionar outro.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("chat_sessions")
      .update({
        is_favorite: newIsFavorite,
        favorited_at: newIsFavorite ? new Date().toISOString() : null,
      })
      .eq("id", sessionId);

    if (error) {
      toast({ title: "Erro ao favoritar", description: error.message, variant: "destructive" });
      return;
    }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, is_favorite: newIsFavorite, favorited_at: newIsFavorite ? new Date().toISOString() : null }
          : s
      )
    );
    toast({ title: newIsFavorite ? "Adicionado aos favoritos" : "Removido dos favoritos" });
  };

  const handleChangeColor = async (sessionId: string, color: ColorTag) => {
    const { error } = await supabase
      .from("chat_sessions")
      .update({ color_tag: color })
      .eq("id", sessionId);

    if (error) {
      toast({ title: "Erro ao alterar cor", description: error.message, variant: "destructive" });
      return;
    }

    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, color_tag: color } : s))
    );
  };

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

  const renderSessionItem = (session: ChatSession) => (
    <SidebarMenuItem key={session.id} className="flex items-center w-full min-w-0 max-w-full">
      <SidebarMenuButton
        onClick={() => onSelectSession(session.id)}
        isActive={session.id === activeSessionId}
        tooltip={collapsed ? session.title : undefined}
        className="flex-1 min-w-0 pr-1 max-w-[calc(100%-32px)]"
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
          <ColorDot color={session.color_tag as ColorTag} />
          <div className="flex flex-col items-start overflow-hidden min-w-0 flex-1">
            <span className="truncate w-full text-sm">
              {session.title || "Nova Conversa"}
            </span>
            {!collapsed && (
              <span className="text-xs text-muted-foreground truncate w-full">
                {formatDate(session.updated_at)}
              </span>
            )}
          </div>
        </div>
      </SidebarMenuButton>
      {!collapsed && (
        <ChatSessionContextMenu
          sessionId={session.id}
          sessionTitle={session.title || "Nova Conversa"}
          isFavorite={session.is_favorite}
          colorTag={session.color_tag as ColorTag}
          canFavorite={canFavorite}
          onRename={handleRename}
          onDelete={handleDelete}
          onToggleFavorite={handleToggleFavorite}
          onChangeColor={handleChangeColor}
        />
      )}
    </SidebarMenuItem>
  );

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

        {/* Favorites Section */}
        {favoriteSessions.length > 0 && (
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                Favoritos
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {filterSessions(favoriteSessions).map(renderSessionItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {favoriteSessions.length > 0 && <Separator className="my-2" />}

        {/* Regular Conversations Section */}
        <SidebarGroup className="w-full overflow-hidden">
          {!collapsed && <SidebarGroupLabel>Conversas</SidebarGroupLabel>}
          <SidebarGroupContent>
            <ScrollArea className="h-[calc(100vh-420px)]">
              <SidebarMenu>
                {loading ? (
                  <div className="px-4 py-2">
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-muted" />
                  </div>
                ) : filterSessions(regularSessions).length === 0 ? (
                  <div className="px-4 py-2 text-sm text-muted-foreground">
                    {searchQuery ? "Nenhum chat encontrado" : "Nenhuma conversa ainda"}
                  </div>
                ) : (
                  filterSessions(regularSessions).map(renderSessionItem)
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
