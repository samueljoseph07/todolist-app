import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import Pusher from 'pusher-js';
import localforage from 'localforage'; 

const ChatContext = createContext();

export function ChatProvider({ children, currentUser }) {
  const [messages, setMessages] = useState([]);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (currentUser === 'ai') {
      localforage.getItem('command_center_history')
        .then((savedMessages) => {
          if (savedMessages && savedMessages.length > 0) {
            setMessages(savedMessages);
          } else {
            const legacyData = localStorage.getItem('command_center_history');
            if (legacyData) {
              try {
                const parsedLegacyData = JSON.parse(legacyData);
                setMessages(parsedLegacyData); 
                localforage.setItem('command_center_history', parsedLegacyData); 
                localStorage.removeItem('command_center_history'); 
              } catch (e) {
                console.error("Migration failed", e);
              }
            }
          }
          isInitialized.current = true;
        })
        .catch(err => console.error("Failed to read localforage", err));
    } else {
      isInitialized.current = true; 
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser === 'ai' && isInitialized.current) {
      localforage.setItem('command_center_history', messages).catch(console.error);
    }
  }, [messages, currentUser]);

  const [isConnected, setIsConnected] = useState(false);
  const [isSheTyping, setIsSheTyping] = useState(false);

  const pusherRef = useRef(null);
  const channelRef = useRef(null);
  const isManualCloseRef = useRef(false);

  const startConnection = useCallback(() => {
    console.log('Starting Pusher connection...');
    if (pusherRef.current) return;

    isManualCloseRef.current = false;

    const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER,
      authEndpoint: '/api/pusher/auth', 
      auth: {
        params: { user_id: currentUser }
      }
    });

    pusherRef.current = pusher;

    const channel = pusher.subscribe('presence-couple-chat');
    channelRef.current = channel;

    const evaluatePresence = () => {
      const members = channel.members.count;
      setIsConnected(members > 1);
    };

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

  const sendMessage = (text) => {
    if (!text.trim() || !channelRef.current || !isConnected) return;
    const payload = { sender: currentUser, text, timestamp: Date.now() };
    channelRef.current.trigger('client-message', payload);
    setMessages((prev) => [...prev, payload]);
  };

  const sendTyping = (isTyping) => {
    if (!channelRef.current || !isConnected) return;
    channelRef.current.trigger('client-typing', { sender: currentUser, isTyping });
  };

  const clearMessages = () => {
    setMessages([]);
    if (currentUser === 'ai') {
      localforage.removeItem('command_center_history'); 
    }
  };

  useEffect(() => {
    return () => killConnection();
  }, [killConnection]);

  return (
    <ChatContext.Provider
      value={{
        messages, isConnected, isSheTyping,
        sendMessage, sendTyping, clearMessages, startConnection, killConnection,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);