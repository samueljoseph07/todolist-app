import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

import { registerSW } from 'virtual:pwa-register'

let swRegistration = null;

// 1. Define your background polling interval (e.g., 15 minutes)
const INTERVAL_MS = 15 * 60 * 1000; 

const updateSW = registerSW({
  onNeedRefresh() {
    // Force the browser to pull the new files and reload
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App is ready to work offline.');
  },
  onRegisteredSW(_swUrl, registration) {
    swRegistration = registration;
    
    // Background Polling
    if (registration) {
      setInterval(() => {
        console.log('Background interval: Checking Vercel for UI updates...');
        registration.update();
      }, INTERVAL_MS);
    }
  }
})

// 2. UNTHROTTLED Foreground Check
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && swRegistration) {
    console.log('App in foreground. Pinging Vercel directly...');
    // This fires immediately, every single time the app is opened or switched to.
    swRegistration.update(); 
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)