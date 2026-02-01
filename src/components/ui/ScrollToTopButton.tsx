import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScrollToTopButtonProps {
  showAfter?: number; // Show after scrolling this many pixels
  className?: string;
  containerSelector?: string; // Optional container selector for scroll within element
}

export function ScrollToTopButton({ 
  showAfter = 400,
  className,
  containerSelector
}: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const container = containerSelector 
      ? document.querySelector(containerSelector) 
      : null;
    
    const handleScroll = () => {
      if (container) {
        setIsVisible(container.scrollTop > showAfter);
      } else {
        setIsVisible(window.scrollY > showAfter);
      }
    };

    const target = container || window;
    target.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial position

    return () => target.removeEventListener("scroll", handleScroll);
  }, [showAfter, containerSelector]);

  const scrollToTop = useCallback(() => {
    if (containerSelector) {
      const container = document.querySelector(containerSelector);
      container?.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [containerSelector]);

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
