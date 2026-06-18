import React, { useState, useEffect, useRef } from 'react';
import { useChat } from './ChatProvider';
import { X, Reply, Sun, Moon } from 'lucide-react'; 

// --- THE SWIPE ENGINE COMPONENT (INSTAGRAM STYLE) ---
const SwipeableMessage = ({ msg, isMe, onReply, isTop, isMiddle, isBottom }) => {
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

    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 10) {
      setIsSwiping(false);
      setTranslateX(0);
      return;
    }

    if (diffX > 0 && diffX <= 80) {
      setTranslateX(diffX);
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (translateX > 50) {
      onReply(msg);
    }
    setTranslateX(0);
  };

  let isReply = false;
  let replySender = '';
  let replyText = '';
  let actualText = msg.text;

  if (msg.text && msg.text.startsWith('$$REPLY$$')) {
    const match = msg.text.match(/\$\$REPLY\$\$\|([^|]+)\|([\s\S]*?)\$\$(.*)/);
    if (match) {
      isReply = true;
      replySender = match[1];
      replyText = match[2];
      actualText = match[3].trim();
    }
  }

  let borderRadiusClasses = "rounded-3xl"; 
  
  if (isMe) {
    if (isTop) borderRadiusClasses = "rounded-3xl rounded-br-md";
    else if (isMiddle) borderRadiusClasses = "rounded-l-3xl rounded-r-md";
    else if (isBottom) borderRadiusClasses = "rounded-3xl rounded-tr-md";
  } else {
    if (isTop) borderRadiusClasses = "rounded-3xl rounded-bl-md";
    else if (isMiddle) borderRadiusClasses = "rounded-r-3xl rounded-l-md";
    else if (isBottom) borderRadiusClasses = "rounded-3xl rounded-tl-md";
  }

  return (
    <div className="relative flex items-center w-full">
      <div 
        className="absolute left-0 flex items-center justify-center h-full transition-opacity duration-200"
        style={{ 
          opacity: Math.min(translateX / 50, 1),
          transform: `translateX(${translateX - 40}px)` 
        }}
      >
        <div className="bg-gray-200 dark:bg-neutral-800 rounded-full p-1.5 text-gray-500 shadow-inner">
          <Reply size={14} />
        </div>
      </div>

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
        <div className={`max-w-[75%] px-[14px] py-[10px] text-[15px] leading-snug flex flex-col gap-1 ${borderRadiusClasses} ${
          isMe 
            ? 'bg-violet-600 text-white'
            : 'bg-[#EFEFEF] dark:bg-[#262626] text-black dark:text-[#E0E0E0]' 
        }`}>
          
          {isReply && (
            <div className={`p-2 rounded-xl text-[13px] mb-1 border-l-2 ${
              isMe 
                ? 'bg-black/15 border-white/50 text-white' 
                : 'bg-black/5 dark:bg-white/10 border-gray-400 dark:border-gray-500 text-black dark:text-white'
            }`}>
              <div className="font-semibold opacity-80 mb-0.5">
                {replySender === 'priya' ? 'You' : 'AI'}
              </div>
              <div className="line-clamp-2 overflow-hidden opacity-90 text-[13px]">
                {replyText}
              </div>
            </div>
          )}
          
          <span className="whitespace-pre-wrap break-words">{actualText}</span>
        </div>
      </div>
    </div>
  );
};

