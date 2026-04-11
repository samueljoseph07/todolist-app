import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { ChatProvider } from './ChatProvider.jsx';
import { registerSW } from 'virtual:pwa-register';

// Render app
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ChatProvider currentUser="priya">
      <App />
    </ChatProvider>
  </StrictMode>
);

// Service Worker setup (SAFE VERSION)
let swRegistration = null;

const updateSW = registerSW({
  onNeedRefresh() {
    // Force update only when a new version is detected
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App is ready to work offline.');
  },
  onRegisteredSW(_swUrl, registration) {
    swRegistration = registration;
  }
});

// Only update when app comes to foreground
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && swRegistration) {
    console.log('App in foreground. Checking for updates...');
    swRegistration.update();
  }
});