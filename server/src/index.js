require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

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
app.get('/api/health', (req, res) => {
    res.status(200).send('OK');
});

// --- GET TODAY's TASKS (Includes Auto-Generation) ---
app.get('/api/today', async (req, res) => {
    try {
        const logicalDate = getLogicalDate();
        
        // 1. Check if logs exist for today
        const checkLogs = await db.query(
            'SELECT * FROM daily_logs WHERE logical_date = $1',
            [logicalDate]
        );

        // 2. If no logs exist for today, generate them from active tasks
        if (checkLogs.rows.length === 0) {
            const activeTasks = await db.query('SELECT id FROM tasks WHERE is_active = true');
            
            if (activeTasks.rows.length > 0) {
                const insertPromises = activeTasks.rows.map(task => {
                    return db.query(
                        'INSERT INTO daily_logs (task_id, logical_date) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [task.id, logicalDate]
                    );
                });
                await Promise.all(insertPromises);
            }
        }

        // 3. Fetch today's generated list to send to the frontend
        const todayTasks = await db.query(`
            SELECT dl.id as log_id, t.id as task_id, t.content, dl.is_completed 
            FROM daily_logs dl
            JOIN tasks t ON dl.task_id = t.id
            WHERE dl.logical_date = $1 AND t.is_active = true
            ORDER BY t.created_at ASC
        `, [logicalDate]);

        res.json(todayTasks.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching tasks' });
    }
});

// --- ADD A NEW TASK ---
app.post('/api/tasks', async (req, res) => {
    try {
        const { content } = req.body;
        const logicalDate = getLogicalDate();

        // Insert into master list
        const newTask = await db.query(
            'INSERT INTO tasks (content) VALUES ($1) RETURNING *',
            [content]
        );
        
        // Immediately log it for today so it appears in the UI
        const newLog = await db.query(
            'INSERT INTO daily_logs (task_id, logical_date) VALUES ($1, $2) RETURNING *',
            [newTask.rows[0].id, logicalDate]
        );

        res.json({ task: newTask.rows[0], log: newLog.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error adding task' });
    }
});

// --- TOGGLE COMPLETION (Today Only) ---
app.patch('/api/logs/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        const logicalDate = getLogicalDate();

        // Enforce restriction: Can only toggle tasks belonging to the current logical date
        const toggle = await db.query(`
            UPDATE daily_logs 
            SET is_completed = NOT is_completed, 
                completed_at = CASE WHEN is_completed = false THEN NOW() ELSE NULL END
            WHERE id = $1 AND logical_date = $2
            RETURNING *
        `, [id, logicalDate]);

        if (toggle.rows.length === 0) {
            return res.status(403).json({ error: 'Cannot alter past history or task does not exist.' });
        }

        res.json(toggle.rows[0]);
    } catch (err) {
        console.error(err);
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
    await db.query(
      'DELETE FROM daily_logs WHERE task_id = $1 AND logical_date::date = $2',
      [id, logicalTodayIST]
    );

    // 2. Retire the blueprint (Soft Delete)
    await db.query(
      'UPDATE tasks SET is_active = FALSE WHERE id = $1', 
      [id]
    );

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
        
        const history = await db.query(`
            SELECT 
                TO_CHAR(dl.logical_date, 'YYYY-MM-DD') as logical_date, 
                t.content, 
                dl.is_completed
            FROM daily_logs dl
            JOIN tasks t ON dl.task_id = t.id
            WHERE dl.logical_date <= $1'
            ORDER BY dl.logical_date DESC, t.created_at ASC
        `, [logicalDate]);

        res.json(history.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching history' });
    }
});

const PORT = process.env.PORT || 5000;

// --- DISCORD ALERT ROUTE ---
app.post('/api/message', async (req, res) => {
  const { message } = req.body;
  
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  try {
    // We proxy the request to Discord so the client never sees your webhook URL
    const response = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `${message}`
      })
    });

    if (!response.ok) throw new Error('Failed to reach Discord');

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.listen(PORT, () => {
    console.log(`Backend securely running on port ${PORT}`);
});