import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// ==========================================
// SYSTEM INITIALIZATION
// ==========================================
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

webpush.setVapidDetails(
  'mailto:samuel.admin@example.com', // Change this to your actual email
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  // Enforce POST requests only
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  let webPushSuccess = false;

  // ==========================================
  // PIPELINE 1: DIRECT NATIVE PUSH (PRIMARY)
  // ==========================================
  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('subscription_json')
      .eq('user_id', 'sam')
      .single();

    if (error || !data) {
      console.warn("Web Push Warning: Samuel's device token not found in DB.");
    } else {
      const payload = JSON.stringify({
        title: 'Covert Chat Alert',
        body: message
      });
      await webpush.sendNotification(data.subscription_json, payload);
      console.log('Web Push executed successfully.');
      webPushSuccess = true;
    }
  } catch (pushError) {
    console.error('Web Push failure detected:', pushError.message);
  }

  // ==========================================
  // PIPELINE 2: ATTEMPT TELEGRAM (PAPER TRAIL)
  // ==========================================
  try {
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

    // Telegram succeeded
    return res.status(200).json({ 
      success: true, 
      routedVia: webPushSuccess ? 'web_push_and_telegram' : 'telegram_only' 
    });

  } catch (telegramError) {
    // ==========================================
    // PIPELINE 3: ATTEMPT EMAIL (FALLBACK)
    // ==========================================
    console.error('Telegram failure detected. Triggering Email Fallback:', telegramError.message);

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_APP_PASSWORD // Ensure this matches your Vercel env variable name
        }
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER, // Sending it to yourself
        subject: '🚨 App Support Message (Fallback System)',
        text: `The Telegram pipeline failed. Message intercepted via email fallback:\n\n${message}`
      });

      console.log('Email fallback executed successfully.');
      return res.status(200).json({ 
        success: true, 
        routedVia: webPushSuccess ? 'web_push_and_email' : 'email_fallback' 
      });

    } catch (emailError) {
      // ==========================================
      // PIPELINE 4: TOTAL CATASTROPHIC FAILURE
      // ==========================================
      console.error('TOTAL BACKUP PIPELINE FAILURE. Email fallback also failed:', emailError.message);
      
      // If Web Push worked, the notification still technically succeeded
      if (webPushSuccess) {
        return res.status(200).json({ 
          success: true, 
          routedVia: 'web_push_only', 
          error: 'Telegram and Email failed' 
        });
      }

      return res.status(500).json({ error: 'Message delivery failed completely across all pipelines.' });
    }
  }
}