// --- CRITICAL FIX: Destructure the new props passed from App.jsx ---
export default function LiveChat({ onClose, pagerFailed, isDarkMode, toggleTheme }) {
  const { messages, isConnected, sendMessage, clearMessages, startConnection, killConnection } = useChat();
  
  const [inputText, setInputText] = useState('');
  const [systemStatus, setSystemStatus] = useState('Initializing local environment...');
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

    let finalPayload = inputText;
    if (replyTarget) {
      finalPayload = `$$REPLY$$|${replyTarget.sender}|${replyTarget.text}$$ ${inputText}`;
    }

    await sendMessage(finalPayload);

    setInputText('');
    setReplyTarget(null); 
    
    if (inputRef.current) {
      inputRef.current.style.height = '44px'; 
      inputRef.current.focus(); 
    }
  };

  const handleTextChange = (e) => {
    setInputText(e.target.value);
    
    if (e.target) {
      e.target.style.height = '44px'; 
      e.target.style.height = `${Math.max(44, Math.min(e.target.scrollHeight, 120))}px`;
    }
  };

  const handleInputFocus = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 300);
  };

  const handleReplySwipe = (msg) => {
    let cleanText = msg.text;
    if (cleanText.startsWith('$$REPLY$$')) {
       const match = cleanText.match(/\$\$REPLY\$\$\|[^|]+\|[\s\S]*?\$\$(.*)/);
       if (match) cleanText = match[1].trim();
    }
    
    setReplyTarget({ ...msg, text: cleanText });
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div className={`fixed top-0 left-0 w-full h-[100dvh] z-50 font-sans animate-slide-up overscroll-none ${isDarkMode ? 'dark' : ''}`}>
      <div className="flex flex-col w-full h-full bg-white dark:bg-black transition-colors duration-200">
        
        <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-black border-b border-gray-200 dark:border-neutral-900 shadow-sm shrink-0 transition-colors duration-200">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-lg font-bold text-black dark:text-white leading-tight">AI Chat</h1>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full transition-colors ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className="text-[12px] text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                {isConnected ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* The button now triggers the global function passed from App.jsx */}
            <button 
              onClick={toggleTheme} 
              className="p-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 rounded-full active:bg-gray-100 dark:active:bg-neutral-800 transition-colors"
              aria-label="Toggle Theme"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button 
              onClick={() => {
                clearMessages(); 
                killConnection(); 
                onClose();
              }}
              className="text-blue-500 dark:text-blue-400 font-bold text-[15px] active:opacity-50 transition-opacity"
            >
              Close
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col relative overscroll-none">
          <div className="flex-1 min-h-[1rem]"></div>

          {messages.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed font-mono px-4 pb-4 mt-auto">
              {isConnected ? "How can I assist you today?" : systemStatus} 
            </div>
          ) : (
            messages.map((msg, index) => {
              const previousMsg = messages[index - 1];
              const nextMsg = messages[index + 1];

              const isSameAsPrevious = previousMsg && previousMsg.sender === msg.sender;
              const isSameAsNext = nextMsg && nextMsg.sender === msg.sender;

              const isTop = !isSameAsPrevious && isSameAsNext;
              const isMiddle = isSameAsPrevious && isSameAsNext;
              const isBottom = isSameAsPrevious && !isSameAsNext;
              const isIsolated = !isSameAsPrevious && !isSameAsNext;

              const marginTop = index === 0 ? "mt-0" : (!isSameAsPrevious ? "mt-4" : "mt-[2px]");

              return (
                <div key={index} className={marginTop}>
                  <SwipeableMessage 
                    msg={msg} 
                    isMe={msg.sender === 'priya'} 
                    onReply={handleReplySwipe} 
                    isTop={isTop || isIsolated}
                    isMiddle={isMiddle}
                    isBottom={isBottom || isIsolated}
                  />
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} className="shrink-0 h-4" />
        </main>

        <footer className="bg-white dark:bg-black flex flex-col shrink-0 pb-safe transition-colors duration-200">
          
          {replyTarget && (
            <div className="px-4 pt-3 pb-2 flex items-start justify-between bg-gray-50 dark:bg-[#121212] border-t border-gray-100 dark:border-neutral-900">
              <div className="flex-1 border-l-2 border-violet-500 pl-3 overflow-hidden">
                <span className="text-[13px] font-bold text-violet-600 dark:text-violet-400 block mb-0.5">
                  Replying to {replyTarget.sender === 'priya' ? 'Yourself' : 'AI'}
                </span>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1 break-all">
                  {replyTarget.text}
                </p>
              </div>
              <button 
                onClick={() => setReplyTarget(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 ml-3 shrink-0"
              >
                <X size={18} />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="flex gap-3 items-end p-3">
            <textarea
              name="chat-message"
              inputMode="text"
              ref={inputRef}
              value={inputText}
              onChange={handleTextChange}
              onFocus={handleInputFocus}
              disabled={!isConnected}
              placeholder={isConnected ? "Message..." : "Message..."}
              enterKeyHint="return" 
              autoCapitalize="sentences"
              autoCorrect="on"
              spellCheck="true"
              rows={1}
              className="flex-1 bg-gray-100 dark:bg-[#262626] text-black dark:text-white rounded-[22px] px-4 py-[10px] text-[15px] leading-relaxed focus:outline-none placeholder-gray-500 dark:placeholder-gray-400 transition-colors disabled:opacity-50 resize-none overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ height: '44px' }} 
            />
            <button 
              type="submit" 
              disabled={!inputText.trim() || !isConnected}
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => e.preventDefault()}
              className="text-violet-600 dark:text-violet-500 font-bold text-[15px] px-3 py-2.5 disabled:opacity-50 active:opacity-70 transition-opacity shrink-0 h-[44px] flex items-center justify-center"
            >
              Send
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}