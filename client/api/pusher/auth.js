import Pusher from 'pusher';

// Initialize the backend Pusher client using your secret keys
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.VITE_PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.VITE_PUSHER_CLUSTER,
  useTLS: true,
});

export default async function handler(req, res) {
  // Reject anything that isn't a POST request
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Pusher-js sends auth requests as URL-encoded forms by default
  const socketId = req.body.socket_id;
  const channel = req.body.channel_name;
  
  // We passed the current user's name from the frontend via params
  const userId = req.body.user_id; 

  if (!socketId || !channel || !userId) {
    return res.status(400).send('Missing required parameters');
  }

  // The payload that tells Pusher who this user is
  const presenceData = {
    user_id: userId,
    user_info: {
      name: userId,
    }
  };

  try {
    // Generate the cryptographic signature
    const authResponse = pusher.authorizeChannel(socketId, channel, presenceData);
    res.status(200).send(authResponse);
  } catch (error) {
    console.error('Pusher Auth Error:', error);
    res.status(500).send('Internal Server Error');
  }
}