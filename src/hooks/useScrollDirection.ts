import { useState, useEffect, useCallback, useRef } from 'react';

interface UseScrollDirectionOptions {
  threshold?: number; // Minimum scroll before hiding (default: 100)
  throttleMs?: number; // Throttle interval in ms (default: 100)
}

interface ScrollDirection {
  isVisible: boolean;
  direction: 'up' | 'down' | null;
  scrollY: number;
}

export function useScrollDirection(options: UseScrollDirectionOptions = {}): ScrollDirection {
  const { threshold = 100, throttleMs = 100 } = options;
  
  const [isVisible, setIsVisible] = useState(true);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const [scrollY, setScrollY] = useState(0);
  
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const lastUpdate = useRef(Date.now());

  const updateScrollDirection = useCallback(() => {
    const currentScrollY = window.scrollY;
    
    // Update scroll position
    setScrollY(currentScrollY);
    
    // If we're near the top, always show
    if (currentScrollY < threshold) {
      setIsVisible(true);
      setDirection(null);
      lastScrollY.current = currentScrollY;
      return;
    }
    
    const diff = currentScrollY - lastScrollY.current;
    
    // Minimum movement to trigger direction change (prevents jitter)
    if (Math.abs(diff) < 5) {
      return;
    }
    
    if (diff > 0) {
      // Scrolling down
      setDirection('down');
      setIsVisible(false);
    } else {
      // Scrolling up
      setDirection('up');
      setIsVisible(true);
    }
    
    lastScrollY.current = currentScrollY;
  }, [threshold]);

  useEffect(() => {
    const handleScroll = () => {
      const now = Date.now();
      
      // Throttle updates
      if (now - lastUpdate.current < throttleMs) {
        if (!ticking.current) {
          ticking.current = true;
          requestAnimationFrame(() => {
            updateScrollDirection();
            ticking.current = false;
            lastUpdate.current = Date.now();
          });
        }
        return;
      }
      
      lastUpdate.current = now;
      updateScrollDirection();
    };

    // Set initial scroll position
    lastScrollY.current = window.scrollY;
    setScrollY(window.scrollY);

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [updateScrollDirection, throttleMs]);

  return { isVisible, direction, scrollY };
}
