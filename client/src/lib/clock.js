/**
 * A pausable, speed-scaled clock for playback. `wait(ms)` measures `ms` of SIGN time:
 * at speed 0.5 it takes twice as long in real time, and while paused it does not
 * advance at all. Changing speed or pausing mid-wait re-plans the remaining time, so
 * slow practice never changes the sequence itself — only how fast it is walked through.
 * Like `delay`, a wait resolves (never rejects) when its AbortSignal fires.
 */
export function createClock({ speed = 1, paused = false } = {}) {
  const listeners = new Set();
  const clock = {
    speed, paused,
    set(patch) {
      Object.assign(clock, patch);
      listeners.forEach((fn) => fn());
    },
    wait(ms, signal) {
      return new Promise((resolve) => {
        if (signal?.aborted) { resolve(); return; }
        let remaining = ms, started = 0, rate = 1, id = null;
        const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const finish = () => {
          clearTimeout(id);
          listeners.delete(replan);
          signal?.removeEventListener('abort', finish);
          resolve();
        };
        const arm = () => {
          clearTimeout(id); id = null;
          if (clock.paused) return;
          started = now();
          rate = Math.max(0.05, clock.speed);
          id = setTimeout(finish, Math.max(0, remaining) / rate);
        };
        function replan() {
          if (id != null) remaining = Math.max(0, remaining - (now() - started) * rate);
          arm();
        }
        listeners.add(replan);
        signal?.addEventListener('abort', finish, { once: true });
        arm();
      });
    },
  };
  return clock;
}
