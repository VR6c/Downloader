const { spawn } = require('child_process');
const readline = require('readline');

/**
 * Spawn the downloader engine and resolve with the first line for which
 * `onMessage(parsedJson)` returns a non-undefined value, or with `onClose(code)` / error / timeout results.
 * Collapses the spawn + readline + timeout + settle-once boilerplate shared by every one-shot engine call.
 */
function runEngineOnce(engine, extraArgs, { timeoutMs, onMessage, onClose, onError, onTimeout }) {
  return new Promise((resolve) => {
    let settled = false;
    let proc = null;
    let timer = null;

    const settle = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    try {
      proc = spawn(engine.executable, [...engine.args, ...extraArgs], { shell: false });
    } catch (err) {
      return settle(onError(err));
    }

    readline.createInterface({ input: proc.stdout }).on('line', (line) => {
      let msg;
      try {
        msg = JSON.parse(line.trim());
      } catch {
        return;
      }
      const result = onMessage(msg);
      if (result !== undefined) settle(result);
    });

    proc.on('close', (code) => settle(onClose(code)));
    proc.on('error', (err) => settle(onError(err)));

    if (timeoutMs) {
      timer = setTimeout(() => {
        if (settled) return;
        try { proc.kill(); } catch { /* already exited */ }
        settle(onTimeout());
      }, timeoutMs);
    }
  });
}

module.exports = { runEngineOnce };
