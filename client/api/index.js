// import dotenv from 'dotenv';
// dotenv.config();

import nodemailer from 'nodemailer';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import Pusher from 'pusher';



// Initialize Supabase REST Client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // ✅ ADD THIS

let pusher;

try {
  pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true,
  });
} catch (err) {
  console.error("Pusher init failed:", err);
}

app.post('/api/pusher/auth', (req, res) => {
  const { socket_id, channel_name, user_id } = req.body;

  const auth = pusher.authenticate(socket_id, channel_name, {
    user_id,
    user_info: { name: user_id },
  });

  res.send(auth);
});

app.post('/api/send-message', async (req, res) => {
  try {
    if (!pusher) throw new Error("Pusher not initialized");

    const { sender, text } = req.body;

    await pusher.trigger('presence-chat', 'message', {
      sender,
      text,
      timestamp: Date.now(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// --- CORE TIMEZONE LOGIC ---
// Calculates the "Logical Date" based on a 5:00 AM IST rollover
const getLogicalDate = () => {
    const now = new Date();
    // Convert server time to IST string, then back to a Date object
    const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(istString);
    
    // Subtract 3 hours. If it's 2:30 AM on March 14, this pushes it back to 11:30 PM March 13.
    istDate.setHours(istDate.getHours() - 3);
    
    // Format to YYYY-MM-DD for PostgreSQL
    const year = istDate.getFullYear();
    const month = String(istDate.getMonth() + 1).padStart(2, '0');
    const day = String(istDate.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
};

// --- KEEP-ALIVE ENDPOINT ---
// Only keeps the Render container awake. No DB ping required for REST.
app.get('/api/health', (req, res) => {
    res.status(200).send('OK');
});

// --- GET TODAY's TASKS (Includes Auto-Generation) ---
app.get('/api/today', async (req, res) => {
    try {
        const logicalDate = getLogicalDate();
        
        // 1. Trigger the SQL function over HTTP to auto-generate missing logs
        const { error: rpcError } = await supabase.rpc('generate_daily_logs', { 
            target_date: logicalDate 
        });
        
        if (rpcError) throw rpcError;

        // 2. Fetch today's generated list using PostgREST inner joins
        // Notice we removed the broken .order() command from here
        const { data: todayTasks, error: fetchError } = await supabase
            .from('daily_logs')
            .select(`
                id,
                is_completed,
                tasks!inner (id, content, is_active, created_at)
            `)
            .eq('logical_date', logicalDate)
            .eq('tasks.is_active', true);

        if (fetchError) throw fetchError;

        // 3. THE FIX: Sort it in JavaScript using the original task's creation date, then map it
        const formattedData = todayTasks
            .sort((a, b) => new Date(a.tasks.created_at) - new Date(b.tasks.created_at))
            .map(row => ({
                log_id: row.id,
                task_id: row.tasks.id,
                content: row.tasks.content,
                is_completed: row.is_completed
            }));

        res.json(formattedData);
    } catch (err) {
        console.error("Fetch tasks error:", err);
        res.status(500).json({ error: 'Server error fetching tasks' });
    }
});

// --- ADD A NEW TASK ---
app.post('/api/tasks', async (req, res) => {
    try {
        const { content } = req.body;
        const logicalDate = getLogicalDate();

        // Insert into master list
        const { data: newTask, error: taskError } = await supabase
            .from('tasks')
            .insert([{ content }])
            .select()
            .single();
            
        if (taskError) throw taskError;
        
        // Immediately log it for today so it appears in the UI
        const { data: newLog, error: logError } = await supabase
            .from('daily_logs')
            .insert([{ task_id: newTask.id, logical_date: logicalDate }])
            .select()
            .single();

        if (logError) throw logError;

        res.json({ task: newTask, log: newLog });
    } catch (err) {
        console.error("Add task error:", err);
        res.status(500).json({ error: 'Server error adding task' });
    }
});

// --- TOGGLE COMPLETION (Today Only) ---
app.patch('/api/logs/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        const logicalDate = getLogicalDate();

        // Enforce restriction: Check if it belongs to current logical date
        const { data: currentLog, error: fetchError } = await supabase
            .from('daily_logs')
            .select('is_completed')
            .eq('id', id)
            .eq('logical_date', logicalDate)
            .single();

        if (fetchError || !currentLog) {
            return res.status(403).json({ error: 'Cannot alter past history or task does not exist.' });
        }

        const newStatus = !currentLog.is_completed;
        const completedAt = newStatus ? new Date().toISOString() : null;

        // Update the status
        const { data: updatedLog, error: updateError } = await supabase
            .from('daily_logs')
            .update({ is_completed: newStatus, completed_at: completedAt })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;
        
        res.json(updatedLog);
    } catch (err) {
        console.error("Toggle error:", err);
        res.status(500).json({ error: 'Server error toggling task' });
    }
});

// --- DELETE A TASK (Soft Delete) ---
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  
  // Use the single source of truth for your time-shift math
  const logicalTodayIST = getLogicalDate();

  try {
    // 1. Erase today's receipt (Same-Day Forgiveness)
    const { error: deleteError } = await supabase
        .from('daily_logs')
        .delete()
        .eq('task_id', id)
        .eq('logical_date', logicalTodayIST);

    if (deleteError) throw deleteError;

    // 2. Retire the blueprint (Soft Delete)
    const { error: updateError } = await supabase
        .from('tasks')
        .update({ is_active: false })
        .eq('id', id);

    if (updateError) throw updateError;

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: 'Failed to retire task' });
  }
});

// --- GET 30-DAY HISTORY ---
app.get('/api/history', async (req, res) => {
    try {
        const logicalDate = getLogicalDate();
        
        // 1. Fetch the data (we strip out Supabase's broken nested ordering)
        const { data: historyData, error: fetchError } = await supabase
            .from('daily_logs')
            .select(`
                logical_date,
                is_completed,
                tasks!inner (content, created_at)
            `)
            .lte('logical_date', logicalDate);

        if (fetchError) throw fetchError;

        // 2. THE FIX: Two-tier JavaScript sorting
        const formattedHistory = historyData
            .sort((a, b) => {
                // Tier 1: Sort by Day (Descending: Newest days first)
                if (a.logical_date !== b.logical_date) {
                    return new Date(b.logical_date) - new Date(a.logical_date);
                }
                // Tier 2: Sort by Task Creation Time (Ascending: Oldest tasks first)
                return new Date(a.tasks.created_at) - new Date(b.tasks.created_at);
            })
            .map(row => ({
                logical_date: row.logical_date,
                content: row.tasks.content,
                is_completed: row.is_completed
            }));

        res.json(formattedHistory);
    } catch (err) {
        console.error("History error:", err);
        res.status(500).json({ error: 'Server error fetching history' });
    }
});

const PORT = process.env.PORT || 10000;

// The '0.0.0.0' is the critical fix. It tells Node to accept external connections.
// app.listen(PORT, '0.0.0.0', () => {
//   console.log(`Backend securely running on port ${PORT} over REST API`);
// });
export default app;