import React, { useState, useEffect, useRef } from 'react';
import { useChat } from './ChatProvider';

export default function LiveChat({ onClose, pagerFailed }) {
  const { 
    messages, 
    isConnected, 
    isSheTyping, 
    sendMessage, 
    sendTyping, 
    clearMessages, 
    startConnection, 
    killConnection,
    currentUser
  } = useChat();
  
  const [inputText, setInputText] = useState('');
  const [systemStatus, setSystemStatus] = useState('Initializing local environment...');
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null); 
  const typingTimeoutRef = useRef(null);

  // Handle typing state
  useEffect(() => {
    if (inputText.trim()) {
      sendTyping(true);
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(false);
      }, 2000);
    } else {
      sendTyping(false);
    }
  }, [inputText, sendTyping]);

  // NEW: Turn on the radio when the chat opens
  useEffect(() => {
    startConnection();
  }, []);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // NEW: The Home Button Kill Switch (Page Visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearMessages(); // Wipe RAM
        killConnection(); // SEVER THE NETWORK
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [onClose, clearMessages, killConnection]);

  // The Trojan Horse Sequence (10-Second Hang)
  useEffect(() => {
    // If you are connected, or if the Telegram pager already threw a 503 fatal error, do not run this.
    if (isConnected || pagerFailed) return; 
    
    setSystemStatus('Initializing local environment...');
    
    const timer = setTimeout(() => {
      // Double-check that you haven't connected or failed during that 10-second wait
      if (!isConnected && !pagerFailed) {
        setSystemStatus('Connecting to LLM inference cluster (us-east-1)...');
      }
    }, 10000); // 10,000 milliseconds = 10 seconds

    return () => {
      clearTimeout(timer);
    };
  }, [isConnected, pagerFailed]);

  // NEW: Pager Kill Switch
  useEffect(() => {
    if (pagerFailed) {
      setSystemStatus('Failed to connect to the server. Please close the chat and open again.');
    }
  }, [pagerFailed]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !isConnected) return;

    await sendMessage(inputText);

    setInputText('');
    
    // NEW: After sending a message, reset the input box height and keep focus to prevent Android keyboard issues
    if (inputRef.current) {
      inputRef.current.style.height = '44px'; // Shrink the box back down
      inputRef.current.focus(); // Keep keyboard open
    }
  };

  const handleInputFocus = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 300);
  };

  // NEW: The React-native auto-resize hook
  useEffect(() => {
    if (!inputRef.current) return;
    
    // 1. Reset to base height to strip old DOM memory
    inputRef.current.style.height = '44px';
    
    // 2. Measure the TRUE height of the newly rendered text
    const scrollHeight = inputRef.current.scrollHeight;
    
    // 3. Clamp between 44px and 120px, and apply
    inputRef.current.style.height = `${Math.max(44, Math.min(scrollHeight, 120))}px`;
  }, [inputText]); // <--- This array tells React to run this every time the text changes

  // NEW: DVH used here to handle the Android keyboard resizing the browser
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
            clearMessages(); // Wipe RAM
            killConnection(); // SEVER THE NETWORK
            onClose();
          }}
          className="text-ios-blue font-medium text-[15px] active:opacity-50 transition-opacity"
        >
          Close
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {/* NEW: The Spring-Loaded Spacer. This forces messages to anchor to the bottom. */}
        <div className="flex-1 min-h-[1rem]"></div>

        {messages.length === 0 ? (
          <div className="text-sm text-gray-500 text-center leading-relaxed font-mono px-4 pb-4">
            {isConnected 
              ? "How can I assist you today?" 
              : systemStatus} 
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.sender === currentUser; // Changed from hardcoded 'priya' to currentUser
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

        {isSheTyping && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-ios-card text-gray-500 border border-gray-100 px-4 py-2 rounded-2xl text-[13px] flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></span>
              </span>
              AI is typing...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="shrink-0" />
      </main>

      {/* Input Form */}
      <footer className="bg-ios-card border-t border-gray-200 p-3 pb-safe shrink-0">
        {/* Changed to items-end so the Send button stays at the bottom when text area grows */}
        <form onSubmit={handleSend} className="flex gap-2 items-end">
          <textarea
            name="chat-message"
            inputMode="text"
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onFocus={handleInputFocus}
            disabled={!isConnected}
            placeholder={isConnected ? "Message..." : "Message..."}
            
            enterKeyHint="return" // Changes Android keyboard button to a newline arrow
            autoCapitalize="sentences"
            autoCorrect="on"
            spellCheck="true"
            
            rows={1}
            // Removed whitespace-nowrap and fully-rounded corners. Added overflow-y-auto for massive messages.
            className="flex-1 bg-ios-bg border border-gray-200 rounded-[20px] px-4 py-2.5 text-[15px] focus:outline-none focus:border-ios-blue transition-all disabled:opacity-50 resize-none overflow-y-auto"
            style={{ height: '44px' }} // Initial base height
          />
          <button 
            type="submit" 
            disabled={!inputText.trim() || !isConnected}
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