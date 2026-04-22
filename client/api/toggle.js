import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
    // Reject anything that isn't a POST request
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { log_id, is_completed } = req.body;

        if (!log_id) {
            return res.status(400).json({ error: 'Missing log_id' });
        }

        // Update the specific row in the daily_logs table
        const { error } = await supabase
            .from('daily_logs')
            .update({ is_completed: is_completed })
            .eq('id', log_id);

        if (error) throw error;

        return res.status(200).json({ success: true, is_completed });

    } catch (err) {
        console.error("Toggle error:", err);
        return res.status(500).json({ error: 'Server error toggling task' });
    }
}