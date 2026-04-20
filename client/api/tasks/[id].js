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
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method Not Allowed' });

    // Vercel extracts the :id from the filename and puts it in req.query
    const { id } = req.query; 
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

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("Delete error:", err);
        return res.status(500).json({ error: 'Failed to retire task' });
    }
}