import { Users, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SoldadoConnectionTeaserProps {
  className?: string;
}

const SoldadoConnectionTeaser = ({ className }: SoldadoConnectionTeaserProps) => {
  return (
    <Card className={`border-muted bg-muted/30 ${className}`}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-muted p-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">
                Conexão com Soldados
              </h3>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Em algum momento da sua jornada, podemos sugerir conversar com alguém 
              que passou por algo parecido. Isso acontece naturalmente quando 
              identificamos que você pode se beneficiar dessa conexão.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Disponível durante a jornada
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SoldadoConnectionTeaser;
