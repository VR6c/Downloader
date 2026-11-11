// Sandboxed extension pages are the only place MV3 allows eval-style code.
window.addEventListener('message', (event) => {
  const { id, output } = event.data || {};
  try {
    const result = new Function(output)();
    event.source.postMessage({ id, result }, '*');
  } catch (e) {
    event.source.postMessage({ id, error: String(e && e.message ? e.message : e) }, '*');
  }
});
