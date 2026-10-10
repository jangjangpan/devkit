import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { DarkProvider } from './theme/DarkContext';
import { MenuConfigProvider } from './context/MenuConfigContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/devkit">
      <DarkProvider>
        <AuthProvider>
          <MenuConfigProvider>
            <App />
          </MenuConfigProvider>
        </AuthProvider>
      </DarkProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2200,
          className: '!text-sm',
          style: { padding: '10px 14px' },
          success: { iconTheme: { primary: '#6FAA52', secondary: 'white' } },
          error: { iconTheme: { primary: '#BC2C2D', secondary: 'white' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
);
