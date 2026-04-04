import nodemailer from 'nodemailer';

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
    // ==========================================
    // PIPELINE 1: ATTEMPT TELEGRAM (PRIMARY)
    // ==========================================
    const telegramResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message
      })
    });

    if (!telegramResponse.ok) {
      const errorText = await telegramResponse.text();
      throw new Error(`Telegram rejected request: Status ${telegramResponse.status} - ${errorText}`);
    }

    // If we make it here, Telegram succeeded.
    return res.status(200).json({ success: true, routedVia: 'telegram' });

  } catch (telegramError) {
    // ==========================================
    // PIPELINE 2: ATTEMPT EMAIL (FALLBACK)
    // ==========================================
    console.error('Telegram failure detected. Triggering Email Fallback:', telegramError.message);

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_APP_PASSWORD
        }
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER, // Sending it to yourself
        subject: '🚨 App Support Message (Fallback System)',
        text: `The Telegram pipeline failed. Message intercepted via email fallback:\n\n${message}`
      });

      console.log('Email fallback executed successfully.');
      return res.status(200).json({ success: true, routedVia: 'email_fallback' });

    } catch (emailError) {
      // ==========================================
      // PIPELINE 3: TOTAL CATASTROPHIC FAILURE
      // ==========================================
      console.error('TOTAL PIPELINE FAILURE. Email fallback also failed:', emailError.message);
      return res.status(500).json({ error: 'Message delivery failed completely.' });
    }
  }
}