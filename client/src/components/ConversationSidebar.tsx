import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Conversation {
  id: number;
  title: string | null;
  updatedAt: Date | string;
}

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId: number | undefined;
  onSelectConversation: (id: number) => void;
  onNewChat: () => void;
  onDeleteConversation?: (id: number) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isLoading?: boolean;
  isDeleting?: boolean;
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  isCollapsed,
  onToggleCollapse,
  isLoading = false,
  isDeleting = false,
}: ConversationSidebarProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const handleDeleteClick = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirmDeleteId === id) {
      // Second click - confirm delete
      onDeleteConversation?.(id);
      setConfirmDeleteId(null);
    } else {
      // First click - show confirmation
      setConfirmDeleteId(id);
      // Reset after 3 seconds if not confirmed
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-12 h-full bg-background border-r border-border flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="mb-4"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewChat}
          title="New Chat"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-64 h-full bg-background border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-sm">Conversations</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Loading...
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No conversations yet
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="relative group"
                onMouseEnter={() => setHoveredId(conversation.id)}
                onMouseLeave={() => {
                  setHoveredId(null);
                  if (confirmDeleteId === conversation.id) {
                    setConfirmDeleteId(null);
                  }
                }}
              >
                <button
                  onClick={() => onSelectConversation(conversation.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "flex items-start gap-2",
                    activeConversationId === conversation.id &&
                      "bg-accent text-accent-foreground"
                  )}
                >
                  <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate pr-6">
                      {conversation.title || "New Conversation"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(conversation.updatedAt)}
                    </div>
                  </div>
                </button>
                
                {/* Delete button - appears on hover */}
                {onDeleteConversation && (hoveredId === conversation.id || confirmDeleteId === conversation.id) && (
                  <button
                    onClick={(e) => handleDeleteClick(e, conversation.id)}
                    disabled={isDeleting}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded",
                      "transition-colors",
                      confirmDeleteId === conversation.id
                        ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        : "hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                    )}
                    title={confirmDeleteId === conversation.id ? "Click again to confirm" : "Delete conversation"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
