import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function LiveChat({ onClose, pagerFailed }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [systemStatus, setSystemStatus] = useState('Initializing local environment...');
  
  const channelRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  // NEW: Ref to maintain keyboard focus
  const inputRef = useRef(null); 

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // NEW: The Home Button Kill Switch (Page Visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      // If the app is sent to the background, instantly close the chat
      if (document.hidden) {
        onClose(); 
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onClose]);

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

  // The Realtime WebSocket Connection
  useEffect(() => {
    const channel = supabase.channel('couple_chat', {
      config: { 
        broadcast: { self: true },
        presence: { key: 'Priya' } 
      },
    });

    channel
      .on('broadcast', { event: 'message' }, (payload) => {
        setMessages((prev) => [...prev, payload.payload]);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activeUsersCount = Object.keys(state).length;
        setIsConnected(activeUsersCount > 1);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online: true });
        } else {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !isConnected) return;

    const newMessage = {
      sender: 'Priya', 
      text: inputText,
      timestamp: Date.now(),
    };

    await channelRef.current.send({
      type: 'broadcast',
      event: 'message',
      payload: newMessage,
    });

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

  const handleTextChange = (e) => {
    setInputText(e.target.value);
    
    // Auto-resize logic
    const textarea = e.target;
    // THE FIX: Crush the height to 0 to force a clean recalculation of the scrollHeight
    textarea.style.height = '0px'; 
    
    // Clamp the height: minimum 44px, maximum 120px
    const newHeight = Math.max(44, Math.min(textarea.scrollHeight, 120));
    textarea.style.height = `${newHeight}px`;
  };

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
          onClick={onClose} 
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
            const isMe = msg.sender === 'Priya'; 
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

      {/* Input Form */}
      <footer className="bg-ios-card border-t border-gray-200 p-3 pb-safe shrink-0">
        {/* Changed to items-end so the Send button stays at the bottom when text area grows */}
        <form onSubmit={sendMessage} className="flex gap-2 items-end">
          <textarea
            name="chat-message"
            inputMode="text"
            ref={inputRef}
            value={inputText}
            onChange={handleTextChange} // Using the new auto-resize handler
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