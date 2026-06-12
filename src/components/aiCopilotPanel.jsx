import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';

/**
 * AI Copilot Panel Component.
 * Provides a conversational interface where users can ask questions about their code.
 * It automatically fetches the current editor content and passes it to the AI backend
 * to provide context-aware responses.
 *
 * @param {string} workspaceId - The unique identifier of the current workspace.
 * @param {string} token - The authentication token to access the AI backend.
 * @param {Function} getEditorContent - Function that returns the current text inside the active code editor.
 */
export default function AiCopilotPanel({ workspaceId, token, getEditorContent }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef(null);

  // Automatically scroll to the bottom of the chat when new messages arrive.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Handles sending the user's prompt to the AI backend.
   * Retrieves the latest code context, sends the request, and appends the AI's response to the chat log.
   */
  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    // Append the user's message immediately for a responsive UI.
    const userMsg = { id: Date.now().toString(), sender: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Retrieve the active file context so the AI knows what code the user is asking about.
    const fileContext = getEditorContent();

    try {
      // POST the prompt and file context to the AI endpoint.
      const response = await fetch(`http://localhost:5000/projects/${workspaceId}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: text, fileContext })
      });
      const data = await response.json();
      
      // Append the AI's response back to the chat.
      const botMsg = { id: (Date.now() + 1).toString(), sender: 'bot', text: data.response || 'No response.' };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      // Gracefully handle backend errors by displaying them in the chat.
      const errorMsg = { id: (Date.now() + 1).toString(), sender: 'bot', text: `Error: ${error.message}` };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-overlay)] border-l border-[var(--border-color)] transition-colors duration-300">
      <div className="flex items-center px-4 h-10 bg-[var(--bg-elevated)] border-b border-[var(--border-color)] shrink-0 transition-colors duration-300">
        <Bot className="w-4 h-4 text-[var(--accent-color)] mr-2" />
        <span className="text-sm font-semibold text-[var(--text-primary)]">AI Copilot</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] space-y-3 py-8">
            <Bot className="w-10 h-10 opacity-60" />
            <p className="text-sm text-center font-medium">How can I help you with your code today?</p>
            <p className="text-xs text-center opacity-75">I automatically read your active file.</p>
          </div>
        )}
        
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${msg.sender === 'user' ? 'bg-[var(--accent-color)] text-white' : 'bg-emerald-600/20 text-emerald-400'}`}>
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`max-w-[80%] rounded-lg p-3 text-sm whitespace-pre-wrap transition-colors duration-300 ${msg.sender === 'user' ? 'bg-[var(--accent-color)] text-white bg-opacity-20 border border-[var(--accent-color)]' : 'bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border-color)]'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="rounded-lg p-3 text-sm bg-[var(--bg-base)] border border-[var(--border-color)] flex items-center transition-colors duration-300">
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              <span className="ml-2 text-[var(--text-secondary)]">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 bg-[var(--bg-elevated)] border-t border-[var(--border-color)] shrink-0 transition-colors duration-300">
        <div className="flex items-center gap-2 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-lg p-1 transition-colors duration-300 focus-within:border-[var(--accent-color)]">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask about your code..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] px-3 py-2 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-md bg-[var(--accent-color)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
