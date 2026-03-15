import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Trash2, ListTodo, CalendarDays, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  const [view, setView] = useState('today'); // 'today' or 'history'
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (view === 'today') fetchTodayTasks();
    if (view === 'history') fetchHistory();
  }, [view]);

  const fetchTodayTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/today`);
      const data = await res.json();
      
      // Defensive check: only set tasks if the response is actually an array
      if (Array.isArray(data)) {
        setTasks(data);
      } else {
        console.error("Backend returned non-array data:", data);
        setTasks([]); // Fallback to empty array to prevent .map() crash
      }
    } catch (err) {
      console.error("Failed to fetch tasks", err);
      setTasks([]); // Fallback
    }
    setLoading(false);
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/history`);
      const data = await res.json();
      
      // Group history by logical_date
      const grouped = data.reduce((acc, log) => {
        if (!acc[log.logical_date]) acc[log.logical_date] = [];
        acc[log.logical_date].push(log);
        return acc;
      }, {});
      setHistory(grouped);
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
        fetchTodayTasks(); // Refresh list
      }
    } catch (err) {
      console.error("Failed to add task", err);
    }
  };

  const toggleTask = async (logId) => {
    // Optimistic UI update
    setTasks(tasks.map(t => t.log_id === logId ? { ...t, is_completed: !t.is_completed } : t));
    try {
      await fetch(`${API_BASE}/logs/${logId}/toggle`, { method: 'PATCH' });
    } catch (err) {
      console.error("Failed to toggle", err);
      fetchTodayTasks(); // Revert on failure
    }
  };

  const deleteTask = async (taskId) => {
    // Optimistic UI update
    setTasks(tasks.filter(t => t.task_id !== taskId));
    try {
      await fetch(`${API_BASE}/tasks/${taskId}`, { method: 'DELETE' });
    } catch (err) {
      console.error("Failed to delete", err);
      fetchTodayTasks(); // Revert on failure
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-ios-bg relative shadow-2xl overflow-hidden">
      
      {/* Header */}
      <header className="pt-12 pb-4 px-6 bg-ios-bg z-10">
        <h1 className="text-3xl font-bold tracking-tight">
          {view === 'today' ? 'Today' : 'History'}
        </h1>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-10 text-ios-gray">Loading...</div>
        ) : view === 'today' ? (
          <div className="space-y-4">
            {/* Add Task Form */}
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

            {/* Tasks List */}
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
            {Object.keys(history).length === 0 ? (
              <p className="text-center text-ios-gray mt-10">No history available yet.</p>
            ) : (
              Object.keys(history).sort((a, b) => new Date(b) - new Date(a)).map(date => (
                <div key={date} className="space-y-2">
                  <h2 className="text-sm font-semibold text-ios-gray uppercase tracking-wider ml-2">
                    {format(parseISO(date), 'EEEE, MMM do')}
                  </h2>
                  <div className="bg-ios-card rounded-xl shadow-sm overflow-hidden">
                    {history[date].map((log, index) => (
                      <div key={index} className={`flex items-center p-3 ${index !== history[date].length - 1 ? 'border-b border-gray-100' : ''}`}>
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
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* iOS Bottom Navigation Bar */}
      <nav className="absolute bottom-0 w-full bg-ios-card/90 backdrop-blur-md border-t border-gray-200 flex justify-around pb-6 pt-3 px-2 z-20">
        <button 
          onClick={() => setView('today')} 
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