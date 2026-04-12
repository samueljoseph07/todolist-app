import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
} from 'react';
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
  const canSendMessage = isConnected;

  const pollingRef = useRef(null);
  const presenceRef = useRef(null);
  const lastSeenRef = useRef(null);
  const otherUserStatusRef = useRef(false);

  // ---------------------------
  // 🟢 BANNER SYSTEM (UNCHANGED)
  // ---------------------------
  const [bannerText, setBannerText] = useState(() => {
    const cached = localStorage.getItem('covert_banner');
    return cached ?? '';
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

    return () => supabase.removeChannel(bannerListener);
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
  // 💬 FETCH MESSAGES
  // ---------------------------
  const fetchMessages = async () => {
    let query = supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (lastSeenRef.current) {
      query = query.gt('created_at', lastSeenRef.current);
    }

    const { data } = await query;

    if (data && data.length > 0) {
      setMessages((prev) => [...prev, ...data]);
      lastSeenRef.current = data[data.length - 1].created_at;
    }
  };

  // ---------------------------
  // 👁️ CHECK OTHER USER PRESENCE
  // ---------------------------
  const checkOtherUser = async () => {
    const otherUser = currentUser === 'sam' ? 'priya' : 'sam';

    const { data } = await supabase
      .from('chat_presence')
      .select('*')
      .eq('user_id', otherUser)
      .single();

    if (!data) {
      setIsConnected(false);
      otherUserStatusRef.current = false;
      return;
    }

    const isOnline =
      data.is_in_chat &&
      Date.now() - new Date(data.last_seen).getTime() < 4000;

    setIsConnected(isOnline);
    otherUserStatusRef.current = isOnline;
  };

  // ---------------------------
  // 🔁 START POLLING
  // ---------------------------
  const startPolling = () => {
    if (pollingRef.current) return;

    fetchMessages();
    checkOtherUser();

    pollingRef.current = setInterval(() => {
      fetchMessages();
      checkOtherUser();
    }, 1000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // ---------------------------
  // ❤️ HEARTBEAT (THIS USER)
  // ---------------------------
  const startPresence = () => {
    if (presenceRef.current) return;

    presenceRef.current = setInterval(() => {
      supabase.from('chat_presence').upsert({
        user_id: currentUser,
        is_in_chat: true,
        last_seen: new Date().toISOString(),
      });
    }, 2000);
  };

  const stopPresence = () => {
    if (presenceRef.current) {
      clearInterval(presenceRef.current);
      presenceRef.current = null;
    }

    supabase.from('chat_presence').upsert({
      user_id: currentUser,
      is_in_chat: false,
      last_seen: new Date().toISOString(),
    });
  };

  // ---------------------------
  // 💬 SEND MESSAGE (CONTROLLED)
  // ---------------------------
  const sendMessage = async (text) => {
    if (!text.trim()) return;

    if (!otherUserStatusRef.current) return;

    const message = {
      sender: currentUser,
      text,
    };

    const { error } = await supabase
      .from('messages')
      .insert([message]);

    if (!error) {
      setMessages((prev) => [
        ...prev,
        { ...message, created_at: new Date().toISOString() },
      ]);
    }
  };

  // ---------------------------
  // 🧹 CLEAR
  // ---------------------------
  const clearMessages = () => {
    setMessages([]);
    lastSeenRef.current = null;
  };

  // ---------------------------
  // 👁️ VISIBILITY
  // ---------------------------
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        clearMessages();
        stopPolling();
        stopPresence();
      } else {
        startPolling();
        startPresence();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    startPolling();
    startPresence();

    return () => {
      stopPolling();
      stopPresence();
    };
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        isConnected, // now real presence
        sendMessage,
        clearMessages,
        canSendMessage,
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