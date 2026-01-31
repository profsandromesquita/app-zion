import { useState, useRef } from "react";
import { Camera, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SYMBOLIC_AVATARS, SymbolicAvatar } from "@/data/symbolicAvatars";
import SymbolicAvatarGrid from "./SymbolicAvatarGrid";
import { User } from "lucide-react";

interface AvatarEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAvatarUrl: string | null;
  userId: string;
  onAvatarChange: (newUrl: string | null) => void;
}

const AvatarEditor = ({
  open,
  onOpenChange,
  currentAvatarUrl,
  userId,
  onAvatarChange,
}: AvatarEditorProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);
  const [selectedSymbolicId, setSelectedSymbolicId] = useState<string | null>(() => {
    const symbolic = SYMBOLIC_AVATARS.find(a => a.imagePath === currentAvatarUrl);
    return symbolic?.id || null;
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setSelectedSymbolicId(null);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Add cache-busting parameter
      const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;
      setPreviewUrl(urlWithTimestamp);

    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Erro no upload",
        description: error.message || "Não foi possível enviar a imagem.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSymbolicSelect = (avatar: SymbolicAvatar) => {
    setSelectedSymbolicId(avatar.id);
    setPreviewUrl(avatar.imagePath);
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setSelectedSymbolicId(null);
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: previewUrl })
        .eq("id", userId);

      if (error) throw error;

      onAvatarChange(previewUrl);
      onOpenChange(false);
      toast({
        title: "Avatar atualizado",
        description: "Sua foto de perfil foi alterada com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar o avatar.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Escolha seu Avatar</DialogTitle>
          <DialogDescription>
            Envie uma foto sua ou escolha um avatar simbólico que represente você
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current/Preview Avatar */}
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-28 w-28 border-4 border-border">
              {previewUrl ? (
                <AvatarImage src={previewUrl} alt="Avatar" className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary">
                <User className="h-12 w-12" />
              </AvatarFallback>
            </Avatar>

            {/* Upload buttons */}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-4 w-4" />
                    Enviar foto
                  </>
                )}
              </Button>
              {previewUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Symbolic Avatars Grid */}
          <SymbolicAvatarGrid
            selectedAvatarId={selectedSymbolicId}
            onSelect={handleSymbolicSelect}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300">
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AvatarEditor;
