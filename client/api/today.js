import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Calculate the "Logical Date" based on a 5:00 AM IST rollover
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
    // Standard Vercel security: Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const logicalDate = getLogicalDate();
        
        // 1. Trigger the SQL auto-generation
        const { error: rpcError } = await supabase.rpc('generate_daily_logs', { 
            target_date: logicalDate 
        });
        
        if (rpcError) throw rpcError;

        // 2. Fetch today's generated list
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

        // 3. Format and sort
        const formattedData = todayTasks
            .sort((a, b) => new Date(a.tasks.created_at) - new Date(b.tasks.created_at))
            .map(row => ({
                log_id: row.id,
                task_id: row.tasks.id,
                content: row.tasks.content,
                is_completed: row.is_completed
            }));

        return res.status(200).json(formattedData);
    } catch (err) {
        console.error("Fetch tasks error:", err);
        return res.status(500).json({ error: 'Server error fetching tasks' });
    }
}