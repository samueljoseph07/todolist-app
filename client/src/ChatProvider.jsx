import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ChatContext = createContext();

export function ChatProvider({ children, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSheTyping, setIsSheTyping] = useState(false); 

  // INSTANT LOAD: Respect empty strings so the banner can be hidden
  const [bannerText, setBannerText] = useState(() => {
    const cached = localStorage.getItem('covert_banner');
    if (cached !== null) return cached; // Returns "" if you intentionally cleared it
    return ''; // Only shows if the cache has literally never existed
  });
  
  const channelRef = useRef(null);

  // SILENT UPDATE: Fetch true text from Supabase in the background
  const fetchBanner = async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('banner_text')
      .eq('id', 1)
      .single();
      
    if (data) {
      setBannerText(data.banner_text);
      localStorage.setItem('covert_banner', data.banner_text); // Cache for next boot
    }
  };

  // Fetch it immediately when the provider mounts
  useEffect(() => {
    fetchBanner();
  }, []);

  // Update the database (For Command Center)
  const updateBanner = async (newText) => {
    const { error } = await supabase
      .from('app_settings')
      .update({ banner_text: newText })
      .eq('id', 1);
      
    if (!error) {
      setBannerText(newText);
      localStorage.setItem('covert_banner', newText);
    }
  };

  // NEW: Manual Switch to turn the radio ON
  const startConnection = () => {
    // If a connection already exists, do nothing to prevent duplicates
    if (channelRef.current) return;

    const channel = supabase.channel('couple_chat', {
      config: { 
        broadcast: { self: true },
        presence: { key: currentUser } 
      },
    });

    channel
      .on('broadcast', { event: 'message' }, (payload) => {
        setMessages((prev) => [...prev, payload.payload]);
        setIsSheTyping(false); 
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.sender !== currentUser) {
          setIsSheTyping(payload.payload.isTyping);
        }
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
  };

  // NEW: Manual Switch to turn the radio OFF
  const killConnection = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setIsConnected(false);
      setIsSheTyping(false);
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const sendMessage = async (text) => {
    if (!text.trim() || !isConnected || !channelRef.current) return;
    await channelRef.current.send({
      type: 'broadcast',
      event: 'message',
      payload: { sender: currentUser, text, timestamp: Date.now() },
    });
  };

  const sendTyping = async (isTyping) => {
    if (!isConnected || !channelRef.current) return;
    await channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { sender: currentUser, isTyping },
    });
  };

  // Failsafe: Destroy connection if the entire app unmounts
  useEffect(() => {
    return () => killConnection();
  }, []);

  return (
    <ChatContext.Provider value={{ 
      messages, isConnected, isSheTyping, 
      sendMessage, sendTyping, clearMessages, 
      startConnection, killConnection // EXPOSE THE SWITCHES
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);