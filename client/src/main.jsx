import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { ChatProvider } from './ChatProvider.jsx';
import { registerSW } from 'virtual:pwa-register';

// 1. Single, unified render call wrapping the entire app
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ChatProvider currentUser="priya">
      <App />
    </ChatProvider>
  </StrictMode>
);

// 2. Service Worker & Background Polling Logic
let swRegistration = null;
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
});

// 3. UNTHROTTLED Foreground Check
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && swRegistration) {
    console.log('App in foreground. Pinging Vercel directly...');
    swRegistration.update(); 
  }
});