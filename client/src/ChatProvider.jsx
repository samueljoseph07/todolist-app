import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { createClient } from '@supabase/supabase-js';
import Pusher from 'pusher-js';

// ✅ Singleton Supabase (for REST calls)
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

  // ---------------------------
  // 🟢 BANNER SYSTEM
  // ---------------------------
  const [bannerText, setBannerText] = useState(() => {
    const cached = localStorage.getItem('covert_banner');
    if (cached !== null) return cached;
    return '';
  });

  const fetchBanner = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('banner_text')
      .eq('id', 1)
      .single();

    if (data) {
      setBannerText(data.banner_text);
      localStorage.setItem('covert_banner', data.banner_text);
    }
  };

  useEffect(() => {
    fetchBanner();
  }, []);

  const updateBanner = async (newText) => {
    // 1. Update DB
    const { error } = await supabase
      .from('app_settings')
      .update({ banner_text: newText })
      .eq('id', 1);

    if (!error) {
      setBannerText(newText);
      localStorage.setItem('covert_banner', newText);
      
      // 2. Notify others via Pusher (we'll use a public channel for this)
      if (channelRef.current) {
        channelRef.current.trigger('client-banner-update', { text: newText });
      }
    }
  };

  // ---------------------------
  // 🚀 START CONNECTION (PUSHER)
  // ---------------------------
  const startConnection = useCallback(() => {
    if (pusherRef.current) return;

    console.log('Starting Pusher connection...');

    const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER,
      authEndpoint: '/api/pusher/auth',
      auth: {
        params: {
          user_id: currentUser,
        },
      },
    });

    const channel = pusher.subscribe('presence-chat');

    channel.bind('pusher:subscription_succeeded', (members) => {
      console.log('Subscribed to presence-chat. Members:', members.count);
      setIsConnected(members.count === 2);
    });

    channel.bind('pusher:member_added', (member) => {
      console.log('Member joined:', member.id);
      // If there are 2 people now, we are connected
      if (channel.members.count === 2) {
        setIsConnected(true);
      }
    });

    channel.bind('pusher:member_removed', (member) => {
      console.log('Member left:', member.id);
      setIsConnected(false);
      setIsSheTyping(false);
      // Wipe messages when other person leaves, as requested
      setMessages([]);
    });

    channel.bind('client-message', (data) => {
      setMessages((prev) => [...prev, data]);
      setIsSheTyping(false);
    });

    channel.bind('client-typing', (data) => {
      if (data.sender !== currentUser) {
        setIsSheTyping(data.isTyping);
      }
    });

    channel.bind('client-banner-update', (data) => {
      setBannerText(data.text);
      localStorage.setItem('covert_banner', data.text);
    });

    pusherRef.current = pusher;
    channelRef.current = channel;
  }, [currentUser]);

  // ---------------------------
  // 🔌 DISCONNECT
  // ---------------------------
  const killConnection = useCallback(() => {
    console.log('Killing Pusher connection...');

    if (pusherRef.current) {
      pusherRef.current.unsubscribe('presence-chat');
      pusherRef.current.disconnect();
      pusherRef.current = null;
      channelRef.current = null;
    }

    setIsConnected(false);
    setIsSheTyping(false);
    setMessages([]); // Wipe messages on disconnect
  }, []);

  // ---------------------------
  // 💬 MESSAGE
  // ---------------------------
  const sendMessage = async (text) => {
    if (!text.trim() || !channelRef.current || !isConnected) return;

    const payload = {
      sender: currentUser,
      text,
      timestamp: Date.now(),
    };

    // Optimistically add own message
    setMessages((prev) => [...prev, payload]);

    channelRef.current.trigger('client-message', payload);
  };

  const sendTyping = async (isTyping) => {
    if (!channelRef.current || !isConnected) return;

    channelRef.current.trigger('client-typing', {
      sender: currentUser,
      isTyping,
    });
  };

  const clearMessages = () => {
    setMessages([]);
  };

  // ---------------------------
  // 👁️ VISIBILITY
  // ---------------------------
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        console.log('App hidden, wiping and killing connection');
        clearMessages();
        killConnection();
      } else {
        console.log('App visible, starting connection');
        startConnection();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    // Initial connection if visible
    if (!document.hidden) {
      startConnection();
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      killConnection();
    };
  }, [startConnection, killConnection]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        isConnected,
        isSheTyping,
        sendMessage,
        sendTyping,
        clearMessages,
        startConnection,
        killConnection,
        currentUser,
        bannerText,
        updateBanner,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);