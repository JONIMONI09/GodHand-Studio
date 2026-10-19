import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { ActivityProvider } from './context/ActivityContext';
import { ActivityProgressWidget } from './components/ActivityProgressWidget';
import { Toaster } from 'react-hot-toast';
import './lib/i18nGuard';

// Gracefully handle benign ResizeObserver loop notifications from Monaco & splitters
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    if (e.message && (
      e.message.includes('ResizeObserver loop completed with undelivered notifications') ||
      e.message.includes('ResizeObserver loop limit exceeded')
    )) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <ActivityProvider>
        <BrowserRouter>
          <App />
          <ActivityProgressWidget />
          <Toaster position="bottom-left" toastOptions={{ className: 'bg-slate-800 text-white border border-slate-700' }} />
        </BrowserRouter>
      </ActivityProvider>
    </AuthProvider>
  </React.StrictMode>
);
