'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Trash2, MessageSquare } from 'lucide-react';
import { MessageBubble, TypingIndicator } from './message-bubble';
import { SuggestionsPanel } from './suggestions-panel';
import {
  useSendMessage,
  useConversation,
  useConversations,
  useDeleteConversation,
} from '@/hooks/use-copilot';
import type { CopilotContext, CopilotMessage } from '@/types/copilot';
import { cn } from '@/lib/utils';

interface ChatPanelProps {
  context?: CopilotContext;
  className?: string;
}

export function ChatPanel({ context, className }: ChatPanelProps) {
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [localMessages, setLocalMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: convData } = useConversation(conversationId ?? null);
  const { mutate: sendMsg, isPending: isSending } = useSendMessage();
  const { mutate: delConv } = useDeleteConversation();

  // Sync server conversation into local display
  useEffect(() => {
    if (convData) setLocalMessages(convData.messages);
  }, [convData]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages, isSending]);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    // Optimistic user message
    const userMsg: CopilotMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMsg]);
    setInput('');

    sendMsg(
      { message: trimmed, conversationId, context },
      {
        onSuccess: (data) => {
          setConversationId(data.conversationId);
          const aiMsg: CopilotMessage = {
            id: data.messageId,
            role: 'assistant',
            content: data.content,
            timestamp: new Date().toISOString(),
          };
          setLocalMessages((prev) => [...prev, aiMsg]);
        },
        onError: () => {
          const errMsg: CopilotMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Ocorreu um erro ao processar sua mensagem. Tente novamente.',
            timestamp: new Date().toISOString(),
          };
          setLocalMessages((prev) => [...prev, errMsg]);
        },
      }
    );
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleNewChat = () => {
    setConversationId(undefined);
    setLocalMessages([]);
    setInput('');
    inputRef.current?.focus();
  };

  const handleDelete = () => {
    if (!conversationId) return;
    delConv(conversationId, {
      onSuccess: handleNewChat,
    });
  };

  const hasMessages = localMessages.length > 0;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-medium">
            {convData?.title ?? (hasMessages ? 'Conversa atual' : 'Nova conversa')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {hasMessages && (
            <button
              onClick={handleDelete}
              disabled={!conversationId}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
              title="Apagar conversa"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            + Nova conversa
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {!hasMessages ? (
          <SuggestionsPanel
            onSelect={(p) => {
              setInput(p);
              sendMessage(p);
            }}
          />
        ) : (
          <>
            {localMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isSending && <TypingIndicator />}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-background p-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-resize
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
            }}
            onKeyDown={handleKey}
            placeholder="Pergunte ao Atlas Copilot… (Enter para enviar, Shift+Enter para nova linha)"
            className="flex-1 resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[46px] max-h-32"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isSending}
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground text-center">
          Atlas Copilot ·{' '}
          {process.env.NEXT_PUBLIC_ANTHROPIC_MODE === 'live' ? 'Claude Opus 4.8' : 'Modo Demo'}
        </p>
      </div>
    </div>
  );
}
