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
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const logicalDate = getLogicalDate();
        
        // 1. Fetch the data
        const { data: historyData, error: fetchError } = await supabase
            .from('daily_logs')
            .select(`
                logical_date,
                is_completed,
                tasks!inner (content, created_at)
            `)
            .lte('logical_date', logicalDate);

        if (fetchError) throw fetchError;

        // 2. Format and two-tier sort
        const formattedHistory = historyData
            .sort((a, b) => {
                if (a.logical_date !== b.logical_date) {
                    return new Date(b.logical_date) - new Date(a.logical_date);
                }
                return new Date(a.tasks.created_at) - new Date(b.tasks.created_at);
            })
            .map(row => ({
                logical_date: row.logical_date,
                content: row.tasks.content,
                is_completed: row.is_completed
            }));

        return res.status(200).json(formattedHistory);
    } catch (err) {
        console.error("History error:", err);
        return res.status(500).json({ error: 'Server error fetching history' });
    }
}