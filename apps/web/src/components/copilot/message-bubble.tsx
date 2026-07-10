'use client';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
import type { CopilotMessage } from '@/types/copilot';

// Minimal Markdown renderer — handles bold, code blocks, inline code, lists
function renderMarkdown(text: string): React.ReactNode {
  // Split on code blocks first
  const codeBlockRe = /```(\w*)\n?([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderInline(text.slice(lastIndex, match.index)));
    }
    const lang = match[1] ?? '';
    const code = match[2] ?? '';
    parts.push(
      <div key={match.index} className="my-2 rounded-md overflow-hidden">
        {lang && (
          <div className="bg-slate-700 text-slate-300 text-[10px] px-3 py-1 font-mono">{lang}</div>
        )}
        <pre className="bg-slate-800 text-slate-100 text-xs p-3 overflow-x-auto leading-relaxed whitespace-pre">
          <code>{code.trimEnd()}</code>
        </pre>
      </div>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(renderInline(text.slice(lastIndex)));
  }
  return <>{parts}</>;
}

function renderInline(text: string): React.ReactNode {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        const trimmed = line.trimStart();
        // Heading
        if (trimmed.startsWith('### '))
          return (
            <p key={i} className="font-semibold text-sm mt-3 mb-1">
              {renderSpans(trimmed.slice(4))}
            </p>
          );
        if (trimmed.startsWith('## '))
          return (
            <p key={i} className="font-bold text-sm mt-3 mb-1">
              {renderSpans(trimmed.slice(3))}
            </p>
          );
        if (trimmed.startsWith('# '))
          return (
            <p key={i} className="font-bold text-base mt-3 mb-1">
              {renderSpans(trimmed.slice(2))}
            </p>
          );
        // List item
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <li key={i} className="ml-4 list-disc text-sm leading-relaxed">
              {renderSpans(trimmed.slice(2))}
            </li>
          );
        }
        if (/^\d+\. /.test(trimmed)) {
          return (
            <li key={i} className="ml-4 list-decimal text-sm leading-relaxed">
              {renderSpans(trimmed.replace(/^\d+\. /, ''))}
            </li>
          );
        }
        // Empty line → spacing
        if (trimmed === '') return <div key={i} className="h-2" />;
        return (
          <p key={i} className="text-sm leading-relaxed">
            {renderSpans(line)}
          </p>
        );
      })}
    </>
  );
}

function renderSpans(text: string): React.ReactNode {
  // **bold**, `inline code`
  const re = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2]) parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[3])
      parts.push(
        <code
          key={m.index}
          className="bg-slate-700/60 text-amber-300 rounded px-1 py-0.5 text-[11px] font-mono"
        >
          {m[3]}
        </code>
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

interface MessageBubbleProps {
  message: CopilotMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white',
          isUser ? 'bg-indigo-600' : 'bg-slate-700'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-indigo-400" />}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-indigo-600 text-white rounded-tr-sm'
            : 'bg-card border border-border text-foreground rounded-tl-sm'
        )}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose-sm">{renderMarkdown(message.content)}</div>
        )}
        <p
          className={cn(
            'mt-1.5 text-[10px] text-right',
            isUser ? 'text-indigo-200' : 'text-muted-foreground'
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700">
        <Bot className="h-4 w-4 text-indigo-400" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
