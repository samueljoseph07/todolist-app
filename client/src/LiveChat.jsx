import React, { useState, useEffect, useRef } from 'react';
import { useChat } from './ChatProvider';
import { X, Reply } from 'lucide-react'; // NEW IMPORTS

// --- THE SWIPE ENGINE COMPONENT ---
// This handles the touch math for individual message bubbles without polluting the main app
const SwipeableMessage = ({ msg, isMe, onReply }) => {
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    setIsSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!isSwiping) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    
    const diffX = currentX - startX.current;
    const diffY = currentY - startY.current;

    // If she is scrolling vertically, cancel the horizontal swipe instantly
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 10) {
      setIsSwiping(false);
      setTranslateX(0);
      return;
    }

    // Only allow swipe right, capped at 80px
    if (diffX > 0 && diffX <= 80) {
      setTranslateX(diffX);
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    // If she swiped past the 50px threshold, trigger the reply
    if (translateX > 50) {
      onReply(msg);
    }
    // Always snap back to original position
    setTranslateX(0);
  };

  // --- THE DATA HACK: DELIMITER PARSER ---
  let isReply = false;
  let replySender = '';
  let replyText = '';
  let actualText = msg.text;

  // Intercept the hidden pattern and extract the data
  if (msg.text && msg.text.startsWith('$$REPLY$$')) {
    // Regex extracts: Sender | Replied Text | New Text
    const match = msg.text.match(/\$\$REPLY\$\$\|([^|]+)\|([\s\S]*?)\$\$(.*)/);
    if (match) {
      isReply = true;
      replySender = match[1];
      replyText = match[2];
      actualText = match[3].trim();
    }
  }

  return (
    <div className="relative flex items-center w-full my-1">
      {/* The Hidden Reply Icon that reveals on swipe */}
      <div 
        className="absolute left-0 flex items-center justify-center h-full transition-opacity duration-200"
        style={{ 
          opacity: Math.min(translateX / 50, 1),
          transform: `translateX(${translateX - 40}px)` 
        }}
      >
        <div className="bg-gray-200 rounded-full p-2 text-gray-600 shadow-inner">
          <Reply size={16} />
        </div>
      </div>

      {/* The Draggable Message Bubble */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}
        style={{ 
          transform: `translateX(${translateX}px)`, 
          transition: isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)' 
        }}
      >
        <div className={`max-w-[75%] px-3 py-2.5 text-[15px] leading-relaxed shadow-sm flex flex-col gap-1 ${
          isMe 
            ? 'bg-ios-blue text-white rounded-l-2xl rounded-tr-2xl rounded-br-sm' 
            : 'bg-white text-black border border-gray-200 rounded-r-2xl rounded-tl-2xl rounded-bl-sm'
        }`}>
          
          {/* THE RENDERED REPLY BLOCK */}
          {isReply && (
            <div className={`p-2 rounded-lg text-sm mb-1 ${isMe ? 'bg-blue-600/50' : 'bg-gray-100 border-l-2 border-ios-blue'}`}>
              <div className={`font-semibold text-xs mb-0.5 ${isMe ? 'text-blue-100' : 'text-ios-blue'}`}>
                {replySender === 'priya' ? 'You' : 'AI'}
              </div>
              <div className={`line-clamp-2 overflow-hidden ${isMe ? 'text-blue-50' : 'text-gray-500'}`}>
                {replyText}
              </div>
            </div>
          )}
          
          {/* THE ACTUAL MESSAGE */}
          <span>{actualText}</span>
        </div>
      </div>
    </div>
  );
};

