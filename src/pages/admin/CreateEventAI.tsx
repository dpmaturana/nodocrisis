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
        title: "Text required",
        description: "Describe the emergency before generating the proposal.",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Generate report using the real edge function
      const report = await situationReportService.generate(inputText.trim());

      // Navigate to the persisted draft by its DB id
      navigate(`/admin/situation-report/${report.id}`);
    } catch (error: any) {
      console.error("Error generating report:", error);
      toast({
        variant: "destructive",
        title: "Error generating proposal",
        description: error.message || "Please try again later.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">New Emergency</h1>
        <p className="text-muted-foreground mt-2">
          Describe the situation and the AI will create an initial proposal to activate de coordination.
        </p>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generation assisted by IA
          </CardTitle>
          <CardDescription>
            Enter a brief description of the emergency. The IA will analyze the text and suggest impacted sectors and
            required capabilities.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="input-text" className="text-sm font-medium">
              Describe the emergency
            </label>
            <Textarea
              id="input-text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="E.g.: Wildfires affecting communes in Ñuble, especially rural areas of San Carlos and Chillán Viejo. Active hotspots reported near populated zones..."
              className="min-h-[140px] resize-none"
              disabled={isGenerating}
            />
            <p className="text-xs text-muted-foreground">
              You can paste news links, reports o describe the situation in your own words.
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
                  Analizing the situation...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate initial proposal
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Link to="/admin/coordination?tab=eventos">
              <Button variant="outline" className="w-full gap-2">
                <FileText className="h-4 w-4" />
                Create event manually
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Tips section */}
      <Card className="mt-6 bg-muted/30 border-border/50">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">Advices to improve the results:</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• Include the location (region, commune, sector)</li>
            <li>• Mention the type of emergency (wildfire, Flood, Massive Accident etc.)</li>
            <li>• If you have informational sources. include them in the text</li>
            <li>• The IA will generate a proposal that you would be able to edit before confirmation </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
