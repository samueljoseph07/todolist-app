import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// 1. Import the Vite PWA registration module
import { registerSW } from 'virtual:pwa-register'

// 2. Execute the registration and force the cache to clear on update
const updateSW = registerSW({
  onNeedRefresh() {
    // This physically forces the browser to pull the new files 
    // without waiting for the user to close the app.
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App is ready to work offline.');
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  )