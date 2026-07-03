import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Apply dark mode immediately from localStorage (prevents flash)
const stored = localStorage.getItem('varun-hotel-theme');
if (stored) {
  try {
    const { state } = JSON.parse(stored);
    if (state?.isDark !== false) {
      document.documentElement.classList.add('dark');
    }
  } catch {
    document.documentElement.classList.add('dark'); // default dark
  }
} else {
  document.documentElement.classList.add('dark'); // default dark
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
