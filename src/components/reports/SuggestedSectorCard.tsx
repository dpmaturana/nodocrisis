import { useState } from "react";
import { Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InlineEditable } from "./InlineEditable";
import type { SuggestedSector } from "@/types/database";

interface SuggestedSectorCardProps {
  sector: SuggestedSector;
  index: number;
  onUpdate: (index: number, sector: SuggestedSector) => void;
  onRemove: (index: number) => void;
  onDuplicate: (sector: SuggestedSector) => void;
}

export function SuggestedSectorCard({
  sector,
  index,
  onUpdate,
  onRemove,
  onDuplicate,
}: SuggestedSectorCardProps) {
  const confidencePercent = Math.round(sector.confidence * 100);
  
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-coverage";
    if (confidence >= 0.5) return "text-warning";
    return "text-destructive";
  };

  return (
    <Card
      className={cn(
        "p-4 transition-all",
        sector.include 
          ? "bg-card border-border" 
          : "bg-muted/30 border-border/50 opacity-60"
      )}
    >
      <div className="flex items-start gap-4">
        <Switch
          checked={sector.include}
          onCheckedChange={(checked) =>
            onUpdate(index, { ...sector, include: checked })
          }
          className="mt-1"
        />
        
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <InlineEditable
              value={sector.name}
              onChange={(name) => onUpdate(index, { ...sector, name })}
              className="font-semibold text-foreground"
              disabled={!sector.include}
            />
            <Badge 
              variant="outline" 
              className={cn("font-mono text-xs", getConfidenceColor(sector.confidence))}
            >
              {confidencePercent}%
            </Badge>
          </div>
          
          <InlineEditable
            value={sector.description}
            onChange={(description) => onUpdate(index, { ...sector, description })}
            placeholder="Add description..."
            multiline
            className="text-sm text-muted-foreground"
            disabled={!sector.include}
          />
        </div>

        <div className="flex gap-1 flex-shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => onDuplicate(sector)}
            title="Duplicate sector"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(index)}
            title="Remove sector"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
