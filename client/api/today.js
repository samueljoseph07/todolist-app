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

const formatTasks = (tasksData) => {
    return tasksData
        .sort((a, b) => new Date(a.tasks.created_at) - new Date(b.tasks.created_at))
        .map(row => ({
            log_id: row.id,
            task_id: row.tasks.id,
            content: row.tasks.content,
            is_completed: row.is_completed
        }));
};

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const logicalDate = getLogicalDate();
        
        // 1. THE FAST PATH: Attempt to just read the data first.
        const { data: initialTasks, error: fetchError } = await supabase
            .from('daily_logs')
            .select(`
                id,
                is_completed,
                tasks!inner (id, content, is_active, created_at)
            `)
            .eq('logical_date', logicalDate)
            .eq('tasks.is_active', true);

        if (fetchError) throw fetchError;

        // 2. If data exists, format and return instantly (99% of requests)
        if (initialTasks && initialTasks.length > 0) {
            return res.status(200).json(formatTasks(initialTasks));
        }

        // 3. THE HEAVY PATH: It's a new day and the list is empty. Generate it.
        const { error: rpcError } = await supabase.rpc('generate_daily_logs', { 
            target_date: logicalDate 
        });
        
        if (rpcError) throw rpcError;

        // 4. Fetch the newly generated list
        const { data: generatedTasks, error: postGenError } = await supabase
            .from('daily_logs')
            .select(`
                id,
                is_completed,
                tasks!inner (id, content, is_active, created_at)
            `)
            .eq('logical_date', logicalDate)
            .eq('tasks.is_active', true);

        if (postGenError) throw postGenError;

        return res.status(200).json(formatTasks(generatedTasks));
        
    } catch (err) {
        console.error("Fetch tasks error:", err);
        return res.status(500).json({ error: 'Server error fetching tasks' });
    }
}