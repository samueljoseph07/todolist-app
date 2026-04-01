import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// 1. Import the Vite PWA registration module
import { registerSW } from 'virtual:pwa-register'

// 2. Execute the registration
const updateSW = registerSW({
  onNeedRefresh() {
    // Force the browser to pull the new files and reload
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App is ready to work offline.');
  },
})

// 3. THE FIX: Force a version check every time the app comes into the foreground
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // The app is back on the screen. Ping Vercel for updates.
    updateSW(false); 
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  )