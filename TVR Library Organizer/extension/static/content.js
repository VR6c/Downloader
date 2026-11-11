// Relays messages between the TVR Studio page and the extension's background worker.
// Page -> extension: { source: 'tvr-page', id, type: 'ping' | 'info' | 'audio' | 'cancel', ... }
// Extension -> page: { source: 'tvr-extension', id, ... } (id 'hello' answers a ping)
const ports = new Map();

const reply = (id, message) => window.postMessage({ source: 'tvr-extension', id, ...message }, window.location.origin);

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (event.source !== window || !msg || msg.source !== 'tvr-page') return;

  if (msg.type === 'ping') {
    reply(msg.id, { type: 'pong', version: chrome.runtime.getManifest().version });
    return;
  }
  if (msg.type === 'cancel') {
    ports.get(msg.id)?.disconnect();
    ports.delete(msg.id);
    return;
  }

  const port = chrome.runtime.connect();
  ports.set(msg.id, port);
  port.onMessage.addListener((message) => reply(msg.id, message));
  port.onDisconnect.addListener(() => ports.delete(msg.id));
  port.postMessage(msg);
});
