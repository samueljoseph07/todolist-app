import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import Pusher from 'pusher-js';
import axios from 'axios';

const ChatContext = createContext();

export function ChatProvider({ children, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  const pusherRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER,
      authEndpoint: '/api/pusher/auth',
      auth: {
        params: { user_id: currentUser },
      },
    });

    // 🔥 DEBUG: connection errors
    pusher.connection.bind('error', (err) => {
      console.error('Pusher connection error:', err);
    });

    pusher.connection.bind('state_change', (states) => {
      console.log('Pusher state:', states);
    });

    const channel = pusher.subscribe('presence-chat');

    // ✅ subscription success
    channel.bind('pusher:subscription_succeeded', (members) => {
      console.log('Members:', members);
      setIsConnected(members.count > 1);
    });

    // ✅ someone joined
    channel.bind('pusher:member_added', () => {
      setIsConnected(true);
    });

    // ✅ someone left (FIXED)
    channel.bind('pusher:member_removed', () => {
      // we cannot trust members here → fallback safe logic
      setIsConnected(false);
    });

    // ✅ messages
    channel.bind('message', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    pusherRef.current = pusher;
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        channelRef.current.unbind_all();
      }
      if (pusherRef.current) {
        pusherRef.current.unsubscribe('presence-chat');
        pusherRef.current.disconnect();
      }
    };
  }, [currentUser]);

  const sendMessage = async (text) => {
    if (!text.trim() || !isConnected) return;

    try {
      await axios.post('/api/send-message', {
        sender: currentUser,
        text,
      });
    } catch (err) {
      console.error('Send message failed:', err);
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        isConnected,
        canSendMessage: isConnected,
        sendMessage,
        clearMessages,
        currentUser,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);