import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Monitor, ChevronRight, ChevronLeft, RefreshCw, Maximize2, Minimize2 } from "lucide-react";

interface ScreenViewerProps {
  isVisible: boolean;
  onToggle: () => void;
}

export function ScreenViewer({ isVisible, onToggle }: ScreenViewerProps) {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchScreenshot = async () => {
    if (!isVisible) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/screen/screenshot');
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setScreenshot(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      }
    } catch (error) {
      console.error('Failed to fetch screenshot:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh screenshots
  useEffect(() => {
    if (isVisible && autoRefresh) {
      fetchScreenshot();
      intervalRef.current = setInterval(fetchScreenshot, 2000); // Every 2 seconds
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isVisible, autoRefresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (screenshot) URL.revokeObjectURL(screenshot);
    };
  }, []);

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="fixed right-4 top-20 z-50 bg-background shadow-lg"
        onClick={onToggle}
        title="Show Vazal's Screen"
      >
        <Monitor className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <div 
      className={`fixed right-0 top-0 h-full bg-background border-l border-border shadow-xl z-40 flex flex-col transition-all duration-300 ${
        isFullscreen ? 'w-full' : 'w-[500px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Vazal's Screen</span>
          {isLoading && (
            <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? "Pause auto-refresh" : "Enable auto-refresh"}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'text-green-500' : 'text-muted-foreground'}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onToggle}
            title="Hide screen viewer"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Screenshot Display */}
      <div className="flex-1 overflow-auto p-2 bg-black/90">
        {screenshot ? (
          <img
            src={screenshot}
            alt="Vazal's screen"
            className="w-full h-auto rounded border border-border/20"
            style={{ imageRendering: 'crisp-edges' }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Monitor className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">No screen activity yet</p>
            <p className="text-xs mt-1">Screen will appear when Vazal uses the browser</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border bg-muted/30 text-xs text-muted-foreground text-center">
        {autoRefresh ? "Auto-refreshing every 2s" : "Auto-refresh paused"} • Click to refresh manually
      </div>
    </div>
  );
}
