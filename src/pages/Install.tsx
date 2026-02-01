import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  Smartphone, 
  Monitor, 
  Share, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  ArrowLeft,
  Apple,
  Chrome
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export default function Install() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  
  // Diagnóstico PWA
  const [swStatus, setSwStatus] = useState<"checking" | "active" | "inactive">("checking");
  const [manifestStatus, setManifestStatus] = useState<"checking" | "loaded" | "error">("checking");

  // Detectar plataforma
  const platform = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        isIOS: false,
        isMac: false,
        isAndroid: false,
        isChrome: false,
        isEdge: false,
        isSafari: false,
        isStandalone: false,
        canInstall: false,
      };
    }
    
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isMac = /Macintosh/.test(ua);
    const isAndroid = /Android/.test(ua);
    const isChrome = /Chrome/.test(ua) && !/Edge|Edg/.test(ua);
    const isEdge = /Edge|Edg/.test(ua);
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    
    return {
      isIOS,
      isMac,
      isAndroid,
      isChrome,
      isEdge,
      isSafari,
      isStandalone,
      canInstall: isChrome || isEdge, // Browsers que suportam beforeinstallprompt
    };
  }, []);

  // Capturar evento beforeinstallprompt
  useEffect(() => {
    const handleBeforeInstall = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Verificar se já está instalado
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Verificar Service Worker
  useEffect(() => {
    const checkSW = async () => {
      if ("serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          setSwStatus(registration?.active ? "active" : "inactive");
        } catch {
          setSwStatus("inactive");
        }
      } else {
        setSwStatus("inactive");
      }
    };
    checkSW();
  }, []);

  // Verificar Manifest
  useEffect(() => {
    const checkManifest = async () => {
      try {
        const response = await fetch("/manifest.json");
        if (response.ok) {
          await response.json();
          setManifestStatus("loaded");
        } else {
          setManifestStatus("error");
        }
      } catch {
        setManifestStatus("error");
      }
    };
    checkManifest();
  }, []);

  // Instalar via prompt (Chrome/Edge)
  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === "accepted") {
        toast({
          title: "Instalação iniciada!",
          description: "O Zion está sendo adicionado ao seu dispositivo.",
        });
      }
      setDeferredPrompt(null);
    } catch (error) {
      console.error("Install error:", error);
    }
    setIsInstalling(false);
  };

  // Limpar cache e recarregar
  const handleClearCache = async () => {
    try {
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }

      toast({
        title: "Cache limpo!",
        description: "Recarregando a página...",
      });

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Clear cache error:", error);
      toast({
        title: "Erro ao limpar cache",
        description: "Tente limpar manualmente nas configurações do navegador.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Instalar Zion</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Status de instalação */}
        {isInstalled && (
          <Card className="border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="flex items-center gap-3 pt-6">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              <div>
                <p className="font-medium">Zion já está instalado!</p>
                <p className="text-sm text-muted-foreground">
                  Você está usando o aplicativo instalado.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Botão de instalação (Chrome/Edge) */}
        {deferredPrompt && !isInstalled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-emerald-500" />
                Instalação Rápida
              </CardTitle>
              <CardDescription>
                Instale o Zion com um clique
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleInstall}
                disabled={isInstalling}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                size="lg"
              >
                {isInstalling ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Instalando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Instalar Zion
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Instruções para iOS */}
        {(platform.isIOS || (platform.isSafari && !platform.isMac)) && !isInstalled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Apple className="h-5 w-5" />
                Instalar no iPhone/iPad
              </CardTitle>
              <CardDescription>
                Siga os passos abaixo para adicionar à Tela de Início
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-lime-500 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">1</span>
                </div>
                <div>
                  <p className="font-medium">Toque no ícone de Compartilhar</p>
                  <p className="text-sm text-muted-foreground">
                    É o ícone de quadrado com uma seta para cima <Share className="inline h-4 w-4" />
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-lime-500 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">2</span>
                </div>
                <div>
                  <p className="font-medium">Role para baixo e toque em "Adicionar à Tela de Início"</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    Procure pelo ícone <Plus className="inline h-4 w-4" />
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-lime-500 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">3</span>
                </div>
                <div>
                  <p className="font-medium">Confirme tocando em "Adicionar"</p>
                  <p className="text-sm text-muted-foreground">
                    O ícone do Zion aparecerá na sua tela inicial
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Importante:</strong> Para receber notificações no iPhone, é necessário abrir o Zion pelo ícone da tela inicial.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instruções para Chrome/Edge Desktop */}
        {platform.canInstall && !deferredPrompt && !isInstalled && !platform.isIOS && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Chrome className="h-5 w-5" />
                Instalar no Computador
              </CardTitle>
              <CardDescription>
                Usando {platform.isEdge ? "Microsoft Edge" : "Google Chrome"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-lime-500 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">1</span>
                </div>
                <div>
                  <p className="font-medium">Abra o menu do navegador</p>
                  <p className="text-sm text-muted-foreground">
                    Clique nos três pontos (⋮) no canto superior direito
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-lime-500 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">2</span>
                </div>
                <div>
                  <p className="font-medium">
                    {platform.isEdge 
                      ? 'Vá em "Apps" → "Instalar este site como um app"' 
                      : 'Clique em "Instalar Zion..."'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ou procure um ícone de instalação na barra de endereço
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-lime-500 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">3</span>
                </div>
                <div>
                  <p className="font-medium">Confirme a instalação</p>
                  <p className="text-sm text-muted-foreground">
                    O Zion será adicionado como um aplicativo
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instruções para Safari Mac */}
        {platform.isMac && platform.isSafari && !isInstalled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Instalar no Mac (Safari)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-lime-500 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">1</span>
                </div>
                <div>
                  <p className="font-medium">No menu, vá em "Arquivo"</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-lime-500 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">2</span>
                </div>
                <div>
                  <p className="font-medium">Clique em "Adicionar ao Dock"</p>
                  <p className="text-sm text-muted-foreground">
                    Se não aparecer essa opção, você pode usar Chrome ou Edge para uma instalação completa
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Android sem prompt */}
        {platform.isAndroid && !deferredPrompt && !isInstalled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Instalar no Android
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-lime-500 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">1</span>
                </div>
                <div>
                  <p className="font-medium">Abra o menu do Chrome</p>
                  <p className="text-sm text-muted-foreground">
                    Toque nos três pontos (⋮) no canto superior
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-lime-500 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">2</span>
                </div>
                <div>
                  <p className="font-medium">Toque em "Adicionar à tela inicial"</p>
                  <p className="text-sm text-muted-foreground">
                    Ou "Instalar aplicativo" se disponível
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Diagnóstico PWA */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-emerald-500" />
              Diagnóstico
            </CardTitle>
            <CardDescription>
              Status técnico da instalação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Service Worker</span>
              <Badge 
                variant="secondary"
                className={swStatus === "active" ? "bg-gradient-to-r from-emerald-500 to-lime-500 text-white border-0" : ""}
              >
                {swStatus === "checking" ? "Verificando..." : swStatus === "active" ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Manifest</span>
              <Badge 
                variant="secondary"
                className={manifestStatus === "loaded" ? "bg-gradient-to-r from-emerald-500 to-lime-500 text-white border-0" : ""}
              >
                {manifestStatus === "checking" ? "Verificando..." : manifestStatus === "loaded" ? "OK" : "Erro"}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Modo Standalone</span>
              <Badge 
                variant="secondary"
                className={platform.isStandalone ? "bg-gradient-to-r from-emerald-500 to-lime-500 text-white border-0" : ""}
              >
                {platform.isStandalone ? "Sim" : "Não"}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Prompt de Instalação</span>
              <Badge 
                variant="secondary"
                className={deferredPrompt ? "bg-gradient-to-r from-emerald-500 to-lime-500 text-white border-0" : ""}
              >
                {deferredPrompt ? "Disponível" : "Indisponível"}
              </Badge>
            </div>

            <div className="pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCache}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Limpar Cache e Recarregar
              </Button>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Use se estiver tendo problemas ou vendo versão desatualizada
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
