import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Trash2, ListTodo, CalendarDays, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, subMonths, addMonths } from 'date-fns';

const API_BASE = 'https://todolist-app-backend-ac32.onrender.com/api';

export default function App() {
  const [view, setView] = useState('today');
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState({});
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(true);
  
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

  return (
    <div className="flex flex-col min-h-[100dvh] w-full max-w-md mx-auto bg-ios-bg relative shadow-2xl">
      
      <header className="pt-12 pb-4 px-6 bg-ios-bg z-10">
        <h1 className="text-3xl font-bold tracking-tight">
          {view === 'today' ? 'Today' : 'History'}
        </h1>
      </header>

      <main className="flex-1 px-4 pb-32">
        {loading ? (
          <div className="flex justify-center py-10 text-ios-gray">Loading...</div>
        ) : view === 'today' ? (
          
          <div className="space-y-4">
            <form onSubmit={addTask} className="relative flex items-center">
              <input 
                type="text" 
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="New routine task..."
                className="w-full bg-ios-card rounded-xl py-3 pl-4 pr-12 shadow-sm focus:outline-none focus:ring-2 focus:ring-ios-blue transition-all"
              />
              <button type="submit" className="absolute right-3 text-ios-blue disabled:opacity-50" disabled={!newTask.trim()}>
                <Plus size={24} />
              </button>
            </form>

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

    </div>
  );
}