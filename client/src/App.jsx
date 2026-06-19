import LiveChat from './LiveChat'; 
import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Trash2, ListTodo, CalendarDays, Plus, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react'; 
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, subMonths, addMonths } from 'date-fns';
import { MessageCircle, X, FolderOpen} from 'lucide-react'; 
import { useChat } from './ChatProvider'; 

const API_BASE = '/api';

export default function App() {
  const [view, setView] = useState('today');
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState({});
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(true);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [pagerFailed, setPagerFailed] = useState(false); 
  const [supportError, setSupportError] = useState(null); 
  const [persistentBanner, setPersistentBanner] = useState('');

  const { bannerText } = useChat();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);

  // --- THEME PERSISTENCE & OS HIJACKER ---
  const THEME_PREF_KEY = 'app-theme-preference';
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const savedPref = localStorage.getItem(THEME_PREF_KEY);
      if (savedPref !== null) {
        return JSON.parse(savedPref);
      }
    } catch (e) {
      console.error("Failed to read theme preference:", e);
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem(THEME_PREF_KEY, JSON.stringify(isDarkMode));

    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', isDarkMode ? '#000000' : '#F2F2F7');

    document.documentElement.style.colorScheme = isDarkMode ? 'dark' : 'light';

    const bgColor = isDarkMode ? '#000000' : '#F2F2F7';
    document.documentElement.style.backgroundColor = bgColor;
    document.body.style.backgroundColor = bgColor;
    
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // --- BANNER SYNC ENGINE ---
  // 1. Live Sync: If the WebSocket pushes a new banner while she is active, update the persistent state.
  useEffect(() => {
    if (bannerText !== undefined) {
      setPersistentBanner(bannerText);
    }
  }, [bannerText]);

  // 2. Background Sync: Fetch from DB when the app boots or wakes up from the background.
  useEffect(() => {
    const fetchBanner = async () => {
      try {
        const res = await fetch(`${API_BASE}/banner`);
        if (res.ok) {
          const data = await res.json();
          if (data.bannerText !== undefined) {
            setPersistentBanner(data.bannerText);
          }
        }
      } catch (err) {
        console.error("Failed to fetch banner", err);
      }
    };

    fetchBanner();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchBanner();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (view === 'today') fetchTodayTasks();
    if (view === 'history') fetchHistory();
  }, [view, currentMonth]); 

  const fetchTodayTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/today`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setTasks(data);
      } else setTasks([]);
    } catch (err) {
      console.error("Failed to fetch tasks", err);
      setTasks([]);
    }
    setLoading(false);
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const targetMonth = format(currentMonth, 'yyyy-MM');
      const res = await fetch(`${API_BASE}/history?month=${targetMonth}`);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        const grouped = data.reduce((acc, log) => {
          const cleanDate = log.logical_date.split('T')[0];
          if (!acc[cleanDate]) acc[cleanDate] = [];
          acc[cleanDate].push(log);
          return acc;
        }, {});
        setHistory(grouped);
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
    setLoading(false);
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newTask })
      });
      if (res.ok) {
        setNewTask('');
        fetchTodayTasks();
      }
    } catch (err) {
      console.error("Failed to add task", err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;

    setIsSending(true);
    setSupportError(null); 
    try {
      const response = await fetch(`/api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: supportMessage })
      });

      if (response.ok) {
        setSupportMessage('');
        setIsMessageModalOpen(false);
        setSupportError(null);
      } else {
        setSupportError("Failed to send message. Please try again.");
      }
    } catch (error) {
      console.error('Failed to send message', error);
      setSupportError("Network error. Please check your connection.");
    } finally {
      setIsSending(false);
    }
  };

  const toggleTask = async (logId) => {
    const task = tasks.find(t => t.log_id === logId);
    if (!task) return;
    const newState = !task.is_completed;

    setTasks(tasks.map(t => t.log_id === logId ? { ...t, is_completed: newState } : t));
    
    try {
      const res = await fetch(`${API_BASE}/toggle`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: logId, is_completed: newState })
      });
      
      if (!res.ok) throw new Error("Server rejected the toggle request");
      
    } catch (err) {
      console.error("Failed to toggle in database:", err);
      fetchTodayTasks(); 
    }
  };

  const deleteTask = async (taskId) => {
    setTasks(tasks.filter(t => t.task_id !== taskId));
    try {
      await fetch(`${API_BASE}/tasks/${taskId}`, { method: 'DELETE' });
    } catch (err) {
      console.error("Failed to delete", err);
      fetchTodayTasks();
    }
  };

  const getCalendarDays = () => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  };

  const triggerPagerAndOpenChat = () => {
    setPagerFailed(false);
    setIsChatOpen(true);

    fetch(`/api/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: "🚨 She just opened the AI Assistant! Get online." 
      })
    }).catch(error => {
      console.error("Silent pager network drop (ignored):", error);
    });
  };

  return (
    <div className={`flex flex-col min-h-[100dvh] w-full max-w-md mx-auto bg-ios-bg dark:bg-black relative shadow-2xl transition-colors duration-200 ${isDarkMode ? 'dark' : ''}`}>
      
      <header className="pt-12 pb-6 px-6 flex justify-between items-center z-10">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          {view === 'today' ? 'Today' : 'History'}
        </h1>
        
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className="p-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            aria-label="Toggle Theme"
          >
            {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
          </button>

          <a 
            href="https://drive.google.com/drive/folders/1P9DxA54amU6a_lv7GEA45QYP5Pk0MhUI?usp=sharing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-2 text-blue-400 hover:text-ios-blue dark:text-blue-500 dark:hover:text-blue-400 transition-colors"
            aria-label="Study Notes"
          >
            <FolderOpen size={24} />
          </a>
          <button 
            onClick={triggerPagerAndOpenChat}
            className="p-2 text-blue-400 hover:text-ios-blue dark:text-blue-500 dark:hover:text-blue-400 transition-colors"
            aria-label="AI Assistant"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="22" 
              height="22" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
              <path d="M20 3v4" />
              <path d="M22 5h-4" />
              <path d="M4 17v2" />
              <path d="M5 18H3" />
            </svg>
          </button>
        <button 
          onClick={() => setIsMessageModalOpen(true)}
          className="p-2 text-blue-400 hover:text-ios-blue dark:text-blue-500 dark:hover:text-blue-400 transition-colors">
          <MessageCircle size={24} />
        </button>
        </div>
      </header>

      {/* THE UI FIX: Telling React to physically render the synchronized state */}
      {persistentBanner && (
        <small 
          className="px-6 pb-2 italic w-full break-words text-gray-800 dark:text-gray-300 [&>a]:text-ios-blue [&>a]:dark:text-blue-400 [&>a]:underline"
          dangerouslySetInnerHTML={{ __html: persistentBanner }}
        />
      )}

      <main className="flex-1 px-4 pb-40">
        {loading ? (
          <div className="flex justify-center py-10 text-ios-gray dark:text-gray-400">Loading...</div>
        ) : view === 'today' ? (
          
          <div className="space-y-4">
            <div className="bg-ios-card dark:bg-[#1C1C1E] rounded-xl shadow-sm overflow-hidden border border-transparent dark:border-neutral-800 transition-colors duration-200">
              {tasks.length === 0 ? (
                <p className="py-6 text-center text-ios-gray dark:text-gray-400">No tasks active. Add one above.</p>
              ) : (
                tasks.map((task, index) => (
                  <div key={task.log_id} className={`flex items-center justify-between p-4 ${index !== tasks.length - 1 ? 'border-b border-gray-100 dark:border-neutral-800' : ''}`}>
                    <div className="flex items-center space-x-3 flex-1 cursor-pointer" onClick={() => toggleTask(task.log_id)}>
                      {task.is_completed ? (
                        <CheckCircle2 size={24} className="text-ios-blue dark:text-blue-500" />
                      ) : (
                        <Circle size={24} className="text-ios-gray dark:text-gray-500" />
                      )}
                      <span className={`text-lg transition-colors ${task.is_completed ? 'text-ios-gray dark:text-gray-500 line-through' : 'text-ios-text dark:text-gray-100'}`}>
                        {task.content}
                      </span>
                    </div>
                    <button onClick={() => deleteTask(task.task_id)} className="text-red-500 p-2 opacity-70 hover:opacity-100 transition-opacity">
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        ) : (

          <div className="space-y-6">
            <div className="bg-ios-card dark:bg-[#1C1C1E] rounded-xl shadow-sm p-4 border border-transparent dark:border-neutral-800 transition-colors duration-200">
              
              <div className="flex justify-between items-center mb-4">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 text-ios-blue dark:text-blue-400">
                  <ChevronLeft size={24} />
                </button>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 text-ios-blue dark:text-blue-400">
                  <ChevronRight size={24} />
                </button>
              </div>

              <div className="grid grid-cols-7 mb-2 text-center text-xs text-ios-gray dark:text-gray-400 font-semibold">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day}>{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-4 gap-x-1 text-center">
                {getCalendarDays().map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const dayLogs = history[dateStr];
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedHistoryDate === dateStr;
                  
                  let percent = 0;
                  let fillColor = 'bg-transparent';
                  
                  if (dayLogs && dayLogs.length > 0) {
                    const total = dayLogs.length;
                    const completed = dayLogs.filter(l => l.is_completed).length;
                    percent = (completed / total) * 100;
                    
                    if (percent >= 75) fillColor = 'bg-green-500';
                    else if (percent >= 40) fillColor = 'bg-orange-500';
                    else fillColor = 'bg-red-500';
                  }

                  return (
                    <div key={dateStr} className="flex flex-col items-center">
                      <button 
                        onClick={() => dayLogs ? setSelectedHistoryDate(dateStr) : null}
                        className={`relative w-10 h-10 rounded-2xl overflow-hidden flex items-center justify-center border-2 
                          ${isSelected ? 'border-ios-blue dark:border-blue-500 shadow-md' : 'border-gray-100 dark:border-neutral-800'} 
                          ${!isCurrentMonth ? 'opacity-30' : ''} 
                          ${!dayLogs ? 'cursor-default bg-gray-50 dark:bg-neutral-900' : 'cursor-pointer hover:scale-105 transition-transform bg-gray-100 dark:bg-neutral-800'}
                        `}
                      >
                        {dayLogs && (
                          <div 
                            className={`absolute bottom-0 w-full ${fillColor} transition-all duration-700 opacity-80`} 
                            style={{ height: `${percent}%` }}
                          />
                        )}
                        
                        <span className={`relative z-10 text-sm font-medium ${dayLogs && percent > 50 ? 'text-white' : 'text-ios-text dark:text-gray-200'}`}>
                          {format(day, 'd')}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedHistoryDate && history[selectedHistoryDate] && (
              <div className="bg-ios-card dark:bg-[#1C1C1E] rounded-xl shadow-sm overflow-hidden animate-fade-in border border-transparent dark:border-neutral-800 transition-colors duration-200">
                <h3 className="bg-gray-50 dark:bg-[#121212] px-4 py-3 text-sm font-semibold text-ios-gray dark:text-gray-400 border-b border-gray-100 dark:border-neutral-800 uppercase tracking-wider">
                  {format(parseISO(selectedHistoryDate), 'EEEE, MMMM do')}
                </h3>
                {history[selectedHistoryDate].map((log, index) => (
                  <div key={index} className="flex items-center p-4 border-b border-gray-100 dark:border-neutral-800 last:border-0">
                    {log.is_completed ? (
                      <CheckCircle2 size={20} className="text-ios-blue dark:text-blue-500 mr-3" />
                    ) : (
                      <Circle size={20} className="text-ios-gray dark:text-gray-500 mr-3" />
                    )}
                    <span className={`text-md transition-colors ${log.is_completed ? 'text-ios-gray dark:text-gray-500 line-through' : 'text-ios-text dark:text-gray-100'}`}>
                      {log.content}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* FLOATING ADD TASK INPUT */}
      {view === 'today' && (
        <div className="fixed bottom-[88px] w-full max-w-md left-0 right-0 mx-auto px-4 z-40 bg-ios-bg/90 dark:bg-black/90 backdrop-blur-md pt-2 pb-2 transition-colors duration-200">
          <form onSubmit={addTask} className="relative flex items-center drop-shadow-lg">
            <textarea 
              type="text" 
              inputMode="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="New task..."
              enterKeyHint="send"
              autoCapitalize="sentences"
              autoCorrect="on"
              spellCheck="true"
              rows={1}
              className="w-full bg-ios-card dark:bg-[#1C1C1E] text-black dark:text-white rounded-xl py-3 pl-4 pr-12 shadow-sm border border-gray-100 dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-ios-blue dark:focus:ring-blue-500 transition-colors"
            />
            <button type="submit" className="absolute right-3 text-ios-blue dark:text-blue-400 disabled:opacity-50" disabled={!newTask.trim()}>
              <Plus size={24} />
            </button>
          </form>
        </div>
      )}

      <nav className="fixed bottom-0 w-full max-w-md left-0 right-0 mx-auto bg-ios-card/90 dark:bg-[#1C1C1E]/90 backdrop-blur-md border-t border-gray-200 dark:border-neutral-800 flex justify-around pb-8 pt-3 px-2 z-50 transition-colors duration-200">
        <button 
          onClick={() => { setView('today'); setSelectedHistoryDate(null); }} 
          className={`flex flex-col items-center space-y-1 w-1/2 transition-colors ${view === 'today' ? 'text-ios-blue dark:text-blue-400' : 'text-ios-gray dark:text-gray-500'}`}
        >
          <ListTodo size={24} />
          <span className="text-xs font-medium">Today</span>
        </button>
        <button 
          onClick={() => setView('history')} 
          className={`flex flex-col items-center space-y-1 w-1/2 transition-colors ${view === 'history' ? 'text-ios-blue dark:text-blue-400' : 'text-ios-gray dark:text-gray-500'}`}
        >
          <CalendarDays size={24} />
          <span className="text-xs font-medium">History</span>
        </button>
      </nav>

      {/* MESSAGE MODAL OVERLAY */}
      {isMessageModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 pb-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-ios-card dark:bg-[#1C1C1E] w-full max-w-sm rounded-2xl shadow-2xl p-6 relative animate-scale-in duration-200 transition-colors border border-transparent dark:border-neutral-800">
            <button 
              onClick={() => {
                setIsMessageModalOpen(false);
                setSupportError(null); 
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Message Support</h2>
            <form onSubmit={handleSendMessage}>
              <textarea
                value={supportMessage}
                onChange={(e) => {
                  setSupportMessage(e.target.value);
                  if (supportError) setSupportError(null); 
                }}
                placeholder="What's on your mind?"
                className={`w-full h-32 p-3 bg-ios-bg dark:bg-black text-gray-800 dark:text-white border ${supportError ? 'border-red-400 dark:border-red-500 focus:ring-red-500' : 'border-gray-200 dark:border-neutral-700 focus:ring-ios-blue dark:focus:ring-blue-500'} rounded-xl mb-4 resize-none focus:outline-none focus:ring-2 transition-colors`}
                autoFocus
              />
              
              {supportError && (
                <div className="mb-4 text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-2.5 rounded-lg border border-red-100 dark:border-red-800/50 flex items-center gap-2">
                  <span className="font-semibold">⚠️</span> {supportError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSending || !supportMessage.trim()}
                className="w-full bg-ios-blue dark:bg-blue-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-opacity"
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        </div>
      )}
      {isChatOpen && (
        <LiveChat 
          onClose={() => setIsChatOpen(false)} 
          pagerFailed={pagerFailed} 
          isDarkMode={isDarkMode} 
          toggleTheme={() => setIsDarkMode(!isDarkMode)} 
        />
      )}
    </div>
  );
}