export default function LiveChat({ onClose, pagerFailed }) {
  const { messages, isConnected, sendMessage, clearMessages, startConnection, killConnection } = useChat();
  
  const [inputText, setInputText] = useState('');
  const [systemStatus, setSystemStatus] = useState('Initializing local environment...');
  
  // NEW STATE: Holds the message object we are currently swiping on
  const [replyTarget, setReplyTarget] = useState(null); 
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null); 

  useEffect(() => {
    startConnection();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearMessages(); 
        killConnection(); 
        onClose();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [onClose, clearMessages, killConnection]);

  useEffect(() => {
    if (isConnected || pagerFailed) return; 
    setSystemStatus('Initializing local environment...');
    const timer = setTimeout(() => {
      if (!isConnected && !pagerFailed) {
        setSystemStatus('Connecting to LLM inference cluster (us-east-1)...');
      }
    }, 10000); 
    return () => clearTimeout(timer);
  }, [isConnected, pagerFailed]);

  useEffect(() => {
    if (pagerFailed) {
      setSystemStatus('Failed to connect to the server. Please close the chat and open again.');
    }
  }, [pagerFailed]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !isConnected) return;

    // --- BUNDLE THE DATA HACK BEFORE SENDING ---
    // If a reply exists, format it with our secret delimiter string so the receiver can parse it
    let finalPayload = inputText;
    if (replyTarget) {
      // Format: $$REPLY$$|sender|Original Text$$ Actual Input
      finalPayload = `$$REPLY$$|${replyTarget.sender}|${replyTarget.text}$$ ${inputText}`;
    }

    await sendMessage(finalPayload);

    setInputText('');
    setReplyTarget(null); // Clear the reply target after sending
    
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

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = '44px';
    const scrollHeight = inputRef.current.scrollHeight;
    inputRef.current.style.height = `${Math.max(44, Math.min(scrollHeight, 120))}px`;
  }, [inputText]); 

  // Function to trigger when a message is swiped
  const handleReplySwipe = (msg) => {
    // If it's already a reply message, extract the *actual* text, don't quote the delimiters
    let cleanText = msg.text;
    if (cleanText.startsWith('$$REPLY$$')) {
       const match = cleanText.match(/\$\$REPLY\$\$\|[^|]+\|[\s\S]*?\$\$(.*)/);
       if (match) cleanText = match[1].trim();
    }
    
    setReplyTarget({ ...msg, text: cleanText });
    // Auto focus input when replying
    if (inputRef.current) inputRef.current.focus();
  };

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
            clearMessages(); 
            killConnection(); 
            onClose();
          }}
          className="text-ios-blue font-medium text-[15px] active:opacity-50 transition-opacity"
        >
          Close
        </button>
      </header>

      {/* Added overflow-x-hidden to prevent horizontal scrolling when swiping */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col gap-2 relative">
        <div className="flex-1 min-h-[1rem]"></div>

        {messages.length === 0 ? (
          <div className="text-sm text-gray-500 text-center leading-relaxed font-mono px-4 pb-4">
            {isConnected ? "How can I assist you today?" : systemStatus} 
          </div>
        ) : (
          messages.map((msg, index) => (
            <SwipeableMessage 
              key={index} 
              msg={msg} 
              isMe={msg.sender === 'priya'} 
              onReply={handleReplySwipe} 
            />
          ))
        )}
        <div ref={messagesEndRef} className="shrink-0 h-4" />
      </main>

      {/* Input Form Wrapper */}
      <footer className="bg-ios-card border-t border-gray-200 flex flex-col shrink-0 pb-safe">
        
        {/* THE REPLY TARGET UI */}
        {replyTarget && (
          <div className="px-4 pt-3 pb-1 flex items-start justify-between bg-gray-50 border-b border-gray-200">
            <div className="flex-1 border-l-2 border-ios-blue pl-3 overflow-hidden">
              <span className="text-xs font-bold text-ios-blue block mb-0.5">
                Replying to {replyTarget.sender === 'priya' ? 'Yourself' : 'AI'}
              </span>
              <p className="text-sm text-gray-600 line-clamp-1 break-all">
                {replyTarget.text}
              </p>
            </div>
            <button 
              onClick={() => setReplyTarget(null)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-full bg-gray-200 ml-3 shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="flex gap-2 items-end p-3">
          <textarea
            name="chat-message"
            inputMode="text"
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onFocus={handleInputFocus}
            disabled={!isConnected}
            placeholder={isConnected ? "Message..." : "Message..."}
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