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

  let port;
  try {
    port = chrome.runtime.connect();
  } catch {
    reply(msg.id, { type: 'error', error_code: 'ERR_EXTENSION', details: 'The TVR YouTube Helper was reloaded. Reload this page and try again.' });
    return;
  }
  ports.set(msg.id, port);
  port.onMessage.addListener((message) => reply(msg.id, message));
  port.onDisconnect.addListener(() => {
    // A port closed before the worker finished (not by a 'cancel') means the worker died
    if (ports.delete(msg.id)) reply(msg.id, { type: 'error', error_code: 'ERR_EXTENSION', details: 'The TVR YouTube Helper stopped unexpectedly. Try again.' });
  });
  port.postMessage(msg);
});
