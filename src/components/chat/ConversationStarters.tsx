import { Button } from "@/components/ui/button";

interface ConversationStartersProps {
  onSelect: (text: string) => void;
  disabled?: boolean;
}

const STARTERS = [
  { text: "Estou me sentindo ansioso(a)", emoji: "😰" },
  { text: "Tenho um peso no coração", emoji: "💔" },
  { text: "Preciso desabafar sobre algo", emoji: "💬" },
  { text: "Não sei por onde começar...", emoji: "🤔" },
  { text: "Só preciso de alguém para ouvir", emoji: "👂" },
];

export const ConversationStarters = ({ onSelect, disabled }: ConversationStartersProps) => {
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-muted-foreground text-center">
        💭 Você pode responder ou clicar aqui:
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {STARTERS.map((starter) => (
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
