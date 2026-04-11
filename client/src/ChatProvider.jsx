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

  console.log("Current user:", currentUser);

  // ---------------------------
  // 🔁 RECONNECT SCHEDULER
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
    console.log('Starting connection...');

    // Prevent duplicate active connection
    if (channelRef.current) return;

    const channel = supabase.channel('couple_chat', {
      config: {
        broadcast: { self: true },
        presence: { key: currentUser }, // must be 'sam' or 'priya'
      },
    });

    channel
      // 📩 MESSAGE
      .on('broadcast', { event: 'message' }, (payload) => {
        setMessages((prev) => [...prev, payload.payload]);
        setIsSheTyping(false);
      })

      // ⌨️ TYPING
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.sender !== currentUser) {
          setIsSheTyping(payload.payload.isTyping);
        }
      })

      // 👥 PRESENCE
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.keys(state);

        setIsConnected(
          users.includes('sam') && users.includes('priya')
        );
      })

      // 📡 STATUS HANDLER (SAFE)
      .subscribe((status) => {
        console.log('[Realtime status]:', status);

        if (status === 'SUBSCRIBED') {
          isManualCloseRef.current = false;
          channel.track({ online: true });
          setIsConnected(true);
          return;
        }

        if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          setIsConnected(false);

          // 🔴 Do NOT reconnect if manually closed
          if (isManualCloseRef.current) {
            console.log('Manual disconnect, skip reconnect');
            return;
          }

          console.log('Reconnecting triggered');

          // 🔴 IMPORTANT: just reset reference, DO NOT remove channel here
          channelRef.current = null;

          scheduleReconnect();
        }
      });

    channelRef.current = channel;
  }, [currentUser, scheduleReconnect]);

  // ---------------------------
  // 🔌 MANUAL DISCONNECT ONLY
  // ---------------------------
  const killConnection = useCallback(() => {
    console.log('Killing connection...');

    if (channelRef.current) {
      isManualCloseRef.current = true;
      supabase.removeChannel(channelRef.current); // ✅ ONLY here
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

  // ---------------------------
  // ⌨️ TYPING
  // ---------------------------
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

  // ---------------------------
  // 🧹 CLEAR MESSAGES
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
        clearMessages();     // privacy
        killConnection();    // intentional disconnect
      } else {
        startConnection();   // reconnect
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, [startConnection, killConnection]);

  // ---------------------------
  // 🧹 CLEANUP
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
        currentUser,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);