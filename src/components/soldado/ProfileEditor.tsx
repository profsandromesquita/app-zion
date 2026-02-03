import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Save, Plus, X } from "lucide-react";

const profileSchema = z.object({
  display_name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(50),
  bio: z.string().max(500, "Bio deve ter no máximo 500 caracteres").optional(),
  is_available: z.boolean(),
  max_weekly_sessions: z.number().min(1).max(20),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface SoldadoProfile {
  id: string;
  display_name: string | null;
  bio: string | null;
  specialties: string[];
  is_available: boolean;
  max_weekly_sessions: number;
  testimony_id: string | null;
}

interface ProfileEditorProps {
  profile: SoldadoProfile;
  onUpdate: () => void;
}

// Especialidades sugeridas baseadas na taxonomia ZION
const SUGGESTED_SPECIALTIES = [
  "Ansiedade",
  "Depressão",
  "Luto",
  "Vícios",
  "Relacionamentos",
  "Família",
  "Casamento",
  "Finanças",
  "Carreira",
  "Identidade",
  "Perdão",
  "Traumas",
  "Abuso",
  "Solidão",
  "Medo",
  "Raiva",
];

export const ProfileEditor = ({ profile, onUpdate }: ProfileEditorProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [specialties, setSpecialties] = useState<string[]>(profile.specialties || []);
  const [newSpecialty, setNewSpecialty] = useState("");

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: profile.display_name || "",
      bio: profile.bio || "",
      is_available: profile.is_available,
      max_weekly_sessions: profile.max_weekly_sessions,
    },
  });

  const handleAddSpecialty = (specialty: string) => {
    const trimmed = specialty.trim();
    if (trimmed && !specialties.includes(trimmed) && specialties.length < 10) {
      setSpecialties([...specialties, trimmed]);
      setNewSpecialty("");
    }
  };

  const handleRemoveSpecialty = (specialty: string) => {
    setSpecialties(specialties.filter((s) => s !== specialty));
  };

  const onSubmit = async (values: ProfileFormValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("soldado_profiles")
        .update({
          display_name: values.display_name,
          bio: values.bio || null,
          is_available: values.is_available,
          max_weekly_sessions: values.max_weekly_sessions,
          specialties,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });
      onUpdate();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meu Perfil de Soldado</CardTitle>
        <CardDescription>
          Configure como você aparece para os buscadores que precisam de ajuda
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome de exibição</FormLabel>
                  <FormControl>
                    <Input placeholder="Como você quer ser chamado" {...field} />
                  </FormControl>
                  <FormDescription>
                    Este nome será visível para os buscadores
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sobre minha jornada</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Compartilhe brevemente sua experiência e como você pode ajudar..."
                      className="min-h-[100px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value?.length || 0}/500 caracteres
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <FormLabel>Especialidades</FormLabel>
              <FormDescription>
                Selecione áreas onde você tem experiência para ajudar (máximo 10)
              </FormDescription>
              
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_SPECIALTIES.filter((s) => !specialties.includes(s)).map((specialty) => (
                  <Badge
                    key={specialty}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/10"
                    onClick={() => handleAddSpecialty(specialty)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {specialty}
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar outra especialidade..."
                  value={newSpecialty}
                  onChange={(e) => setNewSpecialty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSpecialty(newSpecialty);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAddSpecialty(newSpecialty)}
                  disabled={!newSpecialty.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {specialties.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
                  {specialties.map((specialty) => (
                    <Badge key={specialty} variant="secondary">
                      {specialty}
                      <button
                        type="button"
                        onClick={() => handleRemoveSpecialty(specialty)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="is_available"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <FormLabel>Disponível para conexões</FormLabel>
                      <FormDescription>
                        Desative para pausar temporariamente
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_weekly_sessions"
                render={({ field }) => (
                  <FormItem className="p-4 border rounded-lg">
                    <FormLabel>Sessões por semana</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormDescription>
                      Máximo de novas conexões por semana
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Perfil
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
