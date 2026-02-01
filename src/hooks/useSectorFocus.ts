import { useState, useCallback, useRef } from "react";

interface UseSectorFocusOptions {
  // For sidebar layout, we scroll within a container, not the window
  containerSelector?: string;
  // Header offset for stacked layout
  headerOffset?: number;
}

export function useSectorFocus(options: UseSectorFocusOptions = {}) {
  const { containerSelector, headerOffset = 56 } = options;
  
  const [focusedSectorId, setFocusedSectorId] = useState<string | null>(null);
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToCard = useCallback((sectorId: string) => {
    const card = document.getElementById(`sector-${sectorId}`);
    if (!card) return;

    // Clear any existing highlight timeout
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    // Scroll card into view with offset
    const elementPosition = card.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset - 100;

    window.scrollTo({ 
      top: Math.max(0, offsetPosition), 
      behavior: "smooth" 
    });

    // Set highlight state
    setHighlightedCardId(sectorId);
    
    // Remove highlight after 2 seconds
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedCardId(null);
    }, 2000);
  }, [containerSelector, headerOffset]);

  const handleSectorHover = useCallback((sectorId: string | null) => {
    setFocusedSectorId(sectorId);
  }, []);

  const handleSectorClick = useCallback((sectorId: string) => {
    setFocusedSectorId(sectorId);
    scrollToCard(sectorId);
  }, [scrollToCard]);

  return {
    focusedSectorId,
    highlightedCardId,
    setFocusedSectorId: handleSectorHover,
    scrollToCard: handleSectorClick,
  };
}
