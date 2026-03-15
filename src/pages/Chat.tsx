import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Send, Menu, ArrowLeft, Bug } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { usePersonalizedStarters } from "@/hooks/usePersonalizedStarters";
import { VoiceMicButton } from "@/components/chat/VoiceMicButton";
import { MessageFeedback } from "@/components/chat/MessageFeedback";
import { CrisisBanner } from "@/components/chat/CrisisBanner";
import { DebugPanel } from "@/components/chat/DebugPanel";
import { ConversationStarters } from "@/components/chat/ConversationStarters";
import { WelcomeBackBanner } from "@/components/chat/WelcomeBackBanner";
import { SoldadoSuggestionCard, SoldadoMatch, RejectionReason, AvailabilitySlot } from "@/components/chat/SoldadoSuggestionCard";
import { TimeSlotPicker } from "@/components/chat/TimeSlotPicker";
import { ScheduleConfirmation, ScheduleConfirmationData } from "@/components/chat/ScheduleConfirmation";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import PendingApplicationBanner from "@/components/soldado/PendingApplicationBanner";
import DailySessionBanner from "@/components/chat/DailySessionBanner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useAnonymousSession } from "@/hooks/useAnonymousSession";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import SafetyExit from "@/components/SafetyExit";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { OnboardingFlow, OnboardingData } from "@/components/onboarding/OnboardingFlow";
import { calculateNextOccurrence, formatDateTimePtBr } from "@/lib/icalendar";
import zionLogo from "@/assets/zion-logo.png";
import type { Database } from "@/integrations/supabase/types";

type SoldadoApplicationStatus = Database["public"]["Enums"]["soldado_application_status"];

interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  created_at: string;
  risk_level?: "none" | "low" | "medium" | "high";
  intent?: string;
  role_detected?: string;
  metadata?: {
    chunk_ids?: string[];
    tags_applied?: string[];
    rag_plan?: object;
    debug?: object;
    scores?: Record<string, number>;
    guardrails?: string[];
    matchmaking_suggestion?: {
      soldado: SoldadoMatch;
      suggestion_text: string;
      fallback_type?: "generalist" | "passive" | "ai_only" | null;
    };
  };
}

