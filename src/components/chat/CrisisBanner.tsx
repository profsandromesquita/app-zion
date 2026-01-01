import { useState, useEffect } from "react";
import { AlertTriangle, Phone, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CrisisBannerProps {
  visible: boolean;
  onDismiss?: () => void;
}

const CRISIS_CONTACTS = [
  { name: "CVV", number: "188", description: "24h - Ligação gratuita" },
  { name: "SAMU", number: "192", description: "Emergência médica" },
];

export const CrisisBanner = ({ visible, onDismiss }: CrisisBannerProps) => {
  const [isVisible, setIsVisible] = useState(visible);

  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  // Auto-hide after 60 seconds
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, 60000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onDismiss]);

  const handleQuickExit = () => {
    window.location.replace("https://www.google.com");
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  return (
    <div className="relative bg-destructive px-4 py-3 text-destructive-foreground">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Você não está sozinho(a)</p>
            <p className="text-sm opacity-90">
              Se precisar de ajuda imediata, ligue agora:
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CRISIS_CONTACTS.map((contact) => (
            <a
              key={contact.number}
              href={`tel:${contact.number}`}
              className="flex items-center gap-1.5 rounded-md bg-background/20 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-background/30"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>{contact.name}: {contact.number}</span>
            </a>
          ))}
          <a
            href="https://www.cvv.org.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md bg-background/20 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-background/30"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>CVV Chat</span>
          </a>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleQuickExit}
            className="bg-background/20 text-destructive-foreground hover:bg-background/30"
          >
            Sair Rápido
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive-foreground hover:bg-background/20"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
