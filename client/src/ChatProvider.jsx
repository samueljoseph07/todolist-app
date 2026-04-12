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
  const canSendMessage = isConnected;

  const pollingRef = useRef(null);
  const presenceRef = useRef(null);
  const lastSeenRef = useRef(null);
  const otherUserStatusRef = useRef(false);

  // ---------------------------
  // 🟢 BANNER (UNCHANGED)
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
      .maybeSingle();

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
  // 👁️ CHECK OTHER USER
  // ---------------------------
  const checkOtherUser = async () => {
    const otherUser = currentUser === 'sam' ? 'priya' : 'sam';

    const { data } = await supabase
      .from('chat_presence')
      .select('*')
      .eq('user_id', otherUser)
      .maybeSingle();

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
  // 🔁 POLLING
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
  // ❤️ PRESENCE
  // ---------------------------
  const startPresence = () => {
    if (presenceRef.current) return;

    presenceRef.current = setInterval(async () => {
      await supabase.from('chat_presence').upsert({
        user_id: currentUser,
        is_in_chat: true,
        last_seen: new Date().toISOString(),
      });
    }, 2000);
  };

  const stopPresence = async () => {
    if (presenceRef.current) {
      clearInterval(presenceRef.current);
      presenceRef.current = null;
    }

    await supabase.from('chat_presence').upsert({
      user_id: currentUser,
      is_in_chat: false,
      last_seen: new Date().toISOString(),
    });
  };

  // ---------------------------
  // 💬 SEND MESSAGE
  // ---------------------------
  const sendMessage = async (text) => {
    if (!text.trim()) return;
    if (!otherUserStatusRef.current) return;

    await supabase
      .from('messages')
      .insert([{ sender: currentUser, text }]);
  };

  // ---------------------------
  // 🧹 CLEAR
  // ---------------------------
  const clearMessages = () => {
    setMessages([]);
    lastSeenRef.current = null;
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        isConnected,
        canSendMessage,
        sendMessage,
        clearMessages,
        startPresence,
        stopPresence,
        startPolling,
        stopPolling,
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