import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, User, Sparkles } from "lucide-react";
import SessionStepper from "@/components/session/SessionStepper";
import SessionComplete from "@/components/session/SessionComplete";
import { cn } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────

const TOTAL_STEPS = 7;

const MOODS = [
  { key: "pesado", emoji: "😔", label: "Pesado" },
  { key: "ansioso", emoji: "😟", label: "Ansioso" },
  { key: "neutro", emoji: "😐", label: "Neutro" },
  { key: "tranquilo", emoji: "🙂", label: "Tranquilo" },
  { key: "bem", emoji: "😊", label: "Bem" },
  { key: "forte", emoji: "💪", label: "Forte" },
];

const MISSION_TYPE_ICONS: Record<string, string> = {
  reflexão: "📝",
  prática: "🏃",
  observação: "👁️",
  registro: "✏️",
  ação: "⚡",
};

const PHASE_REINFORCEMENT: Record<number, string> = {
  1: "Você está aprendendo a perceber.",
  2: "Você está separando com clareza.",
  3: "Você está descobrindo quem realmente é.",
  4: "Você está construindo constância.",
  5: "Você está restaurando vida.",
  6: "Você está assumindo governo.",
  7: "Você sustenta o que construiu.",
};

const PHASE_NAMES: Record<number, string> = {
  1: "Consciência",
  2: "Limites",
  3: "Identidade",
  4: "Ritmo",
  5: "Vitalidade",
  6: "Governo",
  7: "Plenitude",
};

interface ScaleDimension {
  key: string;
  dbColumn: string;
  label: string;
  description: string;
}

const ALL_DIMENSIONS: ScaleDimension[] = [
  { key: "clareza", dbColumn: "escala_clareza", label: "Clareza", description: "Quão claro você está sobre o que sente e o que precisa?" },
  { key: "regulacao", dbColumn: "escala_regulacao", label: "Regulação", description: "Quão regulado(a) emocionalmente você se sente?" },
  { key: "identidade", dbColumn: "escala_identidade", label: "Identidade", description: "Quão conectado(a) com quem realmente é?" },
  { key: "constancia", dbColumn: "escala_constancia", label: "Constância", description: "Quão consistente nas práticas da sua jornada?" },
  { key: "vitalidade", dbColumn: "escala_vitalidade", label: "Vitalidade", description: "Quanta energia e vitalidade você sente?" },
  { key: "agencia", dbColumn: "escala_agencia", label: "Agência", description: "Quão no controle da sua vida você se sente?" },
  { key: "autonomia", dbColumn: "escala_autonomia", label: "Autonomia", description: "Quão capaz de decidir por si mesmo(a)?" },
];

