/**
 * Main-process record of every download, so the renderer can rebuild its UI after a reload.
 * The renderer owns no source of truth: it asks for a snapshot on mount, then keeps listening.
 *
 * A finished download stays in the registry (with its final message) until the renderer acknowledges it,
 * so a completion that lands while the page is reloading is replayed rather than lost.
 */
const MAX_FINISHED = 50;
const TERMINAL = { complete: 'completed', error: 'error', aborted: 'aborted' };

function createDownloadRegistry() {
  const records = new Map();

  const pruneFinished = () => {
    const finished = [...records.values()].filter((r) => r.status !== 'running');
    for (const r of finished.slice(0, Math.max(0, finished.length - MAX_FINISHED))) records.delete(r.id);
  };

  return {
    /** Register a running download. `info` is display metadata the UI wants back after a reload. */
    start(id, info = {}) {
      records.set(id, { id, status: 'running', info, progress: null, phase: '', result: null, startedAt: Date.now() });
      pruneFinished();
    },

    /** Feed every engine message through here. Returns true when it was a terminal message. */
    onMessage(id, msg) {
      const record = records.get(id);
      if (!record || !msg) return false;
      if (msg.type === 'progress') {
        record.progress = { id, ...msg };
      } else if (msg.type === 'status') {
        record.phase = msg.message || msg.phase || record.phase;
      } else if (TERMINAL[msg.type] && record.status === 'running') {
        record.status = TERMINAL[msg.type];
        record.result = { id, ...msg };
        return true;
      }
      return false;
    },

    /**
     * The engine process ended. If it never reported a terminal message it crashed or was killed:
     * record and return a synthetic error message so the UI is never left waiting forever.
     */
    markExited(id, { type = 'error', details = 'Download process exited unexpectedly.' } = {}) {
      const record = records.get(id);
      if (!record || record.status !== 'running') return null;
      const result = { id, type, error_code: 'ERR_EXIT', details, message: details };
      record.status = TERMINAL[type];
      record.result = result;
      return result;
    },

    snapshot() {
      return [...records.values()].map(({ id, status, info, progress, phase, result }) => ({
        id,
        status,
        info,
        progress,
        phase,
        result,
      }));
    },

    /** The renderer has handled a finished download; forget it. Running downloads are never dropped. */
    ack(id) {
      const record = records.get(id);
      if (record && record.status !== 'running') records.delete(id);
    },
  };
}

module.exports = { createDownloadRegistry };
