import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollToTopButtonProps {
  showAfter?: number; // Show after scrolling this many pixels
  className?: string;
}

export function ScrollToTopButton({ 
  showAfter = 400,
  className 
}: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > showAfter);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial position

    return () => window.removeEventListener("scroll", handleScroll);
  }, [showAfter]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!isVisible) return null;

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={scrollToTop}
      className={cn(
        "fixed bottom-6 right-6 z-50 shadow-lg gap-2",
        "animate-in fade-in slide-in-from-bottom-4 duration-300",
        className
      )}
    >
      <ArrowUp className="h-4 w-4" />
      Volver arriba
    </Button>
  );
}
