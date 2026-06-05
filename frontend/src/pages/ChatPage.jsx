  import { useState, useEffect, useRef } from 'react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Send, Loader2, Trash2, AlertTriangle, Bot, User } from 'lucide-react';
import { chatService } from '../services/chatService';
import { readinessService } from '../services/readinessService';

export default function ChatPage() {
  useDocumentTitle('AI Chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Define functions before useEffect hooks
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    const message = input.trim();
    if (!message || isSending) return;

    setIsSending(true);
    setError(null);

    // Add user message optimistically
    const userMessage = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    try {
      const response = await chatService.sendMessage(message);

      // Replace optimistic user message and add assistant reply
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== userMessage.id);
        return [
          ...filtered,
          {
            id: `user-${Date.now()}`,
            role: 'user',
            content: response.userMessage || message,
            createdAt: response.timestamp || new Date().toISOString(),
          },
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: response.assistantReply,
            createdAt: response.timestamp || new Date().toISOString(),
          },
        ];
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Gagal mengirim pesan. Silakan coba lagi.');
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Hapus semua riwayat chat? Tindakan ini tidak dapat dibatalkan.')) {
      return;
    }
    try {
      await chatService.clearHistory();
      setMessages([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
      setError('Gagal menghapus riwayat chat.');
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Load chat history on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const history = await chatService.getHistory(50);
        if (mounted) setMessages(history || []);
      } catch (err) {
        console.error('Failed to load chat history:', err);
        if (mounted) setError('Gagal memuat riwayat chat. Silakan coba lagi.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    readinessService.get().then((data) => mounted && setReadiness(data)).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto w-full h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 md:mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">AI Assistant</h1>
          <p className="text-gray-500 text-xs md:text-sm mt-0.5">
            Konsultasikan keuangan Anda dengan DompetCerdas AI
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="text-gray-500 hover:text-red-400 p-2 rounded-lg transition-colors"
            title="Hapus riwayat chat"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Data readiness warning */}
      {readiness?.features?.chat?.status === 'no_data' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-2 md:mb-4 flex items-start gap-3 flex-shrink-0">
          <AlertTriangle size={18} className="text-amber-800 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Data Belum Cukup</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {readiness.features.chat.reason}
            </p>
          </div>
        </div>
      )}

      {/* Chat container */}
      <div className="flex-1 bg-white border border-[#E8D5C4] shadow-sm rounded-2xl flex flex-col overflow-hidden">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-[#FAD4C0] animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Bot size={48} className="mb-4 opacity-50" />
              <p className="text-center">Belum ada percakapan.</p>
              <p className="text-center text-sm mt-1">
                Mulai bertanya tentang keuangan Anda!
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-[#80A1C1]/20 flex items-center justify-center flex-shrink-0">
                    <Bot size={16} className="text-[#2C5282]" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-[#FAD4C0] text-[#7C4A2D] rounded-tr-sm'
                      : 'bg-white border border-[#E8D5C4] text-gray-800 rounded-tl-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      msg.role === 'user' ? 'text-[#7C4A2D]/70' : 'text-gray-500'
                    }`}
                  >
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-[#FAD4C0] flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-[#7C4A2D]" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-[#E8D5C4] p-4">
          {error && (
            <div className="mb-3 p-2 text-red-800 bg-red-50 border border-red-200 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik pesan Anda..."
              disabled={isSending}
              className="flex-1 bg-white border border-[#E8D5C4] rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FAD4C0]/50 focus:border-[#FAD4C0] disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isSending}
              className="bg-[#FAD4C0] hover:bg-[#f0c4b0] disabled:opacity-50 disabled:cursor-not-allowed text-[#7C4A2D] px-4 py-3 rounded-xl transition-colors flex items-center gap-2"
            >
              {isSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Tekan Enter untuk kirim, Shift+Enter untuk baris baru
          </p>
        </div>
      </div>
    </div>
  );
}