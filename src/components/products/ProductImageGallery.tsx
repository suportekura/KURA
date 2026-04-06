import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface ProductImageGalleryProps {
  images: string[];
  productTitle: string;
}

export function ProductImageGallery({ images, productTitle }: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<'left' | 'right' | null>(null);
  
  // Pinch-to-zoom state for fullscreen mobile
  const [pinchScale, setPinchScale] = useState(1);
  const [pinchOrigin, setPinchOrigin] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);
  const initialPinchDistance = useRef<number | null>(null);
  const initialScale = useRef(1);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Touch/swipe handling
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;

  const handleImageLoad = (index: number) => {
    setLoadedImages(prev => new Set(prev).add(index));
  };

  const goToPrevious = useCallback(() => {
    if (isTransitioning) return;
    setTransitionDirection('right');
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
    }, 50);
  }, [images.length, isTransitioning]);

  const goToNext = useCallback(() => {
    if (isTransitioning) return;
    setTransitionDirection('left');
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
    }, 50);
  }, [images.length, isTransitioning]);

  // Reset transition state after animation
  useEffect(() => {
    if (isTransitioning) {
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setTransitionDirection(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning, selectedIndex]);

  // Touch event handlers for swipe
  const onTouchStart = (e: React.TouchEvent) => {
    // If pinching, don't handle as swipe
    if (e.touches.length > 1) return;
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 1) return;
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && images.length > 1) {
      goToNext();
    }
    if (isRightSwipe && images.length > 1) {
      goToPrevious();
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Pinch-to-zoom handlers for fullscreen mobile
  const getDistance = (touches: React.TouchList) => {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  };

  const getMidpoint = (touches: React.TouchList) => {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const onPinchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      setIsPinching(true);
      initialPinchDistance.current = getDistance(e.touches);
      initialScale.current = pinchScale;
      const midpoint = getMidpoint(e.touches);
      setPinchOrigin(midpoint);
    }
  };

  const onPinchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance.current) {
      e.preventDefault();
      const currentDistance = getDistance(e.touches);
      const scale = (currentDistance / initialPinchDistance.current) * initialScale.current;
      setPinchScale(Math.min(Math.max(scale, 1), 4)); // Clamp between 1x and 4x
    }
  };

  const onPinchEnd = () => {
    setIsPinching(false);
    initialPinchDistance.current = null;
    // Reset zoom if scale is close to 1
    if (pinchScale < 1.1) {
      setPinchScale(1);
    }
  };

  // Double tap to reset zoom
  const lastTapRef = useRef<number>(0);
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (pinchScale > 1) {
        setPinchScale(1);
      } else {
        setPinchScale(2);
      }
    }
    lastTapRef.current = now;
  };

  // Reset pinch scale when changing images or closing fullscreen
  useEffect(() => {
    setPinchScale(1);
  }, [selectedIndex, isFullscreen]);

  // Zoom handling for desktop
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x, y });
  };

  const handleMouseEnter = () => {
    setIsZoomed(true);
  };

  const handleMouseLeave = () => {
    setIsZoomed(false);
    setZoomPosition({ x: 50, y: 50 });
  };

  const handleImageClick = () => {
    setIsFullscreen(true);
  };

  const handleThumbnailClick = (index: number) => {
    if (index === selectedIndex) return;
    setTransitionDirection(index > selectedIndex ? 'left' : 'right');
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedIndex(index);
    }, 50);
  };

  const hasMultipleImages = images.length > 1;

  // Get animation classes based on transition state
  const getImageAnimationClass = () => {
    if (!isTransitioning) return 'translate-x-0 opacity-100';
    if (transitionDirection === 'left') return '-translate-x-4 opacity-0';
    if (transitionDirection === 'right') return 'translate-x-4 opacity-0';
    return '';
  };

  return (
    <>
      <div className="space-y-2 lg:space-y-3">
        {/* Main Image */}
        <div 
          className="relative aspect-[4/5] lg:aspect-[4/5] lg:max-h-[600px] bg-olive-muted overflow-hidden lg:rounded-2xl cursor-zoom-in group"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleImageClick}
        >
          {!loadedImages.has(selectedIndex) && (
            <Skeleton className="absolute inset-0 w-full h-full" />
          )}
          <img
            src={images[selectedIndex]}
            alt={`${productTitle} - Imagem ${selectedIndex + 1}`}
            className={cn(
              'w-full h-full object-cover transition-all duration-300 ease-out',
              loadedImages.has(selectedIndex) ? 'opacity-100' : 'opacity-0',
              isZoomed && 'lg:scale-150',
              getImageAnimationClass()
            )}
            style={isZoomed ? {
              transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`
            } : undefined}
            onLoad={() => handleImageLoad(selectedIndex)}
            draggable={false}
          />

          {/* Zoom indicator - desktop only */}
          <div className="hidden lg:flex absolute bottom-3 left-3 bg-background/80 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-medium items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <ZoomIn className="w-3 h-3" />
            Zoom
          </div>

          {/* Navigation Arrows - hidden on mobile, visible on desktop */}
          {hasMultipleImages && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                className="hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90 transition-transform active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); goToNext(); }}
                className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90 transition-transform active:scale-95"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* Image Counter / Dots for mobile */}
          {hasMultipleImages && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 lg:hidden">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => { e.stopPropagation(); handleThumbnailClick(index); }}
                  className={cn(
                    'h-2 rounded-full transition-all duration-300',
                    selectedIndex === index
                      ? 'bg-white w-4'
                      : 'bg-white/50 w-2'
                  )}
                />
              ))}
            </div>
          )}

          {/* Image Counter - desktop */}
          {hasMultipleImages && (
            <div className="hidden lg:block absolute bottom-3 right-3 bg-background/80 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-medium">
              {selectedIndex + 1} / {images.length}
            </div>
          )}
        </div>

        {/* Thumbnails - desktop only */}
        {hasMultipleImages && (
          <div className="hidden lg:flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => handleThumbnailClick(index)}
                className={cn(
                  'relative flex-shrink-0 w-16 h-16 lg:w-20 lg:h-20 rounded-lg overflow-hidden transition-all duration-300',
                  selectedIndex === index
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105'
                    : 'opacity-60 hover:opacity-100 hover:scale-102'
                )}
              >
                {!loadedImages.has(index) && (
                  <Skeleton className="absolute inset-0 w-full h-full" />
                )}
                <img
                  src={image}
                  alt={`${productTitle} - Miniatura ${index + 1}`}
                  className="w-full h-full object-cover"
                  onLoad={() => handleImageLoad(index)}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Modal with Pinch-to-Zoom */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 border-0 bg-black/95 rounded-none">
          <div 
            className="relative w-full h-full flex items-center justify-center touch-none"
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                onPinchStart(e);
              } else if (pinchScale <= 1) {
                onTouchStart(e);
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 2) {
                onPinchMove(e);
              } else if (pinchScale <= 1) {
                onTouchMove(e);
              }
            }}
            onTouchEnd={(e) => {
              if (isPinching) {
                onPinchEnd();
              } else if (pinchScale <= 1) {
                onTouchEnd();
                handleDoubleTap();
              }
            }}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-5 h-5" />
            </Button>

            {/* Zoom level indicator */}
            {pinchScale > 1 && (
              <div className="absolute top-4 left-4 z-10 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 text-white text-sm font-medium">
                {pinchScale.toFixed(1)}x
              </div>
            )}

            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <img
                ref={imageRef}
                src={images[selectedIndex]}
                alt={`${productTitle} - Imagem ${selectedIndex + 1}`}
                className={cn(
                  'max-w-full max-h-[85vh] object-contain transition-all',
                  isPinching ? 'duration-0' : 'duration-300 ease-out',
                  getImageAnimationClass()
                )}
                style={{
                  transform: `scale(${pinchScale})`,
                  transformOrigin: pinchScale > 1 ? `${pinchOrigin.x}px ${pinchOrigin.y}px` : 'center',
                }}
                draggable={false}
              />
            </div>

            {/* Fullscreen Navigation - only show when not zoomed */}
            {hasMultipleImages && pinchScale <= 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPrevious}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition-transform active:scale-95"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition-transform active:scale-95"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </>
            )}

            {/* Fullscreen Dots - only show when not zoomed */}
            {hasMultipleImages && pinchScale <= 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => handleThumbnailClick(index)}
                    className={cn(
                      'h-2.5 rounded-full transition-all duration-300',
                      selectedIndex === index
                        ? 'bg-white w-6'
                        : 'bg-white/50 hover:bg-white/70 w-2.5'
                    )}
                  />
                ))}
              </div>
            )}

            {/* Pinch hint on mobile */}
            {pinchScale === 1 && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 lg:hidden text-white/60 text-xs">
                Pinça para zoom • Toque duplo para ampliar
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