const Chat = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNicodemosMode = searchParams.get("mode") === "nicodemos";

  const { user, loading: authLoading, signOut } = useAuth();
  const { sessionId: anonSessionId, loading: anonLoading } = useAnonymousSession();
  const { isAdmin, loading: rolesLoading } = useUserRole();
  
  // Debug log para diagnóstico mobile - header icons
  useEffect(() => {
    console.log("[Chat Header] Icons state:", { 
      userId: user?.id, 
      isAdmin, 
      rolesLoading,
      authLoading 
    });
  }, [user?.id, isAdmin, rolesLoading, authLoading]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [showCrisisBanner, setShowCrisisBanner] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [userProfile, setUserProfile] = useState<{ name: string; initial_pain_focus: string[] } | null>(null);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [welcomeMessageSent, setWelcomeMessageSent] = useState(false);
  const [matchmakingSuggestion, setMatchmakingSuggestion] = useState<{
    soldado: SoldadoMatch;
    suggestionText: string;
    fallbackType?: "generalist" | "passive" | "ai_only" | null;
  } | null>(null);
  const [matchmakingLoading, setMatchmakingLoading] = useState(false);
  
  // Scheduling states
  const [showTimeSlotPicker, setShowTimeSlotPicker] = useState(false);
  const [selectedSoldadoForScheduling, setSelectedSoldadoForScheduling] = useState<SoldadoMatch | null>(null);
  const [scheduleConfirmation, setScheduleConfirmation] = useState<ScheduleConfirmationData | null>(null);
  
  // Pending application state (for Soldado nomination banner)
  const [pendingApplication, setPendingApplication] = useState<{
    id: string;
    status: SoldadoApplicationStatus;
  } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const refreshSidebarRef = useRef<(() => void) | null>(null);

  // Hook for personalized starters for returning users
  const { starters: personalizedStarters } = usePersonalizedStarters(
    user?.id || null,
    isReturningUser
  );

  const {
    isListening,
    isSupported,
    transcript,
    startListening,
    stopListening,
    error: speechError,
  } = useSpeechRecognition();

  // Update input with transcript while speaking (replace, don't concatenate)
  useEffect(() => {
    if (isListening && transcript) {
      setInput(transcript);
    }
  }, [transcript, isListening]);

  const loading = authLoading || (isNicodemosMode && anonLoading);

  // Redirect to auth if not logged in and not in anonymous mode
  useEffect(() => {
    if (!loading && !isNicodemosMode && !user) {
      navigate("/auth");
    }
  }, [loading, isNicodemosMode, user, navigate]);

  // Initialize chat session
  useEffect(() => {
    if (loading) return;

    if (isNicodemosMode && anonSessionId) {
      setChatSessionId(anonSessionId);
      loadMessages(anonSessionId);
      setOnboardingChecked(true); // Skip onboarding for anonymous users
    } else if (user) {
      checkOnboardingAndInit();
    }
  }, [user, loading, isNicodemosMode, anonSessionId]);

  // Check if user has completed onboarding and fetch profile
  // REGRA CRÍTICA: Igreja NUNCA tem onboarding
  const checkOnboardingAndInit = async () => {
    if (!user) return;

    // === DETECTOR INSTITUCIONAL ROBUSTO ===
    // Prioridade 1: Verificar role 'igreja' em user_roles
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const userRoles = rolesData?.map((r) => r.role) || [];
    const isIgrejaByRole = userRoles.includes("igreja");
    const isProfissional = userRoles.includes("profissional");

    // Prioridade 2 (fallback): Verificar se é pastor de alguma igreja
    let isIgrejaByChurch = false;
    if (!isIgrejaByRole) {
      const { data: churchData } = await supabase
        .from("churches")
        .select("id")
        .eq("pastor_id", user.id)
        .limit(1)
        .maybeSingle();

      isIgrejaByChurch = !!churchData;

      // Auto-corrigir role se for igreja mas não tem a role
      if (isIgrejaByChurch) {
        console.log("Detectada igreja sem role. Tentando corrigir...");
        // Corrigir role de forma assíncrona (fire-and-forget)
        (async () => {
          try {
            await supabase.rpc("add_user_role", { _user_id: user.id, _role: "igreja" });
            console.log("Role 'igreja' adicionada com sucesso");
          } catch (err) {
            console.warn("Erro ao adicionar role igreja:", err);
          }
        })();
      }
    }

    const isInstitucional = isIgrejaByRole || isIgrejaByChurch || isProfissional;

    // REGRA FINAL: Institucional = NUNCA onboarding
    if (isInstitucional) {
      setOnboardingChecked(true);
      setShowOnboarding(false); // Garantir que está false
      initAuthenticatedSession();
      return;
    }

    // === FLUXO NORMAL PARA PESSOAS ===
    const { data: userProfileData } = await supabase
      .from("user_profiles")
      .select("onboarding_completed_at, initial_pain_focus")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileData } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", user.id)
      .maybeSingle();

    const name = profileData?.nome || "";
    setUserName(name);

    if (!userProfileData?.onboarding_completed_at) {
      setShowOnboarding(true);
      setOnboardingChecked(true);
      setIsFirstTimeUser(true);
    } else {
      setUserProfile({
        name,
        initial_pain_focus: userProfileData?.initial_pain_focus || [],
      });
      setOnboardingChecked(true);
      initAuthenticatedSession();
    }
  };

  const initAuthenticatedSession = async () => {
    if (!user) return;

    // Count total sessions to determine if returning user
    const { count: sessionCount } = await supabase
      .from("chat_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_anonymous", false);

    const hasMultipleSessions = (sessionCount || 0) > 1;
    setIsReturningUser(hasMultipleSessions);

    // Check for pending soldado application
    const { data: applicationData } = await supabase
      .from("soldado_applications")
      .select("id, status")
      .eq("user_id", user.id)
      .in("status", ["pending", "testimony_required", "under_review"])
      .maybeSingle();

    if (applicationData) {
      setPendingApplication({
        id: applicationData.id,
        status: applicationData.status as SoldadoApplicationStatus,
      });
    }

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
      await loadMessages(existingSession.id);
      
      // Show welcome back banner for returning users with existing messages
      if (hasMultipleSessions && userName) {
        setShowWelcomeBack(true);
      }
    } else {
      await createNewSession(true);
    }
  };

  // Send automated welcome message from Zion
  const sendWelcomeMessage = async (sessionId: string, isFirstTime: boolean, profile: { name: string; initial_pain_focus: string[] } | null) => {
    if (welcomeMessageSent) return;
    
    const name = profile?.name || userName || "";
    let welcomeText: string;

    if (isFirstTime && profile?.initial_pain_focus && profile.initial_pain_focus.length > 0) {
      // First time user with pain focus from onboarding
      const painFocus = profile.initial_pain_focus[0].toLowerCase();
      welcomeText = `Olá${name ? `, ${name}` : ""}! Fico feliz que você esteja aqui.\n\nVocê mencionou que ${painFocus} tem pesado. Quer me contar um pouco sobre como isso tem aparecido no seu dia?`;
    } else if (isFirstTime) {
      // First time user without specific pain focus
      welcomeText = `Olá${name ? `, ${name}` : ""}! Fico feliz que você esteja aqui.\n\nNão precisa ter pressa nem saber exatamente o que dizer.\n\nPodemos começar de um jeito simples:\nComo você está se sentindo agora, neste momento?`;
    } else {
      // Returning user starting a new chat
      welcomeText = `Olá${name ? `, ${name}` : ""}! Que bom conversar com você de novo.\n\nEste é um novo espaço para você.\nO que está no seu coração hoje?`;
    }

    // Save welcome message to DB
    const { data: savedMsg } = await supabase.from("chat_messages").insert({
      session_id: sessionId,
      sender: "ai",
      content: welcomeText,
    }).select("id").single();

    if (savedMsg) {
      const welcomeMsg: Message = {
        id: savedMsg.id,
        sender: "ai",
        content: welcomeText,
        created_at: new Date().toISOString(),
      };
      setMessages([welcomeMsg]);
      setWelcomeMessageSent(true);
    }
  };

  const createNewSession = async (sendWelcome: boolean = false) => {
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
      setWelcomeMessageSent(false);
      
      if (sendWelcome) {
        await sendWelcomeMessage(newSession.id, isFirstTimeUser, userProfile);
      }
      
      return newSession.id;
    }
    return null;
  };

  const loadMessages = async (sessionId: string) => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, content, sender, created_at, risk_level, intent, role_detected, metadata")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data.map((m) => ({
        id: m.id,
        sender: m.sender as "user" | "ai",
        content: m.content,
        created_at: m.created_at,
        risk_level: m.risk_level as Message["risk_level"],
        intent: m.intent || undefined,
        role_detected: m.role_detected || undefined,
        metadata: m.metadata as Message["metadata"],
      })));
      setIsFirstMessage(data.length === 0);
    }
  };

  const handleSelectSession = useCallback(async (sessionId: string) => {
    setChatSessionId(sessionId);
    await loadMessages(sessionId);
  }, []);

  const handleNewChat = useCallback(async () => {
    setWelcomeMessageSent(false);
    const newId = await createNewSession(true);
    if (newId) {
      refreshSidebarRef.current?.();
    }
  }, [user, isFirstTimeUser, userProfile]);

  const handleSidebarReady = useCallback((refresh: () => void) => {
    refreshSidebarRef.current = refresh;
  }, []);

  // Handle onboarding completion
  const handleOnboardingComplete = async (data: OnboardingData) => {
    if (!user) return;

    try {
      // Save name and gender to profiles
      await supabase.from("profiles").upsert({
        id: user.id,
        nome: data.name,
        grammar_gender: data.grammar_gender,
      });

      // Save maturity and pain focus to user_profiles
      await supabase.from("user_profiles").upsert({
        id: user.id,
        spiritual_maturity: data.spiritual_maturity,
        initial_pain_focus: data.initial_pain_focus.length > 0 ? data.initial_pain_focus : null,
        onboarding_completed_at: new Date().toISOString(),
      });

      // Update local state
      setUserName(data.name);
      setUserProfile({
        name: data.name,
        initial_pain_focus: data.initial_pain_focus,
      });
      setIsFirstTimeUser(true);

      // Hide onboarding and start chat
      setShowOnboarding(false);

      // Create new session and send welcome message
      const newSessionId = await createNewSession(false);
      if (newSessionId) {
        await sendWelcomeMessage(newSessionId, true, {
          name: data.name,
          initial_pain_focus: data.initial_pain_focus,
        });
      }
    } catch (error) {
      console.error("Error saving onboarding data:", error);
    }
  };

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

  // Handle skipping onboarding
  const handleSkipOnboarding = async () => {
    setShowOnboarding(false);
    await initAuthenticatedSession();
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
      // Save user message to DB and get its ID
      const { data: savedUserMsg } = await supabase.from("chat_messages").insert({
        session_id: chatSessionId,
        sender: "user",
        content: userMessage,
      }).select("id").single();

      const userMessageId = savedUserMsg?.id;

      // Update session title if first message
      if (isFirstMessage) {
        await updateSessionTitle(chatSessionId, userMessage);
        setIsFirstMessage(false);
        refreshSidebarRef.current?.();
      } else {
        // Just update the updated_at timestamp
        await supabase
          .from("chat_sessions")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", chatSessionId);
      }

      // Count turns for observer
      const turnNumber = messages.filter(m => m.sender === "user").length + 1;

      // Call AI Edge Function
      const response = await supabase.functions.invoke("zyon-chat", {
        body: {
          message: userMessage,
          sessionId: chatSessionId,
          userId: user?.id || null,
          isAdmin: isAdmin,
          userMessageId: userMessageId,
          turnNumber: turnNumber,
          history: messages.slice(-10).map((m) => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.content,
          })),
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      const aiContent = data?.response || "Estou aqui para ajudar. Como posso te acolher hoje?";
      const riskLevel = data?.risk_level || "none";
      const intent = data?.intent;
      const role = data?.role;
      const debug = data?.debug;

      // Show crisis banner if high risk
      if (riskLevel === "high") {
        setShowCrisisBanner(true);
      }

      // Save AI response to DB with metadata
      const { data: savedMsg } = await supabase.from("chat_messages").insert({
        session_id: chatSessionId,
        sender: "ai",
        content: aiContent,
        risk_level: riskLevel,
        intent: intent,
        role_detected: role,
        metadata: debug ? { debug, ...debug } : null,
      }).select("id").single();

      // Trigger observer for telemetry (fire and forget - async)
      if (userMessageId && savedMsg?.id && chatSessionId) {
        supabase.functions.invoke("turn-insight-observer", {
          body: {
            session_id: chatSessionId,
            message_user_id: userMessageId,
            message_assistant_id: savedMsg.id,
            history: messages.slice(-10).map((m) => ({
              role: m.sender === "user" ? "user" : "assistant",
              content: m.content,
            })),
            user_prompt: userMessage,
            assistant_response: aiContent,
            turn_number: turnNumber,
            metadata: {
              intent,
              risk_level: riskLevel,
              was_rewritten: debug?.validation?.was_rewritten || false,
              low_confidence_retrieval: debug?.low_confidence_retrieval || false,
              validation_issues: debug?.validation?.issues?.map((i: any) => i.code) || [],
            },
          },
        }).catch(err => console.warn("Observer trigger failed:", err));
      }

      // Update last_active_at for push notification tracking
      if (user?.id) {
        supabase
          .from("profiles")
          .update({ last_active_at: new Date().toISOString() })
          .eq("id", user.id)
          .then(() => {});
      }

      // Add AI message
      const aiMsg: Message = {
        id: savedMsg?.id || `ai-${Date.now()}`,
        sender: "ai",
        content: aiContent,
        created_at: new Date().toISOString(),
        risk_level: riskLevel,
        intent: intent,
        role_detected: role,
        metadata: debug,
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

  // Handle conversation starter selection
  const handleStarterSelect = (text: string) => {
    setInput(text);
    // Auto-send after a brief moment to let user see what was selected
    setTimeout(() => {
      const event = { key: "Enter", shiftKey: false, preventDefault: () => {} } as React.KeyboardEvent;
      handleKeyDown(event);
    }, 100);
  };

  // ========================================
  // MATCHMAKING HANDLERS
  // ========================================

  const handleAcceptSoldado = useCallback(async (soldadoId: string) => {
    if (!chatSessionId || !user) return;
    
    console.log("[Matchmaking] Accepted soldado:", soldadoId);
    
    // If the soldado has available slots, show the time slot picker
    if (matchmakingSuggestion?.soldado?.available_slots?.length > 0) {
      setShowTimeSlotPicker(true);
      setSelectedSoldadoForScheduling(matchmakingSuggestion.soldado);
      setMatchmakingSuggestion(null);
      return;
    }
    
    // Fallback: No slots available, show message
    const noSlotsMsg: Message = {
      id: `system-${Date.now()}`,
      sender: "ai",
      content: "Este voluntário não tem horários disponíveis no momento. Vamos tentar encontrar outra pessoa para você.",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, noSlotsMsg]);
    setMatchmakingSuggestion(null);
    
    // Trigger search for alternatives
    handleViewOtherSoldados();
  }, [chatSessionId, user, matchmakingSuggestion]);

  // Handler for confirming the scheduled time slot
  const handleConfirmSchedule = useCallback(async (slot: AvailabilitySlot) => {
    if (!selectedSoldadoForScheduling || !user || !chatSessionId) return;
    
    setMatchmakingLoading(true);
    
    try {
      // Calculate the actual scheduled_at based on the slot
      const scheduledAt = calculateNextOccurrence(slot);
      
      console.log("[Schedule] Confirming:", {
        soldado_id: selectedSoldadoForScheduling.soldado_id,
        scheduled_at: scheduledAt.toISOString(),
        slot,
      });
      
      const response = await supabase.functions.invoke("schedule-connection", {
        body: {
          buscador_id: user.id,
          soldado_id: selectedSoldadoForScheduling.soldado_id,
          chat_session_id: chatSessionId,
          scheduled_at: scheduledAt.toISOString(),
        },
      });

      if (response.error) throw new Error(response.error.message);
      
      const data = response.data;
      
      if (!data.success) {
        throw new Error(data.error || "Falha ao agendar");
      }
      
      // Clear time slot picker
      setShowTimeSlotPicker(false);
      setSelectedSoldadoForScheduling(null);
      
      // Show confirmation card
      setScheduleConfirmation({
        id: data.session.id,
        soldadoName: data.session.soldado_name,
        scheduledAt: data.session.scheduled_at,
        durationMinutes: data.session.duration_minutes,
        meetingUrl: data.session.meeting_url,
      });
      
      // Add confirmation message
      const confirmMsg: Message = {
        id: `system-${Date.now()}`,
        sender: "ai",
        content: `Perfeito! Sua conversa com ${data.session.soldado_name} foi agendada para ${formatDateTimePtBr(scheduledAt)}. Você receberá um lembrete antes do horário.`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, confirmMsg]);
      
      toast({
        title: "Conexão agendada!",
        description: `Conversa marcada para ${formatDateTimePtBr(scheduledAt)}`,
      });
      
    } catch (error) {
      console.error("[Schedule] Error:", error);
      toast({
        title: "Erro ao agendar",
        description: error instanceof Error ? error.message : "Não foi possível agendar a conexão. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setMatchmakingLoading(false);
    }
  }, [selectedSoldadoForScheduling, user, chatSessionId, toast]);

  // Handler for canceling the time slot picker
  const handleCancelScheduling = useCallback(() => {
    setShowTimeSlotPicker(false);
    setSelectedSoldadoForScheduling(null);
    
    const cancelMsg: Message = {
      id: `system-${Date.now()}`,
      sender: "ai",
      content: "Tudo bem, podemos continuar nossa conversa. Se mudar de ideia sobre falar com um voluntário, é só me avisar.",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, cancelMsg]);
  }, []);

  const handleRejectSoldado = useCallback(async (soldadoId: string, reason: RejectionReason) => {
    if (!chatSessionId || !user) return;
    
    console.log("[Matchmaking] Rejected soldado:", soldadoId, "reason:", reason);
    setMatchmakingLoading(true);
    
    try {
      const response = await supabase.functions.invoke("matchmaking-soldado", {
        body: {
          user_id: user.id,
          session_id: chatSessionId,
          action: "reject",
          rejection_reason: reason,
          excluded_soldados: [soldadoId],
        },
      });

      if (response.error) throw new Error(response.error.message);
      
      const data = response.data;
      
      // Add response message
      const responseMsg: Message = {
        id: `system-${Date.now()}`,
        sender: "ai",
        content: data.suggestion_text || "Entendi. Vamos continuar nossa conversa.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, responseMsg]);
      
      // Clear current suggestion
      setMatchmakingSuggestion(null);
      
      // If there are new matches from rejection handler, show them
      if (data.matches && data.matches.length > 0 && data.fallback_type !== "ai_only") {
        setTimeout(() => {
          setMatchmakingSuggestion({
            soldado: data.matches[0],
            suggestionText: data.suggestion_text,
            fallbackType: data.fallback_type,
          });
        }, 1000);
      }
    } catch (error) {
      console.error("[Matchmaking] Rejection error:", error);
    } finally {
      setMatchmakingLoading(false);
    }
  }, [chatSessionId, user]);

  const handleViewOtherSoldados = useCallback(async () => {
    if (!chatSessionId || !user) return;
    
    console.log("[Matchmaking] Requesting other soldados");
    setMatchmakingLoading(true);
    
    try {
      const currentSoldadoId = matchmakingSuggestion?.soldado?.soldado_id;
      
      const response = await supabase.functions.invoke("matchmaking-soldado", {
        body: {
          user_id: user.id,
          session_id: chatSessionId,
          excluded_soldados: currentSoldadoId ? [currentSoldadoId] : [],
        },
      });

      if (response.error) throw new Error(response.error.message);
      
      const data = response.data;
      
      if (data.matches && data.matches.length > 0) {
        setMatchmakingSuggestion({
          soldado: data.matches[0],
          suggestionText: data.suggestion_text,
          fallbackType: data.fallback_type,
        });
      } else {
        // No more matches
        setMatchmakingSuggestion(null);
        const noMoreMsg: Message = {
          id: `system-${Date.now()}`,
          sender: "ai",
          content: data.suggestion_text || "Não encontrei mais voluntários disponíveis no momento. Podemos continuar nossa conversa aqui.",
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, noMoreMsg]);
      }
    } catch (error) {
      console.error("[Matchmaking] View others error:", error);
    } finally {
      setMatchmakingLoading(false);
    }
  }, [chatSessionId, user, matchmakingSuggestion]);

  const handleListenTestimony = useCallback((testimonyId: string) => {
    console.log("[Matchmaking] Listen to testimony:", testimonyId);
    // TODO: Open testimony player modal or navigate to testimony page
  }, []);

  // Determine if we should show conversation starters
  const shouldShowStarters = messages.length === 1 && 
    messages[0].sender === "ai" && 
    !isLoading;

  // Message rendering component
  const renderMessage = (message: Message) => (
    <div
      key={message.id}
      className={`group mb-4 flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
    >
      <div className="flex flex-col">
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
            message.sender === "user"
              ? "bg-gradient-to-r from-emerald-500 to-lime-500 text-white"
              : "bg-muted text-foreground"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Feedback buttons - only for AI messages with real IDs */}
        {message.sender === "ai" && message.id && !message.id.startsWith("temp") && !message.id.startsWith("error") && (
          <MessageFeedback
            messageId={message.id}
            sessionId={chatSessionId!}
            userId={user?.id}
          />
        )}

        {/* Debug panel - only for admins */}
        {isAdmin && showDebug && message.sender === "ai" && message.metadata && (
          <DebugPanel
            visible={true}
            debugData={{
              intent: message.intent,
              role: message.role_detected,
              risk_level: message.risk_level,
              chunk_ids: message.metadata.chunk_ids,
              tags_applied: message.metadata.tags_applied,
              rag_plan: message.metadata.rag_plan as any,
              scores: message.metadata.scores,
              guardrails: message.metadata.guardrails,
            }}
          />
        )}
      </div>
    </div>
  );

  if (loading || (!onboardingChecked && user && !isNicodemosMode)) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--gradient-peace)" }}>
        <div className="animate-pulse-soft">
          <img src={zionLogo} alt="Zion" className="h-16 w-16" />
        </div>
      </div>
    );
  }

  // Show onboarding for authenticated users who haven't completed it
  if (showOnboarding && user && !isNicodemosMode) {
    return (
      <OnboardingFlow
        onComplete={handleOnboardingComplete}
        onSkip={handleSkipOnboarding}
      />
    );
  }

  // Anonymous mode (Nicodemos) - no sidebar
  if (isNicodemosMode || !user) {
    return (
      <div className="flex h-[100dvh] flex-col bg-background">
        <SafetyExit />
        
        {/* Crisis Banner */}
        <CrisisBanner
          visible={showCrisisBanner}
          onDismiss={() => setShowCrisisBanner(false)}
        />

        {/* Header */}
        <header 
          className="flex items-center justify-between border-b border-border px-4 py-3"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <img src={zionLogo} alt="Zion" className="h-10 w-10" />
              <div>
                <h1 className="font-medium text-foreground">Zion</h1>
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
                <Button onClick={() => navigate("/auth")} className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300">
                  Criar Conta
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4">
          <div className="mx-auto max-w-2xl py-4">
            {messages.map(renderMessage)}

              {/* Show conversation starters after welcome message */}
              {shouldShowStarters && (
                <ConversationStarters
                  onSelect={handleStarterSelect}
                  disabled={isLoading}
                  starters={undefined} // Anonymous mode uses defaults
                />
              )}

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
        <div className="border-t border-border p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
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
              className="h-[50px] w-[50px] shrink-0 bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300"
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
      <div className="flex h-[100dvh] w-full bg-background">

        <ChatSidebar
          user={user}
          isAdmin={isAdmin}
          activeSessionId={chatSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onSignOut={handleSignOut}
          onSidebarReady={handleSidebarReady}
        />

        <div className="relative z-0 flex flex-1 flex-col">
          {/* Welcome Back Banner */}
          {user && userName && (
            <WelcomeBackBanner
              userId={user.id}
              userName={userName}
              visible={showWelcomeBack}
              onDismiss={() => setShowWelcomeBack(false)}
            />
          )}

          {/* Crisis Banner */}
          <CrisisBanner
            visible={showCrisisBanner}
            onDismiss={() => setShowCrisisBanner(false)}
          />

          {/* Pending Application Banner - show in header area */}
          {pendingApplication && (
            <PendingApplicationBanner
              applicationId={pendingApplication.id}
              status={pendingApplication.status}
            />
          )}

          {/* Daily Session Banner */}
          {user && <DailySessionBanner userId={user.id} />}

          {/* Header */}
          <header className="flex items-center justify-between border-b border-border px-4 py-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="flex items-center gap-2">
                <img src={zionLogo} alt="Zion" className="h-10 w-10" />
                <div>
                  <h1 className="font-medium text-foreground">Zion</h1>
                  <p className="text-xs text-muted-foreground">Acolhimento</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Safety Exit Button */}
              <SafetyExit variant="header" />

              {/* Push notification toggle */}
              <PushNotificationPrompt userId={user?.id || null} variant="icon" />

              {/* Debug toggle for admins */}
              {isAdmin && (
                <Button
                  variant={showDebug ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setShowDebug(!showDebug)}
                  title="Toggle Debug Panel"
                >
                  <Bug className="h-4 w-4" />
                </Button>
              )}
            </div>
          </header>

          {/* Messages */}
          <ScrollArea className="flex-1 px-4">
            <div className="mx-auto max-w-2xl py-4">
              {messages.map(renderMessage)}

              {/* Show conversation starters after welcome message - personalized for returning users */}
              {shouldShowStarters && (
                <ConversationStarters
                  onSelect={handleStarterSelect}
                  disabled={isLoading}
                  starters={isReturningUser ? personalizedStarters ?? undefined : undefined}
                />
              )}

              {/* Matchmaking suggestion card */}
              {matchmakingSuggestion && !showTimeSlotPicker && (
                <div className="mb-4 flex justify-start">
                  <div className="max-w-[90%]">
                    <SoldadoSuggestionCard
                      soldado={matchmakingSuggestion.soldado}
                      suggestionText={matchmakingSuggestion.suggestionText}
                      fallbackType={matchmakingSuggestion.fallbackType}
                      onAccept={handleAcceptSoldado}
                      onReject={handleRejectSoldado}
                      onViewOthers={handleViewOtherSoldados}
                      onListenTestimony={handleListenTestimony}
                      isLoading={matchmakingLoading}
                    />
                  </div>
                </div>
              )}

              {/* Time Slot Picker - appears after accepting a soldado */}
              {showTimeSlotPicker && selectedSoldadoForScheduling && (
                <div className="mb-4 flex justify-start">
                  <div className="max-w-[90%]">
                    <TimeSlotPicker
                      slots={selectedSoldadoForScheduling.available_slots}
                      soldadoName={selectedSoldadoForScheduling.display_name}
                      onConfirm={handleConfirmSchedule}
                      onCancel={handleCancelScheduling}
                      isLoading={matchmakingLoading}
                    />
                  </div>
                </div>
              )}

              {/* Schedule Confirmation - appears after scheduling */}
              {scheduleConfirmation && (
                <div className="mb-4 flex justify-start">
                  <div className="max-w-[90%]">
                    <ScheduleConfirmation
                      session={scheduleConfirmation}
                      onDismiss={() => setScheduleConfirmation(null)}
                    />
                  </div>
                </div>
              )}

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
          <div className="border-t border-border p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
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
                className="h-[50px] w-[50px] shrink-0 bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300"
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
