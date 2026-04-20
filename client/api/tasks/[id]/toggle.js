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
    if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method Not Allowed' });

    // Vercel extracts the :id from the folder name
    const { id } = req.query; 
    const logicalDate = getLogicalDate();

    try {
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
        
        return res.status(200).json(updatedLog);
    } catch (err) {
        console.error("Toggle error:", err);
        return res.status(500).json({ error: 'Server error toggling task' });
    }
}