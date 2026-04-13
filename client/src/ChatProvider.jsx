import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import Pusher from 'pusher-js';

// ✅ Supabase is still required for your dynamic Banner Database
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ChatContext = createContext();

export function ChatProvider({ children, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSheTyping, setIsSheTyping] = useState(false);

  const pusherRef = useRef(null);
  const channelRef = useRef(null);
  const isManualCloseRef = useRef(false);

  // ---------------------------
  // 🟢 BANNER SYSTEM (Kept on Supabase DB)
  // ---------------------------
  const [bannerText, setBannerText] = useState(() => {
    const cached = localStorage.getItem('covert_banner');
    if (cached !== null) return cached;
    return '';
  });

  const fetchBanner = async () => {
    const { data } = await supabase.from('app_settings').select('banner_text').eq('id', 1).single();
    if (data) {
      setBannerText(data.banner_text);
      localStorage.setItem('covert_banner', data.banner_text);
    }
  };

  useEffect(() => {
    fetchBanner();
    const bannerListener = supabase
      .channel('banner_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' },
        (payload) => {
          const newText = payload.new.banner_text;
          setBannerText(newText);
          localStorage.setItem('covert_banner', newText);
        }
      ).subscribe();

    return () => supabase.removeChannel(bannerListener);
  }, []);

  const updateBanner = async (newText) => {
    const { error } = await supabase.from('app_settings').update({ banner_text: newText }).eq('id', 1);
    if (!error) {
      setBannerText(newText);
      localStorage.setItem('covert_banner', newText);
    }
  };

  // ---------------------------
  // 🚀 START PUSHER CONNECTION
  // ---------------------------
  const startConnection = useCallback(() => {
    console.log('Starting Pusher connection...');
    if (pusherRef.current) return;

    isManualCloseRef.current = false;

    // Initialize Pusher Client
    const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER,
      // 🚨 REQUIRED BACKEND: You must build this endpoint to sign tokens
      authEndpoint: '/api/pusher/auth', 
      auth: {
        params: { user_id: currentUser }
      }
    });

    pusherRef.current = pusher;

    // Subscribe to a Presence Channel (Requires the auth endpoint)
    const channel = pusher.subscribe('presence-couple-chat');
    channelRef.current = channel;

    // Check Presence state
    const evaluatePresence = () => {
      const members = channel.members.count;
      setIsConnected(members > 1);
    };

    // Pusher System Events
    channel.bind('pusher:subscription_succeeded', () => {
      console.log('Pusher Subscribed');
      evaluatePresence();
    });

    channel.bind('pusher:member_added', (member) => {
      console.log('Member joined:', member.id);
      evaluatePresence();
    });

    channel.bind('pusher:member_removed', (member) => {
      console.log('Member left:', member.id);
      evaluatePresence();
      if (member.id !== currentUser) setIsSheTyping(false);
    });

    // Custom Client Events (Requires "Enable client events" in Pusher Dashboard)
    channel.bind('client-message', (payload) => {
      setMessages((prev) => [...prev, payload]);
      setIsSheTyping(false);
    });

    channel.bind('client-typing', (payload) => {
      if (payload.sender !== currentUser) {
        setIsSheTyping(payload.isTyping);
      }
    });

  }, [currentUser]);

  // ---------------------------
  // 🔌 DISCONNECT
  // ---------------------------
  const killConnection = useCallback(() => {
    console.log('Killing Pusher connection...');
    isManualCloseRef.current = true;

    if (pusherRef.current) {
      pusherRef.current.unsubscribe('presence-couple-chat');
      pusherRef.current.disconnect();
      pusherRef.current = null;
      channelRef.current = null;
    }

    setIsConnected(false);
    setIsSheTyping(false);
  }, []);

  // ---------------------------
  // 💬 SEND MESSAGES
  // ---------------------------
  const sendMessage = (text) => {
    if (!text.trim() || !channelRef.current || !isConnected) return;

    const payload = { sender: currentUser, text, timestamp: Date.now() };
    
    // Pusher requires client events to be prefixed with 'client-'
    channelRef.current.trigger('client-message', payload);
    
    // Optimistically update our own UI since Pusher client events don't echo to the sender
    setMessages((prev) => [...prev, payload]);
  };

  const sendTyping = (isTyping) => {
    if (!channelRef.current || !isConnected) return;
    channelRef.current.trigger('client-typing', { sender: currentUser, isTyping });
  };

  const clearMessages = () => setMessages([]);

  // ---------------------------
  // 👁️ VISIBILITY
  // ---------------------------
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        clearMessages();
        killConnection();
      } else {
        startConnection();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [startConnection, killConnection]);

  useEffect(() => {
    return () => killConnection();
  }, [killConnection]);

  return (
    <ChatContext.Provider
      value={{
        messages, isConnected, isSheTyping, bannerText,
        sendMessage, sendTyping, clearMessages, startConnection, killConnection, updateBanner,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);