function getDimensionsForPhase(phase: number): ScaleDimension[] {
  if (phase <= 2) return ALL_DIMENSIONS.slice(0, 3);
  if (phase === 3) return ALL_DIMENSIONS.slice(0, 4);
  return ALL_DIMENSIONS;
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function inferStepFromSession(session: any): number {
  if (!session) return 1;
  if (!session.check_in_completed) return 1;
  if (!session.mission_id) return 2;
  if (!session.registro_text) return 3;
  if (session.escala_clareza === null) return 4;
  if (!session.feedback_generated) return 5;
  if (!session.reforco_identitario) return 6;
  return 7;
}

// ─── Main Component ──────────────────────────────────────────

const Session = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const startTimeRef = useRef(Date.now());

  // Core state
  const [initializing, setInitializing] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [completedSession, setCompletedSession] = useState<any>(null);
  const [userPhase, setUserPhase] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Step 1 - Check-in
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

  // Step 2 - Mission
  const [mission, setMission] = useState<any>(null);
  const [missionLoading, setMissionLoading] = useState(false);

  // Step 3 - Register
  const [registroText, setRegistroText] = useState("");

  // Step 4 - Scales
  const [scales, setScales] = useState<Record<string, number>>({});

  // Step 5 - Feedback
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // Step 7 - Conclusion
  const [conclusionData, setConclusionData] = useState<{
    igi: number;
    streak: number;
    advanced: boolean;
    newPhase?: number;
    phaseName?: string;
    nextCriteria?: string;
  } | null>(null);
  const [conclusionLoading, setConclusionLoading] = useState(false);

  const initDoneRef = useRef(false);

  // ─── Initialization ─────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (initDoneRef.current) return;

    const init = async () => {
      try {
        // Check feature flag
        const { data: flagValue } = await supabase.rpc("get_feature_flag", {
          p_flag_name: "io_daily_session_enabled",
          p_user_id: user.id,
          p_cohort_id: null,
        });

        if (flagValue !== true) {
          toast({
            title: "Sessão diária ainda não disponível",
            description: "Este recurso será ativado em breve.",
          });
          navigate("/chat");
          return;
        }

        // Get user phase
        const { data: phaseData } = await supabase
          .from("io_user_phase")
          .select("*")
          .eq("user_id", user.id)
          .single();

        setUserPhase(phaseData || { current_phase: 1, phase_entered_at: new Date().toISOString(), streak_current: 0, streak_best: 0, total_sessions: 0, igi_current: 0, igi_history: [], last_session_date: null });

        // Check today's session
        const today = getToday();
        const { data: existingSession } = await supabase
          .from("io_daily_sessions")
          .select("*")
          .eq("user_id", user.id)
          .eq("session_date", today)
          .maybeSingle();

        if (existingSession?.completed) {
          setCompletedSession(existingSession);
          setInitializing(false);
          return;
        }

        if (existingSession) {
          setSessionId(existingSession.id);
          setCurrentStep(inferStepFromSession(existingSession));
          if (existingSession.check_in_mood) setSelectedMood(existingSession.check_in_mood);
          if (existingSession.registro_text) setRegistroText(existingSession.registro_text);
          if (existingSession.feedback_generated) setFeedback(existingSession.feedback_generated);

          // Hydrate scales from existing session
          const hydratedScales: Record<string, number> = {};
          ALL_DIMENSIONS.forEach((dim) => {
            const val = existingSession[dim.dbColumn as keyof typeof existingSession];
            if (val !== null && val !== undefined && typeof val === "number") {
              hydratedScales[dim.key] = val;
            }
          });
          if (Object.keys(hydratedScales).length > 0) setScales(hydratedScales);

          if (existingSession.mission_id) {
            const { data: missionData } = await supabase
              .from("io_missions")
              .select("*")
              .eq("id", existingSession.mission_id)
              .single();
            setMission(missionData);
          }
        }

        setInitializing(false);
      } catch (err) {
        console.error("Session init error:", err);
        toast({ title: "Erro ao carregar sessão", variant: "destructive" });
        navigate("/chat");
      }
    };

    init();
  }, [user, authLoading, navigate, toast]);

  // ─── Step Handlers ───────────────────────────────────────────

  const handleCheckIn = async () => {
    if (!user || !selectedMood) return;
    setSaving(true);
    try {
      const phase = userPhase?.current_phase || 1;
      const today = getToday();

      if (sessionId) {
        await supabase
          .from("io_daily_sessions")
          .update({ check_in_mood: selectedMood, check_in_completed: true })
          .eq("id", sessionId);
      } else {
        const { data } = await supabase
          .from("io_daily_sessions")
          .insert({
            user_id: user.id,
            session_date: today,
            phase_at_session: phase,
            check_in_mood: selectedMood,
            check_in_completed: true,
          })
          .select("id")
          .single();
        if (data) setSessionId(data.id);
      }

      setCurrentStep(2);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao salvar check-in", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const loadMission = useCallback(async () => {
    if (!userPhase || missionLoading || mission) return;
    setMissionLoading(true);
    try {
      const phase = userPhase.current_phase || 1;
      const enteredAt = new Date(userPhase.phase_entered_at || Date.now());
      const weeks = Math.floor((Date.now() - enteredAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const weekRange = weeks <= 2 ? "1-2" : weeks <= 4 ? "3-4" : "5-6";

      // Get last 3 mission IDs to exclude
      const { data: recentSessions } = await supabase
        .from("io_daily_sessions")
        .select("mission_id")
        .eq("user_id", user!.id)
        .not("mission_id", "is", null)
        .order("session_date", { ascending: false })
        .limit(3);

      const excludeIds = (recentSessions || []).map((s) => s.mission_id).filter(Boolean);

      let query = supabase
        .from("io_missions")
        .select("*")
        .eq("phase", phase)
        .eq("week_range", weekRange)
        .eq("is_active", true);

      if (excludeIds.length > 0) {
        query = query.not("id", "in", `(${excludeIds.join(",")})`);
      }

      const { data: missions } = await query;

      let selected = missions?.[0] || null;
      if (missions && missions.length > 1) {
        selected = missions[Math.floor(Math.random() * missions.length)];
      }

      // Fallback: if no missions for this week_range, try any for this phase
      if (!selected) {
        const { data: fallbackMissions } = await supabase
          .from("io_missions")
          .select("*")
          .eq("phase", phase)
          .eq("is_active", true)
          .limit(5);

        if (fallbackMissions && fallbackMissions.length > 0) {
          selected = fallbackMissions[Math.floor(Math.random() * fallbackMissions.length)];
        }
      }

      setMission(selected);
    } catch (err) {
      console.error(err);
    } finally {
      setMissionLoading(false);
    }
  }, [userPhase, sessionId, user, mission, missionLoading]);

  // Persist mission_id whenever both mission and sessionId are available
  useEffect(() => {
    if (mission?.id && sessionId) {
      supabase
        .from("io_daily_sessions")
        .update({ mission_id: mission.id })
        .eq("id", sessionId)
        .then(() => {});
    }
  }, [mission, sessionId]);

  useEffect(() => {
    if (currentStep === 2 && !mission && !missionLoading) {
      loadMission();
    }
  }, [currentStep, loadMission, mission, missionLoading]);

  const handleRegister = async () => {
    if (!sessionId || registroText.length < 10) return;
    setSaving(true);
    try {
      await supabase
        .from("io_daily_sessions")
        .update({ registro_text: registroText, mission_completed: true })
        .eq("id", sessionId);
      setCurrentStep(4);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao salvar registro", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleScales = async () => {
    if (!sessionId || !user) return;
    setSaving(true);
    try {
      const updateData: Record<string, number | null> = {};
      const dimensions = getDimensionsForPhase(userPhase?.current_phase || 1);

      dimensions.forEach((dim) => {
        updateData[dim.dbColumn] = scales[dim.key] ?? 5;
      });

      await supabase.from("io_daily_sessions").update(updateData).eq("id", sessionId);

      // Insert scale entries
      const entries = dimensions.map((dim) => ({
        user_id: user.id,
        session_id: sessionId,
        dimension: dim.key,
        value: scales[dim.key] ?? 5,
      }));

      await supabase.from("io_scale_entries").insert(entries);

      setCurrentStep(5);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao salvar escalas", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleFeedback = useCallback(async () => {
    if (feedbackLoading || feedback) return;
    setFeedbackLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("io-session-feedback", {
        body: {
          user_id: user!.id,
          session_id: sessionId,
          scales,
          mood: selectedMood,
          phase: userPhase?.current_phase || 1,
        },
      });

      if (error || !data?.feedback) throw new Error("No feedback");

      setFeedback(data.feedback);
      await supabase
        .from("io_daily_sessions")
        .update({ feedback_generated: data.feedback })
        .eq("id", sessionId!);
    } catch {
      const fallback = "Você completou mais um passo na sua jornada. A constância constrói o que a motivação apenas começa.";
      setFeedback(fallback);
      if (sessionId) {
        await supabase
          .from("io_daily_sessions")
          .update({ feedback_generated: fallback })
          .eq("id", sessionId);
      }
    } finally {
      setFeedbackLoading(false);
    }
  }, [feedbackLoading, feedback, user, sessionId, scales, selectedMood, userPhase]);

  useEffect(() => {
    if (currentStep === 5 && !feedback && !feedbackLoading) {
      handleFeedback();
    }
  }, [currentStep, handleFeedback, feedback, feedbackLoading]);

  const handleReinforcement = async () => {
    if (!sessionId) return;
    const phase = userPhase?.current_phase || 1;
    const text = PHASE_REINFORCEMENT[phase] || PHASE_REINFORCEMENT[1];
    setSaving(true);
    try {
      await supabase
        .from("io_daily_sessions")
        .update({ reforco_identitario: text })
        .eq("id", sessionId);
      setCurrentStep(7);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleConclusion = useCallback(async () => {
    if (conclusionLoading || conclusionData) return;
    setConclusionLoading(true);
    try {
      const phase = userPhase?.current_phase || 1;
      const dimensions = getDimensionsForPhase(phase);
      const scaleValues: Record<string, number | null> = {
        p_clareza: null, p_regulacao: null, p_identidade: null,
        p_constancia: null, p_vitalidade: null, p_agencia: null, p_autonomia: null,
      };

      dimensions.forEach((dim) => {
        scaleValues[`p_${dim.key}`] = scales[dim.key] ?? 5;
      });

      // Calculate IGI
      const { data: igiResult } = await supabase.rpc("calculate_igi", scaleValues as any);
      const igi = typeof igiResult === "number" ? igiResult : 0;

      // Calculate streak
      const lastDate = userPhase?.last_session_date;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      let newStreak = 1;
      if (lastDate === yesterdayStr) {
        newStreak = (userPhase?.streak_current || 0) + 1;
      }
      const newBest = Math.max(newStreak, userPhase?.streak_best || 0);

      // Duration
      const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);

      // Update session as completed
      await supabase
        .from("io_daily_sessions")
        .update({
          completed: true,
          igi_at_session: igi,
          duration_seconds: durationSeconds,
        })
        .eq("id", sessionId!);

      // Update io_user_phase
      const newHistory = [...(userPhase?.igi_history || []), { date: getToday(), igi }];
      await supabase
        .from("io_user_phase")
        .update({
          igi_current: igi,
          igi_history: newHistory,
          streak_current: newStreak,
          streak_best: newBest,
          last_session_date: getToday(),
          total_sessions: (userPhase?.total_sessions || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user!.id);

      // Call phase manager
      let advanced = false;
      let newPhase: number | undefined;
      let phaseName: string | undefined;
      let nextCriteria: string | undefined;

      try {
        const { data: pmResult } = await supabase.functions.invoke("io-phase-manager", {
          body: { action: "evaluate", user_id: user!.id },
        });

        if (pmResult?.decision === "advance") {
          advanced = true;
          newPhase = pmResult.new_phase;
          phaseName = PHASE_NAMES[pmResult.new_phase] || `Fase ${pmResult.new_phase}`;
        } else if (pmResult?.next_criteria) {
          nextCriteria = pmResult.next_criteria;
        }
      } catch {
        // Phase manager optional
      }

      setConclusionData({ igi, streak: newStreak, advanced, newPhase, phaseName, nextCriteria });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao concluir sessão", variant: "destructive" });
    } finally {
      setConclusionLoading(false);
    }
  }, [conclusionLoading, conclusionData, userPhase, scales, sessionId, user, toast]);

  useEffect(() => {
    if (currentStep === 7 && !conclusionData && !conclusionLoading) {
      handleConclusion();
    }
  }, [currentStep, handleConclusion, conclusionData, conclusionLoading]);

  // ─── Render Helpers ──────────────────────────────────────────

  if (authLoading || initializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (completedSession) {
    return (
      <SessionComplete
        session={completedSession}
        streak={userPhase?.streak_current || 0}
      />
    );
  }

  const phase = userPhase?.current_phase || 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Stepper */}
      <div className="pt-6 pb-4 px-4 border-b border-border">
        <SessionStepper currentStep={currentStep} totalSteps={TOTAL_STEPS} />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center p-4 pt-8">
        <div className="w-full max-w-lg">
          {/* ─── Step 1: Check-in ──────────────────────────── */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  Como você está se sentindo agora?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Escolha o que mais se aproxima do seu estado atual
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {MOODS.map((mood) => (
                  <button
                    key={mood.key}
                    onClick={() => setSelectedMood(mood.key)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 hover:scale-[1.02]",
                      selectedMood === mood.key
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:border-muted-foreground/30"
                    )}
                  >
                    <span className="text-3xl">{mood.emoji}</span>
                    <span className="text-xs font-medium text-foreground">{mood.label}</span>
                  </button>
                ))}
              </div>

              <Button
                onClick={handleCheckIn}
                disabled={!selectedMood || saving}
                className="w-full"
                size="lg"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Continuar
              </Button>
            </div>
          )}

          {/* ─── Step 2: Mission ───────────────────────────── */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  Missão do dia
                </h2>
                <p className="text-sm text-muted-foreground">
                  Fase {phase} — {PHASE_NAMES[phase]}
                </p>
              </div>

              {missionLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : mission ? (
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">
                      {mission.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {mission.description}
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="secondary">
                        {MISSION_TYPE_ICONS[mission.type] || "📋"} {mission.type}
                      </Badge>
                      <Badge variant="outline">{mission.difficulty}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground">
                      Nenhuma missão disponível para esta fase. Reflita livremente sobre seu dia.
                    </p>
                  </CardContent>
                </Card>
              )}

              <Button onClick={() => setCurrentStep(3)} className="w-full" size="lg">
                Iniciar missão
              </Button>
            </div>
          )}

          {/* ─── Step 3: Register ──────────────────────────── */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  Registre sua reflexão
                </h2>
                <p className="text-sm text-muted-foreground">
                  O que essa missão despertou em você?
                </p>
              </div>

              <Textarea
                placeholder="Escreva livremente..."
                value={registroText}
                onChange={(e) => setRegistroText(e.target.value)}
                className="min-h-[160px] resize-none"
              />

              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {registroText.length} caracteres {registroText.length < 10 && "(mínimo 10)"}
                </span>
              </div>

              <Button
                onClick={handleRegister}
                disabled={registroText.length < 10 || saving}
                className="w-full"
                size="lg"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Registrar
              </Button>
            </div>
          )}

          {/* ─── Step 4: Scales ────────────────────────────── */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  Como você se avalia hoje?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Mova os controles para refletir seu estado atual
                </p>
              </div>

              <div className="space-y-6">
                {getDimensionsForPhase(phase).map((dim) => (
                  <div key={dim.key} className="space-y-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-medium text-foreground">{dim.label}</span>
                      <span className="text-lg font-bold text-primary">
                        {scales[dim.key] ?? 5}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{dim.description}</p>
                    <Slider
                      value={[scales[dim.key] ?? 5]}
                      onValueChange={([v]) =>
                        setScales((prev) => ({ ...prev, [dim.key]: v }))
                      }
                      min={0}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>0</span>
                      <span>10</span>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleScales}
                disabled={saving}
                className="w-full"
                size="lg"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Continuar
              </Button>
            </div>
          )}

          {/* ─── Step 5: Feedback ──────────────────────────── */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center space-y-2">
                <Sparkles className="w-8 h-8 text-primary mx-auto" />
                <h2 className="text-xl font-semibold text-foreground">
                  Seu feedback
                </h2>
              </div>

              {feedbackLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-6">
                    <p className="text-foreground leading-relaxed">{feedback}</p>
                  </CardContent>
                </Card>
              )}

              <Button
                onClick={() => setCurrentStep(6)}
                disabled={feedbackLoading}
                className="w-full"
                size="lg"
              >
                Continuar
              </Button>
            </div>
          )}

          {/* ─── Step 6: Reinforcement ─────────────────────── */}
          {currentStep === 6 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  Lembre-se
                </h2>
              </div>

              <Card className="bg-gradient-to-br from-primary/10 to-accent/20 border-primary/20">
                <CardContent className="p-8 text-center">
                  <p className="text-xl font-semibold text-primary leading-relaxed">
                    {PHASE_REINFORCEMENT[phase] || PHASE_REINFORCEMENT[1]}
                  </p>
                  <p className="text-sm text-muted-foreground mt-3">
                    Fase {phase} — {PHASE_NAMES[phase]}
                  </p>
                </CardContent>
              </Card>

              <Button
                onClick={handleReinforcement}
                disabled={saving}
                className="w-full"
                size="lg"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Concluir
              </Button>
            </div>
          )}

          {/* ─── Step 7: Conclusion ────────────────────────── */}
          {currentStep === 7 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              {conclusionLoading ? (
                <div className="flex flex-col items-center py-12 gap-4">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Finalizando sua sessão...</p>
                </div>
              ) : conclusionData ? (
                <>
                  {conclusionData.advanced ? (
                    <div className="text-center space-y-4">
                      <div className="text-6xl">🎉</div>
                      <h2 className="text-2xl font-bold text-foreground">
                        Você avançou para a Fase {conclusionData.newPhase}!
                      </h2>
                      <p className="text-lg text-primary font-medium">
                        {conclusionData.phaseName}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center space-y-2">
                      <div className="text-4xl">✅</div>
                      <h2 className="text-xl font-semibold text-foreground">
                        Sessão concluída!
                      </h2>
                    </div>
                  )}

                  <Card>
                    <CardContent className="p-6 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">IGI atual</span>
                        <span className="text-lg font-bold text-primary">
                          {conclusionData.igi}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Sequência</span>
                        <span className="text-sm font-medium">
                          🔥 {conclusionData.streak} {conclusionData.streak === 1 ? "dia" : "dias"}
                        </span>
                      </div>
                      {conclusionData.nextCriteria && (
                        <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                          Continue assim. {conclusionData.nextCriteria}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => navigate("/chat")}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Voltar ao chat
                    </Button>
                    <Button className="flex-1" onClick={() => navigate("/profile")}>
                      <User className="w-4 h-4 mr-2" />
                      Ver minha jornada
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Session;
