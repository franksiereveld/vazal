import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Send, Download, FileText, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Agent() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', content: string, files?: string[] }>>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change (MUST be before any returns)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Redirect to home if not authenticated (but wait for loading to complete)
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLocation("/");
    }
  }, [loading, isAuthenticated, setLocation]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated after loading, the useEffect will redirect
  if (!isAuthenticated) {
    return null;
  }

  const vazalExecute = trpc.vazal.execute.useMutation();

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsProcessing(true);

    try {
      // Execute Vazal AI command
      const response = await vazalExecute.mutateAsync({ prompt: userMessage });
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.result,
        files: [] // TODO: Extract file paths from Vazal output
      }]);
    } catch (error: any) {
      toast.error(error.message || "Failed to process request");
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I encountered an error processing your request. Please try again.",
        files: []
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">vazal.ai</h1>
            <span className="text-sm text-muted-foreground">Your Personal AI Agent</span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.phone || user?.name || 'User'}
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => logout()}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-4xl py-8">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              <h2 className="text-3xl font-bold mb-4">Welcome to Vazal AI</h2>
              <p className="text-muted-foreground mb-8 max-w-md">
                Your personal AI agent is ready. Ask me anything, and I'll help you with tasks, analysis, and more.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                <Card className="p-4 hover:border-foreground transition-colors cursor-pointer" onClick={() => setInput("Help me analyze data")}>
                  <p className="font-medium mb-2">📊 Data Analysis</p>
                  <p className="text-sm text-muted-foreground">Analyze datasets and generate insights</p>
                </Card>
                <Card className="p-4 hover:border-foreground transition-colors cursor-pointer" onClick={() => setInput("Write code for me")}>
                  <p className="font-medium mb-2">💻 Code Generation</p>
                  <p className="text-sm text-muted-foreground">Generate and debug code in any language</p>
                </Card>
                <Card className="p-4 hover:border-foreground transition-colors cursor-pointer" onClick={() => setInput("Research a topic")}>
                  <p className="font-medium mb-2">🔍 Research</p>
                  <p className="text-sm text-muted-foreground">Deep dive into any topic with sources</p>
                </Card>
                <Card className="p-4 hover:border-foreground transition-colors cursor-pointer" onClick={() => setInput("Create a presentation")}>
                  <p className="font-medium mb-2">📑 Content Creation</p>
                  <p className="text-sm text-muted-foreground">Generate documents, slides, and reports</p>
                </Card>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message, index) => (
                <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <Card className={`max-w-[80%] p-4 ${message.role === 'user' ? 'bg-accent text-accent-foreground' : 'bg-card text-card-foreground'}`}>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {message.files && message.files.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4" />
                          <span className="text-sm font-medium">Output Files</span>
                        </div>
                        <div className="space-y-2">
                          {message.files.map((file, fileIndex) => (
                            <Button 
                              key={fileIndex} 
                              variant="outline" 
                              size="sm" 
                              className="w-full justify-start gap-2"
                            >
                              <Download className="w-4 h-4" />
                              {file}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              ))}
              {isProcessing && (
                <div className="flex justify-start">
                  <Card className="max-w-[80%] p-4 bg-card">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </Card>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Input Area */}
      <footer className="border-t border-border bg-background/80 backdrop-blur-md sticky bottom-0">
        <div className="container max-w-4xl py-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask Vazal anything... (Press Enter to send, Shift+Enter for new line)"
              className="min-h-[60px] max-h-[200px] resize-none"
              disabled={isProcessing}
            />
            <Button 
              onClick={handleSend} 
              disabled={!input.trim() || isProcessing}
              size="lg"
              className="px-6"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Vazal AI can make mistakes. Verify important information.
          </p>
        </div>
      </footer>
    </div>
  );
}
