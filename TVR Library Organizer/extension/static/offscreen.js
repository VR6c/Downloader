// Chrome service workers can't eval, so the player-script evaluation runs in the sandboxed page next door.
const frame = document.getElementById('sandbox');
const pending = new Map();
const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
let nextId = 0;

window.addEventListener('message', (event) => {
  const { id, result, error } = event.data || {};
  const done = pending.get(id);
  if (!done) return;
  pending.delete(id);
  error ? done.reject(new Error(error)) : done.resolve(result);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen' || message.type !== 'eval') return;
  const id = nextId++;
  loaded
    .then(
      () =>
        new Promise((resolve, reject) => {
          pending.set(id, { resolve, reject });
          frame.contentWindow.postMessage({ id, output: message.output }, '*');
        }),
    )
    .then(
      (result) => sendResponse({ result }),
      (error) => sendResponse({ error: error.message }),
    );
  return true;
});
