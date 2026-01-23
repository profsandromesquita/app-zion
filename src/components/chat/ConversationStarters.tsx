import { Button } from "@/components/ui/button";
import { DEFAULT_STARTERS, StarterItem } from "@/hooks/usePersonalizedStarters";

interface ConversationStartersProps {
  onSelect: (text: string) => void;
  disabled?: boolean;
  starters?: StarterItem[];
}

export const ConversationStarters = ({ 
  onSelect, 
  disabled, 
  starters = DEFAULT_STARTERS 
}: ConversationStartersProps) => {
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-muted-foreground text-center">
        💭 Você pode responder ou clicar aqui:
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {starters.map((starter) => (
          <Button
            key={starter.text}
            variant="outline"
            size="sm"
            className="text-xs px-3 py-2 h-auto whitespace-normal text-left hover:bg-primary/10 hover:border-primary/30 transition-colors"
            onClick={() => onSelect(starter.text)}
            disabled={disabled}
          >
            <span className="mr-1.5">{starter.emoji}</span>
            {starter.text}
          </Button>
        ))}
      </div>
    </div>
  );
};
