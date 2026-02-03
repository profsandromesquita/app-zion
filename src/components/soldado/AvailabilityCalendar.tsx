import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Clock } from "lucide-react";

interface TimeSlot {
  id: string;
  soldado_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_recurring: boolean;
  specific_date: string | null;
}

interface AvailabilityCalendarProps {
  soldadoId: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

const TIME_OPTIONS = Array.from({ length: 24 }, (_, hour) => {
  const hourStr = hour.toString().padStart(2, "0");
  return [
    { value: `${hourStr}:00`, label: `${hourStr}:00` },
    { value: `${hourStr}:30`, label: `${hourStr}:30` },
  ];
}).flat();

export const AvailabilityCalendar = ({ soldadoId }: AvailabilityCalendarProps) => {
  const { toast } = useToast();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estado para novo slot
  const [newSlot, setNewSlot] = useState({
    day_of_week: 1,
    start_time: "09:00",
    end_time: "12:00",
  });

  const fetchSlots = async () => {
    try {
      const { data, error } = await supabase
        .from("soldado_availability")
        .select("*")
        .eq("soldado_id", soldadoId)
        .eq("is_recurring", true)
        .order("day_of_week")
        .order("start_time");

      if (error) throw error;
      setSlots(data || []);
    } catch (error) {
      console.error("Error fetching availability:", error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar sua disponibilidade.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [soldadoId]);

  const handleAddSlot = async () => {
    // Validar horários
    if (newSlot.start_time >= newSlot.end_time) {
      toast({
        title: "Horário inválido",
        description: "O horário de início deve ser antes do término.",
        variant: "destructive",
      });
      return;
    }

    // Verificar conflitos
    const hasConflict = slots.some(
      (slot) =>
        slot.day_of_week === newSlot.day_of_week &&
        ((newSlot.start_time >= slot.start_time && newSlot.start_time < slot.end_time) ||
          (newSlot.end_time > slot.start_time && newSlot.end_time <= slot.end_time) ||
          (newSlot.start_time <= slot.start_time && newSlot.end_time >= slot.end_time))
    );

    if (hasConflict) {
      toast({
        title: "Conflito de horário",
        description: "Já existe um horário cadastrado neste período.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("soldado_availability").insert({
        soldado_id: soldadoId,
        day_of_week: newSlot.day_of_week,
        start_time: newSlot.start_time,
        end_time: newSlot.end_time,
        timezone: "America/Sao_Paulo",
        is_recurring: true,
      });

      if (error) throw error;

      toast({
        title: "Horário adicionado",
        description: "Sua disponibilidade foi atualizada.",
      });
      
      fetchSlots();
    } catch (error) {
      console.error("Error adding slot:", error);
      toast({
        title: "Erro ao adicionar",
        description: "Não foi possível adicionar o horário.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      const { error } = await supabase
        .from("soldado_availability")
        .delete()
        .eq("id", slotId);

      if (error) throw error;

      toast({
        title: "Horário removido",
        description: "Sua disponibilidade foi atualizada.",
      });
      
      setSlots(slots.filter((s) => s.id !== slotId));
    } catch (error) {
      console.error("Error deleting slot:", error);
      toast({
        title: "Erro ao remover",
        description: "Não foi possível remover o horário.",
        variant: "destructive",
      });
    }
  };

  const formatTime = (time: string) => {
    return time.slice(0, 5);
  };

  // Agrupar slots por dia da semana
  const slotsByDay = DAYS_OF_WEEK.map((day) => ({
    ...day,
    slots: slots.filter((s) => s.day_of_week === day.value),
  }));

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Horários Disponíveis
        </CardTitle>
        <CardDescription>
          Configure os horários em que você está disponível para conversas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Adicionar novo horário */}
        <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
          <h4 className="font-medium text-sm">Adicionar novo horário</h4>
          <div className="grid gap-3 sm:grid-cols-4">
            <Select
              value={newSlot.day_of_week.toString()}
              onValueChange={(v) => setNewSlot({ ...newSlot, day_of_week: parseInt(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Dia" />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((day) => (
                  <SelectItem key={day.value} value={day.value.toString()}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={newSlot.start_time}
              onValueChange={(v) => setNewSlot({ ...newSlot, start_time: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Início" />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((time) => (
                  <SelectItem key={time.value} value={time.value}>
                    {time.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={newSlot.end_time}
              onValueChange={(v) => setNewSlot({ ...newSlot, end_time: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Término" />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((time) => (
                  <SelectItem key={time.value} value={time.value}>
                    {time.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleAddSlot} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Grade semanal */}
        <div className="space-y-3">
          {slotsByDay.map((day) => (
            <div
              key={day.value}
              className={`flex items-start gap-4 p-3 rounded-lg border ${
                day.slots.length > 0 ? "bg-primary/5 border-primary/20" : "bg-muted/30"
              }`}
            >
              <div className="w-24 font-medium text-sm pt-1">{day.label}</div>
              <div className="flex-1 flex flex-wrap gap-2">
                {day.slots.length === 0 ? (
                  <span className="text-sm text-muted-foreground">Sem horários</span>
                ) : (
                  day.slots.map((slot) => (
                    <Badge
                      key={slot.id}
                      variant="secondary"
                      className="flex items-center gap-2 py-1.5"
                    >
                      <Clock className="h-3 w-3" />
                      {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                      <button
                        onClick={() => handleDeleteSlot(slot.id)}
                        className="ml-1 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        {slots.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum horário cadastrado</p>
            <p className="text-sm">Adicione seus horários disponíveis para começar</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
