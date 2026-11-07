import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { isElectronEnv } from './services/apiBridge';
import { installWebDownloaderBridge } from './services/webDownloaderBridge';
import './styles/index.css';
import './styles/ui-components.css';
import './styles/grid.css';
import './styles/modals.css';
import './styles/downloader.css';
import './styles/responsive.css';
import './styles/motion.css';

// The web version is the downloader only, backed by the download server in api/
if (!isElectronEnv()) installWebDownloaderBridge();

const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Installable web version: cache the app for offline use. Electron serves the build over file://, so skip it there.
if (!isElectronEnv() && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  registerSW({ immediate: true });
}
