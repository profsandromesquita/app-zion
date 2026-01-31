import { useState } from "react";
import { Heart, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface OnboardingData {
  name: string;
  grammar_gender: "M" | "F" | "N";
  spiritual_maturity: "CONSOLIDATED" | "DISTANT" | "CRISIS" | "SEEKER" | "SKEPTIC";
  initial_pain_focus: string[];
}

interface OnboardingFlowProps {
  onComplete: (data: OnboardingData) => void;
  onSkip?: () => void;
}

const GENDER_OPTIONS = [
  { value: "M", label: "Masculino", description: "ele / filho" },
  { value: "F", label: "Feminino", description: "ela / filha" },
  { value: "N", label: "Prefiro não especificar", description: "forma neutra" },
] as const;

const MATURITY_OPTIONS = [
  { value: "CONSOLIDATED", label: "Tenho fé e busco crescer", emoji: "🕊️" },
  { value: "DISTANT", label: "Acredito, mas estou distante", emoji: "🌅" },
  { value: "CRISIS", label: "Estou com raiva ou decepcionado(a) com Deus", emoji: "⛈️" },
  { value: "SEEKER", label: "Não tenho certeza no que acredito", emoji: "🔍" },
  { value: "SKEPTIC", label: "Não acredito em Deus", emoji: "🤔" },
] as const;

const PAIN_TAGS = [
  "Ansiedade",
  "Medo",
  "Casamento",
  "Família",
  "Vício",
  "Hábito",
  "Tristeza",
  "Luto",
  "Raiva",
  "Injustiça",
  "Vazio",
  "Propósito",
];

export function OnboardingFlow({ onComplete, onSkip }: OnboardingFlowProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<OnboardingData>({
    name: "",
    grammar_gender: "N",
    spiritual_maturity: "SEEKER",
    initial_pain_focus: [],
  });

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.name.trim().length >= 2;
      case 2:
        return !!formData.grammar_gender;
      case 3:
        return !!formData.spiritual_maturity;
      case 4:
        return true; // Optional step
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      onComplete(formData);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const togglePainTag = (tag: string) => {
    setFormData((prev) => {
      const current = prev.initial_pain_focus;
      if (current.includes(tag)) {
        return { ...prev, initial_pain_focus: current.filter((t) => t !== tag) };
      }
      if (current.length >= 3) {
        return prev; // Max 3 tags
      }
      return { ...prev, initial_pain_focus: [...current, tag] };
    });
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="animate-fade-in space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-foreground">
                Como prefere ser chamado?
              </h2>
              <p className="mt-2 text-muted-foreground">
                Queremos te conhecer pelo nome que você se sente confortável
              </p>
            </div>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Seu nome ou apelido"
              className="text-center text-lg h-14"
              autoFocus
            />
          </div>
        );

      case 2:
        return (
          <div className="animate-fade-in space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-foreground">
                Como devo me referir a você?
              </h2>
              <p className="mt-2 text-muted-foreground">
                Isso nos ajuda a falar de forma mais natural com você
              </p>
            </div>
            <div className="grid gap-3">
              {GENDER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    setFormData({ ...formData, grammar_gender: option.value })
                  }
                  className={cn(
                    "flex items-center justify-between rounded-xl border-2 p-4 text-left transition-all",
                    formData.grammar_gender === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <div>
                    <span className="font-medium text-foreground">{option.label}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      ({option.description})
                    </span>
                  </div>
                  {formData.grammar_gender === option.value && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="animate-fade-in space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-foreground">
                Como você descreveria sua relação com Deus hoje?
              </h2>
              <p className="mt-2 text-muted-foreground">
                Não existe resposta certa ou errada. Queremos respeitar onde você está
              </p>
            </div>
            <div className="grid gap-3">
              {MATURITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    setFormData({ ...formData, spiritual_maturity: option.value })
                  }
                  className={cn(
                    "flex items-center justify-between rounded-xl border-2 p-4 text-left transition-all",
                    formData.spiritual_maturity === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{option.emoji}</span>
                    <span className="font-medium text-foreground">{option.label}</span>
                  </div>
                  {formData.spiritual_maturity === option.value && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="animate-fade-in space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-foreground">
                O que pesa mais no seu coração agora?
              </h2>
              <p className="mt-2 text-muted-foreground">
                Você pode escolher até 3 opções ou pular esta etapa
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {PAIN_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => togglePainTag(tag)}
                  className={cn(
                    "rounded-full border-2 px-4 py-2 text-sm font-medium transition-all",
                    formData.initial_pain_focus.includes(tag)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
            {formData.initial_pain_focus.length > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                {formData.initial_pain_focus.length}/3 selecionados
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header with progress */}
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-lg">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Heart className="h-5 w-5 text-primary" />
              </div>
              <span className="font-medium text-foreground">Zyon</span>
            </div>
            <div className="flex-1 flex justify-end">
              {onSkip && (
                <button
                  type="button"
                  onClick={onSkip}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Pular
                </button>
              )}
            </div>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Passo {step} de {totalSteps}
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">{renderStep()}</div>
      </main>

      {/* Footer with navigation */}
      <footer className="border-t border-border px-4 py-4">
        <div className="mx-auto flex max-w-lg justify-between gap-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 1}
            className="flex-1"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="flex-1"
          >
            {step === totalSteps ? (
              <>
                Começar
                <Heart className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Continuar
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
        {step === 4 && (
          <button
            onClick={() => {
              setFormData({ ...formData, initial_pain_focus: [] });
              onComplete({ ...formData, initial_pain_focus: [] });
            }}
            className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Prefiro não dizer
          </button>
        )}
      </footer>
    </div>
  );
}
