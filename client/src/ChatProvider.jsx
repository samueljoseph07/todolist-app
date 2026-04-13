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

    const channel = pusher.subscribe('presence-chat');

    // presence
    channel.bind('pusher:subscription_succeeded', (members) => {
      setIsConnected(members.count > 1);
    });

    channel.bind('pusher:member_added', () => {
      setIsConnected(true);
    });

    channel.bind('pusher:member_removed', (members) => {
      setIsConnected(members.count > 1);
    });

    // messages
    channel.bind('message', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    pusherRef.current = pusher;
    channelRef.current = channel;

    return () => {
      channel.unbind_all();
      pusher.unsubscribe('presence-chat');
      pusher.disconnect();
    };
  }, []);

  const sendMessage = async (text) => {
    if (!text.trim() || !isConnected) return;

    await axios.post('/api/send-message', {
      sender: currentUser,
      text,
    });
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