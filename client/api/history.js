import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Helper to get current month if she doesn't provide one
const getCurrentMonthString = () => {
    const now = new Date();
    const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(istString);
    istDate.setHours(istDate.getHours() - 3); // Logical rollover
    return `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}`;
};

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 1. Read the month from the URL, or default to current month
        const targetMonth = req.query.month || getCurrentMonthString();
        
        // Split 'YYYY-MM' into variables
        const [year, month] = targetMonth.split('-');

        // 2. Calculate exact boundaries for the SQL query
        const startDate = `${year}-${month}-01`;
        
        // JavaScript Date trick: Day 0 of the *next* month gives the last day of the *current* month
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${month}-${lastDay}`;
        
        // 3. Fetch strictly bounded data for just this month
        const { data: historyData, error: fetchError } = await supabase
            .from('daily_logs')
            .select(`
                logical_date,
                is_completed,
                tasks!inner (content, created_at)
            `)
            .gte('logical_date', startDate) // Lower bound (1st of the month)
            .lte('logical_date', endDate);  // Upper bound (28th/30th/31st of the month)

        if (fetchError) throw fetchError;

        // 4. Format and sort
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