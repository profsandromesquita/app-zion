import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Heart, Send, Menu, BookOpen, LogOut, ArrowLeft, User, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useAnonymousSession } from "@/hooks/useAnonymousSession";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import SafetyExit from "@/components/SafetyExit";

interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  created_at: string;
}

const Chat = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNicodemosMode = searchParams.get("mode") === "nicodemos";

  const { user, loading: authLoading, signOut } = useAuth();
  const { sessionId: anonSessionId, loading: anonLoading } = useAnonymousSession();
  const { isAdmin } = useUserRole();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loading = authLoading || (isNicodemosMode && anonLoading);

  // Initialize chat session
  useEffect(() => {
    if (loading) return;

    if (isNicodemosMode && anonSessionId) {
      setChatSessionId(anonSessionId);
      loadMessages(anonSessionId);
    } else if (user) {
      initAuthenticatedSession();
    }
  }, [user, loading, isNicodemosMode, anonSessionId]);

  const initAuthenticatedSession = async () => {
    if (!user) return;

    // Check for existing session
    const { data: existingSession } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_anonymous", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSession) {
      setChatSessionId(existingSession.id);
      loadMessages(existingSession.id);
    } else {
      // Create new session
      const { data: newSession, error } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          is_anonymous: false,
        })
        .select("id")
        .single();

      if (!error && newSession) {
        setChatSessionId(newSession.id);
      }
    }
  };

  const loadMessages = async (sessionId: string) => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data.map((m) => ({
        id: m.id,
        sender: m.sender as "user" | "ai",
        content: m.content,
        created_at: m.created_at,
      })));
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !chatSessionId) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      sender: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      // Save user message to DB
      await supabase.from("chat_messages").insert({
        session_id: chatSessionId,
        sender: "user",
        content: userMessage,
      });

      // Call AI Edge Function
      const response = await supabase.functions.invoke("zyon-chat", {
        body: {
          message: userMessage,
          sessionId: chatSessionId,
          userId: user?.id || null,
          history: messages.slice(-10).map((m) => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.content,
          })),
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const aiContent = response.data?.response || "Estou aqui para ajudar. Como posso te acolher hoje?";

      // Save AI response to DB
      await supabase.from("chat_messages").insert({
        session_id: chatSessionId,
        sender: "ai",
        content: aiContent,
      });

      // Add AI message
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        content: aiContent,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error("Error sending message:", error);
      // Add error message
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        sender: "ai",
        content: "Desculpe, tive um problema para responder. Por favor, tente novamente.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse-soft text-primary">
          <Heart className="h-12 w-12" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <SafetyExit />

      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Heart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-medium text-foreground">Zyon</h1>
              <p className="text-xs text-muted-foreground">
                {isNicodemosMode ? "Modo Anônimo" : "Acolhimento"}
              </p>
            </div>
          </div>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <div className="flex flex-col gap-4 pt-8">
              {user ? (
                <>
                  <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{user.email}</p>
                      <p className="text-xs text-muted-foreground">Logado</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={() => navigate("/admin")}
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Painel Admin
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => navigate("/diary")}
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    Diário Espiritual
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start text-destructive hover:text-destructive"
                    onClick={handleSignOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Você está no modo anônimo. Crie uma conta para salvar suas conversas e acessar o diário.
                  </p>
                  <Button onClick={() => navigate("/auth")}>
                    Criar Conta
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        <div className="mx-auto max-w-2xl py-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Heart className="h-8 w-8 text-primary" />
              </div>
              <h2 className="mb-2 text-lg font-medium text-foreground">
                Olá, estou aqui para você
              </h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Este é um espaço seguro. Compartilhe o que está em seu coração, 
                sem julgamentos. Estou aqui para ouvir e acolher.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`mb-4 flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.sender === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="mb-4 flex justify-start">
              <div className="flex max-w-[80%] items-center gap-2 rounded-2xl bg-muted px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary/50" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary/50" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary/50" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Compartilhe o que está em seu coração..."
            className="min-h-[50px] max-h-32 resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            size="icon"
            className="h-[50px] w-[50px] shrink-0"
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
