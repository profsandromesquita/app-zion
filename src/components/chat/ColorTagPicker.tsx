import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const COLOR_OPTIONS = [
  { value: "red", label: "Vermelho", className: "bg-red-500" },
  { value: "blue", label: "Azul", className: "bg-blue-500" },
  { value: "green", label: "Verde", className: "bg-green-500" },
  { value: "yellow", label: "Amarelo", className: "bg-yellow-500" },
  { value: "purple", label: "Roxo", className: "bg-purple-500" },
  { value: "orange", label: "Laranja", className: "bg-orange-500" },
] as const;

export type ColorTag = typeof COLOR_OPTIONS[number]["value"] | null;

interface ColorTagPickerProps {
  selectedColor: ColorTag;
  onSelect: (color: ColorTag) => void;
}

export function ColorTagPicker({ selectedColor, onSelect }: ColorTagPickerProps) {
  return (
    <div className="flex items-center gap-2 p-2">
      {COLOR_OPTIONS.map((color) => (
        <button
          key={color.value}
          onClick={() => onSelect(color.value)}
          className={cn(
            "h-5 w-5 rounded-full flex items-center justify-center transition-transform hover:scale-110",
            color.className
          )}
          title={color.label}
        >
          {selectedColor === color.value && (
            <Check className="h-3 w-3 text-white" />
          )}
        </button>
      ))}
      <button
        onClick={() => onSelect(null)}
        className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center transition-transform hover:scale-110 bg-background"
        title="Sem cor"
      >
        {selectedColor === null && (
          <X className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}

export function ColorDot({ color }: { color: ColorTag }) {
  if (!color) return null;
  
  const colorOption = COLOR_OPTIONS.find((c) => c.value === color);
  if (!colorOption) return null;
  
  return (
    <span
      className={cn("h-2 w-2 rounded-full shrink-0", colorOption.className)}
    />
  );
}
