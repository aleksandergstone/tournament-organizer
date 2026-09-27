import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Provider } from './state/store';
import ErrorBoundary from './ui/ErrorBoundary';
import './app.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider><App /></Provider>
    </ErrorBoundary>
  </React.StrictMode>
);
