import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, User, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import apiClient from '../../api/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  onClose: () => void;
}

export default function AIChatPanel({ onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I am the CarbonLoop AI assistant. I can help you understand your carbon impact, find the best conversion methods for your waste, or guide you through the platform. What can I help you with today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await apiClient.post('/api/ai/chat', { message: userMessage.content });
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: data.reply },
      ]);
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I am having trouble connecting to the AI service right now. The LLM integration might be disabled or misconfigured.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`bg-white rounded-2xl shadow-panel border border-charcoal-200 flex flex-col transition-all duration-300 ease-in-out ${
      expanded ? 'w-[400px] h-[600px]' : 'w-[320px] h-[480px]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-forest-800 text-white rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-bold">CarbonLoop AI</span>
        </div>
        <div className="flex items-center gap-1 text-white/70">
          <button onClick={() => setExpanded(!expanded)} className="p-1 hover:text-white transition-colors">
            {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className="p-1 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-charcoal-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-start gap-2 max-w-[90%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              msg.role === 'user' ? 'bg-forest-100 text-forest-800' : 'bg-white border border-charcoal-200 text-charcoal-600'
            }`}>
              {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
            </div>
            <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
              {msg.content.split('\n').map((line, i) => (
                <span key={i}>
                  {line}
                  <br />
                </span>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-start gap-2 max-w-[90%]">
            <div className="w-6 h-6 rounded-full bg-white border border-charcoal-200 text-charcoal-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-3 h-3" />
            </div>
            <div className="chat-bubble-ai text-charcoal-400 flex items-center gap-2 h-[44px]">
              <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t border-charcoal-200 rounded-b-xl">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about methodology, waste types..."
            disabled={loading}
            className="w-full bg-charcoal-50 border border-charcoal-200 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-200 focus:border-forest-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg text-white bg-forest-800 hover:bg-forest-900 disabled:bg-charcoal-300 disabled:text-charcoal-50 transition-colors"
          >
            <Send className="w-3.5 h-3.5 -ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
