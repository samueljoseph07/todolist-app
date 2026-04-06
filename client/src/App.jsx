import LiveChat from './LiveChat'; // Adjust path as needed
import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Trash2, ListTodo, CalendarDays, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, subMonths, addMonths } from 'date-fns';
import { MessageCircle, X } from 'lucide-react'; // Added MessageCircle and X

const API_BASE = 'https://todolist-app-backend-ac32.onrender.com/api';
//local:
// const API_BASE = 'http://localhost:5000/api';

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
  const [pagerFailed, setPagerFailed] = useState(false); // NEW STATE
  const [supportError, setSupportError] = useState(null); // NEW STATE

  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);

  useEffect(() => {
    if (view === 'today') fetchTodayTasks();
    if (view === 'history') fetchHistory();
  }, [view]);

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
      const res = await fetch(`${API_BASE}/history`);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        const grouped = data.reduce((acc, log) => {
          // THE FIX: Strip the 'T00:00:00.000Z' off the Postgres ISO string
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
    setSupportError(null); // Clear any previous errors when she tries again
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
        // Optional: Add a temporary "Sent!" toast notification state here if you want
      } else {
        // If the server rejects it (e.g. 500 error)
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
    setTasks(tasks.map(t => t.log_id === logId ? { ...t, is_completed: !t.is_completed } : t));
    try {
      await fetch(`${API_BASE}/logs/${logId}/toggle`, { method: 'PATCH' });
    } catch (err) {
      console.error("Failed to toggle", err);
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
    // 1. Reset error state and open the UI instantly
    setPagerFailed(false);
    setIsChatOpen(true);

    // 2. Fire and Forget. Notice there is no 'await' and no state updates on failure.
    // If the browser throws a CORS or network error, it just logs quietly in the background 
    // and keeps the 10-second fake boot sequence running.
    fetch(`/api/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: "🚨 She just opened the AI Assistant! Get online." 
      })
    }).catch(error => {
      // Silently swallow the error. The UI must never know the pager failed.
      console.error("Silent pager network drop (ignored):", error);
    });
  };

  return (
    <div className="flex flex-col min-h-[100dvh] w-full max-w-md mx-auto bg-ios-bg relative shadow-2xl">
      
      <header className="pt-12 pb-6 px-6 flex justify-between items-center z-10">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {view === 'today' ? 'Today' : 'History'}
        </h1>
        {/* The Sneaky AI Button */}
        <div className="flex items-center gap-8">
        <button 
            onClick={triggerPagerAndOpenChat}
            className="pl-20 text-blue-400 hover:text-ios-blue transition-colors"
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
          className="p-2 text-blue-400 hover:text-ios-blue transition-colors">
          <MessageCircle size={24} />
        </button>
        </div>
      </header>
      <p className="pt-0 pb-2 px-6 flex justify-between items-center z-10 italic">Please keep the chat open till the model is connected 😊</p>

      <main className="flex-1 px-4 pb-40">
        {loading ? (
          <div className="flex justify-center py-10 text-ios-gray">Loading...</div>
        ) : view === 'today' ? (
          
          <div className="space-y-4">

            <div className="bg-ios-card rounded-xl shadow-sm overflow-hidden">
              {tasks.length === 0 ? (
                <p className="py-6 text-center text-ios-gray">No tasks active. Add one above.</p>
              ) : (
                tasks.map((task, index) => (
                  <div key={task.log_id} className={`flex items-center justify-between p-4 ${index !== tasks.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <div className="flex items-center space-x-3 flex-1 cursor-pointer" onClick={() => toggleTask(task.log_id)}>
                      {task.is_completed ? (
                        <CheckCircle2 size={24} className="text-ios-blue" />
                      ) : (
                        <Circle size={24} className="text-ios-gray" />
                      )}
                      <span className={`text-lg ${task.is_completed ? 'text-ios-gray line-through' : 'text-ios-text'}`}>
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
            <div className="bg-ios-card rounded-xl shadow-sm p-4">
              
              <div className="flex justify-between items-center mb-4">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 text-ios-blue">
                  <ChevronLeft size={24} />
                </button>
                <h2 className="text-lg font-semibold">
                  {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 text-ios-blue">
                  <ChevronRight size={24} />
                </button>
              </div>

              <div className="grid grid-cols-7 mb-2 text-center text-xs text-ios-gray font-semibold">
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
                        /* THE UI FIX: Changed rounded-full to rounded-2xl */
                        className={`relative w-10 h-10 rounded-2xl overflow-hidden flex items-center justify-center border-2 
                          ${isSelected ? 'border-ios-blue shadow-md' : 'border-gray-100'} 
                          ${!isCurrentMonth ? 'opacity-30' : ''} 
                          ${!dayLogs ? 'cursor-default bg-gray-50' : 'cursor-pointer hover:scale-105 transition-transform bg-gray-100'}
                        `}
                      >
                        {dayLogs && (
                          <div 
                            className={`absolute bottom-0 w-full ${fillColor} transition-all duration-700 opacity-80`} 
                            style={{ height: `${percent}%` }}
                          />
                        )}
                        
                        <span className={`relative z-10 text-sm font-medium ${dayLogs && percent > 50 ? 'text-white' : 'text-ios-text'}`}>
                          {format(day, 'd')}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedHistoryDate && history[selectedHistoryDate] && (
              <div className="bg-ios-card rounded-xl shadow-sm overflow-hidden animate-fade-in">
                <h3 className="bg-gray-50 px-4 py-3 text-sm font-semibold text-ios-gray border-b border-gray-100 uppercase tracking-wider">
                  {format(parseISO(selectedHistoryDate), 'EEEE, MMMM do')}
                </h3>
                {history[selectedHistoryDate].map((log, index) => (
                  <div key={index} className="flex items-center p-4 border-b border-gray-100 last:border-0">
                    {log.is_completed ? (
                      <CheckCircle2 size={20} className="text-ios-blue mr-3" />
                    ) : (
                      <Circle size={20} className="text-ios-gray mr-3" />
                    )}
                    <span className={`text-md ${log.is_completed ? 'text-ios-gray line-through' : 'text-ios-text'}`}>
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
        <div className="fixed bottom-[88px] w-full max-w-md left-0 right-0 mx-auto px-4 z-40 bg-ios-bg/90 backdrop-blur-md pt-2 pb-2">
          <form onSubmit={addTask} className="relative flex items-center drop-shadow-lg">
            <textarea 
              type="text" 
              inputMode="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="New task..."
              /* --- THE ANDROID KEYBOARD OVERRIDES --- */
              enterKeyHint="send"
              autoCapitalize="sentences"
              autoCorrect="on"
              spellCheck="true"
              /* -------------------------------------- */
              rows={1}
              className="w-full bg-ios-card rounded-xl py-3 pl-4 pr-12 shadow-sm border border-gray-100 focus:outline-none focus:ring-2 focus:ring-ios-blue transition-all"
            />
            <button type="submit" className="absolute right-3 text-ios-blue disabled:opacity-50" disabled={!newTask.trim()}>
              <Plus size={24} />
            </button>
          </form>
        </div>
      )}

      {/* Your existing <nav> goes here */}
      <nav className="fixed bottom-0 w-full max-w-md left-0 right-0 mx-auto bg-ios-card/90 backdrop-blur-md border-t border-gray-200 flex justify-around pb-8 pt-3 px-2 z-50">
        <button 
          onClick={() => { setView('today'); setSelectedHistoryDate(null); }} 
          className={`flex flex-col items-center space-y-1 w-1/2 ${view === 'today' ? 'text-ios-blue' : 'text-ios-gray'}`}
        >
          <ListTodo size={24} />
          <span className="text-xs font-medium">Today</span>
        </button>
        <button 
          onClick={() => setView('history')} 
          className={`flex flex-col items-center space-y-1 w-1/2 ${view === 'history' ? 'text-ios-blue' : 'text-ios-gray'}`}
        >
          <CalendarDays size={24} />
          <span className="text-xs font-medium">History</span>
        </button>
      </nav>
      {/* MESSAGE MODAL OVERLAY */}
      {isMessageModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 pb-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-ios-card w-full max-w-sm rounded-2xl shadow-2xl p-6 relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => {
                setIsMessageModalOpen(false);
                setSupportError(null); // Clear error if she closes the modal
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-800"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Message Support</h2>
            <form onSubmit={handleSendMessage}>
              <textarea
                value={supportMessage}
                onChange={(e) => {
                  setSupportMessage(e.target.value);
                  if (supportError) setSupportError(null); // Clear error as soon as she starts typing again
                }}
                placeholder="What's on your mind?"
                className={`w-full h-32 p-3 bg-ios-bg border ${supportError ? 'border-red-400 focus:ring-red-500' : 'border-gray-200 focus:ring-ios-blue'} rounded-xl mb-4 resize-none focus:outline-none focus:ring-2 text-gray-800`}
                autoFocus
              />
              
              {/* NEW: The Error Display */}
              {supportError && (
                <div className="mb-4 text-sm text-red-500 bg-red-50 p-2.5 rounded-lg border border-red-100 flex items-center gap-2">
                  <span className="font-semibold">⚠️</span> {supportError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSending || !supportMessage.trim()}
                className="w-full bg-ios-blue text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-opacity"
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        </div>
      )}
      {isChatOpen && <LiveChat onClose={() => setIsChatOpen(false)} pagerFailed={pagerFailed} />}
    </div>
  );
}
