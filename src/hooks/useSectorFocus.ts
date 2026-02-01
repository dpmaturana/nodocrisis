import { useState, useCallback, useRef } from "react";

export function useSectorFocus(mapHeightVh: number = 40) {
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

    // Calculate offset accounting for sticky elements
    const headerOffset = 56; // ActorHeader height (h-14 = 56px)
    const mapHeight = window.innerHeight * (mapHeightVh / 100);
    const spacerHeight = 24; // h-6 spacer below the map
    const totalStickyHeight = headerOffset + mapHeight + spacerHeight;
    
    const elementPosition = card.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - totalStickyHeight;

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
  }, [mapHeightVh]);

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
