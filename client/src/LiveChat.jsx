import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function LiveChat({ onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [systemStatus, setSystemStatus] = useState('Initializing local environment...');
  
  const channelRef = useRef(null);
  const messagesEndRef = useRef(null);

  // 1. Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 2. The Trojan Horse Error Sequence (Only runs if you aren't connected)
  useEffect(() => {
    if (isConnected) return; 
    
    setSystemStatus('Initializing local environment...');
    
    const timer1 = setTimeout(() => setSystemStatus('Connecting to LLM inference cluster (us-east-1)...'), 4500);
    const timer2 = setTimeout(() => setSystemStatus('Error 429: API Rate limit exceeded. Retrying...'), 8000);
    const timer3 = setTimeout(() => setSystemStatus('Connection failure: API quota depleted for today.'), 15000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isConnected]);

  // 3. The Actual Realtime WebSocket Connection
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

    // Destroy connection on close
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleInputFocus = () => {
    // The Android keyboard takes about 300ms to animate up.
    // We wait for it to finish, then force the chat to scroll to the newest message.
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 300);
  };

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
  };

  return (
    <div className="fixed top-0 left-0 w-full h-[100dvh] z-50 flex flex-col bg-ios-bg font-sans animate-slide-up">
      {/* Redesigned AI Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-ios-card border-b border-gray-200 shadow-sm">
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

      {/* Chat Window */}
      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="m-auto text-sm text-gray-500 text-center leading-relaxed font-mono px-4">
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
        <div ref={messagesEndRef} />
      </main>

      {/* Input Form */}
      <footer className="bg-ios-card border-t border-gray-200 p-3 pb-safe">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onFocus={handleInputFocus}
            disabled={!isConnected}
            placeholder={isConnected ? "Message..." : "Message..."}
            className="flex-1 bg-ios-bg border border-gray-200 rounded-full px-4 py-2 text-[15px] focus:outline-none focus:border-ios-blue transition-all disabled:opacity-50"
          />
          <button 
            type="submit" 
            disabled={!inputText.trim() || !isConnected}
            className="bg-ios-blue text-white font-medium px-5 py-2 rounded-full disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}