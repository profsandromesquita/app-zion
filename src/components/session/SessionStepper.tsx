import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionStepperProps {
  currentStep: number;
  totalSteps: number;
}

const stepLabels = [
  "Check-in",
  "Missão",
  "Registro",
  "Escalas",
  "Feedback",
  "Reforço",
  "Conclusão",
];

const SessionStepper = ({ currentStep, totalSteps }: SessionStepperProps) => {
  return (
    <div className="w-full px-2">
      <div className="flex items-center justify-between max-w-md mx-auto">
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;

          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300",
                    isCompleted &&
                      "bg-primary text-primary-foreground",
                    isCurrent &&
                      "bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110",
                    !isCompleted &&
                      !isCurrent &&
                      "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    step
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] hidden sm:block transition-colors",
                    isCurrent
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {stepLabels[i]}
                </span>
              </div>
              {step < totalSteps && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-1 transition-colors duration-300",
                    isCompleted ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SessionStepper;
