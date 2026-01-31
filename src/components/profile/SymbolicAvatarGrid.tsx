import { useState, forwardRef } from "react";
import { SYMBOLIC_AVATARS, SymbolicAvatar } from "@/data/symbolicAvatars";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SymbolicAvatarGridProps {
  selectedAvatarId: string | null;
  onSelect: (avatar: SymbolicAvatar) => void;
}

interface AvatarButtonProps {
  avatar: SymbolicAvatar;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const AvatarButton = forwardRef<HTMLButtonElement, AvatarButtonProps>(
  ({ avatar, isSelected, onClick, onMouseEnter, onMouseLeave }, ref) => (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "relative aspect-square rounded-xl overflow-hidden transition-all duration-200",
        "border-2 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        isSelected
          ? "border-primary ring-2 ring-primary ring-offset-2"
          : "border-border hover:border-primary/50"
      )}
    >
      <img
        src={avatar.imagePath}
        alt={avatar.name}
        className="w-full h-full object-cover"
      />
      {isSelected && (
        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}
    </button>
  )
);
AvatarButton.displayName = "AvatarButton";

const SymbolicAvatarGrid = ({ selectedAvatarId, onSelect }: SymbolicAvatarGridProps) => {
  const [hoveredAvatar, setHoveredAvatar] = useState<SymbolicAvatar | null>(null);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Ou escolha um avatar simbólico
        </p>
      </div>

      <TooltipProvider delayDuration={300}>
        <div className="grid grid-cols-5 gap-3">
          {SYMBOLIC_AVATARS.map((avatar) => (
            <Tooltip key={avatar.id}>
              <TooltipTrigger asChild>
                <AvatarButton
                  avatar={avatar}
                  isSelected={selectedAvatarId === avatar.id}
                  onClick={() => onSelect(avatar)}
                  onMouseEnter={() => setHoveredAvatar(avatar)}
                  onMouseLeave={() => setHoveredAvatar(null)}
                />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="font-medium">{avatar.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{avatar.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      {/* Description panel for selected/hovered avatar */}
      <div className="min-h-[80px] p-4 rounded-lg bg-muted/50 border border-border">
        {(hoveredAvatar || (selectedAvatarId && SYMBOLIC_AVATARS.find(a => a.id === selectedAvatarId))) ? (
          <div className="space-y-1">
            <p className="font-medium text-sm">
              {hoveredAvatar?.name || SYMBOLIC_AVATARS.find(a => a.id === selectedAvatarId)?.name}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {hoveredAvatar?.emotionalState || SYMBOLIC_AVATARS.find(a => a.id === selectedAvatarId)?.emotionalState}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center">
            Passe o mouse sobre um avatar para ver seu significado
          </p>
        )}
      </div>
    </div>
  );
};

export default SymbolicAvatarGrid;
