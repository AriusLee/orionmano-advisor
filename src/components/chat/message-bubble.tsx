'use client';

import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderMarkdown(text: string): string {
  let html = text;
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, _l, code) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').trimEnd();
    return `<pre class="my-2 rounded-md bg-slate-900 p-3 text-xs text-slate-100 overflow-x-auto"><code>${escaped}</code></pre>`;
  });
  html = html.replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-xs font-mono">$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^([*-]) (.+)$/gm, '<li class="ml-4 list-disc">$2</li>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>');
  html = html.replace(/((?:<li class="ml-4 list-disc">.*<\/li>\n?)+)/g, '<ul class="my-1 space-y-0.5">$1</ul>');
  html = html.replace(/((?:<li class="ml-4 list-decimal">.*<\/li>\n?)+)/g, '<ol class="my-1 space-y-0.5">$1</ol>');
  html = html.replace(/^### (.+)$/gm, '<h4 class="font-semibold text-sm mt-2 mb-1">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 class="font-semibold text-sm mt-2 mb-1">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2 class="font-bold text-base mt-2 mb-1">$1</h2>');
  html = html.replace(/\n/g, '<br/>');
  html = html.replace(/(<\/(?:pre|ul|ol|li|h[2-4])>)<br\/>/g, '$1');
  html = html.replace(/<br\/>(<(?:pre|ul|ol|h[2-4]))/g, '$1');
  return html;
}

export function MessageBubble({ role, content, timestamp, isStreaming }: MessageBubbleProps) {
  const renderedHtml = useMemo(() => {
    if (role === 'assistant' && content) return renderMarkdown(content);
    return null;
  }, [role, content]);

  return (
    <div className={cn('flex gap-2', role === 'user' ? 'justify-end' : 'justify-start')}>
      {role === 'assistant' && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm',
            role === 'user'
              ? 'bg-primary text-primary-foreground max-w-[80%] ml-auto'
              : 'bg-muted text-foreground max-w-[85%]'
          )}
        >
          {role === 'assistant' && renderedHtml ? (
            <div
              className="prose prose-sm max-w-none break-words [&_pre]:my-2"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          ) : (
            <p className="whitespace-pre-wrap break-words">{content}</p>
          )}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
          )}
        </div>
        <span className={cn('text-[10px] text-muted-foreground/60 px-1', role === 'user' ? 'text-right' : 'text-left')}>
          {formatTime(timestamp)}
        </span>
      </div>
      {role === 'user' && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 mt-0.5">
          <User className="h-4 w-4 text-slate-600" />
        </div>
      )}
    </div>
  );
}
