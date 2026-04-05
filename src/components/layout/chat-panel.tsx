'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { X, Bot, MessageSquarePlus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompanyStore } from '@/stores/company-store';
import { useChatStore } from '@/stores/chat-store';
import { MessageBubble } from '@/components/chat/message-bubble';
import { ChatInput } from '@/components/chat/chat-input';
import { apiJson } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3030/api/v1';

const EXAMPLE_PROMPTS = [
  'What are the key risks for this company?',
  'Summarize the financial highlights',
  'Analyze the competitive landscape',
  'Suggest improvements for the reports',
];

interface ChatPanelProps {
  companyId: string;
}

export function ChatPanel({ companyId }: ChatPanelProps) {
  const { setChatOpen } = useCompanyStore();
  const {
    messages, conversationId, isLoading,
    setConversationId, addMessage, updateLastAssistantMessage,
    finalizeLastAssistantMessage, setLoading, setError, clearMessages, loadMessages,
  } = useChatStore();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    async function init() {
      try {
        const conversations = await apiJson<Array<{ id: string }>>(`/companies/${companyId}/chat/conversations`);
        if (conversations && conversations.length > 0) {
          const conv = conversations[0];
          setConversationId(conv.id);
          const msgs = await apiJson<Array<{ id: string; role: string; content: string; created_at: string }>>(
            `/companies/${companyId}/chat/conversations/${conv.id}/messages`
          );
          if (msgs && msgs.length > 0) {
            loadMessages(msgs.map((m) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              timestamp: new Date(m.created_at),
            })));
          }
        }
      } catch { /* silent */ }
    }
    init();
  }, [companyId, setConversationId, loadMessages]);

  const ensureConversation = useCallback(async (): Promise<string> => {
    if (conversationId) return conversationId;
    const conv = await apiJson<{ id: string }>(`/companies/${companyId}/chat/conversations`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Chat' }),
    });
    setConversationId(conv.id);
    return conv.id;
  }, [companyId, conversationId, setConversationId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    setInput('');
    setError(null);
    addMessage({ role: 'user', content: text.trim() });
    setLoading(true);
    addMessage({ role: 'assistant', content: '', isStreaming: true });

    try {
      const convId = await ensureConversation();
      const token = localStorage.getItem('token');
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch(
        `${API_URL}/companies/${companyId}/chat/conversations/${convId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ content: text.trim() }),
          signal: controller.signal,
        }
      );

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No stream');

      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':') || trimmed.startsWith('event:')) continue;
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') { finalizeLastAssistantMessage(); continue; }
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.content || parsed.delta || '';
              if (typeof delta === 'string' && delta) {
                accumulated += delta;
                updateLastAssistantMessage(accumulated);
              }
            } catch { /* skip */ }
          }
        }
      }
      finalizeLastAssistantMessage();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Failed';
      setError(msg);
      toast.error(msg);
      updateLastAssistantMessage('Sorry, I encountered an error. Please try again.');
      finalizeLastAssistantMessage();
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [isLoading, companyId, ensureConversation, addMessage, updateLastAssistantMessage, finalizeLastAssistantMessage, setLoading, setError]);

  function handleNewChat() {
    if (abortRef.current) abortRef.current.abort();
    clearMessages();
    setInput('');
    initializedRef.current = true;
  }

  return (
    <div className="flex h-full w-80 flex-col border-l bg-background xl:w-96">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold">AI Assistant</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={handleNewChat} title="New Chat">
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => setChatOpen(false)} title="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium mb-1">Orionmano AI Assistant</p>
            <p className="text-xs text-muted-foreground mb-6">
              Ask me anything about this company&apos;s financials, industry, or advisory needs.
            </p>
            <div className="flex flex-col gap-2 w-full">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => { setInput(prompt); sendMessage(prompt); }}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-left text-xs',
                    'text-muted-foreground hover:text-foreground',
                    'hover:border-primary/30 hover:bg-primary/5',
                    'transition-colors cursor-pointer'
                  )}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            timestamp={msg.timestamp}
            isStreaming={msg.isStreaming}
          />
        ))}

        {isLoading && !messages.some((m) => m.isStreaming && m.content === '') &&
          messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="rounded-lg bg-muted px-3 py-2">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput value={input} onChange={setInput} onSend={() => sendMessage(input)} disabled={isLoading} />
    </div>
  );
}
