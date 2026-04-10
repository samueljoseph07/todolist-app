import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { createClient } from '@supabase/supabase-js';

// ✅ Singleton client (never recreated)
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

  // ---------------------------
  // 🔁 SAFE RECONNECT HANDLER
  // ---------------------------
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) return;

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      startConnection();
    }, 1500);
  }, []);

  // ---------------------------
  // 🚀 START CONNECTION
  // ---------------------------
  const startConnection = useCallback(() => {
    // Prevent duplicate active connections
    if (
      channelRef.current &&
      channelRef.current.state === 'joined'
    ) {
      return;
    }

    // Clean up any stale channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel('couple_chat', {
      config: {
        broadcast: { self: true },
        presence: { key: currentUser },
      },
    });

    channel
      // ---------------------------
      // 📩 MESSAGE HANDLER
      // ---------------------------
      .on('broadcast', { event: 'message' }, (payload) => {
        setMessages((prev) => [...prev, payload.payload]);
        setIsSheTyping(false);
      })

      // ---------------------------
      // ⌨️ TYPING INDICATOR
      // ---------------------------
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.sender !== currentUser) {
          setIsSheTyping(payload.payload.isTyping);
        }
      })

      // ---------------------------
      // 👥 PRESENCE
      // ---------------------------
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.keys(state).length;
        setIsConnected(users > 1);
      })

      // ---------------------------
      // 📡 CONNECTION STATUS
      // ---------------------------
      .subscribe((status) => {
        console.log('[Realtime status]:', status);
        console.log('Reconnecting triggered');
        console.log('Starting connection...');
        console.log('Killing connection...');

        if (status === 'SUBSCRIBED') {
          channel.track({ online: true });
          setIsConnected(true);
        }

        if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          setIsConnected(false);

          if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
          }

          scheduleReconnect();
        }
      });

    channelRef.current = channel;
  }, [currentUser, scheduleReconnect]);

  // ---------------------------
  // 🔌 KILL CONNECTION (EXPLICIT ONLY)
  // ---------------------------
  const killConnection = useCallback(() => {
    if (channelRef.current) {
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
  // 💬 SEND MESSAGE
  // ---------------------------
  const sendMessage = async (text) => {
    if (!isConnected) return;
    if (!text.trim() || !channelRef.current) return;

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

  // ---------------------------
  // ⌨️ SEND TYPING
  // ---------------------------
  const sendTyping = async (isTyping) => {
    if (!isConnected) return;
    if (!channelRef.current) return;

    await channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        sender: currentUser,
        isTyping,
      },
    });
  };

  // ---------------------------
  // 🧹 CLEAR MESSAGES (PRIVACY)
  // ---------------------------
  const clearMessages = () => {
    setMessages([]);
  };

  // ---------------------------
  // 👁️ VISIBILITY HANDLING
  // ---------------------------
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        // 🔐 Privacy: wipe UI only
        clearMessages();

        // Optional: fully disconnect
        killConnection();
      } else {
        // 🔁 Reconnect when user returns
        startConnection();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, [startConnection, killConnection]);

  // ---------------------------
  // 🧹 CLEANUP ON UNMOUNT
  // ---------------------------
  useEffect(() => {
    return () => {
      killConnection();
    };
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
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);