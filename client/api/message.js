export default async function handler(req, res) {
  // Enforce POST requests only
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  try {
    // 🚨 CRITICAL: Change this URL string to something completely unguessable.
    // This string acts as your password. If anyone guesses it, they see your alerts.
    const ntfyTopic = 'samuel_covert_alpha_override_992'; 
    
    const response = await fetch(`https://ntfy.sh/${ntfyTopic}`, {
      method: 'POST',
      body: message,
      headers: {
        'Title': 'Alert',
        'Priority': 'high',
        'Tags': 'rotating_light'
      }
    });

    if (!response.ok) {
      throw new Error(`ntfy rejected request: ${response.status}`);
    }

    console.log('ntfy push executed successfully.');
    return res.status(200).json({ success: true, routedVia: 'ntfy' });

  } catch (error) {
    console.error('TOTAL PIPELINE FAILURE:', error.message);
    return res.status(500).json({ error: 'Message delivery failed.' });
  }
}