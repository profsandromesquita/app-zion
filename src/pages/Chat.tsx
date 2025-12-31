import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Heart, Send, Menu, ArrowLeft } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { VoiceMicButton } from "@/components/chat/VoiceMicButton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useAnonymousSession } from "@/hooks/useAnonymousSession";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import SafetyExit from "@/components/SafetyExit";
import { ChatSidebar } from "@/components/chat/ChatSidebar";

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
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isListening,
    isSupported,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    error: speechError,
  } = useSpeechRecognition();

  // Update input with transcript while speaking (replace, don't concatenate)
  useEffect(() => {
    if (isListening && transcript) {
      setInput(transcript);
    }
  }, [transcript, isListening]);

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
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSession) {
      setChatSessionId(existingSession.id);
      loadMessages(existingSession.id);
    } else {
      await createNewSession();
    }
  };

  const createNewSession = async () => {
    if (!user) return null;

    const { data: newSession, error } = await supabase
      .from("chat_sessions")
      .insert({
        user_id: user.id,
        is_anonymous: false,
        title: "Nova Conversa",
      })
      .select("id")
      .single();

    if (!error && newSession) {
      setChatSessionId(newSession.id);
      setMessages([]);
      setIsFirstMessage(true);
      return newSession.id;
    }
    return null;
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
      setIsFirstMessage(data.length === 0);
    }
  };

  const handleSelectSession = useCallback(async (sessionId: string) => {
    setChatSessionId(sessionId);
    await loadMessages(sessionId);
  }, []);

  const handleNewChat = useCallback(async () => {
    await createNewSession();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const updateSessionTitle = async (sessionId: string, userMessage: string) => {
    const title = userMessage.substring(0, 50) + (userMessage.length > 50 ? "..." : "");
    await supabase
      .from("chat_sessions")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", sessionId);
  };

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

      // Update session title if first message
      if (isFirstMessage) {
        await updateSessionTitle(chatSessionId, userMessage);
        setIsFirstMessage(false);
      } else {
        // Just update the updated_at timestamp
        await supabase
          .from("chat_sessions")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", chatSessionId);
      }

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

  // Anonymous mode (Nicodemos) - no sidebar
  if (isNicodemosMode || !user) {
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
                <p className="text-xs text-muted-foreground">Modo Anônimo</p>
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
                <p className="text-sm text-muted-foreground">
                  Você está no modo anônimo. Crie uma conta para salvar suas conversas e acessar o diário.
                </p>
                <Button onClick={() => navigate("/auth")}>
                  Criar Conta
                </Button>
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
            <VoiceMicButton
              isListening={isListening}
              isSupported={isSupported}
              onToggle={isListening ? stopListening : startListening}
              disabled={isLoading}
              error={speechError}
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
  }

  // Authenticated mode - with sidebar
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background">
        <SafetyExit />

        <ChatSidebar
          user={user}
          isAdmin={isAdmin}
          activeSessionId={chatSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onSignOut={handleSignOut}
        />

        <div className="flex flex-1 flex-col">
          {/* Header */}
          <header className="flex items-center gap-3 border-b border-border px-4 py-3">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Heart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-medium text-foreground">Zyon</h1>
                <p className="text-xs text-muted-foreground">Acolhimento</p>
              </div>
            </div>
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
              <VoiceMicButton
                isListening={isListening}
                isSupported={isSupported}
                onToggle={isListening ? stopListening : startListening}
                disabled={isLoading}
                error={speechError}
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
      </div>
    </SidebarProvider>
  );
};

export default Chat;
