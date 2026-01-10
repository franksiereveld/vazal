import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Send, LogOut, Check, X, Loader2, Zap, Paperclip, Download, FileText, Monitor } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { LatexRenderer } from "@/components/LatexRenderer";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { ScreenViewer } from "@/components/ScreenViewer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PendingPlan {
  prompt: string;
  plan: string[];
  estimated_time: string;
}

interface UploadedFile {
  name: string;
  path: string;
}

export default function Agent() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', content: string, files?: string[] }>>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationId, setConversationId] = useState<number | undefined>(undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<PendingPlan | null>(null);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [quickMode, setQuickMode] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showScreenViewer, setShowScreenViewer] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // MUST be before any conditional returns (React hooks rule)
  const vazalClassify = trpc.vazal.classify.useMutation();
  const vazalPlan = trpc.vazal.plan.useMutation();
  const vazalExecute = trpc.vazal.execute.useMutation();
  const vazalChat = trpc.vazal.chat.useMutation();
  const conversationsList = trpc.conversations.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const getMessages = trpc.conversations.getMessages.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId }
  );
  const deleteConversation = trpc.conversations.delete.useMutation();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingPlan]);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLocation("/");
    }
  }, [loading, isAuthenticated, setLocation]);

  // Load messages when conversation changes
  useEffect(() => {
    if (getMessages.data && conversationId) {
      setMessages(getMessages.data.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        files: msg.files || [],
      })));
    }
  }, [getMessages.data, conversationId]);

  // Show loading state
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

  if (!isAuthenticated) {
    return null;
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      setUploadedFiles(prev => [...prev, ...result.files]);
      toast.success(`Uploaded ${files.length} file(s)`);
    } catch (error) {
      toast.error('Failed to upload files');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDownloadFile = async (filename: string) => {
    try {
      const link = document.createElement('a');
      link.href = `/api/files/download/${encodeURIComponent(filename)}`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput("");
    
    // Include uploaded files in message display
    const filesInfo = uploadedFiles.length > 0 
      ? `\n\n📎 Attached: ${uploadedFiles.map(f => f.name).join(', ')}`
      : '';
    
    setMessages(prev => [...prev, { role: 'user', content: userMessage + filesInfo }]);
    setIsProcessing(true);
    setProcessingStep("Analyzing your request...");

    try {
      // Step 1: Classify intent
      const classification = await vazalClassify.mutateAsync({ prompt: userMessage });
      
      if (classification.type === "CHAT") {
        setProcessingStep("");
        const response = classification.response || "Hello! How can I help you?";
        setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        
        await vazalChat.mutateAsync({
          prompt: userMessage,
          response: response,
          conversationId,
        });
        
        conversationsList.refetch();
      } else {
        if (quickMode) {
          setProcessingStep("🚀 Starting task execution...");
          
          // Show progress updates
          const progressSteps = [
            "🔍 Analyzing your request...",
            "⚙️ Executing task...",
            "💾 Finalizing results..."
          ];
          let stepIndex = 0;
          const progressInterval = setInterval(() => {
            if (stepIndex < progressSteps.length) {
              setProcessingStep(progressSteps[stepIndex]);
              stepIndex++;
            }
          }, 3000);
          
          try {
            const result = await vazalExecute.mutateAsync({
              prompt: userMessage,
              conversationId,
              files: uploadedFiles.map(f => f.path),
            });
            clearInterval(progressInterval);
          
            if (!conversationId && result.conversationId) {
              setConversationId(result.conversationId);
            }
            
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: result.result,
              files: result.files || [],
            }]);
            
            conversationsList.refetch();
          } catch (error) {
            clearInterval(progressInterval);
            throw error;
          }
        } else {
          setProcessingStep("Creating execution plan...");
          const planResult = await vazalPlan.mutateAsync({ prompt: userMessage });
          
          setPendingPlan({
            prompt: userMessage,
            plan: planResult.plan,
            estimated_time: planResult.estimated_time,
          });
          setProcessingStep("");
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to process request");
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I encountered an error. Please try again.",
      }]);
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
      setUploadedFiles([]); // Clear uploaded files after sending
    }
  };

  const handleConfirmPlan = async () => {
    if (!pendingPlan) return;
    
    setIsProcessing(true);
    setProcessingStep("🚀 Starting task execution...");
    setPendingPlan(null);
    
    // Show progress updates
    const progressSteps = [
      "🔍 Analyzing your request...",
      "⚙️ Executing task...",
      "💾 Finalizing results..."
    ];
    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      if (stepIndex < progressSteps.length) {
        setProcessingStep(progressSteps[stepIndex]);
        stepIndex++;
      }
    }, 3000);
    
    try {
      const result = await vazalExecute.mutateAsync({
        prompt: pendingPlan.prompt,
        conversationId,
        files: uploadedFiles.map(f => f.path),
      });
      clearInterval(progressInterval);
      
      if (!conversationId && result.conversationId) {
        setConversationId(result.conversationId);
      }
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: result.result,
        files: result.files || [],
      }]);
      
      conversationsList.refetch();
    } catch (error: any) {
      clearInterval(progressInterval);
      toast.error(error.message || "Failed to execute task");
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I encountered an error executing the task. Please try again.",
      }]);
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
      setUploadedFiles([]);
    }
  };

  const handleRejectPlan = () => {
    setPendingPlan(null);
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: "No problem! Feel free to rephrase your request or ask something else.",
    }]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setConversationId(undefined);
    setMessages([]);
    setPendingPlan(null);
    setUploadedFiles([]);
  };

  const handleSelectConversation = (id: number) => {
    if (id !== conversationId) {
      setConversationId(id);
      setMessages([]);
      setPendingPlan(null);
      setUploadedFiles([]);
    }
  };

  const handleDeleteConversation = async (id: number) => {
    try {
      await deleteConversation.mutateAsync({ conversationId: id });
      toast.success("Conversation deleted");
      
      if (id === conversationId) {
        setConversationId(undefined);
        setMessages([]);
      }
      
      conversationsList.refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete conversation");
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversationsList.data || []}
        activeConversationId={conversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        isLoading={conversationsList.isLoading}
        isDeleting={deleteConversation.isPending}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
          <div className="px-6 flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">vazal.ai</h1>
              <span className="text-sm text-muted-foreground">Your Personal AI Agent</span>
            </div>
            
            <div className="flex items-center gap-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 cursor-help">
                      <Zap className={`w-4 h-4 ${quickMode ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                      <span className="text-sm text-muted-foreground">Quick</span>
                      <Switch
                        checked={quickMode}
                        onCheckedChange={setQuickMode}
                        aria-label="Toggle quick mode"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-sm"><strong>Quick Mode:</strong> Skip the execution plan preview and run tasks immediately. Best for simple requests.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showScreenViewer ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowScreenViewer(!showScreenViewer)}
                      className="gap-2"
                    >
                      <Monitor className="w-4 h-4" />
                      Screen
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-sm">View Vazal's browser screen in real-time</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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

        {/* Chat Area - with padding bottom for input */}
        <main className="flex-1 overflow-y-auto pb-32">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {messages.length === 0 && !pendingPlan ? (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                <h2 className="text-3xl font-bold mb-4">Welcome to Vazal AI</h2>
                <p className="text-muted-foreground mb-8 max-w-md">
                  Your personal AI agent is ready. Ask me anything, and I'll show you a plan before executing.
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
                {/* Messages */}
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <LatexRenderer content={message.content} />
                      
                      {/* Show downloadable files */}
                      {message.files && message.files.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <p className="text-xs text-muted-foreground mb-2">📁 Output Files:</p>
                          <div className="flex flex-wrap gap-2">
                            {message.files.map((file, fileIdx) => (
                              <Button
                                key={fileIdx}
                                variant="outline"
                                size="sm"
                                className="gap-1 h-7 text-xs"
                                onClick={() => handleDownloadFile(file)}
                              >
                                <Download className="w-3 h-3" />
                                {file}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Pending Plan Card */}
                {pendingPlan && (
                  <div className="flex justify-start">
                    <Card className="max-w-[80%] p-4 border-2 border-primary/50">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        📋 Execution Plan
                        <span className="text-xs text-muted-foreground font-normal">
                          (Est. {pendingPlan.estimated_time})
                        </span>
                      </h3>
                      <ol className="list-decimal list-inside space-y-2 mb-4">
                        {pendingPlan.plan.map((step, idx) => (
                          <li key={idx} className="text-sm">{step}</li>
                        ))}
                      </ol>
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleConfirmPlan} 
                          size="sm"
                          className="gap-1"
                        >
                          <Check className="w-4 h-4" />
                          Execute
                        </Button>
                        <Button 
                          onClick={handleRejectPlan} 
                          variant="outline" 
                          size="sm"
                          className="gap-1"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        💡 Tip: You can refine your request if the plan doesn't look right.
                      </p>
                    </Card>
                  </div>
                )}

                {/* Processing indicator */}
                {isProcessing && processingStep && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">{processingStep}</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </main>

        {/* Input Area - Fixed at bottom, above preview banner */}
        <footer className="fixed bottom-10 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-md p-4" style={{ marginLeft: sidebarCollapsed ? '64px' : '280px' }}>
          <div className="max-w-4xl mx-auto">
            {/* Uploaded files preview */}
            {uploadedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-1 bg-muted rounded-lg px-2 py-1 text-sm">
                    <FileText className="w-3 h-3" />
                    <span className="max-w-[150px] truncate">{file.name}</span>
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="ml-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-3 items-end">
              {/* File upload button */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.md,.png,.jpg,.jpeg"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-[50px] w-[50px] shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing || isUploading}
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Paperclip className="w-5 h-5" />
                )}
              </Button>
              
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask Vazal anything... (Press Enter to send, Shift+Enter for new line)"
                className="min-h-[50px] max-h-[200px] resize-none"
                disabled={isProcessing || !!pendingPlan}
              />
              <Button 
                onClick={handleSend} 
                disabled={!input.trim() || isProcessing || !!pendingPlan}
                size="icon"
                className="h-[50px] w-[50px] shrink-0"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </footer>
      </div>
      {/* Screen Viewer Panel */}
      <ScreenViewer
        isVisible={showScreenViewer}
        onToggle={() => setShowScreenViewer(!showScreenViewer)}
      />
    </div>
  );
}
