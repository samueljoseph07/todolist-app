import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize OUTSIDE the React tree so it never rebuilds
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Create the Context Bridge
const ChatContext = createContext();

export function ChatProvider({ children, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef(null);

  useEffect(() => {
    // 1. Build the channel once
    const channel = supabase.channel('couple_chat', {
      config: { 
        broadcast: { self: true },
        presence: { key: currentUser } 
      },
    });

    console.log(`[IDENTITY]: I am ${currentUser}`);
    console.log(`[TARGET DB]:`, import.meta.env.VITE_SUPABASE_URL.substring(0, 35) + "...");

    // 2. Attach listeners
    channel
      .on('broadcast', { event: 'message' }, (payload) => {
        setMessages((prev) => [...prev, payload.payload]);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const uniqueUsers = Object.keys(state).length;
        setIsConnected(uniqueUsers > 1);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online: true });
        } else {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    // 3. Clean up ONLY if the entire app is destroyed
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]); // Only reconnect if the user identity physically changes

  // 4. The single global send function
  const sendMessage = async (text) => {
    if (!text.trim() || !isConnected || !channelRef.current) return;
    
    await channelRef.current.send({
      type: 'broadcast',
      event: 'message',
      payload: { sender: currentUser, text, timestamp: Date.now() },
    });
  };

  // 5. Expose the data to the rest of the app
  return (
    <ChatContext.Provider value={{ messages, isConnected, sendMessage }}>
      {children}
    </ChatContext.Provider>
  );
}

// Custom hook so your UI can easily grab the data
export const useChat = () => useContext(ChatContext);