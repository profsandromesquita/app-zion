import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const formSchema = z.object({
  userId: z.string().uuid("Selecione um usuário"),
  justification: z
    .string()
    .min(20, "Justificativa deve ter no mínimo 20 caracteres")
    .max(1000, "Justificativa deve ter no máximo 1000 caracteres"),
});

type FormValues = z.infer<typeof formSchema>;

interface EligibleUser {
  id: string;
  nome: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface NewApplicationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  sponsorRole: AppRole;
}

const NewApplicationForm = ({
  open,
  onOpenChange,
  onSuccess,
  sponsorRole,
}: NewApplicationFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [eligibleUsers, setEligibleUsers] = useState<EligibleUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<EligibleUser | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: "",
      justification: "",
    },
  });

  useEffect(() => {
    if (open) {
      loadEligibleUsers();
    }
  }, [open]);

  const loadEligibleUsers = async () => {
    setLoadingUsers(true);

    try {
      // Fetch all profiles, existing applications, and existing soldados in parallel
      const [profilesRes, applicationsRes, soldadosRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, nome, email, avatar_url")
          .order("nome"),
        supabase
          .from("soldado_applications")
          .select("user_id")
          .in("status", ["pending", "testimony_required", "under_review"]),
        supabase.from("user_roles").select("user_id").eq("role", "soldado"),
      ]);

      const profiles = profilesRes.data || [];
      const existingApplicationUserIds = new Set(
        (applicationsRes.data || []).map((a) => a.user_id)
      );
      const existingSoldadoUserIds = new Set(
        (soldadosRes.data || []).map((s) => s.user_id)
      );

      // Filter out users who already are soldados or have pending applications
      const eligible = profiles.filter(
        (p) =>
          !existingApplicationUserIds.has(p.id) &&
          !existingSoldadoUserIds.has(p.id)
      );

      setEligibleUsers(eligible);
    } catch (error) {
      console.error("Error loading eligible users:", error);
      toast({
        title: "Erro ao carregar usuários",
        description: "Não foi possível carregar a lista de usuários elegíveis.",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (!user) return;

    setLoading(true);

    try {
      // Double-check if user already has an application
      const { data: existing } = await supabase
        .from("soldado_applications")
        .select("id")
        .eq("user_id", values.userId)
        .in("status", ["pending", "testimony_required", "under_review"])
        .maybeSingle();

      if (existing) {
        toast({
          title: "Usuário já possui candidatura",
          description:
            "Este usuário já possui uma candidatura em andamento.",
          variant: "destructive",
        });
        return;
      }

      // Create application
      const { error } = await supabase.from("soldado_applications").insert({
        user_id: values.userId,
        sponsored_by: user.id,
        sponsor_role: sponsorRole,
        status: "testimony_required",
      });

      if (error) throw error;

      toast({
        title: "Candidatura criada",
        description:
          "O usuário foi indicado para Soldado e precisa gravar seu testemunho.",
      });

      form.reset();
      setSelectedUser(null);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating application:", error);
      toast({
        title: "Erro ao criar candidatura",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (userId: string) => {
    const user = eligibleUsers.find((u) => u.id === userId);
    setSelectedUser(user || null);
    form.setValue("userId", userId);
    setComboboxOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Candidatura a Soldado</DialogTitle>
          <DialogDescription>
            Indique um usuário para se tornar Soldado. Ele precisará gravar seu
            testemunho e passar pela aprovação de Admin, Profissional e Pastor.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Usuário</FormLabel>
                  <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={comboboxOpen}
                          className="w-full justify-between"
                          disabled={loadingUsers}
                        >
                          {loadingUsers ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Carregando...
                            </span>
                          ) : selectedUser ? (
                            <span className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={selectedUser.avatar_url || undefined} />
                                <AvatarFallback className="text-[10px]">
                                  {selectedUser.nome?.charAt(0) || "U"}
                                </AvatarFallback>
                              </Avatar>
                              {selectedUser.nome || selectedUser.email}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              Selecione um usuário...
                            </span>
                          )}
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar usuário..." />
                        <CommandList>
                          <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                          <CommandGroup>
                            {eligibleUsers.map((eligibleUser) => (
                              <CommandItem
                                key={eligibleUser.id}
                                value={`${eligibleUser.nome || ""} ${eligibleUser.email || ""}`}
                                onSelect={() => handleUserSelect(eligibleUser.id)}
                              >
                                <Avatar className="h-6 w-6 mr-2">
                                  <AvatarImage src={eligibleUser.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                                    {eligibleUser.nome?.charAt(0) || <User className="h-3 w-3" />}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {eligibleUser.nome || "Sem nome"}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {eligibleUser.email}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Apenas usuários sem candidatura ativa e que não são Soldados
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="justification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Justificativa da Indicação</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Por que esta pessoa deveria ser um Soldado? Descreva brevemente sua jornada de transformação..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Mínimo 20 caracteres. Esta justificativa será visível para os
                    aprovadores.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Candidatura
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default NewApplicationForm;
