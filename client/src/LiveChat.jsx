import React, { useState, useEffect, useRef } from 'react';
import { useChat } from './ChatProvider';

export default function LiveChat({ onClose, pagerFailed }) {
  const { messages, isConnected, canSendMessage, sendMessage, clearMessages } = useChat();
  
  const [inputText, setInputText] = useState('');
  const [systemStatus, setSystemStatus] = useState('Initializing local environment...');
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null); 

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Visibility cleanup (keep privacy)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearMessages();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [clearMessages]);

  // Trojan Horse Sequence (unchanged)
  useEffect(() => {
    if (isConnected || pagerFailed) return; 
    
    setSystemStatus('Initializing local environment...');
    
    const timer = setTimeout(() => {
      if (!isConnected && !pagerFailed) {
        setSystemStatus('Connecting to LLM inference cluster (us-east-1)...');
      }
    }, 10000);

    return () => {
      clearTimeout(timer);
    };
  }, [isConnected, pagerFailed]);

  // Pager Kill Switch (unchanged)
  useEffect(() => {
    if (pagerFailed) {
      setSystemStatus('Failed to connect to the server. Please close the chat and open again.');
    }
  }, [pagerFailed]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !canSendMessage) return;

    await sendMessage(inputText);

    setInputText('');
    
    if (inputRef.current) {
      inputRef.current.style.height = '44px';
      inputRef.current.focus();
    }
  };

  const handleInputFocus = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 300);
  };

  // Auto-resize textarea (unchanged)
  useEffect(() => {
    if (!inputRef.current) return;
    
    inputRef.current.style.height = '44px';
    const scrollHeight = inputRef.current.scrollHeight;
    inputRef.current.style.height = `${Math.max(44, Math.min(scrollHeight, 120))}px`;
  }, [inputText]);

  return (
    <div className="fixed top-0 left-0 w-full h-[100dvh] z-50 flex flex-col bg-ios-bg font-sans animate-slide-up">
      <header className="flex items-center justify-between px-4 py-3 bg-ios-card border-b border-gray-200 shadow-sm shrink-0">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-lg font-semibold text-black leading-tight">AI Chat</h1>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full transition-colors ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <span className="text-[12px] text-gray-500 font-medium tracking-wide">
              {isConnected ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <button 
          onClick={() => {
            stopPresence();
            clearMessages();
            onClose();
          }}
          className="text-ios-blue font-medium text-[15px] active:opacity-50 transition-opacity"
        >
          Close
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <div className="flex-1 min-h-[1rem]"></div>

        {messages.length === 0 ? (
          <div className="text-sm text-gray-500 text-center leading-relaxed font-mono px-4 pb-4">
            {isConnected 
              ? "How can I assist you today?" 
              : systemStatus} 
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.sender === 'priya'; 
            return (
              <div key={index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
                  isMe 
                    ? 'bg-ios-blue text-white rounded-l-2xl rounded-tr-2xl rounded-br-sm' 
                    : 'bg-ios-card text-black border border-gray-200 rounded-r-2xl rounded-tl-2xl rounded-bl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} className="shrink-0" />
      </main>

      <footer className="bg-ios-card border-t border-gray-200 p-3 pb-safe shrink-0">
        <form onSubmit={handleSend} className="flex gap-2 items-end">
          <textarea
            name="chat-message"
            inputMode="text"
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onFocus={handleInputFocus}
            disabled={!canSendMessage}
            placeholder={canSendMessage ? "Message..." : "Message..."}
            
            enterKeyHint="return"
            autoCapitalize="sentences"
            autoCorrect="on"
            spellCheck="true"
            
            rows={1}
            className="flex-1 bg-ios-bg border border-gray-200 rounded-[20px] px-4 py-2.5 text-[15px] focus:outline-none focus:border-ios-blue transition-all disabled:opacity-50 resize-none overflow-y-auto"
            style={{ height: '44px' }}
          />
          <button 
            type="submit" 
            disabled={!inputText.trim() || !canSendMessage}
            onMouseDown={(e) => e.preventDefault()}
            onTouchStart={(e) => e.preventDefault()}
            className="bg-ios-blue text-white font-medium px-5 py-2.5 rounded-full disabled:opacity-50 active:scale-95 transition-transform h-[44px] shrink-0"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}