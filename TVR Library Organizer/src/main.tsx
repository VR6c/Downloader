import React from 'react';
import ReactDOM from 'react-dom/client';
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

// Earlier versions installed a service worker; remove it so returning visitors stop getting the cached app
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
}
