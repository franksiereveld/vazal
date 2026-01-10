import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Brain, Wrench, CheckCircle } from "lucide-react";

interface StreamingMessageProps {
  thinkingSteps: string[];
  isStreaming: boolean;
  className?: string;
}

export function StreamingMessage({
  thinkingSteps,
  isStreaming,
  className,
}: StreamingMessageProps) {
  if (thinkingSteps.length === 0 && !isStreaming) {
    return null;
  }

  const getIcon = (step: string) => {
    if (step.includes("🛠️") || step.includes("🔧") || step.includes("🎯")) {
      return <Wrench className="w-4 h-4 text-yellow-500" />;
    }
    if (step.includes("✅")) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    return <Brain className="w-4 h-4 text-blue-500" />;
  };

  return (
    <Card className={cn("p-4 bg-card/50 border-dashed", className)}>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Brain className="w-4 h-4 animate-pulse" />
          <span>Vazal is thinking...</span>
        </div>

        <div className="space-y-1 text-sm">
          {thinkingSteps.map((step, index) => (
            <div
              key={index}
              className="flex items-start gap-2 text-muted-foreground animate-in fade-in slide-in-from-left-2 duration-300"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {getIcon(step)}
              <span className="flex-1">{step}</span>
            </div>
          ))}
        </div>

        {isStreaming && (
          <div className="flex items-center gap-2 pt-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
    </Card>
  );
}
