import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  User,
  Calendar,
  Clock,
  ChevronRight,
  X,
  MessageCircle,
  Headphones,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface AvailabilitySlot {
  day_of_week: number;
  day_name: string;
  start_time: string;
  end_time: string;
  is_today: boolean;
  is_tomorrow: boolean;
}

export interface SoldadoMatch {
  soldado_id: string;
  display_name: string;
  bio: string | null;
  specialties: string[];
  scenario_match: boolean;
  matrix_match: boolean;
  semantic_score: number;
  total_score: number;
  testimony_excerpt: string;
  available_slots: AvailabilitySlot[];
  testimony_id?: string;
}

export type RejectionReason =
  | "schedule_mismatch"
  | "not_good_match"
  | "not_ready"
  | "prefer_ai";

export interface SoldadoSuggestionCardProps {
  soldado: SoldadoMatch;
  suggestionText: string;
  fallbackType?: "generalist" | "passive" | "ai_only" | null;
  onAccept: (soldadoId: string) => void;
  onReject: (soldadoId: string, reason: RejectionReason) => void;
  onViewOthers: () => void;
  onListenTestimony?: (testimonyId: string) => void;
  isLoading?: boolean;
}

export function SoldadoSuggestionCard({
  soldado,
  suggestionText,
  fallbackType,
  onAccept,
  onReject,
  onViewOthers,
  onListenTestimony,
  isLoading = false,
}: SoldadoSuggestionCardProps) {
  const [showRejectOptions, setShowRejectOptions] = useState(false);

  const getMatchBadge = () => {
    if (soldado.scenario_match && soldado.matrix_match) {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
          Match forte
        </Badge>
      );
    }
    if (soldado.scenario_match || soldado.matrix_match) {
      return (
        <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
          Match parcial
        </Badge>
      );
    }
    if (fallbackType === "generalist") {
      return (
        <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
          Generalista
        </Badge>
      );
    }
    return null;
  };

  const formatTime = (time: string) => {
    // Convert "HH:MM:SS" to "HH:MM"
    return time?.substring(0, 5) || time;
  };

  const getNextAvailableText = () => {
    const slots = soldado.available_slots;
    if (!slots || slots.length === 0) return null;

    const todaySlot = slots.find((s) => s.is_today);
    const tomorrowSlot = slots.find((s) => s.is_tomorrow);

    if (todaySlot) {
      return `Disponível hoje às ${formatTime(todaySlot.start_time)}`;
    }
    if (tomorrowSlot) {
      return `Disponível amanhã às ${formatTime(tomorrowSlot.start_time)}`;
    }
    const nextSlot = slots[0];
    return `Próximo horário: ${nextSlot.day_name} às ${formatTime(nextSlot.start_time)}`;
  };

  const rejectionOptions = [
    {
      reason: "schedule_mismatch" as RejectionReason,
      label: "Horários não batem",
      icon: Calendar,
    },
    {
      reason: "not_good_match" as RejectionReason,
      label: "Não parece bom match",
      icon: X,
    },
    {
      reason: "not_ready" as RejectionReason,
      label: "Não estou pronto(a)",
      icon: Headphones,
    },
    {
      reason: "prefer_ai" as RejectionReason,
      label: "Prefiro continuar com IA",
      icon: MessageCircle,
    },
  ];

  return (
    <Card className="border-primary/20 bg-card/95 backdrop-blur-sm shadow-lg animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-primary/20">
              <AvatarImage src={undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                <User className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base font-semibold">
                {soldado.display_name}
              </CardTitle>
              {getMatchBadge()}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Suggestion text from AI */}
        <p className="text-sm text-muted-foreground italic">
          "{suggestionText}"
        </p>

        {/* Bio */}
        {soldado.bio && (
          <p className="text-sm text-foreground line-clamp-2">{soldado.bio}</p>
        )}

        {/* Testimony excerpt */}
        {soldado.testimony_excerpt && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Do testemunho:</p>
            <p className="text-sm text-foreground/80 italic line-clamp-3">
              "{soldado.testimony_excerpt}..."
            </p>
          </div>
        )}

        {/* Specialties */}
        {soldado.specialties && soldado.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {soldado.specialties.slice(0, 4).map((specialty, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {specialty}
              </Badge>
            ))}
          </div>
        )}

        {/* Availability */}
        {getNextAvailableText() && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{getNextAvailableText()}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2 pt-0">
        {/* Primary actions */}
        <div className="flex w-full gap-2">
          <Button
            onClick={() => onAccept(soldado.soldado_id)}
            disabled={isLoading}
            className="flex-1 bg-gradient-to-r from-emerald-500 to-lime-500 text-white hover:opacity-90"
          >
            Quero conhecer
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>

          <DropdownMenu open={showRejectOptions} onOpenChange={setShowRejectOptions}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isLoading}>
                Agora não
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {rejectionOptions.map((option) => (
                <DropdownMenuItem
                  key={option.reason}
                  onClick={() => {
                    setShowRejectOptions(false);
                    onReject(soldado.soldado_id, option.reason);
                  }}
                  className="cursor-pointer"
                >
                  <option.icon className="mr-2 h-4 w-4" />
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Secondary actions */}
        <div className="flex w-full gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewOthers}
            disabled={isLoading}
            className="flex-1 text-muted-foreground"
          >
            Ver outros
          </Button>

          {soldado.testimony_id && onListenTestimony && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onListenTestimony(soldado.testimony_id!)}
              disabled={isLoading}
              className="flex-1 text-muted-foreground"
            >
              <Headphones className="mr-1 h-4 w-4" />
              Ouvir testemunho
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
