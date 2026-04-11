import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { createClient } from '@supabase/supabase-js';

// ✅ Singleton client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ChatContext = createContext();

export function ChatProvider({ children, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSheTyping, setIsSheTyping] = useState(false);

  const channelRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isManualCloseRef = useRef(false);

  // ---------------------------
  // 🟢 BANNER SYSTEM (UNCHANGED)
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

    const bannerListener = supabase
      .channel('banner_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_settings',
          filter: 'id=eq.1',
        },
        (payload) => {
          const newText = payload.new.banner_text;
          setBannerText(newText);
          localStorage.setItem('covert_banner', newText);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bannerListener);
    };
  }, []);

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

  // ---------------------------
  // 🔁 RECONNECT
  // ---------------------------
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) return;

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      startConnection();
    }, 1500);
  }, []);

  // ---------------------------
  // 🚀 START CONNECTION (FIXED)
  // ---------------------------
  const startConnection = useCallback(() => {
  console.log('Starting connection...');

  if (channelRef.current) return;

  const channel = supabase.channel('couple_chat', {
    config: {
      broadcast: { self: true },
      presence: { key: currentUser },
    },
  });

  // 🔴 Helper: central presence evaluation
  const evaluatePresence = () => {
    const state = channel.presenceState();
    const users = Object.keys(state);

    console.log('Presence check:', state);

    const bothOnline =
      users.includes('sam') && users.includes('priya');

    setIsConnected(bothOnline);
    return bothOnline;
  };

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

    // ✅ Primary presence listener
    .on('presence', { event: 'sync' }, () => {
      console.log('Presence sync event');
      evaluatePresence();
    })

    .subscribe((status) => {
      console.log('[Realtime status]:', status);

      if (status === 'SUBSCRIBED') {
        isManualCloseRef.current = false;

        channel.track({ online: true });

        // 🔥 Fallback #1: delayed presence check
        setTimeout(() => {
          console.log('Fallback presence check (500ms)');
          evaluatePresence();
        }, 500);

        // 🔥 Fallback #2: stronger retry if still not connected
        setTimeout(() => {
          const connected = evaluatePresence();

          if (!connected && !isManualCloseRef.current) {
            console.log('Presence missing → forcing reconnect');

            channelRef.current = null;
            scheduleReconnect();
          }
        }, 2000);

        return;
      }

      if (
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT' ||
        status === 'CLOSED'
      ) {
        setIsConnected(false);

        if (isManualCloseRef.current) {
          console.log('Manual disconnect, skip reconnect');
          return;
        }

        console.log('Reconnecting triggered');

        channelRef.current = null;
        scheduleReconnect();
      }
    });

  channelRef.current = channel;
}, [currentUser, scheduleReconnect]);

  // ---------------------------
  // 🔌 DISCONNECT
  // ---------------------------
  const killConnection = useCallback(() => {
    console.log('Killing connection...');

    if (channelRef.current) {
      isManualCloseRef.current = true;
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setIsConnected(false);
    setIsSheTyping(false);

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // ---------------------------
  // 💬 MESSAGE
  // ---------------------------
  const sendMessage = async (text) => {
    if (!text.trim() || !channelRef.current || !isConnected) return;

    await channelRef.current.send({
      type: 'broadcast',
      event: 'message',
      payload: {
        sender: currentUser,
        text,
        timestamp: Date.now(),
      },
    });
  };

  const sendTyping = async (isTyping) => {
    if (!channelRef.current || !isConnected) return;

    await channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        sender: currentUser,
        isTyping,
      },
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
        clearMessages();
        killConnection();
      } else {
        startConnection();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, [startConnection, killConnection]);

  useEffect(() => {
    return () => killConnection();
  }, [killConnection]);

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
        bannerText,      // ✅ your feature preserved
        updateBanner,    // ✅ your feature preserved
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);