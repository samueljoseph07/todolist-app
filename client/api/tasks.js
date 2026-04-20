import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const getLogicalDate = () => {
    const now = new Date();
    const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(istString);
    istDate.setHours(istDate.getHours() - 3);
    const year = istDate.getFullYear();
    const month = String(istDate.getMonth() + 1).padStart(2, '0');
    const day = String(istDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

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

        return res.status(200).json({ task: newTask, log: newLog });
    } catch (err) {
        console.error("Add task error:", err);
        return res.status(500).json({ error: 'Server error adding task' });
    }
}