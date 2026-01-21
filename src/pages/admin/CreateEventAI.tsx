import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Sparkles, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { situationReportService } from "@/services";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CreateEventAI() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [inputText, setInputText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  if (authLoading) {
    return (
      <div className="container max-w-2xl py-12 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    navigate("/dashboard");
    return null;
  }

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      toast({
        variant: "destructive",
        title: "Texto requerido",
        description: "Describe la emergencia antes de generar la propuesta.",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Generate report using mock service (no backend calls)
      await situationReportService.generate(inputText.trim());

      // Navigate to draft editing page
      navigate("/admin/situation-report/draft");
    } catch (error: any) {
      console.error("Error generating report:", error);
      toast({
        variant: "destructive",
        title: "Error al generar propuesta",
        description: error.message || "Intenta de nuevo más tarde.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Nueva Emergencia</h1>
        <p className="text-muted-foreground mt-2">
          Describe la situación y la IA generará una propuesta inicial para activar la coordinación.
        </p>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generación Asistida por IA
          </CardTitle>
          <CardDescription>
            Ingresa una descripción breve de la emergencia. La IA analizará el texto y sugerirá sectores afectados y capacidades requeridas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="input-text" className="text-sm font-medium">
              Describe la emergencia
            </label>
            <Textarea
              id="input-text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ej: Incendios forestales afectan comunas de Ñuble, especialmente sectores rurales de San Carlos y Chillán Viejo. Se reportan focos activos cerca de zonas pobladas..."
              className="min-h-[140px] resize-none"
              disabled={isGenerating}
            />
            <p className="text-xs text-muted-foreground">
              Puedes pegar texto de noticias, reportes o describir la situación en tus propias palabras.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={handleGenerate}
              disabled={isGenerating || !inputText.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analizando situación...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generar propuesta inicial
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">o</span>
              </div>
            </div>

            <Link to="/admin/coordination?tab=eventos">
              <Button variant="outline" className="w-full gap-2">
                <FileText className="h-4 w-4" />
                Crear evento manualmente
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Tips section */}
      <Card className="mt-6 bg-muted/30 border-border/50">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">Consejos para mejores resultados:</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• Incluye la ubicación geográfica (región, comunas, sectores)</li>
            <li>• Menciona el tipo de emergencia (incendio, inundación, etc.)</li>
            <li>• Si hay fuentes de información, inclúyelas en el texto</li>
            <li>• La IA generará una propuesta que podrás editar antes de confirmar</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
