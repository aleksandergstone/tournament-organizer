import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Provider } from './state/store';
import ErrorBoundary from './ui/ErrorBoundary';
import { installMobileBridge } from './engine/mobile-bridge';
import './app.css';

// On a phone this defines the same file/print bridge the desktop preload does,
// before any screen can ask for it. No-op on desktop and in a browser.
installMobileBridge();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider><App /></Provider>
    </ErrorBoundary>
  </React.StrictMode>
);
