import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, ChevronLeft, Loader2 } from "lucide-react";
import type { AvailabilitySlot } from "./SoldadoSuggestionCard";

interface TimeSlotPickerProps {
  slots: AvailabilitySlot[];
  soldadoName: string;
  onConfirm: (slot: AvailabilitySlot) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function TimeSlotPicker({
  slots,
  soldadoName,
  onConfirm,
  onCancel,
  isLoading = false,
}: TimeSlotPickerProps) {
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);

  // Group slots by day
  const groupedSlots = slots.reduce((acc, slot) => {
    const key = slot.is_today 
      ? "Hoje" 
      : slot.is_tomorrow 
        ? "Amanhã" 
        : slot.day_name;
    
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(slot);
    return acc;
  }, {} as Record<string, AvailabilitySlot[]>);

  // Sort days: Hoje > Amanhã > rest alphabetically by day_of_week
  const sortedDays = Object.keys(groupedSlots).sort((a, b) => {
    if (a === "Hoje") return -1;
    if (b === "Hoje") return 1;
    if (a === "Amanhã") return -1;
    if (b === "Amanhã") return 1;
    return groupedSlots[a][0].day_of_week - groupedSlots[b][0].day_of_week;
  });

  const formatTime = (time: string) => {
    return time?.substring(0, 5) || time;
  };

  return (
    <Card className="border-primary/20 bg-card/95 backdrop-blur-sm shadow-lg animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            disabled={isLoading}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle className="text-base font-semibold">
              Escolha um horário
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              para conversar com {soldadoName}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {sortedDays.map((day) => (
          <div key={day} className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {day}
                {(day === "Hoje" || day === "Amanhã") && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {day}
                  </Badge>
                )}
              </span>
            </div>
            
            <div className="flex flex-wrap gap-2 pl-6">
              {groupedSlots[day].map((slot, idx) => {
                const isSelected = 
                  selectedSlot?.day_of_week === slot.day_of_week &&
                  selectedSlot?.start_time === slot.start_time;

                return (
                  <button
                    key={`${slot.day_of_week}-${slot.start_time}-${idx}`}
                    onClick={() => setSelectedSlot(slot)}
                    disabled={isLoading}
                    className={`
                      flex items-center gap-1.5 px-3 py-2 rounded-full text-sm
                      border transition-all duration-200
                      ${isSelected 
                        ? "bg-primary text-primary-foreground border-primary shadow-md" 
                        : "bg-card hover:bg-muted border-border hover:border-primary/50"
                      }
                      ${isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                    `}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {slots.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Nenhum horário disponível no momento</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2 pt-0">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1"
        >
          Voltar
        </Button>
        <Button
          onClick={() => selectedSlot && onConfirm(selectedSlot)}
          disabled={!selectedSlot || isLoading}
          className="flex-1 bg-gradient-to-r from-emerald-500 to-lime-500 text-white hover:opacity-90"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Agendando...
            </>
          ) : (
            "Confirmar horário"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
