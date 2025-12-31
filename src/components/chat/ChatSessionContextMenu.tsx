import { useState } from "react";
import { Star, Palette, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { ColorTagPicker, type ColorTag } from "./ColorTagPicker";
import { RenameSessionDialog } from "./RenameSessionDialog";
import { DeleteSessionDialog } from "./DeleteSessionDialog";

interface ChatSessionContextMenuProps {
  sessionId: string;
  sessionTitle: string;
  isFavorite: boolean;
  colorTag: ColorTag;
  canFavorite: boolean;
  onRename: (sessionId: string, newTitle: string) => void;
  onDelete: (sessionId: string) => void;
  onToggleFavorite: (sessionId: string) => void;
  onChangeColor: (sessionId: string, color: ColorTag) => void;
}

export function ChatSessionContextMenu({
  sessionId,
  sessionTitle,
  isFavorite,
  colorTag,
  canFavorite,
  onRename,
  onDelete,
  onToggleFavorite,
  onChangeColor,
}: ChatSessionContextMenuProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              if (!isFavorite && !canFavorite) return;
              onToggleFavorite(sessionId);
            }}
            disabled={!isFavorite && !canFavorite}
          >
            <Star className={`mr-2 h-4 w-4 ${isFavorite ? "fill-yellow-500 text-yellow-500" : ""}`} />
            {isFavorite ? "Remover favorito" : "Favoritar"}
          </DropdownMenuItem>
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
              <Palette className="mr-2 h-4 w-4" />
              Alterar cor
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent onClick={(e) => e.stopPropagation()}>
              <ColorTagPicker
                selectedColor={colorTag}
                onSelect={(color) => onChangeColor(sessionId, color)}
              />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setRenameOpen(true);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Renomear
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setDeleteOpen(true);
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameSessionDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        currentTitle={sessionTitle}
        onRename={(newTitle) => onRename(sessionId, newTitle)}
      />

      <DeleteSessionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        sessionTitle={sessionTitle}
        onConfirm={() => onDelete(sessionId)}
      />
    </>
  );
}
