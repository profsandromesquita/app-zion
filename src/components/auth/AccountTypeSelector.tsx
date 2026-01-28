import { User, Church, Brain } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AccountType = "buscador" | "igreja" | "profissional";

interface AccountTypeSelectorProps {
  selected: AccountType | null;
  onSelect: (type: AccountType) => void;
}

const accountTypes = [
  {
    type: "buscador" as const,
    icon: User,
    title: "Buscador",
    description: "Estou em busca de acolhimento e transformação pessoal",
  },
  {
    type: "igreja" as const,
    icon: Church,
    title: "Igreja",
    description: "Sou uma igreja e quero ser um ponto de apoio",
  },
  {
    type: "profissional" as const,
    icon: Brain,
    title: "Profissional",
    description: "Sou psicólogo, psiquiatra ou terapeuta",
  },
];

export function AccountTypeSelector({ selected, onSelect }: AccountTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium text-foreground">Escolha seu perfil</h3>
        <p className="text-sm text-muted-foreground">
          Selecione o tipo de conta que melhor representa você
        </p>
      </div>

      <div className="grid gap-3">
        {accountTypes.map(({ type, icon: Icon, title, description }) => (
          <Card
            key={type}
            className={cn(
              "cursor-pointer transition-all hover:border-primary/50",
              selected === type && "border-primary ring-2 ring-primary/20"
            )}
            onClick={() => onSelect(type)}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                  selected === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground">{title}</h4>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border border-muted bg-muted/50 p-3">
        <p className="text-center text-sm text-muted-foreground">
          <strong>Soldados</strong> e <strong>Pastores</strong> são cadastrados pela Igreja
        </p>
      </div>
    </div>
  );
}
