import { useState, useRef, useEffect } from "react";
import { Check, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface InlineEditableProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}

export function InlineEditable({
  value,
  onChange,
  placeholder = "Click para editar...",
  multiline = false,
  className,
  inputClassName,
  disabled = false,
}: InlineEditableProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    onChange(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (disabled) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        {value || placeholder}
      </span>
    );
  }

  if (isEditing) {
    const InputComponent = multiline ? Textarea : Input;
    return (
      <div className="flex items-start gap-2">
        <InputComponent
          ref={inputRef as any}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn("flex-1", inputClassName)}
          rows={multiline ? 3 : undefined}
        />
        <div className="flex gap-1 flex-shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-coverage hover:text-coverage"
            onClick={handleSave}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={handleCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={cn(
        "group flex items-center gap-2 text-left rounded px-2 py-1 -mx-2 -my-1 transition-colors",
        "hover:bg-muted/50 cursor-pointer",
        !value && "text-muted-foreground italic",
        className
      )}
    >
      <span className="flex-1">{value || placeholder}</span>
      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </button>
  );
}
