// /api/message.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error("Missing Telegram Environment Variables");
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  try {
    const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    });

    if (!telegramRes.ok) {
      throw new Error(`Telegram API responded with ${telegramRes.status}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
    return res.status(500).json({ error: 'Failed to dispatch alert' });
  }
}